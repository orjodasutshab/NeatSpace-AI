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
    ? 'LANGUAGE REQUIREMENT: Write ALL descriptive text values (roomName, overallAssessment, furnitureAnalysis, detectedItems, detectedObjects label/category/estimatedValue, triageItems item/reason, quickWins, problemAreas title/description/recommendation, actionPlan title/timeEstimate/instructions/tips, storageRecommendations category/itemTitle/purpose/suggestedLocation/estimatedBudget, spaceUtilization zone/suggestion/spaceGainEstimate, colorDecor wallColors name/reason, curtainSuggestion, furniturePalette name, decorTips, recyclingTips, layoutAdvice, maintenanceHabits, minimalistTip) in natural, clear Bengali (à¦¬à¦¾à¦‚à¦²à¦¾ script). Keep enum values for cleaningDifficulty ("Easy", "Moderate", "Intensive"), category ("Purge", "Sort", "Organize", "Store"), priority ("high", "medium", "low"), severity ("low", "medium", "high"), clutterImpact ("high", "medium", "low"), difficulty ("Easy", "Moderate"), and triage/recommendedAction ("keep", "donate", "trash", "relocate", "recycle") strictly in English as required by the schema.'
    : 'LANGUAGE REQUIREMENT: Write all text values in clear, natural English.'
}`;

    const prompt = `Analyze this room photo for a ${String(roomType).replace(/_/g, ' ')} with the primary focus goal: "${String(focusGoal).replace(/_/g, ' ')}".
The user has about ${safeMinutes} minutes per session for their personalized cleaning plan.
${userNote ? `USER CONSTRAINT / SPECIAL FOCUS: "${userNote}" â€” Incorporate this constraint carefully across action steps, storage choices, and layout advice.` : ''}

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
11. colorDecor: AI Color & Decoration Suggestions tailored to this room's light and architecture â€” 3 wallColors (with name, hex code like #E8EFEA, reason), 1 curtainSuggestion, 3 furniturePalette swatches (name, hex), and 3 decorTips.
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
