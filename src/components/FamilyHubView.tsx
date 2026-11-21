import React, { useState } from 'react';
import { FamilyActivityEntry, FamilyMember, OutputLanguage, RoomAnalysis } from '../types';
import { Users, Plus, Trash2, CheckCircle2, ArrowRight, Share2, Check, History } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface FamilyHubViewProps {
  members: FamilyMember[];
  familyLogs?: FamilyActivityEntry[];
  savedRooms: RoomAnalysis[];
  activeRoom: RoomAnalysis | null;
  language: OutputLanguage;
  onAddMember: (name: string, role: string, color: string) => void;
  onRemoveMember: (id: string) => void;
  onAssignRoom: (roomId: string, memberId: string) => void;
  onSelectRoom: (room: RoomAnalysis) => void;
}

const MEMBER_COLORS = ['#163D32', '#E9B95B', '#2E7D6B', '#8C5E3C', '#4A6FA5'];

export const FamilyHubView: React.FC<FamilyHubViewProps> = ({
  members,
  familyLogs = [],
  savedRooms,
  activeRoom,
  language,
  onAddMember,
  onRemoveMember,
  onAssignRoom,
  onSelectRoom,
}) => {
  const isBn = language === 'bn';
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<FamilyMember | null>(null);

  const allRooms = [...savedRooms];
  if (activeRoom && !allRooms.some((r) => r.id === activeRoom.id)) {
    allRooms.unshift(activeRoom);
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    onAddMember(
      name.trim(),
      role.trim() || (isBn ? 'পরিবারের সদস্য' : 'Household Member'),
      color
    );
    setName('');
    setRole('');
  };

  const handleCopyHouseholdRoster = async () => {
    const lines = [
      'NeatSpace AI — Household Organization Roster',
      ...allRooms.map((r) => {
        const assignee = members.find((m) => m.id === r.assignedMemberId)?.name || 'Unassigned';
        const done = r.actionPlan.filter((s) => s.completed).length;
        return `- ${r.roomName} → ${assignee} (${done}/${r.actionPlan.length} tasks done)`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // ignore
    }
  };

  const filteredRooms = allRooms.filter((r) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'unassigned') return !r.assignedMemberId;
    return r.assignedMemberId === selectedFilter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'ফ্যামিলি ও শেয়ার্ড রুম ম্যানেজমেন্ট' : 'Family & Shared Room Management'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
            {isBn ? 'পরিবারের সবার মাঝে রুমের দায়িত্ব ভাগ করুন' : 'Household Chore & Room Hub'}
          </h2>
          <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] mt-1">
            {isBn
              ? 'প্রতিটি রুম পরিবারের সদস্যদের দায়িত্বে দিন এবং সবার অগ্রগতি একসাথে দেখুন।'
              : 'Assign bedrooms, kitchen zones, or study desks to family members and track shared progress.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyHouseholdRoster}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold transition-colors shrink-0 whitespace-nowrap"
        >
          {copiedSummary ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span>
            {copiedSummary
              ? isBn
                ? 'কপি হয়েছে!'
                : 'Roster Copied!'
              : isBn
              ? 'দায়িত্ব তালিকা শেয়ার করুন'
              : 'Copy Chore Summary'}
          </span>
        </button>
      </div>

      {/* Add Family Member + Member Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleAdd}
          className="lg:col-span-5 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3.5"
        >
          <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <Users className="w-4 h-4 dark:text-[#E9B95B]" />
            <span>{isBn ? 'সদস্য যোগ করুন' : 'Add Household Member'}</span>
          </h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isBn ? 'নাম (যেমন: রাফি / সারা)' : 'Name (e.g. Alex, Sara)'}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={isBn ? 'ভূমিকা (যেমন: রুম লিড)' : 'Role (e.g. Kitchen Captain)'}
            className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
          />
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-[#163D32] hover:bg-[#102E25] dark:bg-[#E9B95B] dark:hover:bg-[#dfb04f] text-white dark:text-[#163D32] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{isBn ? 'সদস্য যুক্ত করুন' : 'Add Member'}</span>
          </button>
        </form>

        {/* Member Leaderboard / Filter Strip */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'পরিবারের সদস্যবৃন্দ' : 'Household Team'}
            </h3>
            <span className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
              {isBn ? 'ফিল্টার করতে ক্লিক করুন' : 'Click to filter rooms'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m) => {
              const assignedRooms = allRooms.filter((r) => r.assignedMemberId === m.id);
              const doneTasks = assignedRooms.reduce(
                (s, r) => s + r.actionPlan.filter((st) => st.completed).length,
                0
              );
              const isSelected = selectedFilter === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedFilter(isSelected ? 'all' : m.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedFilter(isSelected ? 'all' : m.id);
                    }
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#DDF3E5] border-[#163D32] dark:bg-[#1E3B30] dark:border-[#E9B95B]'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {m.name}
                      </div>
                      <div className="text-xs text-[#163D32]/65 dark:text-[#B9D1C3] truncate tabular-nums">
                        {m.role} · {assignedRooms.length} {isBn ? 'রুম' : 'rooms'} · {doneTasks}{' '}
                        {isBn ? 'কাজ' : 'done'}
                      </div>
                    </div>
                  </div>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingRemoveMember(m);
                      }}
                      className="p-1.5 text-[#163D32]/40 dark:text-[#9FC6B0] hover:text-rose-600"
                      aria-label="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Room Assignment Board */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'শেয়ার্ড রুম ও দায়িত্ব তালিকা' : 'Shared Rooms & Assignments'}
          </h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold ${
                selectedFilter === 'all'
                  ? 'bg-[#163D32] text-white'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3]'
              }`}
            >
              {isBn ? 'সব রুম' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('unassigned')}
              className={`px-3 py-1.5 rounded-xl font-semibold ${
                selectedFilter === 'unassigned'
                  ? 'bg-[#163D32] text-white'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3]'
              }`}
            >
              {isBn ? 'অনির্ধারিত' : 'Unassigned'}
            </button>
          </div>
        </div>

        {filteredRooms.length === 0 ? (
          <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-8 text-center">
            {isBn
              ? 'এই ফিল্টারে কোনো রুম নেই। ড্যাশবোর্ড থেকে একটি রুম বিশ্লেষণ ও সেভ করুন।'
              : 'No rooms match this filter. Analyze or save a room to assign it here.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRooms.map((room) => {
              const done = room.actionPlan.filter((s) => s.completed).length;
              const tot = room.actionPlan.length;
              const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
              return (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={room.imageUrl}
                      alt={room.roomName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#163D32]/10"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {room.roomName}
                      </div>
                      <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] flex items-center gap-2 mt-0.5 tabular-nums">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#163D32] dark:text-[#6EE7B7]" />
                        <span>
                          {done}/{tot} ({pct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#163D32]/10 dark:border-[#264638]">
                    <select
                      value={room.assignedMemberId || ''}
                      onChange={(e) => onAssignRoom(room.id, e.target.value)}
                      className="flex-1 bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
                    >
                      <option value="">{isBn ? 'দায়িত্ব দিন...' : 'Assign member...'}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onSelectRoom(room)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#163D32] dark:bg-[#E9B95B] text-white dark:text-[#163D32] text-xs font-semibold shrink-0"
                    >
                      <span>{isBn ? 'খুলুন' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Activity History */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'পরিবারের সাম্প্রতিক কার্যক্রম' : 'Household Activity History'}
          </h3>
        </div>

        {familyLogs.length === 0 ? (
          <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] py-4 text-center">
            {isBn
              ? 'রুম নির্ধারণ বা কাজ সম্পন্ন হলে এখানে কার্যক্রম দেখা যাবে।'
              : 'Room assignments and household updates appear here automatically.'}
          </p>
        ) : (
          <div className="divide-y divide-[#163D32]/10 dark:divide-[#264638] max-h-64 overflow-y-auto">
            {familyLogs.slice(0, 20).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0">
                  <span className="font-bold text-[#163D32] dark:text-[#EDF4EF]">{log.memberName}</span>{' '}
                  <span className="text-[#163D32]/80 dark:text-[#B9D1C3]">{log.action}</span>{' '}
                  {log.roomName && (
                    <span className="font-semibold text-[#163D32] dark:text-[#E9B95B]">
                      ({log.roomName})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#163D32]/60 dark:text-[#9FC6B0] shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingRemoveMember)}
        title={isBn ? 'সদস্য সরিয়ে ফেলবেন?' : 'Remove Household Member?'}
        description={
          isBn
            ? `${pendingRemoveMember?.name || ''} কে টিম থেকে সরাতে চান?`
            : `Remove "${pendingRemoveMember?.name || ''}" from the household team? Assigned rooms will remain in your library.`
        }
        confirmLabel={isBn ? 'সরিয়ে ফেলুন' : 'Remove Member'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={() => {
          if (pendingRemoveMember) onRemoveMember(pendingRemoveMember.id);
        }}
        onCancel={() => setPendingRemoveMember(null)}
      />
    </div>
  );
};
