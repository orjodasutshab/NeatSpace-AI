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
      setStatusMsg(`Synced Stripe subscription (${row.tier} · ${row.status}) to Firestore for ${targetUid}.`);
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
            {isBn ? 'অ্যাডমিনিস্ট্রেটর কন্ট্রোল প্যানেল' : 'Admin Governance Console'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#E9B95B]" />
            <span>{isBn ? 'প্ল্যাটফর্ম অ্যানালিটিক্স, মডারেশন ও সিস্টেম হেলথ' : 'SaaS Analytics, Moderation & Platform Config'}</span>
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/10 text-xs">
          {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg font-bold capitalize ${
                timeframe === tf ? 'bg-[#E9B95B] text-[#163D32]' : 'text-white/80 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'overview' as const, label: 'Overview & Telemetry', icon: <Activity className="w-4 h-4" /> },
          { id: 'users' as const, label: `Users (${usersList.length})`, icon: <Users className="w-4 h-4" /> },
          { id: 'moderation' as const, label: `Feedback & Reports (${metrics.openReports + metrics.pendingFeedback})`, icon: <Flag className="w-4 h-4" /> },
          { id: 'config' as const, label: 'AI Config & Flags', icon: <Sliders className="w-4 h-4" /> },
          {
            id: 'stripe' as const,
            label: `Stripe Webhooks (${stripeOverview?.pendingFirestoreSyncCount || 0})`,
            icon: <CreditCard className="w-4 h-4" />,
          },
          { id: 'health' as const, label: 'System Health & Logs', icon: <Server className="w-4 h-4" /> },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setActiveTab(tabItem.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
              activeTab === tabItem.id
                ? 'bg-[#163D32] text-white border-[#163D32]'
                : 'bg-white dark:bg-[#13241D] text-[#163D32] dark:text-[#EDF4EF] border-[#163D32]/15 dark:border-[#264638]'
            }`}
          >
            {tabItem.icon}
            <span>{tabItem.label}</span>
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-[#DDF3E5] border border-[#163D32]/20 text-[#163D32] text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Registered Users', value: metrics.totalUsers, sub: `${metrics.recentUsers} active in ${timeframe} window` },
              { label: 'Active vs Suspended', value: `${metrics.activeUsers} / ${metrics.suspendedUsers}`, sub: `${metrics.paidUsers} paid tier accounts` },
              { label: 'API Requests (Session)', value: health?.totalRequests ?? 0, sub: `${health?.totalErrors ?? 0} server errors` },
              { label: 'Pending Moderation', value: metrics.openReports + metrics.pendingFeedback, sub: `${savedRoomsTotalLocal} rooms in current cache` },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-1"
              >
                <div className="text-xs font-semibold text-[#163D32]/70 dark:text-[#9FC6B0]">
                  {card.label}
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]">
                  {card.value}
                </div>
                <div className="text-[11px] text-[#163D32]/65 dark:text-[#B9D1C3]">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Endpoint Telemetry Breakdown */}
            <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                AI & API Endpoint Call Volume
              </h3>
              {!health || Object.keys(health.endpointCounts).length === 0 ? (
                <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
                  No API traffic recorded in the current server process yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(Object.entries(health.endpointCounts) as Array<[string, number]>)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([route, count]) => {
                      const pct = Math.round((count / Math.max(1, health.totalRequests)) * 100);
                      return (
                        <div key={route} className="space-y-1 text-xs">
                          <div className="flex justify-between font-mono tabular-nums">
                            <span className="font-semibold text-[#163D32] dark:text-[#EDF4EF]">{route}</span>
                            <span className="text-[#163D32]/70 dark:text-[#9FC6B0]">{count} calls</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#F7F9F6] dark:bg-[#182C24] overflow-hidden">
                            <div className="h-full bg-[#163D32] dark:bg-[#E9B95B]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Plan Distribution */}
            <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                Subscription Tier Distribution
              </h3>
              {(['free', 'pro', 'premium'] as PlanTier[]).map((tier) => {
                const count = usersList.filter((u) => u.planTier === tier).length;
                const pct = Math.round((count / Math.max(1, usersList.length)) * 100);
                return (
                  <div key={tier} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="uppercase">{tier}</span>
                      <span className="font-mono tabular-nums">
                        {count} users ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F7F9F6] dark:bg-[#182C24] overflow-hidden">
                      <div
                        className={`h-full ${tier === 'premium' ? 'bg-[#E9B95B]' : 'bg-[#163D32]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Management */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-[#163D32]/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by name, UID, or plan..."
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-xl pl-9 pr-3 py-2 text-xs text-[#163D32] dark:text-[#EDF4EF] outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F9F6] dark:bg-[#182C24] border-b border-[#163D32]/10 dark:border-[#264638]">
                  <th className="py-2.5 px-3 font-bold">User</th>
                  <th className="py-2.5 px-3 font-bold">Role</th>
                  <th className="py-2.5 px-3 font-bold">Plan</th>
                  <th className="py-2.5 px-3 font-bold">Points</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                  <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#163D32]/10 dark:divide-[#264638]">
                {filteredUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">{u.displayName}</div>
                      <div className="font-mono text-[10px] text-[#163D32]/60 dark:text-[#9FC6B0]">{u.uid.slice(0, 14)}…</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.role}
                        disabled={u.uid === user.uid}
                        onChange={(e) => handleGovernanceUpdate(u.uid, { role: e.target.value as UserRole })}
                        className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.planTier}
                        onChange={(e) => handleGovernanceUpdate(u.uid, { planTier: e.target.value as PlanTier })}
                        className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs font-semibold"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{u.points}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                          u.status === 'suspended'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-[#DDF3E5] text-[#163D32]'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {u.uid !== user.uid && (
                        <button
                          type="button"
                          onClick={() =>
                            handleGovernanceUpdate(u.uid, {
                              status: u.status === 'active' ? 'suspended' : 'active',
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            u.status === 'active'
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'bg-[#DDF3E5] text-[#163D32]'
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                          <span>{u.status === 'active' ? 'Suspend' : 'Activate'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Moderation (Feedback + Reports) */}
      {activeTab === 'moderation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#E9B95B]" />
              <span>User Feedback ({feedbacks.length})</span>
            </h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>{fb.userName} · {fb.category} · {fb.rating}/5</span>
                    <span className="uppercase">{fb.status}</span>
                  </div>
                  <p>{fb.message}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteDrafts[fb.id] ?? fb.adminNote ?? ''}
                      onChange={(e) => setNoteDrafts((p) => ({ ...p, [fb.id]: e.target.value }))}
                      placeholder="Reply note..."
                      className="flex-1 bg-white dark:bg-[#13241D] border border-[#163D32]/15 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <select
                      value={fb.status}
                      onChange={(e) =>
                        updateFeedbackAdmin(
                          user,
                          fb.id,
                          e.target.value as FeedbackItem['status'],
                          noteDrafts[fb.id] ?? fb.adminNote ?? ''
                        )
                      }
                      className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs font-bold"
                    >
                      <option value="new">new</option>
                      <option value="reviewed">reviewed</option>
                      <option value="planned">planned</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-500" />
              <span>User Reports ({reports.length})</span>
            </h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {reports.map((rep) => (
                <div key={rep.id} className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>[{rep.reportType.toUpperCase()}] {rep.subject}</span>
                    <span className="uppercase">{rep.status}</span>
                  </div>
                  <p className="text-[#163D32]/80 dark:text-[#B9D1C3]">{rep.details}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteDrafts[rep.id] ?? rep.adminResolution ?? ''}
                      onChange={(e) => setNoteDrafts((p) => ({ ...p, [rep.id]: e.target.value }))}
                      placeholder="Resolution summary..."
                      className="flex-1 bg-white dark:bg-[#13241D] border border-[#163D32]/15 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <select
                      value={rep.status}
                      onChange={(e) =>
                        updateReportAdmin(
                          user,
                          rep.id,
                          e.target.value as UserReportItem['status'],
                          noteDrafts[rep.id] ?? rep.adminResolution ?? ''
                        )
                      }
                      className="bg-white dark:bg-[#13241D] border border-[#163D32]/15 rounded-lg px-2 py-1 text-xs font-bold"
                    >
                      <option value="open">open</option>
                      <option value="investigating">investigating</option>
                      <option value="resolved">resolved</option>
                      <option value="dismissed">dismissed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI Configuration & Feature Flags */}
      {activeTab === 'config' && (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            Platform Feature Controls & AI Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
            {[
              { key: 'maintenanceMode' as const, label: 'Maintenance Mode (Non-Admins)' },
              { key: 'aiAnalysisEnabled' as const, label: 'AI Room Analyzer' },
              { key: 'aiRedesignEnabled' as const, label: 'AI Room Redesign Studio' },
              { key: 'aiCoachEnabled' as const, label: 'Voice AI Coach' },
              { key: 'aiShoppingEnabled' as const, label: 'AI Shopping Assistant' },
              { key: 'aiLayoutEnabled' as const, label: 'AI Layout Optimizer' },
            ].map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 cursor-pointer"
              >
                <span className="font-semibold">{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={configDraft[toggle.key]}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, [toggle.key]: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#163D32]"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Max Upload Size (MB)</label>
              <input
                type="number"
                min={1}
                max={25}
                value={configDraft.maxUploadMb}
                onChange={(e) =>
                  setConfigDraft((p) => ({ ...p, maxUploadMb: Math.max(1, Math.min(25, Number(e.target.value) || 10)) }))
                }
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Text Reasoning Model Label</label>
              <input
                type="text"
                value={configDraft.activeTextModel}
                onChange={(e) => setConfigDraft((p) => ({ ...p, activeTextModel: e.target.value }))}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Image Redesign Model Label</label>
              <input
                type="text"
                value={configDraft.activeImageModel}
                onChange={(e) => setConfigDraft((p) => ({ ...p, activeImageModel: e.target.value }))}
                className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Global Announcement Banner (Optional)</label>
            <input
              type="text"
              value={configDraft.announcementBanner}
              onChange={(e) => setConfigDraft((p) => ({ ...p, announcementBanner: e.target.value }))}
              placeholder="e.g. Scheduled maintenance Sunday 2am UTC"
              className="w-full bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 rounded-xl px-3.5 py-2 text-xs sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={configSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-xs sm:text-sm font-bold"
          >
            <Save className="w-4 h-4 text-[#E9B95B]" />
            <span>{configSaving ? 'Saving...' : 'Save Platform Configuration'}</span>
          </button>
        </form>
      )}

      {/* TAB 5: Stripe Webhooks & Firestore Sync */}
      {activeTab === 'stripe' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                  Stripe Webhook Endpoint & Sandbox Readiness
                </h3>
                <p className="text-xs text-[#163D32]/70 dark:text-[#9FC6B0]">
                  Endpoint: <code className="font-mono font-bold">/api/stripe/webhook</code> · Duplicate event IDs are idempotently ignored.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchStripeOverview}
                disabled={stripeLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DDF3E5] text-[#163D32] text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${stripeLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Events</span>
              </button>
            </div>

            {stripeOverview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10">
                  <div className="text-[#163D32]/65 dark:text-[#9FC6B0]">STRIPE_WEBHOOK_SECRET</div>
                  <div className="font-bold mt-1">
                    {stripeOverview.status.hasWebhookSecret
                      ? `Configured (${stripeOverview.status.webhookToleranceSeconds || 300}s)`
                      : `Optional in Dev (${stripeOverview.status.webhookToleranceSeconds || 300}s)`}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10">
                  <div className="text-[#163D32]/65 dark:text-[#9FC6B0]">Environment Mode</div>
                  <div className="font-bold mt-1">
                    {stripeOverview.status.sandboxMode
                      ? 'Stripe Sandbox (Test)'
                      : stripeOverview.status.hasSecretKey
                      ? 'Live Mode'
                      : 'Awaiting Keys'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10">
                  <div className="text-[#163D32]/65 dark:text-[#9FC6B0]">Processed Webhook Events</div>
                  <div className="font-bold mt-1">{stripeOverview.totalEventsProcessed}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10">
                  <div className="text-[#163D32]/65 dark:text-[#9FC6B0]">Pending Firestore Sync</div>
                  <div className="font-bold mt-1 text-[#163D32] dark:text-[#E9B95B]">
                    {stripeOverview.pendingFirestoreSyncCount}
                  </div>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#E9B95B]/40 text-xs text-[#163D32]/85 dark:text-[#B9D1C3] space-y-1">
              <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                Firebase Starter Tier Architecture Notice
              </div>
              <p>
                Verified Stripe webhooks update subscription entitlements on the backend immediately with signature verification and idempotency. Because Google-hosted Starter Tier projects do not allow server-side <code className="font-mono">firebase-admin</code> IAM writes into Firestore, click <strong>Sync to Firestore</strong> below (under your verified Admin session) to commit any pending subscription updates into <code className="font-mono">users/&#123;uid&#125;</code> and <code className="font-mono">billing</code>, or upgrade the Firebase project to enable server-side IAM writes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                Verified Stripe Subscription Records ({stripeOverview?.subscriptions.length || 0})
              </h3>
              {!stripeOverview || stripeOverview.subscriptions.length === 0 ? (
                <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
                  No Stripe webhook subscription records received yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {stripeOverview.subscriptions.map((sub) => (
                    <div
                      key={sub.userKey}
                      className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-[#163D32] dark:text-[#EDF4EF] truncate">
                          {sub.uid || sub.userKey}{' '}
                          <span className="font-mono uppercase px-1.5 py-0.5 rounded bg-[#DDF3E5] text-[#163D32] text-[10px]">
                            {sub.tier} · {sub.status}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-[#163D32]/70 dark:text-[#9FC6B0] truncate">
                          cus: {sub.customerId || 'n/a'} · sub: {sub.subscriptionId || 'n/a'} · {sub.lastEventType || 'event'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={syncingKey === sub.userKey || !sub.pendingFirestoreSync}
                        onClick={() => handleSyncStripeToFirestore(sub)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 ${
                          sub.pendingFirestoreSync
                            ? 'bg-[#163D32] text-white hover:bg-[#102E25]'
                            : 'bg-[#DDF3E5]/60 text-[#163D32] opacity-75'
                        }`}
                      >
                        {syncingKey === sub.userKey
                          ? 'Syncing...'
                          : sub.pendingFirestoreSync
                          ? 'Sync to Firestore'
                          : 'Synced'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                Recent Webhook Events ({stripeOverview?.recentEvents.length || 0})
              </h3>
              {!stripeOverview || stripeOverview.recentEvents.length === 0 ? (
                <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
                  No verified Stripe webhook deliveries yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
                  {stripeOverview.recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 space-y-1"
                    >
                      <div className="flex justify-between font-bold">
                        <span className="font-mono text-[#163D32] dark:text-[#E9B95B]">{ev.type}</span>
                        <span className="text-[10px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                          {new Date(ev.receivedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#163D32]/80 dark:text-[#EDF4EF] truncate">
                        {ev.id} · {ev.outcome}
                      </div>
                      <div className="text-[10px] text-[#163D32]/65 dark:text-[#9FC6B0]">
                        User: {ev.userKey} · {ev.livemode ? 'Live' : 'Sandbox/Test'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: System Health & Audit Logs */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
                Node Runtime Health
              </h3>
              <button
                type="button"
                onClick={fetchServerHealth}
                disabled={healthLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DDF3E5] text-[#163D32] text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {health && (
              <div className="space-y-2.5 text-xs font-mono tabular-nums">
                <div className="flex justify-between p-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                  <span>Server Uptime</span>
                  <strong>{health.uptimeSeconds}s</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                  <span>Memory (RSS / Heap)</span>
                  <strong>{health.memoryMb.rss} MB / {health.memoryMb.heapUsed} MB</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                  <span>Gemini API Key</span>
                  <strong>{health.geminiConfigured ? 'Configured' : 'Missing'}</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24]">
                  <span>Stripe Billing Keys</span>
                  <strong>{health.stripeConfigured ? 'Configured' : 'Not Configured'}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
              Immutable Admin & Security Audit Logs ({auditLogs.length})
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 space-y-1"
                >
                  <div className="flex justify-between font-bold">
                    <span className="font-mono text-[#163D32] dark:text-[#E9B95B]">{log.action}</span>
                    <span className="text-[10px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[#163D32]/85 dark:text-[#EDF4EF]">{log.details}</div>
                  <div className="text-[10px] text-[#163D32]/60 dark:text-[#9FC6B0]">
                    Actor: {log.actorName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
