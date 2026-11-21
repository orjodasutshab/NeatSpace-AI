import React, { useState, useMemo } from 'react';
import {
  CalendarTask,
  OutputLanguage,
  ReminderConfig,
  RoomAnalysis,
  TaskPriority,
  WeeklyScheduleDay,
} from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import {
  CalendarDays,
  Bell,
  BellRing,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface CalendarRemindersViewProps {
  activeRoom: RoomAnalysis | null;
  language: OutputLanguage;
  reminder: ReminderConfig;
  tasks: CalendarTask[];
  onUpdateReminder: (next: ReminderConfig) => void;
  onUpdateWeeklySchedule: (schedule: WeeklyScheduleDay[]) => void;
  onAddTask: (task: Omit<CalendarTask, 'id'>) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (task: CalendarTask) => void;
  onDeleteTask: (id: string) => void;
  onAwardPoints?: (action: string, points: number, minutes?: number) => void;
}

const MOTIVATIONAL_TIPS_EN = [
  'Set a 10-minute timer and clear just ONE flat surface—momentum follows motion.',
  'Follow the "One-Touch Rule": put mail, keys, or jackets in their home immediately.',
  'Keep a permanent donation bag in your closet; drop items in whenever something does not fit.',
  'Never leave a room empty-handed—take one misplaced item back to where it belongs.',
];

const MOTIVATIONAL_TIPS_BN = [
  '১০ মিনিটের টাইমার দিয়ে শুধু একটি টেবিল বা তাক পরিষ্কার করুন—কাজ শুরু করলেই উৎসাহ চলে আসবে।',
  '"ওয়ান-টাচ রুল" মেনে চলুন: চাবি, কাগজ বা কাপড় সাথে সাথে নির্দিষ্ট জায়গায় রাখুন।',
  'আলমারিতে সবসময় একটি ডোনেশন ব্যাগ রাখুন—অপ্রয়োজনীয় কাপড় পেলেই সেখানে রেখে দিন।',
  'ঘর থেকে বের হওয়ার সময় অন্তত একটি অগোছালো জিনিস তার নির্দিষ্ট জায়গায় রেখে যান।',
];

export const CalendarRemindersView: React.FC<CalendarRemindersViewProps> = ({
  activeRoom,
  language,
  reminder,
  tasks,
  onUpdateReminder,
  onUpdateWeeklySchedule,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onAwardPoints,
}) => {
  const isBn = language === 'bn';
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'list'>('weekly');
  const [listFilter, setListFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<WeeklyScheduleDay[]>(
    activeRoom?.weeklySchedule || []
  );

  // Monthly & Task Creation State
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateIso, setSelectedDateIso] = useState(
    today.toISOString().slice(0, 10)
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMins, setNewTaskMins] = useState(15);
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  // Edit & Delete State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CalendarTask | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleGenerateWeekly = async () => {
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const resp = await fetch('/api/deep-clean-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: activeRoom?.roomName || 'Full Home Routine',
          roomType: activeRoom?.roomType || 'general',
          clutterScore: activeRoom?.clutterScore ?? 55,
          dailyMinutes,
          problemAreas: activeRoom?.problemAreas.map((p) => p.title) || [],
          language,
        }),
      });
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        setScheduleError(
          isBn ? 'সার্ভার প্রস্তুত হচ্ছে, একটু পর চেষ্টা করুন।' : 'Server warming up, please try again.'
        );
        return;
      }
      const data = JSON.parse(text);
      if (resp.ok && data.success && Array.isArray(data.schedule)) {
        setSchedule(data.schedule);
        if (activeRoom) {
          onUpdateWeeklySchedule(data.schedule);
        }
      } else {
        setScheduleError(data.details || data.error || 'Could not build schedule.');
      }
    } catch (err: any) {
      setScheduleError(err?.message || 'Error contacting server.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleToggleDay = (idx: number) => {
    const next = schedule.map((d, i) => (i === idx ? { ...d, completed: !d.completed } : d));
    setSchedule(next);
    if (activeRoom) {
      onUpdateWeeklySchedule(next);
    }
    if (!schedule[idx]?.completed) {
      onAwardPoints?.(
        isBn ? `${schedule[idx].day} রুটিন সম্পন্ন` : `Completed ${schedule[idx].day} routine`,
        15,
        schedule[idx].durationMinutes
      );
    }
  };

  const handleAddCalendarTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask({
      dateIso: selectedDateIso,
      title: newTaskTitle.trim(),
      roomName: activeRoom?.roomName || (isBn ? 'সাধারণ বাসা' : 'Home'),
      minutes: newTaskMins,
      priority: newTaskPriority,
      ...(newTaskDeadline ? { deadlineTime: newTaskDeadline } : {}),
      completed: false,
    });
    setNewTaskTitle('');
    setNewTaskDeadline('');
  };

  const handleTestNotification = async () => {
    if (!('Notification' in window)) {
      setNotifStatus(
        isBn
          ? 'ইন-অ্যাপ ডেইলি রিমাইন্ডার সক্রিয় করা হয়েছে!'
          : 'In-app daily reminder banner is active!'
      );
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification(isBn ? 'নিটস্পেস AI রিমাইন্ডার' : 'NeatSpace AI Daily Reset', {
          body: isBn
            ? 'আজকের ১৫ মিনিটের রুম গোছানোর সময় হয়েছে!'
            : 'Time for your 15-minute daily declutter sprint!',
        });
        setNotifStatus(isBn ? 'ব্রাউজার নোটিফিকেশন পাঠানো হয়েছে!' : 'Browser notification sent!');
      } else {
        setNotifStatus(
          isBn
            ? 'ইন-অ্যাপ রিমাইন্ডার বেল দিয়ে নিয়মিত অ্যালার্ট পাবেন।'
            : 'In-app bell reminders enabled.'
        );
      }
    } catch {
      setNotifStatus(isBn ? 'ইন-অ্যাপ রিমাইন্ডার সক্রিয়!' : 'In-app reminder active!');
    }
    setTimeout(() => setNotifStatus(null), 3500);
  };

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ dateIso: string; dayNum: number } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateIso: iso, dayNum: d });
    }
    return cells;
  }, [currentMonth]);

  const selectedDayTasks = tasks.filter((t) => t.dateIso === selectedDateIso);
  const filteredListTasks = useMemo(() => {
    return tasks.filter((tk) => {
      if (listFilter === 'upcoming') return !tk.completed;
      if (listFilter === 'completed') return tk.completed;
      return true;
    });
  }, [tasks, listFilter]);

  const tipList = isBn ? MOTIVATIONAL_TIPS_BN : MOTIVATIONAL_TIPS_EN;
  const dailyTip = tipList[today.getDate() % tipList.length];

  const renderPriorityBadge = (p?: TaskPriority) => {
    const val = p || 'medium';
    if (val === 'high') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 uppercase">
          {isBn ? 'জরুরি' : 'High'}
        </span>
      );
    }
    if (val === 'low') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DDF3E5] text-[#163D32] uppercase">
          {isBn ? 'সাধারণ' : 'Low'}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E9B95B]/35 text-[#163D32] dark:text-[#FDE68A] uppercase">
        {isBn ? 'মাঝারি' : 'Med'}
      </span>
    );
  };

  const renderTaskRow = (task: CalendarTask, showDate = false) => {
    const isEditing = editingTaskId === task.id && editDraft;
    if (isEditing) {
      return (
        <div
          key={task.id}
          className="p-3 rounded-xl bg-white dark:bg-[#13241D] border border-[#163D32]/30 space-y-2"
        >
          <input
            type="text"
            value={editDraft.title}
            onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-lg px-2.5 py-1.5 text-xs text-[#163D32] dark:text-[#EDF4EF]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={editDraft.dateIso}
              onChange={(e) => setEditDraft({ ...editDraft, dateIso: e.target.value })}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            />
            <input
              type="time"
              value={editDraft.deadlineTime || ''}
              onChange={(e) => setEditDraft({ ...editDraft, deadlineTime: e.target.value })}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            />
            <select
              value={editDraft.priority || 'medium'}
              onChange={(e) =>
                setEditDraft({ ...editDraft, priority: e.target.value as TaskPriority })
              }
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (editDraft.title.trim()) {
                    onUpdateTask(editDraft);
                  }
                  setEditingTaskId(null);
                  setEditDraft(null);
                }}
                aria-label="Save task edit"
                className="p-1.5 rounded-lg bg-[#163D32] text-white"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTaskId(null);
                  setEditDraft(null);
                }}
                aria-label="Cancel task edit"
                className="p-1.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32] dark:text-[#EDF4EF]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={task.id}
        className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
          task.completed
            ? 'bg-[#DDF3E5]/50 dark:bg-[#1A3329]/70 border-[#163D32]/20 opacity-70'
            : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638]'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleTask(task.id)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
        >
          {task.completed ? (
            <CheckSquare className="w-4 h-4 text-[#163D32] dark:text-[#6EE7B7] shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-[#163D32]/40 dark:text-[#9FC6B0] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-xs sm:text-sm font-semibold truncate ${
                  task.completed
                    ? 'line-through text-[#163D32]/50 dark:text-[#93B4A2]'
                    : 'text-[#163D32] dark:text-[#EDF4EF]'
                }`}
              >
                {task.title}
              </span>
              {renderPriorityBadge(task.priority)}
            </div>
            <div className="text-[11px] text-[#163D32]/60 dark:text-[#9FC6B0] flex flex-wrap items-center gap-1.5">
              <span>{task.roomName}</span>
              {showDate && <span>· {task.dateIso}</span>}
              {task.deadlineTime && <span>· {task.deadlineTime}</span>}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs font-mono text-[#163D32]/70 dark:text-[#E9B95B] flex items-center gap-1 mr-1 tabular-nums">
            <Clock className="w-3 h-3" />
            {task.minutes}m
          </span>
          <button
            type="button"
            onClick={() => {
              setEditingTaskId(task.id);
              setEditDraft({ ...task });
            }}
            aria-label="Edit task"
            className="p-1.5 rounded-lg text-[#163D32]/45 dark:text-[#9FC6B0] hover:text-[#163D32]"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteId(task.id)}
            aria-label="Delete task"
            className="p-1.5 rounded-lg text-[#163D32]/45 dark:text-[#9FC6B0] hover:text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + View Switcher */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'রুটিন ও রিমাইন্ডার' : 'Routines & Reminders'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
            {isBn ? 'সাপ্তাহিক, মাসিক ও তালিকা ক্যালেন্ডার' : 'Weekly, Monthly & List Cleaning Calendar'}
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl w-fit">
          {[
            { id: 'weekly', label: isBn ? '৭ দিনের রুটিন' : 'Weekly' },
            { id: 'monthly', label: isBn ? 'মাসিক' : 'Monthly' },
            { id: 'list', label: isBn ? 'সব কাজ' : 'Task List' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id as typeof viewMode)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === mode.id
                  ? 'bg-[#163D32] text-white'
                  : 'text-[#163D32]/75 dark:text-[#B9D1C3]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Reminder + Motivational Tip Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#DDF3E5] flex items-center justify-center text-[#163D32]">
                {reminder.enabled ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'দৈনিক ক্লিনিং রিমাইন্ডার' : 'Daily Cleaning Reminder'}
                </h3>
                <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                  {isBn
                    ? 'প্রতিদিন নির্দিষ্ট সময়ে গোছানোর রিমাইন্ডার সেট করুন'
                    : 'Schedule a calm daily nudge to stay on top of clutter'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateReminder({ ...reminder, enabled: !reminder.enabled })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                reminder.enabled
                  ? 'bg-[#163D32] text-white'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/70 dark:text-[#B9D1C3] border border-[#163D32]/15 dark:border-[#264638]'
              }`}
            >
              {reminder.enabled ? (isBn ? 'চালু আছে' : 'Enabled') : (isBn ? 'বন্ধ' : 'Paused')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'রিমাইন্ডার সময়' : 'Reminder Time'}
              </label>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => onUpdateReminder({ ...reminder, time: e.target.value })}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-[#163D32] dark:text-[#EDF4EF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'ফ্রিকোয়েন্সি' : 'Cadence'}
              </label>
              <select
                value={reminder.frequency}
                onChange={(e) =>
                  onUpdateReminder({
                    ...reminder,
                    frequency: e.target.value as ReminderConfig['frequency'],
                  })
                }
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
              >
                <option value="daily">{isBn ? 'প্রতিদিন' : 'Every Day'}</option>
                <option value="weekdays">{isBn ? 'কর্মদিবস (সোম-শুক্র)' : 'Weekdays'}</option>
                <option value="weekends">{isBn ? 'সাপ্তাহিক ছুটি' : 'Weekends'}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleTestNotification}
              className="py-2 px-3 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold transition-colors"
            >
              {isBn ? 'রিমাইন্ডার টেস্ট করুন' : 'Enable & Test Alert'}
            </button>
          </div>

          {notifStatus && (
            <p className="text-xs font-semibold text-[#163D32] dark:text-[#6EE7B7] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{notifStatus}</span>
            </p>
          )}
        </div>

        {/* Motivational Cleaning Tip Card */}
        <div className="lg:col-span-5 bg-[#163D32] text-white rounded-2xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2 text-[#E9B95B] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>{isBn ? 'আজকের অনুপ্রেরণামূলক টিপস' : 'Daily Motivational Habit'}</span>
          </div>
          <p className="text-sm sm:text-base font-medium leading-relaxed text-[#DDF3E5]">
            &ldquo;{dailyTip}&rdquo;
          </p>
          <div className="text-xs text-white/70">
            {isBn
              ? 'ছোট ছোট পদক্ষেপই ঘরকে চিরস্থায়ীভাবে পরিপাটি রাখে।'
              : 'Small 10-minute resets prevent weekend overwhelm.'}
          </div>
        </div>
      </div>

      {/* Weekly 7-Day Planner */}
      {viewMode === 'weekly' && (
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                {activeRoom
                  ? `${activeRoom.roomName} — ${isBn ? '৭ দিনের রিসেট প্ল্যান' : '7-Day Reset Plan'}`
                  : isBn
                  ? '৭ দিনের পার্সোনালাইজড রিসেট প্ল্যান'
                  : '7-Day Personalized Reset Schedule'}
              </h3>
              <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-0.5">
                {isBn
                  ? 'প্রতিদিন আপনার হাতে থাকা সময় অনুযায়ী AI রুটিন তৈরি করুন'
                  : 'Generate a realistic 7-day plan tailored to your daily time budget'}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
                className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
              >
                <option value={10}>10m / {isBn ? 'দিন' : 'day'}</option>
                <option value={15}>15m / {isBn ? 'দিন' : 'day'}</option>
                <option value={30}>30m / {isBn ? 'দিন' : 'day'}</option>
                <option value={45}>45m / {isBn ? 'দিন' : 'day'}</option>
              </select>

              <button
                type="button"
                disabled={loadingSchedule}
                onClick={handleGenerateWeekly}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors"
              >
                {loadingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarDays className="w-4 h-4 text-[#E9B95B]" />
                )}
                <span>{isBn ? '৭ দিনের প্ল্যান তৈরি করুন' : 'Build 7-Day Plan'}</span>
              </button>
            </div>
          </div>

          {scheduleError && <p className="text-xs text-rose-600 dark:text-rose-400">{scheduleError}</p>}

          {schedule.length === 0 ? (
            <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-dashed border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-8 text-center">
              <CalendarDays className="w-9 h-9 text-[#163D32]/30 dark:text-[#9FC6B0]/35 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'এখনও কোনো সাপ্তাহিক রুটিন তৈরি হয়নি' : 'No 7-day schedule generated yet'}
              </p>
              <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-1">
                {isBn
                  ? 'উপরের "৭ দিনের প্ল্যান তৈরি করুন" বাটনে ক্লিক করে AI রুটিন তৈরি করুন।'
                  : 'Click "Build 7-Day Plan" above to create bite-sized daily goals.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {schedule.map((entry, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleDay(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleDay(idx);
                    }
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-colors space-y-2.5 ${
                    entry.completed
                      ? 'bg-[#DDF3E5]/50 dark:bg-[#1A3329] border-[#163D32]/30 opacity-75'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-1.5">
                      {entry.completed ? (
                        <CheckSquare className="w-4 h-4 text-[#163D32] dark:text-[#6EE7B7]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#163D32]/40 dark:text-[#9FC6B0]" />
                      )}
                      {entry.day}
                    </span>
                    <span className="font-mono text-[#163D32]/70 dark:text-[#E9B95B] tabular-nums">
                      {entry.durationMinutes}m
                    </span>
                  </div>
                  <div className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                    {entry.focus}
                  </div>
                  <ul className="space-y-1 text-xs text-[#163D32]/75 dark:text-[#B9D1C3]">
                    {entry.tasks.map((tk, ti) => (
                      <li key={ti} className="leading-snug">
                        • {tk}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monthly Calendar View */}
      {viewMode === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                {currentMonth.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
                >
                  →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[#163D32]/60 dark:text-[#9FC6B0]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} />;
                const dayTasks = tasks.filter((t) => t.dateIso === cell.dateIso);
                const isSelected = cell.dateIso === selectedDateIso;
                const isToday = cell.dateIso === today.toISOString().slice(0, 10);
                return (
                  <button
                    key={cell.dateIso}
                    type="button"
                    onClick={() => setSelectedDateIso(cell.dateIso)}
                    className={`min-h-[48px] p-1.5 rounded-xl border flex flex-col items-center justify-between text-xs font-semibold transition-colors tabular-nums ${
                      isSelected
                        ? 'bg-[#163D32] text-white border-[#163D32]'
                        : isToday
                        ? 'bg-[#DDF3E5] text-[#163D32] border-[#163D32]/40'
                        : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32] dark:text-[#EDF4EF] border-transparent hover:border-[#163D32]/25'
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {dayTasks.length > 0 && (
                      <span
                        className={`text-[10px] font-mono ${
                          isSelected ? 'text-[#E9B95B]' : 'text-[#163D32]/70 dark:text-[#9FC6B0]'
                        }`}
                      >
                        {dayTasks.filter((t) => t.completed).length}/{dayTasks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF]">
              {selectedDateIso} · {isBn ? 'কাজের তালিকা' : 'Scheduled Tasks'}
            </h3>

            <form onSubmit={handleAddCalendarTask} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={isBn ? 'যেমন: আলমারি গোছানো' : 'e.g. Clear kitchen counter'}
                  className="flex-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-[#163D32] text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={newTaskMins}
                  onChange={(e) => setNewTaskMins(Number(e.target.value))}
                  className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#163D32] dark:text-[#EDF4EF]"
                >
                  <option value={10}>10m</option>
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={45}>45m</option>
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
                >
                  <option value="high">{isBn ? 'জরুরি' : 'High Priority'}</option>
                  <option value="medium">{isBn ? 'মাঝারি' : 'Medium'}</option>
                  <option value="low">{isBn ? 'সাধারণ' : 'Low'}</option>
                </select>
                <input
                  type="time"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  aria-label="Optional deadline time"
                  className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#163D32] dark:text-[#EDF4EF]"
                />
              </div>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {selectedDayTasks.length === 0 ? (
                <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-6 text-center">
                  {isBn
                    ? 'এই তারিখে কোনো কাজ যোগ করা হয়নি।'
                    : 'No cleaning tasks scheduled for this date.'}
                </p>
              ) : (
                selectedDayTasks.map((task) => renderTaskRow(task, false))
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'upcoming', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setListFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border ${
                    listFilter === f
                      ? 'bg-[#163D32] text-white border-[#163D32]'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3] border-[#163D32]/10 dark:border-[#264638]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono tabular-nums text-[#163D32]/70 dark:text-[#9FC6B0]">
              {filteredListTasks.length} {isBn ? 'টি কাজ' : 'tasks'}
            </span>
          </div>

          <form onSubmit={handleAddCalendarTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={isBn ? 'নতুন নির্ধারিত কাজ লিখুন...' : 'Add scheduled cleaning task...'}
              className="sm:col-span-5 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
            <input
              type="date"
              value={selectedDateIso}
              onChange={(e) => setSelectedDateIso(e.target.value)}
              className="sm:col-span-2 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            />
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
              className="sm:col-span-2 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="time"
              value={newTaskDeadline}
              onChange={(e) => setNewTaskDeadline(e.target.value)}
              className="sm:col-span-2 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-2 text-xs text-[#163D32] dark:text-[#EDF4EF]"
            />
            <button
              type="submit"
              className="sm:col-span-1 py-2 px-3 rounded-xl bg-[#163D32] text-white text-xs font-bold flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {filteredListTasks.length === 0 ? (
            <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-8 text-center">
              {isBn ? 'এই ফিল্টারে কোনো কাজ পাওয়া যায়নি।' : 'No scheduled tasks found for this filter.'}
            </p>
          ) : (
            <div className="space-y-2">{filteredListTasks.map((tk) => renderTaskRow(tk, true))}</div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteId)}
        title={isBn ? 'কাজটি মুছে ফেলবেন?' : 'Delete Scheduled Task?'}
        description={
          isBn
            ? 'এই ক্লিনিং টাস্কটি ক্যালেন্ডার থেকে স্থায়ীভাবে মুছে যাবে।'
            : 'This scheduled task will be permanently deleted from your calendar.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={() => {
          if (pendingDeleteId) onDeleteTask(pendingDeleteId);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
