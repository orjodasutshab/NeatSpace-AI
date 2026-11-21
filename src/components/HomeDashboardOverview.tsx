import React, { useMemo } from 'react';
import {
  RoomAnalysis,
  CalendarTask,
  CleaningHistoryEntry,
  OutputLanguage,
  WorkspaceSection,
} from '../types';
import {
  Camera,
  CheckCircle2,
  Clock,
  Flame,
  FolderHeart,
  Wand2,
  CalendarDays,
  Package,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ListTodo,
} from 'lucide-react';

interface HomeDashboardOverviewProps {
  firstName: string;
  language: OutputLanguage;
  savedRooms: RoomAnalysis[];
  activeRoom: RoomAnalysis | null;
  calendarTasks: CalendarTask[];
  history: CleaningHistoryEntry[];
  streakDays: number;
  points: number;
  organizedPercent: number;
  onNavigate: (section: WorkspaceSection) => void;
  onSelectRoom: (room: RoomAnalysis) => void;
  onQuickUpload: () => void;
}

export const HomeDashboardOverview: React.FC<HomeDashboardOverviewProps> = ({
  firstName,
  language,
  savedRooms,
  activeRoom,
  calendarTasks,
  history,
  streakDays,
  points,
  organizedPercent,
  onNavigate,
  onSelectRoom,
  onQuickUpload,
}) => {
  const isBn = language === 'bn';

  const allRooms = useMemo(() => {
    const list = [...savedRooms];
    if (activeRoom && !list.some((r) => r.id === activeRoom.id)) {
      list.unshift(activeRoom);
    }
    return list;
  }, [savedRooms, activeRoom]);

  const totalTasks = allRooms.reduce((sum, r) => sum + r.actionPlan.length, 0) + calendarTasks.length;
  const completedTasks =
    allRooms.reduce((sum, r) => sum + r.actionPlan.filter((s) => s.completed).length, 0) +
    calendarTasks.filter((t) => t.completed).length;
  const pendingTasks = Math.max(0, totalTasks - completedTasks);

  // Real 7-day activity histogram from CleaningHistoryEntry
  const weeklyChart = useMemo(() => {
    const days: Array<{ label: string; count: number; minutes: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { weekday: 'short' });
      const dayEntries = history.filter((h) => new Date(h.timestamp).toISOString().slice(0, 10) === iso);
      days.push({
        label: dayLabel,
        count: dayEntries.length,
        minutes: dayEntries.reduce((s, e) => s + (e.minutes || 0), 0),
      });
    }
    const maxCount = Math.max(1, ...days.map((d) => d.count));
    return { days, maxCount };
  }, [history, isBn]);

  const upcomingTasks = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const pendingCal = calendarTasks
      .filter((t) => !t.completed && t.dateIso >= todayIso)
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: `${t.roomName} · ${t.dateIso}`,
        mins: `${t.minutes}m`,
        section: 'calendar' as WorkspaceSection,
      }));

    if (pendingCal.length >= 3) return pendingCal;

    const roomSteps = (activeRoom || savedRooms[0])?.actionPlan
      .filter((s) => !s.completed)
      .slice(0, 3 - pendingCal.length)
      .map((s) => ({
        id: `step_${s.stepNumber}`,
        title: s.title,
        meta: (activeRoom || savedRooms[0])?.roomName || 'Room Plan',
        mins: s.timeEstimate,
        section: 'dashboard' as WorkspaceSection,
      })) || [];

    return [...pendingCal, ...roomSteps];
  }, [calendarTasks, activeRoom, savedRooms]);

  const recentAiSuggestions = useMemo(() => {
    const latest = activeRoom || savedRooms[0];
    if (!latest) return [];
    const list: string[] = [];
    if (latest.quickWins[0]) list.push(latest.quickWins[0]);
    if (latest.spaceUtilization?.[0]) {
      list.push(`${latest.spaceUtilization[0].zone}: ${latest.spaceUtilization[0].suggestion}`);
    }
    if (latest.minimalistTip) list.push(latest.minimalistTip);
    return list.slice(0, 3);
  }, [activeRoom, savedRooms]);

  return (
    <div className="space-y-5">
      {/* Top Personalized Welcome & KPI Cards */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#163D32]/65 dark:text-[#9FC6B0]">
              {isBn ? 'হোম অর্গানাইজেশন ওভারভিউ' : 'Home Organization Overview'}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? `স্বাগতম, ${firstName}` : `Welcome back, ${firstName}`}
            </h2>
            <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3]">
              {allRooms.length === 0
                ? isBn
                  ? 'আপনার প্রথম রুম স্ক্যান করে পার্সোনালাইজড প্ল্যান শুরু করুন।'
                  : 'Upload your first room photo below to unlock clutter scoring, redesign previews, and custom checklists.'
                : isBn
                ? `${allRooms.length}টি রুম থেকে আপনার ঘর ${organizedPercent}% গোছানো হয়েছে।`
                : `Your tracked spaces are ${organizedPercent}% organized across ${allRooms.length} room(s).`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickUpload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              <span>{isBn ? 'রুম স্ক্যান করুন' : 'Analyze Room'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('redesign')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Wand2 className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'AI রিডিজাইন' : 'AI Redesign'}</span>
            </button>
          </div>
        </div>

        {/* 5 Real KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#DDF3E5]/55 dark:bg-[#1A3329] border border-[#163D32]/10 dark:border-[#2B4E3F] rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#A9CBB8]">
              {isBn ? 'হোম স্কোর' : 'Org Score'}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              {organizedPercent}%
            </div>
            <div className="w-full h-1.5 bg-white/80 dark:bg-[#0D1A15] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#163D32] dark:bg-[#E9B95B] rounded-full transition-all"
                style={{ width: `${organizedPercent}%` }}
              />
            </div>
          </div>

          <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#A9CBB8] flex items-center gap-1">
              <FolderHeart className="w-3.5 h-3.5" />
              <span>{isBn ? 'মোট রুম' : 'Total Rooms'}</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              {allRooms.length}
            </div>
            <div className="text-[11px] text-[#163D32]/60 dark:text-[#93B4A2] mt-1">
              {isBn ? 'সংরক্ষিত ও সক্রিয়' : 'Saved & active'}
            </div>
          </div>

          <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#A9CBB8] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#163D32] dark:text-[#6EE7B7]" />
              <span>{isBn ? 'সম্পন্ন কাজ' : 'Completed'}</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              {completedTasks}
            </div>
            <div className="text-[11px] text-[#163D32]/60 dark:text-[#93B4A2] mt-1">
              {isBn ? 'কাজ শেষ হয়েছে' : 'Tasks finished'}
            </div>
          </div>

          <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#A9CBB8] flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" />
              <span>{isBn ? 'বাকি কাজ' : 'Pending'}</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              {pendingTasks}
            </div>
            <div className="text-[11px] text-[#163D32]/60 dark:text-[#93B4A2] mt-1">
              {isBn ? 'চেকলিস্ট ও ক্যালেন্ডার' : 'Plans & schedule'}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-[#163D32]/70 dark:text-[#A9CBB8] flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#E9B95B]" />
              <span>{isBn ? 'স্ট্রিক ও পয়েন্ট' : 'Streak & Points'}</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF] mt-1">
              {streakDays}d · {points}
            </div>
            <div className="text-[11px] text-[#163D32]/60 dark:text-[#93B4A2] mt-1">
              {isBn ? 'দৈনিক অভ্যাস' : 'Active momentum'}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Bento: 7-Day Activity Chart + Upcoming Tasks + Recent Rooms / AI Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Weekly Progress Chart */}
        <div className="lg:col-span-4 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
              <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? '৭ দিনের অগ্রগতি' : 'Weekly Cleaning Activity'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stats')}
              className="text-xs font-semibold text-[#163D32] dark:text-[#9FC6B0] hover:underline"
            >
              {isBn ? 'বিস্তারিত' : 'Stats'} →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
            {weeklyChart.days.map((day, idx) => {
              const heightPct = day.count > 0 ? Math.max(18, Math.round((day.count / weeklyChart.maxCount) * 100)) : 8;
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-[#163D32]/65 dark:text-[#93B4A2]">
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div className="w-full max-w-[26px] flex-1 flex items-end">
                    <div
                      title={`${day.label}: ${day.count} actions (${day.minutes}m)`}
                      className={`w-full rounded-lg transition-all ${
                        day.count > 0
                          ? 'bg-[#163D32] dark:bg-[#E9B95B]'
                          : 'bg-[#DDF3E5]/70 dark:bg-[#1F3A2F]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[#163D32]/70 dark:text-[#B9D1C3]">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Scheduled Tasks */}
        <div className="lg:col-span-4 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
              <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'আসন্ন কাজ' : 'Upcoming Tasks'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="text-xs font-semibold text-[#163D32] dark:text-[#9FC6B0] hover:underline"
            >
              {isBn ? 'ক্যালেন্ডার' : 'Calendar'} →
            </button>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#163D32]/60 dark:text-[#93B4A2] space-y-2">
              <p>{isBn ? 'কোনো বাকি কাজ নেই।' : 'No pending tasks scheduled yet.'}</p>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="px-3 py-1.5 rounded-xl bg-[#DDF3E5] text-[#163D32] font-bold text-xs"
              >
                {isBn ? 'কাজ যোগ করুন' : 'Schedule Task'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((tk) => (
                <button
                  key={tk.id}
                  type="button"
                  onClick={() => onNavigate(tk.section)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/50 dark:hover:bg-[#1E372D] border border-[#163D32]/10 dark:border-[#264638] flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                      {tk.title}
                    </div>
                    <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0] truncate">
                      {tk.meta}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#163D32]/75 dark:text-[#E9B95B] flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {tk.mins}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Rooms & Quick AI Insight */}
        <div className="lg:col-span-4 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E9B95B]" />
              <h3 className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                {allRooms.length > 0
                  ? isBn
                    ? 'সাম্প্রতিক রুম ও পরামর্শ'
                    : 'Recent Rooms & AI Tips'
                  : isBn
                  ? 'দ্রুত টুলস'
                  : 'Quick Shortcuts'}
              </h3>
            </div>
            {allRooms.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('rooms')}
                className="text-xs font-semibold text-[#163D32] dark:text-[#9FC6B0] hover:underline"
              >
                {isBn ? 'সব রুম' : 'View All'} →
              </button>
            )}
          </div>

          {allRooms.length > 0 ? (
            <div className="space-y-2">
              {allRooms.slice(0, 2).map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectRoom(room)}
                  className="w-full text-left p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/50 border border-[#163D32]/10 dark:border-[#264638] flex items-center justify-between gap-2.5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={room.imageUrl}
                      alt={room.roomName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {room.roomName}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#163D32]/65 dark:text-[#9FC6B0]">
                        {room.clutterScore}/100 · {room.actionPlan.filter((s) => s.completed).length}/
                        {room.actionPlan.length}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#163D32]/50 shrink-0" />
                </button>
              ))}
              {recentAiSuggestions[0] && (
                <div className="p-2.5 rounded-xl bg-[#DDF3E5]/60 dark:bg-[#1A3329] text-[11px] text-[#163D32] dark:text-[#DDF3E5] leading-snug line-clamp-2">
                  <strong>{isBn ? 'AI টিপস:' : 'AI Tip:'}</strong> {recentAiSuggestions[0]}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-left space-y-1 hover:bg-[#DDF3E5]/40"
              >
                <Package className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
                <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'স্টোরেজ লিস্ট' : 'Inventory'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('gallery')}
                className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-left space-y-1 hover:bg-[#DDF3E5]/40"
              >
                <Wand2 className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
                <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'আগে ও পরে' : 'Gallery'}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
