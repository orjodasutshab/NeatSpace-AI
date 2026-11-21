import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  RoomAnalysis,
  RoomType,
  ActionStep,
  TriageDecision,
  TriageItem,
  FloorplanZone,
  WeeklyScheduleDay,
  SeasonalChecklistItem,
  OutputLanguage,
  WorkspaceSection,
  StorageInventoryItem,
  CleaningHistoryEntry,
  ReminderConfig,
  FamilyMember,
  RedesignStyle,
  CalendarTask,
  SavedRedesign,
  UserPreferences,
  FamilyActivityEntry,
  AppNotification,
  TaskPriority,
  NotificationCategory,
  UserRole,
  AccountStatus,
  PlanTier,
  SubscriptionRecord,
  PrivacySettings,
  UsageCounters,
  BillingInvoice,
  BudgetExpense,
  RoomLayoutPlan,
  FeedbackItem,
  UserReportItem,
  SystemConfigSettings,
} from './types';
import {
  PLAN_SPECS,
  DEFAULT_SYSTEM_CONFIG,
  ADMIN_OPERATOR_EMAIL,
  getCurrentMonthKey,
} from './planConfig';
import { getUILabels } from './i18n';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SampleRoom } from './data/sampleRooms';
import { ImageUploader } from './components/ImageUploader';
import { AnalysisOptions } from './components/AnalysisOptions';
import { AnalysisResults } from './components/AnalysisResults';
import { DeclutterChat } from './components/DeclutterChat';
import { SavedRoomsList } from './components/SavedRoomsList';
import { OrganizationToolsModal, OrganizationToolTab } from './components/OrganizationToolsModal';
import { CalendarRemindersView } from './components/CalendarRemindersView';
import { StorageInventoryView } from './components/StorageInventoryView';
import { FamilyHubView } from './components/FamilyHubView';
import { HomeDashboardOverview } from './components/HomeDashboardOverview';
import { BeforeAfterGalleryView } from './components/BeforeAfterGalleryView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { TutorialModal } from './components/TutorialModal';
import { AuthModal } from './components/AuthModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { prepareImageForAnalysis, createThumbnailDataUrl } from './utils/imageUtils';
import {
  auth,
  signOutUser,
  resendVerificationEmail,
  ensureUserProfile,
  saveUserWorkspaceToFirestore,
  subscribeToUserProfile,
  saveRoomToFirestore,
  updateRoomProgressInFirestore,
  updateRoomAfterComparisonInFirestore,
  deleteRoomFromFirestore,
  subscribeToUserRooms,
  saveInventoryItemToFirestore,
  deleteInventoryItemFromFirestore,
  subscribeToInventory,
  saveCalendarTaskToFirestore,
  deleteCalendarTaskFromFirestore,
  subscribeToCalendarTasks,
  saveDesignToFirestore,
  deleteDesignFromFirestore,
  subscribeToSavedDesigns,
  saveBudgetExpenseToFirestore,
  deleteBudgetExpenseFromFirestore,
  subscribeToBudgetExpenses,
  saveRoomLayoutToFirestore,
  deleteRoomLayoutFromFirestore,
  subscribeToRoomLayouts,
  subscribeToMonthlyUsage,
  incrementMonthlyUsageInFirestore,
  subscribeToBillingHistory,
  subscribeToUserFeedback,
  subscribeToUserReports,
  subscribeToSystemConfig,
  deleteAllUserAccountData,
  updateUserGovernanceAdmin,
  recordBillingInvoiceAdmin,
} from './firebase';
import {
  Sparkles,
  MessageSquare,
  AlertTriangle,
  X,
  CheckCircle2,
  FolderHeart,
  LayoutDashboard,
  Wand2,
  CalendarDays,
  Package,
  BarChart3,
  Users,
  Wrench,
  Bell,
  Globe,
  Plus,
  Camera,
  Flame,
  Award,
  LogIn,
  LogOut,
  Menu,
  PanelRightOpen,
  PanelRightClose,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  CheckCheck,
  Search,
  HelpCircle,
  Sun,
  Moon,
  Columns2,
  User as UserIcon,
  Wallet,
  Ruler,
  CreditCard,
  ShieldAlert,
  Ban,
  Loader2,
} from 'lucide-react';

const RedesignStudio = lazy(() =>
  import('./components/RedesignStudio').then((m) => ({ default: m.RedesignStudio }))
);
const DashboardStatsView = lazy(() =>
  import('./components/DashboardStatsView').then((m) => ({ default: m.DashboardStatsView }))
);
const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const SubscriptionPricingView = lazy(() =>
  import('./components/SubscriptionPricingView').then((m) => ({
    default: m.SubscriptionPricingView,
  }))
);
const BudgetShoppingView = lazy(() =>
  import('./components/BudgetShoppingView').then((m) => ({ default: m.BudgetShoppingView }))
);
const RoomLayoutPlannerView = lazy(() =>
  import('./components/RoomLayoutPlannerView').then((m) => ({ default: m.RoomLayoutPlannerView }))
);
const HelpSupportView = lazy(() =>
  import('./components/HelpSupportView').then((m) => ({ default: m.HelpSupportView }))
);
const NotFoundView = lazy(() =>
  import('./components/NotFoundView').then((m) => ({ default: m.NotFoundView }))
);

const LOCAL_STORAGE_KEY = 'neatspace_saved_rooms';
const FOCUS_MINUTES_KEY = 'neatspace_focus_minutes';
const INVENTORY_KEY = 'neatspace_inventory';
const HISTORY_KEY = 'neatspace_history';
const POINTS_KEY = 'neatspace_points';
const STREAK_KEY = 'neatspace_streak';
const REMINDER_KEY = 'neatspace_reminder';
const FAMILY_KEY = 'neatspace_family';
const CALENDAR_TASKS_KEY = 'neatspace_calendar_tasks';
const SAVED_DESIGNS_KEY = 'neatspace_saved_designs';
const PREFERENCES_KEY = 'neatspace_preferences';
const FAMILY_LOGS_KEY = 'neatspace_family_logs';
const NOTIFICATIONS_KEY = 'neatspace_notifications';
const SIDEBAR_COLLAPSED_KEY = 'neatspace_sidebar_collapsed';
const BUDGET_EXPENSES_KEY = 'neatspace_budget_items';
const ROOM_LAYOUTS_KEY = 'neatspace_room_layouts';
const PRIVACY_KEY = 'neatspace_privacy';

const VALID_HASH_SECTIONS: WorkspaceSection[] = [
  'dashboard',
  'redesign',
  'rooms',
  'gallery',
  'calendar',
  'inventory',
  'planner',
  'budget',
  'stats',
  'family',
  'pricing',
  'support',
  'profile',
  'admin',
];

const DEFAULT_PRIVACY: PrivacySettings = {
  shareAnonymousUsage: true,
  allowAiPersonalization: true,
  autoSaveAnalyses: true,
};

const BADGE_THRESHOLDS = [25, 75, 150, 250, 500, 800];

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredStyle: 'minimalist',
  preferredGoal: 'quick_wins',
  dailyBudgetMinutes: 20,
  homeGoalStatement: '',
  theme: 'light',
  pushNotifications: true,
  deadlineAlerts: true,
};

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatRelativeTime(ts: number, isBn: boolean): string {
  const diffMins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMins < 1) return isBn ? 'à¦à¦‡à¦®à¦¾à¦¤à§à¦°' : 'Just now';
  if (diffMins < 60) return isBn ? `${diffMins}à¦®à¦¿ à¦†à¦—à§‡` : `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return isBn ? `${diffHrs}à¦˜ à¦†à¦—à§‡` : `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return isBn ? `${diffDays}à¦¦à¦¿à¦¨ à¦†à¦—à§‡` : `${diffDays}d ago`;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('dashboard');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    readJsonStorage<UserPreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES)
  );

  const [roomType, setRoomType] = useState<RoomType>('home_office');
  const [focusGoal, setFocusGoal] = useState<UserPreferences['preferredGoal']>(
    () => readJsonStorage<UserPreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES).preferredGoal
  );
  const [dailyMinutes, setDailyMinutes] = useState<number>(
    () => readJsonStorage<UserPreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES).dailyBudgetMinutes || 20
  );
  const [language, setLanguage] = useState<OutputLanguage>('en');
  const [customContext, setCustomContext] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isComparingAfter, setIsComparingAfter] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<RoomAnalysis | null>(null);

  // Auth & Database State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [savedRooms, setSavedRooms] = useState<RoomAnalysis[]>(() =>
    readJsonStorage<RoomAnalysis[]>(LOCAL_STORAGE_KEY, [])
  );

  // Extended User Workspace State
  const [storageInventory, setStorageInventory] = useState<StorageInventoryItem[]>(() =>
    readJsonStorage<StorageInventoryItem[]>(INVENTORY_KEY, [])
  );
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>(() =>
    readJsonStorage<CalendarTask[]>(CALENDAR_TASKS_KEY, [])
  );
  const [savedDesigns, setSavedDesigns] = useState<SavedRedesign[]>(() =>
    readJsonStorage<SavedRedesign[]>(SAVED_DESIGNS_KEY, [])
  );
  const [cleaningHistory, setCleaningHistory] = useState<CleaningHistoryEntry[]>(() =>
    readJsonStorage<CleaningHistoryEntry[]>(HISTORY_KEY, [])
  );
  const [points, setPoints] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(POINTS_KEY) || 35) || 35;
    } catch {
      return 35;
    }
  });
  const [streakDays, setStreakDays] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STREAK_KEY) || 1) || 1;
    } catch {
      return 1;
    }
  });
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(() =>
    readJsonStorage<ReminderConfig>(REMINDER_KEY, {
      enabled: true,
      time: '19:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      frequency: 'daily',
    })
  );
