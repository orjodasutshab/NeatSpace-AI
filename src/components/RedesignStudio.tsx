import React, { useState, useRef, useEffect } from 'react';
import {
  BudgetTier,
  FurniturePreference,
  OutputLanguage,
  RedesignStyle,
  RoomAnalysis,
  RoomType,
  SavedRedesign,
} from '../types';
import { getUILabels } from '../i18n';
import { prepareImageForAnalysis, createThumbnailDataUrl } from '../utils/imageUtils';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Wand2,
  Upload,
  Loader2,
  SlidersHorizontal,
  Columns2,
  Download,
  BookmarkCheck,
  BookmarkPlus,
  Sparkles,
  AlertTriangle,
  Palette,
  Wallet,
  Armchair,
  Trash2,
} from 'lucide-react';

interface RedesignStudioProps {
  activeRoom: RoomAnalysis | null;
  selectedImage: string | null;
  roomType: RoomType;
  language: OutputLanguage;
  savedDesigns?: SavedRedesign[];
  defaultStyle?: RedesignStyle;
  maxUploadMb?: number;
  onBeforeGenerate?: () => string | null;
  onRedesignComplete?: () => void;
  onAttachRedesignToRoom: (
    imageUrl: string,
    style: RedesignStyle,
    summary: string
  ) => Promise<void> | void;
  onSaveDesign?: (design: Omit<SavedRedesign, 'id' | 'createdAt'>) => Promise<void> | void;
  onDeleteDesign?: (id: string) => void;
  onSelectNewImage?: (dataUrl: string) => void;
  onAwardPoints?: (action: string, points: number) => void;
}

const STYLES: RedesignStyle[] = [
  'minimalist',
  'scandinavian',
  'modern',
  'luxury',
  'bohemian',
  'japandi',
  'industrial',
  'contemporary',
];

export const RedesignStudio: React.FC<RedesignStudioProps> = ({
  activeRoom,
  selectedImage,
  roomType,
  language,
  savedDesigns = [],
  defaultStyle = 'minimalist',
  maxUploadMb = 10,
  onBeforeGenerate,
  onRedesignComplete,
  onAttachRedesignToRoom,
  onSaveDesign,
  onDeleteDesign,
  onSelectNewImage,
  onAwardPoints,
}) => {
  const t = getUILabels(language);
  const isBn = language === 'bn';

  const sourceImage = activeRoom?.imageUrl || selectedImage;
  const activeRoomType = activeRoom?.roomType || roomType;

  const [selectedStyle, setSelectedStyle] = useState<RedesignStyle>(
    activeRoom?.redesignStyle && (STYLES as readonly string[]).includes(activeRoom.redesignStyle)
      ? activeRoom.redesignStyle
      : (STYLES as readonly string[]).includes(defaultStyle)
      ? (defaultStyle as RedesignStyle)
      : 'minimalist'
  );
  const [budgetTier, setBudgetTier] = useState<BudgetTier>('moderate');
  const [furniturePref, setFurniturePref] = useState<FurniturePreference>('keep_existing');
  const [wallColorPref, setWallColorPref] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(
    activeRoom?.redesignPreviewUrl || null
  );
  const [generatedSummary, setGeneratedSummary] = useState<string>(
    activeRoom?.redesignSummary || ''
  );
  const [viewMode, setViewMode] = useState<'slider' | 'side'>('slider');
  const [sliderPos, setSliderPos] = useState(50);
  const [savedNotice, setSavedNotice] = useState(false);
  const [savedToGalleryNotice, setSavedToGalleryNotice] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeRoom?.redesignPreviewUrl) {
      setGeneratedUrl(activeRoom.redesignPreviewUrl);
      setGeneratedSummary(activeRoom.redesignSummary || '');
    }
  }, [activeRoom?.id, activeRoom?.redesignPreviewUrl, activeRoom?.redesignSummary]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        isBn ? 'অনুগ্রহ করে একটি সঠিক ছবির ফাইল আপলোড করুন।' : 'Please select a valid image file.'
      );
      e.target.value = '';
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      setErrorMsg(
        isBn
          ? `ছবির আকার সর্বোচ্চ ${maxUploadMb}MB হতে হবে।`
          : `Image exceeds the ${maxUploadMb}MB upload limit.`
      );
      e.target.value = '';
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && onSelectNewImage) {
        onSelectNewImage(ev.target.result as string);
        setGeneratedUrl(null);
        setSavedToGalleryNotice(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerateRedesign = async () => {
    if (!sourceImage) return;
    const gateError = onBeforeGenerate?.();
    if (gateError) {
      setErrorMsg(gateError);
      return;
    }
    setIsGenerating(true);
    setErrorMsg(null);
    setSavedNotice(false);
    setSavedToGalleryNotice(false);

    try {
      const prepared = await prepareImageForAnalysis(sourceImage, 1024, 0.85);
      const send = async () => {
        const resp = await fetch('/api/redesign-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: prepared,
            mimeType: 'image/jpeg',
            roomType: activeRoomType,
            style: selectedStyle,
            budgetTier,
            furniturePreference: furniturePref,
            wallColorPreference: wallColorPref,
            customInstructions: customNotes,
            language,
          }),
        });
        const text = await resp.text();
        return { resp, text };
      };

      let result = await send();
      if (result.text.trim().startsWith('<')) {
        await new Promise((r) => setTimeout(r, 3500));
        result = await send();
      }

      const data = JSON.parse(result.text);
      if (result.resp.ok && data.success && data.imageUrl) {
        setGeneratedUrl(data.imageUrl);
        setGeneratedSummary(data.summary || '');
        if (activeRoom) {
          await onAttachRedesignToRoom(data.imageUrl, selectedStyle, data.summary || '');
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 3000);
        }
        onRedesignComplete?.();
        onAwardPoints?.(
          isBn
            ? `AI রুম রিডিজাইন (${t.redesignStyles[selectedStyle].label})`
            : `Generated ${t.redesignStyles[selectedStyle].label} Redesign`,
          25
        );
      } else {
        setErrorMsg(data.details || data.error || 'Could not generate room redesign.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error contacting AI redesign service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDesigns = async () => {
    if (!generatedUrl || !sourceImage || !onSaveDesign) return;
    setIsSavingDesign(true);
    try {
      const [beforeThumb, afterThumb] = await Promise.all([
        createThumbnailDataUrl(sourceImage, 540, 0.74),
        createThumbnailDataUrl(generatedUrl, 540, 0.74),
      ]);
      await onSaveDesign({
        roomName:
          activeRoom?.roomName ||
          `${t.roomLabels[activeRoomType]} · ${t.redesignStyles[selectedStyle].label}`,
        roomType: activeRoomType,
        style: selectedStyle,
        budgetTier,
        furniturePref,
        wallColor: wallColorPref || undefined,
        beforeImageUrl: beforeThumb,
        afterImageUrl: afterThumb,
        summary: generatedSummary || '',
      });
      setSavedToGalleryNotice(true);
      setTimeout(() => setSavedToGalleryNotice(false), 3500);
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleDownloadRedesign = () => {
    if (!generatedUrl) return;
    const a = document.createElement('a');
    a.href = generatedUrl;
    a.download = `neatspace-redesign-${selectedStyle}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const suggestedSwatches = activeRoom?.colorDecor?.wallColors || [
    { name: 'Soft Sage', hex: '#DDF3E5' },
    { name: 'Warm Alabaster', hex: '#F7F9F6' },
    { name: 'Muted Linen', hex: '#EDE7DC' },
    { name: 'Deep Botanical', hex: '#163D32' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0] uppercase tracking-wider">
            {isBn ? 'AI রুম রিডিজাইন স্টুডিও' : 'AI Room Redesign Studio'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF] mt-0.5">
            {isBn ? 'আপনার ঘরের নতুন ও গোছানো ডিজাইন প্রিভিউ' : 'Visualize Your Decluttered & Redesigned Room'}
          </h2>
          <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] mt-1">
            {isBn
              ? 'ঘরের কাঠামো ঠিক রেখে পছন্দের স্টাইল, বাজেট ও আসবাব অনুযায়ী AI প্রিভিউ তৈরি করুন।'
              : 'Preserve your architecture while AI removes clutter and applies curated storage, palette, and styling.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFilePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>{sourceImage ? (isBn ? 'অন্য ছবি নিন' : 'Upload Another') : (isBn ? 'ছবি আপলোড' : 'Upload Photo')}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] uppercase tracking-wide mb-2.5">
              {isBn ? '১. ডিজাইন স্টাইল বেছে নিন (৮টি স্টাইল)' : '1. Choose Interior Style (8 Presets)'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STYLES.map((styleKey) => {
                const meta = t.redesignStyles[styleKey];
                const isActive = selectedStyle === styleKey;
                return (
                  <button
                    key={styleKey}
                    type="button"
                    onClick={() => setSelectedStyle(styleKey)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      isActive
                        ? 'bg-[#DDF3E5] border-[#163D32] text-[#163D32]'
                        : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/30 text-[#163D32]/85 dark:text-[#EDF4EF]'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{meta.label}</div>
                    <div
                      className={`text-[11px] mt-0.5 leading-snug ${
                        isActive ? 'text-[#163D32]/75' : 'text-[#163D32]/65 dark:text-[#9FC6B0]'
                      }`}
                    >
                      {meta.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget & Furniture Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] mb-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#E9B95B]" />
                <span>{isBn ? 'বাজেট লেভেল' : 'Budget Tier'}</span>
              </label>
              <select
                value={budgetTier}
                onChange={(e) => setBudgetTier(e.target.value as BudgetTier)}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              >
                <option value="budget_friendly">{isBn ? 'কম বাজেট (DIY/বক্স)' : 'Budget-Friendly'}</option>
                <option value="moderate">{isBn ? 'মাঝারি (মডুলার আপগ্রেড)' : 'Moderate Refresh'}</option>
                <option value="investment">{isBn ? 'প্রিমিয়াম / বিল্ট-ইন' : 'Design Investment'}</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] mb-1.5">
                <Armchair className="w-3.5 h-3.5 text-[#E9B95B]" />
                <span>{isBn ? 'আসবাবের ধরন' : 'Furniture Plan'}</span>
              </label>
              <select
                value={furniturePref}
                onChange={(e) => setFurniturePref(e.target.value as FurniturePreference)}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              >
                <option value="keep_existing">{isBn ? 'বর্তমান আসবাব রাখুন' : 'Keep Existing Layout'}</option>
                <option value="modular_storage">{isBn ? 'মডুলার শেল্ফ ও বক্স' : 'Modular Storage'}</option>
                <option value="solid_wood">{isBn ? 'প্রাকৃতিক কাঠের ফিনিশ' : 'Warm Natural Wood'}</option>
                <option value="minimal_seating">{isBn ? 'হালকা ও খোলামেলা' : 'Minimal Open Space'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] uppercase tracking-wide mb-2">
              <Palette className="w-3.5 h-3.5 text-[#163D32] dark:text-[#E9B95B]" />
              <span>{isBn ? '২. রঙের পছন্দ (ঐচ্ছিক)' : '2. Wall / Accent Tone (Optional)'}</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestedSwatches.map((sw, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setWallColorPref(`${sw.name} (${sw.hex})`)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    wallColorPref.includes(sw.name)
                      ? 'border-[#163D32] bg-[#DDF3E5] text-[#163D32]'
                      : 'border-[#163D32]/15 dark:border-[#264638] bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/80 dark:text-[#EDF4EF]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-[#163D32]/20 shrink-0"
                    style={{ backgroundColor: sw.hex }}
                  />
                  <span>{sw.name}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={wallColorPref}
              onChange={(e) => setWallColorPref(e.target.value)}
              placeholder={isBn ? 'যেমন: হালকা সেজ গ্রিন ও সাদা পর্দা' : 'e.g. Warm sage walls, linen curtains'}
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] uppercase tracking-wide mb-2">
              {isBn ? '৩. অতিরিক্ত নির্দেশনা (ঐচ্ছিক)' : '3. Custom Redesign Prompt (Optional)'}
            </label>
            <textarea
              rows={2}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value.slice(0, 220))}
              placeholder={
                isBn
                  ? 'যেমন: ডেস্কে উডেন অর্গানাইজার ও কোণায় একটি ইনডোর প্ল্যান্ট যোগ করুন'
                  : 'e.g. Add woven baskets under the shelf, clear all desk papers, add a plant'
              }
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none resize-none"
            />
          </div>

          <button
            type="button"
            disabled={!sourceImage || isGenerating}
            onClick={handleGenerateRedesign}
            className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
              !sourceImage
                ? 'bg-slate-200 dark:bg-[#1B3329] text-slate-400 cursor-not-allowed'
                : isGenerating
                ? 'bg-[#DDF3E5] text-[#163D32] cursor-wait'
                : 'bg-[#163D32] hover:bg-[#102E25] text-white'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isBn ? 'AI দিয়ে নতুন রুম ডিজাইন হচ্ছে...' : 'Generating AI Room Redesign...'}</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-[#E9B95B]" />
                <span>{isBn ? 'নতুন রুম ডিজাইন তৈরি করুন' : 'Generate AI Room Redesign'}</span>
              </>
            )}
          </button>

          {!sourceImage && (
            <p className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] text-center">
              {isBn
                ? 'প্রথমে ড্যাশবোর্ড থেকে একটি ছবি আপলোড করুন অথবা উপরের বাটনে ক্লিক করুন।'
                : 'Upload a room photo above or select a room on the Dashboard first.'}
            </p>
          )}
        </div>

        {/* Right Interactive Preview & Before/After Comparison */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E9B95B]" />
              <h3 className="font-bold text-sm sm:text-base text-[#163D32] dark:text-[#EDF4EF]">
                {generatedUrl
                  ? isBn
                    ? 'আগে ও পরের AI রিডিজাইন তুলনা'
                    : 'Before & After AI Redesign Preview'
                  : isBn
                  ? 'মূল ঘরের প্রিভিউ'
                  : 'Original Room Preview'}
              </h3>
            </div>

            {generatedUrl && sourceImage && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('slider')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                      viewMode === 'slider' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{isBn ? 'স্লাইডার' : 'Slider'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('side')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                      viewMode === 'side' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'পাশাপাশি' : 'Side-by-Side'}</span>
                  </button>
                </div>

                {onSaveDesign && (
                  <button
                    type="button"
                    disabled={isSavingDesign}
                    onClick={handleSaveToDesigns}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    {isSavingDesign ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : savedToGalleryNotice ? (
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    ) : (
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {savedToGalleryNotice
                        ? isBn
                          ? 'সেভড!'
                          : 'Saved!'
                        : isBn
                        ? 'গ্যালারিতে সেভ'
                        : 'Save to My Designs'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadRedesign}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-semibold whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ডাউনলোড' : 'Save Image'}</span>
                </button>
              </div>
            )}
          </div>

          {!sourceImage ? (
            <div className="aspect-16/10 rounded-2xl bg-[#F7F9F6] dark:bg-[#182C24] border border-dashed border-[#163D32]/20 dark:border-[#345C4B] flex flex-col items-center justify-center p-8 text-center">
              <Wand2 className="w-10 h-10 text-[#163D32]/30 dark:text-[#9FC6B0]/35 mb-3" />
              <p className="text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'কোনো রুমের ছবি নির্বাচন করা হয়নি' : 'No room photo loaded yet'}
              </p>
              <p className="text-xs text-[#163D32]/65 dark:text-[#B9D1C3] mt-1 max-w-sm">
                {isBn
                  ? 'ছবি আপলোড করলে AI আপনার ঘরকে পরিপাটি ও সুন্দরভাবে সাজানোর প্রিভিউ তৈরি করবে।'
                  : 'Upload a messy room photo and watch AI transform it into an organized sanctuary.'}
              </p>
            </div>
          ) : generatedUrl ? (
            viewMode === 'slider' ? (
              <div className="space-y-2.5">
                <div className="relative aspect-16/10 w-full rounded-2xl overflow-hidden bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 select-none">
                  <img
                    src={generatedUrl}
                    alt="AI Redesigned Room"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                  >
                    <img
                      src={sourceImage}
                      alt="Original Room"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#E9B95B] shadow-md pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  />
                  <span className="absolute top-3 left-3 text-xs font-semibold bg-[#163D32]/85 text-white px-2.5 py-1 rounded-lg">
                    {isBn ? 'আগে' : 'Before'}
                  </span>
                  <span className="absolute top-3 right-3 text-xs font-semibold bg-[#E9B95B] text-[#163D32] px-2.5 py-1 rounded-lg">
                    {isBn ? 'AI রিডিজাইন' : 'AI Redesign'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  aria-label="Compare before and AI redesign"
                  className="w-full accent-[#163D32] cursor-ew-resize"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0]">
                    {isBn ? 'আগের অবস্থা' : 'Original Before'}
                  </div>
                  <div className="aspect-4/3 rounded-xl overflow-hidden border border-[#163D32]/15 bg-[#F7F9F6]">
                    <img
                      src={sourceImage}
                      alt="Original Room"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                    {isBn ? 'AI রিডিজাইন' : 'AI Redesigned'} · {t.redesignStyles[selectedStyle].label}
                  </div>
                  <div className="aspect-4/3 rounded-xl overflow-hidden border-2 border-[#163D32] bg-[#F7F9F6]">
                    <img
                      src={generatedUrl}
                      alt="AI Redesigned Room"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="aspect-16/10 w-full rounded-2xl overflow-hidden bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 relative">
              <img
                src={sourceImage}
                alt="Room to redesign"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-[#163D32]/75 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#E9B95B]" />
                  <p className="text-sm font-semibold">
                    {isBn ? 'AI আপনার ঘরের নতুন ডিজাইন তৈরি করছে...' : 'Designing your clutter-free space...'}
                  </p>
                </div>
              )}
            </div>
          )}

          {generatedSummary && (
            <div className="bg-[#DDF3E5]/60 dark:bg-[#1A3329] border border-[#163D32]/15 dark:border-[#2B4E3F] rounded-xl p-3.5 flex items-start justify-between gap-3">
              <p className="text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] leading-relaxed">
                {generatedSummary}
              </p>
              {savedNotice && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#163D32] dark:text-[#E9B95B] shrink-0">
                  <BookmarkCheck className="w-4 h-4" />
                  {isBn ? 'যুক্ত হয়েছে' : 'Linked'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved AI Redesigns Shelf */}
      {savedDesigns.length > 0 && (
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'সংরক্ষিত AI রিডিজাইনসমূহ' : 'Saved AI Designs'} ({savedDesigns.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {savedDesigns.map((design) => (
              <div
                key={design.id}
                className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-3.5 space-y-2.5"
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <img
                    src={design.beforeImageUrl}
                    alt="Before"
                    referrerPolicy="no-referrer"
                    className="aspect-4/3 w-full rounded-xl object-cover border border-[#163D32]/10"
                  />
                  <img
                    src={design.afterImageUrl}
                    alt="AI Redesign"
                    referrerPolicy="no-referrer"
                    className="aspect-4/3 w-full rounded-xl object-cover border-2 border-[#163D32]"
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                      {design.roomName}
                    </div>
                    <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                      {t.redesignStyles[design.style]?.label || design.style} · {design.budgetTier.replace(/_/g, ' ')}
                    </div>
                  </div>
                  {onDeleteDesign && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(design.id)}
                      aria-label="Delete saved design"
                      className="p-1.5 rounded-lg text-[#163D32]/45 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {design.summary && (
                  <p className="text-xs text-[#163D32]/75 dark:text-[#B9D1C3] line-clamp-2">
                    {design.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteId)}
        title={isBn ? 'ডিজাইন মুছে ফেলবেন?' : 'Delete Saved Redesign?'}
        description={
          isBn
            ? 'এই সংরক্ষিত আগে ও পরের ডিজাইনটি গ্যালারি থেকে স্থায়ীভাবে মুছে যাবে।'
            : 'This saved redesign pair will be permanently removed from your gallery.'
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        onConfirm={() => {
          if (pendingDeleteId && onDeleteDesign) {
            onDeleteDesign(pendingDeleteId);
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
