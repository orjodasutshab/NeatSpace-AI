export type RoomType =
  | 'living_room'
  | 'bedroom'
  | 'home_office'
  | 'kitchen'
  | 'dining_room'
  | 'closet'
  | 'bathroom'
  | 'garage'
  | 'kids_room'
  | 'general';

export type FocusGoal =
  | 'quick_wins'
  | 'maximize_space'
  | 'storage_solutions'
  | 'aesthetic_reset'
  | 'deep_declutter';

export type OutputLanguage = 'en' | 'bn';

export type TriageDecision = 'keep' | 'donate' | 'trash' | 'relocate';

export type TaskPriority = 'high' | 'medium' | 'low';

export type CleaningDifficulty = 'Easy' | 'Moderate' | 'Intensive';

export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type PlanTier = 'free' | 'pro' | 'premium';
export type BillingCycle = 'monthly' | 'annual';

export interface SubscriptionRecord {
  tier: PlanTier;
  status: 'active' | 'canceled' | 'past_due';
  billingCycle: BillingCycle;
  renewsAt: number;
  canceledAt?: number;
  provider: 'none' | 'stripe' | 'admin_grant';
  customerId?: string;
  subscriptionId?: string;
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
  lastPaymentFailedAt?: number;
  lastEventId?: string;
  lastEventType?: string;
  syncStatus?: 'synced' | 'pending_admin_sync';
}

export interface UsageCounters {
  monthKey: string; // YYYY-MM
  roomAnalyses: number;
  aiRedesigns: number;
  aiCoachMessages: number;
  shoppingQueries: number;
  layoutSuggestions: number;
  updatedAt: number;
}

export interface BillingInvoice {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  planTier: PlanTier;
  status: 'paid' | 'pending' | 'refunded';
  description: string;
  createdAt: number;
}

export interface PrivacySettings {
  shareAnonymousUsage: boolean;
  allowAiPersonalization: boolean;
  autoSaveAnalyses: boolean;
}

export interface AdminUserSummary {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: AccountStatus;
  planTier: PlanTier;
  points: number;
  roomsCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  category: 'feature' | 'ux' | 'ai_quality' | 'praise' | 'other';
  rating: number;
  message: string;
  status: 'new' | 'reviewed' | 'planned' | 'resolved';
  adminNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserReportItem {
  id: string;
  userId: string;
  userName: string;
  reportType: 'bug' | 'abuse' | 'billing' | 'privacy';
  subject: string;
  details: string;
  pageSection?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  adminResolution?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorName: string;
  action: string;
  targetId?: string;
  details: string;
  createdAt: number;
}

export interface SystemConfigSettings {
  maintenanceMode: boolean;
  announcementBanner: string;
  aiAnalysisEnabled: boolean;
  aiRedesignEnabled: boolean;
  aiCoachEnabled: boolean;
  aiShoppingEnabled: boolean;
  aiLayoutEnabled: boolean;
  activeTextModel: string;
  activeImageModel: string;
  maxUploadMb: number;
  updatedAt: number;
}

export interface BudgetExpense {
  id: string;
  roomName: string;
  title: string;
  category: 'Storage' | 'Furniture' | 'Decor' | 'Lighting' | 'DIY' | 'Cleaning';
  estimatedCost: number;
  actualCost: number;
  purchased: boolean;
  notes?: string;
  createdAt: number;
}

export interface ShoppingRecommendation {
  name: string;
  category: string;
  estimatedCostRange: string;
  idealDimensions: string;
  spaceFitReason: string;
  diyAlternative: string;
  priority: 'essential' | 'recommended' | 'optional';
}

export type MeasurementUnit = 'ft' | 'm';

export type FurnitureKind = 'bed' | 'desk' | 'sofa' | 'storage' | 'table' | 'chair' | 'plant';

export interface ArchitecturalOpening {
  id: string;
  kind: 'door' | 'window';
  wall: 'north' | 'south' | 'east' | 'west';
  offsetRatio: number; // 0.05 to 0.9
  widthUnits: number; // in room unit (ft or m)
  label: string;
}

export interface LayoutFurnitureItem {
  id: string;
  label: string;
  kind: FurnitureKind;
  x: number; // top-left X in room units
  y: number; // top-left Y in room units
  w: number; // width in room units
  h: number; // depth/height in room units
  rotation: 0 | 90;
}

export interface RoomLayoutPlan {
  id: string;
  name: string;
  roomType: RoomType;
  unit: MeasurementUnit;
  width: number;
  length: number;
  ceilingHeight: number;
  openings: ArchitecturalOpening[];
  furniture: LayoutFurnitureItem[];
  aiSummary?: string;
  updatedAt: number;
}

export interface LayoutAiSuggestionResult {
  walkingClearanceScore: number;
  spaceUtilizationPercent: number;
  bottlenecks: string[];
  placementTips: string[];
  recommendedPositions: Array<{
    id: string;
    x: number;
    y: number;
    reason: string;
  }>;
}

export interface TriageItem {
  id: string;
  item: string;
  decision: TriageDecision;
  reason: string;
  sorted?: boolean;
}

export interface DetectedObjectBox {
  id: string;
  label: string;
  category: string;
  /** Normalized [ymin, xmin, ymax, xmax] from 0 to 1000 */
  box2d: [number, number, number, number];
  clutterImpact: 'high' | 'medium' | 'low';
  recommendedAction: 'keep' | 'donate' | 'recycle' | 'relocate';
  estimatedValue?: string;
}

export interface ColorSwatch {
  name: string;
  hex: string;
  reason?: string;
}

export interface ColorDecorSuggestion {
  wallColors: ColorSwatch[];
  curtainSuggestion: string;
  furniturePalette: ColorSwatch[];
  decorTips: string[];
}

export interface SpaceUtilizationTip {
  zone: string;
  suggestion: string;
  spaceGainEstimate: string;
  difficulty: 'Easy' | 'Moderate';
}

export type RedesignStyle =
  | 'minimalist'
  | 'scandinavian'
  | 'modern'
  | 'luxury'
  | 'bohemian'
  | 'japandi'
  | 'industrial'
  | 'contemporary'
  | 'cozy_modern'
  | 'warm_earth'
  | 'budget_refresh';

export type BudgetTier = 'budget_friendly' | 'moderate' | 'investment';
export type FurniturePreference = 'keep_existing' | 'modular_storage' | 'solid_wood' | 'minimal_seating';

export interface SavedRedesign {
  id: string;
  roomName: string;
  roomType: RoomType;
  style: RedesignStyle;
  budgetTier: BudgetTier;
  furniturePref: FurniturePreference;
  wallColor?: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  summary: string;
  createdAt: number;
}

export interface ProblemArea {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface ActionStep {
  stepNumber: number;
  title: string;
  category: 'Purge' | 'Sort' | 'Organize' | 'Store';
  priority?: TaskPriority;
  timeEstimate: string;
  instructions: string;
  tips?: string;
  completed?: boolean;
}

export interface StorageRecommendation {
  category: string;
  itemTitle: string;
  purpose: string;
  suggestedLocation: string;
  estimatedBudget: string;
  acquired?: boolean;
}

export type FloorplanZoneKind = 'desk' | 'bed' | 'storage' | 'seating' | 'pathway' | 'dropzone';

export interface FloorplanZone {
  id: string;
  label: string;
  kind: FloorplanZoneKind;
  x: number; // grid units (0-11)
  y: number; // grid units (0-7)
  w: number; // width in grid units (1-6)
  h: number; // height in grid units (1-6)
}

export interface WeeklyScheduleDay {
  day: string;
  focus: string;
  tasks: string[];
  durationMinutes: number;
  completed?: boolean;
}

export interface DonationListingResult {
  title: string;
  suggestedPrice: string;
  condition: string;
  description: string;
  packingTips: string[];
  boxLabels: string[];
}

export interface RoomAnalysis {
  id: string;
  timestamp: number;
  roomName: string;
  roomType: RoomType;
  focusGoal: FocusGoal;
  imageUrl: string;
  clutterScore: number; // 0 (Pristine) to 100 (Severe Clutter)
  cleaningDifficulty?: CleaningDifficulty;
  estimatedCleaningMinutes?: number;
  furnitureAnalysis?: string;
  overallAssessment: string;
  detectedItems: string[];
  detectedObjects?: DetectedObjectBox[];
  triageItems?: TriageItem[];
  quickWins: string[];
  problemAreas: ProblemArea[];
  actionPlan: ActionStep[];
  storageRecommendations: StorageRecommendation[];
  layoutAdvice: string;
  spaceUtilization?: SpaceUtilizationTip[];
  colorDecor?: ColorDecorSuggestion;
  recyclingTips?: string[];
  maintenanceHabits?: string[];
  minimalistTip: string;
  userNotes?: string;
  afterImageUrl?: string;
  afterClutterScore?: number;
  afterSummary?: string;
  redesignPreviewUrl?: string;
  redesignStyle?: RedesignStyle;
  redesignSummary?: string;
  assignedMemberId?: string;
  floorplanZones?: FloorplanZone[];
  weeklySchedule?: WeeklyScheduleDay[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  quickReplies?: string[];
}

export type CoachPersona = 'minimalist' | 'speed_cleaner' | 'budget_diy' | 'feng_shui';

export interface CoachConversation {
  id: string;
  title: string;
  persona: CoachPersona;
  roomName?: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface CoachPersonaDetails {
  id: CoachPersona;
  name: string;
  role: string;
  description: string;
  avatarIcon: string;
  greeting: string;
}

export interface DiySubstitute {
  originalItem: string;
  diySubstitute: string;
  howToMake: string;
  estimatedSavings: string;
}

export interface SeasonalChecklistItem {
  title: string;
  category: 'Purge' | 'Sort' | 'Organize' | 'Store';
  timeEstimate: string;
  tip: string;
  completed?: boolean;
}

export interface BinLabelTag {
  id: string;
  title: string;
  contents: string;
  accent: 'emerald' | 'cyan' | 'amber' | 'rose';
}

export type StorageUsageFrequency = 'frequent' | 'occasional' | 'unused';

export type StorageCategory =
  | 'Clothes'
  | 'Books'
  | 'Electronics'
  | 'Kitchen Items'
  | 'Decorations'
  | 'Documents'
  | 'Tools'
  | 'Other';

export interface StorageInventoryItem {
  id: string;
  itemName: string;
  location: string;
  roomName: string;
  category: string;
  quantity: number;
  usageFrequency?: StorageUsageFrequency;
  photoUrl?: string;
  notes?: string;
  updatedAt: number;
}

export interface CalendarTask {
  id: string;
  dateIso: string; // YYYY-MM-DD
  title: string;
  roomName: string;
  minutes: number;
  priority?: TaskPriority;
  deadlineTime?: string;
  completed: boolean;
}

export interface CleaningHistoryEntry {
  id: string;
  roomName: string;
  roomType: RoomType;
  action: string;
  pointsEarned: number;
  beforeScore?: number;
  afterScore?: number;
  minutes: number;
  timestamp: number;
}

export interface ReminderConfig {
  enabled: boolean;
  time: string; // HH:MM
  days: number[]; // 0 (Sun) - 6 (Sat)
  frequency: 'daily' | 'weekdays' | 'weekends';
  lastDismissedDate?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  color: string;
  points: number;
}

export interface FamilyActivityEntry {
  id: string;
  memberName: string;
  action: string;
  roomName: string;
  timestamp: number;
}

export type NotificationCategory =
  | 'reminder'
  | 'deadline'
  | 'task_done'
  | 'analysis'
  | 'family'
  | 'achievement';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  targetSection?: WorkspaceSection;
}

export interface UserPreferences {
  preferredStyle: RedesignStyle;
  preferredGoal: FocusGoal;
  dailyBudgetMinutes: number;
  homeGoalStatement: string;
  theme: 'light' | 'dark';
  pushNotifications: boolean;
  deadlineAlerts: boolean;
  roomBudgetTarget?: number;
}

export interface AchievementBadge {
  id: string;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  pointsRequired: number;
  icon: 'sparkles' | 'zap' | 'award' | 'recycle' | 'calendar' | 'users';
}

export type WorkspaceSection =
  | 'dashboard'
  | 'redesign'
  | 'rooms'
  | 'gallery'
  | 'calendar'
  | 'inventory'
  | 'planner'
  | 'budget'
  | 'stats'
  | 'family'
  | 'pricing'
  | 'support'
  | 'profile'
  | 'admin'
  | 'not_found';
