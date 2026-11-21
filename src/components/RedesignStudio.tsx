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
        isBn ? 'à¦…à¦¨à§à¦—à§à¦°à¦¹ à¦•à¦°à§‡ à¦à¦•à¦Ÿà¦¿ à¦¸à¦ à¦¿à¦• à¦›à¦¬à¦¿à¦° à¦«à¦¾à¦‡à¦² à¦†à¦ªà¦²à§‹à¦¡ à¦•à¦°à§à¦¨à¥¤' : 'Please select a valid image file.'
      );
      e.target.value = '';
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      setErrorMsg(
        isBn
          ? `à¦›à¦¬à¦¿à¦° à¦†à¦•à¦¾à¦° à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š ${maxUploadMb}MB à¦¹à¦¤à§‡ à¦¹à¦¬à§‡à¥¤`
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
            ? `AI à¦°à§à¦® à¦°à¦¿à¦¡à¦¿à¦œà¦¾à¦‡à¦¨ (${t.redesignStyles[selectedStyle].label})`
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
          `${t.roomLabels[activeRoomType]} Â· ${t.redesignStyles[selectedStyle].label}`,
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
