import React from 'react';
import { OutputLanguage, WorkspaceSection } from '../types';
import { Compass, Home, LayoutGrid, HelpCircle } from 'lucide-react';

interface NotFoundViewProps {
  language: OutputLanguage;
  invalidRoute?: string;
  onNavigate: (section: WorkspaceSection) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  language,
  invalidRoute,
  onNavigate,
}) => {
  const isBn = language === 'bn';

  return (
    <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-6 space-y-5">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#DDF3E5] dark:bg-[#1E3B30] text-[#163D32] dark:text-[#E9B95B] flex items-center justify-center">
        <Compass className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#163D32]/65 dark:text-[#9FC6B0] tabular-nums">
          404 · {isBn ? 'পেজ পাওয়া যায়নি' : 'Page Not Found'}
        </div>
        <h2 className="text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
          {isBn ? 'এই রুটটি আমাদের ওয়ার্কস্পেসে নেই' : 'This workspace route does not exist'}
        </h2>
        <p className="text-sm text-[#163D32]/75 dark:text-[#B9D1C3] max-w-md mx-auto">
          {invalidRoute
            ? isBn
              ? `"${invalidRoute}" পাওয়া যায়নি অথবা এই সেকশনটি দেখার অনুমতি আপনার নেই।`
              : `We could not find "${invalidRoute}" or it requires higher workspace permissions.`
            : isBn
            ? 'অনুগ্রহ করে ড্যাশবোর্ডে ফিরে যান অথবা নিচের দ্রুত লিংক ব্যবহার করুন।'
            : 'Return to your NeatSpace AI Dashboard or jump to one of your active organization tools below.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
        >
          <Home className="w-4 h-4 text-[#E9B95B]" />
          <span>{isBn ? 'ড্যাশবোর্ডে ফিরুন' : 'Return to Dashboard'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('planner')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
        >
          <LayoutGrid className="w-4 h-4" />
          <span>{isBn ? '২ডি রুম প্ল্যানার' : '2D Room Planner'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('support')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <HelpCircle className="w-4 h-4" />
          <span>{isBn ? 'হেল্প ও সাপোর্ট' : 'Help Center'}</span>
        </button>
      </div>
    </div>
  );
};
