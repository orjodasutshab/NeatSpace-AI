import React, { useState, useEffect, useMemo } from 'react';
import {
  RoomAnalysis,
  FloorplanZone,
  FloorplanZoneKind,
  WeeklyScheduleDay,
  DonationListingResult,
  SeasonalChecklistItem,
  BinLabelTag,
  OutputLanguage,
} from '../types';
import {
  X,
  BarChart3,
  LayoutGrid,
  Tag,
  CalendarDays,
  Wallet,
  HelpCircle,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Save,
  ClipboardList,
  BookmarkPlus,
  Award,
} from 'lucide-react';

export type OrganizationToolTab =
  | 'analytics'
  | 'floorplan'
  | 'donation'
  | 'schedule'
  | 'seasonal'
  | 'labels'
  | 'budget'
  | 'wizard';

interface OrganizationToolsModalProps {
  isOpen: boolean;
  initialTab?: OrganizationToolTab;
  onClose: () => void;
  activeRoom: RoomAnalysis | null;
  savedRooms: RoomAnalysis[];
  focusMinutesTotal: number;
  language: OutputLanguage;
  onUpdateFloorplan: (zones: FloorplanZone[]) => void;
  onUpdateWeeklySchedule: (schedule: WeeklyScheduleDay[]) => void;
  onToggleStorageItem?: (index: number) => void;
  onAppendStepsToPlan?: (steps: SeasonalChecklistItem[]) => void;
}

const ZONE_META: Record<
  FloorplanZoneKind,
  { label: string; fill: string; stroke: string; text: string }
> = {
  desk: { label: 'Desk / Work', fill: '#0f2922', stroke: '#34d399', text: '#6ee7b7' },
  bed: { label: 'Bed / Rest', fill: '#172554', stroke: '#60a5fa', text: '#93c5fd' },
  storage: { label: 'Storage / Shelf', fill: '#272011', stroke: '#fbbf24', text: '#fcd34d' },
  seating: { label: 'Seating / Lounge', fill: '#231736', stroke: '#c084fc', text: '#d8b4fe' },
  pathway: { label: 'Clear Walkway', fill: '#0b252a', stroke: '#22d3ee', text: '#67e8f9' },
  dropzone: { label: 'Donation / Drop', fill: '#2c131d', stroke: '#fb7185', text: '#fda4af' },
};

const DEFAULT_FLOORPLAN: FloorplanZone[] = [
  { id: 'z1', label: 'Primary Desk', kind: 'desk', x: 1, y: 1, w: 4, h: 2 },
  { id: 'z2', label: 'Shelving Unit', kind: 'storage', x: 8, y: 1, w: 3, h: 2 },
  { id: 'z3', label: 'Clear Walkway', kind: 'pathway', x: 5, y: 0, w: 2, h: 7 },
  { id: 'z4', label: 'Donation Box', kind: 'dropzone', x: 1, y: 5, w: 2, h: 2 },
];

const ROOM_PRESETS: Record<string, FloorplanZone[]> = {
  home_office: [
    { id: 'ho1', label: 'Workstation', kind: 'desk', x: 1, y: 1, w: 4, h: 2 },
    { id: 'ho2', label: 'Bookcase', kind: 'storage', x: 8, y: 1, w: 3, h: 2 },
    { id: 'ho3', label: 'Chair Zone', kind: 'seating', x: 2, y: 3, w: 2, h: 2 },
    { id: 'ho4', label: 'Clear Walkway', kind: 'pathway', x: 5, y: 0, w: 2, h: 8 },
    { id: 'ho5', label: 'Inbox / Drop', kind: 'dropzone', x: 9, y: 5, w: 2, h: 2 },
  ],
  bedroom: [
    { id: 'bd1', label: 'Bed', kind: 'bed', x: 3, y: 1, w: 5, h: 4 },
    { id: 'bd2', label: 'Wardrobe', kind: 'storage', x: 0, y: 1, w: 2, h: 5 },
    { id: 'bd3', label: 'Nightstand', kind: 'desk', x: 9, y: 1, w: 2, h: 2 },
    { id: 'bd4', label: 'Clear Path', kind: 'pathway', x: 2, y: 5, w: 8, h: 2 },
  ],
  living_room: [
    { id: 'lr1', label: 'Sofa Seating', kind: 'seating', x: 2, y: 1, w: 6, h: 2 },
    { id: 'lr2', label: 'Media Console', kind: 'storage', x: 3, y: 6, w: 5, h: 2 },
    { id: 'lr3', label: 'Reading Chair', kind: 'seating', x: 9, y: 2, w: 2, h: 2 },
    { id: 'lr4', label: 'Clear Flow', kind: 'pathway', x: 2, y: 3, w: 7, h: 3 },
  ],
};

function parseBudgetMidpoint(raw: string): { min: number; max: number } {
  const nums = (raw || '').match(/\d+(\.\d+)?/g)?.map(Number) || [];
  if (nums.length === 0) return { min: 15, max: 25 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

export const OrganizationToolsModal: React.FC<OrganizationToolsModalProps> = ({
  isOpen,
  initialTab = 'analytics',
  onClose,
  activeRoom,
  savedRooms,
  focusMinutesTotal,
  language,
  onUpdateFloorplan,
  onUpdateWeeklySchedule,
  onToggleStorageItem,
  onAppendStepsToPlan,
}) => {
  const [activeTab, setActiveTab] = useState<OrganizationToolTab>(initialTab);
  const isBn = language === 'bn';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // 2D Floorplan State
  const [zones, setZones] = useState<FloorplanZone[]>(
    activeRoom?.floorplanZones && activeRoom.floorplanZones.length > 0
      ? activeRoom.floorplanZones
      : DEFAULT_FLOORPLAN
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id || null);
  const [newZoneLabel, setNewZoneLabel] = useState('');
  const [newZoneKind, setNewZoneKind] = useState<FloorplanZoneKind>('storage');
  const [floorplanSavedNote, setFloorplanSavedNote] = useState(false);
  const [floorplanLoading, setFloorplanLoading] = useState(false);
  const [floorplanError, setFloorplanError] = useState<string | null>(null);

  useEffect(() => {
    if (activeRoom?.floorplanZones && activeRoom.floorplanZones.length > 0) {
      setZones(activeRoom.floorplanZones);
      setSelectedZoneId(activeRoom.floorplanZones[0]?.id || null);
    }
  }, [activeRoom?.id, activeRoom?.floorplanZones]);

  // Donation & Box Label Generator State
  const [donationItemsInput, setDonationItemsInput] = useState('');
  const [donationLoading, setDonationLoading] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [donationResult, setDonationResult] = useState<DonationListingResult | null>(null);
  const [copiedListing, setCopiedListing] = useState(false);

  useEffect(() => {
    if (activeRoom?.triageItems && activeRoom.triageItems.length > 0) {
      const candidates = activeRoom.triageItems
        .filter((t) => t.decision === 'donate' || t.decision === 'relocate')
        .map((t) => t.item);
      if (candidates.length > 0) {
        setDonationItemsInput(candidates.join(', '));
      }
    }
  }, [activeRoom?.id, activeRoom?.triageItems]);

  // 7-Day Reset Planner State
  const [dailyMinutes, setDailyMinutes] = useState<number>(15);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleList, setScheduleList] = useState<WeeklyScheduleDay[]>(
    activeRoom?.weeklySchedule || []
  );

  useEffect(() => {
    setScheduleList(activeRoom?.weeklySchedule || []);
  }, [activeRoom?.id, activeRoom?.weeklySchedule]);

  // Custom Budget Item State
  const [customBudgetItems, setCustomBudgetItems] = useState<
    Array<{ id: string; title: string; cost: number; bought: boolean }>
  >([]);
  const [budgetTitle, setBudgetTitle] = useState('');
  const [budgetCost, setBudgetCost] = useState('15');

  // Keep or Toss Wizard State
  const [wizardItemName, setWizardItemName] = useState('');
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, boolean>>({});

  // Seasonal & Moving Blitz Checklist State
  const [seasonalScenario, setSeasonalScenario] = useState('guest_blitz');
  const [seasonalLoading, setSeasonalLoading] = useState(false);
  const [seasonalError, setSeasonalError] = useState<string | null>(null);
  const [seasonalSteps, setSeasonalSteps] = useState<SeasonalChecklistItem[]>([]);
  const [seasonalAddedNote, setSeasonalAddedNote] = useState(false);

  // Printable Bin & Drawer Label Studio State
  const [binLabels, setBinLabels] = useState<BinLabelTag[]>(() => {
    try {
      const saved = localStorage.getItem('neatspace_bin_labels');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { id: 'lbl_1', title: 'CABLES & CHARGERS', contents: 'USB-C, HDMI, Power Banks', accent: 'cyan' },
      { id: 'lbl_2', title: 'DONATE BOX', contents: 'Clothes, Books, Spare Mugs', accent: 'amber' },
      { id: 'lbl_3', title: 'IMPORTANT DOCS', contents: 'Receipts, IDs, Warranty', accent: 'emerald' },
    ];
  });
  const [newBinTitle, setNewBinTitle] = useState('');
  const [newBinContents, setNewBinContents] = useState('');
  const [newBinAccent, setNewBinAccent] = useState<BinLabelTag['accent']>('emerald');

  useEffect(() => {
    try {
      localStorage.setItem('neatspace_bin_labels', JSON.stringify(binLabels));
    } catch {
      // ignore
    }
  }, [binLabels]);

  // Cross-room Analytics Memo
  const analytics = useMemo(() => {
    const rooms = [...savedRooms];
    if (activeRoom && !rooms.some((r) => r.id === activeRoom.id)) {
      rooms.unshift(activeRoom);
    }
    const totalRooms = rooms.length;
    const avgBefore =
      totalRooms > 0
        ? Math.round(rooms.reduce((s, r) => s + r.clutterScore, 0) / totalRooms)
        : 0;
    const avgCurrent =
      totalRooms > 0
        ? Math.round(
            rooms.reduce(
              (s, r) => s + (typeof r.afterClutterScore === 'number' ? r.afterClutterScore : r.clutterScore),
              0
            ) / totalRooms
          )
        : 0;
    const totalSteps = rooms.reduce((s, r) => s + r.actionPlan.length, 0);
    const doneSteps = rooms.reduce((s, r) => s + r.actionPlan.filter((st) => st.completed).length, 0);

    const triageCounts = { keep: 0, donate: 0, relocate: 0, trash: 0, sorted: 0, total: 0 };
    rooms.forEach((r) => {
      (r.triageItems || []).forEach((t) => {
        triageCounts[t.decision] += 1;
        triageCounts.total += 1;
        if (t.sorted) triageCounts.sorted += 1;
      });
    });

    return {
      totalRooms,
      avgBefore,
      avgCurrent,
      improvement: Math.max(0, avgBefore - avgCurrent),
      totalSteps,
      doneSteps,
      triageCounts,
    };
  }, [savedRooms, activeRoom]);

  // Floorplan metrics
  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;
  const totalGridCells = 12 * 8;
  const occupiedCells = zones
    .filter((z) => z.kind !== 'pathway')
    .reduce((acc, z) => acc + z.w * z.h, 0);
  const clearFloorRatio = Math.max(0, Math.min(100, Math.round(((totalGridCells - occupiedCells) / totalGridCells) * 100)));

  if (!isOpen) return null;

  const moveSelectedZone = (dx: number, dy: number) => {
    if (!selectedZoneId) return;
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        const nx = Math.max(0, Math.min(12 - z.w, z.x + dx));
        const ny = Math.max(0, Math.min(8 - z.h, z.y + dy));
        return { ...z, x: nx, y: ny };
      })
    );
  };

  const resizeSelectedZone = (dw: number, dh: number) => {
    if (!selectedZoneId) return;
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        const nw = Math.max(1, Math.min(12 - z.x, Math.min(6, z.w + dw)));
        const nh = Math.max(1, Math.min(8 - z.y, Math.min(6, z.h + dh)));
        return { ...z, w: nw, h: nh };
      })
    );
  };

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (zones.length >= 20) return;
    const label = newZoneLabel.trim() || ZONE_META[newZoneKind].label;
    const newZone: FloorplanZone = {
      id: `z_${Date.now()}`,
      label: label.slice(0, 40),
      kind: newZoneKind,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    };
    setZones((prev) => [...prev, newZone]);
    setSelectedZoneId(newZone.id);
    setNewZoneLabel('');
  };

  const handleExportFloorplanSvg = () => {
    const cell = 60;
    const width = 12 * cell;
    const height = 8 * cell;
    const rects = zones
      .map((z) => {
        const meta = ZONE_META[z.kind];
        return `<rect x="${z.x * cell}" y="${z.y * cell}" width="${z.w * cell}" height="${z.h * cell}" rx="8" fill="${meta.fill}" stroke="${meta.stroke}" stroke-width="2" />
<text x="${z.x * cell + (z.w * cell) / 2}" y="${z.y * cell + (z.h * cell) / 2}" fill="${meta.text}" font-family="sans-serif" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="middle">${z.label.replace(/[<>&]/g, '')}</text>`;
      })
      .join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#020617" />
${rects}
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
