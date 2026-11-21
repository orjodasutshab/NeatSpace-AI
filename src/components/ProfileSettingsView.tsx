import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FocusGoal,
  OutputLanguage,
  PlanTier,
  PrivacySettings,
  RedesignStyle,
  UserPreferences,
} from '../types';
import { PLAN_SPECS } from '../planConfig';
import { getUILabels } from '../i18n';
import {
  User as UserIcon,
  Sun,
  Moon,
  Globe,
  Bell,
  Download,
  LogIn,
  LogOut,
  Check,
  Sparkles,
  Shield,
  CreditCard,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface ProfileSettingsViewProps {
  user: User | null;
  language: OutputLanguage;
  preferences: UserPreferences;
  points: number;
  streakDays: number;
  savedRoomsCount: number;
  planTier?: PlanTier;
  privacy?: PrivacySettings;
  onLanguageChange: (lang: OutputLanguage) => void;
  onUpdatePreferences: (next: UserPreferences) => void;
  onUpdatePrivacy?: (next: PrivacySettings) => void;
  onOpenPricing?: () => void;
  onDeleteAccount?: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onExportAllData: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const STYLE_OPTIONS: RedesignStyle[] = [
  'minimalist',
  'scandinavian',
  'modern',
  'luxury',
  'bohemian',
  'japandi',
  'industrial',
  'contemporary',
];

const GOAL_OPTIONS: FocusGoal[] = [
  'quick_wins',
  'maximize_space',
  'storage_solutions',
  'aesthetic_reset',
  'deep_declutter',
];

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  user,
  language,
  preferences,
  points,
  streakDays,
  savedRoomsCount,
  planTier = 'free',
  privacy = {
    allowAiPersonalization: true,
    autoSaveAnalyses: true,
    shareAnonymousUsage: false,
  },
  onLanguageChange,
  onUpdatePreferences,
  onUpdatePrivacy,
  onOpenPricing,
  onDeleteAccount,
  onDirtyChange,
  onExportAllData,
  onSignIn,
  onSignOut,
}) => {
  const isBn = language === 'bn';
  const t = getUILabels(language);
  const [goalDraft, setGoalDraft] = useState(preferences.homeGoalStatement);
  const [savedToast, setSavedToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isGoalDirty = goalDraft.trim() !== (preferences.homeGoalStatement || '').trim();

  useEffect(() => {
    setGoalDraft(preferences.homeGoalStatement || '');
  }, [preferences.homeGoalStatement]);

  useEffect(() => {
    onDirtyChange?.(isGoalDirty);
  }, [isGoalDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  const handleSaveGoal = () => {
    onUpdatePreferences({ ...preferences, homeGoalStatement: goalDraft.trim().slice(0, 200) });
    onDirtyChange?.(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handlePermanentDelete = async () => {
    if (!onDeleteAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setDeleteError(
        err?.message ||
          (isBn
            ? 'অ্যাকাউন্ট ডিলিট করার আগে পুনরায় Google Sign-In করতে হতে পারে।'
            : 'Please re-authenticate and try deleting your account again.')
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const activePlan = PLAN_SPECS[planTier];

  return (
    <div className="space-y-6">
      {/* Account Profile Header Card */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Profile'}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border border-[#163D32]/15 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#DDF3E5] text-[#163D32] flex items-center justify-center shrink-0">
              <UserIcon className="w-8 h-8" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
              {user?.displayName || (isBn ? 'গেস্ট অর্গানাইজার' : 'Guest Organizer')}
            </h2>
            <p className="text-xs sm:text-sm text-[#163D32]/70 dark:text-[#B9D1C3] truncate">
              {user?.email || (isBn ? 'লোকাল ব্রাউজার মোড · ক্লাউড সিঙ্ক বন্ধ' : 'Local browser storage · Sign in to cloud sync')}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono tabular-nums">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#DDF3E5] text-[#163D32] font-bold">
                {points} pts
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 text-[#163D32] dark:text-[#EDF4EF]">
                {streakDays}d streak
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 text-[#163D32] dark:text-[#EDF4EF]">
                {savedRoomsCount} rooms
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.navSignOut}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors"
            >
              <LogIn className="w-4 h-4 text-[#E9B95B]" />
              <span>{t.navSignIn} (Google Sync)</span>
            </button>
          )}
        </div>
      </div>

      {/* Appearance & Language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <Sun className="w-4 h-4 text-[#E9B95B]" />
            <span>{isBn ? 'থিম ও ভাষা সেটিংস' : 'Appearance & Language'}</span>
          </h3>

          {/* Light / Dark Mode */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'অ্যাপ থিম' : 'Color Theme'}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn ? 'লাইট বা ডার্ক মোড বেছে নিন' : 'Switch between Light Sage and Forest Dark'}
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#13241D] rounded-xl border border-[#163D32]/10">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ ...preferences, theme: 'light' })}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                  preferences.theme === 'light'
                    ? 'bg-[#163D32] text-white'
                    : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>{isBn ? 'লাইট' : 'Light'}</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ ...preferences, theme: 'dark' })}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                  preferences.theme === 'dark'
                    ? 'bg-[#E9B95B] text-[#163D32]'
                    : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডার্ক' : 'Dark'}</span>
              </button>
            </div>
          </div>

          {/* Language Preference */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638]">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
              <div>
                <div className="text-xs sm:text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'ভাষা নির্বাচন' : 'Interface & AI Language'}
                </div>
                <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                  English / বাংলা
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#13241D] rounded-xl border border-[#163D32]/10">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  language === 'en' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('bn')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  language === 'bn' ? 'bg-[#163D32] text-white' : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          {/* Notification Toggles */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
                <span className="text-xs sm:text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'কাজ ও রিমাইন্ডার অ্যালার্ট' : 'Cleaning Reminder Alerts'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.pushNotifications}
                onChange={(e) =>
                  onUpdatePreferences({ ...preferences, pushNotifications: e.target.checked })
                }
                className="w-4 h-4 accent-[#163D32]"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[#E9B95B]" />
                <span className="text-xs sm:text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                  {isBn ? 'টাস্ক ডেডলাইন নোটিফিকেশন' : 'Task Deadline Notifications'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.deadlineAlerts}
                onChange={(e) =>
                  onUpdatePreferences({ ...preferences, deadlineAlerts: e.target.checked })
                }
                className="w-4 h-4 accent-[#163D32]"
              />
            </label>
          </div>
        </div>

        {/* Organization & Design Preferences */}
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'হোম অর্গানাইজেশন পছন্দসমূহ' : 'Organization & Redesign Preferences'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'পছন্দের ডিজাইন স্টাইল' : 'Default Redesign Style'}
              </label>
              <select
                value={preferences.preferredStyle}
                onChange={(e) =>
                  onUpdatePreferences({
                    ...preferences,
                    preferredStyle: e.target.value as RedesignStyle,
                  })
                }
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
              >
                {STYLE_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {t.redesignStyles[st]?.label || st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] mb-1">
                {isBn ? 'প্রধান লক্ষ্য' : 'Default Focus Goal'}
              </label>
              <select
                value={preferences.preferredGoal}
                onChange={(e) =>
                  onUpdatePreferences({
                    ...preferences,
                    preferredGoal: e.target.value as FocusGoal,
                  })
                }
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF]"
              >
                {GOAL_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {t.goalLabels[g].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0]">
                {isBn ? 'আপনার বাসার মূল লক্ষ্য' : 'Personal Home Organization Goal'}
              </label>
              {isGoalDirty && (
                <span className="text-[11px] font-semibold text-amber-700 dark:text-[#E9B95B]">
                  {isBn ? 'অসংরক্ষিত পরিবর্তন' : 'Unsaved draft'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder={
                  isBn
                    ? 'যেমন: প্রতিদিন রাতে ১০ মিনিটে বসার ঘর গোছানো'
                    : 'e.g. Keep kitchen counters clear every evening'
                }
                className="flex-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#163D32] dark:text-[#EDF4EF] outline-none"
              />
              <button
                type="button"
                onClick={handleSaveGoal}
                className="px-3.5 py-2 rounded-xl bg-[#163D32] text-white text-xs font-bold flex items-center gap-1"
              >
                {savedToast ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{savedToast ? (isBn ? 'সেভড' : 'Saved') : (isBn ? 'সেভ' : 'Save')}</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#163D32]/10 dark:border-[#264638] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0]">
              {isBn
                ? 'আপনার সব রুম, ইনভেন্টরি, বাজেট ও প্ল্যান ব্যাকআপ ডাউনলোড করুন।'
                : 'Download a full JSON backup of your rooms, inventory, budget, layouts, and tasks.'}
            </div>
            <button
              type="button"
              onClick={onExportAllData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isBn ? 'সম্পূর্ণ ব্যাকআপ ডাউনলোড' : 'Export All Data (JSON)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Summary & Privacy Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#E9B95B]" />
              <span>{isBn ? 'সাবস্ক্রিপশন ও প্ল্যান' : 'Subscription & Plan'}</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-[#DDF3E5] text-[#163D32] text-xs font-bold uppercase">
              {isBn ? activePlan.nameBn : activePlan.name}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#163D32]/75 dark:text-[#B9D1C3]">
            {isBn ? activePlan.audienceBn : activePlan.audience}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] rounded-xl p-3 font-mono tabular-nums">
            <div>
              <div className="text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {activePlan.monthlyRoomAnalyses}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn ? 'স্ক্যান/মাস' : 'Scans/mo'}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {activePlan.monthlyRedesigns}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn ? 'রিডিজাইন/মাস' : 'Redesigns'}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {activePlan.maxSavedRooms}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn ? 'রুম সীমা' : 'Max Rooms'}
              </div>
            </div>
          </div>

          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors"
            >
              <span>{isBn ? 'প্ল্যান আপগ্রেড বা পরিচালনা করুন' : 'Upgrade or Manage Subscription'}</span>
              <ArrowRight className="w-4 h-4 text-[#E9B95B]" />
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B]" />
            <span>{isBn ? 'প্রাইভেসি ও ডেটা নিয়ন্ত্রণ' : 'Privacy & Data Controls'}</span>
          </h3>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'পার্সোনালাইজড AI পরামর্শ' : 'Personalized AI Recommendations'}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn
                  ? 'আপনার রুম ও স্টাইল পছন্দ অনুযায়ী কোচের পরামর্শ'
                  : 'Tailor AI Coach and plans using saved room context'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={privacy.allowAiPersonalization}
              onChange={(e) =>
                onUpdatePrivacy?.({ ...privacy, allowAiPersonalization: e.target.checked })
              }
              className="w-4 h-4 accent-[#163D32]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'অ্যানালাইসিস অটো-সেভ' : 'Auto-Save Room Scans'}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn
                  ? 'বিশ্লেষণের পর সাময়িক ফলাফল ব্রাউজারে সংরক্ষণ করুন'
                  : 'Preserve the active scan workspace across refreshes'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={privacy.autoSaveAnalyses}
              onChange={(e) =>
                onUpdatePrivacy?.({ ...privacy, autoSaveAnalyses: e.target.checked })
              }
              className="w-4 h-4 accent-[#163D32]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'অজ্ঞাত ফিচার অ্যানালিটিক্স' : 'Share Anonymous Feature Metrics'}
              </div>
              <div className="text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                {isBn
                  ? 'কোনো ছবি বা ব্যক্তিগত তথ্য ছাড়াই পারফরম্যান্স উন্নতি'
                  : 'Help improve AI feature quality without sharing photos'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={privacy.shareAnonymousUsage}
              onChange={(e) =>
                onUpdatePrivacy?.({ ...privacy, shareAnonymousUsage: e.target.checked })
              }
              className="w-4 h-4 accent-[#163D32]"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone: Permanent Account Deletion */}
      {user && onDeleteAccount && (
        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{isBn ? 'স্থায়ী অ্যাকাউন্ট মুছে ফেলা (Danger Zone)' : 'Danger Zone — Delete Account'}</span>
              </h3>
              <p className="text-xs text-rose-700/85 dark:text-rose-300/85 mt-0.5">
                {isBn
                  ? 'এটি করলে আপনার ক্লাউড রুম, ইনভেন্টরি, বাজেট, ২ডি লেআউট এবং প্রোফাইল স্থায়ীভাবে মুছে যাবে।'
                  : 'Permanently erase your cloud rooms, inventory, budget, layouts, billing history, and account.'}
              </p>
            </div>
            {!showDeleteConfirm && (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? 'অ্যাকাউন্ট ডিলিট করুন' : 'Delete My Account'}</span>
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="bg-white dark:bg-[#13241D] border border-rose-300 dark:border-rose-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                {isBn
                  ? 'নিশ্চিত করতে নিচের বক্সে ইংরেজিতে DELETE লিখুন:'
                  : 'Type DELETE below to confirm permanent erasure of all your data:'}
              </p>
              {deleteError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{deleteError}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="flex-1 bg-[#F7F9F6] dark:bg-[#182C24] border border-rose-300 dark:border-rose-700 rounded-xl px-3 py-2 text-xs font-mono text-[#163D32] dark:text-[#EDF4EF] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAccount}
                    onClick={handlePermanentDelete}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-45 text-white text-xs font-bold"
                  >
                    {isDeletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>{isBn ? 'স্থায়ীভাবে মুছুন' : 'Confirm Deletion'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32] dark:text-[#EDF4EF] text-xs font-bold border border-[#163D32]/15"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
