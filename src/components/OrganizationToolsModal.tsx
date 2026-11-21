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
    a.href = url;
    a.download = `${(activeRoom?.roomName || 'room-floorplan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAiAutoFloorplan = async () => {
    if (!activeRoom) return;
    setFloorplanLoading(true);
    setFloorplanError(null);
    try {
      const resp = await fetch('/api/generate-floorplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: activeRoom.roomName,
          roomType: activeRoom.roomType,
          layoutAdvice: activeRoom.layoutAdvice,
          detectedItems: activeRoom.detectedItems,
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setFloorplanError(
          isBn ? 'সার্ভার প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' : 'Server is warming up. Please try again in a few seconds.'
        );
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success && Array.isArray(data.zones) && data.zones.length > 0) {
        setZones(data.zones);
        setSelectedZoneId(data.zones[0].id);
        onUpdateFloorplan(data.zones);
        setFloorplanSavedNote(true);
        setTimeout(() => setFloorplanSavedNote(false), 2500);
      } else {
        setFloorplanError(data.details || data.error || 'Failed to generate AI floorplan.');
      }
    } catch (err: any) {
      setFloorplanError(err?.message || 'Error generating AI floorplan.');
    } finally {
      setFloorplanLoading(false);
    }
  };

  const handleGenerateDonationListing = async () => {
    const items = donationItemsInput
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) {
      setDonationError(isBn ? 'অন্তত একটি আইটেমের নাম লিখুন।' : 'Enter at least one item (comma-separated) to generate a listing.');
      return;
    }

    setDonationLoading(true);
    setDonationError(null);
    try {
      const resp = await fetch('/api/donation-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          roomType: activeRoom?.roomType || 'general',
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setDonationError(isBn ? 'সার্ভার প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' : 'Server is warming up. Please try again in a few seconds.');
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success) {
        setDonationResult(data.listing);
      } else {
        setDonationError(data.details || data.error || 'Failed to generate listing.');
      }
    } catch (err: any) {
      setDonationError(err?.message || 'Error contacting server.');
    } finally {
      setDonationLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const resp = await fetch('/api/deep-clean-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: activeRoom?.roomName || 'Home Room Reset',
          roomType: activeRoom?.roomType || 'general',
          clutterScore: activeRoom?.clutterScore ?? 55,
          dailyMinutes,
          problemAreas: activeRoom?.problemAreas.map((p) => p.title) || [],
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setScheduleError(isBn ? 'সার্ভার প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' : 'Server is warming up. Please try again in a few seconds.');
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success && Array.isArray(data.schedule)) {
        setScheduleList(data.schedule);
        if (activeRoom) {
          onUpdateWeeklySchedule(data.schedule);
        }
      } else {
        setScheduleError(data.details || data.error || 'Failed to generate 7-day schedule.');
      }
    } catch (err: any) {
      setScheduleError(err?.message || 'Error generating schedule.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleToggleScheduleDay = (index: number) => {
    const updated = scheduleList.map((d, idx) => (idx === index ? { ...d, completed: !d.completed } : d));
    setScheduleList(updated);
    if (activeRoom) {
      onUpdateWeeklySchedule(updated);
    }
  };

  // Budget Calculations
  const roomStorage = activeRoom?.storageRecommendations || [];
  const storageTotals = roomStorage.reduce(
    (acc, item) => {
      const { min, max } = parseBudgetMidpoint(item.estimatedBudget);
      acc.min += min;
      acc.max += max;
      if (item.acquired) {
        acc.acquiredAvg += (min + max) / 2;
      }
      return acc;
    },
    { min: 0, max: 0, acquiredAvg: 0 }
  );
  const customTotal = customBudgetItems.reduce((s, i) => s + i.cost, 0);
  const customSpent = customBudgetItems.filter((i) => i.bought).reduce((s, i) => s + i.cost, 0);

  // Wizard Logic
  const WIZARD_QUESTIONS = [
    { key: 'broken', q: isBn ? 'এই জিনিসটি কি ভাঙা, মেয়াদোত্তীর্ণ বা ব্যবহারের অযোগ্য?' : 'Is this item broken, expired, stained beyond repair, or missing essential parts?' },
    { key: 'usedRecently', q: isBn ? 'গত ৬ মাসে কি আপনি এটি সত্যিই ব্যবহার করেছেন?' : 'Have you genuinely used or worn it in the past 6 months (or current season)?' },
    { key: 'duplicate', q: isBn ? 'আপনার কাছে কি একই কাজের জন্য আরও ভালো কোনো বিকল্প আছে?' : 'Do you already own a better duplicate that serves the exact same purpose?' },
    { key: 'wrongRoom', q: isBn ? 'এটি কি আসলে অন্য কোনো রুম বা স্টোরেজের জিনিস?' : 'Does it belong in a completely different room or storage closet?' },
    { key: 'sentimental', q: isBn ? 'এটি ফেলে দিলে কি নতুন কিনতে বড় খরচ হবে বা এটি কি খুব স্মৃতিময়?' : 'Would replacing it cost significant money/effort or hold strong personal value?' },
  ];

  const getWizardVerdict = () => {
    if (wizardAnswers.broken) {
      return {
        decision: isBn ? 'রিসাইকেল / ফেলে দিন' : 'Trash / Recycle',
        color: 'text-rose-600 dark:text-rose-400',
        reason: isBn
          ? 'ভাঙা বা মেয়াদোত্তীর্ণ জিনিস জায়গা নষ্ট করে এবং অস্থিরতা তৈরি করে। আজই রিসাইকেল বা ফেলে দিন।'
          : 'Broken or expired items drain space and mental energy. Recycle or discard responsibly today.',
      };
    }
    if (wizardAnswers.duplicate) {
      return {
        decision: isBn ? 'দান / বিক্রি করুন' : 'Donate / Sell',
        color: 'text-cyan-600 dark:text-cyan-400',
        reason: isBn
          ? 'সেরা সংস্করণটি নিজের কাছে রাখুন এবং অতিরিক্তটি দান বা বিক্রি করে দিন।'
          : 'Keep your best version and donate or resell the extra duplicate so someone else can use it.',
      };
    }
    if (wizardAnswers.wrongRoom) {
      return {
        decision: isBn ? 'সঠিক রুমে সরান' : 'Relocate',
        color: 'text-amber-600 dark:text-amber-400',
        reason: isBn
          ? 'জিনিসটি দরকারি, শুধু ভুল জায়গায় আছে। এখনই এটির নির্দিষ্ট রুমে রেখে আসুন।'
          : 'It may be useful, just out of place. Move it immediately to its true home zone.',
      };
    }
    if (wizardAnswers.usedRecently || wizardAnswers.sentimental) {
      return {
        decision: isBn ? 'রাখুন' : 'Keep',
        color: 'text-emerald-600 dark:text-emerald-400',
        reason: isBn
          ? 'এটি নিয়মিত কাজে লাগে বা মূল্যবান। এর জন্য একটি নির্দিষ্ট বক্স বা তাক ঠিক করে রাখুন।'
          : 'It actively serves your life or holds real value. Assign it a clear bin or shelf spot.',
      };
    }
    return {
      decision: isBn ? 'দান / ছেড়ে দিন' : 'Donate / Let Go',
      color: 'text-cyan-600 dark:text-cyan-400',
      reason: isBn
        ? '৬+ মাস অব্যবহৃত থাকলে তা দান করে রুমের জায়গা খালি করাই সবচেয়ে ভালো।'
        : 'Unused for 6+ months with low replacement urgency—donating it frees up immediate breathing room.',
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#163D32]/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-5xl bg-white border border-[#163D32]/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#163D32] text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base sm:text-lg truncate">
              {isBn ? 'হোম অর্গানাইজেশন পাওয়ার টুলস' : 'Home Organization Power Tools'}
            </h3>
            <p className="text-xs text-[#DDF3E5]/85 truncate">
              {activeRoom
                ? `${isBn ? 'সক্রিয় রুম' : 'Active Room'}: ${activeRoom.roomName}`
                : isBn
                ? 'অ্যানালিটিক্স, ২ডি ফ্লোরপ্ল্যান ও প্ল্যানিং স্টুডিও'
                : 'Cross-Room Analytics, 2D Floorplan & Planning Studio'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tools"
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/15 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-[#F7F9F6] border-b border-[#163D32]/10 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {[
            { id: 'analytics', label: isBn ? 'অ্যানালিটিক্স' : 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'floorplan', label: isBn ? '২ডি জোন প্ল্যানার' : '2D Zone Planner', icon: <LayoutGrid className="w-4 h-4" /> },
            { id: 'seasonal', label: isBn ? 'সিজনাল ও মুভিং' : 'Seasonal & Moving', icon: <ClipboardList className="w-4 h-4" /> },
            { id: 'labels', label: isBn ? 'বিন লেবেল স্টুডিও' : 'Bin Label Studio', icon: <Tag className="w-4 h-4" /> },
            { id: 'donation', label: isBn ? 'ডোনেশন লিস্টিং' : 'Donation & Resale', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'schedule', label: isBn ? '৭ দিনের রিসেট' : '7-Day Reset Plan', icon: <CalendarDays className="w-4 h-4" /> },
            { id: 'budget', label: isBn ? 'স্টোরেজ বাজেট' : 'Storage Budget', icon: <Wallet className="w-4 h-4" /> },
            { id: 'wizard', label: isBn ? 'রাখব না ছাড়ব' : 'Keep or Toss', icon: <HelpCircle className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as OrganizationToolTab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                activeTab === tab.id
                  ? 'bg-[#163D32] border-[#163D32] text-white'
                  : 'bg-white hover:bg-[#DDF3E5] border-[#163D32]/10 text-[#163D32]/80'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. ANALYTICS DASHBOARD */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">{isBn ? 'ট্র্যাক করা রুম' : 'Tracked Rooms'}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{analytics.totalRooms}</div>
                  <div className="text-xs text-slate-500 mt-1">{isBn ? 'সক্রিয় + সেভ করা রুম' : 'Active + Saved library'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">{isBn ? 'গড় বিশৃঙ্খলা স্কোর' : 'Avg. Clutter Score'}</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    {analytics.avgCurrent}/100
                  </div>
                  <div className="text-xs text-slate-500 mt-1 tabular-nums">
                    {analytics.improvement > 0 ? `-${analytics.improvement} pts improved` : isBn ? 'কম স্কোর = বেশি পরিচ্ছন্ন' : 'Lower score = cleaner'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">{isBn ? 'সম্পন্ন কাজ' : 'Tasks Completed'}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    {analytics.doneSteps}/{analytics.totalSteps}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 tabular-nums">
                    {analytics.totalSteps > 0
                      ? `${Math.round((analytics.doneSteps / analytics.totalSteps) * 100)}% completion rate`
                      : isBn ? 'এখনও কোনো কাজ নেই' : 'No tasks yet'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">{isBn ? 'ফোকাস স্প্রিন্ট সময়' : 'Focus Sprint Time'}</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{focusMinutesTotal}m</div>
                  <div className="text-xs text-slate-500 mt-1">{isBn ? 'মোট সম্পন্ন টাইমার' : 'Logged sprint sessions'}</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  {isBn ? 'সব রুমের আইটেম বাছাইয়ের হিসাব' : 'Triage Distribution Across Rooms'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{isBn ? 'রাখুন' : 'Keep'}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {analytics.triageCounts.keep}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">{isBn ? 'দান / বিক্রি' : 'Donate / Sell'}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {analytics.triageCounts.donate}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{isBn ? 'জায়গা বদলান' : 'Relocate'}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {analytics.triageCounts.relocate}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{isBn ? 'ফেলে দিন' : 'Trash / Recycle'}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {analytics.triageCounts.trash}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {analytics.triageCounts.sorted} of {analytics.triageCounts.total} triaged items physically sorted.
                </p>
              </div>

              {/* Organizer Tier Card */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                      {isBn ? 'অর্গানাইজার লেভেল' : 'Organizer Rank'}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {analytics.doneSteps + focusMinutesTotal >= 30
                        ? isBn ? 'ক্লাটার মাস্টার' : 'Clutter Conqueror'
                        : analytics.doneSteps + focusMinutesTotal >= 10
                        ? isBn ? 'জোন বিশেষজ্ঞ' : 'Zone Strategist'
                        : isBn ? 'স্টার্টার অর্গানাইজার' : 'Starter Organizer'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {analytics.doneSteps} {isBn ? 'টি ধাপ সম্পন্ন' : 'steps'} · {focusMinutesTotal}m {isBn ? 'ফোকাস' : 'focus'}
                </div>
              </div>
            </div>
          )}

          {/* 2. 2D ROOM ZONE FLOORPLAN PLANNER */}
          {activeTab === 'floorplan' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {isBn ? 'ইন্টারেক্টিভ ২ডি রুম জোন ব্লুপ্রিন্ট' : 'Interactive 2D Room Zone Blueprint'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
                    Clear Floor Ratio: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{clearFloorRatio}%</span> · Click a zone block to move or resize
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZones(ROOM_PRESETS.home_office)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Office Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setZones(ROOM_PRESETS.bedroom)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Bedroom Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setZones(ROOM_PRESETS.living_room)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Living Preset
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFloorplanSvg}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>SVG</span>
                  </button>
                  {activeRoom && (
                    <>
                      <button
                        type="button"
                        disabled={floorplanLoading}
                        onClick={handleAiAutoFloorplan}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 transition-colors"
                      >
                        {floorplanLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isBn ? 'AI অটো-লেআউট' : 'AI Auto-Layout'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateFloorplan(zones);
                          setFloorplanSavedNote(true);
                          setTimeout(() => setFloorplanSavedNote(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{floorplanSavedNote ? (isBn ? 'সেভ হয়েছে!' : 'Saved!') : (isBn ? 'প্ল্যানে সেভ করুন' : 'Save to Plan')}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {floorplanError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{floorplanError}</p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 12x8 Grid Canvas (intentionally dark blueprint surface for high-contrast zone visibility) */}
                <div className="lg:col-span-8 bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 overflow-x-auto">
                  <svg viewBox="0 0 720 480" className="w-full h-auto rounded-xl bg-slate-950 select-none">
                    {Array.from({ length: 13 }).map((_, i) => (
                      <line
                        key={`vx-${i}`}
                        x1={i * 60}
                        y1={0}
                        x2={i * 60}
                        y2={480}
                        stroke="#1e293b"
                        strokeWidth="1"
                      />
                    ))}
                    {Array.from({ length: 9 }).map((_, i) => (
                      <line
                        key={`hz-${i}`}
                        x1={0}
                        y1={i * 60}
                        x2={720}
                        y2={i * 60}
                        stroke="#1e293b"
                        strokeWidth="1"
                      />
                    ))}

                    {zones.map((z) => {
                      const meta = ZONE_META[z.kind];
                      const isSelected = z.id === selectedZoneId;
                      return (
                        <g
                          key={z.id}
                          onClick={() => setSelectedZoneId(z.id)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={z.x * 60 + 2}
                            y={z.y * 60 + 2}
                            width={z.w * 60 - 4}
                            height={z.h * 60 - 4}
                            rx={10}
                            fill={meta.fill}
                            stroke={isSelected ? '#ffffff' : meta.stroke}
                            strokeWidth={isSelected ? 3 : 1.75}
                          />
                          <text
                            x={z.x * 60 + (z.w * 60) / 2}
                            y={z.y * 60 + (z.h * 60) / 2}
                            fill={meta.text}
                            fontSize="13"
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {z.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Controls Column */}
                <div className="lg:col-span-4 space-y-4">
                  <form onSubmit={handleAddZone} className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add Zone Block</h5>
                    <input
                      type="text"
                      value={newZoneLabel}
                      onChange={(e) => setNewZoneLabel(e.target.value)}
                      placeholder="Label (e.g. Shoe Rack)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <select
                      value={newZoneKind}
                      onChange={(e) => setNewZoneKind(e.target.value as FloorplanZoneKind)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                    >
                      {Object.entries(ZONE_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={zones.length >= 20}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Zone ({zones.length}/20)</span>
                    </button>
                  </form>

                  {selectedZone && (
                    <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          Selected: {selectedZone.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setZones((prev) => prev.filter((z) => z.id !== selectedZone.id));
                            setSelectedZoneId(null);
                          }}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-1"
                          title="Delete Zone"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedZone.label}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 40);
                            setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, label: val } : z)));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                          placeholder="Zone label"
                        />
                        <select
                          value={selectedZone.kind}
                          onChange={(e) => {
                            const nextKind = e.target.value as FloorplanZoneKind;
                            setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? { ...z, kind: nextKind } : z)));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none"
                        >
                          {Object.entries(ZONE_META).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-xs text-slate-600 dark:text-slate-400 block">Move</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveSelectedZone(-1, 0)} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => moveSelectedZone(0, -1)} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => moveSelectedZone(0, 1)} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => moveSelectedZone(1, 0)} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowRight className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs text-slate-600 dark:text-slate-400 block">Resize (W × H)</span>
                          <div className="flex items-center gap-1 text-xs">
                            <button type="button" onClick={() => resizeSelectedZone(-1, 0)} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200">W-</button>
                            <button type="button" onClick={() => resizeSelectedZone(1, 0)} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200">W+</button>
                            <button type="button" onClick={() => resizeSelectedZone(0, -1)} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200">H-</button>
                            <button type="button" onClick={() => resizeSelectedZone(0, 1)} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200">H+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. DONATION & BOX LABEL GENERATOR */}
          {activeTab === 'donation' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {isBn ? 'এআই ডোনেশন, রিসেল লিস্টিং ও বক্স লেবেল' : 'AI Donation, Resale Listing & Box Labels'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {isBn
                    ? 'অপ্রয়োজনীয় জিনিসগুলো মার্কেটপ্লেসে দেওয়ার জন্য বিবরণ ও বক্স লেবেল তৈরি করুন।'
                    : 'Turn your unwanted items into a ready-to-post marketplace bundle and printable box labels.'}
                </p>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={donationItemsInput}
                  onChange={(e) => setDonationItemsInput(e.target.value)}
                  placeholder="Enter items to donate or sell (e.g. Spare desk lamp, 3 ceramic mugs, old router, winter jacket)..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none"
                />

                {donationError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{donationError}</p>
                )}

                <button
                  type="button"
                  disabled={donationLoading}
                  onClick={handleGenerateDonationListing}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  {donationLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{donationLoading ? 'Generating Listing...' : 'Generate Listing & Box Labels'}</span>
                </button>
              </div>

              {donationResult && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          {donationResult.suggestedPrice} · {donationResult.condition}
                        </div>
                        <h5 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{donationResult.title}</h5>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            `${donationResult.title}\nPrice: ${donationResult.suggestedPrice}\nCondition: ${donationResult.condition}\n\n${donationResult.description}`
                          );
                          setCopiedListing(true);
                          setTimeout(() => setCopiedListing(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0"
                      >
                        {copiedListing ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedListing ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {donationResult.description}
                    </p>
                    {donationResult.packingTips.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Packing Tips</span>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                          {donationResult.packingTips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Printable Box & Bin Labels</h5>
                    <div className="space-y-2">
                      {donationResult.boxLabels.map((lbl, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-200"
                        >
                          {lbl}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. 7-DAY ROOM RESET PLANNER */}
          {activeTab === 'schedule' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {isBn ? 'এআই ৭ দিনের রুম রিসেট সিডিউল' : 'AI 7-Day Room Reset Schedule'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {isBn
                      ? 'প্রতিদিন মাত্র কয়েক মিনিটে ধাপে ধাপে পুরো রুম গুছিয়ে ফেলুন।'
                      : 'Break down your organization into sustainable daily micro-sessions.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                    {[10, 15, 30, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDailyMinutes(mins)}
                        className={`px-2.5 py-1 rounded-lg font-medium tabular-nums ${
                          dailyMinutes === mins
                            ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {mins}m/day
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={scheduleLoading}
                    onClick={handleGenerateSchedule}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    {scheduleLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{scheduleLoading ? 'Building...' : 'Generate 7-Day Plan'}</span>
                  </button>
                </div>
              </div>

              {scheduleError && <p className="text-xs text-rose-600 dark:text-rose-400">{scheduleError}</p>}

              {scheduleList.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-400 text-sm">
                  Select your daily time budget above and click &ldquo;Generate 7-Day Plan&rdquo; to build a custom week-long routine.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {scheduleList.map((day, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleScheduleDay(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleScheduleDay(idx);
                        }
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-colors space-y-2 ${
                        day.completed
                          ? 'bg-emerald-50/50 dark:bg-slate-950/40 border-emerald-300 dark:border-emerald-800/60 opacity-75'
                          : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {day.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          )}
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{day.day}</span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{day.focus}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">{day.durationMinutes}m</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-6 list-disc">
                        {day.tasks.map((t, ti) => (
                          <li key={ti}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. STORAGE BUDGET CALCULATOR */}
          {activeTab === 'budget' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Est. Room Storage Total</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    ${Math.round(storageTotals.min + customTotal)} – ${Math.round(storageTotals.max + customTotal)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Already Acquired</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    ~${Math.round(storageTotals.acquiredAvg + customSpent)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Items Remaining</div>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                    {roomStorage.filter((s) => !s.acquired).length + customBudgetItems.filter((i) => !i.bought).length}
                  </div>
                </div>
              </div>

              {roomStorage.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400">AI Suggested Items (Click to mark acquired)</h5>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    {roomStorage.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onToggleStorageItem && onToggleStorageItem(idx)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.acquired ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          )}
                          <span className={`text-xs sm:text-sm truncate ${item.acquired ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.itemTitle}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 shrink-0 tabular-nums">
                          {item.estimatedBudget}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!budgetTitle.trim()) return;
                  setCustomBudgetItems((prev) => [
                    ...prev,
                    {
                      id: `cb_${Date.now()}`,
                      title: budgetTitle.trim(),
                      cost: Math.max(0, Number(budgetCost) || 0),
                      bought: false,
                    },
                  ]);
                  setBudgetTitle('');
                }}
                className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 block">Add Custom Storage Purchase</label>
                  <input
                    type="text"
                    value={budgetTitle}
                    onChange={(e) => setBudgetTitle(e.target.value)}
                    placeholder="e.g. Clear drawer divider set"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 block">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={budgetCost}
                    onChange={(e) => setBudgetCost(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none tabular-nums"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 font-semibold text-xs rounded-xl"
                  >
                    Add Item
                  </button>
                </div>
              </form>

              {customBudgetItems.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {customBudgetItems.map((ci) => (
                    <div key={ci.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCustomBudgetItems((prev) =>
                            prev.map((x) => (x.id === ci.id ? { ...x, bought: !x.bought } : x))
                          )
                        }
                        className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                      >
                        {ci.bought ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                        <span className={`text-xs sm:text-sm truncate ${ci.bought ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                          {ci.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">${ci.cost}</span>
                        <button
                          type="button"
                          onClick={() => setCustomBudgetItems((prev) => prev.filter((x) => x.id !== ci.id))}
                          className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. KEEP OR TOSS DECISION WIZARD */}
          {activeTab === 'wizard' && (
            <div className="max-w-xl mx-auto space-y-5 py-2">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {isBn ? 'সহজ "রাখব নাকি ছাড়ব" ডিসিশন উইজার্ড' : 'Quick "Keep or Toss" Decision Wizard'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isBn
                    ? 'কোনো জিনিস নিয়ে দ্বিধায় থাকলে ৫টি ছোট প্রশ্নের উত্তর দিয়ে সঠিক সিদ্ধান্ত নিন।'
                    : "Stuck holding an item you aren't sure about? Answer 5 rapid questions for an objective recommendation."}
                </p>
              </div>

              <input
                type="text"
                value={wizardItemName}
                onChange={(e) => setWizardItemName(e.target.value)}
                placeholder="What item are you holding? (optional, e.g. Old printer cables)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none"
              />

              {wizardStep < WIZARD_QUESTIONS.length ? (
                <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    Question {wizardStep + 1} of {WIZARD_QUESTIONS.length}
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {WIZARD_QUESTIONS[wizardStep].q}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const key = WIZARD_QUESTIONS[wizardStep].key;
                        setWizardAnswers((prev) => ({ ...prev, [key]: true }));
                        setWizardStep((s) => s + 1);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 font-bold text-sm"
                    >
                      {isBn ? 'হ্যাঁ' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const key = WIZARD_QUESTIONS[wizardStep].key;
                        setWizardAnswers((prev) => ({ ...prev, [key]: false }));
                        setWizardStep((s) => s + 1);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700"
                    >
                      {isBn ? 'না' : 'No'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Recommendation{wizardItemName ? ` for "${wizardItemName}"` : ''}
                  </div>
                  <div className={`text-2xl font-bold ${getWizardVerdict().color}`}>
                    {getWizardVerdict().decision}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{getWizardVerdict().reason}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep(0);
                      setWizardAnswers({});
                      setWizardItemName('');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isBn ? 'আরেকটি আইটেম যাচাই করুন' : 'Evaluate Another Item'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 7. SEASONAL & MOVING BLITZ CHECKLIST */}
          {activeTab === 'seasonal' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {isBn ? 'সিজনাল, মুভিং ও গেস্ট ব্লিটজ চেকলিস্ট' : 'Seasonal, Moving & Guest Blitz Checklist'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {isBn
                      ? 'বিশেষ পরিস্থিতির জন্য ৬টি ধাপের দ্রুত অ্যাকশন চেকলিস্ট তৈরি করুন এবং আপনার প্ল্যানে যোগ করুন।'
                      : 'Generate a targeted 6-step blitz checklist for special occasions and append it directly to your room plan.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'guest_blitz', label: isBn ? '৩০-মিনিটে অতিথি প্রস্তুতি' : '30-Min Guest Arrival Blitz' },
                  { id: 'moving_pack', label: isBn ? 'বাসা বদল / প্যাকিং' : 'Moving & Packing Prep' },
                  { id: 'monsoon_spring_reset', label: isBn ? 'মৌসুমি ডিপ ক্লিন' : 'Seasonal Deep Reset' },
                  { id: 'wardrobe_swap', label: isBn ? 'কাপড় সিজন পরিবর্তন' : 'Wardrobe Season Swap' },
                  { id: 'desk_exam_sprint', label: isBn ? 'স্টাডি ও ওয়ার্ক ডেস্ক রিসেট' : 'Study / Work Desk Reset' },
                ].map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSeasonalScenario(sc.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      seasonalScenario === sc.id
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={seasonalLoading}
                  onClick={async () => {
                    setSeasonalLoading(true);
                    setSeasonalError(null);
                    setSeasonalAddedNote(false);
                    try {
                      const resp = await fetch('/api/seasonal-checklist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          scenario: seasonalScenario,
                          roomType: activeRoom?.roomType || 'general',
                          roomName: activeRoom?.roomName || 'My Room',
                          language,
                        }),
                      });
                      const text = await resp.text();
                      if (text.trim().startsWith('<')) {
                        setSeasonalError(
                          isBn ? 'সার্ভার প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' : 'Server is warming up. Please try again shortly.'
                        );
                        return;
                      }
                      const data = JSON.parse(text);
                      if (resp.ok && data.success && Array.isArray(data.steps)) {
                        setSeasonalSteps(data.steps);
                      } else {
                        setSeasonalError(data.details || data.error || 'Failed to generate checklist.');
                      }
                    } catch (err: any) {
                      setSeasonalError(err?.message || 'Error contacting server.');
                    } finally {
                      setSeasonalLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5"
                >
                  {seasonalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{seasonalLoading ? (isBn ? 'তৈরি হচ্ছে...' : 'Generating...') : (isBn ? 'চেকলিস্ট তৈরি করুন' : 'Generate Blitz Checklist')}</span>
                </button>

                {activeRoom && seasonalSteps.length > 0 && onAppendStepsToPlan && (
                  <button
                    type="button"
                    onClick={() => {
                      onAppendStepsToPlan(seasonalSteps);
                      setSeasonalAddedNote(true);
                      setTimeout(() => setSeasonalAddedNote(false), 3000);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>
                      {seasonalAddedNote
                        ? isBn ? 'প্ল্যানে যোগ হয়েছে!' : 'Added to Room Plan!'
                        : isBn ? 'সক্রিয় রুমে যোগ করুন' : 'Add Steps to Active Room'}
                    </span>
                  </button>
                )}
              </div>

              {seasonalError && <p className="text-xs text-rose-600 dark:text-rose-400">{seasonalError}</p>}

              {seasonalSteps.length > 0 && (
                <div className="space-y-2.5">
                  {seasonalSteps.map((st, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        setSeasonalSteps((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, completed: !item.completed } : item))
                        )
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSeasonalSteps((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, completed: !item.completed } : item))
                          );
                        }
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer flex items-start gap-3 transition-colors ${
                        st.completed
                          ? 'bg-emerald-50/40 dark:bg-slate-950/40 border-emerald-300 dark:border-emerald-800/60 opacity-70'
                          : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {st.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{st.category}</span>
                          <span className="text-slate-500 tabular-nums">{st.timeEstimate}</span>
                        </div>
                        <div className={`text-sm font-semibold mt-0.5 ${st.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {st.title}
                        </div>
                        {st.tip && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{st.tip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. PRINTABLE BIN & DRAWER LABEL STUDIO */}
          {activeTab === 'labels' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {isBn ? 'প্রিন্টযোগ্য বক্স ও ড্রয়ার লেবেল স্টুডিও' : 'Printable Storage Bin & Drawer Label Studio'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {isBn
                      ? 'আপনার স্টোরেজ বক্স বা ড্রয়ারের জন্য রঙিন লেবেল তৈরি করুন এবং SVG শীট ডাউনলোড করে প্রিন্ট করুন।'
                      : 'Create crisp labels for storage bins, shelves, and moving boxes, then download a printable label sheet.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        const roomTags: BinLabelTag[] = activeRoom.storageRecommendations.slice(0, 4).map((s, idx) => ({
                          id: `room_lbl_${Date.now()}_${idx}`,
                          title: s.category.toUpperCase().slice(0, 24),
                          contents: s.itemTitle.slice(0, 50),
                          accent: idx % 2 === 0 ? 'emerald' : 'cyan',
                        }));
                        setBinLabels((prev) => [...roomTags, ...prev].slice(0, 16));
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      {isBn ? 'রুম থেকে লেবেল নিন' : 'Import from Room'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const cols = 2;
                      const cardW = 340;
                      const cardH = 120;
                      const pad = 20;
                      const rows = Math.max(1, Math.ceil(binLabels.length / cols));
                      const width = cols * cardW + (cols + 1) * pad;
                      const height = rows * cardH + (rows + 1) * pad;
                      const accentColors: Record<BinLabelTag['accent'], string> = {
                        emerald: '#10b981',
                        cyan: '#06b6d4',
                        amber: '#f59e0b',
                        rose: '#f43f5e',
                      };
                      const cards = binLabels
                        .map((lbl, idx) => {
                          const col = idx % cols;
                          const row = Math.floor(idx / cols);
                          const x = pad + col * (cardW + pad);
                          const y = pad + row * (cardH + pad);
                          const color = accentColors[lbl.accent] || '#10b981';
                          const safeTitle = lbl.title.replace(/[<>&]/g, '');
                          const safeContents = lbl.contents.replace(/[<>&]/g, '');
                          return `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="#ffffff" stroke="${color}" stroke-width="3" />
<rect x="${x}" y="${y}" width="12" height="${cardH}" rx="4" fill="${color}" />
<text x="${x + 28}" y="${y + 46}" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="800">${safeTitle}</text>
<text x="${x + 28}" y="${y + 78}" fill="#475569" font-family="sans-serif" font-size="13">${safeContents}</text>`;
                        })
                        .join('\n');
                      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#f8fafc" />
${cards}
</svg>`;
                      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'neatspace-bin-labels.svg';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isBn ? 'লেবেল শীট (SVG)' : 'Download Label Sheet'}</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newBinTitle.trim()) return;
                  setBinLabels((prev) => [
                    {
                      id: `lbl_${Date.now()}`,
                      title: newBinTitle.trim().slice(0, 32).toUpperCase(),
                      contents: newBinContents.trim().slice(0, 70) || 'General Storage',
                      accent: newBinAccent,
                    },
                    ...prev,
                  ].slice(0, 16));
                  setNewBinTitle('');
                  setNewBinContents('');
                }}
                className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 block">Label Title</label>
                  <input
                    type="text"
                    value={newBinTitle}
                    onChange={(e) => setNewBinTitle(e.target.value)}
                    placeholder="e.g. WINTER JACKETS"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 block">Box Contents</label>
                  <input
                    type="text"
                    value={newBinContents}
                    onChange={(e) => setNewBinContents(e.target.value)}
                    placeholder="e.g. Sweaters, Scarves, Gloves"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 block">Color</label>
                  <select
                    value={newBinAccent}
                    onChange={(e) => setNewBinAccent(e.target.value as BinLabelTag['accent'])}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                  >
                    <option value="emerald">Emerald</option>
                    <option value="cyan">Cyan</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-white dark:text-slate-950 font-semibold text-xs rounded-xl"
                  >
                    + Add
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {binLabels.map((lbl) => {
                  const borderMap: Record<BinLabelTag['accent'], string> = {
                    emerald: 'border-l-emerald-500',
                    cyan: 'border-l-cyan-500',
                    amber: 'border-l-amber-500',
                    rose: 'border-l-rose-500',
                  };
                  return (
                    <div
                      key={lbl.id}
                      className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 border-l-4 ${borderMap[lbl.accent]} rounded-2xl p-4 flex items-start justify-between gap-3 shadow-xs`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tracking-wide truncate">
                          {lbl.title}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                          {lbl.contents}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBinLabels((prev) => prev.filter((x) => x.id !== lbl.id))}
                        className="text-slate-400 hover:text-rose-500 p-1 shrink-0"
                        aria-label="Delete label"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
