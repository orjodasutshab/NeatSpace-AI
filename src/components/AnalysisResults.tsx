import React, { useState, useEffect, useRef } from 'react';
import {
  RoomAnalysis,
  ActionStep,
  TriageDecision,
  OutputLanguage,
  DiySubstitute,
  FamilyMember,
  TaskPriority,
} from '../types';
import { getUILabels } from '../i18n';
import { exportRoomPlanToPdf } from '../utils/pdfExport';
import { OrganizationToolTab } from './OrganizationToolsModal';
import {
  AlertTriangle,
  CheckSquare,
  Square,
  Clock,
  Package,
  Lightbulb,
  Compass,
  Zap,
  Layers,
  BookmarkCheck,
  MessageSquare,
  CheckCircle2,
  ListTodo,
  Copy,
  Check,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Camera,
  Loader2,
  TrendingDown,
  FileDown,
  Printer,
  Plus,
  Repeat,
  StickyNote,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
  Trash2,
  Tag,
  LayoutGrid,
  CalendarDays,
  Target,
  EyeOff,
  Eye,
  Sparkles,
  ScanSearch,
  Wand2,
  Columns2,
  SlidersHorizontal,
  Palette,
  Maximize2,
  Recycle,
  Shuffle,
  Armchair,
  Pencil,
  X,
} from 'lucide-react';

interface AnalysisResultsProps {
  analysis: RoomAnalysis;
  language: OutputLanguage;
  familyMembers?: FamilyMember[];
  onAssignMember?: (roomId: string, memberId: string) => void;
  onToggleStep: (stepNumber: number) => void;
  onToggleAllSteps: (completed: boolean) => void;
  onAddCustomStep: (
    title: string,
    category: ActionStep['category'],
    timeEstimate: string,
    priority?: TaskPriority
  ) => void;
  onEditStep?: (stepNumber: number, updates: Partial<ActionStep>) => void;
  onDeleteStep: (stepNumber: number) => void;
  onMoveStep: (stepNumber: number, direction: 'up' | 'down') => void;
  onUpdateTriageItem: (id: string, updates: { decision?: TriageDecision; sorted?: boolean }) => void;
  onAddTriageItem: (item: string, decision: TriageDecision, reason: string) => void;
  onToggleStorageItem: (index: number) => void;
  onSaveNotes: (notes: string) => void;
  onSaveRoom: () => void;
  isSaved: boolean;
  onOpenCoachWithContext: () => void;
  onOpenRedesignStudio: () => void;
  onOpenToolsTab: (tab: OrganizationToolTab) => void;
  onCompareAfterPhoto: (afterDataUrl: string) => Promise<void>;
  isComparingAfter: boolean;
  onLogFocusMinutes: (minutes: number) => void;
  canExportPdf?: boolean;
  maxUploadMb?: number;
  onOpenPricing?: () => void;
}

const DECISION_LABELS: Record<TriageDecision, { label: string; badgeClass: string }> = {
  keep: { label: 'Keep', badgeClass: 'bg-[#DDF3E5] text-[#163D32]' },
  donate: { label: 'Donate', badgeClass: 'bg-cyan-50 text-cyan-800 border border-cyan-200' },
  relocate: { label: 'Relocate', badgeClass: 'bg-[#E9B95B]/25 text-[#163D32]' },
  trash: { label: 'Trash / Recycle', badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200' },
};

function playGentleChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.08, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.6);
    });
  } catch {
    // Ignore if audio context unavailable
  }
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  analysis,
  language,
  familyMembers = [],
  onAssignMember,
  onToggleStep,
  onToggleAllSteps,
  onAddCustomStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onUpdateTriageItem,
  onAddTriageItem,
  onToggleStorageItem,
  onSaveNotes,
  onSaveRoom,
  isSaved,
  onOpenCoachWithContext,
  onOpenRedesignStudio,
  onOpenToolsTab,
  onCompareAfterPhoto,
  isComparingAfter,
  onLogFocusMinutes,
  canExportPdf = true,
  maxUploadMb = 10,
  onOpenPricing,
}) => {
  const t = getUILabels(language);
  const isBn = language === 'bn';
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    | 'plan'
    | 'objects'
    | 'before_after'
    | 'space_color'
    | 'triage'
    | 'wins'
    | 'problems'
    | 'storage'
    | 'layout'
  >('plan');

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [triageFilter, setTriageFilter] = useState<'all' | TriageDecision>('all');
  const [copied, setCopied] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [pickedStepNum, setPickedStepNum] = useState<number | null>(null);

  // Before/After view mode
  const [compareMode, setCompareMode] = useState<'side' | 'slider'>('slider');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [compareSource, setCompareSource] = useState<'after_photo' | 'redesign'>(
    analysis.afterImageUrl ? 'after_photo' : 'redesign'
  );

  // Read-aloud speech synthesis state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Custom task state
  const [showAddTask, setShowAddTask] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<ActionStep['category']>('Organize');
  const [customPriority, setCustomPriority] = useState<TaskPriority>('medium');
  const [customTime, setCustomTime] = useState('10 mins');

  // Inline Step Edit & Undo Banner State
  const [editingStepNumber, setEditingStepNumber] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<ActionStep['category']>('Organize');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editTime, setEditTime] = useState('10 mins');
  const [editInstructions, setEditInstructions] = useState('');
  const [undoBanner, setUndoBanner] = useState<{ message: string; restore: () => void } | null>(
    null
  );

  // Custom triage state
  const [showAddTriage, setShowAddTriage] = useState(false);
  const [triageItemName, setTriageItemName] = useState('');
  const [triageDecision, setTriageDecision] = useState<TriageDecision>('donate');
  const [triageReason, setTriageReason] = useState('');

  // Problem Area 5-Min Spot Rescue State
  const [rescueLoadingKey, setRescueLoadingKey] = useState<string | null>(null);
  const [rescuePlans, setRescuePlans] = useState<
    Record<string, { steps: string[]; householdDiyHack: string }>
  >({});
  const [rescueErrors, setRescueErrors] = useState<Record<string, string>>({});

  // Guided 1-Step Focus Mode & DIY Storage Alternatives State
  const [guidedFocusMode, setGuidedFocusMode] = useState(false);
  const [diySubstitutes, setDiySubstitutes] = useState<DiySubstitute[]>([]);
  const [diyLoading, setDiyLoading] = useState(false);
  const [diyError, setDiyError] = useState<string | null>(null);

  // Daily Habit Check-in state
  const [checkedHabits, setCheckedHabits] = useState<Record<number, boolean>>({});

  // Personal notes draft
  const [notesDraft, setNotesDraft] = useState(analysis.userNotes || '');
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  useEffect(() => {
    setNotesDraft(analysis.userNotes || '');
    setCheckedHabits({});
    setRescuePlans({});
    setRescueErrors({});
    setDiySubstitutes([]);
    setDiyError(null);
    setSelectedObjectId(analysis.detectedObjects?.[0]?.id || null);
    setPickedStepNum(null);
  }, [analysis.id, analysis.userNotes]);

  useEffect(() => {
    if (analysis.afterImageUrl) setCompareSource('after_photo');
    else if (analysis.redesignPreviewUrl) setCompareSource('redesign');
  }, [analysis.afterImageUrl, analysis.redesignPreviewUrl]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [analysis.id]);

  // Focus Sprint Timer
  const [presetMinutes, setPresetMinutes] = useState<number>(15);
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [focusedTaskTitle, setFocusedTaskTitle] = useState<string | null>(null);
  const afterFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          playGentleChime();
          onLogFocusMinutes(presetMinutes);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, presetMinutes, onLogFocusMinutes]);

  const handleSelectPreset = (mins: number) => {
    setTimerRunning(false);
    setPresetMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalSteps = analysis.actionPlan.length;
  const completedSteps = analysis.actionPlan.filter((s) => s.completed).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const remainingMinutes = analysis.actionPlan
    .filter((s) => !s.completed)
    .reduce((sum, s) => {
      const m = s.timeEstimate.match(/\d+/);
      return sum + (m ? Number(m[0]) : 10);
    }, 0);

  const triageList = analysis.triageItems || [];
  const sortedTriageCount = triageList.filter((tr) => tr.sorted).length;
  const acquiredStorageCount = analysis.storageRecommendations.filter((s) => s.acquired).length;
  const detectedObjects = analysis.detectedObjects || [];
  const spaceTips = analysis.spaceUtilization || [];
  const recyclingTips = analysis.recyclingTips || [];

  const getClutterInfo = (score: number) => {
    if (score < 30) {
      return {
        label: isBn ? 'à¦…à¦²à§à¦ª à¦¬à¦¿à¦¶à§ƒà¦™à§à¦–à¦²à¦¾' : 'Minimal Clutter',
        textClass: 'text-[#163D32]',
        strokeColor: '#163D32',
      };
    }
    if (score < 70) {
      return {
        label: isBn ? 'à¦®à¦¾à¦à¦¾à¦°à¦¿ à¦¬à¦¿à¦¶à§ƒà¦™à§à¦–à¦²à¦¾' : 'Moderate Clutter',
        textClass: 'text-amber-700',
        strokeColor: '#E9B95B',
      };
    }
    return {
      label: isBn ? 'à¦¬à§‡à¦¶à¦¿ à¦¬à¦¿à¦¶à§ƒà¦™à§à¦–à¦²à¦¾' : 'Heavy Clutter',
      textClass: 'text-rose-700',
      strokeColor: '#e11d48',
    };
  };

  const completionRatio =
    totalSteps + triageList.length > 0
      ? (completedSteps + sortedTriageCount) / (totalSteps + triageList.length)
      : 0;
  const liveSimulatedScore = Math.max(
    5,
    Math.round(analysis.clutterScore * (1 - completionRatio * 0.65))
  );
  const currentScore =
    typeof analysis.afterClutterScore === 'number'
      ? analysis.afterClutterScore
      : completionRatio > 0
      ? liveSimulatedScore
      : analysis.clutterScore;
  const clutterInfo = getClutterInfo(currentScore);
  const gaugeRadius = 34;
  const gaugeCirc = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCirc - (Math.min(100, Math.max(0, currentScore)) / 100) * gaugeCirc;

  const filteredSteps = analysis.actionPlan.filter((s) => {
    if (hideCompleted && s.completed) return false;
    if (priorityFilter !== 'all' && (s.priority || 'medium') !== priorityFilter) return false;
    if (categoryFilter === 'all') return true;
    return s.category.toLowerCase() === categoryFilter.toLowerCase();
  });

  const filteredTriage = triageList.filter((tr) => {
    if (triageFilter === 'all') return true;
    return tr.decision === triageFilter;
  });

  const buildMarkdownReport = () => {
    const lines = [
      `# ${analysis.roomName}`,
      `Clutter Score: ${analysis.clutterScore}/100 (${clutterInfo.label})`,
      typeof analysis.afterClutterScore === 'number'
        ? `After Score: ${analysis.afterClutterScore}/100`
        : '',
      '',
      `## Overall Assessment`,
      analysis.overallAssessment,
      '',
      '## Action Plan',
      ...analysis.actionPlan.map(
        (s) =>
          `- [${s.completed ? 'x' : ' '}] Step ${s.stepNumber} (${s.category} Â· ${s.timeEstimate}): ${s.title}${s.instructions ? ` â€” ${s.instructions}` : ''}`
      ),
      '',
      '## Quick Wins',
      ...analysis.quickWins.map((w, i) => `${i + 1}. ${w}`),
      '',
      triageList.length > 0 ? '## Item Triage' : '',
      ...triageList.map(
        (item) => `- [${item.sorted ? 'x' : ' '}] [${item.decision.toUpperCase()}] ${item.item} â€” ${item.reason}`
      ),
      '',
      '## Storage Checklist',
      ...analysis.storageRecommendations.map(
        (st) => `- [${st.acquired ? 'x' : ' '}] ${st.itemTitle} (${st.estimatedBudget}) â€” ${st.suggestedLocation}`
      ),
      '',
      '## Layout & Zoning',
      analysis.layoutAdvice,
      '',
      notesDraft ? `\n## Personal Notes\n${notesDraft}` : '',
    ];
    return lines.filter((l) => l !== undefined).join('\n');
  };

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToSpeak = `${analysis.roomName}. ${analysis.overallAssessment}. Top steps: ${analysis.actionPlan
      .filter((s) => !s.completed)
      .slice(0, 5)
      .map((s) => `Step ${s.stepNumber}: ${s.title}`)
      .join('. ')}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = isBn ? 'bn-BD' : 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyChecklist = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdownReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1800);
    } catch {
      // ignore
    }
  };

  const handlePickForMe = () => {
    const incomplete = analysis.actionPlan.filter((s) => !s.completed);
    if (incomplete.length === 0) return;
    const pool =
      incomplete.length > 1 && pickedStepNum !== null
        ? incomplete.filter((s) => s.stepNumber !== pickedStepNum)
        : incomplete;
    const pick = pool[Math.floor(Math.random() * pool.length)] || incomplete[0];
    setPickedStepNum(pick.stepNumber);
    setFocusedTaskTitle(pick.title);
    setGuidedFocusMode(false);
    setCategoryFilter('all');
  };

  const handleAfterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > maxUploadMb * 1024 * 1024) {
      setPdfNotice(
        isBn
          ? `à¦ªà¦°à§‡à¦° à¦›à¦¬à¦¿à¦° à¦†à¦•à¦¾à¦° à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š ${maxUploadMb}MB à¦¹à¦¤à§‡ à¦¹à¦¬à§‡à¥¤`
          : `After photo exceeds the ${maxUploadMb}MB size limit.`
      );
      e.target.value = '';
      return;
    }
    setPdfNotice(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (ev.target?.result) {
        await onCompareAfterPhoto(ev.target.result as string);
        setActiveTab('before_after');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateCustomStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    onAddCustomStep(
      customTitle.trim(),
      customCategory,
      customTime.trim() || '10 mins',
      customPriority
    );
    setCustomTitle('');
    setCustomPriority('medium');
    setShowAddTask(false);
  };
