import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  AccountStatus,
  AdminUserSummary,
  AuditLogEntry,
  BillingInvoice,
  FeedbackItem,
  OutputLanguage,
  PlanTier,
  SubscriptionRecord,
  SystemConfigSettings,
  UserReportItem,
  UserRole,
} from '../types';
import {
  subscribeToAllUsersAdmin,
  updateUserGovernanceAdmin,
  recordBillingInvoiceAdmin,
  subscribeToAllFeedbackAdmin,
  updateFeedbackAdmin,
  subscribeToAllReportsAdmin,
  updateReportAdmin,
  updateSystemConfigAdmin,
  subscribeToAuditLogsAdmin,
} from '../firebase';
import {
  ShieldAlert,
  Users,
  Activity,
  MessageSquare,
  Flag,
  Sliders,
  Server,
  Search,
  RefreshCw,
  CheckCircle2,
  Ban,
  Save,
  CreditCard,
} from 'lucide-react';

interface AdminDashboardViewProps {
  user: User;
  language: OutputLanguage;
  systemConfig: SystemConfigSettings;
  savedRoomsTotalLocal: number;
}

interface ServerHealthPayload {
  status: string;
  uptimeSeconds: number;
  startedAt: number;
  memoryMb: { rss: number; heapUsed: number; heapTotal: number };
  geminiConfigured: boolean;
  stripeConfigured: boolean;
  totalRequests: number;
  totalErrors: number;
  endpointCounts: Record<string, number>;
  recentErrors: Array<{ route: string; message: string; timestamp: number }>;
}

interface AdminStripeSubscriptionRow extends SubscriptionRecord {
  userKey: string;
  uid?: string;
  email?: string;
  updatedAt: number;
  pendingFirestoreSync: boolean;
  syncedToFirestoreAt?: number;
  livemode?: boolean;
}

interface AdminStripeEventRow {
  id: string;
  type: string;
  receivedAt: number;
  userKey: string;
  outcome: string;
  livemode: boolean;
  planTier?: PlanTier;
}

interface AdminStripeOverviewPayload {
  status: {
    configured: boolean;
    hasSecretKey: boolean;
    hasPriceIds: boolean;
    hasWebhookSecret: boolean;
    webhookOptionalInDev?: boolean;
    webhookToleranceSeconds?: number;
    sandboxMode: boolean;
    webhookEndpoint: string;
    firestoreDirectWriteAvailable: boolean;
  };
  recentEvents: AdminStripeEventRow[];
  subscriptions: AdminStripeSubscriptionRow[];
  invoicesByUserKey: Record<string, BillingInvoice[]>;
  totalEventsProcessed: number;
  pendingFirestoreSyncCount: number;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  language,
  systemConfig,
  savedRoomsTotalLocal,
}) => {
  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'moderation' | 'config' | 'stripe' | 'health'>('overview');
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const [usersList, setUsersList] = useState<AdminUserSummary[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [configDraft, setConfigDraft] = useState<SystemConfigSettings>(systemConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [health, setHealth] = useState<ServerHealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [stripeOverview, setStripeOverview] = useState<AdminStripeOverviewPayload | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setConfigDraft(systemConfig);
  }, [systemConfig]);

  useEffect(() => {
    const unsubUsers = subscribeToAllUsersAdmin(
      (list) => setUsersList(list),
      (err) => setErrorMsg(err.message)
    );
    const unsubFb = subscribeToAllFeedbackAdmin(setFeedbacks);
    const unsubRep = subscribeToAllReportsAdmin(setReports);
    const unsubLogs = subscribeToAuditLogsAdmin(setAuditLogs);

    return () => {
      unsubUsers();
      unsubFb();
      unsubRep();
      unsubLogs();
    };
  }, []);

  const fetchServerHealth = async () => {
    setHealthLoading(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/admin/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) {
        setHealth(data);
      } else {
        setErrorMsg(data.error || 'Failed to read system health.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error contacting admin health API.');
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchStripeOverview = async () => {
    setStripeLoading(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/admin/stripe-events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) {
        setStripeOverview(data);
      }
    } catch {
      // ignore background error
    } finally {
      setStripeLoading(false);
    }
  };

  useEffect(() => {
    fetchServerHealth();
    fetchStripeOverview();
  }, [user]);

  const handleSyncStripeToFirestore = async (row: AdminStripeSubscriptionRow) => {
    const targetUid = row.uid || (usersList.some((u) => u.uid === row.userKey) ? row.userKey : '');
    if (!targetUid) {
      setErrorMsg(`Cannot sync "${row.userKey}": no Firebase UID is correlated with this Stripe customer yet.`);
      return;
    }
    setSyncingKey(row.userKey);
    setErrorMsg(null);
    try {
      await updateUserGovernanceAdmin(user, targetUid, {
        planTier: row.tier,
        subscription: {
          tier: row.tier,
          status: row.status,
          billingCycle: row.billingCycle,
          renewsAt: row.renewsAt,
          canceledAt: row.canceledAt,
          provider: 'stripe',
          customerId: row.customerId,
          subscriptionId: row.subscriptionId,
          priceId: row.priceId,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
          lastPaymentFailedAt: row.lastPaymentFailedAt,
          lastEventId: row.lastEventId,
          lastEventType: row.lastEventType,
          syncStatus: 'synced',
        },
      });
      const invs = stripeOverview?.invoicesByUserKey?.[row.userKey] || [];
      for (const inv of invs.slice(0, 5)) {
        await recordBillingInvoiceAdmin(user, targetUid, inv);
      }
      const token = await user.getIdToken();
      await fetch('/api/admin/stripe-mark-synced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userKey: row.userKey, eventId: row.lastEventId }),
      });
      await fetchStripeOverview();
      setStatusMsg(`Synced Stripe subscription (${row.tier} Â· ${row.status}) to Firestore for ${targetUid}.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sync Stripe record to Firestore.');
    } finally {
      setSyncingKey(null);
    }
  };

  const metrics = useMemo(() => {
    const now = Date.now();
    const windowMs =
      timeframe === 'daily'
        ? 24 * 3600 * 1000
        : timeframe === 'weekly'
        ? 7 * 24 * 3600 * 1000
        : 30 * 24 * 3600 * 1000;
    const cutoff = now - windowMs;

    const totalUsers = usersList.length;
    const activeUsers = usersList.filter((u) => u.status === 'active').length;
    const suspendedUsers = usersList.filter((u) => u.status === 'suspended').length;
    const recentUsers = usersList.filter((u) => u.updatedAt >= cutoff).length;
    const paidUsers = usersList.filter((u) => u.planTier !== 'free').length;
    const openReports = reports.filter((r) => r.status === 'open' || r.status === 'investigating').length;
    const pendingFeedback = feedbacks.filter((f) => f.status === 'new').length;

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      recentUsers,
      paidUsers,
      openReports,
      pendingFeedback,
    };
  }, [usersList, reports, feedbacks, timeframe]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        u.planTier.toLowerCase().includes(q)
    );
  }, [usersList, userSearch]);

  const handleGovernanceUpdate = async (
    targetUid: string,
    updates: { status?: AccountStatus; role?: UserRole; planTier?: PlanTier }
  ) => {
    setErrorMsg(null);
    try {
      await updateUserGovernanceAdmin(user, targetUid, updates);
      setStatusMsg('User governance updated and logged.');
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update user.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setErrorMsg(null);
    try {
      await updateSystemConfigAdmin(user, configDraft);
      setStatusMsg('Platform AI config & feature flags saved.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save platform config.');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#163D32] text-white rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#E9B95B]">
            {isBn ? 'à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨à¦¿à¦¸à§à¦Ÿà§à¦°à§‡à¦Ÿà¦° à¦•à¦¨à§à¦Ÿà§à¦°à§‹à¦² à¦ªà§à¦¯à¦¾à¦¨à§‡à¦²' : 'Admin Governance Console'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#E9B95B]" />
            <span>{isBn ? 'à¦ªà§à¦²à§à¦¯à¦¾à¦Ÿà¦«à¦°à§à¦® à¦…à§à¦¯à¦¾à¦¨à¦¾à¦²à¦¿à¦Ÿà¦¿à¦•à§à¦¸, à¦®à¦¡à¦¾à¦°à§‡à¦¶à¦¨ à¦“ à¦¸à¦¿à¦¸à§à¦Ÿà§‡à¦® à¦¹à§‡à¦²à¦¥' : 'SaaS Analytics, Moderation & Platform Config'}</span>
          </h2>
