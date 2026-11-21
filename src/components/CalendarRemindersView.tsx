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
  'Set a 10-minute timer and clear just ONE flat surfaceâ€”momentum follows motion.',
  'Follow the "One-Touch Rule": put mail, keys, or jackets in their home immediately.',
  'Keep a permanent donation bag in your closet; drop items in whenever something does not fit.',
  'Never leave a room empty-handedâ€”take one misplaced item back to where it belongs.',
];

const MOTIVATIONAL_TIPS_BN = [
  'à§§à§¦ à¦®à¦¿à¦¨à¦¿à¦Ÿà§‡à¦° à¦Ÿà¦¾à¦‡à¦®à¦¾à¦° à¦¦à¦¿à§Ÿà§‡ à¦¶à§à¦§à§ à¦à¦•à¦Ÿà¦¿ à¦Ÿà§‡à¦¬à¦¿à¦² à¦¬à¦¾ à¦¤à¦¾à¦• à¦ªà¦°à¦¿à¦·à§à¦•à¦¾à¦° à¦•à¦°à§à¦¨â€”à¦•à¦¾à¦œ à¦¶à§à¦°à§ à¦•à¦°à¦²à§‡à¦‡ à¦‰à§Žà¦¸à¦¾à¦¹ à¦šà¦²à§‡ à¦†à¦¸à¦¬à§‡à¥¤',
  '"à¦“à§Ÿà¦¾à¦¨-à¦Ÿà¦¾à¦š à¦°à§à¦²" à¦®à§‡à¦¨à§‡ à¦šà¦²à§à¦¨: à¦šà¦¾à¦¬à¦¿, à¦•à¦¾à¦—à¦œ à¦¬à¦¾ à¦•à¦¾à¦ªà§œ à¦¸à¦¾à¦¥à§‡ à¦¸à¦¾à¦¥à§‡ à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦œà¦¾à§Ÿà¦—à¦¾à§Ÿ à¦°à¦¾à¦–à§à¦¨à¥¤',
  'à¦†à¦²à¦®à¦¾à¦°à¦¿à¦¤à§‡ à¦¸à¦¬à¦¸à¦®à§Ÿ à¦à¦•à¦Ÿà¦¿ à¦¡à§‹à¦¨à§‡à¦¶à¦¨ à¦¬à§à¦¯à¦¾à¦— à¦°à¦¾à¦–à§à¦¨â€”à¦…à¦ªà§à¦°à§Ÿà§‹à¦œà¦¨à§€à§Ÿ à¦•à¦¾à¦ªà§œ à¦ªà§‡à¦²à§‡à¦‡ à¦¸à§‡à¦–à¦¾à¦¨à§‡ à¦°à§‡à¦–à§‡ à¦¦à¦¿à¦¨à¥¤',
  'à¦˜à¦° à¦¥à§‡à¦•à§‡ à¦¬à§‡à¦° à¦¹à¦“à§Ÿà¦¾à¦° à¦¸à¦®à§Ÿ à¦…à¦¨à§à¦¤à¦¤ à¦à¦•à¦Ÿà¦¿ à¦…à¦—à§‹à¦›à¦¾à¦²à§‹ à¦œà¦¿à¦¨à¦¿à¦¸ à¦¤à¦¾à¦° à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦œà¦¾à§Ÿà¦—à¦¾à§Ÿ à¦°à§‡à¦–à§‡ à¦¯à¦¾à¦¨à¥¤',
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
          isBn ? 'à¦¸à¦¾à¦°à§à¦­à¦¾à¦° à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤ à¦¹à¦šà§à¦›à§‡, à¦à¦•à¦Ÿà§ à¦ªà¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨à¥¤' : 'Server warming up, please try again.'
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
        isBn ? `${schedule[idx].day} à¦°à§à¦Ÿà¦¿à¦¨ à¦¸à¦®à§à¦ªà¦¨à§à¦¨` : `Completed ${schedule[idx].day} routine`,
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
      roomName: activeRoom?.roomName || (isBn ? 'à¦¸à¦¾à¦§à¦¾à¦°à¦£ à¦¬à¦¾à¦¸à¦¾' : 'Home'),
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
          ? 'à¦‡à¦¨-à¦…à§à¦¯à¦¾à¦ª à¦¡à§‡à¦‡à¦²à¦¿ à¦°à¦¿à¦®à¦¾à¦‡à¦¨à§à¦¡à¦¾à¦° à¦¸à¦•à§à¦°à¦¿à§Ÿ à¦•à¦°à¦¾ à¦¹à§Ÿà§‡à¦›à§‡!'
          : 'In-app daily reminder banner is active!'
      );
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification(isBn ? 'à¦¨à¦¿à¦Ÿà¦¸à§à¦ªà§‡à¦¸ AI à¦°à¦¿à¦®à¦¾à¦‡à¦¨à§à¦¡à¦¾à¦°' : 'NeatSpace AI Daily Reset', {
          body: isBn
            ? 'à¦†à¦œà¦•à§‡à¦° à§§à§« à¦®à¦¿à¦¨à¦¿à¦Ÿà§‡à¦° à¦°à§à¦® à¦—à§‹à¦›à¦¾à¦¨à§‹à¦° à¦¸à¦®à§Ÿ à¦¹à§Ÿà§‡à¦›à§‡!'
            : 'Time for your 15-minute daily declutter sprint!',
        });
        setNotifStatus(isBn ? 'à¦¬à§à¦°à¦¾à¦‰à¦œà¦¾à¦° à¦¨à§‹à¦Ÿà¦¿à¦«à¦¿à¦•à§‡à¦¶à¦¨ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à§Ÿà§‡à¦›à§‡!' : 'Browser notification sent!');
      } else {
        setNotifStatus(
          isBn
            ? 'à¦‡à¦¨-à¦…à§à¦¯à¦¾à¦ª à¦°à¦¿à¦®à¦¾à¦‡à¦¨à§à¦¡à¦¾à¦° à¦¬à§‡à¦² à¦¦à¦¿à§Ÿà§‡ à¦¨à¦¿à§Ÿà¦®à¦¿à¦¤ à¦…à§à¦¯à¦¾à¦²à¦¾à¦°à§à¦Ÿ à¦ªà¦¾à¦¬à§‡à¦¨à¥¤'
            : 'In-app bell reminders enabled.'
        );
      }
    } catch {
      setNotifStatus(isBn ? 'à¦‡à¦¨-à¦…à§à¦¯à¦¾à¦ª à¦°à¦¿à¦®à¦¾à¦‡à¦¨à§à¦¡à¦¾à¦° à¦¸à¦•à§à¦°à¦¿à§Ÿ!' : 'In-app reminder active!');
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
          {isBn ? 'à¦œà¦°à§à¦°à¦¿' : 'High'}
        </span>
      );
    }
    if (val === 'low') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DDF3E5] text-[#163D32] uppercase">
          {isBn ? 'à¦¸à¦¾à¦§à¦¾à¦°à¦£' : 'Low'}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E9B95B]/35 text-[#163D32] dark:text-[#FDE68A] uppercase">
        {isBn ? 'à¦®à¦¾à¦à¦¾à¦°à¦¿' : 'Med'}
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
