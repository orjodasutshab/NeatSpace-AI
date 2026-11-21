import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  StripeWebhookStore,
  verifyStripeWebhookSignature,
  getStripeWebhookToleranceSeconds,
  resolveStripePriceMap,
} from './stripeWebhookEngine';

dotenv.config();
const stripeStore = new StripeWebhookStore();

const app = express();
const PORT = 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

let FIREBASE_API_KEY = '';
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const parsedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    FIREBASE_API_KEY = String(parsedCfg?.apiKey || '');
  }
} catch {
  // ignore
}

const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || 'abc085876@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

// Real in-process telemetry counters (exposed only to verified admins on /api/admin/health)
const serverTelemetry = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  endpointCounts: {} as Record<string, number>,
  recentErrors: [] as Array<{ time: string; path: string; message: string }>,
};

// Security headers middleware (Phase 11)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  next();
});

// Body parser middleware preserving exact rawBody bytes for Stripe webhook HMAC verification
app.use(
  express.json({
    limit: '15mb',
    type: ['application/json', 'application/*+json'],
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Sliding-window API rate limiter (Phase 11)
const rateBuckets = new Map<string, number[]>();
const HEAVY_AI_ROUTES = new Set(['/api/analyze-room', '/api/redesign-room', '/api/compare-after']);

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

app.use('/api', (req, res, next) => {
  const pathKey = req.baseUrl + req.path;
  serverTelemetry.totalRequests += 1;
  serverTelemetry.endpointCounts[pathKey] = (serverTelemetry.endpointCounts[pathKey] || 0) + 1;

  if (pathKey === '/api/health' || pathKey === '/api/stripe/webhook' || pathKey === '/api/billing/webhook') {
    return next();
  }

  const isHeavy = HEAVY_AI_ROUTES.has(pathKey);
  const maxReqs = isHeavy ? 15 : 60;
  const windowMs = 60_000;
  const bucketKey = `${getClientIp(req)}::${isHeavy ? 'heavy' : 'std'}`;
  const now = Date.now();
  const timestamps = (rateBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= maxReqs) {
    const oldest = timestamps[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfterSeconds,
    });
  }

  timestamps.push(now);
  rateBuckets.set(bucketKey, timestamps);
  if (rateBuckets.size > 2000) {
    for (const [k, list] of rateBuckets.entries()) {
      if (list.every((ts) => now - ts >= windowMs)) rateBuckets.delete(k);
    }
  }
  next();
});

// Periodic cleanup is covered above; verify Firebase ID token using Firebase Auth REST API (zero IAM needed)
async function verifyFirebaseBearerToken(
  req: express.Request
): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ') || !FIREBASE_API_KEY) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const user = json?.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: String(user.localId),
      email: String(user.email || '').toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

// Lazy initializer for Gemini client
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Retry helper for transient 429/503 errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err || '');
      const status = err?.status || err?.code;
      const isTransient =
        status === 429 ||
        status === 503 ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 800 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

function validateDecodedImageBuffer(base64Data: string, mimeType: string) {
  const buf = Buffer.from(base64Data, 'base64');
  const maxBytes = 10 * 1024 * 1024; // 10MB decoded safety cap
  if (buf.length < 16) {
    throw new ImageValidationError('Uploaded image appears empty or corrupted.');
  }
  if (buf.length > maxBytes) {
    throw new ImageValidationError('Image exceeds the 10 MB maximum file size.');
  }
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const isHeic = buf.subarray(4, 8).toString('ascii') === 'ftyp';

  if (!isJpeg && !isPng && !isWebp && !isHeic) {
    throw new ImageValidationError(`Invalid raster image signature for ${mimeType}. Only JPEG, PNG, WEBP, and HEIC are accepted.`);
  }
}

function parseImageDataUrl(rawImage: string, fallbackMime = 'image/jpeg'): { mimeType: string; data: string } {
  const dataUrlMatch = rawImage.match(/^data:([^;,]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1].toLowerCase();
    const data = dataUrlMatch[2];
    validateDecodedImageBuffer(data, mimeType);
    return { mimeType, data };
  }
  if (rawImage.startsWith('data:')) {
    throw new ImageValidationError('Image must be base64-encoded raster format (JPEG, PNG, or WEBP).');
  }
  validateDecodedImageBuffer(rawImage, fallbackMime);
  return {
    mimeType: fallbackMime,
    data: rawImage,
  };
}

function formatGeminiError(err: any): { status: number; message: string } {
  if (err instanceof ImageValidationError || err?.name === 'ImageValidationError') {
    return {
      status: 400,
      message: String(err.message || 'Invalid uploaded image file.'),
    };
  }
  const rawMessage = String(err?.message || 'Unknown error occurred.');
  serverTelemetry.totalErrors += 1;
  serverTelemetry.recentErrors.unshift({
    time: new Date().toISOString(),
    path: 'gemini',
    message: rawMessage.slice(0, 180),
  });
  serverTelemetry.recentErrors = serverTelemetry.recentErrors.slice(0, 15);

  // Note: Avoid returning 403/502/503/504 because the reverse proxy intercepts those status codes with HTML error pages.
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 500,
      message: 'Gemini API key is invalid or missing permissions. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('GEMINI_API_KEY environment variable is not configured')) {
    return {
      status: 500,
      message: 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      message: 'AI rate limit reached temporarily. Please wait a few seconds and try again.',
    };
  }
  if (rawMessage.includes('UNAVAILABLE') || rawMessage.includes('503')) {
    return {
      status: 500,
      message: 'AI service is temporarily experiencing high demand. Please try again in a few seconds.',
    };
  }
  return {
    status: 500,
    message: rawMessage,
  };
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) });
});

// Room Analysis API Route
app.post('/api/analyze-room', async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      roomType = 'general',
      focusGoal = 'quick_wins',
      language = 'en',
      customContext = '',
      dailyMinutes = 20,
    } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Image base64 data is required.' });
    }

    const parsed = parseImageDataUrl(imageBase64, mimeType);
    const supportedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
    const normalizedMime = parsed.mimeType === 'image/jpg' ? 'image/jpeg' : parsed.mimeType;

    if (!supportedMimes.has(normalizedMime)) {
      return res.status(400).json({
        error: `Unsupported image format (${parsed.mimeType}). Please upload a JPEG, PNG, or WEBP photo.`,
      });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';
    const userNote = typeof customContext === 'string' ? customContext.trim().slice(0, 300) : '';
    const safeMinutes = Math.max(5, Math.min(120, Math.round(Number(dailyMinutes) || 20)));

    const systemInstruction = `You are a world-class Professional Home Organizer, Interior Stylist, and Spatial Declutter Specialist.
Your job is to analyze room photos with extreme visual precision and provide practical, encouraging, step-by-step organization, object detection, color/decor suggestions, and smart space utilization instructions.
Be specific about items you observe (e.g. papers, clothing, cables, mugs, storage bins, shelves) and provide accurate 0-1000 normalized bounding box coordinates [ymin, xmin, ymax, xmax] for key detected items in the photo.
Keep strings concise and actionable (under 180 words per section).
${
  isBengali
    ? 'LANGUAGE REQUIREMENT: Write ALL descriptive text values (roomName, overallAssessment, furnitureAnalysis, detectedItems, detectedObjects label/category/estimatedValue, triageItems item/reason, quickWins, problemAreas title/description/recommendation, actionPlan title/timeEstimate/instructions/tips, storageRecommendations category/itemTitle/purpose/suggestedLocation/estimatedBudget, spaceUtilization zone/suggestion/spaceGainEstimate, colorDecor wallColors name/reason, curtainSuggestion, furniturePalette name, decorTips, recyclingTips, layoutAdvice, maintenanceHabits, minimalistTip) in natural, clear Bengali (বাংলা script). Keep enum values for cleaningDifficulty ("Easy", "Moderate", "Intensive"), category ("Purge", "Sort", "Organize", "Store"), priority ("high", "medium", "low"), severity ("low", "medium", "high"), clutterImpact ("high", "medium", "low"), difficulty ("Easy", "Moderate"), and triage/recommendedAction ("keep", "donate", "trash", "relocate", "recycle") strictly in English as required by the schema.'
    : 'LANGUAGE REQUIREMENT: Write all text values in clear, natural English.'
}`;

    const prompt = `Analyze this room photo for a ${String(roomType).replace(/_/g, ' ')} with the primary focus goal: "${String(focusGoal).replace(/_/g, ' ')}".
The user has about ${safeMinutes} minutes per session for their personalized cleaning plan.
${userNote ? `USER CONSTRAINT / SPECIAL FOCUS: "${userNote}" — Incorporate this constraint carefully across action steps, storage choices, and layout advice.` : ''}

Extract:
1. Room type detected, Clutter score (0 = perfectly immaculate, 100 = total chaos), cleaningDifficulty ('Easy', 'Moderate', or 'Intensive'), estimatedCleaningMinutes (realistic total minutes integer), and furnitureAnalysis (concise evaluation of current furniture placement, sizing, and walkway clearance).
2. Overall assessment summarizing what is happening in the room.
3. List of detected key items causing clutter or organization challenges (up to 12 items).
4. detectedObjects: 4 to 8 clearly visible objects in the photo with tight bounding boxes box2d: [ymin, xmin, ymax, xmax] (integers 0-1000), label, category, clutterImpact ('high', 'medium', 'low'), recommendedAction ('keep', 'donate', 'recycle', 'relocate'), and estimatedValue (e.g. "$15", "Recycle", or "Keep").
5. 6-10 Item Triage suggestions categorizing visible objects into 'keep', 'donate', 'trash', or 'relocate' with a brief practical reason.
6. 3-5 immediate "Quick Wins" (tasks that take under 10 minutes).
7. Specific problem areas (3-6 items) with severity ('low', 'medium', 'high') and targeted fixes.
8. A personalized structured Action Plan (5-8 steps) tailored to ~${safeMinutes} mins/day with categories ('Purge', 'Sort', 'Organize', 'Store'), priority ('high', 'medium', 'low'), and estimated times.
9. Budget-friendly storage recommendations (3-6 items: containers, wall mounts, cord clips, drawer dividers, etc.).
10. spaceUtilization: 3-4 smart space utilization suggestions (vertical walls, corners, under-furniture, doorway/desk zones) with spaceGainEstimate and difficulty ('Easy' or 'Moderate').
11. colorDecor: AI Color & Decoration Suggestions tailored to this room's light and architecture — 3 wallColors (with name, hex code like #E8EFEA, reason), 1 curtainSuggestion, 3 furniturePalette swatches (name, hex), and 3 decorTips.
12. recyclingTips: 2-4 practical donation & eco-recycling suggestions for clutter items seen in the photo.
13. Layout & spatial arrangement advice to maximize light, flow, and functional zoning.
14. 3-5 Daily/Weekly Maintenance Habits to keep this space organized long-term.
15. A motivational Minimalist/Decluttering rule or quote for this space.`;

    const imagePart = {
      inlineData: {
        mimeType: normalizedMime,
        data: parsed.data,
      },
    };

    const textPart = { text: prompt };

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              roomName: { type: Type.STRING, description: 'Descriptive title for the room photo' },
              clutterScore: { type: Type.INTEGER, description: 'Score between 0 and 100' },
              cleaningDifficulty: { type: Type.STRING, description: 'Easy, Moderate, or Intensive' },
              estimatedCleaningMinutes: { type: Type.INTEGER, description: 'Total estimated minutes to organize and clean' },
              furnitureAnalysis: { type: Type.STRING, description: 'Concise analysis of existing furniture placement and walkway balance' },
              overallAssessment: { type: Type.STRING, description: 'Comprehensive assessment of the space' },
              detectedItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of visible items contributing to clutter',
              },
              detectedObjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    category: { type: Type.STRING },
                    box2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] scaled 0-1000',
                    },
                    clutterImpact: { type: Type.STRING, description: 'high, medium, or low' },
                    recommendedAction: { type: Type.STRING, description: 'keep, donate, recycle, or relocate' },
                    estimatedValue: { type: Type.STRING },
                  },
                  required: ['label', 'category', 'box2d', 'clutterImpact', 'recommendedAction'],
                },
              },
              triageItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    item: { type: Type.STRING },
                    decision: { type: Type.STRING, description: 'keep, donate, trash, or relocate' },
                    reason: { type: Type.STRING },
                  },
                  required: ['item', 'decision', 'reason'],
                },
                description: 'Suggested keep/donate/trash/relocate triage for visible items',
              },
              quickWins: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3-5 fast 5-10 minute wins',
              },
              problemAreas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING, description: 'low, medium, or high' },
                    recommendation: { type: Type.STRING },
                  },
                  required: ['title', 'description', 'severity', 'recommendation'],
                },
              },
              actionPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING, description: 'Purge, Sort, Organize, or Store' },
                    priority: { type: Type.STRING, description: 'high, medium, or low' },
                    timeEstimate: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    tips: { type: Type.STRING },
                  },
                  required: ['stepNumber', 'title', 'category', 'priority', 'timeEstimate', 'instructions'],
                },
              },
              storageRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    itemTitle: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                    suggestedLocation: { type: Type.STRING },
                    estimatedBudget: { type: Type.STRING },
                  },
                  required: ['itemTitle', 'purpose', 'suggestedLocation'],
                },
              },
              spaceUtilization: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    zone: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    spaceGainEstimate: { type: Type.STRING },
                    difficulty: { type: Type.STRING, description: 'Easy or Moderate' },
                  },
                  required: ['zone', 'suggestion', 'spaceGainEstimate', 'difficulty'],
                },
              },
              colorDecor: {
                type: Type.OBJECT,
                properties: {
                  wallColors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        hex: { type: Type.STRING },
                        reason: { type: Type.STRING },
                      },
                      required: ['name', 'hex'],
                    },
                  },
                  curtainSuggestion: { type: Type.STRING },
                  furniturePalette: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        hex: { type: Type.STRING },
                      },
                      required: ['name', 'hex'],
                    },
                  },
                  decorTips: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['wallColors', 'curtainSuggestion', 'furniturePalette', 'decorTips'],
              },
              recyclingTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              layoutAdvice: { type: Type.STRING, description: 'Advice on spatial arrangement and zoning' },
              maintenanceHabits: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3-5 daily or weekly habits to keep the room tidy',
              },
              minimalistTip: { type: Type.STRING, description: 'Inspirational organization tip or rule' },
            },
            required: [
              'roomName',
              'clutterScore',
              'overallAssessment',
              'detectedItems',
              'detectedObjects',
              'triageItems',
              'quickWins',
              'problemAreas',
              'actionPlan',
              'storageRecommendations',
              'spaceUtilization',
              'colorDecor',
              'recyclingTips',
              'layoutAdvice',
              'maintenanceHabits',
              'minimalistTip',
            ],
          },
        },
      })
    );

    const jsonText = (response.text || '{}').trim();
    const parsedData = JSON.parse(jsonText);

    // Normalize and bound fields reliably
    const clutterScore = Math.max(0, Math.min(100, Math.round(Number(parsedData.clutterScore ?? 50))));
    const cleaningDifficulty = ['Easy', 'Moderate', 'Intensive'].includes(parsedData.cleaningDifficulty)
      ? parsedData.cleaningDifficulty
      : clutterScore < 35
      ? 'Easy'
      : clutterScore < 70
      ? 'Moderate'
      : 'Intensive';
    const estimatedCleaningMinutes = Math.max(
      10,
      Math.min(360, Math.round(Number(parsedData.estimatedCleaningMinutes) || Math.max(15, Math.round(clutterScore * 0.9))))
    );
    const furnitureAnalysis = String(parsedData.furnitureAnalysis || '').slice(0, 1500);
    const actionPlan = Array.isArray(parsedData.actionPlan)
      ? parsedData.actionPlan.slice(0, 25).map((step: any, idx: number) => ({
          stepNumber: Number(step.stepNumber) || idx + 1,
          title: String(step.title || `Step ${idx + 1}`),
          category: ['Purge', 'Sort', 'Organize', 'Store'].includes(step.category) ? step.category : 'Organize',
          priority: ['high', 'medium', 'low'].includes(step.priority) ? step.priority : idx < 2 ? 'high' : 'medium',
          timeEstimate: String(step.timeEstimate || '10 mins'),
          instructions: String(step.instructions || ''),
          tips: step.tips ? String(step.tips) : '',
          completed: false,
        }))
      : [];

    const problemAreas = Array.isArray(parsedData.problemAreas)
      ? parsedData.problemAreas.slice(0, 15).map((area: any, idx: number) => ({
          id: String(area.id || `area_${idx + 1}`),
          title: String(area.title || 'Clutter Hotspot'),
          description: String(area.description || ''),
          severity: ['low', 'medium', 'high'].includes(area.severity) ? area.severity : 'medium',
          recommendation: String(area.recommendation || ''),
        }))
      : [];

    const storageRecommendations = Array.isArray(parsedData.storageRecommendations)
      ? parsedData.storageRecommendations.slice(0, 15).map((item: any) => ({
          category: String(item.category || 'Storage'),
          itemTitle: String(item.itemTitle || 'Storage Organizer'),
          purpose: String(item.purpose || ''),
          suggestedLocation: String(item.suggestedLocation || ''),
          estimatedBudget: String(item.estimatedBudget || '$10-$20'),
          acquired: false,
        }))
      : [];

    const triageItems = Array.isArray(parsedData.triageItems)
      ? parsedData.triageItems.slice(0, 30).map((t: any, idx: number) => ({
          id: String(t.id || `triage_${idx + 1}`),
          item: String(t.item || `Item ${idx + 1}`),
          decision: ['keep', 'donate', 'trash', 'relocate'].includes(t.decision) ? t.decision : 'relocate',
          reason: String(t.reason || ''),
          sorted: false,
        }))
      : [];

    const detectedObjects = Array.isArray(parsedData.detectedObjects)
      ? parsedData.detectedObjects.slice(0, 12).map((obj: any, idx: number) => {
          const rawBox = Array.isArray(obj.box2d) && obj.box2d.length === 4 ? obj.box2d : [150, 150, 450, 450];
          const ymin = Math.max(0, Math.min(980, Math.round(Number(rawBox[0]) || 100)));
          const xmin = Math.max(0, Math.min(980, Math.round(Number(rawBox[1]) || 100)));
          const ymax = Math.max(ymin + 20, Math.min(1000, Math.round(Number(rawBox[2]) || ymin + 200)));
          const xmax = Math.max(xmin + 20, Math.min(1000, Math.round(Number(rawBox[3]) || xmin + 200)));
          return {
            id: String(obj.id || `obj_${idx + 1}`).slice(0, 60),
            label: String(obj.label || `Object ${idx + 1}`).slice(0, 80),
            category: String(obj.category || 'Item').slice(0, 50),
            box2d: [ymin, xmin, ymax, xmax] as [number, number, number, number],
            clutterImpact: (['high', 'medium', 'low'].includes(obj.clutterImpact) ? obj.clutterImpact : 'medium') as
              | 'high'
              | 'medium'
              | 'low',
            recommendedAction: (['keep', 'donate', 'recycle', 'relocate'].includes(obj.recommendedAction)
              ? obj.recommendedAction
              : 'relocate') as 'keep' | 'donate' | 'recycle' | 'relocate',
            estimatedValue: obj.estimatedValue ? String(obj.estimatedValue).slice(0, 40) : '',
          };
        })
      : [];

    const spaceUtilization = Array.isArray(parsedData.spaceUtilization)
      ? parsedData.spaceUtilization.slice(0, 8).map((tip: any) => ({
          zone: String(tip.zone || 'Corner / Vertical Zone').slice(0, 80),
          suggestion: String(tip.suggestion || '').slice(0, 320),
          spaceGainEstimate: String(tip.spaceGainEstimate || '+15% usable area').slice(0, 60),
          difficulty: (tip.difficulty === 'Moderate' ? 'Moderate' : 'Easy') as 'Easy' | 'Moderate',
        }))
      : [];

    const safeHex = (val: any, fallback: string) => {
      const s = String(val || '').trim();
      return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : fallback;
    };

    const rawColor = parsedData.colorDecor || {};
    const colorDecor = {
      wallColors: Array.isArray(rawColor.wallColors)
        ? rawColor.wallColors.slice(0, 4).map((c: any) => ({
            name: String(c.name || 'Soft Sage').slice(0, 50),
            hex: safeHex(c.hex, '#DDF3E5'),
            reason: c.reason ? String(c.reason).slice(0, 180) : '',
          }))
        : [
            { name: 'Warm Alabaster', hex: '#F7F9F6', reason: 'Brightens natural light' },
            { name: 'Soft Botanical Sage', hex: '#DDF3E5', reason: 'Calming accent wall' },
          ],
      curtainSuggestion: String(
        rawColor.curtainSuggestion || 'Lightweight linen curtains in warm oatmeal or off-white hung high to frame daylight.'
      ).slice(0, 350),
      furniturePalette: Array.isArray(rawColor.furniturePalette)
        ? rawColor.furniturePalette.slice(0, 4).map((c: any) => ({
            name: String(c.name || 'Natural Oak').slice(0, 50),
            hex: safeHex(c.hex, '#C9A97E'),
          }))
        : [
            { name: 'Forest Pine', hex: '#163D32' },
            { name: 'Warm Honey Brass', hex: '#E9B95B' },
          ],
      decorTips: Array.isArray(rawColor.decorTips) ? rawColor.decorTips.slice(0, 5).map(String) : [],
    };

    const recyclingTips = Array.isArray(parsedData.recyclingTips)
      ? parsedData.recyclingTips.slice(0, 6).map(String)
      : [];

    const maintenanceHabits = Array.isArray(parsedData.maintenanceHabits)
      ? parsedData.maintenanceHabits.slice(0, 10).map(String)
      : [];

    res.json({
      success: true,
      analysis: {
        id: 'room_' + Date.now(),
        timestamp: Date.now(),
        roomType,
        focusGoal,
        imageUrl: imageBase64,
        roomName: String(parsedData.roomName || 'Analyzed Room'),
        clutterScore,
        cleaningDifficulty,
        estimatedCleaningMinutes,
        ...(furnitureAnalysis ? { furnitureAnalysis } : {}),
        overallAssessment: String(parsedData.overallAssessment || ''),
        detectedItems: Array.isArray(parsedData.detectedItems)
          ? parsedData.detectedItems.slice(0, 30).map(String)
          : [],
        detectedObjects,
        triageItems,
        quickWins: Array.isArray(parsedData.quickWins)
          ? parsedData.quickWins.slice(0, 15).map(String)
          : [],
        problemAreas,
        actionPlan,
        storageRecommendations,
        spaceUtilization,
        colorDecor,
        recyclingTips,
        layoutAdvice: String(parsedData.layoutAdvice || ''),
        maintenanceHabits,
        minimalistTip: String(parsedData.minimalistTip || 'Start with one small surface and build momentum.'),
      },
    });
  } catch (err: any) {
    console.error('Error analyzing room:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to analyze room photo.',
      details: formatted.message,
    });
  }
});

// AI Room Redesign Image Generation Route (gemini-3.1-flash-lite-image)
app.post('/api/redesign-room', async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      roomType = 'general',
      style = 'minimalist',
      budgetTier = 'moderate',
      furniturePreference = 'keep_existing',
      wallColorPreference = '',
      customInstructions = '',
      language = 'en',
    } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Room photo is required to generate a redesign.' });
    }

    const parsed = parseImageDataUrl(imageBase64, mimeType);
    const normalizedMime = parsed.mimeType === 'image/jpg' ? 'image/jpeg' : parsed.mimeType;

    const styleDescriptions: Record<string, string> = {
      minimalist: 'clean minimalist aesthetic with clutter-free surfaces, concealed woven baskets, crisp neutral linens, and calm breathing room',
      scandinavian: 'Scandinavian style with light natural oak furniture, soft matte off-white walls, warm textiles, and tidy modular storage',
      modern: 'clean modern architectural aesthetic with streamlined cabinetry, hidden cord routing, sleek matte fixtures, and balanced contrast',
      luxury: 'elevated quiet-luxury aesthetic with warm brushed brass accents, tailored drapery, refined built-in shelving, and plush natural textures',
      bohemian: 'refined organized bohemian aesthetic with woven rattan baskets, layered earth-toned textiles, warm wood, and indoor greenery',
      japandi: 'Japandi zen aesthetic combining natural bamboo/wood craftsmanship, serene uncluttered surfaces, and warm organic minimalism',
      industrial: 'refined industrial loft organization with matte black metal open shelving, warm walnut timber, labeled storage crates, and clean surfaces',
      contemporary: 'fresh contemporary styling with soft tonal layering, botanical sage accents, modular organizers, and inviting natural daylight',
      cozy_modern: 'cozy modern aesthetic with balanced warm ambient lighting, muted sage green accents, organized shelving, and soft textures',
      warm_earth: 'warm botanical aesthetic with lush indoor potted plants, woven seagrass storage bins, terracotta/sage accents, and neatly arranged items',
      budget_refresh: 'smart budget-friendly organization refresh keeping the main furniture layout intact while neatly decluttering, boxing cables, and straightening everything',
    };

    const budgetGuidance: Record<string, string> = {
      budget_friendly: 'Keep existing furniture silhouettes and use affordable bins, baskets, and zero-clutter styling.',
      moderate: 'Incorporate modular shelving, cohesive storage bins, updated textiles/curtains, and warm lighting.',
      investment: 'Feature bespoke built-in cabinetry, elevated solid wood/stone finishes, and designer lighting accents.',
    };

    const furnitureGuidance: Record<string, string> = {
      keep_existing: 'Retain the existing primary furniture pieces in place and organize around them.',
      modular_storage: 'Upgrade storage zones with sleek modular cube shelving, under-bed drawers, and vertical organizers.',
      solid_wood: 'Refresh worn furniture surfaces toward cohesive warm natural oak or walnut timber tones.',
      minimal_seating: 'Streamline excess bulky items to open wide floor pathways and calm negative space.',
    };

    const styleDesc = styleDescriptions[String(style)] || styleDescriptions.minimalist;
    const budgetDesc = budgetGuidance[String(budgetTier)] || budgetGuidance.moderate;
    const furnDesc = furnitureGuidance[String(furniturePreference)] || furnitureGuidance.keep_existing;
    const isBengali = language === 'bn';
    const ai = getGenAIClient();

    const promptText = `Transform this ${String(roomType).replace(/_/g, ' ')} photo into a realistic, beautifully organized and decluttered redesign in a ${styleDesc}.
CRITICAL ARCHITECTURE RULES:
- Preserve the room's exact perspective, windows, doors, ceiling height, and core layout.
- Remove visual clutter, loose cables, piles of paper/clothes, and stray objects, replacing messy zones with tidy storage baskets, clear surfaces, and well-styled decor.
- Budget Tier: ${budgetDesc}
- Furniture Approach: ${furnDesc}
${wallColorPreference ? `- Apply subtle wall/accent color harmony inspired by: ${String(wallColorPreference).slice(0, 120)}.` : ''}
${customInstructions ? `- User preference: ${String(customInstructions).slice(0, 220)}.` : ''}
- Photorealistic interior design photography, natural daylight, crisp details.
Also briefly summarize the key design improvements in 2 concise sentences (${isBengali ? 'in natural Bengali (বাংলা)' : 'in English'}).`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: parsed.data,
              },
            },
            { text: promptText },
          ],
        },
      })
    );

    const parts = response.candidates?.[0]?.content?.parts || [];
    let generatedImageUrl = '';
    const textChunks: string[] = [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        const outMime = part.inlineData.mimeType || 'image/png';
        generatedImageUrl = `data:${outMime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textChunks.push(part.text);
      }
    }

    if (!generatedImageUrl) {
      return res.status(500).json({
        error: 'The AI image generator did not return a redesigned image.',
        details: textChunks.join(' ') || 'Please try again with a clearer room photo.',
      });
    }

    const summary =
      textChunks.join(' ').trim().slice(0, 500) ||
      (isBengali
        ? 'আপনার ঘরের মূল কাঠামো ঠিক রেখে অগোছালো অংশ পরিষ্কার ও স্টোরেজ-সমন্বিত নতুন ডিজাইন তৈরি করা হয়েছে।'
        : 'Created an organized, clutter-free redesign preserving your room layout while harmonizing storage and surfaces.');

    res.json({
      success: true,
      imageUrl: generatedImageUrl,
      summary,
      style,
    });
  } catch (err: any) {
    console.error('Redesign room error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate AI room redesign.',
      details: formatted.message,
    });
  }
});

// Before vs After Re-Score API Route
app.post('/api/compare-after', async (req, res) => {
  try {
    const {
      afterImageBase64,
      mimeType = 'image/jpeg',
      roomType = 'general',
      beforeScore = 50,
      beforeRoomName = 'Room',
      language = 'en',
    } = req.body;

    if (!afterImageBase64 || typeof afterImageBase64 !== 'string') {
      return res.status(400).json({ error: 'After-declutter photo is required.' });
    }

    const parsed = parseImageDataUrl(afterImageBase64, mimeType);
    const supportedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
    const normalizedMime = parsed.mimeType === 'image/jpg' ? 'image/jpeg' : parsed.mimeType;

    if (!supportedMimes.has(normalizedMime)) {
      return res.status(400).json({
        error: `Unsupported image format (${parsed.mimeType}). Please upload a JPEG, PNG, or WEBP photo.`,
      });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: parsed.data,
              },
            },
            {
              text: `Evaluate this updated "After Decluttering" photo for "${String(beforeRoomName)}" (${String(roomType).replace(/_/g, ' ')}). The previous clutter score was ${Number(beforeScore)}/100 (0 = immaculate, 100 = total chaos).
Provide:
1. afterClutterScore (integer 0-100) reflecting the current state shown in this photo.
2. afterSummary (concise 2-3 sentence encouraging review highlighting visible improvements and any remaining touch-ups).
${isBengali ? 'Write afterSummary in natural, encouraging Bengali (বাংলা).' : 'Write afterSummary in clear, encouraging English.'}`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              afterClutterScore: { type: Type.INTEGER },
              afterSummary: { type: Type.STRING },
            },
            required: ['afterClutterScore', 'afterSummary'],
          },
        },
      })
    );

    const parsedData = JSON.parse((response.text || '{}').trim());
    const afterClutterScore = Math.max(0, Math.min(100, Math.round(Number(parsedData.afterClutterScore ?? 20))));
    const afterSummary = String(parsedData.afterSummary || 'Great progress on organizing your space!').slice(0, 1000);

    res.json({
      success: true,
      afterClutterScore,
      afterSummary,
    });
  } catch (err: any) {
    console.error('Compare after error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to evaluate after-declutter photo.',
      details: formatted.message,
    });
  }
});

// Multi-turn Chat API Route
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], persona = 'minimalist', roomContext, userStats, language = 'en' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Chat messages are required.' });
    }

    const ai = getGenAIClient();

    let personaInstruction = '';
    switch (persona) {
      case 'speed_cleaner':
        personaInstruction = `You are "Flash Declutterer" — energetic, fast-paced, direct, focused on 15-minute blitz timers, quick sorting rules, and rapid momentum.`;
        break;
      case 'budget_diy':
        personaInstruction = `You are "Handy DIY Organizer" — resourceful, focused on repurposed shoe boxes, tension rods, cardboard dividers, dollar-store hacks, and zero-waste solutions.`;
        break;
      case 'feng_shui':
        personaInstruction = `You are "Harmonious Space Master" — focusing on energy flow (Chi), light, entryway clearing, balanced placement, natural elements, and intentional living.`;
        break;
      default:
        personaInstruction = `You are "KonMari & Minimalist Coach" — calm, thoughtful, encouraging users to evaluate what brings value, curate intentionally, and create tranquil spaces.`;
        break;
    }

    let fullSystemInstruction = `${personaInstruction}
You are answering as an AI Room Declutter & Voice Coach. ${
      language === 'bn'
        ? 'If the user writes in English or Bengali, prefer replying warmly in Bengali (বাংলা) unless they explicitly ask in English.'
        : 'Reply in the same language the user writes in (e.g. English or Bengali/Banglish if the user asks in Bengali/Banglish).'
    } Keep answers motivational, personalized, warm, and scannable with short bullet points. Always end with 2-3 quick suggested follow-up prompts formatted at the very end of your response inside a JSON block like:
<<<QUICK_REPLIES: ["Give me a motivational tip", "What 5-min win should I do next?", "How do I maintain this clean look?"]>>>`;

    if (roomContext) {
      fullSystemInstruction += `\nCURRENT ROOM CONTEXT: User is asking about "${roomContext.roomName || 'their room'}" (${roomContext.roomType || 'room'}) with clutter score ${roomContext.clutterScore}/100.
Key issues identified: ${roomContext.problemAreas?.map((p: any) => p.title).join(', ') || 'general clutter'}.`;
    }

    if (userStats) {
      fullSystemInstruction += `\nUSER HABITS & STATS: Completed ${Number(userStats.completedSteps || 0)} tasks across ${Number(userStats.savedRoomsCount || 0)} saved rooms, ${Number(userStats.focusMinutesTotal || 0)} focus minutes logged. Tailor advice and motivational tips to celebrate their momentum.`;
    }

    // Build chat contents from history, ensuring valid alternating/non-empty contents
    const contentsHistory = messages
      .filter((m: any) => m && typeof m.text === 'string' && m.text.trim().length > 0)
      .map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    if (contentsHistory.length === 0) {
      return res.status(400).json({ error: 'At least one non-empty message is required.' });
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contentsHistory,
        config: {
          systemInstruction: fullSystemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const rawReply = response.text || '';

    // Extract quick replies if present
    let text = rawReply;
    let quickReplies: string[] = [
      'Give me a 10-minute speed plan',
      'What budget storage items do I need?',
      'How do I handle sentimental items?',
    ];

    const quickReplyMatch = rawReply.match(/<<<QUICK_REPLIES:\s*(\[.*?\])>>>/s);
    if (quickReplyMatch) {
      try {
        const parsedReplies = JSON.parse(quickReplyMatch[1]);
        if (Array.isArray(parsedReplies) && parsedReplies.length > 0) {
          quickReplies = parsedReplies.slice(0, 3).map(String);
        }
        text = rawReply.replace(/<<<QUICK_REPLIES:\s*\[.*?\]>>>/s, '').trim();
      } catch {
        // Keep default quick replies
      }
    }

    res.json({
      success: true,
      message: {
        id: 'msg_' + Date.now(),
        sender: 'assistant',
        text,
        timestamp: Date.now(),
        quickReplies,
      },
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to process chat message.',
      details: formatted.message,
    });
  }
});

// Generate Marketplace Resale / Donation Listing & Storage Box Labels
app.post('/api/donation-listing', async (req, res) => {
  try {
    const { items = [], roomType = 'general', language = 'en' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one item to generate a listing.' });
    }

    const cleanItems = items.slice(0, 20).map((item) => String(item).trim()).filter(Boolean);
    if (cleanItems.length === 0) {
      return res.status(400).json({ error: 'Please provide valid item names.' });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Create a ready-to-post resale/donation bundle listing and printable moving/storage box labels for these items from a ${String(roomType).replace(/_/g, ' ')}:
Items: ${cleanItems.join(', ')}

Provide:
1. title: Clear, appealing marketplace/donation title.
2. suggestedPrice: Realistic bundle price range or "Free / Donation" note.
3. condition: Practical condition summary (e.g., "Gently Used - Clean & Ready").
4. description: Friendly, concise 3-4 sentence listing description buyers or charities appreciate.
5. packingTips: 3-4 practical packing or transport tips for these items.
6. boxLabels: 3-5 crisp, scannable box label strings (e.g., "BOX 01 · DONATE · Desk Cables & Small Electronics").
${isBengali ? 'Write ALL output fields in natural, clear Bengali (বাংলা).' : 'Write all output fields in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              suggestedPrice: { type: Type.STRING },
              condition: { type: Type.STRING },
              description: { type: Type.STRING },
              packingTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              boxLabels: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['title', 'suggestedPrice', 'condition', 'description', 'packingTips', 'boxLabels'],
          },
        },
      })
    );

    const parsedData = JSON.parse((response.text || '{}').trim());

    res.json({
      success: true,
      listing: {
        title: String(parsedData.title || 'Decluttered Item Bundle').slice(0, 200),
        suggestedPrice: String(parsedData.suggestedPrice || '$15 - $35 / Donation').slice(0, 80),
        condition: String(parsedData.condition || 'Gently Used').slice(0, 100),
        description: String(parsedData.description || '').slice(0, 1500),
        packingTips: Array.isArray(parsedData.packingTips)
          ? parsedData.packingTips.slice(0, 6).map(String)
          : [],
        boxLabels: Array.isArray(parsedData.boxLabels)
          ? parsedData.boxLabels.slice(0, 8).map(String)
          : [],
      },
    });
  } catch (err: any) {
    console.error('Donation listing error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate donation listing.',
      details: formatted.message,
    });
  }
});

// Generate 7-Day Room Reset & Maintenance Schedule
app.post('/api/deep-clean-schedule', async (req, res) => {
  try {
    const {
      roomName = 'My Room',
      roomType = 'general',
      clutterScore = 50,
      dailyMinutes = 15,
      problemAreas = [],
      language = 'en',
    } = req.body;

    const safeMinutes = Math.max(5, Math.min(120, Math.round(Number(dailyMinutes) || 15)));
    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Design a realistic 7-day room decluttering & reset schedule for "${String(roomName)}" (${String(roomType).replace(/_/g, ' ')}, clutter score ${Number(clutterScore)}/100).
The user can spend about ${safeMinutes} minutes per day.
Key problem zones: ${Array.isArray(problemAreas) && problemAreas.length > 0 ? problemAreas.slice(0, 6).map(String).join(', ') : 'general surfaces and storage'}.

Return exactly 7 days (Day 1 through Day 7) with:
- day: e.g. "Day 1" (or "দিন ১" if Bengali)
- focus: Short theme for the day
- tasks: 2-3 specific micro-tasks achievable within ${safeMinutes} minutes
- durationMinutes: integer around ${safeMinutes}
${isBengali ? 'Write day, focus, and tasks in natural, encouraging Bengali (বাংলা).' : 'Write day, focus, and tasks in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.STRING },
                    focus: { type: Type.STRING },
                    tasks: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    durationMinutes: { type: Type.INTEGER },
                  },
                  required: ['day', 'focus', 'tasks', 'durationMinutes'],
                },
              },
            },
            required: ['schedule'],
          },
        },
      })
    );

    const parsedData = JSON.parse((response.text || '{}').trim());
    const schedule = Array.isArray(parsedData.schedule)
      ? parsedData.schedule.slice(0, 7).map((entry: any, idx: number) => ({
          day: String(entry.day || `Day ${idx + 1}`).slice(0, 40),
          focus: String(entry.focus || 'Zone Reset').slice(0, 120),
          tasks: Array.isArray(entry.tasks) ? entry.tasks.slice(0, 5).map((t: any) => String(t).slice(0, 220)) : [],
          durationMinutes: Math.max(5, Math.min(180, Math.round(Number(entry.durationMinutes) || safeMinutes))),
          completed: false,
        }))
      : [];

    res.json({
      success: true,
      schedule,
    });
  } catch (err: any) {
    console.error('Schedule generator error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate 7-day schedule.',
      details: formatted.message,
    });
  }
});

// Targeted 5-Minute Micro-Zone Spot Rescue
app.post('/api/spot-rescue', async (req, res) => {
  try {
    const { spotTitle = '', spotDescription = '', roomType = 'general', language = 'en' } = req.body;

    if (!spotTitle || typeof spotTitle !== 'string') {
      return res.status(400).json({ error: 'Spot title is required.' });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Give a hyper-focused 5-minute Micro-Rescue plan for this exact clutter hotspot in a ${String(roomType).replace(/_/g, ' ')}:
Hotspot: "${spotTitle.slice(0, 150)}"
Details: "${String(spotDescription || '').slice(0, 300)}"

Return:
- steps: 3 ultra-specific 90-second steps to clear this exact spot right now.
- householdDiyHack: 1 clever zero-cost hack using everyday household items (shoebox, mug, binder clip, jar, etc.).
${isBengali ? 'Write all strings in natural, clear Bengali (বাংলা).' : 'Write all strings in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              householdDiyHack: { type: Type.STRING },
            },
            required: ['steps', 'householdDiyHack'],
          },
        },
      })
    );

    const parsedData = JSON.parse((response.text || '{}').trim());
    res.json({
      success: true,
      steps: Array.isArray(parsedData.steps) ? parsedData.steps.slice(0, 4).map(String) : [],
      householdDiyHack: String(parsedData.householdDiyHack || ''),
    });
  } catch (err: any) {
    console.error('Spot rescue error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate spot rescue plan.',
      details: formatted.message,
    });
  }
});

// AI 2D Room Zone Floorplan Generator
app.post('/api/generate-floorplan', async (req, res) => {
  try {
    const {
      roomName = 'My Room',
      roomType = 'general',
      layoutAdvice = '',
      detectedItems = [],
      language = 'en',
    } = req.body;

    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Create an optimized 12x8 grid 2D spatial floorplan layout for "${String(roomName).slice(0, 120)}" (${String(roomType).replace(/_/g, ' ')}).
Layout guidance: "${String(layoutAdvice || '').slice(0, 500)}"
Observed items: ${Array.isArray(detectedItems) ? detectedItems.slice(0, 12).map(String).join(', ') : 'general furniture'}.

Grid Rules:
- Total canvas is width 12 columns (x: 0..11) by height 8 rows (y: 0..7).
- Generate 4 to 7 distinct non-overlapping (or cleanly arranged) functional zones covering key furniture, storage, clear walkway ('pathway'), and a 'dropzone' for donations/inbox.
- Keep x + w <= 12 and y + h <= 8, with w between 1 and 6, and h between 1 and 6.
- kind MUST be one of: "desk", "bed", "storage", "seating", "pathway", "dropzone".
- label: short 1-3 word zone label (${isBengali ? 'in natural Bengali script or concise bilingual label' : 'in English'}).`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              zones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    kind: { type: Type.STRING },
                    x: { type: Type.INTEGER },
                    y: { type: Type.INTEGER },
                    w: { type: Type.INTEGER },
                    h: { type: Type.INTEGER },
                  },
                  required: ['label', 'kind', 'x', 'y', 'w', 'h'],
                },
              },
            },
            required: ['zones'],
          },
        },
      })
    );

    const parsedData = JSON.parse((response.text || '{}').trim());
    const validKinds = new Set(['desk', 'bed', 'storage', 'seating', 'pathway', 'dropzone']);
    const zones = Array.isArray(parsedData.zones)
      ? parsedData.zones.slice(0, 10).map((z: any, idx: number) => {
          const w = Math.max(1, Math.min(6, Math.round(Number(z.w) || 2)));
          const h = Math.max(1, Math.min(6, Math.round(Number(z.h) || 2)));
          const x = Math.max(0, Math.min(12 - w, Math.round(Number(z.x) || 0)));
          const y = Math.max(0, Math.min(8 - h, Math.round(Number(z.y) || 0)));
          return {
            id: `ai_z_${Date.now()}_${idx}`,
            label: String(z.label || `Zone ${idx + 1}`).slice(0, 40),
            kind: validKinds.has(z.kind) ? z.kind : 'storage',
            x,
            y,
            w,
            h,
          };
        })
      : [];

    res.json({
      success: true,
      zones,
    });
  } catch (err: any) {
    console.error('Floorplan generation error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate AI floorplan.',
      details: formatted.message,
    });
  }
});

// Zero-Cost Household DIY Storage Substitutes
app.post('/api/diy-alternatives', async (req, res) => {
  try {
    const { items = [], roomType = 'general', language = 'en' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Storage items list is required.' });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';
    const cleanItems = items.slice(0, 8).map((i) => String(i).trim()).filter(Boolean);

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `For these recommended organizers in a ${String(roomType).replace(/_/g, ' ')}:
${cleanItems.map((it, idx) => `${idx + 1}. ${it}`).join('\n')}

Suggest a clever ZERO-COST or near-zero-cost household DIY substitute for each item using everyday household items (shoeboxes, glass jars, binder clips, cardboard dividers, empty tissue boxes, shower curtain rings, etc.).
${isBengali ? 'Write all output fields in clear, natural Bengali (বাংলা).' : 'Write all output fields in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              substitutes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    originalItem: { type: Type.STRING },
                    diySubstitute: { type: Type.STRING },
                    howToMake: { type: Type.STRING },
                    estimatedSavings: { type: Type.STRING },
                  },
                  required: ['originalItem', 'diySubstitute', 'howToMake', 'estimatedSavings'],
                },
              },
            },
            required: ['substitutes'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const substitutes = Array.isArray(parsed.substitutes)
      ? parsed.substitutes.slice(0, 8).map((s: any) => ({
          originalItem: String(s.originalItem || 'Organizer'),
          diySubstitute: String(s.diySubstitute || 'Repurposed Box'),
          howToMake: String(s.howToMake || ''),
          estimatedSavings: String(s.estimatedSavings || '$10-$20'),
        }))
      : [];

    res.json({ success: true, substitutes });
  } catch (err: any) {
    console.error('DIY alternatives error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate DIY alternatives.',
      details: formatted.message,
    });
  }
});

// Scenario-Based Seasonal / Moving / Guest Blitz Checklist Generator
app.post('/api/seasonal-checklist', async (req, res) => {
  try {
    const {
      scenario = 'guest_blitz',
      roomType = 'general',
      roomName = 'My Room',
      language = 'en',
    } = req.body;

    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate a focused 6-step room organization checklist for scenario "${String(scenario).replace(/_/g, ' ')}" tailored to "${String(roomName)}" (${String(roomType).replace(/_/g, ' ')}).
Return 6 practical, high-impact checklist steps with:
- title: clear step title
- category: one of "Purge", "Sort", "Organize", "Store"
- timeEstimate: e.g. "5 mins" or "10 mins"
- tip: short practical tip
${isBengali ? 'Write title, timeEstimate, and tip in natural Bengali (বাংলা). Keep category strictly "Purge", "Sort", "Organize", or "Store".' : 'Write all fields in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    timeEstimate: { type: Type.STRING },
                    tip: { type: Type.STRING },
                  },
                  required: ['title', 'category', 'timeEstimate', 'tip'],
                },
              },
            },
            required: ['steps'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const validCats = new Set(['Purge', 'Sort', 'Organize', 'Store']);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.slice(0, 8).map((st: any) => ({
          title: String(st.title || 'Organize zone'),
          category: validCats.has(st.category) ? st.category : 'Organize',
          timeEstimate: String(st.timeEstimate || '10 mins'),
          tip: String(st.tip || ''),
          completed: false,
        }))
      : [];

    res.json({ success: true, steps });
  } catch (err: any) {
    console.error('Seasonal checklist error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate scenario checklist.',
      details: formatted.message,
    });
  }
});

// AI Storage Inventory Optimizer
app.post('/api/storage-optimize', async (req, res) => {
  try {
    const { items = [], rooms = [], language = 'en' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Add at least one inventory item to get storage optimization advice.' });
    }

    const ai = getGenAIClient();
    const isBengali = language === 'bn';
    const compactItems = items.slice(0, 25).map((i: any) => ({
      itemName: String(i.itemName || '').slice(0, 80),
      location: String(i.location || '').slice(0, 80),
      roomName: String(i.roomName || '').slice(0, 60),
      category: String(i.category || 'Other').slice(0, 40),
      quantity: Number(i.quantity) || 1,
      usageFrequency: String(i.usageFrequency || 'frequent'),
    }));

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Analyze this home storage inventory and suggest smarter placement, consolidation, or decluttering actions.
Known rooms: ${Array.isArray(rooms) && rooms.length > 0 ? rooms.slice(0, 10).map(String).join(', ') : 'Bedroom, Living Room, Closet, Kitchen, Storage'}
Stored items:
${compactItems.map((it, idx) => `${idx + 1}. ${it.itemName} (qty ${it.quantity}, category: ${it.category}, usage: ${it.usageFrequency}) currently at "${it.location}" in "${it.roomName}"`).join('\n')}

Return:
- summary: concise 2-sentence home storage optimization insight
- suggestions: up to 5 actionable items with itemName, currentLocation, suggestedLocation, reason, and actionType ('relocate', 'group', 'donate', or 'declutter').
${isBengali ? 'Write summary, itemName, currentLocation, suggestedLocation, and reason in natural Bengali (বাংলা). Keep actionType strictly in English ("relocate", "group", "donate", or "declutter").' : 'Write all text in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    currentLocation: { type: Type.STRING },
                    suggestedLocation: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                  },
                  required: ['itemName', 'currentLocation', 'suggestedLocation', 'reason', 'actionType'],
                },
              },
            },
            required: ['summary', 'suggestions'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const validActions = new Set(['relocate', 'group', 'donate', 'declutter']);
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 6).map((s: any) => ({
          itemName: String(s.itemName || ''),
          currentLocation: String(s.currentLocation || ''),
          suggestedLocation: String(s.suggestedLocation || ''),
          reason: String(s.reason || ''),
          actionType: validActions.has(s.actionType) ? s.actionType : 'relocate',
        }))
      : [];

    res.json({
      success: true,
      summary: String(parsed.summary || ''),
      suggestions,
    });
  } catch (err: any) {
    console.error('Storage optimize error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to optimize storage inventory.',
      details: formatted.message,
    });
  }
});

// Phase 9: AI Shopping Assistant (Budget-aware organizer categories & dimensions, no fabricated retailer prices)
app.post('/api/shopping-assistant', async (req, res) => {
  try {
    const {
      roomType = 'general',
      budget = 100,
      currency = 'USD',
      roomWidth = 12,
      roomLength = 10,
      unit = 'ft',
      focusNeed = '',
      language = 'en',
    } = req.body;

    const safeBudget = Math.max(10, Math.min(50000, Number(budget) || 100));
    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Recommend 5 practical storage boxes, organizers, shelving, baskets, or space-saving furniture categories for a ${String(roomType).replace(/_/g, ' ')} (${Number(roomWidth)}x${Number(roomLength)} ${unit === 'm' ? 'meters' : 'feet'}) with an organization budget of ${safeBudget} ${String(currency).slice(0, 6)}.
User priority note: "${String(focusNeed || 'balanced storage & clutter control').slice(0, 220)}"
IMPORTANT RULES:
- Do NOT invent fake brand names, fake merchant URLs, or exact retailer SKU prices.
- Provide realistic category guidance, typical retail cost ranges fitting inside the ${safeBudget} ${currency} budget, ideal physical dimensions, why it fits the room size, and a zero/low-cost DIY alternative.
${isBengali ? 'Write summary, name, category, estimatedCostRange, idealDimensions, spaceFitReason, and diyAlternative in natural Bengali (বাংলা). Keep priority strictly "essential", "recommended", or "optional".' : 'Write all text in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              budgetStrategySummary: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    estimatedCostRange: { type: Type.STRING },
                    idealDimensions: { type: Type.STRING },
                    spaceFitReason: { type: Type.STRING },
                    diyAlternative: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: [
                    'name',
                    'category',
                    'estimatedCostRange',
                    'idealDimensions',
                    'spaceFitReason',
                    'diyAlternative',
                    'priority',
                  ],
                },
              },
            },
            required: ['budgetStrategySummary', 'recommendations'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const validPrios = new Set(['essential', 'recommended', 'optional']);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 8).map((r: any) => ({
          name: String(r.name || 'Modular Storage Bin').slice(0, 120),
          category: String(r.category || 'Storage').slice(0, 50),
          estimatedCostRange: String(r.estimatedCostRange || '$15–$25').slice(0, 50),
          idealDimensions: String(r.idealDimensions || '14" x 10" x 6"').slice(0, 60),
          spaceFitReason: String(r.spaceFitReason || '').slice(0, 280),
          diyAlternative: String(r.diyAlternative || '').slice(0, 240),
          priority: validPrios.has(r.priority) ? r.priority : 'recommended',
        }))
      : [];

    res.json({
      success: true,
      budgetStrategySummary: String(parsed.budgetStrategySummary || '').slice(0, 600),
      recommendations,
    });
  } catch (err: any) {
    console.error('Shopping assistant error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate shopping recommendations.',
      details: formatted.message,
    });
  }
});

// Phase 10: AI Room Layout Placement & Walking Clearance Suggestions
app.post('/api/layout-suggestions', async (req, res) => {
  try {
    const {
      roomType = 'bedroom',
      unit = 'ft',
      width = 12,
      length = 10,
      openings = [],
      furniture = [],
      language = 'en',
    } = req.body;

    if (!Array.isArray(furniture) || furniture.length === 0) {
      return res.status(400).json({ error: 'Add at least one furniture item to run layout optimization.' });
    }

    const safeW = Math.max(4, Math.min(100, Number(width) || 12));
    const safeL = Math.max(4, Math.min(100, Number(length) || 10));
    const ai = getGenAIClient();
    const isBengali = language === 'bn';

    const compactFurn = furniture.slice(0, 25).map((f: any) => ({
      id: String(f.id || ''),
      label: String(f.label || 'Item').slice(0, 60),
      kind: String(f.kind || 'storage'),
      x: Number(f.x) || 0,
      y: Number(f.y) || 0,
      w: Number(f.w) || 2,
      h: Number(f.h) || 2,
    }));

    const compactOpenings = Array.isArray(openings)
      ? openings.slice(0, 12).map((o: any) => ({
          kind: String(o.kind || 'door'),
          wall: String(o.wall || 'south'),
          offsetRatio: Number(o.offsetRatio) || 0.5,
          widthUnits: Number(o.widthUnits) || 3,
        }))
      : [];

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Evaluate and optimize furniture placement in a ${safeW} x ${safeL} ${unit} ${String(roomType).replace(/_/g, ' ')}.
Openings (doors/windows): ${JSON.stringify(compactOpenings)}
Current furniture coordinates (top-left x, y, width w, depth h within 0..${safeW} by 0..${safeL}): ${JSON.stringify(compactFurn)}

Rules:
- Respect door clearances (avoid blocking doors) and maximize natural window light for desks/seating.
- Keep every piece strictly inside bounds: 0 <= x <= ${safeW} - w, 0 <= y <= ${safeL} - h.
- Aim for comfortable walking pathways (>= ${unit === 'm' ? '0.8m' : '2.5ft'} wide).
- Return: walkingClearanceScore (0-100), spaceUtilizationPercent (0-100), bottlenecks (up to 4 strings), placementTips (up to 4 strings), and recommendedPositions (one per furniture id with updated x, y, and concise reason).
${isBengali ? 'Write bottlenecks, placementTips, and recommendedPositions.reason in natural Bengali (বাংলা).' : 'Write all text in clear English.'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              walkingClearanceScore: { type: Type.INTEGER },
              spaceUtilizationPercent: { type: Type.INTEGER },
              bottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              placementTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedPositions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['id', 'x', 'y', 'reason'],
                },
              },
            },
            required: [
              'walkingClearanceScore',
              'spaceUtilizationPercent',
              'bottlenecks',
              'placementTips',
              'recommendedPositions',
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    const furnMap = new Map(compactFurn.map((f) => [f.id, f]));
    const recommendedPositions = Array.isArray(parsed.recommendedPositions)
      ? parsed.recommendedPositions
          .filter((p: any) => furnMap.has(String(p.id)))
          .map((p: any) => {
            const orig = furnMap.get(String(p.id))!;
            const clampedX = Math.max(0, Math.min(Math.max(0, safeW - orig.w), Number(p.x) || 0));
            const clampedY = Math.max(0, Math.min(Math.max(0, safeL - orig.h), Number(p.y) || 0));
            return {
              id: orig.id,
              x: Math.round(clampedX * 10) / 10,
              y: Math.round(clampedY * 10) / 10,
              reason: String(p.reason || '').slice(0, 200),
            };
          })
      : [];

    res.json({
      success: true,
      suggestion: {
        walkingClearanceScore: Math.max(0, Math.min(100, Math.round(Number(parsed.walkingClearanceScore) || 75))),
        spaceUtilizationPercent: Math.max(0, Math.min(100, Math.round(Number(parsed.spaceUtilizationPercent) || 45))),
        bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks.slice(0, 4).map(String) : [],
        placementTips: Array.isArray(parsed.placementTips) ? parsed.placementTips.slice(0, 4).map(String) : [],
        recommendedPositions,
      },
    });
  } catch (err: any) {
    console.error('Layout suggestion error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({
      error: 'Failed to generate room layout optimization.',
      details: formatted.message,
    });
  }
});

// Phase 8: Configurable Stripe Billing Status, Checkout Session, Customer Portal, Cancellation, Entitlements & Signed Webhook (NEVER fakes payments)
function getStripeStatusPayload() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  const hasSecret = Boolean(stripeSecret && !stripeSecret.startsWith('MY_'));
  const priceMap = resolveStripePriceMap();
  const configuredPricePlans = {
    proMonthly: Boolean(priceMap.pro_monthly),
    proAnnual: Boolean(priceMap.pro_annual),
    premiumMonthly: Boolean(priceMap.premium_monthly),
    premiumAnnual: Boolean(priceMap.premium_annual),
  };
  const hasPrices = Boolean(
    priceMap.pro_monthly ||
      priceMap.pro_annual ||
      priceMap.premium_monthly ||
      priceMap.premium_annual
  );
  const allPriceIdsConfigured = Boolean(
    priceMap.pro_monthly &&
      priceMap.pro_annual &&
      priceMap.premium_monthly &&
      priceMap.premium_annual
  );
  const hasWebhook = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.startsWith('MY_')
  );
  const webhookToleranceSeconds = getStripeWebhookToleranceSeconds();

  return {
    provider: 'stripe',
    configured: hasSecret && hasPrices,
    hasSecretKey: hasSecret,
    hasPriceIds: hasPrices,
    allPriceIdsConfigured,
    configuredPricePlans,
    hasWebhookSecret: hasWebhook,
    webhookConfigured: hasWebhook,
    webhookOptionalInDev: true,
    webhookToleranceSeconds,
    sandboxMode: hasSecret && stripeSecret.startsWith('sk_test_'),
    webhookEndpoint: '/api/stripe/webhook',
    firestoreDirectWriteAvailable: false,
    firestoreSyncMode: 'starter_tier_admin_sync',
    requiredEnvVars: [
      'STRIPE_SECRET_KEY',
      'STRIPE_PRICE_PRO_MONTH',
      'STRIPE_PRICE_PRO_ANNUAL',
      'STRIPE_PRICE_PREMIUM_MC',
      'STRIPE_PRICE_PREMIUM_AN',
    ],
    optionalEnvVars: ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_TOLERANCE'],
  };
}

app.get('/api/billing/status', (_req, res) => {
  res.json(getStripeStatusPayload());
});

app.get('/api/stripe/status', (_req, res) => {
  res.json(getStripeStatusPayload());
});

app.post('/api/billing/create-checkout', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required to initiate subscription checkout.' });
  }

  const { planTier = 'pro', billingCycle = 'monthly' } = req.body || {};
  if (!['pro', 'premium'].includes(String(planTier)) || !['monthly', 'annual'].includes(String(billingCycle))) {
    return res.status(400).json({ error: 'Invalid planTier or billingCycle selection.' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  const priceMap = resolveStripePriceMap();
  const priceKey = `${planTier}_${billingCycle}` as keyof typeof priceMap;
  const priceId = priceMap[priceKey];
  const envVarNameByPriceKey: Record<keyof typeof priceMap, string> = {
    pro_monthly: 'STRIPE_PRICE_PRO_MONTH',
    pro_annual: 'STRIPE_PRICE_PRO_ANNUAL',
    premium_monthly: 'STRIPE_PRICE_PREMIUM_MC',
    premium_annual: 'STRIPE_PRICE_PREMIUM_AN',
  };

  if (!stripeSecret || stripeSecret.startsWith('MY_') || !priceId) {
    return res.status(400).json({
      configured: false,
      error:
        !stripeSecret || stripeSecret.startsWith('MY_')
          ? 'Live billing is not yet activated: STRIPE_SECRET_KEY must be configured in server environment secrets.'
          : `Stripe Price ID ${envVarNameByPriceKey[priceKey]} is not configured for ${planTier} (${billingCycle}).`,
    });
  }

  // Record UID <-> email correlation ahead of webhook arrival
  stripeStore.linkUserCorrelations({ uid: verified.uid, email: verified.email });

  try {
    const appOrigin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: verified.uid,
      customer_email: verified.email,
      success_url: `${appOrigin}/#/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/#/pricing?checkout=canceled`,
      'metadata[uid]': verified.uid,
      'metadata[planTier]': String(planTier),
      'metadata[billingCycle]': String(billingCycle),
      'subscription_data[metadata][uid]': verified.uid,
      'subscription_data[metadata][planTier]': String(planTier),
      'subscription_data[metadata][billingCycle]': String(billingCycle),
    });

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const stripeData: any = await stripeResp.json();
    if (!stripeResp.ok || !stripeData?.url) {
      return res.status(500).json({
        error: stripeData?.error?.message || 'Unable to create Stripe checkout session.',
      });
    }
    return res.json({ success: true, url: stripeData.url, sessionId: stripeData.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Stripe request failed.' });
  }
});

// Create Stripe Customer Portal Session for self-serve payment method updates, invoices & cancellation
async function handleCreateCustomerPortal(req: express.Request, res: express.Response) {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required to open billing portal.' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecret || stripeSecret.startsWith('MY_')) {
    return res.status(400).json({ error: 'STRIPE_SECRET_KEY is not configured on the server.' });
  }

  try {
    const view = stripeStore.getUserSubscriptionView(verified.uid, verified.email);
    let customerId = view.subscription?.customerId;

    if (!customerId && verified.email) {
      const custSearch = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(verified.email)}&limit=1`,
        {
          headers: { Authorization: `Bearer ${stripeSecret}` },
        }
      );
      if (custSearch.ok) {
        const custJson: any = await custSearch.json();
        customerId = custJson?.data?.[0]?.id;
        if (customerId) {
          stripeStore.linkUserCorrelations({ uid: verified.uid, email: verified.email, customerId });
        }
      }
    }

    if (!customerId) {
      return res.status(400).json({
        error: 'No Stripe customer billing profile found for this account yet. Subscribe to a paid plan first.',
      });
    }

    const appOrigin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const portalParams = new URLSearchParams({
      customer: customerId,
      return_url: `${appOrigin}/#/pricing`,
    });

    const portalResp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: portalParams.toString(),
    });
    const portalData: any = await portalResp.json();
    if (!portalResp.ok || !portalData?.url) {
      return res.status(400).json({
        error: portalData?.error?.message || 'Unable to create Stripe Billing Portal session.',
      });
    }

    return res.json({ success: true, url: portalData.url });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create Stripe billing portal session.' });
  }
}

app.post('/api/billing/customer-portal', handleCreateCustomerPortal);
app.post('/api/stripe/portal', handleCreateCustomerPortal);

// Schedule cancel_at_period_end on active Stripe subscription cleanly on the server
async function handleCancelSubscription(req: express.Request, res: express.Response) {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required to cancel a subscription.' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecret || stripeSecret.startsWith('MY_')) {
    return res.status(400).json({ error: 'STRIPE_SECRET_KEY is not configured on the server.' });
  }

  const view = stripeStore.getUserSubscriptionView(verified.uid, verified.email);
  const subId = view.subscription?.subscriptionId;
  if (!subId) {
    return res.status(400).json({
      error: 'No active Stripe subscription ID was found for your account.',
    });
  }

  try {
    const cancelParams = new URLSearchParams({ cancel_at_period_end: 'true' });
    const stripeResp = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: cancelParams.toString(),
    });
    const stripeData: any = await stripeResp.json();
    if (!stripeResp.ok || !stripeData?.id) {
      return res.status(400).json({
        error: stripeData?.error?.message || 'Unable to schedule subscription cancellation with Stripe.',
      });
    }

    const updated = stripeStore.markCancelAtPeriodEnd(verified.uid, Boolean(stripeData.cancel_at_period_end));
    return res.json({
      success: true,
      cancelAtPeriodEnd: Boolean(stripeData.cancel_at_period_end),
      subscription: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to cancel Stripe subscription.' });
  }
}

app.post('/api/billing/cancel-subscription', handleCancelSubscription);
app.post('/api/stripe/cancel', handleCancelSubscription);

// Server-computed plan entitlements & feature gates for authenticated clients
app.get('/api/billing/entitlements', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const isAdmin = verified.emailVerified && ADMIN_EMAILS.has(verified.email);
  const entitlements = stripeStore.getEntitlementsForUser(verified.uid, verified.email, isAdmin);
  return res.json({
    success: true,
    uid: verified.uid,
    emailVerified: verified.emailVerified,
    isAdmin,
    ...entitlements,
  });
});

// Authenticated user read of server-verified Stripe webhook subscription & invoice records
app.get('/api/stripe/subscription', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const view = stripeStore.getUserSubscriptionView(verified.uid, verified.email);
  return res.json({
    success: true,
    firestoreDirectWriteAvailable: false,
    firestoreSyncMode: 'starter_tier_admin_sync',
    subscription: view.subscription,
    invoices: view.invoices,
  });
});

// Authenticated Checkout Session verification after redirect (?checkout=success&session_id=...)
app.post('/api/stripe/verify-checkout', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid Stripe Checkout Session ID format.' });
  }
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecret || stripeSecret.startsWith('MY_')) {
    return res.status(400).json({ error: 'STRIPE_SECRET_KEY is not configured on the server.' });
  }

  try {
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
      {
        headers: { Authorization: `Bearer ${stripeSecret}` },
      }
    );
    const session: any = await resp.json();
    if (!resp.ok || !session?.id) {
      return res.status(400).json({ error: session?.error?.message || 'Unable to verify Stripe Checkout session.' });
    }

    const sessionUid = session.client_reference_id || session.metadata?.uid;
    const sessionEmail = String(session.customer_email || session.customer_details?.email || '').toLowerCase();
    if (sessionUid && sessionUid !== verified.uid) {
      return res.status(401).json({ error: 'Checkout session belongs to a different user.' });
    }
    if (!sessionUid && sessionEmail && sessionEmail !== verified.email) {
      return res.status(401).json({ error: 'Checkout session email does not match authenticated user.' });
    }
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ error: `Checkout session is not complete (status: ${session.status}).` });
    }

    const updated = stripeStore.recordVerifiedCheckoutFromStripeSession(verified.uid, verified.email, session);
    const view = stripeStore.getUserSubscriptionView(verified.uid, verified.email);
    return res.json({
      success: true,
      subscription: updated,
      invoices: view.invoices,
      firestoreDirectWriteAvailable: false,
      firestoreSyncMode: 'starter_tier_admin_sync',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to verify checkout session with Stripe.' });
  }
});

// Shared Stripe Webhook Handler supporting /api/stripe/webhook & /api/billing/webhook
// Signature verification is always mandatory when webhook deliveries are received, with 300s default tolerance.
function handleStripeWebhook(req: express.Request, res: express.Response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const sigHeader = String(req.headers['stripe-signature'] || '');
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const toleranceSec = getStripeWebhookToleranceSeconds();

  const sigCheck = verifyStripeWebhookSignature(
    rawBody || '',
    sigHeader,
    webhookSecret,
    toleranceSec
  );

  if (!sigCheck.valid) {
    serverTelemetry.totalErrors += 1;
    serverTelemetry.recentErrors.unshift({
      time: new Date().toISOString(),
      path: req.path,
      message: sigCheck.error || 'Webhook signature verification failed.',
    });
    serverTelemetry.recentErrors = serverTelemetry.recentErrors.slice(0, 15);
    return res.status(400).json({ error: sigCheck.error || 'Webhook signature verification failed.' });
  }

  let event: any = req.body;
  if (!event || typeof event !== 'object' || !event.id || !event.type) {
    try {
      event = JSON.parse(rawBody!.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed Stripe event JSON payload.' });
    }
  }

  if (!event?.id || !event?.type) {
    return res.status(400).json({ error: 'Invalid Stripe event payload: missing id or type.' });
  }

  const result = stripeStore.processWebhookEvent(event);

  return res.status(200).json({
    received: true,
    duplicate: result.duplicate,
    handled: result.handled,
    eventId: result.eventId,
    type: result.type,
    userKey: result.userKey,
    outcome: result.outcome,
    livemode: Boolean(event.livemode),
    toleranceSeconds: toleranceSec,
    firestoreDirectWrite: false,
    firestoreSyncMode: 'starter_tier_admin_sync',
  });
}

app.post('/api/stripe/webhook', handleStripeWebhook);
app.post('/api/billing/webhook', handleStripeWebhook);

// Verified Admin routes for inspecting Stripe webhook deliveries & marking Firestore sync
app.get('/api/admin/stripe-events', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified || !verified.emailVerified || !ADMIN_EMAILS.has(verified.email)) {
    return res.status(401).json({ error: 'Verified admin credentials required.' });
  }
  return res.json({
    status: getStripeStatusPayload(),
    ...stripeStore.getAdminOverview(),
  });
});

app.post('/api/admin/stripe-mark-synced', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified || !verified.emailVerified || !ADMIN_EMAILS.has(verified.email)) {
    return res.status(401).json({ error: 'Verified admin credentials required.' });
  }
  const { userKey, eventId } = req.body || {};
  if (!userKey || typeof userKey !== 'string') {
    return res.status(400).json({ error: 'userKey is required.' });
  }
  const updated = stripeStore.markSyncedToFirestore(userKey, eventId ? String(eventId) : undefined);
  return res.json({ success: true, subscription: updated });
});

// Phase 7: Protected Admin Overview & Aggregated Business Telemetry Route
app.get('/api/admin/overview', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified || !verified.emailVerified || !ADMIN_EMAILS.has(verified.email)) {
    return res.status(401).json({ error: 'Verified admin credentials required.' });
  }

  const stripeOverview = stripeStore.getAdminOverview();
  const activePaid = stripeOverview.subscriptions.filter(
    (s) => s.status === 'active' && (s.tier === 'pro' || s.tier === 'premium')
  );
  const pastDue = stripeOverview.subscriptions.filter((s) => s.status === 'past_due');
  const canceled = stripeOverview.subscriptions.filter((s) => s.status === 'canceled');

  const estimatedMrrUsd = activePaid.reduce((sum, s) => {
    const monthly = s.tier === 'premium' ? 25 : 15;
    const equiv = s.billingCycle === 'annual' ? Math.round((monthly * 10) / 12 * 100) / 100 : monthly;
    return sum + equiv;
  }, 0);

  return res.json({
    success: true,
    uptimeSeconds: Math.round(process.uptime()),
    aiUsage: {
      roomAnalyses: serverTelemetry.endpointCounts['/api/analyze-room'] || 0,
      roomRedesigns: serverTelemetry.endpointCounts['/api/redesign-room'] || 0,
      afterComparisons: serverTelemetry.endpointCounts['/api/compare-after'] || 0,
      coachMessages: serverTelemetry.endpointCounts['/api/chat'] || 0,
      shoppingQueries: serverTelemetry.endpointCounts['/api/shopping-assistant'] || 0,
      layoutSuggestions: serverTelemetry.endpointCounts['/api/layout-suggestions'] || 0,
    },
    billing: {
      ...getStripeStatusPayload(),
      activePaidCount: activePaid.length,
      pastDueCount: pastDue.length,
      canceledCount: canceled.length,
      pendingFirestoreSyncCount: stripeOverview.pendingFirestoreSyncCount,
      totalEventsProcessed: stripeOverview.totalEventsProcessed,
      estimatedMrrUsd: Math.round(estimatedMrrUsd * 100) / 100,
    },
    apiTelemetry: {
      totalRequests: serverTelemetry.totalRequests,
      totalErrors: serverTelemetry.totalErrors,
      endpointCounts: serverTelemetry.endpointCounts,
    },
  });
});

// Phase 7: Protected Admin System Health & API Telemetry Route
app.get('/api/admin/health', async (req, res) => {
  const verified = await verifyFirebaseBearerToken(req);
  if (!verified || !verified.emailVerified || !ADMIN_EMAILS.has(verified.email)) {
    return res.status(401).json({ error: 'Verified admin credentials required.' });
  }

  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: serverTelemetry.startedAt,
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('MY_')),
    stripeConfigured: getStripeStatusPayload().configured,
    webhookConfigured: getStripeStatusPayload().webhookConfigured,
    webhookOptionalInDev: true,
    webhookToleranceSeconds: getStripeWebhookToleranceSeconds(),
    totalRequests: serverTelemetry.totalRequests,
    totalErrors: serverTelemetry.totalErrors,
    endpointCounts: serverTelemetry.endpointCounts,
    recentErrors: serverTelemetry.recentErrors,
  });
});

// Ensure all /api errors always return JSON (never HTML)
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API middleware error:', err);
  res.status(err?.status || 500).json({
    error: 'Request error.',
    details: err?.message || 'Unexpected server error.',
  });
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
