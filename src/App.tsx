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
  if (diffMins < 1) return isBn ? 'এইমাত্র' : 'Just now';
  if (diffMins < 60) return isBn ? `${diffMins}মি আগে` : `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return isBn ? `${diffHrs}ঘ আগে` : `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return isBn ? `${diffDays}দিন আগে` : `${diffDays}d ago`;
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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() =>
    readJsonStorage<FamilyMember[]>(FAMILY_KEY, [
      { id: 'mem_me', name: 'Me', role: 'Home Lead', color: '#163D32', points: 35 },
    ])
  );
  const [familyLogs, setFamilyLogs] = useState<FamilyActivityEntry[]>(() =>
    readJsonStorage<FamilyActivityEntry[]>(FAMILY_LOGS_KEY, [])
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const existing = readJsonStorage<AppNotification[]>(NOTIFICATIONS_KEY, []);
    if (existing.length > 0) return existing;
    return [
      {
        id: 'notif_welcome',
        category: 'reminder',
        title: 'Welcome to NeatSpace AI',
        body: 'Upload a room photo to generate your personalized clutter score, object map, and 15-minute plan.',
        timestamp: Date.now(),
        read: false,
        targetSection: 'dashboard',
      },
    ];
  });
  const [focusMinutesTotal, setFocusMinutesTotal] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(FOCUS_MINUTES_KEY) || 0) || 0;
    } catch {
      return 0;
    }
  });

  // UI Overlays, Drawers & Navigation
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);
  const [isDesktopCoachOpen, setIsDesktopCoachOpen] = useState<boolean>(false);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(false);
  const [toolsTab, setToolsTab] = useState<OrganizationToolTab>('analytics');
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [pendingDeleteGalleryDesignId, setPendingDeleteGalleryDesignId] = useState<string | null>(
    null
  );

  // Phases 7–13 SaaS State (RBAC, Quotas, Billing, Budget, 2D Layouts, Support, Config, Unsaved Guards)
  const [invalidRoute, setInvalidRoute] = useState<string>('');
  const [pendingNavigationSection, setPendingNavigationSection] = useState<WorkspaceSection | null>(
    null
  );
  const [isChildDirty, setIsChildDirty] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [userStatus, setUserStatus] = useState<AccountStatus>('active');
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [subscriptionRecord, setSubscriptionRecord] = useState<SubscriptionRecord | undefined>(
    undefined
  );
  const [serverSubscription, setServerSubscription] = useState<
    (SubscriptionRecord & { pendingFirestoreSync?: boolean }) | undefined
  >(undefined);
  const [serverBillingInvoices, setServerBillingInvoices] = useState<BillingInvoice[]>([]);
  const [pendingCheckoutSessionId, setPendingCheckoutSessionId] = useState<string | null>(null);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() =>
    readJsonStorage<PrivacySettings>(PRIVACY_KEY, DEFAULT_PRIVACY)
  );
  const [monthlyUsage, setMonthlyUsage] = useState<UsageCounters>(() => ({
    monthKey: getCurrentMonthKey(),
    roomAnalyses: 0,
    aiRedesigns: 0,
    aiCoachMessages: 0,
    shoppingQueries: 0,
    layoutSuggestions: 0,
    updatedAt: Date.now(),
  }));
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  const [budgetExpenses, setBudgetExpenses] = useState<BudgetExpense[]>(() =>
    readJsonStorage<BudgetExpense[]>(BUDGET_EXPENSES_KEY, [])
  );
  const [roomLayouts, setRoomLayouts] = useState<RoomLayoutPlan[]>(() =>
    readJsonStorage<RoomLayoutPlan[]>(ROOM_LAYOUTS_KEY, [])
  );
  const [userFeedbacks, setUserFeedbacks] = useState<FeedbackItem[]>([]);
  const [userReports, setUserReports] = useState<UserReportItem[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfigSettings>(DEFAULT_SYSTEM_CONFIG);

  const mobileQuickUploadRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hydratingFromCloudRef = useRef<boolean>(false);

  const t = getUILabels(language);
  const isBn = language === 'bn';

  const isAdminUser = Boolean(
    user &&
      user.emailVerified &&
      (user.email?.toLowerCase() === ADMIN_OPERATOR_EMAIL || userRole === 'admin')
  );
  const effectiveSubscription =
    serverSubscription && (serverSubscription.pendingFirestoreSync || !subscriptionRecord)
      ? serverSubscription
      : subscriptionRecord || serverSubscription;
  const effectivePlanTier: PlanTier =
    serverSubscription && serverSubscription.pendingFirestoreSync
      ? serverSubscription.status === 'canceled'
        ? 'free'
        : serverSubscription.tier
      : planTier;
  const mergedBillingInvoices = useMemo(() => {
    const byId = new Map<string, BillingInvoice>();
    for (const inv of billingInvoices) byId.set(inv.id, inv);
    for (const inv of serverBillingInvoices) {
      if (!byId.has(inv.id)) byId.set(inv.id, inv);
    }
    return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [billingInvoices, serverBillingInvoices]);

  const effectivePlanSpec = PLAN_SPECS[effectivePlanTier];
  const canExportPdf = isAdminUser || effectivePlanSpec.pdfReports;
  const maxSavedRooms = isAdminUser ? 500 : effectivePlanSpec.maxSavedRooms;
  const maxRoomLayouts = isAdminUser ? 200 : effectivePlanSpec.maxRoomLayouts;

  const commitSectionNavigation = (target: WorkspaceSection) => {
    setActiveSection(target);
    setInvalidRoute('');
    setIsChildDirty(false);
    setIsMobileMoreOpen(false);
    if (target !== 'not_found') {
      const targetHash = `#/${target}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSection = (target: WorkspaceSection) => {
    if (isChildDirty && target !== activeSection) {
      setPendingNavigationSection(target);
      return;
    }
    commitSectionNavigation(target);
  };

  // Apply Dark Mode class cleanly on document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  // Persist workspace states locally
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(storageInventory));
    } catch {
      // ignore
    }
  }, [storageInventory, user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(CALENDAR_TASKS_KEY, JSON.stringify(calendarTasks));
    } catch {
      // ignore
    }
  }, [calendarTasks, user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(savedDesigns));
    } catch {
      // ignore
    }
  }, [savedDesigns, user]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaningHistory.slice(0, 80)));
    } catch {
      // ignore
    }
  }, [cleaningHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(POINTS_KEY, String(points));
    } catch {
      // ignore
    }
  }, [points]);

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, String(streakDays));
    } catch {
      // ignore
    }
  }, [streakDays]);

  useEffect(() => {
    try {
      localStorage.setItem(REMINDER_KEY, JSON.stringify(reminderConfig));
    } catch {
      // ignore
    }
  }, [reminderConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(FAMILY_KEY, JSON.stringify(familyMembers));
    } catch {
      // ignore
    }
  }, [familyMembers]);

  useEffect(() => {
    try {
      localStorage.setItem(FAMILY_LOGS_KEY, JSON.stringify(familyLogs.slice(0, 40)));
    } catch {
      // ignore
    }
  }, [familyLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacySettings));
    } catch {
      // ignore
    }
  }, [privacySettings]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(BUDGET_EXPENSES_KEY, JSON.stringify(budgetExpenses));
    } catch {
      // ignore
    }
  }, [budgetExpenses, user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(ROOM_LAYOUTS_KEY, JSON.stringify(roomLayouts));
    } catch {
      // ignore
    }
  }, [roomLayouts, user]);

  // Warn user on browser close/refresh when editing unsaved layout/budget/goal or scanning
  useEffect(() => {
    if (!isChildDirty && !isAnalyzing) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isChildDirty, isAnalyzing]);

  // Hash-based section routing & graceful 404 fallback + checkout status detection
  useEffect(() => {
    const syncFromHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      const [routePart, queryPart] = rawHash.split('?');
      const cleanRoute = (routePart || '').trim().toLowerCase();

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const checkoutState = params.get('checkout');
        const sessionIdParam = params.get('session_id');
        if (sessionIdParam) {
          setPendingCheckoutSessionId(sessionIdParam);
        }
        if (checkoutState === 'success') {
          setStatusBanner(
            isBn
              ? 'পেমেন্ট সম্পন্ন হয়েছে! Stripe ওয়েবহুকের সাথে সাবস্ক্রিপশন সিঙ্ক করা হচ্ছে।'
              : 'Checkout completed! Syncing your verified Stripe subscription status.'
          );
        } else if (checkoutState === 'canceled') {
          setStatusBanner(
            isBn ? 'চেকআউট বাতিল করা হয়েছে।' : 'Checkout canceled. Your existing plan remains unchanged.'
          );
        }
      }

      if (!cleanRoute) {
        setActiveSection('dashboard');
        setInvalidRoute('');
        return;
      }

      if ((VALID_HASH_SECTIONS as readonly string[]).includes(cleanRoute)) {
        if (cleanRoute === 'admin' && authReady && !isAdminUser) {
          setInvalidRoute(`#/${cleanRoute}`);
          setActiveSection('not_found');
          return;
        }
        setInvalidRoute('');
        setActiveSection(cleanRoute as WorkspaceSection);
      } else {
        setInvalidRoute(`#/${cleanRoute}`);
        setActiveSection('not_found');
      }
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [authReady, isAdminUser, isBn]);

  // Fetch server-verified Stripe webhook subscription state (and verify Checkout session_id if present)
  useEffect(() => {
    if (!user) {
      setServerSubscription(undefined);
      setServerBillingInvoices([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        if (pendingCheckoutSessionId) {
          const verifyResp = await fetch('/api/stripe/verify-checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ sessionId: pendingCheckoutSessionId }),
          });
          if (verifyResp.ok && active) {
            const vData = await verifyResp.json();
            if (vData?.subscription) setServerSubscription(vData.subscription);
            if (Array.isArray(vData?.invoices)) setServerBillingInvoices(vData.invoices);
            setPendingCheckoutSessionId(null);
          }
        }
        const resp = await fetch('/api/stripe/subscription', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!resp.ok || !active) return;
        const data = await resp.json();
        const sub = data?.subscription;
        const invs: BillingInvoice[] = Array.isArray(data?.invoices) ? data.invoices : [];
        if (active) {
          setServerSubscription(sub || undefined);
          setServerBillingInvoices(invs);
        }
        if (sub && sub.pendingFirestoreSync && isAdminUser && active) {
          await updateUserGovernanceAdmin(user, user.uid, {
            planTier: sub.status === 'canceled' ? 'free' : sub.tier,
            subscription: { ...sub, syncStatus: 'synced' },
          });
          for (const inv of invs.slice(0, 5)) {
            await recordBillingInvoiceAdmin(user, user.uid, inv);
          }
          await fetch('/api/admin/stripe-mark-synced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ userKey: user.uid, eventId: sub.lastEventId }),
          });
          if (active) {
            setServerSubscription((prev) =>
              prev ? { ...prev, pendingFirestoreSync: false, syncStatus: 'synced' } : prev
            );
          }
        }
      } catch {
        // Silent fallback to Firestore profile
      }
    })();
    return () => {
      active = false;
    };
  }, [user, pendingCheckoutSessionId, isAdminUser]);

  // Global system configuration listener (Feature flags, maintenance mode, announcement banner)
  useEffect(() => {
    const unsubConfig = subscribeToSystemConfig((cfg) => setSystemConfig(cfg));
    return () => unsubConfig();
  }, []);

  // Global keyboard shortcuts (Escape & '/' to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileChatOpen(false);
        setIsToolsOpen(false);
        setIsNotifOpen(false);
        setIsMobileMoreOpen(false);
        setIsTutorialOpen(false);
        setIsSearchFocused(false);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track Firebase Auth state & migrate local guest items to Firestore on sign-in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        if (!firebaseUser.emailVerified) {
          // firestore.rules enforces email_verified == true; wait for verification before cloud sync
          return;
        }
        try {
          await ensureUserProfile(firebaseUser);

          const localRooms = readJsonStorage<RoomAnalysis[]>(LOCAL_STORAGE_KEY, []);
          if (localRooms.length > 0) {
            for (const localRoom of localRooms) {
              const thumb = await createThumbnailDataUrl(localRoom.imageUrl);
              await saveRoomToFirestore(firebaseUser.uid, { ...localRoom, imageUrl: thumb });
            }
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }

          const localInv = readJsonStorage<StorageInventoryItem[]>(INVENTORY_KEY, []);
          if (localInv.length > 0) {
            for (const item of localInv) {
              await saveInventoryItemToFirestore(firebaseUser.uid, item);
            }
            localStorage.removeItem(INVENTORY_KEY);
          }

          const localCal = readJsonStorage<CalendarTask[]>(CALENDAR_TASKS_KEY, []);
          if (localCal.length > 0) {
            for (const task of localCal) {
              await saveCalendarTaskToFirestore(firebaseUser.uid, task);
            }
            localStorage.removeItem(CALENDAR_TASKS_KEY);
          }

          const localDesigns = readJsonStorage<SavedRedesign[]>(SAVED_DESIGNS_KEY, []);
          if (localDesigns.length > 0) {
            for (const design of localDesigns) {
              const bThumb = await createThumbnailDataUrl(design.beforeImageUrl);
              const aThumb = await createThumbnailDataUrl(design.afterImageUrl);
              await saveDesignToFirestore(firebaseUser.uid, {
                ...design,
                beforeImageUrl: bThumb,
                afterImageUrl: aThumb,
              });
            }
            localStorage.removeItem(SAVED_DESIGNS_KEY);
          }

          const localBudgets = readJsonStorage<BudgetExpense[]>(BUDGET_EXPENSES_KEY, []);
          if (localBudgets.length > 0) {
            for (const exp of localBudgets) {
              await saveBudgetExpenseToFirestore(firebaseUser.uid, exp);
            }
            localStorage.removeItem(BUDGET_EXPENSES_KEY);
          }

          const localLayouts = readJsonStorage<RoomLayoutPlan[]>(ROOM_LAYOUTS_KEY, []);
          if (localLayouts.length > 0) {
            for (const lay of localLayouts) {
              await saveRoomLayoutToFirestore(firebaseUser.uid, lay);
            }
            localStorage.removeItem(ROOM_LAYOUTS_KEY);
          }
        } catch (err: any) {
          console.error('Failed to initialize user profile/sync:', err);
          setErrorBanner('Could not sync your profile to the cloud database. Please try signing in again.');
        }
      } else {
        setUserRole('user');
        setUserStatus('active');
        setPlanTier('free');
        setSubscriptionRecord(undefined);
        setBillingInvoices([]);
        setUserFeedbacks([]);
        setUserReports([]);
        setSavedRooms(readJsonStorage<RoomAnalysis[]>(LOCAL_STORAGE_KEY, []));
        setStorageInventory(readJsonStorage<StorageInventoryItem[]>(INVENTORY_KEY, []));
        setCalendarTasks(readJsonStorage<CalendarTask[]>(CALENDAR_TASKS_KEY, []));
        setSavedDesigns(readJsonStorage<SavedRedesign[]>(SAVED_DESIGNS_KEY, []));
        setBudgetExpenses(readJsonStorage<BudgetExpense[]>(BUDGET_EXPENSES_KEY, []));
        setRoomLayouts(readJsonStorage<RoomLayoutPlan[]>(ROOM_LAYOUTS_KEY, []));
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore collections & user profile when authenticated and email-verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const unsubRooms = subscribeToUserRooms(
      user.uid,
      (rooms) => setSavedRooms(rooms),
      (err) => {
        console.error('Firestore rooms subscription error:', err);
        setErrorBanner('Unable to load your saved rooms from the database right now.');
      }
    );

    const unsubInventory = subscribeToInventory(
      user.uid,
      (items) => setStorageInventory(items),
      (err) => console.error('Inventory subscription error:', err)
    );

    const unsubCalendar = subscribeToCalendarTasks(
      user.uid,
      (tasks) => setCalendarTasks(tasks),
      (err) => console.error('Calendar tasks subscription error:', err)
    );

    const unsubDesigns = subscribeToSavedDesigns(
      user.uid,
      (designs) => setSavedDesigns(designs),
      (err) => console.error('Saved designs subscription error:', err)
    );

    const unsubBudget = subscribeToBudgetExpenses(
      user.uid,
      (items) => setBudgetExpenses(items),
      (err) => console.error('Budget subscription error:', err)
    );

    const unsubLayouts = subscribeToRoomLayouts(
      user.uid,
      (layouts) => setRoomLayouts(layouts),
      (err) => console.error('Room layouts subscription error:', err)
    );

    const unsubUsage = subscribeToMonthlyUsage(user.uid, (u) => setMonthlyUsage(u));
    const unsubBilling = subscribeToBillingHistory(user.uid, (inv) => setBillingInvoices(inv));
    const unsubFb = subscribeToUserFeedback(user.uid, (items) => setUserFeedbacks(items));
    const unsubRep = subscribeToUserReports(user.uid, (items) => setUserReports(items));

    const unsubProfile = subscribeToUserProfile(
      user.uid,
      (profile) => {
        hydratingFromCloudRef.current = true;
        if (profile.role) setUserRole(profile.role);
        if (profile.status) setUserStatus(profile.status);
        if (profile.planTier) setPlanTier(profile.planTier);
        setSubscriptionRecord(profile.subscription);
        if (profile.privacy) setPrivacySettings(profile.privacy);
        if (profile.language) setLanguage(profile.language);
        if (profile.preferences) setPreferences(profile.preferences);
        if (profile.stats) {
          if (typeof profile.stats.points === 'number') setPoints(profile.stats.points);
          if (typeof profile.stats.streakDays === 'number') setStreakDays(profile.stats.streakDays);
          if (typeof profile.stats.focusMinutesTotal === 'number') {
            setFocusMinutesTotal(profile.stats.focusMinutesTotal);
          }
        }
        if (profile.reminderConfig) setReminderConfig(profile.reminderConfig);
        if (profile.familyMembers && profile.familyMembers.length > 0) {
          setFamilyMembers(profile.familyMembers);
        }
        if (profile.familyLogs) setFamilyLogs(profile.familyLogs);
        if (profile.cleaningHistory) setCleaningHistory(profile.cleaningHistory);
        if (profile.notifications && profile.notifications.length > 0) {
          setNotifications(profile.notifications);
        }
        window.setTimeout(() => {
          hydratingFromCloudRef.current = false;
        }, 250);
      },
      (err) => console.error('Profile subscription error:', err)
    );

    return () => {
      unsubRooms();
      unsubInventory();
      unsubCalendar();
      unsubDesigns();
      unsubBudget();
      unsubLayouts();
      unsubUsage();
      unsubBilling();
      unsubFb();
      unsubRep();
      unsubProfile();
    };
  }, [authReady, user]);

  // Debounced cloud sync for workspace profile/preferences/privacy/stats/history/family/notifications
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || hydratingFromCloudRef.current) return;
    const timer = window.setTimeout(() => {
      saveUserWorkspaceToFirestore(user.uid, {
        language,
        privacy: privacySettings,
        preferences,
        stats: { points, streakDays, focusMinutesTotal },
        reminderConfig,
        familyMembers,
        familyLogs,
        cleaningHistory,
        notifications,
      }).catch((err) => console.error('Workspace cloud sync failed:', err));
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    authReady,
    user,
    language,
    privacySettings,
    preferences,
    points,
    streakDays,
    focusMinutesTotal,
    reminderConfig,
    familyMembers,
    familyLogs,
    cleaningHistory,
    notifications,
  ]);

  // Persist local rooms only when signed out
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedRooms));
    } catch (e) {
      console.error('Failed to save rooms to localStorage:', e);
    }
  }, [savedRooms, user]);

  const pushNotification = (
    category: NotificationCategory,
    title: string,
    body: string,
    targetSection?: WorkspaceSection
  ) => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      targetSection,
    };
    setNotifications((prev) => [newNotif, ...prev].slice(0, 30));
  };

  const awardActivityPoints = (
    action: string,
    pts: number,
    minutes = 0,
    roomOverride?: RoomAnalysis
  ) => {
    setPoints((prev) => {
      const next = prev + pts;
      const unlocked = BADGE_THRESHOLDS.find((th) => prev < th && next >= th);
      if (unlocked) {
        pushNotification(
          'achievement',
          isBn ? `নতুন ব্যাজ আনলক (${unlocked} পয়েন্ট)` : `Achievement Unlocked (${unlocked} pts)`,
          isBn
            ? `অভিনন্দন! আপনি ${unlocked} পয়েন্ট অর্জন করে নতুন অর্গানাইজার ব্যাজ পেয়েছেন।`
            : `Milestone reached! You crossed ${unlocked} points in your Stats & Rewards hub.`,
          'stats'
        );
      }
      return next;
    });

    const entry: CleaningHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      roomName: roomOverride?.roomName || analysisResult?.roomName || 'Home Space',
      roomType: roomOverride?.roomType || analysisResult?.roomType || roomType,
      action,
      pointsEarned: pts,
      minutes,
      timestamp: Date.now(),
    };
    setCleaningHistory((prev) => [entry, ...prev].slice(0, 80));
  };

  const handleUpdatePreferences = (next: UserPreferences) => {
    setPreferences(next);
    setFocusGoal(next.preferredGoal);
    setDailyMinutes(next.dailyBudgetMinutes);
  };

  const toggleTheme = () => {
    setPreferences((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleSignIn = () => {
    setErrorBanner(null);
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    setErrorBanner(null);
    try {
      await signOutUser();
      setStatusBanner('Signed out. Switched back to local browser storage.');
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      setErrorBanner('Failed to sign out: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleImageSelect = (dataUrl: string) => {
    setErrorBanner(null);
    setSelectedImage(dataUrl);
  };

  const handleSelectSample = (sample: SampleRoom) => {
    setErrorBanner(null);
    setSelectedImage(sample.imageUrl);
    setRoomType(sample.roomType);
    setFocusGoal(sample.focusGoal);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setErrorBanner(null);
  };

  const handleNewScan = () => {
    navigateToSection('dashboard');
    setSelectedImage(null);
    setAnalysisResult(null);
    setErrorBanner(null);
  };

  const handleMobileFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorBanner(
        isBn ? 'অনুগ্রহ করে সঠিক ছবির ফাইল আপলোড করুন।' : 'Please upload a valid image file.'
      );
      e.target.value = '';
      return;
    }
    if (file.size > systemConfig.maxUploadMb * 1024 * 1024) {
      setErrorBanner(
        isBn
          ? `ছবির আকার সর্বোচ্চ ${systemConfig.maxUploadMb}MB হতে পারবে।`
          : `Image exceeds the ${systemConfig.maxUploadMb}MB upload limit.`
      );
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setSelectedImage(ev.target.result as string);
        navigateToSection('dashboard');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const postJsonWithWarmupRetry = async (url: string, body: unknown) => {
    const send = async () => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      return { resp, text };
    };

    let result = await send();
    if (result.text.trim().startsWith('<')) {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      result = await send();
    }
    return result;
  };

  // Trigger Gemini API room analysis (with feature-flag and monthly plan quota check)
  const handleAnalyzeRoom = async () => {
    if (!selectedImage) return;

    if (!systemConfig.aiAnalysisEnabled && !isAdminUser) {
      setErrorBanner(
        isBn
          ? 'AI রুম বিশ্লেষণ সাময়িকভাবে বন্ধ রয়েছে। অনুগ্রহ করে পরে চেষ্টা করুন।'
          : 'AI Room Analysis is temporarily paused by workspace administrators.'
      );
      return;
    }

    if (!isAdminUser && monthlyUsage.roomAnalyses >= effectivePlanSpec.monthlyRoomAnalyses) {
      setErrorBanner(
        isBn
          ? `আপনার এই মাসের ${effectivePlanSpec.monthlyRoomAnalyses}টি ফ্রি/প্ল্যান রুম স্ক্যান কোটা শেষ হয়েছে। আরও স্ক্যানের জন্য Plans & Billing দেখুন।`
          : `Monthly quota reached (${monthlyUsage.roomAnalyses}/${effectivePlanSpec.monthlyRoomAnalyses} scans on ${effectivePlanSpec.name}). Upgrade in Plans & Billing for higher limits.`
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setErrorBanner(null);

    try {
      const preparedImage = await prepareImageForAnalysis(selectedImage);

      const { resp: response, text: rawText } = await postJsonWithWarmupRetry('/api/analyze-room', {
        imageBase64: preparedImage,
        mimeType: 'image/jpeg',
        roomType,
        focusGoal,
        language,
        customContext,
        dailyMinutes,
      });

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        const isHtml = rawText.trim().startsWith('<');
        setErrorBanner(
          isHtml
            ? 'Server is still starting up. Please wait 5 seconds and try again.'
            : 'Unexpected response from server. Please try again.'
        );
        return;
      }

      if (response.ok && data.success && data.analysis) {
        setAnalysisResult(data.analysis);
        if (user) {
          incrementMonthlyUsageInFirestore(user.uid, 'roomAnalyses');
        } else {
          setMonthlyUsage((prev) => ({
            ...prev,
            roomAnalyses: prev.roomAnalyses + 1,
            updatedAt: Date.now(),
          }));
        }
        awardActivityPoints(
          isBn ? `রুম বিশ্লেষণ: ${data.analysis.roomName}` : `Analyzed ${data.analysis.roomName}`,
          20,
          0,
          data.analysis
        );
        pushNotification(
          'analysis',
          isBn ? `রুম বিশ্লেষণ সম্পন্ন: ${data.analysis.roomName}` : `Room Analyzed: ${data.analysis.roomName}`,
          isBn
            ? `ক্লাটার স্কোর ${data.analysis.clutterScore}/100 এবং ${data.analysis.actionPlan.length}টি ধাপ তৈরি হয়েছে।`
            : `Clutter Score ${data.analysis.clutterScore}/100 with ${data.analysis.actionPlan.length} prioritized steps.`,
          'dashboard'
        );
        setTimeout(() => {
          document.getElementById('analysis-results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setErrorBanner(data.details || data.error || 'Failed to analyze room photo. Please try again.');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorBanner(err?.message || 'Error contacting analysis server. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Upload an After-Decluttering photo to compare progress
  const handleCompareAfterPhoto = async (afterDataUrl: string) => {
    if (!analysisResult) return;

    setIsComparingAfter(true);
    setErrorBanner(null);

    try {
      const preparedAfter = await prepareImageForAnalysis(afterDataUrl);
      const afterThumb = await createThumbnailDataUrl(preparedAfter);

      const { resp: response, text: rawText } = await postJsonWithWarmupRetry('/api/compare-after', {
        afterImageBase64: preparedAfter,
        mimeType: 'image/jpeg',
        roomType: analysisResult.roomType,
        beforeScore: analysisResult.clutterScore,
        beforeRoomName: analysisResult.roomName,
        language,
      });

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        setErrorBanner('Server is warming up or busy. Please try uploading the After photo again.');
        return;
      }

      if (response.ok && data.success) {
        const updatedAnalysis: RoomAnalysis = {
          ...analysisResult,
          afterImageUrl: afterThumb,
          afterClutterScore: data.afterClutterScore,
          afterSummary: data.afterSummary,
        };
        setAnalysisResult(updatedAnalysis);

        const isSaved = savedRooms.some((r) => r.id === updatedAnalysis.id);
        if (user && isSaved) {
          await updateRoomAfterComparisonInFirestore(
            user.uid,
            updatedAnalysis.id,
            updatedAnalysis.actionPlan,
            afterThumb,
            data.afterClutterScore,
            data.afterSummary
          );
        } else if (isSaved) {
          setSavedRooms((prev) => prev.map((r) => (r.id === updatedAnalysis.id ? updatedAnalysis : r)));
        }

        awardActivityPoints(
          isBn ? 'আগে ও পরের তুলনা সম্পন্ন' : 'Logged Before & After Comparison',
          30,
          0,
          updatedAnalysis
        );
        setStatusBanner(
          isBn
            ? 'পরের ছবির স্কোর সম্পন্ন! আগে ও পরের তুলনা দেখুন।'
            : 'After photo scored! View your Before & After progress below.'
        );
        setTimeout(() => setStatusBanner(null), 4000);
      } else {
        setErrorBanner(data.details || data.error || 'Failed to evaluate after photo.');
      }
    } catch (err: any) {
      console.error('Compare after error:', err);
      setErrorBanner(err?.message || 'Error comparing after photo.');
    } finally {
      setIsComparingAfter(false);
    }
  };

  const syncProgressUpdate = async (
    updatedAnalysis: RoomAnalysis,
    updates: Parameters<typeof updateRoomProgressInFirestore>[2]
  ) => {
    setAnalysisResult(updatedAnalysis);
    const isSaved = savedRooms.some((r) => r.id === updatedAnalysis.id);
    if (user && isSaved) {
      try {
        await updateRoomProgressInFirestore(user.uid, updatedAnalysis.id, updates);
      } catch (err) {
        console.error('Failed to sync update:', err);
        setErrorBanner('Could not sync changes to the database.');
      }
    } else if (isSaved) {
      setSavedRooms((prev) => prev.map((r) => (r.id === updatedAnalysis.id ? updatedAnalysis : r)));
    }
  };

  const handleToggleStep = async (stepNumber: number) => {
    if (!analysisResult) return;
    const target = analysisResult.actionPlan.find((s) => s.stepNumber === stepNumber);
    const updatedSteps = analysisResult.actionPlan.map((step) =>
      step.stepNumber === stepNumber ? { ...step, completed: !step.completed } : step
    );
    if (target && !target.completed) {
      awardActivityPoints(target.title, 10, 10, analysisResult);
    }
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleAddCustomStep = async (
    title: string,
    category: ActionStep['category'],
    timeEstimate: string,
    priority: TaskPriority = 'medium'
  ) => {
    if (!analysisResult || analysisResult.actionPlan.length >= 25) return;
    const nextStepNumber =
      analysisResult.actionPlan.reduce((max, s) => Math.max(max, s.stepNumber), 0) + 1;
    const newStep: ActionStep = {
      stepNumber: nextStepNumber,
      title,
      category,
      priority,
      timeEstimate,
      instructions: '',
      completed: false,
    };
    const updatedSteps = [...analysisResult.actionPlan, newStep];
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleEditStep = async (stepNumber: number, updates: Partial<ActionStep>) => {
    if (!analysisResult) return;
    const updatedSteps = analysisResult.actionPlan.map((step) =>
      step.stepNumber === stepNumber ? { ...step, ...updates } : step
    );
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleUpdateTriageItem = async (
    id: string,
    updates: { decision?: TriageDecision; sorted?: boolean }
  ) => {
    if (!analysisResult?.triageItems) return;
    const target = analysisResult.triageItems.find((i) => i.id === id);
    const updatedTriage = analysisResult.triageItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    if (target && updates.sorted && !target.sorted) {
      awardActivityPoints(`Sorted: ${target.item}`, 5, 2, analysisResult);
    }
    await syncProgressUpdate({ ...analysisResult, triageItems: updatedTriage }, { triageItems: updatedTriage });
  };

  const handleToggleStorageItem = async (index: number) => {
    if (!analysisResult) return;
    const updatedStorage = analysisResult.storageRecommendations.map((item, idx) =>
      idx === index ? { ...item, acquired: !item.acquired } : item
    );
    await syncProgressUpdate(
      { ...analysisResult, storageRecommendations: updatedStorage },
      { storageRecommendations: updatedStorage }
    );
  };

  const handleSaveNotes = async (notes: string) => {
    if (!analysisResult) return;
    await syncProgressUpdate({ ...analysisResult, userNotes: notes }, { userNotes: notes });
  };

  const handleToggleAllSteps = async (completed: boolean) => {
    if (!analysisResult) return;
    const updatedSteps = analysisResult.actionPlan.map((step) => ({ ...step, completed }));
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleDeleteStep = async (stepNumber: number) => {
    if (!analysisResult) return;
    const updatedSteps = analysisResult.actionPlan
      .filter((step) => step.stepNumber !== stepNumber)
      .map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleMoveStep = async (stepNumber: number, direction: 'up' | 'down') => {
    if (!analysisResult) return;
    const idx = analysisResult.actionPlan.findIndex((s) => s.stepNumber === stepNumber);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= analysisResult.actionPlan.length) return;
    const copy = [...analysisResult.actionPlan];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    const renumbered = copy.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    await syncProgressUpdate({ ...analysisResult, actionPlan: renumbered }, { actionPlan: renumbered });
  };

  const handleAddTriageItem = async (item: string, decision: TriageDecision, reason: string) => {
    if (!analysisResult) return;
    const existing = analysisResult.triageItems || [];
    if (existing.length >= 30) return;
    const newEntry: TriageItem = {
      id: `triage_${Date.now()}`,
      item,
      decision,
      reason,
      sorted: false,
    };
    const updatedTriage = [...existing, newEntry];
    await syncProgressUpdate({ ...analysisResult, triageItems: updatedTriage }, { triageItems: updatedTriage });
  };

  const handleUpdateFloorplan = async (zones: FloorplanZone[]) => {
    if (!analysisResult) return;
    await syncProgressUpdate({ ...analysisResult, floorplanZones: zones }, { floorplanZones: zones });
  };

  const handleUpdateWeeklySchedule = async (schedule: WeeklyScheduleDay[]) => {
    if (!analysisResult) return;
    await syncProgressUpdate({ ...analysisResult, weeklySchedule: schedule }, { weeklySchedule: schedule });
  };

  const handleAppendStepsToPlan = async (steps: SeasonalChecklistItem[]) => {
    if (!analysisResult || steps.length === 0) return;
    const remainingCapacity = Math.max(0, 25 - analysisResult.actionPlan.length);
    if (remainingCapacity === 0) return;
    let nextNum = analysisResult.actionPlan.reduce((max, s) => Math.max(max, s.stepNumber), 0);
    const additions: ActionStep[] = steps.slice(0, remainingCapacity).map((st) => {
      nextNum += 1;
      return {
        stepNumber: nextNum,
        title: st.title,
        category: st.category,
        priority: 'medium',
        timeEstimate: st.timeEstimate,
        instructions: st.tip || '',
        completed: Boolean(st.completed),
      };
    });
    const updatedSteps = [...analysisResult.actionPlan, ...additions];
    await syncProgressUpdate({ ...analysisResult, actionPlan: updatedSteps }, { actionPlan: updatedSteps });
  };

  const handleAttachRedesignToRoom = async (
    imageUrl: string,
    style: RedesignStyle,
    summary: string
  ) => {
    if (!analysisResult) return;
    const compactPreview = await createThumbnailDataUrl(imageUrl);
    await syncProgressUpdate(
      {
        ...analysisResult,
        redesignPreviewUrl: compactPreview,
        redesignStyle: style,
        redesignSummary: summary,
      },
      {
        redesignPreviewUrl: compactPreview,
        redesignStyle: style,
        redesignSummary: summary,
      }
    );
  };

  // Saved AI Redesigns & Standalone Before/After Pairs CRUD
  const handleSaveDesign = async (designInput: Omit<SavedRedesign, 'id' | 'createdAt'>) => {
    const newDesign: SavedRedesign = {
      ...designInput,
      id: `design_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      beforeImageUrl: await createThumbnailDataUrl(designInput.beforeImageUrl),
      afterImageUrl: await createThumbnailDataUrl(designInput.afterImageUrl),
      createdAt: Date.now(),
    };

    if (user) {
      await ensureUserProfile(user);
      await saveDesignToFirestore(user.uid, newDesign);
    } else {
      setSavedDesigns((prev) => [newDesign, ...prev]);
    }
    awardActivityPoints(`Saved design: ${newDesign.roomName}`, 15);
    setStatusBanner(isBn ? 'ডিজাইনটি গ্যালারিতে সংরক্ষিত হয়েছে!' : 'Design saved to your Gallery!');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleDeleteDesign = async (designId: string) => {
    if (user) {
      await deleteDesignFromFirestore(user.uid, designId);
    } else {
      setSavedDesigns((prev) => prev.filter((d) => d.id !== designId));
    }
  };

  // Storage Inventory CRUD
  const handleAddInventoryItem = async (item: Omit<StorageInventoryItem, 'id' | 'updatedAt'>) => {
    const fullItem: StorageInventoryItem = {
      ...item,
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      updatedAt: Date.now(),
    };
    if (user) {
      await ensureUserProfile(user);
      await saveInventoryItemToFirestore(user.uid, fullItem);
    } else {
      setStorageInventory((prev) => [fullItem, ...prev]);
    }
  };

  const handleUpdateInventoryQty = async (id: string, delta: number) => {
    const target = storageInventory.find((it) => it.id === id);
    if (!target) return;
    const updated: StorageInventoryItem = {
      ...target,
      quantity: Math.max(1, target.quantity + delta),
      updatedAt: Date.now(),
    };
    if (user) {
      await saveInventoryItemToFirestore(user.uid, updated);
    } else {
      setStorageInventory((prev) => prev.map((it) => (it.id === id ? updated : it)));
    }
  };

  const handleUpdateInventoryItem = async (updated: StorageInventoryItem) => {
    const stamped = { ...updated, updatedAt: Date.now() };
    if (user) {
      await saveInventoryItemToFirestore(user.uid, stamped);
    } else {
      setStorageInventory((prev) => prev.map((it) => (it.id === stamped.id ? stamped : it)));
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (user) {
      await deleteInventoryItemFromFirestore(user.uid, id);
    } else {
      setStorageInventory((prev) => prev.filter((it) => it.id !== id));
    }
  };

  // Calendar Tasks CRUD
  const handleAddCalendarTask = async (taskInput: Omit<CalendarTask, 'id'>) => {
    const fullTask: CalendarTask = {
      ...taskInput,
      id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    if (user) {
      await ensureUserProfile(user);
      await saveCalendarTaskToFirestore(user.uid, fullTask);
    } else {
      setCalendarTasks((prev) => [fullTask, ...prev]);
    }
    pushNotification(
      'deadline',
      isBn ? 'নতুন টাস্ক শিডিউল হয়েছে' : 'Task Scheduled',
      `${fullTask.title} · ${fullTask.dateIso}${fullTask.deadlineTime ? ` @ ${fullTask.deadlineTime}` : ''}`,
      'calendar'
    );
  };

  const handleToggleCalendarTask = async (id: string) => {
    const target = calendarTasks.find((tk) => tk.id === id);
    if (!target) return;
    const updated = { ...target, completed: !target.completed };
    if (user) {
      await saveCalendarTaskToFirestore(user.uid, updated);
    } else {
      setCalendarTasks((prev) => prev.map((tk) => (tk.id === id ? updated : tk)));
    }
    if (!target.completed) {
      awardActivityPoints(target.title, 10, target.minutes);
    }
  };

  const handleUpdateCalendarTask = async (updated: CalendarTask) => {
    if (user) {
      await saveCalendarTaskToFirestore(user.uid, updated);
    } else {
      setCalendarTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
    }
  };

  const handleDeleteCalendarTask = async (id: string) => {
    if (user) {
      await deleteCalendarTaskFromFirestore(user.uid, id);
    } else {
      setCalendarTasks((prev) => prev.filter((tk) => tk.id !== id));
    }
  };

  const handleAssignRoomToMember = async (roomId: string, memberId: string) => {
    const assignedMember = familyMembers.find((m) => m.id === memberId);
    const targetRoom =
      analysisResult && analysisResult.id === roomId
        ? analysisResult
        : savedRooms.find((r) => r.id === roomId);

    if (analysisResult && analysisResult.id === roomId) {
      await syncProgressUpdate(
        { ...analysisResult, assignedMemberId: memberId },
        { assignedMemberId: memberId }
      );
    } else if (targetRoom) {
      const updated = { ...targetRoom, assignedMemberId: memberId };
      if (user) {
        try {
          await updateRoomProgressInFirestore(user.uid, roomId, { assignedMemberId: memberId });
        } catch (err) {
          console.error(err);
        }
      } else {
        setSavedRooms((prev) => prev.map((r) => (r.id === roomId ? updated : r)));
      }
    }

    if (assignedMember && targetRoom) {
      setFamilyMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, points: m.points + 10 } : m))
      );
      setFamilyLogs((prev) => [
        {
          id: `flog_${Date.now()}`,
          memberName: assignedMember.name,
          action: isBn ? 'রুমের দায়িত্ব গ্রহণ করেছেন' : 'Assigned room responsibility',
          roomName: targetRoom.roomName,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 40));
      pushNotification(
        'family',
        isBn ? 'ফ্যামিলি অ্যাসাইনমেন্ট' : 'Household Assignment',
        `${assignedMember.name} assigned to ${targetRoom.roomName}`,
        'family'
      );
    }
  };

  const handleLogFocusMinutes = (minutes: number) => {
    setFocusMinutesTotal((prev) => {
      const next = prev + minutes;
      try {
        localStorage.setItem(FOCUS_MINUTES_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
    setStreakDays((s) => Math.max(1, s));
    awardActivityPoints(
      isBn ? `${minutes} মিনিট ফোকাস স্প্রিন্ট` : `Completed ${minutes}m Focus Sprint`,
      20,
      minutes
    );
    setStatusBanner(`Focus sprint complete! Logged +${minutes} minutes.`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleOpenToolsTab = (tab: OrganizationToolTab) => {
    setToolsTab(tab);
    setIsToolsOpen(true);
  };

  const handleImportRooms = async (imported: RoomAnalysis[]) => {
    const valid = imported.filter((r) => r && r.id && r.roomName && Array.isArray(r.actionPlan));
    if (valid.length === 0) return;
    if (user) {
      await ensureUserProfile(user);
      for (const room of valid) {
        const thumb = await createThumbnailDataUrl(room.imageUrl);
        await saveRoomToFirestore(user.uid, { ...room, imageUrl: thumb });
      }
    } else {
      setSavedRooms((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const additions = valid.filter((v) => !existingIds.has(v.id));
        return [...additions, ...prev];
      });
    }
  };

  const handleExportAllData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      rooms: savedRooms,
      inventory: storageInventory,
      calendarTasks,
      savedDesigns,
      budgetExpenses,
      roomLayouts,
      cleaningHistory,
      preferences,
      privacySettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neatspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Budget Expense CRUD (Phase 9)
  const handleAddBudgetExpense = async (item: Omit<BudgetExpense, 'id' | 'createdAt'>) => {
    const fullItem: BudgetExpense = {
      ...item,
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      createdAt: Date.now(),
    };
    if (user) {
      await ensureUserProfile(user);
      await saveBudgetExpenseToFirestore(user.uid, fullItem);
    } else {
      setBudgetExpenses((prev) => [fullItem, ...prev]);
    }
  };

  const handleToggleBudgetPurchased = async (id: string) => {
    const target = budgetExpenses.find((b) => b.id === id);
    if (!target) return;
    const updated: BudgetExpense = {
      ...target,
      purchased: !target.purchased,
      actualCost: target.actualCost || target.estimatedCost,
    };
    if (user) {
      await saveBudgetExpenseToFirestore(user.uid, updated);
    } else {
      setBudgetExpenses((prev) => prev.map((b) => (b.id === id ? updated : b)));
    }
  };

  const handleDeleteBudgetExpense = async (id: string) => {
    if (user) {
      await deleteBudgetExpenseFromFirestore(user.uid, id);
    } else {
      setBudgetExpenses((prev) => prev.filter((b) => b.id !== id));
    }
  };

  // 2D Room Layout Planner CRUD (Phase 10)
  const handleSaveRoomLayout = async (layout: RoomLayoutPlan) => {
    const exists = roomLayouts.some((l) => l.id === layout.id);
    if (!exists && !isAdminUser && roomLayouts.length >= maxRoomLayouts) {
      setErrorBanner(
        isBn
          ? `আপনার প্ল্যানে সর্বোচ্চ ${maxRoomLayouts}টি ২ডি লেআউট সেভ করা যায়। আরও সেভ করতে প্ল্যান আপগ্রেড করুন।`
          : `Saved layout limit reached (${roomLayouts.length}/${maxRoomLayouts} on ${effectivePlanSpec.name}). Upgrade your plan for more.`
      );
      return;
    }
    const stamped: RoomLayoutPlan = { ...layout, updatedAt: Date.now() };
    if (user) {
      await ensureUserProfile(user);
      await saveRoomLayoutToFirestore(user.uid, stamped);
    } else {
      setRoomLayouts((prev) =>
        exists ? prev.map((l) => (l.id === stamped.id ? stamped : l)) : [stamped, ...prev]
      );
    }
    awardActivityPoints(`Saved 2D Layout: ${stamped.name}`, 15);
  };

  const handleDeleteRoomLayout = async (id: string) => {
    if (user) {
      await deleteRoomLayoutFromFirestore(user.uid, id);
    } else {
      setRoomLayouts((prev) => prev.filter((l) => l.id !== id));
    }
  };

  // Subscription Downgrade / Cancellation & Permanent Account Deletion
  const handleRequestCancelOrDowngrade = async (targetTier: PlanTier) => {
    if (!user) return;
    if (isAdminUser && targetTier) {
      await updateUserGovernanceAdmin(user, user.uid, { planTier: targetTier });
      setStatusBanner(
        isBn ? `প্ল্যান ${targetTier} এ আপডেট হয়েছে।` : `Plan updated to ${targetTier}.`
      );
      setTimeout(() => setStatusBanner(null), 3500);
      return;
    }

    if (serverSubscription?.subscriptionId) {
      try {
        const idToken = await user.getIdToken();
        const resp = await fetch('/api/billing/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          if (data.subscription) setServerSubscription(data.subscription);
          setStatusBanner(
            isBn
              ? 'চলতি বিলিং পিরিয়ড শেষে আপনার সাবস্ক্রিপশন বাতিল হবে।'
              : 'Cancellation scheduled: your plan will return to Free at the end of the current billing period.'
          );
          setTimeout(() => setStatusBanner(null), 5000);
          return;
        }
        setErrorBanner(data.error || 'Could not schedule cancellation with Stripe.');
        return;
      } catch (err: any) {
        setErrorBanner(err?.message || 'Unable to contact billing server.');
        return;
      }
    }

    setStatusBanner(
      isBn
        ? 'ডাউনগ্রেড বা সাবস্ক্রিপশন বাতিলের জন্য Manage Billing পোর্টাল অথবা Help & Support ব্যবহার করুন।'
        : 'To cancel or downgrade an active billing cycle, please use Manage Billing or submit a Billing ticket in Help & Support.'
    );
    setTimeout(() => setStatusBanner(null), 5000);
  };

  const handleDeleteAllAccountData = async () => {
    if (!user) return;
    await deleteAllUserAccountData(user);
    setSavedRooms([]);
    setStorageInventory([]);
    setCalendarTasks([]);
    setSavedDesigns([]);
    setBudgetExpenses([]);
    setRoomLayouts([]);
    setAnalysisResult(null);
    setSelectedImage(null);
    navigateToSection('dashboard');
    setStatusBanner(
      isBn
        ? 'আপনার অ্যাকাউন্ট ও সব ক্লাউড ডেটা স্থায়ীভাবে মুছে ফেলা হয়েছে।'
        : 'Your account and cloud data have been permanently deleted.'
    );
  };

  // Save room plan to Firestore (or localStorage if signed out)
  const handleSaveRoom = async () => {
    if (!analysisResult) return;
    setErrorBanner(null);

    const alreadySaved = savedRooms.some((r) => r.id === analysisResult.id);
    if (!alreadySaved && !isAdminUser && savedRooms.length >= maxSavedRooms) {
      setErrorBanner(
        isBn
          ? `আপনার প্ল্যানে সর্বোচ্চ ${maxSavedRooms}টি রুম সেভ করা যায়। আরও রুম রাখতে Plans & Billing দেখুন।`
          : `Saved room limit reached (${savedRooms.length}/${maxSavedRooms} on ${effectivePlanSpec.name}). Upgrade in Plans & Billing to save more.`
      );
      return;
    }

    const thumbnailUrl = await createThumbnailDataUrl(analysisResult.imageUrl);
    const redesignThumb = analysisResult.redesignPreviewUrl
      ? await createThumbnailDataUrl(analysisResult.redesignPreviewUrl)
      : undefined;
    const afterThumb = analysisResult.afterImageUrl
      ? await createThumbnailDataUrl(analysisResult.afterImageUrl)
      : undefined;

    const compactRoom: RoomAnalysis = {
      ...analysisResult,
      imageUrl: thumbnailUrl,
      ...(redesignThumb ? { redesignPreviewUrl: redesignThumb } : {}),
      ...(afterThumb ? { afterImageUrl: afterThumb } : {}),
    };

    if (user) {
      try {
        await ensureUserProfile(user);
        const savedId = await saveRoomToFirestore(user.uid, compactRoom);
        if (savedId !== analysisResult.id) {
          setAnalysisResult({ ...analysisResult, id: savedId });
        }
        setStatusBanner(
          isBn ? 'রুম প্ল্যান ক্লাউড ডাটাবেজে সেভ হয়েছে!' : 'Room plan saved to your Cloud Database!'
        );
        setTimeout(() => setStatusBanner(null), 3000);
      } catch (err: any) {
        console.error('Firestore save error:', err);
        setErrorBanner('Failed to save room plan to database. Please try again.');
      }
      return;
    }

    const exists = savedRooms.some((r) => r.id === compactRoom.id);
    if (exists) {
      setSavedRooms((prev) => prev.map((r) => (r.id === compactRoom.id ? compactRoom : r)));
    } else {
      setSavedRooms((prev) => [compactRoom, ...prev]);
    }
    setStatusBanner(
      isBn
        ? 'লোকাল ব্রাউজারে সেভ হয়েছে! সব ডিভাইসে সিঙ্ক করতে সাইন ইন করুন।'
        : 'Saved locally! Sign in with Google to sync across devices.'
    );
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleDeleteSavedRoom = async (id: string) => {
    if (user) {
      try {
        await deleteRoomFromFirestore(user.uid, id);
      } catch (err) {
        console.error('Delete room error:', err);
        setErrorBanner('Failed to delete room plan from database.');
      }
      return;
    }
    setSavedRooms((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSelectSavedRoom = (room: RoomAnalysis) => {
    setAnalysisResult(room);
    setSelectedImage(room.imageUrl);
    setRoomType(room.roomType);
    setFocusGoal(room.focusGoal);
    navigateToSection('dashboard');

    setTimeout(() => {
      document.getElementById('analysis-results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const totalCompletedTasks = useMemo(
    () =>
      (analysisResult?.actionPlan.filter((s) => s.completed).length || 0) +
      savedRooms.reduce(
        (acc, room) =>
          acc + (room.id === analysisResult?.id ? 0 : room.actionPlan.filter((s) => s.completed).length),
        0
      ) +
      calendarTasks.filter((tk) => tk.completed).length,
    [analysisResult, savedRooms, calendarTasks]
  );

  const organizedPercent = useMemo(() => {
    const rooms = [...savedRooms];
    if (analysisResult && !rooms.some((r) => r.id === analysisResult.id)) {
      rooms.unshift(analysisResult);
    }
    const tot = rooms.reduce((s, r) => s + r.actionPlan.length, 0);
    const done = rooms.reduce((s, r) => s + r.actionPlan.filter((st) => st.completed).length, 0);
    return tot > 0 ? Math.round((done / tot) * 100) : 0;
  }, [analysisResult, savedRooms]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const displayedNotifications = useMemo(
    () => (notifFilter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, notifFilter]
  );

  // Global live search hits across rooms, inventory, calendar tasks, and saved designs
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      onSelect: () => void;
    }> = [];

    savedRooms
      .filter((r) => r.roomName.toLowerCase().includes(q) || r.roomType.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((r) =>
        hits.push({
          id: `sr_${r.id}`,
          kind: isBn ? 'রুম' : 'Room',
          title: r.roomName,
          subtitle: `Score ${r.clutterScore}/100`,
          onSelect: () => handleSelectSavedRoom(r),
        })
      );

    storageInventory
      .filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          it.location.toLowerCase().includes(q) ||
          it.roomName.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((it) =>
        hits.push({
          id: `si_${it.id}`,
          kind: isBn ? 'ইনভেন্টরি' : 'Inventory',
          title: it.itemName,
          subtitle: `${it.roomName} · ${it.location}`,
          onSelect: () => setActiveSection('inventory'),
        })
      );

    calendarTasks
      .filter((tk) => tk.title.toLowerCase().includes(q) || tk.roomName.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((tk) =>
        hits.push({
          id: `sc_${tk.id}`,
          kind: isBn ? 'ক্যালেন্ডার' : 'Task',
          title: tk.title,
          subtitle: `${tk.dateIso} · ${tk.roomName}`,
          onSelect: () => setActiveSection('calendar'),
        })
      );

    savedDesigns
      .filter((d) => d.roomName.toLowerCase().includes(q) || d.style.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((d) =>
        hits.push({
          id: `sd_${d.id}`,
          kind: isBn ? 'ডিজাইন' : 'Design',
          title: d.roomName,
          subtitle: d.style.replace(/_/g, ' '),
          onSelect: () => setActiveSection('gallery'),
        })
      );

    return hits;
  }, [globalSearch, savedRooms, storageInventory, calendarTasks, savedDesigns, isBn]);

  const isCurrentRoomSaved = Boolean(
    analysisResult && savedRooms.some((r) => r.id === analysisResult.id)
  );

  const navItems: Array<{
    id: WorkspaceSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'dashboard', label: t.navHome, icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'redesign', label: t.navRedesign, icon: <Wand2 className="w-4 h-4 shrink-0" /> },
    {
      id: 'rooms',
      label: t.navSavedRooms,
      icon: <FolderHeart className="w-4 h-4 shrink-0" />,
      badge: savedRooms.length,
    },
    {
      id: 'gallery',
      label: t.navGallery,
      icon: <Columns2 className="w-4 h-4 shrink-0" />,
      badge: savedDesigns.length,
    },
    { id: 'calendar', label: t.navCalendar, icon: <CalendarDays className="w-4 h-4 shrink-0" /> },
    { id: 'inventory', label: t.navInventory, icon: <Package className="w-4 h-4 shrink-0" /> },
    { id: 'planner', label: t.navPlanner, icon: <Ruler className="w-4 h-4 shrink-0" /> },
    { id: 'budget', label: t.navBudget, icon: <Wallet className="w-4 h-4 shrink-0" /> },
    { id: 'stats', label: t.navStats, icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: 'family', label: t.navFamily, icon: <Users className="w-4 h-4 shrink-0" /> },
    { id: 'pricing', label: t.navPricing, icon: <CreditCard className="w-4 h-4 shrink-0" /> },
    { id: 'support', label: t.navSupport, icon: <HelpCircle className="w-4 h-4 shrink-0" /> },
    { id: 'profile', label: t.navProfile, icon: <UserIcon className="w-4 h-4 shrink-0" /> },
    ...(isAdminUser
      ? [
          {
            id: 'admin' as WorkspaceSection,
            label: t.navAdmin,
            icon: <ShieldAlert className="w-4 h-4 shrink-0 text-[#E9B95B]" />,
          },
        ]
      : []),
  ];

  const activeNavMeta = navItems.find((n) => n.id === activeSection) || navItems[0];
  const firstName = user?.displayName?.split(' ')[0] || (isBn ? 'বন্ধু' : 'Organizer');

  // Suspended account gate (Phase 7 & 11)
  if (user && userStatus === 'suspended' && !isAdminUser) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] dark:bg-[#0D1A15] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#13241D] border border-rose-200 dark:border-rose-900 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
            <Ban className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'অ্যাকাউন্ট সাময়িকভাবে স্থগিত' : 'Account Temporarily Suspended'}
          </h1>
          <p className="text-sm text-[#163D32]/75 dark:text-[#B9D1C3]">
            {isBn
              ? 'আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা স্থগিত করা হয়েছে। সহায়তার জন্য সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
              : 'This account has been suspended by an administrator. Please contact NeatSpace AI support if you believe this is an error.'}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163D32] text-white text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.navSignOut}</span>
          </button>
        </div>
      </div>
    );
  }

  // Maintenance mode gate for non-admin users (Phase 7)
  if (systemConfig.maintenanceMode && !isAdminUser) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] dark:bg-[#0D1A15] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#DDF3E5] text-[#163D32] flex items-center justify-center">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'সিস্টেম রক্ষণাবেক্ষণ চলছে' : 'Scheduled Workspace Maintenance'}
          </h1>
          <p className="text-sm text-[#163D32]/75 dark:text-[#B9D1C3]">
            {systemConfig.announcementBanner ||
              (isBn
                ? 'উন্নত অভিজ্ঞতা দিতে আমরা সিস্টেম আপডেট করছি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
                : 'NeatSpace AI is currently performing a brief platform upgrade. Your saved rooms and data remain safe.')}
          </p>
          {!user ? (
            <button
              type="button"
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163D32] text-white text-xs font-bold"
            >
              <LogIn className="w-4 h-4 text-[#E9B95B]" />
              <span>{t.navSignIn}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F7F9F6] border border-[#163D32]/15 text-[#163D32] text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.navSignOut}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] dark:bg-[#0D1A15] text-[#163D32] dark:text-[#EDF4EF] flex flex-col lg:flex-row transition-colors">
      {/* =========================================================
          DESKTOP LEFT COLLAPSIBLE SIDEBAR (Hidden on Mobile/Tablet < lg)
         ========================================================= */}
      <aside
        className={`hidden lg:flex shrink-0 bg-[#163D32] dark:bg-[#0A1410] text-white sticky top-0 h-screen flex-col justify-between p-3.5 border-r border-[#163D32] dark:border-[#264638] transition-all duration-200 ${
          isSidebarCollapsed ? 'w-[76px]' : 'w-[252px]'
        }`}
      >
        <div className="space-y-4 overflow-y-auto scrollbar-none">
          {/* Brand Logo & Collapse Button */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#DDF3E5] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#163D32]" />
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <div className="font-bold text-base tracking-tight text-white truncate">
                    {t.brandName}
                  </div>
                  <div className="text-[11px] text-[#DDF3E5]/75 truncate">
                    {isBn ? 'স্মার্ট রুম অর্গানাইজার' : 'AI Space Organizer'}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((c) => !c)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-[#DDF3E5]/75 hover:text-white hover:bg-white/10 shrink-0"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Primary New Scan CTA */}
          <button
            type="button"
            onClick={handleNewScan}
            title={isBn ? 'নতুন রুম স্ক্যান' : 'New Room Scan'}
            className={`w-full py-2.5 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-xs ${
              isSidebarCollapsed ? 'px-2' : 'px-3.5'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>{isBn ? 'নতুন রুম স্ক্যান' : 'New Room Scan'}</span>}
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => navigateToSection(item.id)}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#DDF3E5] text-[#163D32]'
                      : 'text-[#DDF3E5]/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.icon}
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!isSidebarCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md tabular-nums ${
                        isActive ? 'bg-[#163D32] text-white' : 'bg-white/15 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              title={t.navHomeTools}
              onClick={() => handleOpenToolsTab('analytics')}
              className={`w-full flex items-center ${
                isSidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
              } py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#DDF3E5]/85 hover:bg-white/10 hover:text-white transition-colors`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">{t.navHomeTools}</span>}
            </button>
          </nav>

          {/* Recent Spaces Quick List */}
          {!isSidebarCollapsed && savedRooms.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-1.5">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#DDF3E5]/60">
                {isBn ? 'সাম্প্রতিক রুম' : 'Recent Spaces'}
              </div>
              {savedRooms.slice(0, 4).map((rm) => (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => handleSelectSavedRoom(rm)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors ${
                    analysisResult?.id === rm.id
                      ? 'bg-white/15 text-[#E9B95B] font-bold'
                      : 'text-[#DDF3E5]/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  • {rm.roomName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile / Google Auth */}
        <div className="pt-3 border-t border-white/10">
          {user ? (
            <div
              className={`flex items-center ${
                isSidebarCollapsed ? 'justify-center p-1.5' : 'justify-between p-2.5'
              } gap-2 bg-white/10 rounded-xl`}
            >
              <button
                type="button"
                onClick={() => navigateToSection('profile')}
                className="flex items-center gap-2 min-w-0 text-left"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-white/20 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E9B95B] text-[#163D32] font-bold text-xs flex items-center justify-center shrink-0">
                    {firstName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {user.displayName || 'Google User'}
                    </div>
                    <div className="text-[10px] text-[#DDF3E5]/70 truncate">
                      {isBn ? 'ক্লাউড সিঙ্ক চালু' : 'Cloud Synced'}
                    </div>
                  </div>
                )}
              </button>
              {!isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={t.navSignOut}
                  className="p-1.5 rounded-lg hover:bg-white/15 text-[#DDF3E5]"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              title={t.navSignIn}
              className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4 text-[#E9B95B] shrink-0" />
              {!isSidebarCollapsed && <span>{t.navSignIn} (Google Sync)</span>}
            </button>
          )}
        </div>
      </aside>

      {/* =========================================================
          CENTER MAIN COLUMN (Mobile Header + Desktop Header + Views)
         ========================================================= */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* MOBILE TOP BAR (< lg) */}
        <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#13241D]/95 backdrop-blur-md border-b border-[#163D32]/10 dark:border-[#264638] px-3 sm:px-4 flex items-center justify-between gap-2">
          <div
            onClick={() => navigateToSection('dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigateToSection('dashboard');
            }}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-[#163D32] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#E9B95B]" />
            </div>
            <span className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] truncate">
              {t.brandName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF]"
            >
              {preferences.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#E9B95B]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'en' ? 'bn' : 'en'))}
              className="px-2 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF]"
            >
              {language === 'en' ? 'বাংলা' : 'EN'}
            </button>

            <button
              type="button"
              onClick={() => setIsNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF]"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E9B95B]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateToSection('profile')}
              aria-label="Profile & Settings"
              className="w-8 h-8 rounded-full overflow-hidden border border-[#163D32]/20 dark:border-[#264638] shrink-0"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full bg-[#163D32] text-white text-xs font-bold flex items-center justify-center">
                  {firstName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* DESKTOP TOP HEADER (lg+) */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#13241D]/95 backdrop-blur-md border-b border-[#163D32]/10 dark:border-[#264638] px-6 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-bold text-lg text-[#163D32] dark:text-[#EDF4EF] truncate">
              {activeNavMeta.label}
            </h1>
            {analysisResult && (
              <span className="text-xs font-medium text-[#163D32]/65 dark:text-[#B9D1C3] bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] px-2.5 py-1 rounded-xl truncate max-w-[220px]">
                {analysisResult.roomName}
              </span>
            )}
          </div>

          {/* Global Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#163D32]/50 dark:text-[#B9D1C3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={globalSearch}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 180)}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={isBn ? 'রুম, জিনিস বা কাজ খুঁজুন (/)' : 'Search rooms, items, tasks... (/)'}
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] focus:border-[#163D32] rounded-xl pl-9 pr-8 py-1.5 text-xs text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#163D32]/50 dark:text-[#B9D1C3]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {isSearchFocused && globalSearch.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-10 bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl shadow-xl p-2 z-50 space-y-1">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#163D32]/65 dark:text-[#B9D1C3]">
                    {isBn ? 'কোনো মিল পাওয়া যায়নি।' : 'No matching rooms, inventory, or tasks.'}
                  </div>
                ) : (
                  searchResults.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        hit.onSelect();
                        setGlobalSearch('');
                        setIsSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F7F9F6] dark:hover:bg-[#182C24] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                          {hit.title}
                        </div>
                        <div className="text-[11px] text-[#163D32]/65 dark:text-[#B9D1C3] truncate">
                          {hit.subtitle}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#DDF3E5] text-[#163D32] text-[10px] font-bold shrink-0">
                        {hit.kind}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Streak & Points Pill */}
            <button
              type="button"
              onClick={() => navigateToSection('stats')}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] hover:bg-[#DDF3E5]/60 transition-colors tabular-nums"
            >
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#E9B95B]" />
                {streakDays}d
              </span>
              <span className="text-[#163D32]/25 dark:text-white/20">|</span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#163D32] dark:text-[#E9B95B]" />
                {points} pts
              </span>
            </button>

            {/* Quick Guide / Tutorial Button */}
            <button
              type="button"
              onClick={() => setIsTutorialOpen(true)}
              aria-label="Quick Guide"
              title={isBn ? 'টিউটোরিয়াল গাইড' : 'Quick Guide'}
              className="p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title={preferences.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              className="p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] transition-colors"
            >
              {preferences.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#E9B95B]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotifOpen((v) => !v)}
              aria-label="Notifications & Daily Reminder"
              className="relative p-2 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#E9B95B] text-[#163D32] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Language Switch */}
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'en' ? 'bn' : 'en'))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] hover:bg-[#DDF3E5] border border-[#163D32]/10 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] transition-colors whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
            </button>

            {/* Desktop Coach Toggle */}
            <button
              type="button"
              onClick={() => setIsDesktopCoachOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              {isDesktopCoachOpen ? (
                <PanelRightClose className="w-4 h-4 text-[#E9B95B]" />
              ) : (
                <PanelRightOpen className="w-4 h-4 text-[#E9B95B]" />
              )}
              <span>{t.navAiCoach}</span>
            </button>
          </div>
        </header>

        {/* Notifications & Daily Reminder Popover */}
        {isNotifOpen && (
          <div className="fixed right-4 top-16 lg:right-8 lg:top-[70px] z-50 w-[min(370px,calc(100vw-2rem))] bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'নোটিফিকেশন ও রিমাইন্ডার' : 'Notifications & Reminders'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                  disabled={unreadNotifCount === 0}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                    unreadNotifCount === 0
                      ? 'bg-[#F7F9F6] dark:bg-[#182C24] text-[#163D32]/50 dark:text-[#B9D1C3]/50 border border-[#163D32]/10 dark:border-[#264638] cursor-default'
                      : 'bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] border border-[#163D32]/15 cursor-pointer'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>
                    {unreadNotifCount === 0
                      ? isBn
                        ? 'সব পড়া হয়েছে'
                        : 'All Read'
                      : isBn
                      ? 'সব পড়ুন'
                      : 'Read All'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  aria-label="Close reminders"
                  className="p-1 text-[#163D32]/60 dark:text-[#B9D1C3] hover:text-[#163D32] rounded-lg hover:bg-[#F7F9F6] dark:hover:bg-[#182C24] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter & Clear */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 bg-[#F7F9F6] dark:bg-[#182C24] p-0.5 rounded-xl border border-[#163D32]/10 dark:border-[#264638]">
                {(['all', 'unread'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNotifFilter(f)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-semibold ${
                      notifFilter === f
                        ? 'bg-[#163D32] text-white'
                        : 'text-[#163D32]/70 dark:text-[#B9D1C3]'
                    }`}
                  >
                    {f === 'all' ? (isBn ? 'সব' : 'All') : `${isBn ? 'অপঠিত' : 'Unread'} (${unreadNotifCount})`}
                  </button>
                ))}
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNotifications([])}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  {isBn ? 'মুছুন' : 'Clear'}
                </button>
              )}
            </div>

            {/* Notification Feed */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {displayedNotifications.length === 0 ? (
                <div className="text-xs text-[#163D32]/60 dark:text-[#B9D1C3] py-4 text-center">
                  {isBn ? 'নতুন কোনো নোটিফিকেশন নেই।' : 'You are all caught up!'}
                </div>
              ) : (
                displayedNotifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                      );
                      if (n.targetSection) setActiveSection(n.targetSection);
                      setIsNotifOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors space-y-0.5 ${
                      n.read
                        ? 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638]'
                        : 'bg-[#DDF3E5]/55 dark:bg-[#1B372B] border-[#163D32]/20 dark:border-[#396752]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[#163D32]/60 dark:text-[#B9D1C3] shrink-0">
                        {formatRelativeTime(n.timestamp, isBn)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#163D32]/75 dark:text-[#B9D1C3] leading-snug">
                      {n.body}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Daily Reminder Card */}
            <div
              className={`rounded-xl p-3 text-xs space-y-1.5 border transition-colors ${
                !reminderConfig.enabled
                  ? 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638]'
                  : 'bg-[#DDF3E5]/45 dark:bg-[#182C24] border-[#163D32]/20 dark:border-[#264638]'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[#163D32] dark:text-[#EDF4EF]">
                <span>{isBn ? 'দৈনিক ক্লিনিং রিমাইন্ডার' : 'Daily Cleaning Reminder'}</span>
                <span className="font-mono">{reminderConfig.time}</span>
              </div>
              <p className="text-[#163D32]/70 dark:text-[#B9D1C3]">
                {reminderConfig.enabled
                  ? isBn
                    ? 'আজকের ১৫ মিনিটের রুম গোছানোর রিমাইন্ডার চালু আছে।'
                    : 'Your daily declutter habit reminder is active.'
                  : isBn
                  ? 'রিমাইন্ডার সাময়িকভাবে বন্ধ আছে।'
                  : 'Reminders are currently paused.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveSection('calendar');
                  setIsNotifOpen(false);
                }}
                className="text-xs font-bold text-[#163D32] dark:text-[#E9B95B] underline"
              >
                {isBn ? 'ক্যালেন্ডারে সময় পরিবর্তন করুন →' : 'Configure in Calendar →'}
              </button>
            </div>
            <div className="text-xs text-[#163D32]/75 dark:text-[#B9D1C3] flex items-center justify-between">
              <span>{isBn ? 'সম্পন্ন কাজ:' : 'Total completed tasks:'}</span>
              <strong className="font-mono tabular-nums">{totalCompletedTasks}</strong>
            </div>
          </div>
        )}

        {/* SCROLLABLE WORKSPACE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 space-y-6 max-w-6xl w-full mx-auto">
          {/* Hidden Mobile File Input for Big Upload CTA */}
          <input
            ref={mobileQuickUploadRef}
            type="file"
            accept="image/*"
            onChange={handleMobileFileUpload}
            className="hidden"
          />

          {/* Email Verification Prompt for newly registered Email/Password accounts */}
          {user && !user.emailVerified && (
            <div className="bg-[#FFF9EB] dark:bg-[#231D11] border border-[#E9B95B]/50 text-[#163D32] dark:text-[#EDF4EF] px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E9B95B] shrink-0" />
                <span>
                  {isBn
                    ? `ক্লাউড সিঙ্ক চালু করতে আপনার ইমেইল (${user.email}) ভেরিফাই করুন।`
                    : `Verify your email (${user.email}) via the link we sent to unlock Cloud Firestore sync.`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resendVerificationEmail();
                      setStatusBanner(
                        isBn ? 'ভেরিফিকেশন ইমেইল আবার পাঠানো হয়েছে।' : 'Verification email resent!'
                      );
                    } catch (err: any) {
                      setErrorBanner(err?.message || 'Unable to resend verification email.');
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-white dark:bg-[#182C24] border border-[#163D32]/15 text-xs font-bold"
                >
                  {isBn ? 'আবার পাঠান' : 'Resend Link'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await user.reload();
                    setUser(auth.currentUser);
                    if (auth.currentUser?.emailVerified) {
                      window.location.reload();
                    } else {
                      setStatusBanner(
                        isBn
                          ? 'এখনো ভেরিফাই সম্পন্ন হয়নি — ইনবক্স চেক করুন।'
                          : 'Not verified yet — please check your inbox or spam folder.'
                      );
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-[#163D32] text-white text-xs font-bold"
                >
                  {isBn ? 'রিফ্রেশ করুন' : "I've Verified"}
                </button>
              </div>
            </div>
          )}

          {/* Global Announcement Banner (Set from Admin Console) */}
          {systemConfig.announcementBanner && (
            <div className="bg-[#163D32] text-[#EDF4EF] px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm border border-[#E9B95B]/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E9B95B] shrink-0" />
                <span>{systemConfig.announcementBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => navigateToSection('support')}
                className="text-xs font-bold text-[#E9B95B] hover:underline shrink-0"
              >
                {isBn ? 'বিস্তারিত' : 'Help Center'}
              </button>
            </div>
          )}

          {/* Error & Status Banners */}
          {errorBanner && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-2xl flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="p-1 text-rose-700 dark:text-rose-200"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {statusBanner && (
            <div className="bg-[#DDF3E5] dark:bg-[#182C24] border border-[#163D32]/20 dark:border-[#396752] text-[#163D32] dark:text-[#EDF4EF] px-4 py-3 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-[#163D32] dark:text-[#E9B95B] shrink-0" />
                <span>{statusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="p-1 text-[#163D32] dark:text-[#EDF4EF]"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <Suspense
            fallback={
              <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-10 flex items-center justify-center gap-3 text-sm font-semibold text-[#163D32] dark:text-[#EDF4EF]">
                <Loader2 className="w-5 h-5 animate-spin text-[#E9B95B]" />
                <span>{isBn ? 'লোড হচ্ছে...' : 'Loading workspace module...'}</span>
              </div>
            }
          >
            {/* SECTION: DASHBOARD / ROOM ANALYZER */}
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                {/* Mobile-Specific Welcome Card + Big Upload CTA (< lg) */}
                <div className="lg:hidden space-y-4">
                  <div className="bg-[#163D32] text-white rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#DDF3E5]/80 font-medium">
                          {isBn ? `স্বাগতম, ${firstName}` : `Welcome back, ${firstName}`}
                        </p>
                        <h2 className="text-xl font-bold text-white mt-0.5">
                          {isBn ? 'আজ ঘরটি সাজিয়ে নেওয়া যাক' : 'Let’s bring calm to your space'}
                        </h2>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-sm font-bold text-[#E9B95B]">{organizedPercent}%</div>
                        <div className="text-[10px] text-[#DDF3E5]/75">
                          {isBn ? 'গোছানো' : 'organized'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-white/10 text-[#DDF3E5] flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-[#E9B95B]" />
                        {streakDays}d
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-white/10 text-[#DDF3E5] flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-[#E9B95B]" />
                        {points} pts
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-white/10 text-[#DDF3E5]">
                        {savedRooms.length} {isBn ? 'রুম' : 'rooms'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => mobileQuickUploadRef.current?.click()}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32] font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                      <span>{t.uploadBigCta}</span>
                    </button>
                  </div>

                  {/* Mobile Feature Shortcut Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                    {[
                      { id: 'redesign' as WorkspaceSection, label: t.navRedesign, icon: <Wand2 className="w-3.5 h-3.5" /> },
                      { id: 'planner' as WorkspaceSection, label: t.navPlanner, icon: <Ruler className="w-3.5 h-3.5" /> },
                      { id: 'budget' as WorkspaceSection, label: t.navBudget, icon: <Wallet className="w-3.5 h-3.5" /> },
                      { id: 'gallery' as WorkspaceSection, label: t.navGallery, icon: <Columns2 className="w-3.5 h-3.5" /> },
                      { id: 'inventory' as WorkspaceSection, label: t.navInventory, icon: <Package className="w-3.5 h-3.5" /> },
                      { id: 'stats' as WorkspaceSection, label: t.navStats, icon: <BarChart3 className="w-3.5 h-3.5" /> },
                      { id: 'pricing' as WorkspaceSection, label: t.navPricing, icon: <CreditCard className="w-3.5 h-3.5" /> },
                      { id: 'family' as WorkspaceSection, label: t.navFamily, icon: <Users className="w-3.5 h-3.5" /> },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => navigateToSection(chip.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] text-xs font-bold text-[#163D32] dark:text-[#EDF4EF] whitespace-nowrap shrink-0"
                      >
                        {chip.icon}
                        <span>{chip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Complete Home Dashboard KPI & Activity Overview */}
                <HomeDashboardOverview
                  firstName={firstName}
                  language={language}
                  savedRooms={savedRooms}
                  activeRoom={analysisResult}
                  calendarTasks={calendarTasks}
                  history={cleaningHistory}
                  streakDays={streakDays}
                  points={points}
                  organizedPercent={organizedPercent}
                  onNavigate={navigateToSection}
                  onSelectRoom={handleSelectSavedRoom}
                  onQuickUpload={() => {
                    document.getElementById('room-upload-panel')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />

                {/* Room Image Upload + Personalized Analysis Options */}
                <div id="room-upload-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7">
                    <ImageUploader
                      selectedImage={selectedImage}
                      language={language}
                      maxUploadMb={systemConfig.maxUploadMb}
                      onImageSelect={handleImageSelect}
                      onSelectSample={handleSelectSample}
                      onClearImage={handleClearImage}
                    />
                  </div>

                  <div className="lg:col-span-5">
                    <AnalysisOptions
                      roomType={roomType}
                      focusGoal={focusGoal}
                      language={language}
                      customContext={customContext}
                      dailyMinutes={dailyMinutes}
                      isAnalyzing={isAnalyzing}
                      hasImage={Boolean(selectedImage)}
                      onRoomTypeChange={setRoomType}
                      onFocusGoalChange={setFocusGoal}
                      onLanguageChange={setLanguage}
                      onCustomContextChange={setCustomContext}
                      onDailyMinutesChange={setDailyMinutes}
                      onAnalyze={handleAnalyzeRoom}
                    />
                  </div>
                </div>

                {/* Comprehensive Analysis Results */}
                {analysisResult && (
                  <div id="analysis-results-section" className="pt-2">
                    <AnalysisResults
                      analysis={analysisResult}
                      language={language}
                      familyMembers={familyMembers}
                      onAssignMember={handleAssignRoomToMember}
                      onToggleStep={handleToggleStep}
                      onToggleAllSteps={handleToggleAllSteps}
                      onAddCustomStep={handleAddCustomStep}
                      onEditStep={handleEditStep}
                      onDeleteStep={handleDeleteStep}
                      onMoveStep={handleMoveStep}
                      onUpdateTriageItem={handleUpdateTriageItem}
                      onAddTriageItem={handleAddTriageItem}
                      onToggleStorageItem={handleToggleStorageItem}
                      onSaveNotes={handleSaveNotes}
                      onSaveRoom={handleSaveRoom}
                      isSaved={isCurrentRoomSaved}
                      onOpenCoachWithContext={() => {
                        setIsMobileChatOpen(true);
                        setIsDesktopCoachOpen(true);
                      }}
                      onOpenRedesignStudio={() => navigateToSection('redesign')}
                      onOpenToolsTab={handleOpenToolsTab}
                      onCompareAfterPhoto={handleCompareAfterPhoto}
                      isComparingAfter={isComparingAfter}
                      onLogFocusMinutes={handleLogFocusMinutes}
                      canExportPdf={canExportPdf}
                      maxUploadMb={systemConfig.maxUploadMb}
                      onOpenPricing={() => navigateToSection('pricing')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* SECTION: AI ROOM REDESIGN STUDIO */}
            {activeSection === 'redesign' && (
              <RedesignStudio
                activeRoom={analysisResult}
                selectedImage={selectedImage}
                roomType={roomType}
                language={language}
                savedDesigns={savedDesigns}
                defaultStyle={preferences.preferredStyle}
                maxUploadMb={systemConfig.maxUploadMb}
                onBeforeGenerate={() => {
                  if (!systemConfig.aiRedesignEnabled && !isAdminUser) {
                    return isBn
                      ? 'AI রুম রিডিজাইন সাময়িকভাবে বন্ধ রয়েছে।'
                      : 'AI Room Redesign is temporarily disabled by workspace administrators.';
                  }
                  if (!isAdminUser && monthlyUsage.aiRedesigns >= effectivePlanSpec.monthlyRedesigns) {
                    return isBn
                      ? `মাসিক রিডিজাইন কোটা (${monthlyUsage.aiRedesigns}/${effectivePlanSpec.monthlyRedesigns}) শেষ হয়েছে।`
                      : `Monthly AI Redesign quota reached (${monthlyUsage.aiRedesigns}/${effectivePlanSpec.monthlyRedesigns}). Upgrade in Plans & Billing.`;
                  }
                  return null;
                }}
                onRedesignComplete={() => {
                  if (user) {
                    incrementMonthlyUsageInFirestore(user.uid, 'aiRedesigns');
                  } else {
                    setMonthlyUsage((p) => ({
                      ...p,
                      aiRedesigns: p.aiRedesigns + 1,
                      updatedAt: Date.now(),
                    }));
                  }
                }}
                onAttachRedesignToRoom={handleAttachRedesignToRoom}
                onSaveDesign={handleSaveDesign}
                onDeleteDesign={handleDeleteDesign}
                onSelectNewImage={(dataUrl) => setSelectedImage(dataUrl)}
                onAwardPoints={(action, pts) => awardActivityPoints(action, pts)}
              />
            )}

            {/* SECTION: MY ROOMS & SAVED PLANS */}
            {activeSection === 'rooms' && (
              <SavedRoomsList
                isOpen={true}
                embedded={true}
                onClose={() => navigateToSection('dashboard')}
                savedRooms={savedRooms}
                isCloudSynced={Boolean(user)}
                language={language}
                onSignIn={handleSignIn}
                onSelectRoom={handleSelectSavedRoom}
                onDeleteRoom={handleDeleteSavedRoom}
                onImportRooms={handleImportRooms}
              />
            )}

            {/* SECTION: BEFORE & AFTER COMPARISON GALLERY */}
            {activeSection === 'gallery' && (
              <BeforeAfterGalleryView
                savedRooms={savedRooms}
                activeRoom={analysisResult}
                savedDesigns={savedDesigns}
                language={language}
                onSelectRoom={handleSelectSavedRoom}
                onDeleteDesign={(id) => setPendingDeleteGalleryDesignId(id)}
                onSaveStandalonePair={handleSaveDesign}
              />
            )}

            {/* SECTION: WEEKLY & MONTHLY CLEANING CALENDAR + REMINDERS */}
            {activeSection === 'calendar' && (
              <CalendarRemindersView
                activeRoom={analysisResult}
                language={language}
                reminder={reminderConfig}
                tasks={calendarTasks}
                onUpdateReminder={setReminderConfig}
                onUpdateWeeklySchedule={handleUpdateWeeklySchedule}
                onAddTask={handleAddCalendarTask}
                onToggleTask={handleToggleCalendarTask}
                onUpdateTask={handleUpdateCalendarTask}
                onDeleteTask={handleDeleteCalendarTask}
                onAwardPoints={(action, pts, mins) => awardActivityPoints(action, pts, mins || 0)}
              />
            )}

            {/* SECTION: STORAGE INVENTORY */}
            {activeSection === 'inventory' && (
              <StorageInventoryView
                items={storageInventory}
                activeRoom={analysisResult}
                rooms={savedRooms.map((r) => r.roomName)}
                language={language}
                onAddItem={handleAddInventoryItem}
                onUpdateQty={handleUpdateInventoryQty}
                onUpdateItem={handleUpdateInventoryItem}
                onDeleteItem={handleDeleteInventoryItem}
              />
            )}

            {/* SECTION: 2D SCALED ROOM LAYOUT PLANNER (PHASE 10) */}
            {activeSection === 'planner' && (
              <RoomLayoutPlannerView
                language={language}
                layouts={roomLayouts}
                maxLayouts={maxRoomLayouts}
                aiLayoutEnabled={systemConfig.aiLayoutEnabled || isAdminUser}
                onSaveLayout={handleSaveRoomLayout}
                onDeleteLayout={handleDeleteRoomLayout}
                onAiLayoutCompleted={() => {
                  if (user) incrementMonthlyUsageInFirestore(user.uid, 'layoutSuggestions');
                }}
                onOpenPricing={() => navigateToSection('pricing')}
                onDirtyChange={setIsChildDirty}
              />
            )}

            {/* SECTION: SMART BUDGET TRACKER & AI SHOPPING ASSISTANT (PHASE 9) */}
            {activeSection === 'budget' && (
              <BudgetShoppingView
                language={language}
                expenses={budgetExpenses}
                budgetTarget={preferences.roomBudgetTarget || 150}
                savedRoomNames={savedRooms.map((r) => r.roomName)}
                defaultRoomType={analysisResult?.roomType || roomType}
                aiShoppingEnabled={systemConfig.aiShoppingEnabled || isAdminUser}
                canExportPdf={canExportPdf}
                onUpdateBudgetTarget={(target) =>
                  handleUpdatePreferences({ ...preferences, roomBudgetTarget: target })
                }
                onAddExpense={handleAddBudgetExpense}
                onTogglePurchased={handleToggleBudgetPurchased}
                onDeleteExpense={handleDeleteBudgetExpense}
                onShoppingQueryCompleted={() => {
                  if (user) incrementMonthlyUsageInFirestore(user.uid, 'shoppingQueries');
                }}
                onOpenPricing={() => navigateToSection('pricing')}
                onDirtyChange={setIsChildDirty}
              />
            )}

            {/* SECTION: USER DASHBOARD, STATS, HISTORY & REWARDS */}
            {activeSection === 'stats' && (
              <DashboardStatsView
                savedRooms={savedRooms}
                activeRoom={analysisResult}
                history={cleaningHistory}
                points={points}
                streakDays={streakDays}
                focusMinutesTotal={focusMinutesTotal}
                language={language}
                onSelectRoom={handleSelectSavedRoom}
                onClearHistory={() => setCleaningHistory([])}
              />
            )}

            {/* SECTION: FAMILY & SHARED ROOM HUB */}
            {activeSection === 'family' && (
              <FamilyHubView
                members={familyMembers}
                familyLogs={familyLogs}
                savedRooms={savedRooms}
                activeRoom={analysisResult}
                language={language}
                onAddMember={(name, role, color) =>
                  setFamilyMembers((prev) => [
                    ...prev,
                    { id: `mem_${Date.now()}`, name, role, color, points: 0 },
                  ])
                }
                onRemoveMember={(id) =>
                  setFamilyMembers((prev) => prev.filter((m) => m.id !== id))
                }
                onAssignRoom={handleAssignRoomToMember}
                onSelectRoom={handleSelectSavedRoom}
              />
            )}

            {/* SECTION: SUBSCRIPTION & PRICING (PHASE 8) */}
            {activeSection === 'pricing' && (
              <SubscriptionPricingView
                user={user}
                language={language}
                planTier={effectivePlanTier}
                subscription={effectiveSubscription}
                usage={monthlyUsage}
                savedRoomsCount={savedRooms.length}
                roomLayoutsCount={roomLayouts.length}
                invoices={mergedBillingInvoices}
                onSignIn={handleSignIn}
                onRequestCancelOrDowngrade={handleRequestCancelOrDowngrade}
                onSubscriptionSynced={(syncedSub, syncedInvoices) => {
                  setServerSubscription(syncedSub);
                  if (Array.isArray(syncedInvoices)) {
                    setServerBillingInvoices(syncedInvoices);
                  }
                  setStatusBanner(
                    isBn
                      ? 'সাবস্ক্রিপশন স্ট্যাটাস সফলভাবে সিঙ্ক হয়েছে!'
                      : 'Subscription status synced successfully!'
                  );
                }}
              />
            )}

            {/* SECTION: HELP, FAQ, FEEDBACK & REPORTS (PHASE 13) */}
            {activeSection === 'support' && (
              <HelpSupportView
                user={user}
                language={language}
                userFeedbacks={userFeedbacks}
                userReports={userReports}
                onSignIn={handleSignIn}
                onOpenTutorial={() => setIsTutorialOpen(true)}
              />
            )}

            {/* SECTION: USER PROFILE & PREFERENCES */}
            {activeSection === 'profile' && (
              <ProfileSettingsView
                user={user}
                language={language}
                preferences={preferences}
                points={points}
                streakDays={streakDays}
                savedRoomsCount={savedRooms.length}
                planTier={effectivePlanTier}
                privacy={privacySettings}
                onLanguageChange={setLanguage}
                onUpdatePreferences={handleUpdatePreferences}
                onUpdatePrivacy={setPrivacySettings}
                onOpenPricing={() => navigateToSection('pricing')}
                onDeleteAccount={handleDeleteAllAccountData}
                onDirtyChange={setIsChildDirty}
                onExportAllData={handleExportAllData}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
              />
            )}

            {/* SECTION: RBAC PROTECTED ADMIN CONSOLE (PHASE 7) */}
            {activeSection === 'admin' && isAdminUser && user && (
              <AdminDashboardView
                user={user}
                language={language}
                systemConfig={systemConfig}
                savedRoomsTotalLocal={savedRooms.length}
              />
            )}

            {/* SECTION: 404 / NOT FOUND */}
            {(activeSection === 'not_found' || (activeSection === 'admin' && !isAdminUser)) && (
              <NotFoundView
                language={language}
                invalidRoute={invalidRoute}
                onNavigate={navigateToSection}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* =========================================================
          DESKTOP PERSISTENT RIGHT AI VOICE COACH SIDEBAR (lg+)
         ========================================================= */}
      {isDesktopCoachOpen && (
        <aside className="hidden lg:flex w-[360px] xl:w-[390px] shrink-0 sticky top-0 h-screen z-20">
          <DeclutterChat
            embedded={true}
            isOpen={isDesktopCoachOpen}
            onClose={() => setIsDesktopCoachOpen(false)}
            activeRoom={analysisResult}
            language={language}
            userStats={{
              completedSteps: totalCompletedTasks,
              savedRoomsCount: savedRooms.length,
              focusMinutesTotal,
            }}
            onBeforeSendMessage={() => {
              if (!systemConfig.aiCoachEnabled && !isAdminUser) {
                return isBn
                  ? 'AI কোচ সাময়িকভাবে বন্ধ রয়েছে।'
                  : 'Voice AI Coach is temporarily disabled by workspace administrators.';
              }
              if (!isAdminUser && monthlyUsage.aiCoachMessages >= effectivePlanSpec.monthlyCoachMessages) {
                return isBn
                  ? `আপনার মাসিক AI কোচ মেসেজ কোটা (${effectivePlanSpec.monthlyCoachMessages}) শেষ হয়েছে।`
                  : `Monthly AI Coach message limit reached (${effectivePlanSpec.monthlyCoachMessages}). Visit Plans & Billing to upgrade.`;
              }
              return null;
            }}
            onMessageComplete={() => {
              if (user) {
                incrementMonthlyUsageInFirestore(user.uid, 'aiCoachMessages');
              } else {
                setMonthlyUsage((p) => ({
                  ...p,
                  aiCoachMessages: p.aiCoachMessages + 1,
                  updatedAt: Date.now(),
                }));
              }
            }}
          />
        </aside>
      )}

      {/* =========================================================
          MOBILE FLOATING AI COACH BUTTON & DRAWER (< lg)
         ========================================================= */}
      {!isMobileChatOpen && (
        <button
          type="button"
          onClick={() => setIsMobileChatOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 bg-[#163D32] hover:bg-[#102E25] text-white font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-[#E9B95B]/40 no-print"
        >
          <MessageSquare className="w-5 h-5 text-[#E9B95B]" />
          <span className="text-xs">{t.coachFloating}</span>
        </button>
      )}

      <div className="lg:hidden">
        <DeclutterChat
          isOpen={isMobileChatOpen}
          onClose={() => setIsMobileChatOpen(false)}
          activeRoom={analysisResult}
          language={language}
          userStats={{
            completedSteps: totalCompletedTasks,
            savedRoomsCount: savedRooms.length,
            focusMinutesTotal,
          }}
          onBeforeSendMessage={() => {
            if (!systemConfig.aiCoachEnabled && !isAdminUser) {
              return isBn
                ? 'AI কোচ সাময়িকভাবে বন্ধ রয়েছে।'
                : 'Voice AI Coach is temporarily disabled by workspace administrators.';
            }
            if (!isAdminUser && monthlyUsage.aiCoachMessages >= effectivePlanSpec.monthlyCoachMessages) {
              return isBn
                ? `আপনার মাসিক AI কোচ মেসেজ কোটা (${effectivePlanSpec.monthlyCoachMessages}) শেষ হয়েছে।`
                : `Monthly AI Coach message limit reached (${effectivePlanSpec.monthlyCoachMessages}). Visit Plans & Billing to upgrade.`;
            }
            return null;
          }}
          onMessageComplete={() => {
            if (user) {
              incrementMonthlyUsageInFirestore(user.uid, 'aiCoachMessages');
            } else {
              setMonthlyUsage((p) => ({
                ...p,
                aiCoachMessages: p.aiCoachMessages + 1,
                updatedAt: Date.now(),
              }));
            }
          }}
        />
      </div>

      {/* =========================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (< lg)
         ========================================================= */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 pb-safe bg-white/95 dark:bg-[#13241D]/95 backdrop-blur-md border-t border-[#163D32]/10 dark:border-[#264638] grid grid-cols-5 items-center px-1 no-print">
        <button
          type="button"
          onClick={() => {
            navigateToSection('dashboard');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            activeSection === 'dashboard'
              ? 'text-[#163D32] dark:text-[#E9B95B]'
              : 'text-[#163D32]/55 dark:text-[#B9D1C3]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>{isBn ? 'হোম' : 'Home'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            navigateToSection('rooms');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            activeSection === 'rooms'
              ? 'text-[#163D32] dark:text-[#E9B95B]'
              : 'text-[#163D32]/55 dark:text-[#B9D1C3]'
          }`}
        >
          <FolderHeart className="w-5 h-5" />
          <span>{isBn ? 'রুম' : 'Rooms'}</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setIsMobileMoreOpen(false);
              mobileQuickUploadRef.current?.click();
            }}
            aria-label="Scan Room"
            className="w-12 h-12 -mt-5 rounded-2xl bg-[#163D32] text-[#E9B95B] shadow-lg flex items-center justify-center border-4 border-[#F7F9F6] dark:border-[#0D1A15]"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            navigateToSection('calendar');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            activeSection === 'calendar'
              ? 'text-[#163D32] dark:text-[#E9B95B]'
              : 'text-[#163D32]/55 dark:text-[#B9D1C3]'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span>{isBn ? 'রুটিন' : 'Calendar'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMoreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            isMobileMoreOpen ||
            [
              'redesign',
              'gallery',
              'inventory',
              'planner',
              'budget',
              'stats',
              'family',
              'pricing',
              'support',
              'profile',
              'admin',
            ].includes(activeSection)
              ? 'text-[#163D32] dark:text-[#E9B95B]'
              : 'text-[#163D32]/55 dark:text-[#B9D1C3]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>{t.navMore}</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet Drawer */}
      {isMobileMoreOpen && (
        <div
          onClick={() => setIsMobileMoreOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-[#163D32]/40 backdrop-blur-xs flex items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[82vh] overflow-y-auto bg-white dark:bg-[#13241D] rounded-t-3xl p-5 pb-8 space-y-3 border-t border-[#163D32]/10 dark:border-[#264638]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#163D32]/10 dark:border-[#264638]">
              <span className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                {isBn ? 'সব স্মার্ট ফিচার' : 'All Smart Features'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    setIsTutorialOpen(true);
                  }}
                  className="p-1.5 text-[#163D32]/70 dark:text-[#B9D1C3]"
                  aria-label="Quick guide"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="p-1.5 text-[#163D32]/60 dark:text-[#B9D1C3]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'redesign' as WorkspaceSection, label: t.navRedesign, icon: <Wand2 className="w-4 h-4" /> },
                { id: 'planner' as WorkspaceSection, label: t.navPlanner, icon: <Ruler className="w-4 h-4" /> },
                { id: 'budget' as WorkspaceSection, label: t.navBudget, icon: <Wallet className="w-4 h-4" /> },
                { id: 'gallery' as WorkspaceSection, label: t.navGallery, icon: <Columns2 className="w-4 h-4" /> },
                { id: 'inventory' as WorkspaceSection, label: t.navInventory, icon: <Package className="w-4 h-4" /> },
                { id: 'stats' as WorkspaceSection, label: t.navStats, icon: <BarChart3 className="w-4 h-4" /> },
                { id: 'family' as WorkspaceSection, label: t.navFamily, icon: <Users className="w-4 h-4" /> },
                { id: 'pricing' as WorkspaceSection, label: t.navPricing, icon: <CreditCard className="w-4 h-4" /> },
                { id: 'support' as WorkspaceSection, label: t.navSupport, icon: <HelpCircle className="w-4 h-4" /> },
                { id: 'profile' as WorkspaceSection, label: t.navProfile, icon: <UserIcon className="w-4 h-4" /> },
                ...(isAdminUser
                  ? [
                      {
                        id: 'admin' as WorkspaceSection,
                        label: t.navAdmin,
                        icon: <ShieldAlert className="w-4 h-4 text-[#E9B95B]" />,
                      },
                    ]
                  : []),
              ].map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => navigateToSection(entry.id)}
                  className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-bold text-left ${
                    activeSection === entry.id
                      ? 'bg-[#DDF3E5] border-[#163D32] text-[#163D32]'
                      : 'bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF]'
                  }`}
                >
                  {entry.icon}
                  <span className="truncate">{entry.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  handleOpenToolsTab('analytics');
                }}
                className="col-span-2 p-3.5 rounded-xl bg-[#163D32] text-white flex items-center justify-center gap-2 text-xs font-bold"
              >
                <Wrench className="w-4 h-4 text-[#E9B95B]" />
                <span>{t.heroToolsCta}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Power Tools Modal */}
      <OrganizationToolsModal
        isOpen={isToolsOpen}
        initialTab={toolsTab}
        onClose={() => setIsToolsOpen(false)}
        activeRoom={analysisResult}
        savedRooms={savedRooms}
        focusMinutesTotal={focusMinutesTotal}
        language={language}
        onUpdateFloorplan={handleUpdateFloorplan}
        onUpdateWeeklySchedule={handleUpdateWeeklySchedule}
        onToggleStorageItem={handleToggleStorageItem}
        onAppendStepsToPlan={handleAppendStepsToPlan}
      />

      {/* Quick Start Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        language={language}
      />

      {/* Sign In / Register / Password Reset Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        language={language}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(msg) => {
          setStatusBanner(msg);
          setTimeout(() => setStatusBanner(null), 5000);
        }}
      />

      {/* Confirm Delete Design from Before & After Gallery */}
      <ConfirmDialog
        isOpen={Boolean(pendingDeleteGalleryDesignId)}
        title={isBn ? 'ডিজাইন মুছে ফেলবেন?' : 'Delete Saved Design?'}
        description={
          isBn
            ? 'এই আগে ও পরের ডিজাইন জোড়াটি গ্যালারি থেকে স্থায়ীভাবে মুছে ফেলা হবে।'
            : 'This before & after transformation will be permanently removed from your gallery.'
        }
        confirmLabel={isBn ? 'মুছুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        destructive={true}
        onCancel={() => setPendingDeleteGalleryDesignId(null)}
        onConfirm={() => {
          if (pendingDeleteGalleryDesignId) {
            handleDeleteDesign(pendingDeleteGalleryDesignId);
          }
          setPendingDeleteGalleryDesignId(null);
        }}
      />

      {/* Confirm Leaving Unsaved Changes */}
      <ConfirmDialog
        isOpen={Boolean(pendingNavigationSection)}
        title={isBn ? 'অসংরক্ষিত পরিবর্তন রয়েছে' : 'Discard Unsaved Changes?'}
        description={
          isBn
            ? 'এই পাতায় আপনার কিছু অসংরক্ষিত কাজ রয়েছে। অন্য সেকশনে গেলে পরিবর্তনগুলো হারিয়ে যেতে পারে।'
            : 'You have unsaved edits on this screen. Leaving now will discard your current draft.'
        }
        confirmLabel={isBn ? 'তবুও যান' : 'Discard & Leave'}
        cancelLabel={isBn ? 'এখানে থাকুন' : 'Stay Here'}
        destructive={true}
        onCancel={() => setPendingNavigationSection(null)}
        onConfirm={() => {
          const target = pendingNavigationSection;
          setPendingNavigationSection(null);
          if (target) {
            commitSectionNavigation(target);
          }
        }}
      />
    </div>
  );
}
