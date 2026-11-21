import { jsPDF } from 'jspdf';
import { OutputLanguage, RoomAnalysis } from '../types';

function containsNonLatin(text: string): boolean {
  return /[^\u0000-\u00FF]/.test(text);
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function tryAddImageToJsPdf(
  doc: jsPDF,
  src: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  if (!src || !src.startsWith('data:image/')) return false;
  try {
    const fmt = src.includes('image/png') ? 'PNG' : src.includes('image/webp') ? 'WEBP' : 'JPEG';
    doc.addImage(src, fmt, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

function exportUnicodeCanvasPdf(analysis: RoomAnalysis, isBn: boolean) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = 595;
  const pageHeight = 842;
  const scale = 2;
  const canvasWidth = pageWidth * scale;
  const canvasHeight = pageHeight * scale;
  const margin = 44 * scale;
  const contentWidth = canvasWidth - margin * 2;

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    pages.push(canvas);
    return { canvas, ctx };
  };

  let { ctx } = createPageCanvas();

  ctx.fillStyle = '#163D32';
  ctx.fillRect(0, 0, canvasWidth, 114 * scale);

  ctx.fillStyle = '#E9B95B';
  ctx.font = `600 ${11 * scale}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    isBn ? 'à¦¨à¦¿à¦Ÿà¦¸à§à¦ªà§‡à¦¸ AI Â· à¦°à§à¦® à¦…à¦°à§à¦—à¦¾à¦¨à¦¾à¦‡à¦œà§‡à¦¶à¦¨ à¦“ à¦¡à¦¿à¦•à§à¦²à¦¾à¦Ÿà¦¾à¦°à¦¿à¦‚ à¦ªà§à¦²à§à¦¯à¦¾à¦¨' : 'NEATSPACE AI Â· ROOM ORGANIZATION & DECLUTTER PLAN',
    margin,
    34 * scale
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${20 * scale}px Outfit, "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(analysis.roomName.slice(0, 52), margin, 64 * scale);

  ctx.fillStyle = '#DDF3E5';
  ctx.font = `500 ${11 * scale}px "Plus Jakarta Sans", sans-serif`;
  const estMeta = analysis.estimatedCleaningMinutes ? `  Â·  ~${analysis.estimatedCleaningMinutes}m` : '';
  const diffMeta = analysis.cleaningDifficulty ? `  Â·  ${analysis.cleaningDifficulty}` : '';
  ctx.fillText(
    `${isBn ? 'à¦•à§à¦²à¦¾à¦Ÿà¦¾à¦° à¦¸à§à¦•à§‹à¦°' : 'Clutter Score'}: ${analysis.clutterScore}/100  Â·  ${analysis.roomType.replace(/_/g, ' ')}${diffMeta}${estMeta}`,
    margin,
    88 * scale
  );

  let y = 140 * scale;

  const ensureSpace = (neededPx: number) => {
    if (y + neededPx > canvasHeight - margin) {
      const next = createPageCanvas();
      ctx = next.ctx;
      y = margin + 10 * scale;
    }
  };

  const addHeading = (title: string) => {
    ensureSpace(38 * scale);
    ctx.fillStyle = '#DDF3E5';
    ctx.fillRect(margin, y - 16 * scale, contentWidth, 24 * scale);
    ctx.fillStyle = '#163D32';
    ctx.font = `700 ${12 * scale}px Outfit, "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(title, margin + 8 * scale, y);
    y += 22 * scale;
  };

  const addParagraph = (text: string, color = '#1F2937', fontSize = 10.5) => {
    ctx.font = `400 ${fontSize * scale}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = color;
    const lines = wrapCanvasLines(ctx, text, contentWidth - 8 * scale);
    for (const line of lines) {
      ensureSpace(16 * scale);
      ctx.fillText(line, margin + 4 * scale, y);
      y += 15 * scale;
    }
    y += 6 * scale;
  };

  addHeading(isBn ? 'à§§. à¦¸à¦¾à¦°à§à¦¬à¦¿à¦• à¦®à§‚à¦²à§à¦¯à¦¾à§Ÿà¦¨' : '1. Overall Assessment');
  addParagraph(analysis.overallAssessment);
  if (analysis.furnitureAnalysis) {
    addParagraph(`${isBn ? 'à¦†à¦¸à¦¬à¦¾à¦¬ à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£' : 'Furniture Analysis'}: ${analysis.furnitureAnalysis}`, '#374151', 10);
  }

  addHeading(isBn ? 'à§¨. à¦¦à§à¦°à§à¦¤ à¦¸à¦®à¦¾à¦§à¦¾à¦¨ (Quick Wins)' : '2. Quick Wins');
  analysis.quickWins.forEach((win, i) => {
    addParagraph(`${i + 1}. ${win}`);
  });

  addHeading(isBn ? 'à§©. à¦§à¦¾à¦ªà§‡ à¦§à¦¾à¦ªà§‡ à¦…à§à¦¯à¦¾à¦•à¦¶à¦¨ à¦ªà§à¦²à§à¦¯à¦¾à¦¨' : '3. Step-by-Step Action Plan');
  analysis.actionPlan.forEach((step) => {
    const check = step.completed ? '[âœ“]' : '[ ]';
    const prio = step.priority ? ` [${step.priority.toUpperCase()}]` : '';
    addParagraph(
      `${check} ${isBn ? 'à¦§à¦¾à¦ª' : 'Step'} ${step.stepNumber}${prio} (${step.timeEstimate}): ${step.title}`,
      '#163D32',
      10.5
    );
    if (step.instructions) {
      addParagraph(`   ${step.instructions}`, '#4B5563', 9.5);
    }
  });

  if (analysis.spaceUtilization && analysis.spaceUtilization.length > 0) {
    addHeading(isBn ? 'à§ª. à¦œà¦¾à§Ÿà¦—à¦¾à¦° à¦¸à§à¦®à¦¾à¦°à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°' : '4. Smart Space Utilization');
    analysis.spaceUtilization.forEach((tip) => {
      addParagraph(`â€¢ ${tip.zone} (${tip.spaceGainEstimate}): ${tip.suggestion}`);
    });
  }

  if (analysis.colorDecor) {
    addHeading(isBn ? 'à§«. à¦°à¦™ à¦“ à¦¡à§‡à¦•à§‹à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶' : '5. Color & Decoration Suggestions');
    const wallTxt = analysis.colorDecor.wallColors.map((w) => `${w.name} (${w.hex})`).join(', ');
    addParagraph(`${isBn ? 'à¦¦à§‡à§Ÿà¦¾à¦²à§‡à¦° à¦°à¦™' : 'Wall Colors'}: ${wallTxt}`);
    addParagraph(`${isBn ? 'à¦ªà¦°à§à¦¦à¦¾ à¦ªà¦°à¦¾à¦®à¦°à§à¦¶' : 'Curtains'}: ${analysis.colorDecor.curtainSuggestion}`);
  }

  if (analysis.storageRecommendations.length > 0) {
    addHeading(isBn ? 'à§¬. à¦¸à§à¦Ÿà§‹à¦°à§‡à¦œ à¦“ à¦¶à¦ªà¦¿à¦‚ à¦šà§‡à¦•à¦²à¦¿à¦¸à§à¦Ÿ' : '6. Storage & Shopping List');
    analysis.storageRecommendations.forEach((s) => {
      addParagraph(`â€¢ ${s.itemTitle} (${s.estimatedBudget}) â€” ${s.suggestedLocation}`);
    });
  }

  addHeading(isBn ? 'à§­. à¦²à§‡à¦†à¦‰à¦Ÿ à¦“ à¦°à§à¦Ÿà¦¿à¦¨' : '7. Layout & Maintenance');
  addParagraph(analysis.layoutAdvice);
  if (analysis.maintenanceHabits && analysis.maintenanceHabits.length > 0) {
    analysis.maintenanceHabits.forEach((h) => addParagraph(`â€¢ ${h}`));
  }

  pages.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage();
