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
