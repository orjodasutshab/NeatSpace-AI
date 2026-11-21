import React, { useCallback, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, RefreshCw, Layers, Camera } from 'lucide-react';
import { SAMPLE_ROOMS, SampleRoom } from '../data/sampleRooms';
import { OutputLanguage } from '../types';
import { getUILabels } from '../i18n';

interface ImageUploaderProps {
  selectedImage: string | null;
  language: OutputLanguage;
  maxUploadMb?: number;
  onImageSelect: (dataUrl: string) => void;
  onSelectSample: (sample: SampleRoom) => void;
  onClearImage: () => void;
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  selectedImage,
  language,
  maxUploadMb = 10,
  onImageSelect,
  onSelectSample,
  onClearImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const t = getUILabels(language);
  const isBn = language === 'bn';

  const processFile = useCallback(
    (file: File) => {
      if (!ALLOWED_IMAGE_MIMES.has(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
        setUploadError(
          isBn
            ? 'অনুগ্রহ করে কেবল সঠিক ছবি আপলোড করুন (JPEG, PNG, WEBP বা HEIC)।'
            : 'Please upload a valid image file (JPEG, PNG, WEBP, or HEIC).'
        );
        return;
      }
      if (file.type && !ALLOWED_IMAGE_MIMES.has(file.type.toLowerCase())) {
        setUploadError(
          isBn
            ? 'এই ইমেজ ফরম্যাটটি সাপোর্টেড নয়। JPG, PNG, WEBP বা HEIC ব্যবহার করুন।'
            : 'Unsupported image format. Please use JPG, PNG, WEBP, or HEIC.'
        );
        return;
      }
      const maxBytes = maxUploadMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setUploadError(
          isBn
            ? `ছবির আকার সর্বোচ্চ ${maxUploadMb}MB হতে হবে। অনুগ্রহ করে ছোট ছবি বেছে নিন।`
            : `Image exceeds the ${maxUploadMb}MB upload limit. Please select a smaller photo.`
        );
        return;
      }
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageSelect(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    },
    [isBn, maxUploadMb, onImageSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) processFile(file);
            break;
          }
        }
      }
    },
    [processFile]
  );

  React.useEffect(() => {
    window.addEventListener('paste', handlePaste as EventListener);
    return () => window.removeEventListener('paste', handlePaste as EventListener);
  }, [handlePaste]);

  return (
    <div className="w-full space-y-5">
      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-700 hover:underline font-semibold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {!selectedImage ? (
        <div className="space-y-5">
          {/* Main Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="group relative border-2 border-dashed border-[#163D32]/25 dark:border-[#345C4B] hover:border-[#163D32] dark:hover:border-[#E9B95B] bg-white dark:bg-[#13241D] hover:bg-[#DDF3E5]/25 dark:hover:bg-[#1A3329] rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#DDF3E5] dark:bg-[#1E3B30] border border-[#163D32]/15 dark:border-[#2E5747] flex items-center justify-center text-[#163D32] dark:text-[#E9B95B]">
              <Upload className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-[#163D32] dark:text-[#EDF4EF] mb-1">
              {t.uploadTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] max-w-md mx-auto mb-5">
              {t.uploadDesc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                <ImageIcon className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
                <span>{t.uploadFormats}</span>
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#DDF3E5] dark:bg-[#1E3B30] hover:bg-[#cdebd8] text-[#163D32] dark:text-[#EDF4EF] transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-[#163D32] dark:text-[#E9B95B]" />
                <span>{t.uploadCamera}</span>
              </button>
            </div>
          </div>

          {/* Sample Rooms Selection */}
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
                <h4 className="font-bold text-[#163D32] dark:text-[#EDF4EF] text-sm sm:text-base">
                  {t.sampleTitle}
                </h4>
              </div>
              <span className="text-xs text-[#163D32]/60 dark:text-[#9FC6B0] hidden sm:inline">
                {t.sampleHint}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SAMPLE_ROOMS.map((sample) => {
                const hasFailed = failedImages[sample.id];
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onSelectSample(sample)}
                    className="group flex flex-col text-left bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/40 dark:hover:bg-[#1E372D] border border-[#163D32]/10 dark:border-[#264638] hover:border-[#163D32]/40 rounded-xl overflow-hidden transition-colors"
                  >
                    <div className="relative aspect-4/3 w-full overflow-hidden bg-[#DDF3E5]/40 dark:bg-[#0D1A15]">
                      {!hasFailed ? (
                        <img
                          src={sample.imageUrl}
                          alt={sample.title}
                          referrerPolicy="no-referrer"
                          onError={() => setFailedImages((prev) => ({ ...prev, [sample.id]: true }))}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#163D32]/40">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#163D32]/85 via-[#163D32]/20 to-transparent" />
                      <span className="absolute bottom-2 left-2.5 right-2.5 text-xs font-semibold text-white line-clamp-1">
                        {sample.title}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] text-[#163D32]/70 dark:text-[#B9D1C3] line-clamp-2 leading-snug">
                        {sample.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview Box */
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl overflow-hidden p-4">
          <div className="relative aspect-16/10 w-full rounded-xl overflow-hidden bg-[#F7F9F6] dark:bg-[#0D1A15] border border-[#163D32]/10 dark:border-[#264638]">
            <img
              src={selectedImage}
              alt="Selected room to analyze"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />

            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={onClearImage}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white/95 dark:bg-[#13241D]/95 hover:bg-rose-50 text-[#163D32] dark:text-[#EDF4EF] hover:text-rose-700 border border-[#163D32]/15 dark:border-[#264638] hover:border-rose-300 px-3 py-1.5 rounded-xl backdrop-blur-md transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.changePhoto}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
