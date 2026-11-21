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
        label: isBn ? 'অল্প বিশৃঙ্খলা' : 'Minimal Clutter',
        textClass: 'text-[#163D32]',
        strokeColor: '#163D32',
      };
    }
    if (score < 70) {
      return {
        label: isBn ? 'মাঝারি বিশৃঙ্খলা' : 'Moderate Clutter',
        textClass: 'text-amber-700',
        strokeColor: '#E9B95B',
      };
    }
    return {
      label: isBn ? 'বেশি বিশৃঙ্খলা' : 'Heavy Clutter',
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
          `- [${s.completed ? 'x' : ' '}] Step ${s.stepNumber} (${s.category} · ${s.timeEstimate}): ${s.title}${s.instructions ? ` — ${s.instructions}` : ''}`
      ),
      '',
      '## Quick Wins',
      ...analysis.quickWins.map((w, i) => `${i + 1}. ${w}`),
      '',
      triageList.length > 0 ? '## Item Triage' : '',
      ...triageList.map(
        (item) => `- [${item.sorted ? 'x' : ' '}] [${item.decision.toUpperCase()}] ${item.item} — ${item.reason}`
      ),
      '',
      '## Storage Checklist',
      ...analysis.storageRecommendations.map(
        (st) => `- [${st.acquired ? 'x' : ' '}] ${st.itemTitle} (${st.estimatedBudget}) — ${st.suggestedLocation}`
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
          ? `পরের ছবির আকার সর্বোচ্চ ${maxUploadMb}MB হতে হবে।`
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

  const triggerStepToggle = (step: ActionStep) => {
    onToggleStep(step.stepNumber);
    setUndoBanner({
      message: isBn
        ? `"${step.title}" ${step.completed ? 'বাকি' : 'সম্পন্ন'} হিসেবে চিহ্নিত হয়েছে`
        : `${step.completed ? 'Reopened' : 'Completed'} "${step.title}"`,
      restore: () => {
        onToggleStep(step.stepNumber);
        setUndoBanner(null);
      },
    });
  };

  const triggerStepDelete = (step: ActionStep) => {
    onDeleteStep(step.stepNumber);
    setUndoBanner({
      message: isBn ? `"${step.title}" মুছে ফেলা হয়েছে` : `Removed "${step.title}"`,
      restore: () => {
        onAddCustomStep(step.title, step.category, step.timeEstimate, step.priority);
        setUndoBanner(null);
      },
    });
  };

  const startEditingStep = (step: ActionStep) => {
    setEditingStepNumber(step.stepNumber);
    setEditTitle(step.title);
    setEditCategory(step.category);
    setEditPriority(step.priority || 'medium');
    setEditTime(step.timeEstimate);
    setEditInstructions(step.instructions || '');
  };

  const saveEditedStep = (stepNumber: number) => {
    if (!editTitle.trim() || !onEditStep) {
      setEditingStepNumber(null);
      return;
    }
    onEditStep(stepNumber, {
      title: editTitle.trim(),
      category: editCategory,
      priority: editPriority,
      timeEstimate: editTime.trim() || '10 mins',
      instructions: editInstructions.trim(),
    });
    setEditingStepNumber(null);
  };

  const handleCreateTriageItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageItemName.trim()) return;
    onAddTriageItem(triageItemName.trim(), triageDecision, triageReason.trim() || 'Added manually');
    setTriageItemName('');
    setTriageReason('');
    setShowAddTriage(false);
  };

  const handleRequestSpotRescue = async (key: string, title: string, description: string) => {
    setRescueLoadingKey(key);
    setRescueErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const resp = await fetch('/api/spot-rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotTitle: title,
          spotDescription: description,
          roomType: analysis.roomType,
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setRescueErrors((prev) => ({
          ...prev,
          [key]: isBn ? 'সার্ভার প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' : 'Server warming up. Please try again.',
        }));
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success) {
        setRescuePlans((prev) => ({
          ...prev,
          [key]: { steps: data.steps || [], householdDiyHack: data.householdDiyHack || '' },
        }));
      } else {
        setRescueErrors((prev) => ({
          ...prev,
          [key]: data.details || data.error || 'Could not generate rescue plan.',
        }));
      }
    } catch (err: any) {
      setRescueErrors((prev) => ({
        ...prev,
        [key]: err?.message || 'Error contacting server.',
      }));
    } finally {
      setRescueLoadingKey(null);
    }
  };

  const scoreDelta =
    typeof analysis.afterClutterScore === 'number'
      ? analysis.clutterScore - analysis.afterClutterScore
      : null;

  const activeComparisonImage =
    compareSource === 'after_photo' && analysis.afterImageUrl
      ? analysis.afterImageUrl
      : analysis.redesignPreviewUrl || analysis.afterImageUrl || null;

  return (
    <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-6 space-y-6 shadow-xs transition-colors">
      {/* Top Banner & Circular Clutter Score */}
      <div className="space-y-4 pb-5 border-b border-[#163D32]/10 dark:border-[#264638]">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-[#163D32]/15 dark:border-[#264638] shrink-0 bg-[#F7F9F6] dark:bg-[#182C24]">
              <img
                src={analysis.imageUrl}
                alt={analysis.roomName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#163D32]/65 dark:text-[#B9D1C3] mb-1 tabular-nums">
                <span className={clutterInfo.textClass}>{clutterInfo.label}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">
                  {t.roomLabels[analysis.roomType] || analysis.roomType.replace(/_/g, ' ')}
                </span>
                {analysis.cleaningDifficulty && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        analysis.cleaningDifficulty === 'Intensive'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                          : analysis.cleaningDifficulty === 'Moderate'
                          ? 'bg-[#E9B95B]/30 text-[#163D32] dark:text-[#E9B95B]'
                          : 'bg-[#DDF3E5] text-[#163D32]'
                      }`}
                    >
                      {analysis.cleaningDifficulty}
                    </span>
                  </>
                )}
                {typeof analysis.estimatedCleaningMinutes === 'number' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-[11px] font-mono text-[#163D32] dark:text-[#EDF4EF]">
                    <Clock className="w-3 h-3 text-[#E9B95B]" />
                    ~{analysis.estimatedCleaningMinutes}m
                  </span>
                )}
                {familyMembers.length > 0 && onAssignMember && (
                  <>
                    <span aria-hidden="true">·</span>
                    <select
                      value={analysis.assignedMemberId || ''}
                      onChange={(e) => onAssignMember(analysis.id, e.target.value)}
                      aria-label="Assign room to household member"
                      className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#163D32] dark:text-[#EDF4EF] outline-none"
                    >
                      <option value="">{isBn ? 'সদস্য নির্ধারণ করুন' : 'Assign member...'}</option>
                      {familyMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] leading-snug">
                {analysis.roomName}
              </h2>
              <p className="text-xs sm:text-sm text-[#163D32]/75 dark:text-[#B9D1C3] mt-1 leading-relaxed max-w-3xl">
                {analysis.overallAssessment}
              </p>

              {analysis.furnitureAnalysis && (
                <div className="mt-3 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 max-w-3xl">
                  <Armchair className="w-4 h-4 text-[#E9B95B] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#163D32]/85 dark:text-[#DDF3E5]/90 leading-relaxed">
                    <span className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                      {isBn ? 'আসবাব ও প্লেসমেন্ট বিশ্লেষণ: ' : 'Furniture Placement Note: '}
                    </span>
                    <span>{analysis.furnitureAnalysis}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Circular Clutter Gauge */}
          <div className="flex items-center gap-3.5 px-4 py-3 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl shrink-0 self-start">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r={gaugeRadius}
                  fill="none"
                  stroke="#DDF3E5"
                  strokeWidth="7"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={gaugeRadius}
                  fill="none"
                  stroke={clutterInfo.strokeColor}
                  strokeWidth="7"
                  strokeDasharray={gaugeCirc}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-base font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]">
                {currentScore}
              </span>
            </div>
            <div className="text-xs min-w-[100px]">
              <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'ক্লাটার স্কোর' : 'Clutter Score'}
              </div>
              <div className="text-[#163D32]/70 dark:text-[#B9D1C3] tabular-nums mt-0.5">
                {scoreDelta !== null && scoreDelta > 0
                  ? `-${scoreDelta} pts reduced`
                  : typeof analysis.afterClutterScore !== 'number' && completionRatio > 0
                  ? `${analysis.clutterScore} → Est. ${liveSimulatedScore}`
                  : isBn
                  ? '০ = সম্পূর্ণ পরিচ্ছন্ন'
                  : '0 = spotless'}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#163D32]/10 no-print">
          <input
            ref={afterFileRef}
            type="file"
            accept="image/*"
            onChange={handleAfterFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={onOpenRedesignStudio}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] transition-colors whitespace-nowrap"
          >
            <Wand2 className="w-4 h-4" />
            <span>{isBn ? 'AI রিডিজাইন' : 'AI Redesign'}</span>
          </button>

          <button
            type="button"
            disabled={isComparingAfter}
            onClick={() => afterFileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F7F9F6] hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15 transition-colors whitespace-nowrap"
          >
            {isComparingAfter ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span>{isComparingAfter ? (isBn ? 'স্কোরিং...' : 'Re-scoring...') : (isBn ? 'পরের ছবি' : 'After Photo')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canExportPdf) {
                setPdfNotice(
                  isBn
                    ? 'PDF রিপোর্ট এক্সপোর্ট Pro বা Premium প্ল্যানে পাওয়া যায়।'
                    : 'PDF Plan Export is included in Pro and Premium plans.'
                );
                return;
              }
              setPdfNotice(null);
              exportRoomPlanToPdf(analysis, language);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] transition-colors whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            <span>{t.exportPdf}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSpeech}
            title="Read Plan Aloud"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
              isSpeaking
                ? 'bg-[#E9B95B]/30 border-[#E9B95B] text-[#163D32]'
                : 'bg-[#F7F9F6] hover:bg-[#DDF3E5] text-[#163D32] border-[#163D32]/15'
            }`}
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isSpeaking ? (isBn ? 'থামান' : 'Stop') : (isBn ? 'শুনুন' : 'Listen')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyChecklist}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F7F9F6] hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15 transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            title="Print"
            className="p-2 rounded-xl bg-[#F7F9F6] hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onSaveRoom}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border whitespace-nowrap ${
              isSaved
                ? 'bg-[#DDF3E5] text-[#163D32] border-[#163D32]'
                : 'bg-[#F7F9F6] hover:bg-[#DDF3E5] text-[#163D32] border-[#163D32]/15'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>{isSaved ? (isBn ? 'সেভড' : 'Saved') : (isBn ? 'সেভ করুন' : 'Save Plan')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCoachWithContext}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#163D32] hover:bg-[#102E25] text-white transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4 text-[#E9B95B]" />
            <span>{isBn ? 'AI কোচ' : 'Ask Coach'}</span>
          </button>
        </div>

        {pdfNotice && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-[#E9B95B] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#163D32] dark:text-[#EDF4EF] no-print">
            <span>{pdfNotice}</span>
            <div className="flex items-center gap-2">
              {onOpenPricing && !canExportPdf && (
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className="px-3 py-1 rounded-lg bg-[#163D32] text-white font-bold"
                >
                  {isBn ? 'প্ল্যান দেখুন' : 'Upgrade Plan'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPdfNotice(null)}
                className="p-1 text-[#163D32]/60 hover:text-[#163D32]"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Checklist Progress & Focus Sprint Timer Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-6 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
            <span className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
              <span>{isBn ? 'কাজের অগ্রগতি' : 'Checklist Progress'}</span>
            </span>
            <span className="font-mono tabular-nums">{progressPercent}%</span>
          </div>

          <div className="w-full bg-white dark:bg-[#13241D] rounded-full h-2.5 overflow-hidden border border-[#163D32]/10 dark:border-[#264638]">
            <div
              className="bg-[#163D32] dark:bg-[#E9B95B] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#163D32]/70 dark:text-[#B9D1C3] tabular-nums">
            <span>
              {completedSteps}/{totalSteps} {isBn ? 'ধাপ' : 'steps'} · {sortedTriageCount}/{triageList.length}{' '}
              {isBn ? 'বাছাই' : 'sorted'}
            </span>
            <span className="italic truncate max-w-[230px]" title={analysis.minimalistTip}>
              &ldquo;{analysis.minimalistTip}&rdquo;
            </span>
          </div>
        </div>

        {/* Focus Sprint Timer */}
        <div className="lg:col-span-6 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
              <Timer className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'ফোকাস স্প্রিন্ট টাইমার' : 'Focus Sprint Timer'}</span>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-[#13241D] p-0.5 rounded-xl border border-[#163D32]/10 dark:border-[#264638] text-xs">
              {[5, 15, 25, 45].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSelectPreset(mins)}
                  className={`px-2 py-0.5 rounded-lg tabular-nums font-semibold ${
                    presetMinutes === mins
                      ? 'bg-[#163D32] text-white'
                      : 'text-[#163D32]/70 dark:text-[#B9D1C3] hover:text-[#163D32]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]">
                {secondsLeft === 0 ? (isBn ? 'সময় শেষ!' : 'Time Up!') : formatTime(secondsLeft)}
              </div>
              <p className="text-xs text-[#163D32]/65 dark:text-[#B9D1C3] truncate">
                {focusedTaskTitle
                  ? `Focus: ${focusedTaskTitle}`
                  : isBn
                  ? 'যেকোনো ধাপ ফোকাস করতে পিন করুন।'
                  : 'Pick a preset or click "Pick for me".'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#163D32] hover:bg-[#102E25] text-white transition-colors"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{timerRunning ? (isBn ? 'বিরতি' : 'Pause') : (isBn ? 'শুরু' : 'Start')}</span>
              </button>

              <button
                type="button"
                onClick={() => setSecondsLeft((s) => s + 5 * 60)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#13241D] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#264638] transition-colors tabular-nums"
              >
                +5m
              </button>

              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsLeft(presetMinutes * 60);
                }}
                aria-label="Reset timer"
                className="p-2 rounded-xl bg-white dark:bg-[#13241D] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#264638] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Wins Compact Card */}
      {analysis.quickWins.length > 0 && (
        <div className="bg-[#DDF3E5]/60 dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'তাৎক্ষণিক দ্রুত সমাধান (Quick Wins)' : 'Instant Quick Wins (Under 10 Mins)'}</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('wins')}
              className="text-xs font-bold text-[#163D32] dark:text-[#E9B95B] hover:underline"
            >
              {isBn ? 'সব দেখুন' : 'View all'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {analysis.quickWins.slice(0, 3).map((win, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-xl p-3 text-xs text-[#163D32] dark:text-[#EDF4EF] flex items-start gap-2"
              >
                <span className="font-mono font-bold text-[#163D32] bg-[#E9B95B]/35 dark:bg-[#E9B95B] px-1.5 py-0.5 rounded-md shrink-0 tabular-nums">
                  {idx + 1}
                </span>
                <span className="leading-snug">{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Section Tabs */}
      <div className="flex items-center gap-2 border-b border-[#163D32]/10 dark:border-[#264638] overflow-x-auto pb-3 scrollbar-none no-print">
        {[
          { id: 'plan', label: `${t.tabPlan} (${totalSteps})`, icon: <CheckSquare className="w-4 h-4" /> },
          { id: 'objects', label: `${t.tabObjects} (${detectedObjects.length})`, icon: <ScanSearch className="w-4 h-4" /> },
          { id: 'before_after', label: t.tabBeforeAfter, icon: <Columns2 className="w-4 h-4" /> },
          { id: 'space_color', label: t.tabSpaceColor, icon: <Palette className="w-4 h-4" /> },
          { id: 'triage', label: `${t.tabTriage} (${triageList.length})`, icon: <ArrowRightLeft className="w-4 h-4" /> },
          { id: 'problems', label: `${t.tabProblems} (${analysis.problemAreas.length})`, icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'storage', label: `${t.tabStorage} (${analysis.storageRecommendations.length})`, icon: <Package className="w-4 h-4" /> },
          { id: 'layout', label: t.tabLayout, icon: <Compass className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === tab.id
                ? 'bg-[#163D32] border-[#163D32] text-white dark:bg-[#E9B95B] dark:border-[#E9B95B] dark:text-[#163D32]'
                : 'bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border-[#163D32]/10 dark:border-[#264638] text-[#163D32]/80 dark:text-[#B9D1C3]'
            }`}
          >
            {tab.icon}
            <span className="tabular-nums">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Action Plan */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#163D32] dark:text-[#EDF4EF] text-base sm:text-lg">
                {isBn ? 'ধাপে ধাপে রুম গোছানোর চেকলিস্ট' : 'Step-by-Step Action Plan'}
              </h3>
              {remainingMinutes > 0 && (
                <p className="text-xs text-[#163D32]/65 dark:text-[#B9D1C3] tabular-nums mt-0.5">
                  {isBn
                    ? `আনুমানিক বাকি সময়: ~${remainingMinutes} মিনিট`
                    : `Est. remaining time: ~${remainingMinutes} mins`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                disabled={completedSteps >= totalSteps}
                onClick={handlePickForMe}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E9B95B] hover:bg-[#dfb04f] disabled:opacity-40 text-[#163D32] transition-colors whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{t.stuckPickForMe}</span>
              </button>

              <div className="flex items-center gap-1 bg-[#F7F9F6] dark:bg-[#182C24] p-1 rounded-xl border border-[#163D32]/10 dark:border-[#264638] text-xs">
                {['all', 'purge', 'sort', 'organize', 'store'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-[#163D32] text-white'
                        : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-[#F7F9F6] dark:bg-[#182C24] p-1 rounded-xl border border-[#163D32]/10 dark:border-[#264638] text-xs">
                {(['all', 'high', 'medium', 'low'] as const).map((pri) => (
                  <button
                    key={pri}
                    type="button"
                    onClick={() => setPriorityFilter(pri)}
                    className={`px-2 py-1 rounded-lg capitalize font-semibold transition-colors whitespace-nowrap ${
                      priorityFilter === pri
                        ? 'bg-[#E9B95B] text-[#163D32]'
                        : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    {pri === 'all' ? (isBn ? 'সব গুরুত্ব' : 'All Priority') : pri}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setHideCompleted((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#264638] whitespace-nowrap"
              >
                {hideCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{hideCompleted ? 'Show Done' : 'Hide Done'}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleAllSteps(completedSteps < totalSteps)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#264638] whitespace-nowrap"
              >
                {completedSteps < totalSteps ? (isBn ? 'সব সম্পন্ন' : 'Complete All') : (isBn ? 'রিসেট' : 'Reset All')}
              </button>

              <button
                type="button"
                onClick={() => setGuidedFocusMode((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors ${
                  guidedFocusMode
                    ? 'bg-[#163D32] text-white border-[#163D32]'
                    : 'bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] border-[#163D32]/15 dark:border-[#264638]'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>{isBn ? 'ফোকাস মোড' : 'Guided Focus'}</span>
              </button>

              {analysis.actionPlan.length < 25 && (
                <button
                  type="button"
                  onClick={() => setShowAddTask((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ধাপ যোগ' : 'Add Step'}</span>
                </button>
              )}
            </div>
          </div>

          {undoBanner && (
            <div className="bg-[#DDF3E5] border border-[#163D32]/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-[#163D32] no-print">
              <span className="font-medium truncate">{undoBanner.message}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={undoBanner.restore}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#163D32] text-white font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isBn ? 'ফিরিয়ে আনুন' : 'Undo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUndoBanner(null)}
                  aria-label="Dismiss undo"
                  className="p-1 text-[#163D32]/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {guidedFocusMode &&
            (() => {
              const nextStep = analysis.actionPlan.find((s) => !s.completed);
              return (
                <div className="bg-[#DDF3E5] border border-[#163D32]/25 rounded-2xl p-5 space-y-3 no-print">
                  {nextStep ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#163D32] tabular-nums">
                          {isBn
                            ? `বর্তমান ফোকাস: ধাপ ${nextStep.stepNumber}`
                            : `Current Spotlight · Step ${nextStep.stepNumber} of ${totalSteps}`}
                        </span>
                        <span className="font-mono text-[#163D32]/75 tabular-nums">{nextStep.timeEstimate}</span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-[#163D32]">{nextStep.title}</h4>
                      {nextStep.instructions && (
                        <p className="text-xs sm:text-sm text-[#163D32]/85 leading-relaxed">
                          {nextStep.instructions}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => triggerStepToggle(nextStep)}
                          className="px-4 py-2 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isBn ? 'সম্পন্ন ও পরের ধাপ' : 'Complete & Next Step'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedTaskTitle(nextStep.title);
                            setTimerRunning(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white border border-[#163D32]/15 text-xs font-bold text-[#163D32] flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isBn ? 'টাইমার চালু করুন' : 'Start Focus Timer'}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-bold text-[#163D32]">
                      {isBn ? 'সব ধাপ সম্পন্ন হয়েছে! দারুণ কাজ!' : 'All checklist steps completed! Awesome progress!'}
                    </div>
                  )}
                </div>
              );
            })()}

          {showAddTask && (
            <form
              onSubmit={handleCreateCustomStep}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end no-print"
            >
              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 dark:text-[#B9D1C3] block">Custom Task Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Drop off donation bag at charity"
                  className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 dark:text-[#B9D1C3] block">Category</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as ActionStep['category'])}
                  className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                >
                  <option value="Purge">Purge</option>
                  <option value="Sort">Sort</option>
                  <option value="Organize">Organize</option>
                  <option value="Store">Store</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 dark:text-[#B9D1C3] block">Priority</label>
                <select
                  value={customPriority}
                  onChange={(e) => setCustomPriority(e.target.value as TaskPriority)}
                  className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 dark:text-[#B9D1C3] block">Est. Time</label>
                <input
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="10 mins"
                  className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-[#163D32] hover:bg-[#102E25] text-white font-bold text-xs sm:text-sm rounded-xl transition-colors"
                >
                  Save Step
                </button>
              </div>
            </form>
          )}

          {/* Multi-column on PC, Vertical Checklist on Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSteps.map((step) => {
              const isDone = step.completed;
              const isPicked = pickedStepNum === step.stepNumber && !isDone;
              const stepPriority = step.priority || 'medium';
              const isEditing = editingStepNumber === step.stepNumber;
              return (
                <div
                  key={step.stepNumber}
                  className={`group p-4 rounded-2xl border transition-colors flex items-start gap-3.5 ${
                    isPicked
                      ? 'bg-[#E9B95B]/20 border-[#E9B95B] ring-2 ring-[#E9B95B]/40'
                      : isDone
                      ? 'bg-[#F7F9F6]/60 dark:bg-[#182C24]/50 border-[#163D32]/10 dark:border-[#264638] opacity-65'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => triggerStepToggle(step)}
                    aria-label={`Toggle step ${step.stepNumber}`}
                    className="mt-0.5 text-[#163D32] dark:text-[#E9B95B] shrink-0"
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-[#163D32] dark:text-[#E9B95B]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#163D32]/40 dark:text-[#B9D1C3]/50 group-hover:text-[#163D32]" />
                    )}
                  </button>

                  {isEditing ? (
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/20 dark:border-[#264638] rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF] outline-none"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as ActionStep['category'])}
                          className="bg-white dark:bg-[#13241D] border border-[#163D32]/20 dark:border-[#264638] rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
                        >
                          <option value="Purge">Purge</option>
                          <option value="Sort">Sort</option>
                          <option value="Organize">Organize</option>
                          <option value="Store">Store</option>
                        </select>
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                          className="bg-white dark:bg-[#13241D] border border-[#163D32]/20 dark:border-[#264638] rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <input
                          type="text"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="bg-white dark:bg-[#13241D] border border-[#163D32]/20 dark:border-[#264638] rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={editInstructions}
                        onChange={(e) => setEditInstructions(e.target.value)}
                        placeholder="Instructions..."
                        className="w-full bg-white dark:bg-[#13241D] border border-[#163D32]/20 dark:border-[#264638] rounded-lg px-2.5 py-1.5 text-xs text-[#163D32] dark:text-[#EDF4EF] outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEditedStep(step.stepNumber)}
                          className="px-3 py-1 rounded-lg bg-[#163D32] text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStepNumber(null)}
                          className="px-3 py-1 rounded-lg bg-white dark:bg-[#13241D] text-[#163D32] dark:text-[#EDF4EF] text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => triggerStepToggle(step)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#163D32]/70 dark:text-[#B9D1C3] tabular-nums">
                          <span className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                            Step {step.stepNumber}
                          </span>
                          <span>·</span>
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] text-[11px] font-semibold">
                            {step.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                              stepPriority === 'high'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                                : stepPriority === 'medium'
                                ? 'bg-[#E9B95B]/30 text-[#163D32] dark:text-[#E9B95B]'
                                : 'bg-[#DDF3E5] text-[#163D32]'
                            }`}
                          >
                            {stepPriority}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-mono text-[#163D32]/75 dark:text-[#B9D1C3] tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-[#E9B95B]" />
                          <span>{step.timeEstimate}</span>
                        </div>
                      </div>

                      <h4
                        className={`font-bold text-sm sm:text-base ${
                          isDone
                            ? 'line-through text-[#163D32]/50 dark:text-[#B9D1C3]/50'
                            : 'text-[#163D32] dark:text-[#EDF4EF]'
                        }`}
                      >
                        {step.title}
                      </h4>

                      {step.instructions && (
                        <p className="text-xs sm:text-sm mt-1 leading-relaxed text-[#163D32]/75 dark:text-[#B9D1C3]">
                          {step.instructions}
                        </p>
                      )}

                      {step.tips && (
                        <div className="mt-2 text-xs text-[#163D32]/85 dark:text-[#DDF3E5] flex items-start gap-1.5 bg-white/80 dark:bg-[#13241D] rounded-xl p-2 border border-[#163D32]/10 dark:border-[#264638]">
                          <Lightbulb className="w-3.5 h-3.5 text-[#E9B95B] shrink-0 mt-0.5" />
                          <span>{step.tips}</span>
                        </div>
                      )}

                      {!isDone && (
                        <div className="mt-2.5 flex items-center gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedTaskTitle(step.title);
                              setTimerRunning(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-[11px] font-bold transition-colors whitespace-nowrap"
                          >
                            <Play className="w-3 h-3" />
                            <span>{isBn ? 'কাজ শুরু' : 'Start Task'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-1 shrink-0 no-print">
                    {onEditStep && !isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditingStep(step)}
                        title="Edit step"
                        className="p-1.5 rounded-lg text-[#163D32]/60 dark:text-[#B9D1C3] hover:text-[#163D32] hover:bg-[#DDF3E5]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedTaskTitle(step.title);
                        setTimerRunning(true);
                      }}
                      title="Focus Timer on this step"
                      className="p-1.5 rounded-lg text-[#163D32]/60 dark:text-[#B9D1C3] hover:text-[#163D32] hover:bg-[#DDF3E5]"
                    >
                      <Target className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.stepNumber, 'up')}
                      title="Move Up"
                      className="p-1 rounded-lg text-[#163D32]/50 dark:text-[#B9D1C3] hover:text-[#163D32] hover:bg-white"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.stepNumber, 'down')}
                      title="Move Down"
                      className="p-1 rounded-lg text-[#163D32]/50 dark:text-[#B9D1C3] hover:text-[#163D32] hover:bg-white"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerStepDelete(step)}
                      title="Delete step"
                      className="p-1 rounded-lg text-[#163D32]/40 dark:text-[#B9D1C3] hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: AI Object Detection with Bounding Box Overlay */}
      {activeTab === 'objects' && (
        <div className="space-y-5">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-[#163D32]">
              {isBn ? 'AI অবজেক্ট ডিটেকশন ও ক্লাটার বিশ্লেষণ' : 'AI Object Detection & Clutter Impact'}
            </h3>
            <p className="text-xs sm:text-sm text-[#163D32]/70 mt-0.5">
              {isBn
                ? 'ছবির যেকোনো বক্স বা নিচের কার্ডে ক্লিক করে জিনিসের প্রভাব ও করণীয় দেখুন।'
                : 'Click any bounding box on the photo or object card to inspect clutter impact & recommended action.'}
            </p>
          </div>

          {detectedObjects.length === 0 ? (
            <div className="bg-[#F7F9F6] border border-dashed border-[#163D32]/20 rounded-2xl p-8 text-center text-xs sm:text-sm text-[#163D32]/70">
              {isBn
                ? 'এই রুমে কোনো অবজেক্ট বক্স সংরক্ষিত নেই। বিস্তারিত অবজেক্ট ডিটেকশনের জন্য ছবি পুনরায় বিশ্লেষণ করুন।'
                : 'No bounding-box objects recorded on this older scan. Re-analyze the room photo to detect objects visually.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Interactive Photo with Bounding Boxes */}
              <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-[#163D32]/15 bg-[#F7F9F6]">
                <img
                  src={analysis.imageUrl}
                  alt={analysis.roomName}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto block"
                />
                {detectedObjects.map((obj) => {
                  const [ymin, xmin, ymax, xmax] = obj.box2d;
                  const topPct = Math.max(0, Math.min(95, ymin / 10));
                  const leftPct = Math.max(0, Math.min(95, xmin / 10));
                  const heightPct = Math.max(4, Math.min(100 - topPct, (ymax - ymin) / 10));
                  const widthPct = Math.max(4, Math.min(100 - leftPct, (xmax - xmin) / 10));
                  const isSelected = selectedObjectId === obj.id;
                  const boxColor =
                    obj.clutterImpact === 'high'
                      ? '#e11d48'
                      : obj.clutterImpact === 'medium'
                      ? '#E9B95B'
                      : '#163D32';

                  return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setSelectedObjectId(obj.id)}
                      style={{
                        top: `${topPct}%`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        borderColor: boxColor,
                        backgroundColor: isSelected ? `${boxColor}33` : `${boxColor}14`,
                      }}
                      className={`absolute border-2 rounded-lg transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-white z-20' : 'z-10'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: boxColor }}
                        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-xs"
                      >
                        {obj.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Object Cards List */}
              <div className="lg:col-span-5 space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {detectedObjects.map((obj) => {
                  const isSelected = selectedObjectId === obj.id;
                  return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors space-y-1.5 ${
                        isSelected
                          ? 'bg-[#DDF3E5] border-[#163D32]'
                          : 'bg-[#F7F9F6] border-[#163D32]/10 hover:border-[#163D32]/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#163D32] truncate">{obj.label}</span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md capitalize shrink-0 ${
                            obj.clutterImpact === 'high'
                              ? 'bg-rose-100 text-rose-700'
                              : obj.clutterImpact === 'medium'
                              ? 'bg-[#E9B95B]/35 text-[#163D32]'
                              : 'bg-white text-[#163D32]'
                          }`}
                        >
                          {obj.clutterImpact} impact
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#163D32]/75">
                        <span>
                          {obj.category}
                          {obj.estimatedValue ? ` · ${obj.estimatedValue}` : ''}
                        </span>
                        <span className="font-bold uppercase text-[11px] px-2 py-0.5 rounded-md bg-white border border-[#163D32]/15 text-[#163D32]">
                          {obj.recommendedAction}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Before & After Comparison */}
      {activeTab === 'before_after' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#163D32]">
                {isBn ? 'ঘর গোছানোর আগে ও পরের তুলনা' : 'Before & After Comparison'}
              </h3>
              <p className="text-xs sm:text-sm text-[#163D32]/70 mt-0.5">
                {isBn
                  ? 'আগের ছবির সাথে পরের ছবি বা AI রুম রিডিজাইন পাশাপাশি ও স্লাইডার দিয়ে দেখুন।'
                  : 'Compare your original room against your uploaded After photo or AI Room Redesign preview.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              {analysis.afterImageUrl && analysis.redesignPreviewUrl && (
                <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] border border-[#163D32]/10 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCompareSource('after_photo')}
                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                      compareSource === 'after_photo' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70'
                    }`}
                  >
                    {isBn ? 'পরের ছবি' : 'After Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareSource('redesign')}
                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                      compareSource === 'redesign' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70'
                    }`}
                  >
                    {isBn ? 'AI রিডিজাইন' : 'AI Redesign'}
                  </button>
                </div>
              )}

              {activeComparisonImage && (
                <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] border border-[#163D32]/10 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCompareMode('slider')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                      compareMode === 'slider' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{isBn ? 'স্লাইডার' : 'Slider'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMode('side')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                      compareMode === 'side' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পাশাপাশি' : 'Side-by-Side'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {!activeComparisonImage ? (
            <div className="bg-[#F7F9F6] border border-dashed border-[#163D32]/20 rounded-2xl p-8 text-center space-y-4">
              <TrendingDown className="w-10 h-10 text-[#163D32]/35 mx-auto" />
              <div>
                <h4 className="font-bold text-sm sm:text-base text-[#163D32]">
                  {isBn ? 'এখনও কোনো পরের ছবি বা AI রিডিজাইন নেই' : 'No After Photo or AI Redesign Generated Yet'}
                </h4>
                <p className="text-xs sm:text-sm text-[#163D32]/65 mt-1 max-w-md mx-auto">
                  {isBn
                    ? 'গোছানোর পর একটি নতুন ছবি আপলোড করুন অথবা AI রিডিজাইন স্টুডিও দিয়ে প্রিভিউ তৈরি করুন।'
                    : 'Upload your finished room photo to score your improvement, or generate an instant AI redesign preview.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => afterFileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] text-[#163D32] text-xs font-bold"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isBn ? 'পরের ছবি আপলোড' : 'Upload After Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenRedesignStudio}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] text-white text-xs font-bold"
                >
                  <Wand2 className="w-4 h-4 text-[#E9B95B]" />
                  <span>{isBn ? 'AI রিডিজাইন স্টুডিও খুলুন' : 'Open AI Redesign Studio'}</span>
                </button>
              </div>
            </div>
          ) : compareMode === 'slider' ? (
            <div className="space-y-2.5">
              <div className="relative aspect-16/9 max-h-[420px] w-full rounded-2xl overflow-hidden bg-[#F7F9F6] border border-[#163D32]/15 select-none">
                <img
                  src={activeComparisonImage}
                  alt="After room"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                  <img
                    src={analysis.imageUrl}
                    alt="Before room"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#E9B95B] pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                />
                <span className="absolute top-3 left-3 text-xs font-bold bg-[#163D32]/90 text-white px-2.5 py-1 rounded-lg">
                  {isBn ? 'আগে' : 'Before'} ({analysis.clutterScore}/100)
                </span>
                <span className="absolute top-3 right-3 text-xs font-bold bg-[#E9B95B] text-[#163D32] px-2.5 py-1 rounded-lg">
                  {compareSource === 'after_photo' && typeof analysis.afterClutterScore === 'number'
                    ? `${isBn ? 'পরে' : 'After'} (${analysis.afterClutterScore}/100)`
                    : isBn
                    ? 'AI রিডিজাইন'
                    : 'AI Redesign'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                aria-label="Before and after comparison slider"
                className="w-full accent-[#163D32] cursor-ew-resize"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#163D32]/70 tabular-nums">
                  {isBn ? 'আগে' : 'Before'} · {analysis.clutterScore}/100
                </span>
                <div className="aspect-16/10 rounded-2xl overflow-hidden border border-[#163D32]/15 bg-[#F7F9F6]">
                  <img
                    src={analysis.imageUrl}
                    alt="Before"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#163D32] tabular-nums">
                  {compareSource === 'after_photo' && typeof analysis.afterClutterScore === 'number'
                    ? `${isBn ? 'পরে' : 'After'} · ${analysis.afterClutterScore}/100`
                    : isBn
                    ? 'AI রিডিজাইন প্রিভিউ'
                    : 'AI Redesign Preview'}
                </span>
                <div className="aspect-16/10 rounded-2xl overflow-hidden border-2 border-[#163D32] bg-[#F7F9F6]">
                  <img
                    src={activeComparisonImage}
                    alt="After"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {(analysis.afterSummary || analysis.redesignSummary) && (
            <div className="bg-[#DDF3E5]/60 border border-[#163D32]/15 rounded-xl p-4 text-xs sm:text-sm text-[#163D32] leading-relaxed">
              {compareSource === 'after_photo' && analysis.afterSummary
                ? analysis.afterSummary
                : analysis.redesignSummary}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Smart Space Utilization & AI Color/Decor Suggestions */}
      {activeTab === 'space_color' && (
        <div className="space-y-6">
          {/* Smart Space Utilization */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-[#163D32]" />
              <h3 className="font-bold text-base sm:text-lg text-[#163D32]">
                {isBn ? 'ঘরের জায়গার স্মার্ট ব্যবহার (Space Utilization)' : 'Smart Space Utilization Ideas'}
              </h3>
            </div>

            {spaceTips.length === 0 ? (
              <p className="text-xs text-[#163D32]/65 bg-[#F7F9F6] rounded-xl p-5">
                {isBn
                  ? 'নতুন করে রুম বিশ্লেষণ করলে স্মার্ট স্পেস পরামর্শ এখানে দেখা যাবে।'
                  : 'Analyze this photo to unlock zone-specific vertical & corner space optimization.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {spaceTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F7F9F6] border border-[#163D32]/10 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#163D32]">{tip.zone}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#DDF3E5] text-[#163D32] font-bold tabular-nums">
                          {tip.spaceGainEstimate}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-[#163D32]/10 text-[#163D32]/75 font-semibold">
                          {tip.difficulty}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-[#163D32]/80 leading-relaxed">
                      {tip.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Color & Decoration Suggestion */}
          {analysis.colorDecor && (
            <div className="bg-[#F7F9F6] border border-[#163D32]/10 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#163D32]" />
                <h3 className="font-bold text-base sm:text-lg text-[#163D32]">
                  {isBn ? 'AI রঙ ও ডেকোরেশন পরামর্শ' : 'AI Color, Curtain & Decoration Palette'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Wall Swatches */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#163D32]/70">
                    {isBn ? 'দেয়ালের রঙ (ক্লিক করে কোড কপি করুন)' : 'Recommended Wall Colors (Click hex to copy)'}
                  </div>
                  <div className="space-y-2">
                    {analysis.colorDecor.wallColors.map((sw, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCopyHex(sw.hex)}
                        className="w-full bg-white border border-[#163D32]/10 hover:border-[#163D32]/40 rounded-xl p-3 flex items-center gap-3 text-left transition-colors"
                      >
                        <span
                          className="w-10 h-10 rounded-xl border border-[#163D32]/15 shrink-0"
                          style={{ backgroundColor: sw.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-[#163D32]">{sw.name}</span>
                            <span className="font-mono text-xs text-[#163D32]/70">
                              {copiedHex === sw.hex ? 'Copied!' : sw.hex}
                            </span>
                          </div>
                          {sw.reason && (
                            <p className="text-xs text-[#163D32]/65 mt-0.5 line-clamp-2">{sw.reason}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Curtains & Furniture Palette */}
                <div className="space-y-4">
                  <div className="bg-white border border-[#163D32]/10 rounded-xl p-3.5 space-y-1">
                    <div className="text-xs font-bold text-[#163D32]/70 uppercase">
                      {isBn ? 'পর্দা ও টেক্সটাইল পরামর্শ' : 'Curtains & Textiles'}
                    </div>
                    <p className="text-xs sm:text-sm text-[#163D32] leading-relaxed">
                      {analysis.colorDecor.curtainSuggestion}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-[#163D32]/70">
                      {isBn ? 'আসবাব ও অ্যাক্সেন্ট রঙ' : 'Furniture & Accent Palette'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.colorDecor.furniturePalette.map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleCopyHex(f.hex)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#163D32]/10 text-xs font-semibold text-[#163D32]"
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-[#163D32]/20"
                            style={{ backgroundColor: f.hex }}
                          />
                          <span>{f.name}</span>
                          <span className="font-mono text-[11px] text-[#163D32]/60">{f.hex}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {analysis.colorDecor.decorTips.length > 0 && (
                    <div className="bg-white border border-[#163D32]/10 rounded-xl p-3.5 space-y-1.5">
                      <div className="text-xs font-bold text-[#163D32]/70 uppercase">
                        {isBn ? 'ডেকোরেশন টিপস' : 'Decor Styling Tips'}
                      </div>
                      <ul className="space-y-1 text-xs text-[#163D32]/85">
                        {analysis.colorDecor.decorTips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Item Triage & Eco Recycling */}
      {activeTab === 'triage' && (
        <div className="space-y-5">
          {recyclingTips.length > 0 && (
            <div className="bg-[#DDF3E5]/60 border border-[#163D32]/15 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#163D32]">
                <Recycle className="w-4 h-4 text-[#163D32]" />
                <span>{isBn ? 'দান ও রিসাইক্লিং পরামর্শ (Eco Tips)' : 'Donation & Eco-Recycling Suggestions'}</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#163D32]/85">
                {recyclingTips.map((tip, i) => (
                  <li key={i} className="bg-white rounded-xl p-2.5 border border-[#163D32]/10">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#163D32] text-base sm:text-lg">
                {isBn ? '৪-বক্স বাছাই বোর্ড (Keep · Donate · Relocate · Trash)' : '4-Box Item Triage (Keep · Donate · Relocate · Trash)'}
              </h3>
              <p className="text-xs text-[#163D32]/65 mt-0.5 tabular-nums">
                {sortedTriageCount} of {triageList.length} items sorted
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="flex items-center gap-1 bg-[#F7F9F6] p-1 rounded-xl border border-[#163D32]/10 text-xs">
                {(['all', 'keep', 'donate', 'relocate', 'trash'] as const).map((dec) => (
                  <button
                    key={dec}
                    type="button"
                    onClick={() => setTriageFilter(dec)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-colors whitespace-nowrap ${
                      triageFilter === dec ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70'
                    }`}
                  >
                    {dec}
                  </button>
                ))}
              </div>

              {triageList.length < 30 && (
                <button
                  type="button"
                  onClick={() => setShowAddTriage((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#DDF3E5] text-[#163D32]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenToolsTab('donation')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#163D32] text-white"
              >
                <Tag className="w-3.5 h-3.5 text-[#E9B95B]" />
                <span>{isBn ? 'ডোনেশন লিস্টিং' : 'Donation Listing'}</span>
              </button>
            </div>
          </div>

          {showAddTriage && (
            <form
              onSubmit={handleCreateTriageItem}
              className="bg-[#F7F9F6] border border-[#163D32]/15 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end no-print"
            >
              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 block">Item Name</label>
                <input
                  type="text"
                  value={triageItemName}
                  onChange={(e) => setTriageItemName(e.target.value)}
                  placeholder="e.g. Extra desk monitor stand"
                  className="w-full bg-white border border-[#163D32]/15 rounded-xl px-3 py-2 text-xs text-[#163D32] outline-none"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 block">Decision</label>
                <select
                  value={triageDecision}
                  onChange={(e) => setTriageDecision(e.target.value as TriageDecision)}
                  className="w-full bg-white border border-[#163D32]/15 rounded-xl px-2.5 py-2 text-xs text-[#163D32] outline-none"
                >
                  <option value="keep">Keep</option>
                  <option value="donate">Donate / Sell</option>
                  <option value="relocate">Relocate</option>
                  <option value="trash">Trash / Recycle</option>
                </select>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-[#163D32]/75 block">Reason</label>
                <input
                  type="text"
                  value={triageReason}
                  onChange={(e) => setTriageReason(e.target.value)}
                  placeholder="e.g. Unused for 1 year"
                  className="w-full bg-white border border-[#163D32]/15 rounded-xl px-3 py-2 text-xs text-[#163D32] outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-[#163D32] text-white font-bold text-xs rounded-xl"
                >
                  Add Item
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTriage.map((entry) => {
              const info = DECISION_LABELS[entry.decision] || DECISION_LABELS.relocate;
              return (
                <div
                  key={entry.id}
                  className={`bg-[#F7F9F6] border border-[#163D32]/10 rounded-2xl p-4 space-y-3 transition-opacity ${
                    entry.sorted ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onUpdateTriageItem(entry.id, { sorted: !entry.sorted })}
                      className="flex items-start gap-3 text-left min-w-0 flex-1"
                    >
                      <span className="mt-0.5 shrink-0 text-[#163D32]">
                        {entry.sorted ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-[#163D32]/40" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h4
                          className={`font-bold text-sm text-[#163D32] ${
                            entry.sorted ? 'line-through text-[#163D32]/50' : ''
                          }`}
                        >
                          {entry.item}
                        </h4>
                        <p className="text-xs text-[#163D32]/70 mt-1 leading-relaxed">
                          {entry.reason}
                        </p>
                      </div>
                    </button>

                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${info.badgeClass}`}>
                      {info.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-[#163D32]/10">
                    {(['keep', 'donate', 'relocate', 'trash'] as TriageDecision[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onUpdateTriageItem(entry.id, { decision: option })}
                        className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors font-semibold ${
                          entry.decision === option
                            ? 'bg-[#163D32] text-white'
                            : 'text-[#163D32]/65 hover:bg-white'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: Quick Wins Full View */}
      {activeTab === 'wins' && (
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[#163D32]/70">
            Immediate 5-to-10 minute wins to build fast momentum before deeper sorting:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {analysis.quickWins.map((win, idx) => (
              <div
                key={idx}
                className="bg-[#F7F9F6] border border-[#163D32]/10 p-4 rounded-2xl flex items-start gap-3"
              >
                <span className="font-mono text-xs font-bold text-[#163D32] bg-[#E9B95B]/40 px-2 py-0.5 rounded-md tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <p className="text-xs sm:text-sm text-[#163D32] leading-relaxed">{win}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: Problem Areas + 5-Min Spot Rescue */}
      {activeTab === 'problems' && (
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[#163D32]/70">
            Key hotspots identified in your room. Click &ldquo;5-Min Spot Rescue&rdquo; for an instant DIY micro-plan:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.problemAreas.map((problem, idx) => {
              const pKey = problem.id || `prob_${idx}`;
              const isHigh = problem.severity === 'high';
              const isMed = problem.severity === 'medium';
              const rescue = rescuePlans[pKey];
              const isLoadingRescue = rescueLoadingKey === pKey;

              return (
                <div
                  key={pKey}
                  className="bg-[#F7F9F6] border border-[#163D32]/10 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`font-bold capitalize px-2 py-0.5 rounded-md ${
                        isHigh
                          ? 'bg-rose-100 text-rose-700'
                          : isMed
                          ? 'bg-[#E9B95B]/35 text-[#163D32]'
                          : 'bg-[#DDF3E5] text-[#163D32]'
                      }`}
                    >
                      {problem.severity} priority
                    </span>

                    <button
                      type="button"
                      disabled={isLoadingRescue}
                      onClick={() => handleRequestSpotRescue(pKey, problem.title, problem.description)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15 font-bold transition-colors no-print"
                    >
                      {isLoadingRescue ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-[#E9B95B]" />
                      )}
                      <span>{isLoadingRescue ? 'Planning...' : '5-Min Spot Rescue'}</span>
                    </button>
                  </div>

                  <h4 className="font-bold text-sm sm:text-base text-[#163D32]">{problem.title}</h4>
                  <p className="text-xs sm:text-sm text-[#163D32]/75 leading-relaxed">{problem.description}</p>

                  <div className="pt-2 border-t border-[#163D32]/10 text-xs text-[#163D32] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#163D32] shrink-0 mt-0.5" />
                    <div>
                      <strong>Fix: </strong>
                      <span>{problem.recommendation}</span>
                    </div>
                  </div>

                  {rescueErrors[pKey] && <p className="text-xs text-rose-600 pt-1">{rescueErrors[pKey]}</p>}

                  {rescue && (
                    <div className="mt-3 pt-3 border-t border-[#163D32]/15 space-y-2 text-xs bg-white rounded-xl p-3">
                      <div className="font-bold text-[#163D32]">
                        {isBn ? '৫-মিনিটের মাইক্রো-রেসকিউ' : '5-Minute Micro-Rescue'}
                      </div>
                      <ol className="space-y-1 text-[#163D32]/85 list-decimal list-inside">
                        {rescue.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      {rescue.householdDiyHack && (
                        <div className="text-[#163D32] font-medium pt-1">
                          <strong>{isBn ? 'DIY হ্যাক:' : 'DIY Hack:'}</strong> {rescue.householdDiyHack}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 8: Custom Storage Shopping Suggestions & DIY */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-[#163D32]/70">
              {isBn
                ? 'আপনার ঘরের জন্য বাছাইকৃত স্টোরেজ ও অর্গানাইজার শপিং সাজেশন:'
                : 'Custom storage & organizer shopping suggestions tailored for this space:'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-[#163D32] font-bold tabular-nums">
                {acquiredStorageCount} / {analysis.storageRecommendations.length} acquired
              </span>
              <button
                type="button"
                disabled={diyLoading || analysis.storageRecommendations.length === 0}
                onClick={async () => {
                  setDiyLoading(true);
                  setDiyError(null);
                  try {
                    const resp = await fetch('/api/diy-alternatives', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        items: analysis.storageRecommendations.map((s) => s.itemTitle),
                        roomType: analysis.roomType,
                        language,
                      }),
                    });
                    const text = await resp.text();
                    if (text.trim().startsWith('<')) {
                      setDiyError('Server is warming up. Please try again shortly.');
                      return;
                    }
                    const data = JSON.parse(text);
                    if (resp.ok && data.success && Array.isArray(data.substitutes)) {
                      setDiySubstitutes(data.substitutes);
                    } else {
                      setDiyError(data.details || data.error || 'Could not generate DIY hacks.');
                    }
                  } catch (err: any) {
                    setDiyError(err?.message || 'Error contacting server.');
                  } finally {
                    setDiyLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E9B95B]/30 hover:bg-[#E9B95B]/50 text-[#163D32] transition-colors no-print"
              >
                {diyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isBn ? 'বিনা খরচে DIY বিকল্প' : 'Zero-Cost DIY Hacks'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenToolsTab('budget')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#DDF3E5] text-[#163D32]"
              >
                {isBn ? 'বাজেট ক্যালকুলেটর' : 'Budget Calculator'}
              </button>
            </div>
          </div>

          {diyError && <p className="text-xs text-rose-600">{diyError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.storageRecommendations.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onToggleStorageItem(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleStorageItem(idx);
                  }
                }}
                className={`bg-[#F7F9F6] border rounded-2xl p-4 sm:p-5 space-y-2.5 cursor-pointer transition-colors ${
                  item.acquired
                    ? 'border-[#163D32] bg-[#DDF3E5]/40 opacity-70'
                    : 'border-[#163D32]/10 hover:border-[#163D32]/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#163D32]/70 tabular-nums">
                  <span className="font-bold text-[#163D32]">{item.category || 'Storage'}</span>
                  <span className="font-mono font-semibold">Est. {item.estimatedBudget || '$10-$20'}</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[#163D32]">
                    {item.acquired ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[#163D32]/40" />}
                  </span>
                  <h4 className={`font-bold text-sm ${item.acquired ? 'line-through text-[#163D32]/50' : 'text-[#163D32]'}`}>
                    {item.itemTitle}
                  </h4>
                </div>

                <p className="text-xs text-[#163D32]/75 leading-relaxed">{item.purpose}</p>

                <div className="pt-2 border-t border-[#163D32]/10 text-xs text-[#163D32]/70">
                  <strong className="text-[#163D32]">Location: </strong>
                  {item.suggestedLocation}
                </div>
              </div>
            ))}
          </div>

          {diySubstitutes.length > 0 && (
            <div className="bg-[#DDF3E5]/50 border border-[#163D32]/15 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-[#163D32] flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#E9B95B]" />
                <span>{isBn ? 'ঘরোয়া বিনা-খরচে DIY বিকল্প' : 'Zero-Cost Household DIY Substitutes'}</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diySubstitutes.map((sub, i) => (
                  <div key={i} className="bg-white border border-[#163D32]/10 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#163D32]/65 truncate">Instead of: {sub.originalItem}</span>
                      <span className="font-mono font-bold text-[#163D32] shrink-0">Save {sub.estimatedSavings}</span>
                    </div>
                    <div className="font-bold text-sm text-[#163D32]">{sub.diySubstitute}</div>
                    <p className="text-xs text-[#163D32]/75 leading-relaxed">{sub.howToMake}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: Layout, Maintenance Habits & Notes */}
      {activeTab === 'layout' && (
        <div className="space-y-5">
          <div className="bg-[#F7F9F6] border border-[#163D32]/10 p-5 rounded-2xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-bold text-base text-[#163D32] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#163D32]" />
                <span>{isBn ? 'রুমের লেআউট ও ফাংশনাল জোনিং' : 'Spatial Layout & Functional Zoning'}</span>
              </h4>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => onOpenToolsTab('floorplan')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>2D Zone Planner</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenToolsTab('schedule')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#DDF3E5] text-[#163D32] border border-[#163D32]/15"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>7-Day Schedule</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#163D32]/85 leading-relaxed whitespace-pre-line">
              {analysis.layoutAdvice}
            </p>
          </div>

          {analysis.maintenanceHabits && analysis.maintenanceHabits.length > 0 && (
            <div className="bg-[#F7F9F6] border border-[#163D32]/10 p-5 rounded-2xl space-y-3">
              <h4 className="font-bold text-base text-[#163D32] flex items-center gap-2">
                <Repeat className="w-5 h-5 text-[#163D32]" />
                <span>{isBn ? 'দৈনিক ও সাপ্তাহিক অভ্যাস' : 'Daily & Weekly Maintenance Habits'}</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[#163D32]">
                {analysis.maintenanceHabits.map((habit, idx) => {
                  const isChecked = Boolean(checkedHabits[idx]);
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => setCheckedHabits((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="flex items-start gap-2.5 text-left w-full py-1"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#163D32] shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-[#163D32]/40 shrink-0 mt-0.5" />
                        )}
                        <span className={isChecked ? 'line-through text-[#163D32]/50' : ''}>{habit}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="bg-[#F7F9F6] border border-[#163D32]/10 p-5 rounded-2xl space-y-3 no-print">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-[#163D32] flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[#E9B95B]" />
                <span>{isBn ? 'ব্যক্তিগত রুম নোট' : 'Personal Room Notes'}</span>
              </h4>
              {notesSavedToast && (
                <span className="text-xs text-[#163D32] font-bold">Notes saved</span>
              )}
            </div>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value.slice(0, 1500))}
              placeholder={
                isBn
                  ? 'এই রুমের জন্য মাপ, স্টোরেজ বা শপিং নোট লিখে রাখুন...'
                  : 'Write measurements, bin sizes, or reminders for this room...'
              }
              className="w-full bg-white border border-[#163D32]/15 focus:border-[#163D32] rounded-xl p-3 text-xs sm:text-sm text-[#163D32] outline-none resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#163D32]/60 tabular-nums">{notesDraft.length}/1500</span>
              <button
                type="button"
                onClick={() => {
                  onSaveNotes(notesDraft);
                  setNotesSavedToast(true);
                  setTimeout(() => setNotesSavedToast(false), 2500);
                }}
                className="px-4 py-1.5 bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold rounded-xl transition-colors"
              >
                {isBn ? 'নোট সেভ' : 'Save Notes'}
              </button>
            </div>
          </div>

          <div className="bg-[#F7F9F6] border border-[#163D32]/10 p-5 rounded-2xl space-y-2">
            <h4 className="font-bold text-sm text-[#163D32] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#163D32]" />
              <span>{isBn ? 'শনাক্তকৃত জিনিসপত্র' : 'Detected Items Summary'}</span>
            </h4>
            <p className="text-xs sm:text-sm text-[#163D32]/80 leading-relaxed">
              {analysis.detectedItems.join(' · ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
