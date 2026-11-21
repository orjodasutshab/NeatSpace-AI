import React, { useState, useRef } from 'react';
import { OutputLanguage, RoomAnalysis, SavedRedesign } from '../types';
import { getUILabels } from '../i18n';
import { prepareImageForAnalysis } from '../utils/imageUtils';
import {
  Columns2,
  SlidersHorizontal,
  Camera,
  Trash2,
  TrendingDown,
  Sparkles,
  Upload,
  Loader2,
  StickyNote,
  ArrowRight,
} from 'lucide-react';

interface BeforeAfterGalleryViewProps {
  savedRooms: RoomAnalysis[];
  activeRoom: RoomAnalysis | null;
  savedDesigns: SavedRedesign[];
  language: OutputLanguage;
  onSelectRoom: (room: RoomAnalysis) => void;
  onDeleteDesign: (id: string) => void;
  onSaveStandalonePair: (pair: Omit<SavedRedesign, 'id' | 'createdAt'>) => Promise<void> | void;
}

export const BeforeAfterGalleryView: React.FC<BeforeAfterGalleryViewProps> = ({
  savedRooms,
  activeRoom,
  savedDesigns,
  language,
  onSelectRoom,
  onDeleteDesign,
  onSaveStandalonePair,
}) => {
  const isBn = language === 'bn';
  const t = getUILabels(language);

  const [sliderMap, setSliderMap] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'slider' | 'side'>('slider');
  const [filterMode, setFilterMode] = useState<'all' | 'cleaned' | 'redesigned'>('all');

  // Standalone Before & After Upload Pair state
  const [showAddForm, setShowAddForm] = useState(false);
  const [pairTitle, setPairTitle] = useState('');
  const [pairNotes, setPairNotes] = useState('');
  const [beforeDataUrl, setBeforeDataUrl] = useState<string>('');
  const [afterDataUrl, setAfterDataUrl] = useState<string>('');
  const [savingPair, setSavingPair] = useState(false);

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const allRooms = [...savedRooms];
  if (activeRoom && !allRooms.some((r) => r.id === activeRoom.id)) {
    allRooms.unshift(activeRoom);
  }

  const roomTransformations = allRooms.filter((r) => Boolean(r.afterImageUrl || r.redesignPreviewUrl));

  const handleFilePick = (target: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || '');
      if (!raw) return;
      const prepared = await prepareImageForAnalysis(raw, 720, 0.78);
      if (target === 'before') setBeforeDataUrl(prepared);
      else setAfterDataUrl(prepared);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreatePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeDataUrl || !afterDataUrl) return;
    setSavingPair(true);
    try {
      await onSaveStandalonePair({
        roomName: pairTitle.trim() || (isBn ? 'রুম ট্রান্সফরমেশন' : 'Room Transformation'),
        roomType: 'general',
        style: 'budget_refresh',
        budgetTier: 'budget_friendly',
        furniturePref: 'keep_existing',
        beforeImageUrl: beforeDataUrl,
        afterImageUrl: afterDataUrl,
        summary: pairNotes.trim() || (isBn ? 'আগে ও পরের পরিচ্ছন্ন তুলনা' : 'Logged before & after progress photo pair.'),
      });
      setPairTitle('');
      setPairNotes('');
      setBeforeDataUrl('');
      setAfterDataUrl('');
      setShowAddForm(false);
    } finally {
      setSavingPair(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'ট্রান্সফরমেশন গ্যালারি' : 'Transformation Archive'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
            {isBn ? 'আগে ও পরের তুলনা গ্যালারি' : 'Before & After Comparison Gallery'}
          </h2>
          <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] mt-1">
            {isBn
              ? 'স্লাইডার টেনে প্রতিটি রুমের পরিবর্তন, স্কোরের উন্নতি এবং সেভ করা AI রিডিজাইন দেখুন।'
              : 'Compare messy vs. organized photos, inspect clutter score drops, and revisit saved AI redesigns.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode('slider')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold ${
                viewMode === 'slider' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isBn ? 'স্লাইডার' : 'Slider'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold ${
                viewMode === 'side' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'পাশাপাশি' : 'Side-by-Side'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] text-xs font-bold transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>{isBn ? 'আগে/পরে যোগ করুন' : 'Log Before & After'}</span>
          </button>
        </div>
      </div>

      {/* Add Standalone Before & After Pair Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreatePair}
          className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'নতুন আগে ও পরের ছবি সংরক্ষণ করুন' : 'Save a Before & After Photo Pair'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <input
                ref={beforeRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFilePick('before', e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => beforeRef.current?.click()}
                className="w-full h-40 rounded-xl border-2 border-dashed border-[#163D32]/25 dark:border-[#345C4B] bg-[#F7F9F6] dark:bg-[#182C24] overflow-hidden flex flex-col items-center justify-center gap-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
              >
                {beforeDataUrl ? (
                  <img src={beforeDataUrl} alt="Before preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>{isBn ? 'আগের ছবি আপলোড (Before)' : 'Upload Before Photo'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <input
                ref={afterRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFilePick('after', e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => afterRef.current?.click()}
                className="w-full h-40 rounded-xl border-2 border-dashed border-[#163D32]/25 dark:border-[#345C4B] bg-[#F7F9F6] dark:bg-[#182C24] overflow-hidden flex flex-col items-center justify-center gap-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]"
              >
                {afterDataUrl ? (
                  <img src={afterDataUrl} alt="After preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>{isBn ? 'পরের ছবি আপলোড (After)' : 'Upload After Photo'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={pairTitle}
              onChange={(e) => setPairTitle(e.target.value)}
              placeholder={isBn ? 'রুমের নাম (যেমন: স্টাডি ডেস্ক)' : 'Space title (e.g. Study Desk Reset)'}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
            <input
              type="text"
              value={pairNotes}
              onChange={(e) => setPairNotes(e.target.value)}
              placeholder={isBn ? 'কী কী পরিবর্তন হলো নোট লিখুন...' : 'Notes on what changed...'}
              className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#163D32] dark:text-[#B9D1C3]"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!beforeDataUrl || !afterDataUrl || savingPair}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#163D32] disabled:opacity-40 text-white text-xs font-bold"
            >
              {savingPair && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isBn ? 'গ্যালারিতে সেভ করুন' : 'Save to Gallery'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: isBn ? 'সব তুলনা' : 'All Transformations' },
          { id: 'cleaned', label: isBn ? 'রুম ক্লিনআপ' : 'Room Cleanups' },
          { id: 'redesigned', label: isBn ? 'AI রিডিজাইন' : 'Saved AI Redesigns' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterMode(f.id as typeof filterMode)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              filterMode === f.id
                ? 'bg-[#163D32] text-white border-[#163D32]'
                : 'bg-white dark:bg-[#13241D] text-[#163D32]/75 dark:text-[#B9D1C3] border-[#163D32]/15 dark:border-[#264638]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Room Transformations Grid */}
      {(filterMode === 'all' || filterMode === 'cleaned') && roomTransformations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[#163D32]/80 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'বিশ্লেষিত রুমের আগে ও পরে' : 'Analyzed Room Transformations'}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {roomTransformations.map((room) => {
              const afterSrc = room.afterImageUrl || room.redesignPreviewUrl || '';
              const pos = sliderMap[room.id] ?? 50;
              const delta =
                typeof room.afterClutterScore === 'number'
                  ? room.clutterScore - room.afterClutterScore
                  : null;
              return (
                <div
                  key={room.id}
                  className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {room.roomName}
                      </h4>
                      <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] flex flex-wrap items-center gap-2 mt-0.5 tabular-nums">
                        <span>{t.roomLabels[room.roomType]}</span>
                        <span>·</span>
                        <span>{new Date(room.timestamp).toLocaleDateString()}</span>
                        {delta !== null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#DDF3E5] text-[#163D32] font-bold">
                            <TrendingDown className="w-3 h-3" />
                            -{delta} pts
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectRoom(room)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold border border-[#163D32]/10 shrink-0"
                    >
                      <span>{isBn ? 'খুলুন' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {viewMode === 'slider' ? (
                    <div className="space-y-2">
                      <div className="relative aspect-16/10 w-full rounded-xl overflow-hidden bg-[#F7F9F6] border border-[#163D32]/10 select-none">
                        <img
                          src={afterSrc}
                          alt="After"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
                        >
                          <img
                            src={room.imageUrl}
                            alt="Before"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#E9B95B] pointer-events-none"
                          style={{ left: `${pos}%` }}
                        />
                        <span className="absolute top-2.5 left-2.5 text-[11px] font-bold bg-[#163D32]/85 text-white px-2 py-0.5 rounded-md">
                          {isBn ? 'আগে' : 'Before'} ({room.clutterScore})
                        </span>
                        <span className="absolute top-2.5 right-2.5 text-[11px] font-bold bg-[#E9B95B] text-[#163D32] px-2 py-0.5 rounded-md">
                          {room.afterImageUrl ? (isBn ? 'পরে' : 'After') : 'AI Redesign'}
                          {typeof room.afterClutterScore === 'number' ? ` (${room.afterClutterScore})` : ''}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pos}
                        onChange={(e) => setSliderMap((prev) => ({ ...prev, [room.id]: Number(e.target.value) }))}
                        aria-label={`Before and after slider for ${room.roomName}`}
                        className="w-full accent-[#163D32] cursor-ew-resize"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <img
                        src={room.imageUrl}
                        alt="Before"
                        referrerPolicy="no-referrer"
                        className="aspect-4/3 w-full rounded-xl object-cover border border-[#163D32]/10"
                      />
                      <img
                        src={afterSrc}
                        alt="After"
                        referrerPolicy="no-referrer"
                        className="aspect-4/3 w-full rounded-xl object-cover border-2 border-[#163D32]"
                      />
                    </div>
                  )}

                  {(room.afterSummary || room.redesignSummary) && (
                    <p className="text-xs text-[#163D32]/80 dark:text-[#B9D1C3] bg-[#F7F9F6] dark:bg-[#182C24] rounded-xl p-3 leading-relaxed">
                      {room.afterSummary || room.redesignSummary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved AI Redesigns & Logged Photo Pairs */}
      {(filterMode === 'all' || filterMode === 'redesigned') && savedDesigns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[#163D32]/80 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'সেভ করা ডিজাইন ও ফটো পেয়ার' : 'Saved AI Redesigns & Photo Pairs'}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {savedDesigns.map((design) => {
              const pos = sliderMap[design.id] ?? 50;
              return (
                <div
                  key={design.id}
                  className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {design.roomName}
                      </h4>
                      <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="font-semibold text-[#163D32] dark:text-[#E9B95B]">
                          {t.redesignStyles[design.style]?.label || design.style}
                        </span>
                        <span>·</span>
                        <span>{new Date(design.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteDesign(design.id)}
                      aria-label="Delete saved design"
                      className="p-2 rounded-xl text-[#163D32]/45 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {viewMode === 'slider' ? (
                    <div className="space-y-2">
                      <div className="relative aspect-16/10 w-full rounded-xl overflow-hidden bg-[#F7F9F6] border border-[#163D32]/10 select-none">
                        <img
                          src={design.afterImageUrl}
                          alt="After design"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
                        >
                          <img
                            src={design.beforeImageUrl}
                            alt="Before design"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#E9B95B] pointer-events-none"
                          style={{ left: `${pos}%` }}
                        />
                        <span className="absolute top-2.5 left-2.5 text-[11px] font-bold bg-[#163D32]/85 text-white px-2 py-0.5 rounded-md">
                          {isBn ? 'আগে' : 'Before'}
                        </span>
                        <span className="absolute top-2.5 right-2.5 text-[11px] font-bold bg-[#E9B95B] text-[#163D32] px-2 py-0.5 rounded-md">
                          {isBn ? 'পরে' : 'After'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pos}
                        onChange={(e) =>
                          setSliderMap((prev) => ({ ...prev, [design.id]: Number(e.target.value) }))
                        }
                        aria-label={`Before and after slider for ${design.roomName}`}
                        className="w-full accent-[#163D32] cursor-ew-resize"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <img
                        src={design.beforeImageUrl}
                        alt="Before"
                        referrerPolicy="no-referrer"
                        className="aspect-4/3 w-full rounded-xl object-cover border border-[#163D32]/10"
                      />
                      <img
                        src={design.afterImageUrl}
                        alt="After"
                        referrerPolicy="no-referrer"
                        className="aspect-4/3 w-full rounded-xl object-cover border-2 border-[#163D32]"
                      />
                    </div>
                  )}

                  {design.summary && (
                    <div className="text-xs text-[#163D32]/80 dark:text-[#B9D1C3] bg-[#F7F9F6] dark:bg-[#182C24] rounded-xl p-3 flex items-start gap-2">
                      <StickyNote className="w-3.5 h-3.5 text-[#E9B95B] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{design.summary}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roomTransformations.length === 0 && savedDesigns.length === 0 && (
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-10 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-[#163D32]/25 dark:text-[#9FC6B0]/30 mx-auto" />
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'এখনও কোনো আগে ও পরের ছবি নেই' : 'No Before & After Comparisons Yet'}
          </h3>
          <p className="text-xs sm:text-sm text-[#163D32]/65 dark:text-[#B9D1C3] max-w-md mx-auto">
            {isBn
              ? 'রুম বিশ্লেষণ করার পর "পরের ছবি" আপলোড করুন অথবা AI রিডিজাইন স্টুডিও থেকে ডিজাইন সেভ করুন।'
              : 'Upload an "After Photo" on any analyzed room, save an AI Redesign, or log a photo pair above to track visible progress.'}
          </p>
        </div>
      )}
    </div>
  );
};
