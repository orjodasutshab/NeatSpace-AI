import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  deleteUser,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  RoomAnalysis,
  ActionStep,
  TriageItem,
  StorageRecommendation,
  RoomType,
  FocusGoal,
  FloorplanZone,
  WeeklyScheduleDay,
  DetectedObjectBox,
  SpaceUtilizationTip,
  ColorDecorSuggestion,
  RedesignStyle,
  StorageInventoryItem,
  CalendarTask,
  SavedRedesign,
  UserPreferences,
  ReminderConfig,
  FamilyMember,
  FamilyActivityEntry,
  CleaningHistoryEntry,
  AppNotification,
  OutputLanguage,
  TaskPriority,
  CleaningDifficulty,
  UserRole,
  AccountStatus,
  PlanTier,
  SubscriptionRecord,
  PrivacySettings,
  BudgetExpense,
  RoomLayoutPlan,
  UsageCounters,
  BillingInvoice,
  FeedbackItem,
  UserReportItem,
  AuditLogEntry,
  SystemConfigSettings,
  AdminUserSummary,
} from './types';
import { DEFAULT_SYSTEM_CONFIG, getCurrentMonthKey } from './planConfig';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmailPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmailPassword(
  displayName: string,
  email: string,
  password: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 120) });
  }
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('Could not send initial verification email:', err);
  }
  return cred.user;
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('Not signed in.');
  return sendEmailVerification(auth.currentUser);
}

export async function signOutUser() {
  return signOut(auth);
}

const VALID_ROOM_TYPES: RoomType[] = [
  'living_room',
  'bedroom',
  'home_office',
  'kitchen',
  'dining_room',
  'closet',
  'bathroom',
  'garage',
  'kids_room',
  'general',
];

const VALID_FOCUS_GOALS: FocusGoal[] = [
  'quick_wins',
  'maximize_space',
  'storage_solutions',
  'aesthetic_reset',
  'deep_declutter',
];

function sanitizeDocId(rawId: string, prefix = 'doc'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `${prefix}_${Date.now()}`;
}

export interface UserWorkspaceCloudDoc {
  displayName?: string;
  photoURL?: string;
  language?: OutputLanguage;
  role?: UserRole;
  status?: AccountStatus;
  planTier?: PlanTier;
  subscription?: SubscriptionRecord;
  privacy?: PrivacySettings;
  preferences?: UserPreferences;
  stats?: {
    points: number;
    streakDays: number;
    focusMinutesTotal: number;
  };
  reminderConfig?: ReminderConfig;
  familyMembers?: FamilyMember[];
  familyLogs?: FamilyActivityEntry[];
  cleaningHistory?: CleaningHistoryEntry[];
  notifications?: AppNotification[];
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Organizer').slice(0, 120);
  const photoURL = (user.photoURL || '').slice(0, 500);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        role: 'user',
        status: 'active',
        planTier: 'free',
        privacy: {
          shareAnonymousUsage: true,
          allowAiPersonalization: true,
          autoSaveAnalyses: true,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveUserWorkspaceToFirestore(
  uid: string,
  updates: UserWorkspaceCloudDoc
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
    payload.displayName = updates.displayName.trim().slice(0, 120);
  }
  if (typeof updates.photoURL === 'string') {
    payload.photoURL = updates.photoURL.slice(0, 500);
  }
  if (updates.language === 'en' || updates.language === 'bn') {
    payload.language = updates.language;
  }
  if (updates.privacy && typeof updates.privacy === 'object') {
    payload.privacy = {
      shareAnonymousUsage: Boolean(updates.privacy.shareAnonymousUsage),
      allowAiPersonalization: Boolean(updates.privacy.allowAiPersonalization),
      autoSaveAnalyses: Boolean(updates.privacy.autoSaveAnalyses),
    };
  }
  if (updates.preferences && typeof updates.preferences === 'object') {
    payload.preferences = {
      preferredStyle: String(updates.preferences.preferredStyle || 'minimalist').slice(0, 40),
      preferredGoal: String(updates.preferences.preferredGoal || 'quick_wins').slice(0, 40),
      dailyBudgetMinutes: Math.max(5, Math.min(180, Math.round(Number(updates.preferences.dailyBudgetMinutes) || 20))),
      homeGoalStatement: String(updates.preferences.homeGoalStatement || '').slice(0, 200),
      theme: updates.preferences.theme === 'dark' ? 'dark' : 'light',
      pushNotifications: Boolean(updates.preferences.pushNotifications),
      deadlineAlerts: Boolean(updates.preferences.deadlineAlerts),
      ...(typeof updates.preferences.roomBudgetTarget === 'number'
        ? { roomBudgetTarget: Math.max(0, Math.min(1000000, Math.round(updates.preferences.roomBudgetTarget))) }
        : {}),
    };
  }
  if (updates.stats && typeof updates.stats === 'object') {
    payload.stats = {
      points: Math.max(0, Math.round(Number(updates.stats.points) || 0)),
      streakDays: Math.max(1, Math.round(Number(updates.stats.streakDays) || 1)),
      focusMinutesTotal: Math.max(0, Math.round(Number(updates.stats.focusMinutesTotal) || 0)),
    };
  }
  if (updates.reminderConfig && typeof updates.reminderConfig === 'object') {
    payload.reminderConfig = {
      enabled: Boolean(updates.reminderConfig.enabled),
      time: String(updates.reminderConfig.time || '19:00').slice(0, 10),
      days: Array.isArray(updates.reminderConfig.days)
        ? updates.reminderConfig.days.slice(0, 7).map(Number)
        : [0, 1, 2, 3, 4, 5, 6],
      frequency: ['daily', 'weekdays', 'weekends'].includes(updates.reminderConfig.frequency)
        ? updates.reminderConfig.frequency
        : 'daily',
      ...(updates.reminderConfig.lastDismissedDate
        ? { lastDismissedDate: String(updates.reminderConfig.lastDismissedDate).slice(0, 20) }
        : {}),
    };
  }
  if (Array.isArray(updates.familyMembers)) {
    payload.familyMembers = updates.familyMembers.slice(0, 20).map((m) => ({
      id: String(m.id || `mem_${Date.now()}`).slice(0, 64),
      name: String(m.name || 'Member').slice(0, 80),
      role: String(m.role || 'Household').slice(0, 80),
      color: String(m.color || '#163D32').slice(0, 20),
      points: Math.max(0, Math.round(Number(m.points) || 0)),
    }));
  }
  if (Array.isArray(updates.familyLogs)) {
    payload.familyLogs = updates.familyLogs.slice(0, 40).map((entry) => ({
      id: String(entry.id || `flog_${Date.now()}`).slice(0, 64),
      memberName: String(entry.memberName || 'Member').slice(0, 80),
      action: String(entry.action || '').slice(0, 180),
      roomName: String(entry.roomName || '').slice(0, 120),
      timestamp: Number(entry.timestamp) || Date.now(),
    }));
  }
  if (Array.isArray(updates.cleaningHistory)) {
    payload.cleaningHistory = updates.cleaningHistory.slice(0, 80).map((h) => ({
      id: String(h.id || `hist_${Date.now()}`).slice(0, 64),
      roomName: String(h.roomName || 'Room').slice(0, 120),
      roomType: String(h.roomType || 'general').slice(0, 40),
      action: String(h.action || '').slice(0, 200),
      pointsEarned: Math.max(0, Math.round(Number(h.pointsEarned) || 0)),
      minutes: Math.max(0, Math.round(Number(h.minutes) || 0)),
      timestamp: Number(h.timestamp) || Date.now(),
    }));
  }
  if (Array.isArray(updates.notifications)) {
    payload.notifications = updates.notifications.slice(0, 30).map((n) => ({
      id: String(n.id || `notif_${Date.now()}`).slice(0, 64),
      category: String(n.category || 'reminder').slice(0, 30),
      title: String(n.title || '').slice(0, 120),
      body: String(n.body || '').slice(0, 280),
      timestamp: Number(n.timestamp) || Date.now(),
      read: Boolean(n.read),
      ...(n.targetSection ? { targetSection: String(n.targetSection).slice(0, 30) } : {}),
    }));
  }

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeToUserProfile(
  uid: string,
  onProfile: (profile: UserWorkspaceCloudDoc) => void,
  onError: (err: Error) => void
) {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  return onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      onProfile({
        displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
        photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
        language: d.language === 'bn' ? 'bn' : d.language === 'en' ? 'en' : undefined,
        role: d.role === 'admin' ? 'admin' : 'user',
        status: d.status === 'suspended' ? 'suspended' : 'active',
        planTier: ['free', 'pro', 'premium'].includes(d.planTier) ? (d.planTier as PlanTier) : 'free',
        subscription:
          d.subscription && typeof d.subscription === 'object'
            ? (d.subscription as SubscriptionRecord)
            : undefined,
        privacy:
          d.privacy && typeof d.privacy === 'object' ? (d.privacy as PrivacySettings) : undefined,
        preferences: d.preferences && typeof d.preferences === 'object' ? (d.preferences as UserPreferences) : undefined,
        stats:
          d.stats && typeof d.stats === 'object'
            ? {
                points: Number(d.stats.points ?? 0),
                streakDays: Number(d.stats.streakDays ?? 1),
                focusMinutesTotal: Number(d.stats.focusMinutesTotal ?? 0),
              }
            : undefined,
        reminderConfig:
          d.reminderConfig && typeof d.reminderConfig === 'object'
            ? (d.reminderConfig as ReminderConfig)
            : undefined,
        familyMembers: Array.isArray(d.familyMembers) ? (d.familyMembers as FamilyMember[]) : undefined,
        familyLogs: Array.isArray(d.familyLogs) ? (d.familyLogs as FamilyActivityEntry[]) : undefined,
        cleaningHistory: Array.isArray(d.cleaningHistory)
          ? (d.cleaningHistory as CleaningHistoryEntry[])
          : undefined,
        notifications: Array.isArray(d.notifications) ? (d.notifications as AppNotification[]) : undefined,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, userPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

function sanitizeActionSteps(steps: ActionStep[]) {
  return steps.slice(0, 25).map((step, idx) => ({
    stepNumber: Number(step.stepNumber) || idx + 1,
    title: String(step.title || '').slice(0, 160),
    category: (['Purge', 'Sort', 'Organize', 'Store'].includes(step.category)
      ? step.category
      : 'Organize') as ActionStep['category'],
    priority: (['high', 'medium', 'low'].includes(step.priority || '')
      ? step.priority
      : 'medium') as TaskPriority,
    timeEstimate: String(step.timeEstimate || '10 mins').slice(0, 40),
    instructions: String(step.instructions || '').slice(0, 600),
    tips: String(step.tips || '').slice(0, 300),
    completed: Boolean(step.completed),
  }));
}

export function sanitizeRoomPayload(uid: string, room: RoomAnalysis) {
  const safeId = sanitizeDocId(room.id, 'room');
  const safeRoomType = VALID_ROOM_TYPES.includes(room.roomType) ? room.roomType : 'general';
  const safeFocusGoal = VALID_FOCUS_GOALS.includes(room.focusGoal) ? room.focusGoal : 'quick_wins';
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(room.clutterScore) || 0)));

  return {
    id: safeId,
    userId: uid,
    roomName: (room.roomName || 'Analyzed Room').slice(0, 200),
    roomType: safeRoomType,
    focusGoal: safeFocusGoal,
    imageUrl: (room.imageUrl || '').slice(0, 250000),
    clutterScore: safeScore,
    ...(room.cleaningDifficulty && ['Easy', 'Moderate', 'Intensive'].includes(room.cleaningDifficulty)
      ? { cleaningDifficulty: room.cleaningDifficulty }
      : {}),
    ...(typeof room.estimatedCleaningMinutes === 'number'
      ? {
          estimatedCleaningMinutes: Math.max(
            1,
            Math.min(600, Math.round(room.estimatedCleaningMinutes))
          ),
        }
      : {}),
    ...(typeof room.furnitureAnalysis === 'string' && room.furnitureAnalysis.length > 0
      ? { furnitureAnalysis: room.furnitureAnalysis.slice(0, 1500) }
      : {}),
