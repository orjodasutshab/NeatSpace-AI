import React, { useState, useRef } from 'react';
import { RoomAnalysis, RoomType, OutputLanguage } from '../types';
import { getUILabels } from '../i18n';
import {
  FolderHeart,
  X,
  Trash2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Cloud,
  HardDrive,
  LogIn,
  Search,
  Download,
  Upload,
  Columns2,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface SavedRoomsListProps {
  isOpen: boolean;
  onClose: () => void;
  savedRooms: RoomAnalysis[];
  isCloudSynced: boolean;
  language: OutputLanguage;
  embedded?: boolean;
  onSignIn: () => void;
  onSelectRoom: (room: RoomAnalysis) => void;
  onDeleteRoom: (id: string) => void;
  onImportRooms: (rooms: RoomAnalysis[]) => void;
}

type SortMode = 'newest' | 'highest_clutter' | 'lowest_clutter' | 'most_progress';

export const SavedRoomsList: React.FC<SavedRoomsListProps> = ({
  isOpen,
  onClose,
  savedRooms,
  isCloudSynced,
  language,
  embedded = false,
  onSignIn,
  onSelectRoom,
  onDeleteRoom,
  onImportRooms,
}) => {
  const isBn = language === 'bn';
  const t = getUILabels(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState<'all' | RoomType>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [pendingDeleteRoom, setPendingDeleteRoom] = useState<RoomAnalysis | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  if (!embedded && !isOpen) return null;

  const filteredRooms = savedRooms
    .filter((room) => {
      const matchesSearch =
        !searchQuery.trim() ||
        room.roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.overallAssessment.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = roomFilter === 'all' || room.roomType === roomFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortMode === 'highest_clutter') {
        const sa = typeof a.afterClutterScore === 'number' ? a.afterClutterScore : a.clutterScore;
        const sb = typeof b.afterClutterScore === 'number' ? b.afterClutterScore : b.clutterScore;
        return sb - sa;
      }
      if (sortMode === 'lowest_clutter') {
        const sa = typeof a.afterClutterScore === 'number' ? a.afterClutterScore : a.clutterScore;
        const sb = typeof b.afterClutterScore === 'number' ? b.afterClutterScore : b.clutterScore;
        return sa - sb;
      }
      if (sortMode === 'most_progress') {
        const pa = a.actionPlan.length > 0 ? a.actionPlan.filter((s) => s.completed).length / a.actionPlan.length : 0;
        const pb = b.actionPlan.length > 0 ? b.actionPlan.filter((s) => s.completed).length / b.actionPlan.length : 0;
        return pb - pa;
      }
      return b.timestamp - a.timestamp;
    });

  const avgScore =
    savedRooms.length > 0
      ? Math.round(
          savedRooms.reduce(
            (sum, r) => sum + (typeof r.afterClutterScore === 'number' ? r.afterClutterScore : r.clutterScore),
            0
          ) / savedRooms.length
        )
      : 0;

  const totalTasksDone = savedRooms.reduce(
    (sum, r) => sum + r.actionPlan.filter((s) => s.completed).length,
    0
  );

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(savedRooms, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neatspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '[]'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          onImportRooms(parsed);
          setImportFeedback(`Imported ${parsed.length} room plan(s) successfully.`);
          setTimeout(() => setImportFeedback(null), 3500);
        } else {
          setImportFeedback('Backup file contained no valid room plans.');
        }
      } catch {
        setImportFeedback('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const content = (
    <div
      className={
        embedded
          ? 'bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl overflow-hidden flex flex-col'
          : 'w-full max-w-3xl bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]'
      }
    >
      {/* Header */}
      <div className="p-5 bg-[#F7F9F6] dark:bg-[#182C24] border-b border-[#163D32]/10 dark:border-[#264638] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-[#DDF3E5] dark:bg-[#1E3B30] rounded-xl text-[#163D32] dark:text-[#E9B95B]">
            <FolderHeart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#163D32] dark:text-[#EDF4EF] text-base sm:text-lg">
              {isBn ? 'আমার সেভ করা রুমসমূহ' : 'My Rooms & Saved Plans'}
            </h3>
            <p className="text-xs text-[#163D32]/70 dark:text-[#B9D1C3] flex items-center gap-1.5 mt-0.5 tabular-nums">
              {isCloudSynced ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#163D32] dark:text-[#6EE7B7]" />
                  <span>
                    {savedRooms.length} {isBn ? 'টি প্ল্যান ক্লাউড ডাটাবেজে সিঙ্ক আছে' : 'plans synced to Cloud Database'}
                  </span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-[#E9B95B]" />
                  <span>
                    {savedRooms.length} {isBn ? 'টি প্ল্যান লোকালি সেভ আছে' : 'plans saved locally'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedRooms.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowCompareView((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                showCompareView
                  ? 'bg-[#163D32] text-white border-[#163D32]'
                  : 'text-[#163D32] bg-white hover:bg-[#DDF3E5] border-[#163D32]/15'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isBn ? 'তুলনা' : 'Compare'}</span>
            </button>
          )}
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            title="Import JSON backup"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#163D32] bg-white hover:bg-[#DDF3E5] rounded-xl border border-[#163D32]/15"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isBn ? 'ইমপোর্ট' : 'Import'}</span>
          </button>
          {savedRooms.length > 0 && (
            <button
              type="button"
              onClick={handleExportBackup}
              title="Export JSON backup"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#163D32] bg-white hover:bg-[#DDF3E5] rounded-xl border border-[#163D32]/15"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isBn ? 'ব্যাকআপ' : 'Backup'}</span>
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close library"
              className="p-1.5 text-[#163D32]/70 hover:text-[#163D32] bg-white rounded-xl border border-[#163D32]/15"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {importFeedback && (
        <div className="px-5 py-2 bg-[#DDF3E5] border-b border-[#163D32]/15 text-xs font-semibold text-[#163D32]">
          {importFeedback}
        </div>
      )}

      {/* Summary KPI Strip & Filter */}
      {savedRooms.length > 0 && (
        <div className="px-5 py-4 bg-white dark:bg-[#13241D] border-b border-[#163D32]/10 dark:border-[#264638] space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl py-2.5 px-3">
              <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">{isBn ? 'মোট রুম' : 'Rooms'}</div>
              <div className="text-base font-bold text-[#163D32] dark:text-[#EDF4EF] tabular-nums">{savedRooms.length}</div>
            </div>
            <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl py-2.5 px-3">
              <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">{isBn ? 'গড় স্কোর' : 'Avg. Clutter'}</div>
              <div className="text-base font-bold text-[#163D32] dark:text-[#EDF4EF] tabular-nums">{avgScore}/100</div>
            </div>
            <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl py-2.5 px-3">
              <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">{isBn ? 'সম্পন্ন কাজ' : 'Tasks Done'}</div>
              <div className="text-base font-bold text-[#163D32] dark:text-[#EDF4EF] tabular-nums">{totalTasksDone}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#163D32]/50 dark:text-[#9FC6B0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'সেভ করা রুম খুঁজুন...' : 'Search saved room plans...'}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
            </div>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value as 'all' | RoomType)}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            >
              <option value="all">{isBn ? 'সব ধরনের রুম' : 'All Room Types'}</option>
              <option value="living_room">{t.roomLabels.living_room}</option>
              <option value="bedroom">{t.roomLabels.bedroom}</option>
              <option value="home_office">{t.roomLabels.home_office}</option>
              <option value="kitchen">{t.roomLabels.kitchen}</option>
              <option value="dining_room">{t.roomLabels.dining_room}</option>
              <option value="closet">{t.roomLabels.closet}</option>
              <option value="bathroom">{t.roomLabels.bathroom}</option>
              <option value="garage">{t.roomLabels.garage}</option>
              <option value="kids_room">{t.roomLabels.kids_room}</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            >
              <option value="newest">{isBn ? 'সর্বশেষ আগে' : 'Newest First'}</option>
              <option value="highest_clutter">{isBn ? 'বেশি অগোছালো আগে' : 'Highest Clutter'}</option>
              <option value="lowest_clutter">{isBn ? 'সবচেয়ে পরিচ্ছন্ন আগে' : 'Cleanest First'}</option>
              <option value="most_progress">{isBn ? 'সর্বোচ্চ অগ্রগতি' : 'Most Progress'}</option>
            </select>
          </div>
        </div>
      )}

      {!isCloudSynced && (
        <div className="px-5 py-3 bg-[#DDF3E5]/60 border-b border-[#163D32]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-[#163D32] font-medium">
            {isBn
              ? 'সব ডিভাইসে রুমের প্ল্যান সিঙ্ক রাখতে Google দিয়ে সাইন ইন করুন।'
              : 'Sign in with Google to sync your saved rooms and redesigns across devices.'}
          </span>
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#163D32] hover:bg-[#102E25] text-white font-bold rounded-xl transition-colors shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{isBn ? 'সাইন ইন' : 'Sign In'}</span>
          </button>
        </div>
      )}

      <div className="p-5 overflow-y-auto space-y-3 flex-1">
        {showCompareView &&
          (() => {
            const compared = savedRooms.filter((r) => compareIds.includes(r.id)).slice(0, 2);
            const displayPair = compared.length === 2 ? compared : savedRooms.slice(0, 2);
            return (
              <div className="bg-[#F7F9F6] border border-[#163D32]/20 rounded-2xl p-4 space-y-3 mb-2">
                <span className="text-xs font-bold text-[#163D32]">
                  {isBn ? '২টি রুমের তুলনা' : 'Side-by-Side Room Comparison (Select any 2 below)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayPair.map((rm) => {
                    const done = rm.actionPlan.filter((s) => s.completed).length;
                    const tot = rm.actionPlan.length;
                    const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
                    const score = typeof rm.afterClutterScore === 'number' ? rm.afterClutterScore : rm.clutterScore;
                    return (
                      <div key={rm.id} className="bg-white border border-[#163D32]/10 rounded-xl p-3 space-y-1">
                        <div className="font-bold text-sm text-[#163D32] truncate">{rm.roomName}</div>
                        <div className="text-xs text-[#163D32]/65 capitalize">{rm.roomType.replace(/_/g, ' ')}</div>
                        <div className="flex items-center justify-between text-xs pt-1 tabular-nums">
                          <span>Score: <strong>{score}/100</strong></span>
                          <span>Progress: <strong>{pct}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-[#163D32]/60 space-y-2">
            <FolderHeart className="w-12 h-12 mx-auto text-[#163D32]/25 stroke-1" />
            <p className="text-sm font-bold text-[#163D32]">
              {savedRooms.length === 0
                ? isBn
                  ? 'এখনও কোনো রুম সেভ করা হয়নি'
                  : 'No saved room plans yet'
                : isBn
                ? 'কোনো মিল পাওয়া যায়নি'
                : 'No matching room plans found'}
            </p>
            <p className="text-xs max-w-xs mx-auto">
              {savedRooms.length === 0
                ? isBn
                  ? 'রুম বিশ্লেষণ করে "সেভ করুন" বাটনে ক্লিক করলে এখানে জমা হবে।'
                  : 'Analyze a room photo and click "Save Plan" to build your room library.'
                : 'Try clearing your search or selecting All Room Types.'}
            </p>
          </div>
        ) : (
          <div className={embedded ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5' : 'space-y-3'}>
            {filteredRooms.map((room) => {
              const totalSteps = room.actionPlan.length;
              const completedSteps = room.actionPlan.filter((s) => s.completed).length;
              const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
              const formattedDate = new Date(room.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={room.id}
                  className="group bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/40 dark:hover:bg-[#1E372D] border border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/35 p-4 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1" onClick={() => onSelectRoom(room)}>
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-[#13241D] border border-[#163D32]/10 shrink-0">
                      <img
                        src={room.imageUrl}
                        alt={room.roomName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                        <span className="font-bold text-[#163D32] dark:text-[#E9B95B] capitalize">
                          {t.roomLabels[room.roomType] || room.roomType.replace(/_/g, ' ')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>
                      </div>

                      <h4 className="font-bold text-[#163D32] dark:text-[#EDF4EF] text-sm truncate mt-0.5">
                        {room.roomName}
                      </h4>

                      <div className="flex items-center gap-2 mt-1 text-xs text-[#163D32]/75 dark:text-[#B9D1C3] tabular-nums">
                        <span>
                          {room.clutterScore}/100
                          {typeof room.afterClutterScore === 'number' ? ` → ${room.afterClutterScore}/100` : ''}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-bold text-[#163D32] dark:text-[#6EE7B7]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {completedSteps}/{totalSteps} ({progressPercent}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {showCompareView && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompareIds((prev) =>
                            prev.includes(room.id)
                              ? prev.filter((id) => id !== room.id)
                              : [...prev.slice(-1), room.id]
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                          compareIds.includes(room.id)
                            ? 'bg-[#163D32] text-white border-[#163D32]'
                            : 'bg-white dark:bg-[#13241D] text-[#163D32] dark:text-[#EDF4EF] border-[#163D32]/15 dark:border-[#264638]'
                        }`}
                      >
                        {compareIds.includes(room.id) ? 'Selected' : 'Compare'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectRoom(room)}
                      className="px-3 py-2 bg-[#163D32] hover:bg-[#102E25] dark:bg-[#E9B95B] dark:hover:bg-[#dfb04f] text-white dark:text-[#163D32] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <span>{isBn ? 'খুলুন' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingDeleteRoom(room)}
                      className="p-2 bg-white dark:bg-[#13241D] hover:bg-rose-50 dark:hover:bg-rose-950/60 text-[#163D32]/50 dark:text-[#9FC6B0] hover:text-rose-600 border border-[#163D32]/15 dark:border-[#264638] rounded-xl transition-colors"
                      title="Delete saved plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteRoom)}
        title={isBn ? 'রুম প্ল্যান মুছে ফেলবেন?' : 'Delete Saved Room Plan?'}
        description={
          isBn
            ? `"${pendingDeleteRoom?.roomName || ''}" স্থায়ীভাবে মুছে ফেলা হবে।`
            : `Remove "${pendingDeleteRoom?.roomName || ''}" and its saved checklist from your library?`
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete Plan'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={() => {
          if (pendingDeleteRoom) onDeleteRoom(pendingDeleteRoom.id);
        }}
        onCancel={() => setPendingDeleteRoom(null)}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 bg-[#163D32]/40 backdrop-blur-xs flex items-center justify-center p-4">
      {content}
    </div>
  );
};
