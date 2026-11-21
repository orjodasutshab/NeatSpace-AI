import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
      className="fixed inset-0 z-[70] bg-[#163D32]/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#2A4C3E] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                destructive
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-[#DDF3E5] text-[#163D32] dark:bg-[#1E3B30] dark:text-[#DDF3E5]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]"
              >
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-[#163D32]/75 dark:text-[#B9D1C3] mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1.5 text-[#163D32]/55 dark:text-[#B9D1C3] hover:text-[#163D32] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#163D32]/10 dark:border-[#2A4C3E]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#F7F9F6] dark:bg-[#1A3128] text-[#163D32] dark:text-[#EDF4EF] border border-[#163D32]/15 dark:border-[#2A4C3E] hover:bg-[#DDF3E5]/50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-[#163D32] hover:bg-[#102E25] text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
