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
    isBn ? 'নিটস্পেস AI · রুম অর্গানাইজেশন ও ডিক্লাটারিং প্ল্যান' : 'NEATSPACE AI · ROOM ORGANIZATION & DECLUTTER PLAN',
    margin,
    34 * scale
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${20 * scale}px Outfit, "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(analysis.roomName.slice(0, 52), margin, 64 * scale);

  ctx.fillStyle = '#DDF3E5';
  ctx.font = `500 ${11 * scale}px "Plus Jakarta Sans", sans-serif`;
  const estMeta = analysis.estimatedCleaningMinutes ? `  ·  ~${analysis.estimatedCleaningMinutes}m` : '';
  const diffMeta = analysis.cleaningDifficulty ? `  ·  ${analysis.cleaningDifficulty}` : '';
  ctx.fillText(
    `${isBn ? 'ক্লাটার স্কোর' : 'Clutter Score'}: ${analysis.clutterScore}/100  ·  ${analysis.roomType.replace(/_/g, ' ')}${diffMeta}${estMeta}`,
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

  addHeading(isBn ? '১. সার্বিক মূল্যায়ন' : '1. Overall Assessment');
  addParagraph(analysis.overallAssessment);
  if (analysis.furnitureAnalysis) {
    addParagraph(`${isBn ? 'আসবাব বিশ্লেষণ' : 'Furniture Analysis'}: ${analysis.furnitureAnalysis}`, '#374151', 10);
  }

  addHeading(isBn ? '২. দ্রুত সমাধান (Quick Wins)' : '2. Quick Wins');
  analysis.quickWins.forEach((win, i) => {
    addParagraph(`${i + 1}. ${win}`);
  });

  addHeading(isBn ? '৩. ধাপে ধাপে অ্যাকশন প্ল্যান' : '3. Step-by-Step Action Plan');
  analysis.actionPlan.forEach((step) => {
    const check = step.completed ? '[✓]' : '[ ]';
    const prio = step.priority ? ` [${step.priority.toUpperCase()}]` : '';
    addParagraph(
      `${check} ${isBn ? 'ধাপ' : 'Step'} ${step.stepNumber}${prio} (${step.timeEstimate}): ${step.title}`,
      '#163D32',
      10.5
    );
    if (step.instructions) {
      addParagraph(`   ${step.instructions}`, '#4B5563', 9.5);
    }
  });

  if (analysis.spaceUtilization && analysis.spaceUtilization.length > 0) {
    addHeading(isBn ? '৪. জায়গার স্মার্ট ব্যবহার' : '4. Smart Space Utilization');
    analysis.spaceUtilization.forEach((tip) => {
      addParagraph(`• ${tip.zone} (${tip.spaceGainEstimate}): ${tip.suggestion}`);
    });
  }

  if (analysis.colorDecor) {
    addHeading(isBn ? '৫. রঙ ও ডেকোর পরামর্শ' : '5. Color & Decoration Suggestions');
    const wallTxt = analysis.colorDecor.wallColors.map((w) => `${w.name} (${w.hex})`).join(', ');
    addParagraph(`${isBn ? 'দেয়ালের রঙ' : 'Wall Colors'}: ${wallTxt}`);
    addParagraph(`${isBn ? 'পর্দা পরামর্শ' : 'Curtains'}: ${analysis.colorDecor.curtainSuggestion}`);
  }

  if (analysis.storageRecommendations.length > 0) {
    addHeading(isBn ? '৬. স্টোরেজ ও শপিং চেকলিস্ট' : '6. Storage & Shopping List');
    analysis.storageRecommendations.forEach((s) => {
      addParagraph(`• ${s.itemTitle} (${s.estimatedBudget}) — ${s.suggestedLocation}`);
    });
  }

  addHeading(isBn ? '৭. লেআউট ও রুটিন' : '7. Layout & Maintenance');
  addParagraph(analysis.layoutAdvice);
  if (analysis.maintenanceHabits && analysis.maintenanceHabits.length > 0) {
    analysis.maintenanceHabits.forEach((h) => addParagraph(`• ${h}`));
  }

  pages.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
  });

  const slug = analysis.roomName.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').slice(0, 40) || 'room-plan';
  doc.save(`${slug}-organization-plan.pdf`);
}

export function exportRoomPlanToPdf(analysis: RoomAnalysis, language: OutputLanguage): void {
  const isBn = language === 'bn';
  const sampleText = `${analysis.roomName} ${analysis.overallAssessment} ${analysis.actionPlan
    .map((s) => s.title)
    .join(' ')}`;

  if (isBn || containsNonLatin(sampleText)) {
    exportUnicodeCanvasPdf(analysis, isBn);
    return;
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const maxWidth = pageWidth - margin * 2;

  // Deep Green Header
  doc.setFillColor(22, 61, 50);
  doc.rect(0, 0, pageWidth, 102, 'F');

  doc.setTextColor(233, 185, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NEATSPACE AI · PERSONALIZED ROOM ORGANIZATION PLAN', margin, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(analysis.roomName.slice(0, 56), margin, 56);

  doc.setTextColor(221, 243, 229);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const afterTxt =
    typeof analysis.afterClutterScore === 'number'
      ? `  |  After Score: ${analysis.afterClutterScore}/100`
      : '';
  const diffTxt = analysis.cleaningDifficulty ? `  |  Difficulty: ${analysis.cleaningDifficulty}` : '';
  const durTxt = analysis.estimatedCleaningMinutes ? `  |  Est. Time: ~${analysis.estimatedCleaningMinutes}m` : '';
  doc.text(
    `Room: ${analysis.roomType.replace(/_/g, ' ').toUpperCase()}  |  Clutter Score: ${analysis.clutterScore}/100${afterTxt}${diffTxt}${durTxt}`,
    margin,
    80
  );

  let y = 124;

  // Optional Room Photo + Before/After Thumbnail Row
  const hasBeforeImg = Boolean(analysis.imageUrl && analysis.imageUrl.startsWith('data:image/'));
  const afterSrc = analysis.afterImageUrl || analysis.redesignPreviewUrl;
  const hasAfterImg = Boolean(afterSrc && afterSrc.startsWith('data:image/'));

  if (hasBeforeImg) {
    const thumbW = hasAfterImg ? (maxWidth - 16) / 2 : 220;
    const thumbH = 120;
    const addedBefore = tryAddImageToJsPdf(doc, analysis.imageUrl, margin, y, thumbW, thumbH);
    let addedAfter = false;
    if (hasAfterImg) {
      addedAfter = tryAddImageToJsPdf(doc, afterSrc, margin + thumbW + 16, y, thumbW, thumbH);
    }
    if (addedBefore || addedAfter) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(22, 61, 50);
      if (addedBefore) doc.text('Before / Original Room', margin, y + thumbH + 12);
      if (addedAfter) doc.text('After / Redesigned Preview', margin + thumbW + 16, y + thumbH + 12);
      y += thumbH + 28;
    }
  }

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionHeader = (title: string) => {
    ensureSpace(34);
    doc.setFillColor(221, 243, 229);
    doc.roundedRect(margin, y - 13, maxWidth, 22, 4, 4, 'F');
    doc.setTextColor(22, 61, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, margin + 8, y + 2);
    y += 22;
  };

  const addWrappedText = (text: string, fontSize = 10, color: [number, number, number] = [31, 41, 55], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth - 8);
    for (const line of lines) {
      ensureSpace(15);
      doc.text(line, margin + 4, y);
      y += 14;
    }
    y += 4;
  };

  addSectionHeader('1. Overall Room & Furniture Assessment');
  addWrappedText(analysis.overallAssessment);
  if (analysis.furnitureAnalysis) {
    addWrappedText(`Furniture Placement: ${analysis.furnitureAnalysis}`, 9.5, [55, 65, 81]);
  }

  addSectionHeader('2. 15-Minute Quick Wins');
  analysis.quickWins.forEach((win, i) => {
    addWrappedText(`${i + 1}. ${win}`);
  });

  addSectionHeader('3. Step-by-Step Action Checklist');
  analysis.actionPlan.forEach((step) => {
    const check = step.completed ? '[DONE]' : '[    ]';
    const prio = step.priority ? ` · ${step.priority.toUpperCase()}` : '';
    addWrappedText(
      `${check} Step ${step.stepNumber} (${step.category}${prio} · ${step.timeEstimate}): ${step.title}`,
      10,
      [22, 61, 50],
      true
    );
    if (step.instructions) {
      addWrappedText(`   ${step.instructions}`, 9.5, [75, 85, 99]);
    }
  });

  if (analysis.triageItems && analysis.triageItems.length > 0) {
    addSectionHeader('4. Item Triage & Donation / Recycling');
    analysis.triageItems.forEach((item) => {
      addWrappedText(`• [${item.decision.toUpperCase()}] ${item.item} — ${item.reason}`, 9.5);
    });
  }

  if (analysis.spaceUtilization && analysis.spaceUtilization.length > 0) {
    addSectionHeader('5. Smart Space Utilization');
    analysis.spaceUtilization.forEach((tip) => {
      addWrappedText(`• ${tip.zone} (${tip.spaceGainEstimate}): ${tip.suggestion}`, 9.5);
    });
  }

  if (analysis.colorDecor) {
    addSectionHeader('6. AI Color & Decoration Suggestions');
    const wallPalette = analysis.colorDecor.wallColors.map((c) => `${c.name} (${c.hex})`).join(', ');
    addWrappedText(`Wall Colors: ${wallPalette}`, 9.5);
    addWrappedText(`Curtains: ${analysis.colorDecor.curtainSuggestion}`, 9.5);
    if (analysis.colorDecor.decorTips.length > 0) {
      analysis.colorDecor.decorTips.forEach((d) => addWrappedText(`• ${d}`, 9.5));
    }
  }

  if (analysis.storageRecommendations.length > 0) {
    addSectionHeader('7. Storage & Shopping Recommendations');
    analysis.storageRecommendations.forEach((st) => {
      addWrappedText(
        `${st.acquired ? '[ACQUIRED]' : '[ ]'} ${st.itemTitle} (${st.estimatedBudget}) — ${st.suggestedLocation}`,
        9.5
      );
    });
  }

  addSectionHeader('8. Spatial Layout & Maintenance Habits');
  addWrappedText(analysis.layoutAdvice, 9.5);
  if (analysis.maintenanceHabits && analysis.maintenanceHabits.length > 0) {
    analysis.maintenanceHabits.forEach((h) => addWrappedText(`• ${h}`, 9.5));
  }

  if (analysis.minimalistTip) {
    addWrappedText(`Coach Rule: "${analysis.minimalistTip}"`, 9.5, [22, 61, 50], true);
  }

  const slug = analysis.roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'room-plan';
  doc.save(`${slug}-organization-plan.pdf`);
}
