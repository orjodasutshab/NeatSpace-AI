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
              ? 'à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¯à¦¾à¦šà¦¾à¦‡ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦¹à§Ÿà§‡à¦›à§‡! à¦†à¦ªà¦¨à¦¾à¦° à¦¨à¦¤à§à¦¨ à¦ªà§à¦²à§à¦¯à¦¾à¦¨ à¦à¦–à¦¨ à¦¸à¦•à§à¦°à¦¿à§Ÿà¥¤'
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
                ? 'Stripe-à¦ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦°à§‡ à¦¤à¦¾à¦°à¦ªà¦° à¦†à¦¬à¦¾à¦° à¦¯à¦¾à¦šà¦¾à¦‡ à¦•à¦°à§à¦¨à¥¤'
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
              text: isBn ? 'à¦¬à¦¿à¦²à¦¿à¦‚ à¦¤à¦¥à§à¦¯ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à¦¾ à¦¹à§Ÿà§‡à¦›à§‡à¥¤' : 'Subscription status refreshed.',
            });
          }
        }
      }
    } catch {
      if (!silent) {
        setNotice({
          type: 'error',
          text: isBn ? 'à¦¸à¦¾à¦¬à¦¸à§à¦•à§à¦°à¦¿à¦ªà¦¶à¦¨ à¦¯à¦¾à¦šà¦¾à¦‡ à¦•à¦°à¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤' : 'Unable to verify subscription status right now.',
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
            ? 'à¦²à¦¾à¦‡à¦­ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦à¦–à¦¨à§‹ à¦¸à¦•à§à¦°à¦¿à§Ÿ à¦•à¦°à¦¾ à¦¹à§Ÿà¦¨à¦¿à¥¤ à¦¸à¦¾à¦°à§à¦­à¦¾à¦° à¦à¦¨à¦­à¦¾à§Ÿà¦°à¦¨à¦®à§‡à¦¨à§à¦Ÿà§‡ Stripe à¦•à§€ à¦•à¦¨à¦«à¦¿à¦—à¦¾à¦° à¦•à¦°à§à¦¨à¥¤'
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
        text: data.error || (isBn ? 'Stripe à¦¬à¦¿à¦²à¦¿à¦‚ à¦ªà§‹à¦°à§à¦Ÿà¦¾à¦² à¦–à§‹à¦²à¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤' : 'Unable to open Stripe billing portal.'),
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to contact billing server.' });
    } finally {
      setOpeningPortal(false);
    }
  };

  const usageMeters = [
    {
      label: isBn ? 'à¦®à¦¾à¦¸à¦¿à¦• à¦°à§à¦® à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£' : 'Monthly Room Scans',
      used: usage.roomAnalyses,
      limit: currentSpec.monthlyRoomAnalyses,
    },
    {
      label: isBn ? 'à¦®à¦¾à¦¸à¦¿à¦• AI à¦°à¦¿à¦¡à¦¿à¦œà¦¾à¦‡à¦¨' : 'Monthly AI Redesigns',
      used: usage.aiRedesigns,
      limit: currentSpec.monthlyRedesigns,
    },
    {
      label: isBn ? 'à¦®à¦¾à¦¸à¦¿à¦• AI à¦•à§‹à¦š à¦®à§‡à¦¸à§‡à¦œ' : 'Monthly AI Coach Messages',
      used: usage.aiCoachMessages,
      limit: currentSpec.monthlyCoachMessages,
    },
    {
      label: isBn ? 'à¦¸à¦‚à¦°à¦•à§à¦·à¦¿à¦¤ à¦°à§à¦®' : 'Saved Room Plans',
      used: savedRoomsCount,
      limit: currentSpec.maxSavedRooms,
    },
    {
      label: isBn ? 'à§¨à¦¡à¦¿ à¦°à§à¦® à¦²à§‡à¦†à¦‰à¦Ÿ' : 'Saved 2D Layouts',
      used: roomLayoutsCount,
      limit: currentSpec.maxRoomLayouts,
