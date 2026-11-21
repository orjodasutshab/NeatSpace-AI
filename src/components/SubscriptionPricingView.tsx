import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  BillingCycle,
  BillingInvoice,
  OutputLanguage,
  PlanTier,
  SubscriptionRecord,
  UsageCounters,
} from '../types';
import { PLAN_SPECS } from '../planConfig';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Check,
  X,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  Receipt,
  LogIn,
  ArrowRight,
  CalendarClock,
  ExternalLink,
  Copy,
  RefreshCw,
} from 'lucide-react';

interface SubscriptionPricingViewProps {
  user: User | null;
  language: OutputLanguage;
  planTier: PlanTier;
  subscription?: SubscriptionRecord;
  usage: UsageCounters;
  savedRoomsCount: number;
  roomLayoutsCount: number;
  invoices: BillingInvoice[];
  onSignIn: () => void;
  onRequestCancelOrDowngrade?: (targetTier: PlanTier) => Promise<void> | void;
  onSubscriptionSynced?: (subscription: SubscriptionRecord, invoices?: BillingInvoice[]) => void;
}

interface PendingStripeRedirect {
  kind: 'checkout' | 'portal';
  url: string;
  sessionId?: string;
  planTier?: PlanTier;
  billingCycle?: BillingCycle;
}

function isEmbeddedIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

interface BillingStatusResponse {
  provider: string;
  configured: boolean;
  hasSecretKey: boolean;
  hasPriceIds: boolean;
  hasWebhookSecret: boolean;
  webhookOptionalInDev?: boolean;
  webhookToleranceSeconds?: number;
  sandboxMode?: boolean;
  webhookEndpoint?: string;
  requiredEnvVars: string[];
}

export const SubscriptionPricingView: React.FC<SubscriptionPricingViewProps> = ({
  user,
  language,
  planTier,
  subscription,
  usage,
  savedRoomsCount,
  roomLayoutsCount,
  invoices,
  onSignIn,
  onRequestCancelOrDowngrade,
  onSubscriptionSynced,
}) => {
  const isBn = language === 'bn';
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    subscription?.billingCycle || 'monthly'
  );
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [pendingDowngradeTier, setPendingDowngradeTier] = useState<PlanTier | null>(null);
  const [pendingStripeRedirect, setPendingStripeRedirect] = useState<PendingStripeRedirect | null>(null);
  const [verifyingSession, setVerifyingSession] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingStatus(true);
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((data) => {
        if (active) setBillingStatus(data);
      })
      .catch(() => {
        if (active) setBillingStatus(null);
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const verifyPendingSession = async (silent = false) => {
    if (!user || !pendingStripeRedirect) return;
    setVerifyingSession(true);
    try {
      const idToken = await user.getIdToken();
      if (pendingStripeRedirect.kind === 'checkout' && pendingStripeRedirect.sessionId) {
        const resp = await fetch('/api/stripe/verify-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ sessionId: pendingStripeRedirect.sessionId }),
        });
        const data = await resp.json();
        if (resp.ok && data?.subscription) {
          onSubscriptionSynced?.(data.subscription, data.invoices);
          setPendingStripeRedirect(null);
          setNotice({
            type: 'info',
            text: isBn
              ? 'পেমেন্ট যাচাই সম্পন্ন হয়েছে! আপনার নতুন প্ল্যান এখন সক্রিয়।'
              : 'Payment verified! Your updated subscription plan is now active.',
          });
          return;
        }
        if (!silent) {
          setNotice({
            type: 'info',
            text:
              data?.error ||
              (isBn
                ? 'Stripe-এ পেমেন্ট সম্পন্ন করে তারপর আবার যাচাই করুন।'
                : 'Complete your payment in the Stripe tab first, then click Verify Payment.'),
          });
        }
      } else {
        const resp = await fetch('/api/stripe/subscription', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.subscription) {
            onSubscriptionSynced?.(data.subscription, data.invoices);
          }
          if (!silent) {
            setPendingStripeRedirect(null);
            setNotice({
              type: 'info',
              text: isBn ? 'বিলিং তথ্য আপডেট করা হয়েছে।' : 'Subscription status refreshed.',
            });
          }
        }
      }
    } catch {
      if (!silent) {
        setNotice({
          type: 'error',
          text: isBn ? 'সাবস্ক্রিপশন যাচাই করা যায়নি।' : 'Unable to verify subscription status right now.',
        });
      }
    } finally {
      setVerifyingSession(false);
    }
  };

  useEffect(() => {
    if (!pendingStripeRedirect || !user) return;
    const handleFocus = () => {
      verifyPendingSession(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [pendingStripeRedirect, user]);

  const currentSpec = PLAN_SPECS[planTier];

  const handleStartCheckout = async (targetTier: PlanTier) => {
    setNotice(null);
    if (!user) {
      onSignIn();
      return;
    }

    if (targetTier === 'free') {
      setPendingDowngradeTier('free');
      return;
    }

    setCheckoutTier(targetTier);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ planTier: targetTier, billingCycle }),
      });
      const data = await resp.json();
      if (resp.ok && data.url) {
        if (isEmbeddedIframe()) {
          setCopiedLink(false);
          setPendingStripeRedirect({
            kind: 'checkout',
            url: data.url,
            sessionId: data.sessionId,
            planTier: targetTier,
            billingCycle,
          });
        } else {
          window.location.assign(data.url);
        }
        return;
      }
      setNotice({
        type: 'info',
        text:
          data.error ||
          (isBn
            ? 'লাইভ পেমেন্ট এখনো সক্রিয় করা হয়নি। সার্ভার এনভায়রনমেন্টে Stripe কী কনফিগার করুন।'
            : 'Live Stripe checkout is awaiting merchant Stripe API credentials in the server environment.'),
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to contact billing server.',
      });
    } finally {
      setCheckoutTier(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setNotice(null);
    if (!user) {
      onSignIn();
      return;
    }
    setOpeningPortal(true);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/billing/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await resp.json();
      if (resp.ok && data.url) {
        if (isEmbeddedIframe()) {
          setCopiedLink(false);
          setPendingStripeRedirect({
            kind: 'portal',
            url: data.url,
          });
        } else {
          window.location.assign(data.url);
        }
        return;
      }
      setNotice({
        type: 'info',
        text: data.error || (isBn ? 'Stripe বিলিং পোর্টাল খোলা যায়নি।' : 'Unable to open Stripe billing portal.'),
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to contact billing server.' });
    } finally {
      setOpeningPortal(false);
    }
  };

  const usageMeters = [
    {
      label: isBn ? 'মাসিক রুম বিশ্লেষণ' : 'Monthly Room Scans',
      used: usage.roomAnalyses,
      limit: currentSpec.monthlyRoomAnalyses,
    },
    {
      label: isBn ? 'মাসিক AI রিডিজাইন' : 'Monthly AI Redesigns',
      used: usage.aiRedesigns,
      limit: currentSpec.monthlyRedesigns,
    },
    {
      label: isBn ? 'মাসিক AI কোচ মেসেজ' : 'Monthly AI Coach Messages',
      used: usage.aiCoachMessages,
      limit: currentSpec.monthlyCoachMessages,
    },
    {
      label: isBn ? 'সংরক্ষিত রুম' : 'Saved Room Plans',
      used: savedRoomsCount,
      limit: currentSpec.maxSavedRooms,
    },
    {
      label: isBn ? '২ডি রুম লেআউট' : 'Saved 2D Layouts',
      used: roomLayoutsCount,
      limit: currentSpec.maxRoomLayouts,
    },
  ];

  const plans: PlanTier[] = ['free', 'pro', 'premium'];

  const comparisonRows: Array<{
    feature: string;
    free: string | boolean;
    pro: string | boolean;
    premium: string | boolean;
  }> = [
    {
      feature: isBn ? 'মাসিক AI রুম বিশ্লেষণ' : 'Monthly AI Room Scans',
      free: `${PLAN_SPECS.free.monthlyRoomAnalyses} / mo`,
      pro: `${PLAN_SPECS.pro.monthlyRoomAnalyses} / mo`,
      premium: `${PLAN_SPECS.premium.monthlyRoomAnalyses} / mo`,
    },
    {
      feature: isBn ? 'AI রুম রিডিজাইন প্রিভিউ' : 'AI Room Redesign Previews',
      free: `${PLAN_SPECS.free.monthlyRedesigns} / mo`,
      pro: `${PLAN_SPECS.pro.monthlyRedesigns} / mo`,
      premium: `${PLAN_SPECS.premium.monthlyRedesigns} / mo`,
    },
    {
      feature: isBn ? 'সংরক্ষিত রুম ও লেআউট' : 'Saved Rooms & 2D Layouts',
      free: `${PLAN_SPECS.free.maxSavedRooms} rooms · ${PLAN_SPECS.free.maxRoomLayouts} layouts`,
      pro: `${PLAN_SPECS.pro.maxSavedRooms} rooms · ${PLAN_SPECS.pro.maxRoomLayouts} layouts`,
      premium: `${PLAN_SPECS.premium.maxSavedRooms} rooms · ${PLAN_SPECS.premium.maxRoomLayouts} layouts`,
    },
    {
      feature: isBn ? 'ভয়েস AI কোচ মেসেজ' : 'Voice AI Coach Quota',
      free: `${PLAN_SPECS.free.monthlyCoachMessages} / mo`,
      pro: `${PLAN_SPECS.pro.monthlyCoachMessages} / mo`,
      premium: `${PLAN_SPECS.premium.monthlyCoachMessages} / mo`,
    },
    {
      feature: isBn ? 'PDF রুম প্ল্যান ও বাজেট রিপোর্ট' : 'Downloadable PDF Reports',
      free: false,
      pro: true,
      premium: true,
    },
    {
      feature: isBn ? 'অ্যাডভান্সড পরিসংখ্যান ও প্রবণতা' : 'Advanced Analytics & Trends',
      free: false,
      pro: true,
      premium: true,
    },
    {
      feature: isBn ? 'ফ্যামিলি ও হাউসহোল্ড কোলাবরেশন' : 'Family Hub Collaboration',
      free: false,
      pro: false,
      premium: true,
    },
    {
      feature: isBn ? 'প্রাইওরিটি AI ও ফিচার এক্সেস' : 'Priority AI & Early Features',
      free: false,
      pro: false,
      premium: true,
    },
  ];

  const renderCell = (val: string | boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <Check className="w-4 h-4 text-[#163D32] dark:text-[#E9B95B] mx-auto" />
      ) : (
        <X className="w-4 h-4 text-[#163D32]/30 dark:text-[#9FC6B0]/30 mx-auto" />
      );
    }
    return <span className="font-mono text-xs tabular-nums">{val}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header & Current Plan Summary */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#163D32]/65 dark:text-[#9FC6B0]">
            {isBn ? 'সাবস্ক্রিপশন ও ব্যবহার সীমা' : 'Subscription & Usage Quotas'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'আপনার প্ল্যান:' : 'Active Plan:'}{' '}
            <span className="text-[#163D32] dark:text-[#E9B95B]">
              {isBn ? currentSpec.nameBn : currentSpec.name}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-[#163D32]/75 dark:text-[#B9D1C3]">
            {subscription?.renewsAt
              ? `${isBn ? 'রিনিউ তারিখ:' : 'Current period renews:'} ${new Date(
                  subscription.renewsAt
                ).toLocaleDateString()}`
              : isBn
              ? 'ফ্রি স্টার্টার প্ল্যান চালু আছে। যেকোনো সময় আপগ্রেড করতে পারেন।'
              : 'You are currently on the Free Starter tier. Upgrade when your home needs grow.'}
          </p>
        </div>

        {/* Billing Cycle Segmented Control */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {user && (planTier !== 'free' || Boolean(subscription?.customerId)) && (
              <button
                type="button"
                disabled={openingPortal}
                onClick={handleOpenBillingPortal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold transition-colors whitespace-nowrap"
              >
                {openingPortal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                <span>{isBn ? 'বিলিং পোর্টাল' : 'Manage Billing'}</span>
              </button>
            )}
            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638]">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  billingCycle === 'monthly'
                    ? 'bg-[#163D32] text-white'
                    : 'text-[#163D32]/75 dark:text-[#B9D1C3]'
                }`}
              >
                {isBn ? 'মাসিক বিলিং' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  billingCycle === 'annual'
                    ? 'bg-[#E9B95B] text-[#163D32]'
                    : 'text-[#163D32]/75 dark:text-[#B9D1C3]'
                }`}
              >
                {isBn ? 'বার্ষিক (২ মাস ফ্রি)' : 'Annual (2 Months Free)'}
              </button>
            </div>
          </div>
      </div>

      {/* Real Stripe Integration Status Notice (Honest Configuration & Sandbox Reporting) */}
      {!loadingStatus && billingStatus && !billingStatus.configured && (
        <div className="bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-[#E9B95B] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-[#163D32]/85 dark:text-[#B9D1C3] space-y-1">
            <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
              {isBn ? 'পেমেন্ট গেটওয়ে কনফিগারেশন তথ্য' : 'Payment Gateway Configuration Status'}
            </div>
            <p>
              {isBn
                ? 'এই ওয়ার্কস্পেসে Stripe চেকআউট ও স্বাক্ষরিত ওয়েবহুক (/api/stripe/webhook) প্রস্তুত আছে। লাইভ বা স্যান্ডবক্স পেমেন্ট চালু করতে সার্ভার সিক্রেটসে Stripe কী যুক্ত করুন (সিমুলেটেড পেমেন্ট সক্রিয় করা হয়নি)।'
                : 'Stripe Checkout & signed webhook verification (/api/stripe/webhook) are ready on the server. Add Stripe Sandbox or Live credentials in server environment secrets to activate checkout (no simulated payments are used).'}
            </p>
          </div>
        </div>
      )}

      {!loadingStatus && billingStatus?.configured && billingStatus?.sandboxMode && (
        <div className="bg-[#DDF3E5]/50 dark:bg-[#182C24] border border-[#163D32]/20 dark:border-[#264638] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'Stripe স্যান্ডবক্স (টেস্ট) মোড সক্রিয়' : 'Stripe Sandbox (Test Mode) Active'}
          </span>
          <span className="font-mono text-[11px] text-[#163D32]/75 dark:text-[#9FC6B0]">
            Webhook:{' '}
            {billingStatus.hasWebhookSecret
              ? `Verified (${billingStatus.webhookToleranceSeconds || 300}s)`
              : `Optional in Dev (${billingStatus.webhookToleranceSeconds || 300}s)`}
          </span>
        </div>
      )}

      {subscription?.status === 'past_due' && (
        <div className="rounded-2xl px-4 py-3 border bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isBn
              ? 'সর্বশেষ সাবস্ক্রিপশন পেমেন্ট ব্যর্থ হয়েছে (Past Due)। সেবা চালু রাখতে অনুগ্রহ করে আপনার পেমেন্ট মেথড আপডেট করুন।'
              : 'Your recent subscription renewal payment failed (Past Due). Please update your payment method in Stripe to prevent cancellation.'}
          </span>
        </div>
      )}

      {subscription?.status === 'active' && subscription.cancelAtPeriodEnd && (
        <div className="rounded-2xl px-4 py-3 border bg-[#F7F9F6] dark:bg-[#182C24] border-[#E9B95B]/50 text-[#163D32] dark:text-[#EDF4EF] flex items-start gap-2.5 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 text-[#E9B95B] shrink-0 mt-0.5" />
          <span>
            {isBn
              ? 'চলতি বিলিং পিরিয়ড শেষে আপনার সাবস্ক্রিপশন বাতিল হওয়ার জন্য নির্ধারিত রয়েছে।'
              : `Your subscription is set to cancel at the end of the current period (${new Date(subscription.renewsAt).toLocaleDateString()}).`}
          </span>
        </div>
      )}

      {subscription?.syncStatus === 'pending_admin_sync' && (
        <div className="rounded-2xl px-4 py-2.5 border bg-[#F7F9F6] dark:bg-[#182C24] border-[#163D32]/15 dark:border-[#264638] text-[#163D32]/80 dark:text-[#B9D1C3] text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            {isBn
              ? 'Stripe ওয়েবহুক থেকে আপডেট ভেরিফাইড হয়েছে (অ্যাডমিন Firestore সিঙ্ক পেন্ডিং)।'
              : 'Verified via Stripe webhook (Starter Tier Firestore admin sync pending).'}
          </span>
          {subscription.customerId && (
            <span className="font-mono text-[11px] text-[#163D32]/65 dark:text-[#9FC6B0]">
              Customer: {subscription.customerId}
            </span>
          )}
        </div>
      )}

      {pendingStripeRedirect && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#163D32]/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#DDF3E5] text-[#163D32] flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#163D32] dark:text-[#EDF4EF]">
                    {pendingStripeRedirect.kind === 'checkout'
                      ? isBn
                        ? 'Stripe চেকআউট প্রস্তুত'
                        : 'Continue to Stripe Checkout'
                      : isBn
                      ? 'Stripe বিলিং পোর্টাল প্রস্তুত'
                      : 'Open Stripe Billing Portal'}
                  </h3>
                  <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                    {pendingStripeRedirect.planTier
                      ? `${pendingStripeRedirect.planTier.toUpperCase()} (${pendingStripeRedirect.billingCycle})`
                      : isBn
                      ? 'নিরাপদ নতুন ট্যাবে খুলবে'
                      : 'Opens securely in a new browser tab'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingStripeRedirect(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-[#163D32]/60 hover:text-[#163D32] hover:bg-[#163D32]/10 dark:text-[#9FC6B0] dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#163D32]/80 dark:text-[#B9D1C3] leading-relaxed">
              {isBn
                ? 'প্রিভিউ ফ্রেমের ভেতরে Stripe পেমেন্ট পেজ লোড হতে বাধা পায়। নিচের বাটনে ক্লিক করে নতুন ট্যাবে নিরাপদ Stripe পেজ খুলুন এবং পেমেন্ট শেষে এখানে ফিরে আসুন।'
                : 'Stripe Checkout cannot load inside an embedded preview frame. Open the secure Stripe page in a new tab below, complete checkout, and return here to sync your plan.'}
            </p>

            <div className="space-y-2.5">
              <a
                href={pendingStripeRedirect.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-[#163D32] hover:bg-[#102E25] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <span>
                  {pendingStripeRedirect.kind === 'checkout'
                    ? isBn
                      ? 'নতুন ট্যাবে Stripe Checkout খুলুন'
                      : 'Open Stripe Checkout'
                    : isBn
                    ? 'নতুন ট্যাবে Billing Portal খুলুন'
                    : 'Open Billing Portal'}
                </span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={verifyingSession}
                  onClick={() => verifyPendingSession(false)}
                  className="py-2 px-3 rounded-xl bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {verifyingSession ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{isBn ? 'পেমেন্ট যাচাই করুন' : 'Verify & Sync Plan'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pendingStripeRedirect.url);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    } catch {
                      // ignore clipboard restrictions
                    }
                  }}
                  className="py-2 px-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/15 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copiedLink
                      ? isBn
                        ? 'লিংক কপি হয়েছে'
                        : 'Link Copied'
                      : isBn
                      ? 'লিঙ্ক কপি করুন'
                      : 'Copy Stripe Link'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-2xl px-4 py-3 border flex items-start gap-2.5 text-xs sm:text-sm ${
            notice.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-[#DDF3E5]/70 dark:bg-[#1A3329] border-[#163D32]/20 dark:border-[#2E5747] text-[#163D32] dark:text-[#EDF4EF]'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* Monthly Quota Usage Meters */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#E9B95B]" />
            <span>
              {isBn ? `চলতি মাসের ব্যবহার (${usage.monthKey})` : `Usage This Cycle (${usage.monthKey})`}
            </span>
          </h3>
          {!user && (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163D32] dark:text-[#E9B95B] hover:underline"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isBn ? 'সিঙ্ক করতে সাইন ইন করুন' : 'Sign in to sync quotas'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {usageMeters.map((m) => {
            const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
            return (
              <div
                key={m.label}
                className="p-3.5 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] space-y-2"
              >
                <div className="text-xs font-semibold text-[#163D32]/75 dark:text-[#9FC6B0] truncate">
                  {m.label}
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#163D32] dark:text-[#EDF4EF]">
                  {m.used} / {m.limit}
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#163D32]/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 90 ? 'bg-rose-500' : 'bg-[#163D32] dark:bg-[#E9B95B]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {plans.map((tierKey) => {
          const spec = PLAN_SPECS[tierKey];
          const isCurrent = planTier === tierKey;
          const isPopular = tierKey === 'pro';
          const price =
            billingCycle === 'annual' ? spec.annualMonthlyPriceUsd : spec.monthlyPriceUsd;

          const features = [
            isBn
              ? `মাসে ${spec.monthlyRoomAnalyses}টি AI রুম বিশ্লেষণ`
              : `${spec.monthlyRoomAnalyses} AI room analyses / mo`,
            isBn
              ? `মাসে ${spec.monthlyRedesigns}টি AI রুম রিডিজাইন`
              : `${spec.monthlyRedesigns} AI room redesigns / mo`,
            isBn
              ? `${spec.maxSavedRooms}টি সেভড রুম ও ${spec.maxRoomLayouts}টি ২ডি লেআউট`
              : `Up to ${spec.maxSavedRooms} saved rooms & ${spec.maxRoomLayouts} layouts`,
            isBn
              ? `মাসে ${spec.monthlyCoachMessages}টি AI কোচ মেসেজ`
              : `${spec.monthlyCoachMessages} Voice AI Coach replies / mo`,
            spec.pdfReports
              ? isBn
                ? 'PDF রিপোর্ট ও বাজেট এক্সপোর্ট'
                : 'PDF Room & Budget reports'
              : isBn
              ? 'বেসিক চেকলিস্ট ও CSV এক্সপোর্ট'
              : 'Checklist & CSV exports',
            spec.familyCollaboration
              ? isBn
                ? 'ফ্যামিলি হাব শেয়ারিং ও প্রাইওরিটি AI'
                : 'Family Hub collaboration & priority AI'
              : isBn
              ? 'স্মার্ট স্টোরেজ ও শপিং অ্যাসিস্ট্যান্ট'
              : 'Smart Storage & Shopping Assistant',
          ];

          return (
            <div
              key={tierKey}
              className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border transition-colors ${
                isPopular
                  ? 'bg-[#163D32] text-white border-[#163D32] shadow-md'
                  : 'bg-white dark:bg-[#13241D] text-[#163D32] dark:text-[#EDF4EF] border-[#163D32]/15 dark:border-[#264638]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3
                      className={`text-lg font-bold ${
                        isPopular ? 'text-white' : 'text-[#163D32] dark:text-[#EDF4EF]'
                      }`}
                    >
                      {isBn ? spec.nameBn : spec.name}
                    </h3>
                    <p
                      className={`text-xs mt-0.5 ${
                        isPopular ? 'text-[#DDF3E5]/85' : 'text-[#163D32]/70 dark:text-[#9FC6B0]'
                      }`}
                    >
                      {isBn ? spec.audienceBn : spec.audience}
                    </p>
                  </div>
                  {isPopular && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#E9B95B] text-[#163D32] shrink-0">
                      {isBn ? 'জনপ্রিয়' : 'Recommended'}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span className="text-3xl font-extrabold">
                    ${billingCycle === 'annual' ? spec.annualTotalUsd : spec.monthlyPriceUsd}
                  </span>
                  <span
                    className={`text-xs ${
                      isPopular ? 'text-[#DDF3E5]/80' : 'text-[#163D32]/65 dark:text-[#9FC6B0]'
                    }`}
                  >
                    / {billingCycle === 'annual' ? (isBn ? 'বছর' : 'year') : (isBn ? 'মাস' : 'month')}
                    {billingCycle === 'annual' && spec.annualMonthlyPriceUsd > 0
                      ? ` ($${spec.annualMonthlyPriceUsd}/mo)`
                      : ''}
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm pt-2 border-t border-current/10">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isPopular ? 'text-[#E9B95B]' : 'text-[#163D32] dark:text-[#E9B95B]'
                        }`}
                      />
                      <span className={isPopular ? 'text-[#F7F9F6]' : ''}>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                {isCurrent ? (
                  <div
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center border ${
                      isPopular
                        ? 'bg-white/15 border-white/25 text-white'
                        : 'bg-[#DDF3E5] border-[#163D32]/20 text-[#163D32]'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 inline mr-1.5" />
                    {isBn ? 'আপনার বর্তমান প্ল্যান' : 'Current Active Plan'}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={checkoutTier === tierKey}
                    onClick={() => handleStartCheckout(tierKey)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                      isPopular
                        ? 'bg-[#E9B95B] hover:bg-[#dfb04f] text-[#163D32]'
                        : 'bg-[#163D32] hover:bg-[#102E25] text-white'
                    }`}
                  >
                    {checkoutTier === tierKey ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>
                          {tierKey === 'free'
                            ? isBn
                              ? 'ফ্রি প্ল্যানে নামুন'
                              : 'Downgrade to Free'
                            : isBn
                            ? 'প্ল্যান বেছে নিন'
                            : `Select ${spec.name.split(' ')[0]}`}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Matrix */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[#163D32]/10 dark:border-[#264638] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E9B95B]" />
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF]">
            {isBn ? 'বিস্তারিত প্ল্যান তুলনা' : 'Complete Plan Comparison'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F7F9F6] dark:bg-[#182C24] border-b border-[#163D32]/10 dark:border-[#264638] text-[#163D32] dark:text-[#EDF4EF]">
                <th className="py-3 px-4 font-bold">{isBn ? 'ফিচার' : 'Capability'}</th>
                <th className="py-3 px-4 font-bold text-center">Free</th>
                <th className="py-3 px-4 font-bold text-center">Pro</th>
                <th className="py-3 px-4 font-bold text-center">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#163D32]/10 dark:divide-[#264638]">
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="hover:bg-[#F7F9F6]/60 dark:hover:bg-[#182C24]/50">
                  <td className="py-3 px-4 font-medium text-[#163D32] dark:text-[#EDF4EF]">
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-center text-[#163D32]/80 dark:text-[#B9D1C3]">
                    {renderCell(row.free)}
                  </td>
                  <td className="py-3 px-4 text-center text-[#163D32] dark:text-[#EDF4EF] font-semibold">
                    {renderCell(row.pro)}
                  </td>
                  <td className="py-3 px-4 text-center text-[#163D32] dark:text-[#E9B95B] font-semibold">
                    {renderCell(row.premium)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white dark:bg-[#13241D] border border-[#163D32]/10 dark:border-[#264638] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-base text-[#163D32] dark:text-[#EDF4EF] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#E9B95B]" />
            <span>{isBn ? 'বিলিং ইতিহাস ও ইনভয়েস' : 'Billing History & Invoices'}</span>
          </h3>
        </div>

        {invoices.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#163D32]/65 dark:text-[#9FC6B0] py-4">
            {isBn
              ? 'এখনো কোনো পেইড ইনভয়েস তৈরি হয়নি। সাবস্ক্রিপশন শুরু হলে রসিদ এখানে দেখা যাবে।'
              : 'No paid invoices yet. Receipts will appear here once a subscription charge is processed.'}
          </p>
        ) : (
          <div className="divide-y divide-[#163D32]/10 dark:divide-[#264638]">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <div>
                  <div className="font-bold text-[#163D32] dark:text-[#EDF4EF]">
                    {inv.description || `NeatSpace ${inv.planTier.toUpperCase()}`}
                  </div>
                  <div className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                    {new Date(inv.createdAt).toLocaleDateString()} · {inv.planTier.toUpperCase()} ·{' '}
                    {inv.status}
                  </div>
                </div>
                <div className="font-mono font-bold tabular-nums text-[#163D32] dark:text-[#E9B95B]">
                  ${(inv.amountCents / 100).toFixed(2)} {inv.currency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDowngradeTier)}
        title={isBn ? 'ফ্রি প্ল্যানে ফিরে যাবেন?' : 'Switch Back to Free Plan?'}
        description={
          isBn
            ? 'পেমেন্ট সাবস্ক্রিপশন বাতিল করলে আপনার চলতি বিলিং সাইকেল শেষে অ্যাকাউন্ট ফ্রি কোটায় চলে যাবে।'
            : 'Canceling a paid tier schedules your workspace to return to Free Starter quotas at the end of the billing cycle.'
        }
        confirmLabel={isBn ? 'নিশ্চিত করুন' : 'Confirm'}
        cancelLabel={isBn ? 'থাকুক' : 'Keep Plan'}
        destructive={false}
        onCancel={() => setPendingDowngradeTier(null)}
        onConfirm={() => {
          if (pendingDowngradeTier && onRequestCancelOrDowngrade) {
            onRequestCancelOrDowngrade(pendingDowngradeTier);
          }
          setPendingDowngradeTier(null);
        }}
      />
    </div>
  );
};
