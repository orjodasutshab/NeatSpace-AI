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
    overallAssessment: (room.overallAssessment || '').slice(0, 2000),
    detectedItems: (room.detectedItems || []).slice(0, 30).map((s) => String(s).slice(0, 120)),
    quickWins: (room.quickWins || []).slice(0, 15).map((s) => String(s).slice(0, 300)),
    problemAreas: (room.problemAreas || []).slice(0, 15).map((p, idx) => ({
      id: String(p.id || `area_${idx + 1}`).slice(0, 64),
      title: String(p.title || '').slice(0, 150),
      description: String(p.description || '').slice(0, 500),
      severity: (['low', 'medium', 'high'].includes(p.severity) ? p.severity : 'medium') as 'low' | 'medium' | 'high',
      recommendation: String(p.recommendation || '').slice(0, 500),
    })),
    actionPlan: sanitizeActionSteps(room.actionPlan || []),
    storageRecommendations: (room.storageRecommendations || []).slice(0, 15).map((item) => ({
      category: String(item.category || 'Storage').slice(0, 60),
      itemTitle: String(item.itemTitle || '').slice(0, 150),
      purpose: String(item.purpose || '').slice(0, 300),
      suggestedLocation: String(item.suggestedLocation || '').slice(0, 200),
      estimatedBudget: String(item.estimatedBudget || '$10-$20').slice(0, 40),
      acquired: Boolean(item.acquired),
    })),
    layoutAdvice: (room.layoutAdvice || '').slice(0, 3000),
    minimalistTip: (room.minimalistTip || '').slice(0, 1000),
    ...(Array.isArray(room.triageItems)
      ? {
          triageItems: room.triageItems.slice(0, 30).map((t, idx) => ({
            id: String(t.id || `triage_${idx + 1}`).slice(0, 64),
            item: String(t.item || '').slice(0, 140),
            decision: (['keep', 'donate', 'trash', 'relocate'].includes(t.decision)
              ? t.decision
              : 'relocate') as TriageItem['decision'],
            reason: String(t.reason || '').slice(0, 300),
            sorted: Boolean(t.sorted),
          })),
        }
      : {}),
    ...(Array.isArray(room.maintenanceHabits)
      ? {
          maintenanceHabits: room.maintenanceHabits.slice(0, 10).map((h) => String(h).slice(0, 240)),
        }
      : {}),
    ...(typeof room.userNotes === 'string' && room.userNotes.length > 0
      ? { userNotes: room.userNotes.slice(0, 1500) }
      : {}),
    ...(Array.isArray(room.floorplanZones)
      ? {
          floorplanZones: room.floorplanZones.slice(0, 20).map((z, idx) => ({
            id: String(z.id || `zone_${idx + 1}`).slice(0, 64),
            label: String(z.label || 'Zone').slice(0, 60),
            kind: (['desk', 'bed', 'storage', 'seating', 'pathway', 'dropzone'].includes(z.kind)
              ? z.kind
              : 'storage') as FloorplanZone['kind'],
            x: Math.max(0, Math.min(11, Math.round(Number(z.x) || 0))),
            y: Math.max(0, Math.min(7, Math.round(Number(z.y) || 0))),
            w: Math.max(1, Math.min(6, Math.round(Number(z.w) || 2))),
            h: Math.max(1, Math.min(6, Math.round(Number(z.h) || 2))),
          })),
        }
      : {}),
    ...(Array.isArray(room.weeklySchedule)
      ? {
          weeklySchedule: room.weeklySchedule.slice(0, 7).map((d, idx) => ({
            day: String(d.day || `Day ${idx + 1}`).slice(0, 40),
            focus: String(d.focus || 'Reset').slice(0, 120),
            tasks: Array.isArray(d.tasks) ? d.tasks.slice(0, 5).map((t) => String(t).slice(0, 220)) : [],
            durationMinutes: Math.max(5, Math.min(180, Math.round(Number(d.durationMinutes) || 15))),
            completed: Boolean(d.completed),
          })),
        }
      : {}),
    ...(room.afterImageUrl ? { afterImageUrl: room.afterImageUrl.slice(0, 250000) } : {}),
    ...(typeof room.afterClutterScore === 'number'
      ? { afterClutterScore: Math.max(0, Math.min(100, Math.round(room.afterClutterScore))) }
      : {}),
    ...(room.afterSummary ? { afterSummary: room.afterSummary.slice(0, 1000) } : {}),
    ...(Array.isArray(room.detectedObjects)
      ? {
          detectedObjects: room.detectedObjects.slice(0, 12).map((obj, idx) => ({
            id: String(obj.id || `obj_${idx + 1}`).slice(0, 60),
            label: String(obj.label || '').slice(0, 80),
            category: String(obj.category || 'Item').slice(0, 50),
            box2d: Array.isArray(obj.box2d) ? obj.box2d.slice(0, 4).map(Number) : [100, 100, 400, 400],
            clutterImpact: (['high', 'medium', 'low'].includes(obj.clutterImpact)
              ? obj.clutterImpact
              : 'medium') as DetectedObjectBox['clutterImpact'],
            recommendedAction: (['keep', 'donate', 'recycle', 'relocate'].includes(obj.recommendedAction)
              ? obj.recommendedAction
              : 'relocate') as DetectedObjectBox['recommendedAction'],
            estimatedValue: String(obj.estimatedValue || '').slice(0, 40),
          })),
        }
      : {}),
    ...(Array.isArray(room.spaceUtilization)
      ? {
          spaceUtilization: room.spaceUtilization.slice(0, 8).map((tip) => ({
            zone: String(tip.zone || '').slice(0, 80),
            suggestion: String(tip.suggestion || '').slice(0, 320),
            spaceGainEstimate: String(tip.spaceGainEstimate || '').slice(0, 60),
            difficulty: (tip.difficulty === 'Moderate' ? 'Moderate' : 'Easy') as SpaceUtilizationTip['difficulty'],
          })),
        }
      : {}),
    ...(room.colorDecor
      ? {
          colorDecor: {
            wallColors: (room.colorDecor.wallColors || []).slice(0, 4).map((c) => ({
              name: String(c.name || '').slice(0, 50),
              hex: String(c.hex || '#DDF3E5').slice(0, 12),
              reason: String(c.reason || '').slice(0, 180),
            })),
            curtainSuggestion: String(room.colorDecor.curtainSuggestion || '').slice(0, 350),
            furniturePalette: (room.colorDecor.furniturePalette || []).slice(0, 4).map((c) => ({
              name: String(c.name || '').slice(0, 50),
              hex: String(c.hex || '#163D32').slice(0, 12),
            })),
            decorTips: (room.colorDecor.decorTips || []).slice(0, 5).map((t) => String(t).slice(0, 200)),
          },
        }
      : {}),
    ...(Array.isArray(room.recyclingTips)
      ? { recyclingTips: room.recyclingTips.slice(0, 6).map((t) => String(t).slice(0, 240)) }
      : {}),
    ...(room.redesignPreviewUrl ? { redesignPreviewUrl: room.redesignPreviewUrl.slice(0, 250000) } : {}),
    ...(room.redesignStyle ? { redesignStyle: String(room.redesignStyle).slice(0, 40) } : {}),
    ...(room.redesignSummary ? { redesignSummary: String(room.redesignSummary).slice(0, 600) } : {}),
    ...(room.assignedMemberId ? { assignedMemberId: String(room.assignedMemberId).slice(0, 64) } : {}),
  };
}

export async function saveRoomToFirestore(uid: string, room: RoomAnalysis): Promise<string> {
  const payload = sanitizeRoomPayload(uid, room);
  const roomPath = `users/${uid}/rooms/${payload.id}`;
  const roomRef = doc(db, 'users', uid, 'rooms', payload.id);

  try {
    const existingSnap = await getDoc(roomRef);
    if (existingSnap.exists()) {
      await updateDoc(roomRef, {
        actionPlan: payload.actionPlan,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(roomRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return payload.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, roomPath);
  }
}

export async function updateRoomProgressInFirestore(
  uid: string,
  roomId: string,
  updates: {
    actionPlan?: ActionStep[];
    triageItems?: TriageItem[];
    storageRecommendations?: StorageRecommendation[];
    userNotes?: string;
    floorplanZones?: FloorplanZone[];
    weeklySchedule?: WeeklyScheduleDay[];
    redesignPreviewUrl?: string;
    redesignStyle?: RedesignStyle;
    redesignSummary?: string;
    assignedMemberId?: string;
  }
): Promise<void> {
  const safeId = sanitizeDocId(roomId, 'room');
  const roomPath = `users/${uid}/rooms/${safeId}`;
  const roomRef = doc(db, 'users', uid, 'rooms', safeId);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.actionPlan) {
    payload.actionPlan = sanitizeActionSteps(updates.actionPlan);
  }
  if (updates.triageItems) {
    payload.triageItems = updates.triageItems.slice(0, 30).map((t, idx) => ({
      id: String(t.id || `triage_${idx + 1}`).slice(0, 64),
      item: String(t.item || '').slice(0, 140),
      decision: (['keep', 'donate', 'trash', 'relocate'].includes(t.decision)
        ? t.decision
        : 'relocate') as TriageItem['decision'],
      reason: String(t.reason || '').slice(0, 300),
      sorted: Boolean(t.sorted),
    }));
  }
  if (updates.storageRecommendations) {
    payload.storageRecommendations = updates.storageRecommendations.slice(0, 15).map((item) => ({
      category: String(item.category || 'Storage').slice(0, 60),
      itemTitle: String(item.itemTitle || '').slice(0, 150),
      purpose: String(item.purpose || '').slice(0, 300),
      suggestedLocation: String(item.suggestedLocation || '').slice(0, 200),
      estimatedBudget: String(item.estimatedBudget || '$10-$20').slice(0, 40),
      acquired: Boolean(item.acquired),
    }));
  }
  if (typeof updates.userNotes === 'string') {
    payload.userNotes = updates.userNotes.slice(0, 1500);
  }
  if (updates.floorplanZones) {
    payload.floorplanZones = updates.floorplanZones.slice(0, 20).map((z, idx) => ({
      id: String(z.id || `zone_${idx + 1}`).slice(0, 64),
      label: String(z.label || 'Zone').slice(0, 60),
      kind: (['desk', 'bed', 'storage', 'seating', 'pathway', 'dropzone'].includes(z.kind)
        ? z.kind
        : 'storage') as FloorplanZone['kind'],
      x: Math.max(0, Math.min(11, Math.round(Number(z.x) || 0))),
      y: Math.max(0, Math.min(7, Math.round(Number(z.y) || 0))),
      w: Math.max(1, Math.min(6, Math.round(Number(z.w) || 2))),
      h: Math.max(1, Math.min(6, Math.round(Number(z.h) || 2))),
    }));
  }
  if (updates.weeklySchedule) {
    payload.weeklySchedule = updates.weeklySchedule.slice(0, 7).map((d, idx) => ({
      day: String(d.day || `Day ${idx + 1}`).slice(0, 40),
      focus: String(d.focus || 'Reset').slice(0, 120),
      tasks: Array.isArray(d.tasks) ? d.tasks.slice(0, 5).map((t) => String(t).slice(0, 220)) : [],
      durationMinutes: Math.max(5, Math.min(180, Math.round(Number(d.durationMinutes) || 15))),
      completed: Boolean(d.completed),
    }));
  }
  if (typeof updates.redesignPreviewUrl === 'string') {
    payload.redesignPreviewUrl = updates.redesignPreviewUrl.slice(0, 250000);
  }
  if (typeof updates.redesignStyle === 'string') {
    payload.redesignStyle = updates.redesignStyle.slice(0, 40);
  }
  if (typeof updates.redesignSummary === 'string') {
    payload.redesignSummary = updates.redesignSummary.slice(0, 600);
  }
  if (typeof updates.assignedMemberId === 'string') {
    payload.assignedMemberId = updates.assignedMemberId.slice(0, 64);
  }

  try {
    await updateDoc(roomRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

export async function updateRoomAfterComparisonInFirestore(
  uid: string,
  roomId: string,
  actionPlan: ActionStep[],
  afterImageUrl: string,
  afterClutterScore: number,
  afterSummary: string
): Promise<void> {
  const safeId = sanitizeDocId(roomId, 'room');
  const roomPath = `users/${uid}/rooms/${safeId}`;
  const roomRef = doc(db, 'users', uid, 'rooms', safeId);

  try {
    await updateDoc(roomRef, {
      actionPlan: sanitizeActionSteps(actionPlan),
      afterImageUrl: afterImageUrl.slice(0, 250000),
      afterClutterScore: Math.max(0, Math.min(100, Math.round(afterClutterScore))),
      afterSummary: afterSummary.slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

export async function deleteRoomFromFirestore(uid: string, roomId: string): Promise<void> {
  const safeId = sanitizeDocId(roomId, 'room');
  const roomPath = `users/${uid}/rooms/${safeId}`;
  const roomRef = doc(db, 'users', uid, 'rooms', safeId);

  try {
    await deleteDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, roomPath);
  }
}

export function subscribeToUserRooms(
  uid: string,
  onRooms: (rooms: RoomAnalysis[]) => void,
  onError: (err: Error) => void
) {
  const roomsPath = `users/${uid}/rooms`;
  const roomsQuery = query(collection(db, 'users', uid, 'rooms'), where('userId', '==', uid));

  return onSnapshot(
    roomsQuery,
    (snapshot) => {
      const items: RoomAnalysis[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdAt = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        return {
          id: String(d.id || docSnap.id),
          timestamp: createdAt,
          roomName: String(d.roomName || 'Saved Room'),
          roomType: (d.roomType || 'general') as RoomType,
          focusGoal: (d.focusGoal || 'quick_wins') as FocusGoal,
          imageUrl: String(d.imageUrl || ''),
          clutterScore: Number(d.clutterScore ?? 0),
          ...(typeof d.cleaningDifficulty === 'string'
            ? { cleaningDifficulty: d.cleaningDifficulty as CleaningDifficulty }
            : {}),
          ...(typeof d.estimatedCleaningMinutes === 'number'
            ? { estimatedCleaningMinutes: d.estimatedCleaningMinutes }
            : {}),
          ...(typeof d.furnitureAnalysis === 'string'
            ? { furnitureAnalysis: d.furnitureAnalysis }
            : {}),
          overallAssessment: String(d.overallAssessment || ''),
          detectedItems: Array.isArray(d.detectedItems) ? d.detectedItems : [],
          quickWins: Array.isArray(d.quickWins) ? d.quickWins : [],
          problemAreas: Array.isArray(d.problemAreas) ? d.problemAreas : [],
          actionPlan: Array.isArray(d.actionPlan) ? d.actionPlan : [],
          storageRecommendations: Array.isArray(d.storageRecommendations) ? d.storageRecommendations : [],
          layoutAdvice: String(d.layoutAdvice || ''),
          minimalistTip: String(d.minimalistTip || ''),
          ...(Array.isArray(d.triageItems) ? { triageItems: d.triageItems } : {}),
          ...(Array.isArray(d.maintenanceHabits) ? { maintenanceHabits: d.maintenanceHabits } : {}),
          ...(typeof d.userNotes === 'string' ? { userNotes: d.userNotes } : {}),
          ...(Array.isArray(d.floorplanZones) ? { floorplanZones: d.floorplanZones } : {}),
          ...(Array.isArray(d.weeklySchedule) ? { weeklySchedule: d.weeklySchedule } : {}),
          ...(typeof d.afterImageUrl === 'string' ? { afterImageUrl: d.afterImageUrl } : {}),
          ...(typeof d.afterClutterScore === 'number' ? { afterClutterScore: d.afterClutterScore } : {}),
          ...(typeof d.afterSummary === 'string' ? { afterSummary: d.afterSummary } : {}),
          ...(Array.isArray(d.detectedObjects) ? { detectedObjects: d.detectedObjects } : {}),
          ...(Array.isArray(d.spaceUtilization) ? { spaceUtilization: d.spaceUtilization } : {}),
          ...(d.colorDecor && typeof d.colorDecor === 'object'
            ? { colorDecor: d.colorDecor as ColorDecorSuggestion }
            : {}),
          ...(Array.isArray(d.recyclingTips) ? { recyclingTips: d.recyclingTips } : {}),
          ...(typeof d.redesignPreviewUrl === 'string' ? { redesignPreviewUrl: d.redesignPreviewUrl } : {}),
          ...(typeof d.redesignStyle === 'string' ? { redesignStyle: d.redesignStyle as RedesignStyle } : {}),
          ...(typeof d.redesignSummary === 'string' ? { redesignSummary: d.redesignSummary } : {}),
          ...(typeof d.assignedMemberId === 'string' ? { assignedMemberId: d.assignedMemberId } : {}),
        };
      });
      items.sort((a, b) => b.timestamp - a.timestamp);
      onRooms(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, roomsPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// STORAGE INVENTORY FIRESTORE CRUD & SUBSCRIPTION
// -----------------------------------------------------------------------------
export async function saveInventoryItemToFirestore(
  uid: string,
  item: StorageInventoryItem
): Promise<void> {
  const safeId = sanitizeDocId(item.id, 'inv');
  const itemPath = `users/${uid}/inventory/${safeId}`;
  const itemRef = doc(db, 'users', uid, 'inventory', safeId);

  const payload = {
    id: safeId,
    userId: uid,
    itemName: String(item.itemName || 'Stored Item').slice(0, 160),
    location: String(item.location || 'Shelf').slice(0, 160),
    roomName: String(item.roomName || 'General').slice(0, 120),
    category: String(item.category || 'Other').slice(0, 60),
    quantity: Math.max(1, Math.min(9999, Math.round(Number(item.quantity) || 1))),
    usageFrequency: ['frequent', 'occasional', 'unused'].includes(item.usageFrequency || '')
      ? item.usageFrequency
      : 'frequent',
    ...(typeof item.photoUrl === 'string' && item.photoUrl.length > 0
      ? { photoUrl: item.photoUrl.slice(0, 180000) }
      : {}),
    ...(typeof item.notes === 'string' && item.notes.length > 0
      ? { notes: item.notes.slice(0, 400) }
      : {}),
  };

  try {
    const existingSnap = await getDoc(itemRef);
    if (existingSnap.exists()) {
      await updateDoc(itemRef, {
        itemName: payload.itemName,
        location: payload.location,
        roomName: payload.roomName,
        category: payload.category,
        quantity: payload.quantity,
        usageFrequency: payload.usageFrequency,
        ...(payload.photoUrl ? { photoUrl: payload.photoUrl } : {}),
        ...(payload.notes ? { notes: payload.notes } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(itemRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, itemPath);
  }
}

export async function deleteInventoryItemFromFirestore(uid: string, itemId: string): Promise<void> {
  const safeId = sanitizeDocId(itemId, 'inv');
  const itemPath = `users/${uid}/inventory/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'inventory', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, itemPath);
  }
}

export function subscribeToInventory(
  uid: string,
  onItems: (items: StorageInventoryItem[]) => void,
  onError: (err: Error) => void
) {
  const invPath = `users/${uid}/inventory`;
  const invQuery = query(collection(db, 'users', uid, 'inventory'), where('userId', '==', uid));

  return onSnapshot(
    invQuery,
    (snap) => {
      const items: StorageInventoryItem[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const updatedAt = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now();
        return {
          id: String(d.id || docSnap.id),
          itemName: String(d.itemName || ''),
          location: String(d.location || ''),
          roomName: String(d.roomName || ''),
          category: String(d.category || 'Other'),
          quantity: Number(d.quantity ?? 1),
          usageFrequency: (d.usageFrequency || 'frequent') as StorageInventoryItem['usageFrequency'],
          ...(typeof d.photoUrl === 'string' ? { photoUrl: d.photoUrl } : {}),
          ...(typeof d.notes === 'string' ? { notes: d.notes } : {}),
          updatedAt,
        };
      });
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      onItems(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, invPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// CALENDAR TASKS FIRESTORE CRUD & SUBSCRIPTION
// -----------------------------------------------------------------------------
export async function saveCalendarTaskToFirestore(uid: string, task: CalendarTask): Promise<void> {
  const safeId = sanitizeDocId(task.id, 'cal');
  const taskPath = `users/${uid}/calendarTasks/${safeId}`;
  const taskRef = doc(db, 'users', uid, 'calendarTasks', safeId);

  const payload = {
    id: safeId,
    userId: uid,
    dateIso: /^\d{4}-\d{2}-\d{2}$/.test(task.dateIso)
      ? task.dateIso
      : new Date().toISOString().slice(0, 10),
    title: String(task.title || 'Cleaning Task').slice(0, 200),
    roomName: String(task.roomName || 'Home').slice(0, 120),
    minutes: Math.max(1, Math.min(480, Math.round(Number(task.minutes) || 15))),
    priority: (['high', 'medium', 'low'].includes(task.priority || '')
      ? task.priority
      : 'medium') as TaskPriority,
    ...(typeof task.deadlineTime === 'string' && task.deadlineTime.length > 0
      ? { deadlineTime: task.deadlineTime.slice(0, 16) }
      : {}),
    completed: Boolean(task.completed),
  };

  try {
    const existingSnap = await getDoc(taskRef);
    if (existingSnap.exists()) {
      await updateDoc(taskRef, {
        dateIso: payload.dateIso,
        title: payload.title,
        roomName: payload.roomName,
        minutes: payload.minutes,
        priority: payload.priority,
        ...(payload.deadlineTime ? { deadlineTime: payload.deadlineTime } : {}),
        completed: payload.completed,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(taskRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, taskPath);
  }
}

export async function deleteCalendarTaskFromFirestore(uid: string, taskId: string): Promise<void> {
  const safeId = sanitizeDocId(taskId, 'cal');
  const taskPath = `users/${uid}/calendarTasks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'calendarTasks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, taskPath);
  }
}

export function subscribeToCalendarTasks(
  uid: string,
  onTasks: (tasks: CalendarTask[]) => void,
  onError: (err: Error) => void
) {
  const tasksPath = `users/${uid}/calendarTasks`;
  const tasksQuery = query(collection(db, 'users', uid, 'calendarTasks'), where('userId', '==', uid));

  return onSnapshot(
    tasksQuery,
    (snap) => {
      const items: CalendarTask[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          dateIso: String(d.dateIso || new Date().toISOString().slice(0, 10)),
          title: String(d.title || ''),
          roomName: String(d.roomName || 'Home'),
          minutes: Number(d.minutes ?? 15),
          priority: (d.priority || 'medium') as TaskPriority,
          ...(typeof d.deadlineTime === 'string' ? { deadlineTime: d.deadlineTime } : {}),
          completed: Boolean(d.completed),
        };
      });
      items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      onTasks(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, tasksPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// SAVED REDESIGN GALLERY FIRESTORE CRUD & SUBSCRIPTION
// -----------------------------------------------------------------------------
export async function saveDesignToFirestore(uid: string, design: SavedRedesign): Promise<void> {
  const safeId = sanitizeDocId(design.id, 'design');
  const designPath = `users/${uid}/savedDesigns/${safeId}`;
  const designRef = doc(db, 'users', uid, 'savedDesigns', safeId);

  const payload = {
    id: safeId,
    userId: uid,
    roomName: String(design.roomName || 'Redesigned Room').slice(0, 200),
    roomType: VALID_ROOM_TYPES.includes(design.roomType) ? design.roomType : 'general',
    style: String(design.style || 'minimalist').slice(0, 40),
    budgetTier: String(design.budgetTier || 'moderate').slice(0, 40),
    furniturePref: String(design.furniturePref || 'keep_existing').slice(0, 40),
    ...(design.wallColor ? { wallColor: String(design.wallColor).slice(0, 120) } : {}),
    beforeImageUrl: String(design.beforeImageUrl || '').slice(0, 250000),
    afterImageUrl: String(design.afterImageUrl || '').slice(0, 250000),
    summary: String(design.summary || '').slice(0, 600),
  };

  try {
    const existingSnap = await getDoc(designRef);
    if (existingSnap.exists()) {
      await updateDoc(designRef, {
        roomName: payload.roomName,
        ...(payload.wallColor ? { wallColor: payload.wallColor } : {}),
        summary: payload.summary,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(designRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, designPath);
  }
}

export async function deleteDesignFromFirestore(uid: string, designId: string): Promise<void> {
  const safeId = sanitizeDocId(designId, 'design');
  const designPath = `users/${uid}/savedDesigns/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savedDesigns', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, designPath);
  }
}

export function subscribeToSavedDesigns(
  uid: string,
  onDesigns: (designs: SavedRedesign[]) => void,
  onError: (err: Error) => void
) {
  const designsPath = `users/${uid}/savedDesigns`;
  const designsQuery = query(
    collection(db, 'users', uid, 'savedDesigns'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    designsQuery,
    (snap) => {
      const items: SavedRedesign[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdAt = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        return {
          id: String(d.id || docSnap.id),
          roomName: String(d.roomName || 'Saved Redesign'),
          roomType: (d.roomType || 'general') as RoomType,
          style: (d.style || 'minimalist') as RedesignStyle,
          budgetTier: (d.budgetTier || 'moderate') as SavedRedesign['budgetTier'],
          furniturePref: (d.furniturePref || 'keep_existing') as SavedRedesign['furniturePref'],
          ...(typeof d.wallColor === 'string' ? { wallColor: d.wallColor } : {}),
          beforeImageUrl: String(d.beforeImageUrl || ''),
          afterImageUrl: String(d.afterImageUrl || ''),
          summary: String(d.summary || ''),
          createdAt,
        };
      });
      items.sort((a, b) => b.createdAt - a.createdAt);
      onDesigns(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, designsPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// BUDGET EXPENSES FIRESTORE CRUD & SUBSCRIPTION (PHASE 9)
// -----------------------------------------------------------------------------
export async function saveBudgetExpenseToFirestore(
  uid: string,
  item: BudgetExpense
): Promise<void> {
  const safeId = sanitizeDocId(item.id, 'exp');
  const path = `users/${uid}/budgetItems/${safeId}`;
  const ref = doc(db, 'users', uid, 'budgetItems', safeId);

  const validCats = ['Storage', 'Furniture', 'Decor', 'Lighting', 'DIY', 'Cleaning'];
  const payload = {
    id: safeId,
    userId: uid,
    roomName: String(item.roomName || 'Home').slice(0, 120),
    title: String(item.title || 'Storage Item').slice(0, 180),
    category: validCats.includes(item.category) ? item.category : 'Storage',
    estimatedCost: Math.max(0, Math.min(1000000, Number(item.estimatedCost) || 0)),
    actualCost: Math.max(0, Math.min(1000000, Number(item.actualCost) || 0)),
    purchased: Boolean(item.purchased),
    ...(item.notes ? { notes: String(item.notes).slice(0, 300) } : {}),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        roomName: payload.roomName,
        title: payload.title,
        category: payload.category,
        estimatedCost: payload.estimatedCost,
        actualCost: payload.actualCost,
        purchased: payload.purchased,
        ...(payload.notes ? { notes: payload.notes } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBudgetExpenseFromFirestore(uid: string, itemId: string): Promise<void> {
  const safeId = sanitizeDocId(itemId, 'exp');
  const path = `users/${uid}/budgetItems/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'budgetItems', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToBudgetExpenses(
  uid: string,
  onItems: (items: BudgetExpense[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/budgetItems`;
  const q = query(collection(db, 'users', uid, 'budgetItems'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list: BudgetExpense[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        const createdAt = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        return {
          id: String(d.id || dSnap.id),
          roomName: String(d.roomName || 'Home'),
          title: String(d.title || ''),
          category: (d.category || 'Storage') as BudgetExpense['category'],
          estimatedCost: Number(d.estimatedCost ?? 0),
          actualCost: Number(d.actualCost ?? 0),
          purchased: Boolean(d.purchased),
          ...(typeof d.notes === 'string' ? { notes: d.notes } : {}),
          createdAt,
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onItems(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// ROOM LAYOUT PLANS FIRESTORE CRUD & SUBSCRIPTION (PHASE 10)
// -----------------------------------------------------------------------------
export async function saveRoomLayoutToFirestore(
  uid: string,
  layout: RoomLayoutPlan
): Promise<void> {
  const safeId = sanitizeDocId(layout.id, 'layout');
  const path = `users/${uid}/roomLayouts/${safeId}`;
  const ref = doc(db, 'users', uid, 'roomLayouts', safeId);

  const payload = {
    id: safeId,
    userId: uid,
    name: String(layout.name || 'Room Layout').slice(0, 160),
    roomType: VALID_ROOM_TYPES.includes(layout.roomType) ? layout.roomType : 'general',
    unit: layout.unit === 'm' ? 'm' : 'ft',
    width: Math.max(3, Math.min(200, Number(layout.width) || 12)),
    length: Math.max(3, Math.min(200, Number(layout.length) || 10)),
    ceilingHeight: Math.max(2, Math.min(30, Number(layout.ceilingHeight) || 9)),
    openings: Array.isArray(layout.openings) ? layout.openings.slice(0, 20) : [],
    furniture: Array.isArray(layout.furniture) ? layout.furniture.slice(0, 40) : [],
    ...(layout.aiSummary ? { aiSummary: String(layout.aiSummary).slice(0, 800) } : {}),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        name: payload.name,
        roomType: payload.roomType,
        unit: payload.unit,
        width: payload.width,
        length: payload.length,
        ceilingHeight: payload.ceilingHeight,
        openings: payload.openings,
        furniture: payload.furniture,
        ...(payload.aiSummary ? { aiSummary: payload.aiSummary } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRoomLayoutFromFirestore(uid: string, layoutId: string): Promise<void> {
  const safeId = sanitizeDocId(layoutId, 'layout');
  const path = `users/${uid}/roomLayouts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'roomLayouts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToRoomLayouts(
  uid: string,
  onLayouts: (layouts: RoomLayoutPlan[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/roomLayouts`;
  const q = query(collection(db, 'users', uid, 'roomLayouts'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list: RoomLayoutPlan[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        const updatedAt = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now();
        return {
          id: String(d.id || dSnap.id),
          name: String(d.name || 'Room Layout'),
          roomType: (d.roomType || 'general') as RoomType,
          unit: d.unit === 'm' ? 'm' : 'ft',
          width: Number(d.width ?? 12),
          length: Number(d.length ?? 10),
          ceilingHeight: Number(d.ceilingHeight ?? 9),
          openings: Array.isArray(d.openings) ? d.openings : [],
          furniture: Array.isArray(d.furniture) ? d.furniture : [],
          ...(typeof d.aiSummary === 'string' ? { aiSummary: d.aiSummary } : {}),
          updatedAt,
        };
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onLayouts(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}

// -----------------------------------------------------------------------------
// USAGE QUOTA & BILLING SUBSCRIPTIONS (PHASE 8)
// -----------------------------------------------------------------------------
export function subscribeToMonthlyUsage(
  uid: string,
  onUsage: (usage: UsageCounters) => void
) {
  const monthKey = getCurrentMonthKey();
  const ref = doc(db, 'users', uid, 'usage', monthKey);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUsage({
          monthKey,
          roomAnalyses: 0,
          aiRedesigns: 0,
          aiCoachMessages: 0,
          shoppingQueries: 0,
          layoutSuggestions: 0,
          updatedAt: Date.now(),
        });
        return;
      }
      const d = snap.data();
      onUsage({
        monthKey: String(d.monthKey || monthKey),
        roomAnalyses: Number(d.roomAnalyses ?? 0),
        aiRedesigns: Number(d.aiRedesigns ?? 0),
        aiCoachMessages: Number(d.aiCoachMessages ?? 0),
        shoppingQueries: Number(d.shoppingQueries ?? 0),
        layoutSuggestions: Number(d.layoutSuggestions ?? 0),
        updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
      });
    },
    (err) => console.error('Usage subscription error:', err)
  );
}

export async function incrementMonthlyUsageInFirestore(
  uid: string,
  field: keyof Omit<UsageCounters, 'monthKey' | 'updatedAt'>
): Promise<void> {
  const monthKey = getCurrentMonthKey();
  const path = `users/${uid}/usage/${monthKey}`;
  const ref = doc(db, 'users', uid, 'usage', monthKey);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initial = {
        monthKey,
        userId: uid,
        roomAnalyses: field === 'roomAnalyses' ? 1 : 0,
        aiRedesigns: field === 'aiRedesigns' ? 1 : 0,
        aiCoachMessages: field === 'aiCoachMessages' ? 1 : 0,
        shoppingQueries: field === 'shoppingQueries' ? 1 : 0,
        layoutSuggestions: field === 'layoutSuggestions' ? 1 : 0,
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, initial);
    } else {
      const current = Number(snap.data()[field] ?? 0);
      await updateDoc(ref, {
        [field]: current + 1,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Usage increment error at', path, error);
  }
}

export function subscribeToBillingHistory(
  uid: string,
  onInvoices: (invoices: BillingInvoice[]) => void
) {
  const q = query(collection(db, 'users', uid, 'billing'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: BillingInvoice[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          userId: String(d.userId || uid),
          amountCents: Number(d.amountCents ?? 0),
          currency: String(d.currency || 'USD'),
          planTier: (d.planTier || 'free') as PlanTier,
          status: (d.status || 'paid') as BillingInvoice['status'],
          description: String(d.description || ''),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onInvoices(list);
    },
    (err) => console.error('Billing subscription error:', err)
  );
}

// -----------------------------------------------------------------------------
// FEEDBACK, REPORTS, AUDIT LOGS & SYSTEM CONFIG (PHASES 7, 11, 13)
// -----------------------------------------------------------------------------
export async function submitFeedbackToFirestore(
  user: User,
  input: { category: FeedbackItem['category']; rating: number; message: string }
): Promise<void> {
  const id = sanitizeDocId(`fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `feedback/${id}`;
  try {
    await setDoc(doc(db, 'feedback', id), {
      id,
      userId: user.uid,
      userName: (user.displayName || user.email?.split('@')[0] || 'User').slice(0, 120),
      category: input.category,
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      message: input.message.trim().slice(0, 1500),
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToUserFeedback(
  uid: string,
  onItems: (items: FeedbackItem[]) => void
) {
  const q = query(collection(db, 'feedback'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: FeedbackItem[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          userId: String(d.userId || uid),
          userName: String(d.userName || 'User'),
          category: d.category || 'other',
          rating: Number(d.rating ?? 5),
          message: String(d.message || ''),
          status: d.status || 'new',
          ...(typeof d.adminNote === 'string' ? { adminNote: d.adminNote } : {}),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onItems(list);
    },
    (err) => console.error('User feedback subscription error:', err)
  );
}

export async function submitReportToFirestore(
  user: User,
  input: { reportType: UserReportItem['reportType']; subject: string; details: string; pageSection?: string }
): Promise<void> {
  const id = sanitizeDocId(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `reports/${id}`;
  try {
    await setDoc(doc(db, 'reports', id), {
      id,
      userId: user.uid,
      userName: (user.displayName || user.email?.split('@')[0] || 'User').slice(0, 120),
      reportType: input.reportType,
      subject: input.subject.trim().slice(0, 160),
      details: input.details.trim().slice(0, 2000),
      ...(input.pageSection ? { pageSection: input.pageSection.slice(0, 60) } : {}),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToUserReports(
  uid: string,
  onItems: (items: UserReportItem[]) => void
) {
  const q = query(collection(db, 'reports'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: UserReportItem[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          userId: String(d.userId || uid),
          userName: String(d.userName || 'User'),
          reportType: d.reportType || 'bug',
          subject: String(d.subject || ''),
          details: String(d.details || ''),
          ...(typeof d.pageSection === 'string' ? { pageSection: d.pageSection } : {}),
          status: d.status || 'open',
          ...(typeof d.adminResolution === 'string' ? { adminResolution: d.adminResolution } : {}),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onItems(list);
    },
    (err) => console.error('User reports subscription error:', err)
  );
}

export function subscribeToSystemConfig(onConfig: (config: SystemConfigSettings) => void) {
  return onSnapshot(
    doc(db, 'systemConfig', 'settings'),
    (snap) => {
      if (!snap.exists()) {
        onConfig(DEFAULT_SYSTEM_CONFIG);
        return;
      }
      const d = snap.data();
      onConfig({
        maintenanceMode: Boolean(d.maintenanceMode),
        announcementBanner: String(d.announcementBanner || ''),
        aiAnalysisEnabled: d.aiAnalysisEnabled !== false,
        aiRedesignEnabled: d.aiRedesignEnabled !== false,
        aiCoachEnabled: d.aiCoachEnabled !== false,
        aiShoppingEnabled: d.aiShoppingEnabled !== false,
        aiLayoutEnabled: d.aiLayoutEnabled !== false,
        activeTextModel: String(d.activeTextModel || DEFAULT_SYSTEM_CONFIG.activeTextModel),
        activeImageModel: String(d.activeImageModel || DEFAULT_SYSTEM_CONFIG.activeImageModel),
        maxUploadMb: Number(d.maxUploadMb ?? 10),
        updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
      });
    },
    () => onConfig(DEFAULT_SYSTEM_CONFIG)
  );
}

export async function writeAuditLog(
  user: User,
  action: string,
  details: string,
  targetId?: string
): Promise<void> {
  const id = sanitizeDocId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      id,
      actorUid: user.uid,
      actorName: (user.displayName || user.email?.split('@')[0] || 'User').slice(0, 120),
      action: action.slice(0, 120),
      ...(targetId ? { targetId: targetId.slice(0, 128) } : {}),
      details: details.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err);
  }
}

// -----------------------------------------------------------------------------
// ADMIN-ONLY OPERATIONS (PROTECTED BY firestore.rules isAdmin/isBootstrappedAdmin)
// -----------------------------------------------------------------------------
export function subscribeToAllUsersAdmin(
  onUsers: (users: AdminUserSummary[]) => void,
  onError: (err: Error) => void
) {
  return onSnapshot(
    query(collection(db, 'users'), limit(200)),
    (snap) => {
      const list: AdminUserSummary[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          uid: String(d.uid || dSnap.id),
          displayName: String(d.displayName || 'Organizer'),
          ...(typeof d.photoURL === 'string' ? { photoURL: d.photoURL } : {}),
          role: d.role === 'admin' ? 'admin' : 'user',
          status: d.status === 'suspended' ? 'suspended' : 'active',
          planTier: ['free', 'pro', 'premium'].includes(d.planTier) ? d.planTier : 'free',
          points: Number(d.stats?.points ?? 0),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onUsers(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (wrapped: any) {
        onError(wrapped);
      }
    }
  );
}

export async function updateUserGovernanceAdmin(
  adminUser: User,
  targetUid: string,
  updates: {
    status?: AccountStatus;
    role?: UserRole;
    planTier?: PlanTier;
    subscription?: SubscriptionRecord;
  }
): Promise<void> {
  const path = `users/${targetUid}`;
  const cleanSub = updates.subscription
    ? {
        tier: updates.subscription.tier,
        status: updates.subscription.status,
        billingCycle: updates.subscription.billingCycle,
        renewsAt: Number(updates.subscription.renewsAt) || Date.now(),
        provider: updates.subscription.provider,
        ...(typeof updates.subscription.canceledAt === 'number'
          ? { canceledAt: updates.subscription.canceledAt }
          : {}),
        ...(updates.subscription.customerId
          ? { customerId: String(updates.subscription.customerId).slice(0, 120) }
          : {}),
        ...(updates.subscription.subscriptionId
          ? { subscriptionId: String(updates.subscription.subscriptionId).slice(0, 120) }
          : {}),
        ...(updates.subscription.priceId
          ? { priceId: String(updates.subscription.priceId).slice(0, 120) }
          : {}),
        ...(typeof updates.subscription.cancelAtPeriodEnd === 'boolean'
          ? { cancelAtPeriodEnd: updates.subscription.cancelAtPeriodEnd }
          : {}),
        ...(typeof updates.subscription.lastPaymentFailedAt === 'number'
          ? { lastPaymentFailedAt: updates.subscription.lastPaymentFailedAt }
          : {}),
        ...(updates.subscription.lastEventId
          ? { lastEventId: String(updates.subscription.lastEventId).slice(0, 120) }
          : {}),
        ...(updates.subscription.lastEventType
          ? { lastEventType: String(updates.subscription.lastEventType).slice(0, 80) }
          : {}),
        syncStatus: updates.subscription.syncStatus || 'synced',
      }
    : undefined;

  try {
    await updateDoc(doc(db, 'users', targetUid), {
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.role ? { role: updates.role } : {}),
      ...(updates.planTier ? { planTier: updates.planTier } : {}),
      ...(cleanSub ? { subscription: cleanSub } : {}),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      adminUser,
      'ADMIN_USER_UPDATE',
      `Updated user ${targetUid}: planTier=${updates.planTier || '-'} status=${updates.status || '-'}`,
      targetUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordBillingInvoiceAdmin(
  adminUser: User,
  targetUid: string,
  invoice: BillingInvoice
): Promise<void> {
  const safeId = sanitizeDocId(invoice.id, 'inv');
  const path = `users/${targetUid}/billing/${safeId}`;
  const validStatus: BillingInvoice['status'] =
    invoice.status === 'pending' || invoice.status === 'refunded' ? invoice.status : 'paid';

  try {
    const ref = doc(db, 'users', targetUid, 'billing', safeId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        status: validStatus,
        description: String(invoice.description || 'NeatSpace Subscription').slice(0, 240),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        userId: targetUid,
        amountCents: Math.max(0, Math.min(10000000, Math.round(Number(invoice.amountCents) || 0))),
        currency: String(invoice.currency || 'USD').slice(0, 8),
        planTier: ['free', 'pro', 'premium'].includes(invoice.planTier) ? invoice.planTier : 'pro',
        status: validStatus,
        description: String(invoice.description || 'NeatSpace Subscription').slice(0, 240),
        createdAt: serverTimestamp(),
      });
    }
    await writeAuditLog(
      adminUser,
      'ADMIN_BILLING_SYNC',
      `Synced invoice ${safeId} (${validStatus}) for user ${targetUid}`,
      targetUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAllFeedbackAdmin(onItems: (items: FeedbackItem[]) => void) {
  return onSnapshot(
    query(collection(db, 'feedback'), limit(150)),
    (snap) => {
      const list: FeedbackItem[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          userId: String(d.userId || ''),
          userName: String(d.userName || 'User'),
          category: d.category || 'other',
          rating: Number(d.rating ?? 5),
          message: String(d.message || ''),
          status: d.status || 'new',
          ...(typeof d.adminNote === 'string' ? { adminNote: d.adminNote } : {}),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onItems(list);
    },
    (err) => console.error('Admin feedback subscription error:', err)
  );
}

export async function updateFeedbackAdmin(
  adminUser: User,
  feedbackId: string,
  status: FeedbackItem['status'],
  adminNote: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'feedback', feedbackId), {
      status,
      adminNote: adminNote.slice(0, 600),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(adminUser, 'ADMIN_FEEDBACK_UPDATE', `Feedback ${feedbackId} -> ${status}`, feedbackId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `feedback/${feedbackId}`);
  }
}

export function subscribeToAllReportsAdmin(onItems: (items: UserReportItem[]) => void) {
  return onSnapshot(
    query(collection(db, 'reports'), limit(150)),
    (snap) => {
      const list: UserReportItem[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          userId: String(d.userId || ''),
          userName: String(d.userName || 'User'),
          reportType: d.reportType || 'bug',
          subject: String(d.subject || ''),
          details: String(d.details || ''),
          ...(typeof d.pageSection === 'string' ? { pageSection: d.pageSection } : {}),
          status: d.status || 'open',
          ...(typeof d.adminResolution === 'string' ? { adminResolution: d.adminResolution } : {}),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onItems(list);
    },
    (err) => console.error('Admin reports subscription error:', err)
  );
}

export async function updateReportAdmin(
  adminUser: User,
  reportId: string,
  status: UserReportItem['status'],
  adminResolution: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      adminResolution: adminResolution.slice(0, 600),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(adminUser, 'ADMIN_REPORT_UPDATE', `Report ${reportId} -> ${status}`, reportId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function updateSystemConfigAdmin(
  adminUser: User,
  config: SystemConfigSettings
): Promise<void> {
  try {
    await setDoc(doc(db, 'systemConfig', 'settings'), {
      maintenanceMode: Boolean(config.maintenanceMode),
      announcementBanner: String(config.announcementBanner || '').slice(0, 300),
      aiAnalysisEnabled: Boolean(config.aiAnalysisEnabled),
      aiRedesignEnabled: Boolean(config.aiRedesignEnabled),
      aiCoachEnabled: Boolean(config.aiCoachEnabled),
      aiShoppingEnabled: Boolean(config.aiShoppingEnabled),
      aiLayoutEnabled: Boolean(config.aiLayoutEnabled),
      activeTextModel: String(config.activeTextModel || DEFAULT_SYSTEM_CONFIG.activeTextModel).slice(0, 80),
      activeImageModel: String(config.activeImageModel || DEFAULT_SYSTEM_CONFIG.activeImageModel).slice(0, 80),
      maxUploadMb: Math.max(1, Math.min(25, Math.round(Number(config.maxUploadMb) || 10))),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      adminUser,
      'ADMIN_CONFIG_UPDATE',
      `Updated platform flags (maintenance=${config.maintenanceMode}, maxUpload=${config.maxUploadMb}MB)`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemConfig/settings');
  }
}

export function subscribeToAuditLogsAdmin(onLogs: (logs: AuditLogEntry[]) => void) {
  return onSnapshot(
    query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => {
      const list: AuditLogEntry[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: String(d.id || dSnap.id),
          actorUid: String(d.actorUid || ''),
          actorName: String(d.actorName || ''),
          action: String(d.action || ''),
          ...(typeof d.targetId === 'string' ? { targetId: d.targetId } : {}),
          details: String(d.details || ''),
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now(),
        };
      });
      onLogs(list);
    },
    (err) => console.error('Audit logs subscription error:', err)
  );
}

// -----------------------------------------------------------------------------
// PERMANENT ACCOUNT & DATA DELETION (PHASE 11)
// -----------------------------------------------------------------------------
export async function deleteAllUserAccountData(user: User): Promise<void> {
  const uid = user.uid;
  const subcollections = [
    'rooms',
    'inventory',
    'calendarTasks',
    'savedDesigns',
    'budgetItems',
    'roomLayouts',
    'usage',
    'billing',
  ];

  for (const sub of subcollections) {
    const colRef = collection(db, 'users', uid, sub);
    const snap = await getDocs(query(colRef, where('userId', '==', uid)));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }

  await deleteDoc(doc(db, 'users', uid));

  try {
    await deleteUser(user);
  } catch {
    await signOut(auth);
  }
}

