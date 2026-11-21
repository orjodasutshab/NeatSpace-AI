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
    fresh.name = isBn ? 'নতুন রুম লেআউট' : 'New Room Plan';
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
          ? `আপনার প্ল্যানে সর্বোচ্চ ${maxLayouts}টি লেআউট সেভ করা যায়।`
          : `Plan limit reached (${maxLayouts} saved layouts). Upgrade to save additional plans.`
      );
      return;
    }

    setIsSaving(true);
    setAiError(null);
    try {
      await onSaveLayout({ ...draft, updatedAt: Date.now() });
      setIsDirty(false);
      setSaveFeedback(isBn ? 'লেআউট সেভ হয়েছে!' : 'Layout saved!');
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
          ? 'AI লেআউট অপ্টিমাইজেশন বর্তমানে অ্যাডমিন কর্তৃক বন্ধ রয়েছে।'
          : 'AI Layout Optimization is currently disabled by administrator.'
      );
      return;
    }
    if (draft.furniture.length === 0) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch('/api/layout-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: draft.roomType,
          unit: draft.unit,
          width: draft.width,
          length: draft.length,
          openings: draft.openings,
          furniture: draft.furniture,
          language,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to get AI layout suggestions.');
      }
      setAiResult(data.suggestion);
      onAiLayoutCompleted?.();
    } catch (err: any) {
      setAiError(err?.message || 'Error contacting AI layout service.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiPositions = () => {
    if (!aiResult?.recommendedPositions?.length) return;
    setUndoSnapshot(JSON.parse(JSON.stringify(draft.furniture)));
    const positions = aiResult.recommendedPositions as Array<{ id: string; x: number; y: number }>;
    const map = new Map<string, { id: string; x: number; y: number }>(positions.map((p) => [p.id, p]));
    updateDraft((prev) => ({
      ...prev,
      furniture: prev.furniture.map((f) => {
        const rec = map.get(f.id);
        return rec ? { ...f, x: rec.x, y: rec.y } : f;
      }),
    }));
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'room-layout'}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? '২ডি রুম মেজারমেন্ট ও লেআউট প্ল্যানার' : '2D Scaled Room Planner & Space Calculator'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft((p) => ({ ...p, name: e.target.value }))}
              aria-label="Layout name"
              className="text-lg sm:text-xl font-bold bg-transparent border-b border-dashed border-[#163D32]/25 dark:border-[#345C4B] text-[#163D32] dark:text-[#EDF4EF] outline-none focus:border-[#163D32]"
            />
            {isDirty && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#E9B95B]/30 text-[#163D32] dark:text-[#E9B95B]">
                {isBn ? 'সেভ বাকি' : 'Unsaved'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {layouts.length > 0 && (
            <select
              value={layouts.some((l) => l.id === draft.id) ? draft.id : ''}
              onChange={(e) => {
                const found = layouts.find((l) => l.id === e.target.value);
                if (found) handleLoadLayout(found);
              }}
              aria-label="Load saved layout"
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
            >
              <option value="" disabled>
                {isBn ? 'সেভড লেআউট লোড করুন' : 'Load Saved Layout...'}
              </option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.width}×{l.length} {l.unit})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleNewBlankLayout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{isBn ? 'নতুন' : 'New'}</span>
          </button>

          {layouts.some((l) => l.id === draft.id) && (
            <button
              type="button"
              onClick={() => setPendingDeleteLayoutId(draft.id)}
              aria-label="Delete current layout"
              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>SVG</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold whitespace-nowrap"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#E9B95B]" />}
            <span>{saveFeedback || (isBn ? 'সেভ করুন' : 'Save Plan')}</span>
          </button>
        </div>
      </div>

      {aiError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-700 dark:text-rose-200 flex flex-wrap items-center justify-between gap-2">
          <span>{aiError}</span>
          {onOpenPricing && aiError.toLowerCase().includes('limit') && (
            <button type="button" onClick={onOpenPricing} className="font-bold underline">
              Upgrade Plan →
            </button>
          )}
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls Panel */}
        <div className="xl:col-span-4 space-y-5">
          {/* Dimensions Calculator */}
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#E9B95B]" />
                <span>{isBn ? 'ঘরের মাপ' : 'Room Measurements'}</span>
              </h3>
              <div className="inline-flex p-0.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10">
                {(['ft', 'm'] as MeasurementUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitToggle(u)}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      draft.unit === u ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] mb-1">
                  {isBn ? `প্রস্থ (${draft.unit})` : `Width (${draft.unit})`}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={4}
                  max={100}
                  value={draft.width}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, width: Math.max(4, Math.min(100, Number(e.target.value) || 4)) }))
                  }
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] mb-1">
                  {isBn ? `দৈর্ঘ্য (${draft.unit})` : `Length (${draft.unit})`}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={4}
                  max={100}
                  value={draft.length}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, length: Math.max(4, Math.min(100, Number(e.target.value) || 4)) }))
                  }
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] mb-1">
                  {isBn ? `উচ্চতা (${draft.unit})` : `Ceiling (${draft.unit})`}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={2}
                  max={30}
                  value={draft.ceilingHeight}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      ceilingHeight: Math.max(2, Math.min(30, Number(e.target.value) || 8)),
                    }))
                  }
                  className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]"
                />
              </div>
            </div>

            <select
              value={draft.roomType}
              onChange={(e) => updateDraft((p) => ({ ...p, roomType: e.target.value as RoomType }))}
              aria-label="Room category"
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
            >
              {(Object.keys(t.roomLabels) as RoomType[]).map((rt) => (
                <option key={rt} value={rt}>
                  {t.roomLabels[rt]}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono tabular-nums">
              <div className="p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                <div className="text-[10px] text-[#163D32]/65 dark:text-[#9FC6B0]">Total</div>
                <div className="text-xs font-bold">
                  {metrics.roomArea} {draft.unit}²
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                <div className="text-[10px] text-[#163D32]/65 dark:text-[#9FC6B0]">Used</div>
                <div className="text-xs font-bold">{metrics.utilizationPct}%</div>
              </div>
              <div className="p-2 rounded-xl bg-[#DDF3E5]/70 dark:bg-[#1E3B30]">
                <div className="text-[10px] text-[#163D32] dark:text-[#9FC6B0]">Open Floor</div>
                <div className="text-xs font-bold text-[#163D32] dark:text-[#E9B95B]">
                  {metrics.freeArea} {draft.unit}²
                </div>
              </div>
            </div>
          </div>

          {/* Furniture Palette */}
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'আসবাব যোগ করুন' : 'Add Furniture & Fixtures'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {FURNITURE_PRESETS.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  onClick={() => handleAddFurniture(p)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border border-[#163D32]/15 dark:border-[#264638] text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#163D32]/10 dark:border-[#264638] flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddOpening('door')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DDF3E5] text-[#163D32] text-xs font-bold"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{isBn ? '+ দরজা' : '+ Door'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddOpening('window')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{isBn ? '+ জানালা' : '+ Window'}</span>
              </button>
            </div>

            {/* Door / Window List */}
            {draft.openings.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {draft.openings.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center gap-2 text-xs bg-[#F7F9F6] dark:bg-[#182C24] p-2 rounded-xl"
                  >
                    <span className="font-bold capitalize w-14 truncate">{op.kind}</span>
                    <select
                      value={op.wall}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          openings: p.openings.map((x) =>
                            x.id === op.id ? { ...x, wall: e.target.value as ArchitecturalOpening['wall'] } : x
                          ),
                        }))
                      }
                      className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 rounded-lg px-1.5 py-1 text-[11px]"
                    >
                      <option value="north">North</option>
                      <option value="south">South</option>
                      <option value="east">East</option>
                      <option value="west">West</option>
                    </select>
                    <input
                      type="range"
                      min={0.1}
                      max={0.8}
                      step={0.05}
                      value={op.offsetRatio}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          openings: p.openings.map((x) =>
                            x.id === op.id ? { ...x, offsetRatio: Number(e.target.value) } : x
                          ),
                        }))
                      }
                      aria-label={`${op.label} wall offset`}
                      className="flex-1 accent-[#163D32]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((p) => ({
                          ...p,
                          openings: p.openings.filter((x) => x.id !== op.id),
                        }))
                      }
                      aria-label="Remove opening"
                      className="text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Furniture Inspector */}
          {selectedItem && (
            <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'নির্বাচিত আসবাব' : 'Selected Piece'}
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={rotateSelected}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DDF3E5] text-[#163D32] text-xs font-bold"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    aria-label="Remove furniture item"
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={selectedItem.label}
                onChange={(e) => updateSelectedItem({ label: e.target.value })}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-1.5 text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0]">
                    Width ({draft.unit})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0.5}
                    value={selectedItem.w}
                    onChange={(e) => updateSelectedItem({ w: Number(e.target.value) || 1 })}
                    className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#9FC6B0]">
                    Depth ({draft.unit})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0.5}
                    value={selectedItem.h}
                    onChange={(e) => updateSelectedItem({ h: Number(e.target.value) || 1 })}
                    className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#163D32]/70 dark:text-[#9FC6B0] font-mono tabular-nums">
                  X: {selectedItem.x.toFixed(1)} · Y: {selectedItem.y.toFixed(1)} {draft.unit}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateSelectedItem({ x: selectedItem.x - 0.5 })} aria-label="Nudge left" className="p-1.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => updateSelectedItem({ y: selectedItem.y - 0.5 })} aria-label="Nudge up" className="p-1.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => updateSelectedItem({ y: selectedItem.y + 0.5 })} aria-label="Nudge down" className="p-1.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => updateSelectedItem({ x: selectedItem.x + 0.5 })} aria-label="Nudge right" className="p-1.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Interactive 2D Scaled Canvas + AI Layout Optimization */}
        <div className="xl:col-span-8 space-y-5">
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#163D32]/75 dark:text-[#B9D1C3]">
                {isBn
                  ? 'আসবাব ড্র্যাগ করে সরান বা ক্লিক করে মাপ পরিবর্তন করুন।'
                  : 'Drag furniture items directly on the floorplan or click any item to resize and rotate.'}
              </div>

              <div className="flex items-center gap-2">
                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft((p) => ({ ...p, furniture: undoSnapshot }));
                      setUndoSnapshot(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 text-xs font-bold"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পূর্বাবস্থা' : 'Undo AI'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={aiLoading || draft.furniture.length === 0}
                  onClick={handleAiOptimize}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] text-xs font-bold whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  <span>{isBn ? 'AI প্লেসমেন্ট পরামর্শ' : 'Optimize Layout with AI'}</span>
                </button>
              </div>
            </div>

            {/* Interactive SVG Floorplan */}
            <div className="rounded-2xl bg-[#F7F9F6] dark:bg-[#0D1A15] border border-[#163D32]/15 dark:border-[#264638] overflow-hidden">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${vbW} ${vbH}`}
                className="w-full h-auto touch-none select-none"
                onPointerMove={handleSvgPointerMove}
                onPointerUp={() => setDraggingId(null)}
                onPointerLeave={() => setDraggingId(null)}
              >
                {/* Room Interior Surface */}
                <rect
                  x={originX}
                  y={originY}
                  width={roomPxW}
                  height={roomPxH}
                  fill="#FFFFFF"
                  stroke="#163D32"
                  strokeWidth={3}
                />

                {/* Grid Lines */}
                {Array.from({ length: Math.max(0, Math.floor(draft.width) - 1) }).map((_, idx) => (
                  <line
                    key={`gx_${idx}`}
                    x1={originX + (idx + 1) * scale}
                    y1={originY}
                    x2={originX + (idx + 1) * scale}
                    y2={originY + roomPxH}
                    stroke="#163D32"
                    strokeOpacity={0.07}
                  />
                ))}
                {Array.from({ length: Math.max(0, Math.floor(draft.length) - 1) }).map((_, idx) => (
                  <line
                    key={`gy_${idx}`}
                    x1={originX}
                    y1={originY + (idx + 1) * scale}
                    x2={originX + roomPxW}
                    y2={originY + (idx + 1) * scale}
                    stroke="#163D32"
                    strokeOpacity={0.07}
                  />
                ))}

                {/* Outer Dimension Labels */}
                <text
                  x={originX + roomPxW / 2}
                  y={originY - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#163D32"
                >
                  {draft.width} {draft.unit}
                </text>
                <text
                  x={originX - 12}
                  y={originY + roomPxH / 2}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#163D32"
                  transform={`rotate(-90 ${originX - 12} ${originY + roomPxH / 2})`}
                >
                  {draft.length} {draft.unit}
                </text>

                {/* Architectural Openings */}
                {draft.openings.map((op) => {
                  const lenPx = Math.min(roomPxW * 0.6, op.widthUnits * scale);
                  const isHoriz = op.wall === 'north' || op.wall === 'south';
                  const x = isHoriz
                    ? originX + op.offsetRatio * (roomPxW - lenPx)
                    : op.wall === 'west'
                    ? originX - 4
                    : originX + roomPxW - 4;
                  const y = !isHoriz
                    ? originY + op.offsetRatio * (roomPxH - lenPx)
                    : op.wall === 'north'
                    ? originY - 4
                    : originY + roomPxH - 4;
                  return (
                    <g key={op.id}>
                      <rect
                        x={x}
                        y={y}
                        width={isHoriz ? lenPx : 8}
                        height={isHoriz ? 8 : lenPx}
                        rx={3}
                        fill={op.kind === 'door' ? '#E9B95B' : '#38BDF8'}
                      />
                    </g>
                  );
                })}

                {/* Furniture Rectangles */}
                {draft.furniture.map((item) => {
                  const px = originX + item.x * scale;
                  const py = originY + item.y * scale;
                  const pw = item.w * scale;
                  const ph = item.h * scale;
                  const isSelected = item.id === selectedItemId;
                  const preset = FURNITURE_PRESETS.find((p) => p.kind === item.kind);
                  const fill = preset?.color || '#DDF3E5';
                  const isDarkFill = item.kind === 'storage';

                  return (
                    <g
                      key={item.id}
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedItemId(item.id);
                        setDraggingId(item.id);
                      }}
                    >
                      <rect
                        x={px}
                        y={py}
                        width={pw}
                        height={ph}
                        rx={6}
                        fill={fill}
                        stroke={isSelected ? '#E9B95B' : '#163D32'}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      <text
                        x={px + pw / 2}
                        y={py + ph / 2 - 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10.5"
                        fontWeight="700"
                        fill={isDarkFill ? '#FFFFFF' : '#163D32'}
                      >
                        {item.label.slice(0, 16)}
                      </text>
                      <text
                        x={px + pw / 2}
                        y={py + ph / 2 + 11}
                        textAnchor="middle"
                        fontSize="9"
                        fill={isDarkFill ? '#DDF3E5' : '#163D32'}
                        opacity={0.75}
                      >
                        {item.w}×{item.h} {draft.unit}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Walking Clearance & Bottleneck Readout */}
            <div className="space-y-2">
              {metrics.warnings.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#DDF3E5]/60 dark:bg-[#1E3B30] text-[#163D32] dark:text-[#EDF4EF] text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isBn
                      ? 'সব আসবাবের মাঝে পর্যাপ্ত হাঁটার জায়গা ও দরজার ক্লিয়ারেন্স ঠিক আছে।'
                      : 'All pathways and door clearances meet recommended comfort thresholds.'}
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9B95B]/20 border border-[#E9B95B]/45 space-y-1.5">
                  <div className="text-xs font-bold text-[#163D32] dark:text-[#E9B95B] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{isBn ? 'চলাচলের পথ সতর্কতা' : 'Walking Clearance Warnings'}</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-[#163D32]/90 dark:text-[#EDF4EF] space-y-0.5">
                    {metrics.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiResult && (
                <div className="p-4 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] font-mono tabular-nums">
                      Clearance Score: {aiResult.walkingClearanceScore}/100 · Target Utilization:{' '}
                      {aiResult.spaceUtilizationPercent}%
                    </div>
                    {aiResult.recommendedPositions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleApplyAiPositions}
                        className="px-3 py-1.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold"
                      >
                        {isBn ? 'AI অবস্থান প্রয়োগ করুন' : 'Apply AI Positions'}
                      </button>
                    )}
                  </div>
                  {aiResult.placementTips.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-[#163D32]/85 dark:text-[#B9D1C3] space-y-1">
                      {aiResult.placementTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0] pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {isBn
                    ? 'নোট: এই ২ডি প্ল্যানারটি আপনার দেওয়া মাপ ও পরিকল্পনার জন্য তৈরি; এটি লেজার বা LiDAR সার্ভে প্রতিস্থাপন করে না।'
                    : 'Note: Manual room measurements and AI placement estimates are planning aids and not a precision laser or LiDAR architectural survey.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteLayoutId)}
        title={isBn ? 'লেআউট মুছে ফেলবেন?' : 'Delete Room Layout?'}
        description={
          isBn
            ? 'এই ২ডি রুম লেআউটটি স্থায়ীভাবে মুছে যাবে।'
            : 'This 2D room layout plan will be permanently removed.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        destructive={true}
        onCancel={() => setPendingDeleteLayoutId(null)}
        onConfirm={() => {
          if (pendingDeleteLayoutId) {
            onDeleteLayout(pendingDeleteLayoutId);
            handleNewBlankLayout();
          }
          setPendingDeleteLayoutId(null);
        }}
      />
    </div>
  );
};
