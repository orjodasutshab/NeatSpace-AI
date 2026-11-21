import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArchitecturalOpening,
  FurnitureKind,
  LayoutAiSuggestionResult,
  LayoutFurnitureItem,
  MeasurementUnit,
  OutputLanguage,
  RoomLayoutPlan,
  RoomType,
} from '../types';
import { getUILabels } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Ruler,
  Plus,
  Trash2,
  RotateCw,
  Wand2,
  Save,
  Download,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Square,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RoomLayoutPlannerViewProps {
  language: OutputLanguage;
  layouts: RoomLayoutPlan[];
  maxLayouts: number;
  aiLayoutEnabled: boolean;
  onSaveLayout: (layout: RoomLayoutPlan) => Promise<void> | void;
  onDeleteLayout: (id: string) => Promise<void> | void;
  onAiLayoutCompleted?: () => void;
  onOpenPricing?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const FURNITURE_PRESETS: Array<{ kind: FurnitureKind; label: string; wFt: number; hFt: number; color: string }> = [
  { kind: 'bed', label: 'Bed', wFt: 5.5, hFt: 6.5, color: '#DDF3E5' },
  { kind: 'desk', label: 'Desk', wFt: 4.5, hFt: 2.2, color: '#E9B95B' },
  { kind: 'sofa', label: 'Sofa', wFt: 6.0, hFt: 3.0, color: '#CFE8D8' },
  { kind: 'storage', label: 'Wardrobe / Shelf', wFt: 3.5, hFt: 1.8, color: '#163D32' },
  { kind: 'table', label: 'Table', wFt: 4.0, hFt: 3.0, color: '#F1DFB6' },
  { kind: 'chair', label: 'Chair', wFt: 2.0, hFt: 2.0, color: '#A9D3BC' },
  { kind: 'plant', label: 'Plant', wFt: 1.5, hFt: 1.5, color: '#6FB98F' },
];

function createDefaultLayout(roomType: RoomType = 'bedroom'): RoomLayoutPlan {
  return {
    id: `layout_${Date.now()}`,
    name: 'Master Bedroom Layout',
    roomType,
    unit: 'ft',
    width: 12,
    length: 10,
    ceilingHeight: 9,
    openings: [
      { id: 'op_door', kind: 'door', wall: 'south', offsetRatio: 0.18, widthUnits: 3, label: 'Entry Door' },
      { id: 'op_win', kind: 'window', wall: 'north', offsetRatio: 0.5, widthUnits: 4, label: 'Window' },
    ],
    furniture: [
      { id: 'f_bed', label: 'Queen Bed', kind: 'bed', x: 3.2, y: 0.5, w: 5.5, h: 6.5, rotation: 0 },
      { id: 'f_desk', label: 'Work Desk', kind: 'desk', x: 0.4, y: 1.0, w: 2.2, h: 4.0, rotation: 90 },
      { id: 'f_shelf', label: 'Closet Shelf', kind: 'storage', x: 8.5, y: 6.2, w: 3.2, h: 1.8, rotation: 0 },
    ],
    updatedAt: Date.now(),
  };
}

export const RoomLayoutPlannerView: React.FC<RoomLayoutPlannerViewProps> = ({
  language,
  layouts,
  maxLayouts,
  aiLayoutEnabled,
  onSaveLayout,
  onDeleteLayout,
  onAiLayoutCompleted,
  onOpenPricing,
  onDirtyChange,
}) => {
  const isBn = language === 'bn';
  const t = getUILabels(language);

  const [draft, setDraft] = useState<RoomLayoutPlan>(() =>
    layouts[0] ? { ...layouts[0] } : createDefaultLayout()
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    draft.furniture[0]?.id || null
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<LayoutAiSuggestionResult | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<LayoutFurnitureItem[] | null>(null);
  const [pendingDeleteLayoutId, setPendingDeleteLayoutId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  const updateDraft = (updater: (prev: RoomLayoutPlan) => RoomLayoutPlan) => {
    setDraft((prev) => updater(prev));
    setIsDirty(true);
    setSaveFeedback(null);
  };

  const handleLoadLayout = (layout: RoomLayoutPlan) => {
    setDraft(JSON.parse(JSON.stringify(layout)));
    setSelectedItemId(layout.furniture[0]?.id || null);
    setAiResult(null);
    setIsDirty(false);
  };

  const handleNewBlankLayout = () => {
    const fresh = createDefaultLayout('living_room');
    fresh.name = isBn ? 'à¦¨à¦¤à§à¦¨ à¦°à§à¦® à¦²à§‡à¦†à¦‰à¦Ÿ' : 'New Room Plan';
    setDraft(fresh);
    setSelectedItemId(fresh.furniture[0]?.id || null);
    setAiResult(null);
    setIsDirty(true);
  };

  const handleUnitToggle = (nextUnit: MeasurementUnit) => {
    if (nextUnit === draft.unit) return;
    const factor = nextUnit === 'm' ? 0.3048 : 3.28084;
    const round1 = (n: number) => Math.max(0.5, Math.round(n * factor * 10) / 10);
    updateDraft((prev) => ({
      ...prev,
      unit: nextUnit,
      width: Math.max(3, Math.round(prev.width * factor * 10) / 10),
      length: Math.max(3, Math.round(prev.length * factor * 10) / 10),
      ceilingHeight: Math.max(2, Math.round(prev.ceilingHeight * factor * 10) / 10),
      openings: prev.openings.map((o) => ({ ...o, widthUnits: round1(o.widthUnits) })),
      furniture: prev.furniture.map((f) => ({
        ...f,
        x: Math.round(f.x * factor * 10) / 10,
        y: Math.round(f.y * factor * 10) / 10,
        w: round1(f.w),
        h: round1(f.h),
      })),
    }));
  };

  const handleAddFurniture = (preset: (typeof FURNITURE_PRESETS)[number]) => {
    const scale = draft.unit === 'm' ? 0.3048 : 1;
    const w = Math.round(preset.wFt * scale * 10) / 10;
    const h = Math.round(preset.hFt * scale * 10) / 10;
    const item: LayoutFurnitureItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: preset.label,
      kind: preset.kind,
      x: Math.max(0, Math.min(draft.width - w, Math.round((draft.width / 2 - w / 2) * 10) / 10)),
      y: Math.max(0, Math.min(draft.length - h, Math.round((draft.length / 2 - h / 2) * 10) / 10)),
      w,
      h,
      rotation: 0,
    };
    updateDraft((prev) => ({ ...prev, furniture: [...prev.furniture, item] }));
    setSelectedItemId(item.id);
  };

  const handleAddOpening = (kind: 'door' | 'window') => {
    const newOp: ArchitecturalOpening = {
      id: `op_${Date.now()}`,
      kind,
      wall: kind === 'door' ? 'south' : 'east',
      offsetRatio: 0.45,
      widthUnits: draft.unit === 'm' ? (kind === 'door' ? 0.9 : 1.2) : kind === 'door' ? 3 : 4,
      label: kind === 'door' ? 'Door' : 'Window',
    };
    updateDraft((prev) => ({ ...prev, openings: [...prev.openings, newOp] }));
  };

  const selectedItem = draft.furniture.find((f) => f.id === selectedItemId) || null;

  const updateSelectedItem = (patch: Partial<LayoutFurnitureItem>) => {
    if (!selectedItemId) return;
    updateDraft((prev) => ({
      ...prev,
      furniture: prev.furniture.map((f) => {
        if (f.id !== selectedItemId) return f;
        const merged = { ...f, ...patch };
        merged.w = Math.max(0.5, Math.min(prev.width, merged.w));
        merged.h = Math.max(0.5, Math.min(prev.length, merged.h));
        merged.x = Math.max(0, Math.min(Math.max(0, prev.width - merged.w), merged.x));
        merged.y = Math.max(0, Math.min(Math.max(0, prev.length - merged.h), merged.y));
        return merged;
      }),
    }));
  };

  const rotateSelected = () => {
    if (!selectedItem) return;
    updateSelectedItem({
      w: selectedItem.h,
      h: selectedItem.w,
      rotation: selectedItem.rotation === 0 ? 90 : 0,
    });
  };

  const deleteSelected = () => {
    if (!selectedItemId) return;
    updateDraft((prev) => ({
      ...prev,
      furniture: prev.furniture.filter((f) => f.id !== selectedItemId),
    }));
    setSelectedItemId(null);
  };

  // Deterministic Space Utilization & Clearance Analysis
  const metrics = useMemo(() => {
    const roomArea = draft.width * draft.length;
    const furnitureArea = draft.furniture.reduce((s, f) => s + f.w * f.h, 0);
    const utilizationPct = roomArea > 0 ? Math.min(100, Math.round((furnitureArea / roomArea) * 100)) : 0;
    const freeArea = Math.max(0, roomArea - furnitureArea);

    const minPathwayThreshold = draft.unit === 'm' ? 0.76 : 2.5;
    const warnings: string[] = [];

    // Check pairwise overlaps or tight walkways
    for (let i = 0; i < draft.furniture.length; i++) {
      const a = draft.furniture[i];
      for (let j = i + 1; j < draft.furniture.length; j++) {
        const b = draft.furniture[j];
        const xGap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
        const yGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        if (xGap < 0 && yGap < 0) {
          warnings.push(`Overlap detected between ${a.label} and ${b.label}.`);
        } else {
          const dist = Math.hypot(Math.max(0, xGap), Math.max(0, yGap));
          if (dist > 0 && dist < minPathwayThreshold) {
            warnings.push(
              `Tight passage (${dist.toFixed(1)} ${draft.unit}) between ${a.label} & ${b.label}; aim for >= ${minPathwayThreshold} ${draft.unit}.`
            );
          }
        }
      }
    }

    // Check door clearance zones
    const doorDepth = draft.unit === 'm' ? 0.9 : 3.0;
    draft.openings
      .filter((o) => o.kind === 'door')
      .forEach((door) => {
        const dx =
          door.wall === 'north' || door.wall === 'south'
            ? door.offsetRatio * draft.width
            : door.wall === 'west'
            ? 0
            : draft.width - doorDepth;
        const dy =
          door.wall === 'west' || door.wall === 'east'
            ? door.offsetRatio * draft.length
            : door.wall === 'north'
            ? 0
            : draft.length - doorDepth;
        const dw = door.wall === 'north' || door.wall === 'south' ? door.widthUnits : doorDepth;
        const dh = door.wall === 'north' || door.wall === 'south' ? doorDepth : door.widthUnits;

        draft.furniture.forEach((f) => {
          const hits = f.x < dx + dw && f.x + f.w > dx && f.y < dy + dh && f.y + f.h > dy;
          if (hits) {
            warnings.push(`${f.label} blocks clearance zone in front of ${door.label}.`);
          }
        });
      });

    return {
      roomArea: roomArea.toFixed(1),
      furnitureArea: furnitureArea.toFixed(1),
      freeArea: freeArea.toFixed(1),
      utilizationPct,
      warnings: warnings.slice(0, 5),
    };
  }, [draft]);

  // SVG Canvas Coordinate Projection
  const pad = 34;
  const vbW = 540;
  const vbH = 400;
  const innerW = vbW - pad * 2;
  const innerH = vbH - pad * 2;
  const scale = Math.min(innerW / Math.max(1, draft.width), innerH / Math.max(1, draft.length));
  const roomPxW = draft.width * scale;
  const roomPxH = draft.length * scale;
  const originX = (vbW - roomPxW) / 2;
  const originY = (vbH - roomPxH) / 2;

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * vbW;
    const svgY = ((e.clientY - rect.top) / rect.height) * vbH;
    const target = draft.furniture.find((f) => f.id === draggingId);
    if (!target) return;
    const roomX = (svgX - originX) / scale - target.w / 2;
    const roomY = (svgY - originY) / scale - target.h / 2;
    const snappedX = Math.max(0, Math.min(draft.width - target.w, Math.round(roomX * 5) / 5));
    const snappedY = Math.max(0, Math.min(draft.length - target.h, Math.round(roomY * 5) / 5));
    updateDraft((prev) => ({
      ...prev,
      furniture: prev.furniture.map((f) =>
        f.id === draggingId ? { ...f, x: snappedX, y: snappedY } : f
      ),
    }));
  };

  const handleSave = async () => {
    const isExisting = layouts.some((l) => l.id === draft.id);
    if (!isExisting && layouts.length >= maxLayouts) {
      setAiError(
        isBn
          ? `à¦†à¦ªà¦¨à¦¾à¦° à¦ªà§à¦²à§à¦¯à¦¾à¦¨à§‡ à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š ${maxLayouts}à¦Ÿà¦¿ à¦²à§‡à¦†à¦‰à¦Ÿ à¦¸à§‡à¦­ à¦•à¦°à¦¾ à¦¯à¦¾à§Ÿà¥¤`
          : `Plan limit reached (${maxLayouts} saved layouts). Upgrade to save additional plans.`
      );
      return;
    }

    setIsSaving(true);
    setAiError(null);
    try {
      await onSaveLayout({ ...draft, updatedAt: Date.now() });
      setIsDirty(false);
      setSaveFeedback(isBn ? 'à¦²à§‡à¦†à¦‰à¦Ÿ à¦¸à§‡à¦­ à¦¹à§Ÿà§‡à¦›à§‡!' : 'Layout saved!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setAiError(err?.message || 'Unable to save layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiOptimize = async () => {
    if (!aiLayoutEnabled) {
      setAiError(
        isBn
          ? 'AI à¦²à§‡à¦†à¦‰à¦Ÿ à¦…à¦ªà§à¦Ÿà¦¿à¦®à¦¾à¦‡à¦œà§‡à¦¶à¦¨ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨à§‡ à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨ à¦•à¦°à§à¦¤à§ƒà¦• à¦¬à¦¨à§à¦§ à¦°à§Ÿà§‡à¦›à§‡à¥¤'
          : 'AI Layout Optimization is currently disabled by administrator.'
      );
      return;
    }
    if (draft.furniture.length === 0) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch('/api/layout-suggestions', {
