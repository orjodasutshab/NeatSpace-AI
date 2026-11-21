import React, { useState } from 'react';
import {
  AchievementBadge,
  CleaningHistoryEntry,
  OutputLanguage,
  RoomAnalysis,
} from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Award,
  Flame,
  History,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Zap,
  Recycle,
  Calendar,
  Users,
} from 'lucide-react';

interface DashboardStatsViewProps {
  savedRooms: RoomAnalysis[];
  activeRoom: RoomAnalysis | null;
  history: CleaningHistoryEntry[];
  points: number;
  streakDays: number;
  focusMinutesTotal: number;
  language: OutputLanguage;
  onSelectRoom: (room: RoomAnalysis) => void;
  onClearHistory: () => void;
}

const BADGE_CATALOG: AchievementBadge[] = [
  {
    id: 'first_scan',
    title: 'First Clarity Scan',
    titleBn: 'প্রথম রুম স্ক্যান',
    description: 'Earned 25+ organizer points',
    descriptionBn: '২৫+ অর্গানাইজার পয়েন্ট অর্জন',
    pointsRequired: 25,
    icon: 'sparkles',
  },
  {
    id: 'quick_sprinter',
    title: 'Sprint Finisher',
    titleBn: 'স্প্রিন্ট ফিনিশার',
    description: 'Reached 75+ organizer points',
    descriptionBn: '৭৫+ পয়েন্ট সংগ্রহ করেছেন',
    pointsRequired: 75,
    icon: 'zap',
  },
  {
    id: 'eco_sorter',
    title: 'Eco & Donation Hero',
    titleBn: 'রিসাইকেল ও ডোনেশন হিরো',
    description: 'Reached 150+ points triaging & decluttering',
    descriptionBn: '১৫০+ পয়েন্ট বাছাই ও ডিক্লাটারিং',
    pointsRequired: 150,
    icon: 'recycle',
  },
  {
    id: 'habit_builder',
    title: 'Routine Keeper',
    titleBn: 'রুটিন রক্ষক',
    description: 'Reached 250+ organization points',
    descriptionBn: '২৫০+ অর্গানাইজেশন পয়েন্ট',
    pointsRequired: 250,
    icon: 'calendar',
  },
  {
    id: 'home_architect',
    title: 'Clutter Conqueror',
    titleBn: 'ক্লাটার বিজয়ী',
    description: 'Master level at 500+ points',
    descriptionBn: '৫০০+ পয়েন্টে মাস্টার লেভেল',
    pointsRequired: 500,
    icon: 'award',
  },
  {
    id: 'team_lead',
    title: 'Household Captain',
    titleBn: 'ফ্যামিলি ক্যাপ্টেন',
    description: 'Legendary status at 800+ points',
    descriptionBn: '৮০০+ পয়েন্টে সর্বোচ্চ সম্মাননা',
    pointsRequired: 800,
    icon: 'users',
  },
];

function renderBadgeIcon(kind: AchievementBadge['icon'], unlocked: boolean) {
  const cls = `w-5 h-5 ${unlocked ? 'text-[#163D32]' : 'text-[#163D32]/35 dark:text-[#9FC6B0]/35'}`;
  switch (kind) {
    case 'zap':
      return <Zap className={cls} />;
    case 'recycle':
      return <Recycle className={cls} />;
    case 'calendar':
      return <Calendar className={cls} />;
    case 'award':
      return <Award className={cls} />;
    case 'users':
      return <Users className={cls} />;
    default:
      return <Sparkles className={cls} />;
  }
}

export const DashboardStatsView: React.FC<DashboardStatsViewProps> = ({
  savedRooms,
  activeRoom,
  history,
  points,
  streakDays,
  focusMinutesTotal,
  language,
  onSelectRoom,
  onClearHistory,
}) => {
  const isBn = language === 'bn';
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const allRooms = [...savedRooms];
  if (activeRoom && !allRooms.some((r) => r.id === activeRoom.id)) {
    allRooms.unshift(activeRoom);
  }

  const totalSteps = allRooms.reduce((s, r) => s + r.actionPlan.length, 0);
  const doneSteps = allRooms.reduce(
    (s, r) => s + r.actionPlan.filter((st) => st.completed).length,
    0
  );
  const overallOrganizedPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const avgBefore =
    allRooms.length > 0
      ? Math.round(allRooms.reduce((s, r) => s + r.clutterScore, 0) / allRooms.length)
      : 0;
  const avgAfter =
    allRooms.length > 0
      ? Math.round(
          allRooms.reduce(
            (s, r) =>
              s + (typeof r.afterClutterScore === 'number' ? r.afterClutterScore : r.clutterScore),
            0
          ) / allRooms.length
        )
      : 0;

  const rankTitle =
    points >= 500
      ? isBn
        ? 'ক্লাটার কনকারার'
        : 'Clutter Conqueror'
      : points >= 150
      ? isBn
        ? 'হোম জোন স্ট্র্যাটেজিস্ট'
        : 'Zone Strategist'
      : isBn
      ? 'রাইজিং অর্গানাইজার'
      : 'Rising Organizer';

  return (
    <div className="space-y-6">
      {/* Header KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'ঘর গোছানোর অগ্রগতি' : 'Home Organized'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-1 font-mono tabular-nums">
            {overallOrganizedPct}%
          </div>
          <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-1 tabular-nums">
            {doneSteps}/{totalSteps} {isBn ? 'ধাপ সম্পন্ন' : 'steps completed'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'অর্জিত পয়েন্ট' : 'Organizer Points'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-1 font-mono tabular-nums flex flex-wrap items-center gap-2">
            <span>{points}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg bg-[#E9B95B]/25 text-[#163D32] dark:text-[#E9B95B] font-sans font-bold">
              {rankTitle}
            </span>
          </div>
          <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-1">
            {isBn ? 'কাজ ও রিডিজাইনে পয়েন্ট বাড়ে' : 'Earned from tasks & scans'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'টানা স্ট্রিক' : 'Active Streak'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-1 font-mono tabular-nums flex items-center gap-2">
            <Flame className="w-6 h-6 text-[#E9B95B]" />
            <span>{streakDays}d</span>
          </div>
          <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-1 tabular-nums">
            {focusMinutesTotal}m {isBn ? 'ফোকাস সময়' : 'focus logged'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'গড় ক্লাটার উন্নতি' : 'Avg. Clutter Delta'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-1 font-mono tabular-nums">
            {avgBefore} → {avgAfter}
          </div>
          <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] mt-1">
            {allRooms.length} {isBn ? 'টি রুম ট্র্যাক করা হচ্ছে' : 'rooms tracked'}
          </div>
        </div>
      </div>

      {/* Room Progress Statistics + Achievement Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Progress Statistics */}
        <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'রুমভিত্তিক অগ্রগতির পরিসংখ্যান' : 'Room-by-Room Progress Statistics'}
            </h3>
          </div>

          {allRooms.length === 0 ? (
            <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-8 text-center">
              {isBn
                ? 'পরিসংখ্যান দেখতে প্রথমে একটি রুম স্ক্যান করুন।'
                : 'Analyze and save rooms to track completion statistics here.'}
            </p>
          ) : (
            <div className="space-y-3.5">
              {allRooms.map((room) => {
                const tot = room.actionPlan.length;
                const done = room.actionPlan.filter((s) => s.completed).length;
                const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    className="w-full text-left p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/50 dark:hover:bg-[#1E372D] border border-[#163D32]/10 dark:border-[#264638] transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                      <span className="font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {room.roomName}
                      </span>
                      <span className="font-mono font-bold text-[#163D32] dark:text-[#E9B95B] tabular-nums shrink-0">
                        {pct}% ({done}/{tot})
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white dark:bg-[#0D1A15] rounded-full overflow-hidden border border-[#163D32]/10 dark:border-[#264638]">
                      <div
                        className="h-full bg-[#163D32] dark:bg-[#E9B95B] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Achievement & Rewards */}
        <div className="lg:col-span-6 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#E9B95B]" />
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'অর্জন ও রিওয়ার্ড ব্যাজ' : 'Achievements & Rewards'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#163D32]/70 dark:text-[#9FC6B0] tabular-nums">
              {BADGE_CATALOG.filter((b) => points >= b.pointsRequired).length}/{BADGE_CATALOG.length}{' '}
              {isBn ? 'আনলকড' : 'unlocked'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BADGE_CATALOG.map((badge) => {
              const unlocked = points >= badge.pointsRequired;
              return (
                <div
                  key={badge.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    unlocked
                      ? 'bg-[#DDF3E5]/60 dark:bg-[#1A3329] border-[#163D32]/25 dark:border-[#2B4E3F]'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] opacity-65'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-[#E9B95B]'
                        : 'bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638]'
                    }`}
                  >
                    {renderBadgeIcon(badge.icon, unlocked)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                      {isBn ? badge.titleBn : badge.title}
                    </div>
                    <div className="text-[11px] text-[#163D32]/70 dark:text-[#B9D1C3] leading-snug mt-0.5">
                      {isBn ? badge.descriptionBn : badge.description}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-[#163D32]/60 dark:text-[#9FC6B0] mt-1">
                      {unlocked
                        ? isBn
                          ? 'অর্জিত হয়েছে'
                          : 'Unlocked'
                        : `${badge.pointsRequired} pts`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cleaning History */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'পরিচ্ছন্নতার ইতিহাস (Cleaning History)' : 'Cleaning & Activity History'}
            </h3>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="text-xs font-semibold text-[#163D32]/65 dark:text-[#9FC6B0] hover:text-rose-600"
            >
              {isBn ? 'ইতিহাস মুছুন' : 'Clear Log'}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-6 text-center">
            {isBn
              ? 'কাজ সম্পন্ন করলে বা ফোকাস স্প্রিন্ট শেষ করলে এখানে ইতিহাস জমা হবে।'
              : 'Completed checklist tasks, room scans, and focus sprints appear here automatically.'}
          </p>
        ) : (
          <div className="divide-y divide-[#163D32]/10 dark:divide-[#264638] max-h-80 overflow-y-auto">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#163D32] dark:text-[#6EE7B7] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-[#163D32] dark:text-[#EDF4EF] truncate">
                      {entry.action}
                    </div>
                    <div className="text-[11px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                      {entry.roomName} ·{' '}
                      {new Date(entry.timestamp).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums text-xs">
                  {entry.minutes > 0 && (
                    <span className="text-[#163D32]/65 dark:text-[#9FC6B0]">{entry.minutes}m</span>
                  )}
                  <span className="px-2 py-0.5 rounded-lg bg-[#DDF3E5] text-[#163D32] font-bold">
                    +{entry.pointsEarned} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmClearOpen}
        title={isBn ? 'পরিচ্ছন্নতার ইতিহাস মুছে ফেলবেন?' : 'Clear Activity History?'}
        description={
          isBn
            ? 'সব কাজের লগ স্থায়ীভাবে মুছে যাবে, তবে আপনার অর্জিত পয়েন্ট ও রুমগুলো থাকবে।'
            : 'This will clear your activity log entries. Your organizer points and saved rooms will remain.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Clear Log'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={onClearHistory}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
