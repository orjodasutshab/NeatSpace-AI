import React from 'react';
import { RoomType, FocusGoal, OutputLanguage } from '../types';
import { getUILabels } from '../i18n';
import {
  Sparkles,
  Home,
  Bed,
  Briefcase,
  Utensils,
  UtensilsCrossed,
  Shirt,
  Bath,
  Warehouse,
  Baby,
  Zap,
  Maximize2,
  PackageCheck,
  Palette,
  Trash2,
  Loader2,
  Globe,
  Clock,
} from 'lucide-react';

interface AnalysisOptionsProps {
  roomType: RoomType;
  focusGoal: FocusGoal;
  language: OutputLanguage;
  customContext: string;
  dailyMinutes: number;
  isAnalyzing: boolean;
  hasImage: boolean;
  onRoomTypeChange: (type: RoomType) => void;
  onFocusGoalChange: (goal: FocusGoal) => void;
  onLanguageChange: (lang: OutputLanguage) => void;
  onCustomContextChange: (text: string) => void;
  onDailyMinutesChange: (mins: number) => void;
  onAnalyze: () => void;
}

const ROOM_TYPES: Array<{ id: RoomType; icon: React.ReactNode }> = [
  { id: 'living_room', icon: <Home className="w-4 h-4" /> },
  { id: 'bedroom', icon: <Bed className="w-4 h-4" /> },
  { id: 'home_office', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'kitchen', icon: <Utensils className="w-4 h-4" /> },
  { id: 'dining_room', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { id: 'closet', icon: <Shirt className="w-4 h-4" /> },
  { id: 'bathroom', icon: <Bath className="w-4 h-4" /> },
  { id: 'garage', icon: <Warehouse className="w-4 h-4" /> },
  { id: 'kids_room', icon: <Baby className="w-4 h-4" /> },
];

const FOCUS_GOALS: Array<{ id: FocusGoal; icon: React.ReactNode }> = [
  { id: 'quick_wins', icon: <Zap className="w-4 h-4 text-[#E9B95B]" /> },
  { id: 'maximize_space', icon: <Maximize2 className="w-4 h-4 text-[#163D32]" /> },
  { id: 'storage_solutions', icon: <PackageCheck className="w-4 h-4 text-[#163D32]" /> },
  { id: 'aesthetic_reset', icon: <Palette className="w-4 h-4 text-[#163D32]" /> },
  { id: 'deep_declutter', icon: <Trash2 className="w-4 h-4 text-rose-600" /> },
];

const DAILY_MINUTES_OPTIONS = [10, 15, 20, 30, 45, 60];

export const AnalysisOptions: React.FC<AnalysisOptionsProps> = ({
  roomType,
  focusGoal,
  language,
  customContext,
  dailyMinutes,
  isAnalyzing,
  hasImage,
  onRoomTypeChange,
  onFocusGoalChange,
  onLanguageChange,
  onCustomContextChange,
  onDailyMinutesChange,
  onAnalyze,
}) => {
  const t = getUILabels(language);
  const isBn = language === 'bn';

  return (
    <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Room Type Selector */}
      <div>
        <label className="block text-xs font-bold tracking-wide text-[#163D32] dark:text-[#EDF4EF] mb-2.5">
          {t.step1Label}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
          {ROOM_TYPES.map((type) => {
            const isSelected = roomType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onRoomTypeChange(type.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#DDF3E5] border-[#163D32] text-[#163D32] dark:bg-[#1E3B30] dark:border-[#E9B95B] dark:text-[#EDF4EF]'
                    : 'bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/40 dark:hover:bg-[#1E372D] border-[#163D32]/10 dark:border-[#264638] text-[#163D32]/75 dark:text-[#B9D1C3]'
                }`}
              >
                <span className="shrink-0">{type.icon}</span>
                <span className="truncate">{t.roomLabels[type.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus Goal Selector */}
      <div>
        <label className="block text-xs font-bold tracking-wide text-[#163D32] dark:text-[#EDF4EF] mb-2.5">
          {t.step2Label}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          {FOCUS_GOALS.map((goal) => {
            const isSelected = focusGoal === goal.id;
            const localizedGoal = t.goalLabels[goal.id];
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => onFocusGoalChange(goal.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-[#DDF3E5]/80 border-[#163D32] dark:bg-[#1E3B30] dark:border-[#E9B95B]'
                    : 'bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5]/30 dark:hover:bg-[#1E372D] border-[#163D32]/10 dark:border-[#264638]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected
                      ? 'bg-[#163D32] text-white'
                      : 'bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638]'
                  }`}
                >
                  {goal.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                    {localizedGoal.label}
                  </div>
                  <p className="text-[11px] text-[#163D32]/70 dark:text-[#B9D1C3] mt-0.5 leading-snug">
                    {localizedGoal.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personalized Daily Time Budget */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#163D32] dark:text-[#EDF4EF]">
            <Clock className="w-3.5 h-3.5 text-[#163D32] dark:text-[#E9B95B]" />
            <span>{t.dailyBudgetLabel}</span>
          </label>
          <span className="text-xs font-mono font-bold text-[#163D32] dark:text-[#E9B95B] tabular-nums">
            {dailyMinutes}m / {isBn ? 'দিন' : 'session'}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {DAILY_MINUTES_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onDailyMinutesChange(mins)}
              className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors tabular-nums ${
                dailyMinutes === mins
                  ? 'bg-[#163D32] text-white border-[#163D32] dark:bg-[#E9B95B] dark:text-[#163D32] dark:border-[#E9B95B]'
                  : 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/75 dark:text-[#B9D1C3] border-[#163D32]/10 dark:border-[#264638] hover:bg-[#DDF3E5]/50'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      {/* Extra Custom Constraints */}
      <div>
        <label className="block text-xs font-bold tracking-wide text-[#163D32] dark:text-[#EDF4EF] mb-2">
          {t.step3ContextLabel}
        </label>
        <input
          type="text"
          value={customContext}
          onChange={(e) => onCustomContextChange(e.target.value.slice(0, 300))}
          placeholder={t.step3ContextPlaceholder}
          className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] focus:border-[#163D32] dark:focus:border-[#E9B95B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] placeholder-[#163D32]/45 dark:placeholder-[#9FC6B0]/50 outline-none"
        />
      </div>

      {/* Output Language Selector */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#163D32]/10 dark:border-[#264638]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]">
          <Globe className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
          <span>{t.langLabel}</span>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl">
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              language === 'en' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('bn')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              language === 'bn' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>

      {/* Submit Action Button */}
      <div className="pt-1">
        <button
          type="button"
          disabled={!hasImage || isAnalyzing}
          onClick={onAnalyze}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors ${
            !hasImage
              ? 'bg-slate-200 dark:bg-[#1A2E26] text-slate-400 dark:text-[#6B8F7C] cursor-not-allowed'
              : isAnalyzing
              ? 'bg-[#DDF3E5] text-[#163D32] cursor-wait'
              : 'bg-[#163D32] hover:bg-[#102E25] dark:bg-[#E9B95B] dark:hover:bg-[#dfb04f] text-white dark:text-[#163D32]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t.analyzingButton}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-[#E9B95B] dark:text-[#163D32]" />
              <span>{t.analyzeButton}</span>
            </>
          )}
        </button>
        {!hasImage && (
          <p className="text-center text-xs text-[#163D32]/60 dark:text-[#9FC6B0] mt-2">
            {t.uploadPromptHint}
          </p>
        )}
      </div>
    </div>
  );
};
