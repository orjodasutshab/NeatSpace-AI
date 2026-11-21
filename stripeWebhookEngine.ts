import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { BillingCycle, BillingInvoice, PlanTier, SubscriptionRecord } from './src/types';
import { PLAN_SPECS } from './src/planConfig';

export interface ServerStripeSubscriptionRecord extends SubscriptionRecord {
  userKey: string;
  uid?: string;
  email?: string;
  updatedAt: number;
  pendingFirestoreSync: boolean;
  syncedToFirestoreAt?: number;
  livemode?: boolean;
}

export interface WebhookEventLogEntry {
  id: string;
  type: string;
  receivedAt: number;
  userKey: string;
  outcome: string;
  livemode: boolean;
  statusBefore?: string;
  statusAfter?: string;
  planTier?: PlanTier;
}

interface StripeStoreSchema {
  processedEvents: Record<string, WebhookEventLogEntry>;
  subscriptions: Record<string, ServerStripeSubscriptionRecord>;
  invoicesByUserKey: Record<string, BillingInvoice[]>;
  uidByCustomerId: Record<string, string>;
  uidBySubscriptionId: Record<string, string>;
  uidByEmail: Record<string, string>;
}

const DEFAULT_STORE: StripeStoreSchema = {
  processedEvents: {},
  subscriptions: {},
  invoicesByUserKey: {},
  uidByCustomerId: {},
  uidBySubscriptionId: {},
  uidByEmail: {},
};

const MAX_STORED_EVENTS = 2000;

export function getDefaultStorePath(): string {
  return path.join(process.cwd(), '.data', 'stripe-webhook-store.json');
}

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

/**
 * Cryptographically verifies Stripe's `Stripe-Signature` header (`t=...,v1=...`)
 * using HMAC-SHA256 over `${t}.${rawBody}` with replay-window enforcement and
 * constant-time comparison across all `v1` signatures (supporting secret rotation).
 */
export function verifyStripeWebhookSignature(
  rawBody: Buffer | string,
  sigHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): SignatureVerificationResult {
  if (!webhookSecret || webhookSecret.startsWith('MY_')) {
    return { valid: false, error: 'STRIPE_WEBHOOK_SECRET is not configured on the server.' };
  }
  if (!sigHeader || typeof sigHeader !== 'string') {
    return { valid: false, error: 'Missing Stripe-Signature header.' };
  }
  if (!rawBody || (typeof rawBody === 'string' ? rawBody.length === 0 : rawBody.length === 0)) {
    return { valid: false, error: 'Missing raw webhook request body.' };
  }

  let timestampStr = '';
  const v1Signatures: string[] = [];

  for (const segment of sigHeader.split(',')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = segment.slice(0, eqIdx).trim();
    const val = segment.slice(eqIdx + 1).trim();
    if (key === 't' && val) {
      timestampStr = val;
    } else if (key === 'v1' && val) {
      v1Signatures.push(val);
    }
  }

  if (!timestampStr || v1Signatures.length === 0) {
    return { valid: false, error: 'Malformed Stripe-Signature header (missing t or v1).' };
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { valid: false, error: 'Invalid Stripe-Signature timestamp.' };
  }

  if (toleranceSeconds > 0 && Math.abs(nowUnixSeconds - timestamp) > toleranceSeconds) {
    return { valid: false, error: 'Stripe webhook timestamp outside replay tolerance window.' };
  }

  const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signedPayload = `${timestampStr}.${rawText}`;
  const expectedHex = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  for (const candidateHex of v1Signatures) {
    if (!/^[0-9a-fA-F]+$/.test(candidateHex) || candidateHex.length !== expectedHex.length) {
      continue;
    }
    const providedBuf = Buffer.from(candidateHex, 'hex');
    if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: true, timestamp };
    }
  }

  return { valid: false, error: 'Stripe webhook signature verification failed.' };
}

export function getStripeWebhookToleranceSeconds(): number {
  const raw = process.env.STRIPE_WEBHOOK_TOLERANCE ?? '300';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 300;
}

export function resolveStripePriceMap(): {
  pro_monthly?: string;
  pro_annual?: string;
  premium_monthly?: string;
  premium_annual?: string;
} {
  const clean = (v?: string) => (v && !v.startsWith('MY_') ? v.trim() : undefined);
  return {
    pro_monthly: clean(process.env.STRIPE_PRICE_PRO_MONTH) || clean(process.env.STRIPE_PRICE_PRO_MONTHLY),
    pro_annual: clean(process.env.STRIPE_PRICE_PRO_ANNUAL),
    premium_monthly: clean(process.env.STRIPE_PRICE_PREMIUM_MC) || clean(process.env.STRIPE_PRICE_PREMIUM_MONTHLY),
    premium_annual: clean(process.env.STRIPE_PRICE_PREMIUM_AN) || clean(process.env.STRIPE_PRICE_PREMIUM_ANNUAL),
  };
}

export function resolvePlanFromStripePriceOrMetadata(input: {
  priceId?: string;
  metadata?: Record<string, any> | null;
  interval?: string;
  fallbackTier?: PlanTier;
  fallbackCycle?: BillingCycle;
}): { planTier: PlanTier; billingCycle: BillingCycle; priceId?: string } {
  const priceId = input.priceId ? String(input.priceId) : undefined;
  const metaTierRaw = String(input.metadata?.planTier || '').toLowerCase();
  const metaCycleRaw = String(input.metadata?.billingCycle || '').toLowerCase();

  let planTier: PlanTier =
    metaTierRaw === 'pro' || metaTierRaw === 'premium' || metaTierRaw === 'free'
      ? (metaTierRaw as PlanTier)
      : input.fallbackTier || 'pro';

  let billingCycle: BillingCycle =
    metaCycleRaw === 'annual' || metaCycleRaw === 'monthly'
      ? (metaCycleRaw as BillingCycle)
      : input.interval === 'year'
      ? 'annual'
      : input.interval === 'month'
      ? 'monthly'
      : input.fallbackCycle || 'monthly';

  const priceMap = resolveStripePriceMap();
  if (priceId) {
    if (priceMap.pro_monthly && priceId === priceMap.pro_monthly) {
      planTier = 'pro';
      billingCycle = 'monthly';
    } else if (priceMap.pro_annual && priceId === priceMap.pro_annual) {
      planTier = 'pro';
      billingCycle = 'annual';
    } else if (priceMap.premium_monthly && priceId === priceMap.premium_monthly) {
      planTier = 'premium';
      billingCycle = 'monthly';
    } else if (priceMap.premium_annual && priceId === priceMap.premium_annual) {
      planTier = 'premium';
      billingCycle = 'annual';
    }
  }

  return { planTier, billingCycle, priceId };
}

export class StripeWebhookStore {
  private filePath: string;
  private state: StripeStoreSchema;

  constructor(filePath = getDefaultStorePath()) {
    this.filePath = filePath;
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): StripeStoreSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          processedEvents: parsed?.processedEvents && typeof parsed.processedEvents === 'object' ? parsed.processedEvents : {},
          subscriptions: parsed?.subscriptions && typeof parsed.subscriptions === 'object' ? parsed.subscriptions : {},
          invoicesByUserKey: parsed?.invoicesByUserKey && typeof parsed.invoicesByUserKey === 'object' ? parsed.invoicesByUserKey : {},
          uidByCustomerId: parsed?.uidByCustomerId && typeof parsed.uidByCustomerId === 'object' ? parsed.uidByCustomerId : {},
          uidBySubscriptionId: parsed?.uidBySubscriptionId && typeof parsed.uidBySubscriptionId === 'object' ? parsed.uidBySubscriptionId : {},
          uidByEmail: parsed?.uidByEmail && typeof parsed.uidByEmail === 'object' ? parsed.uidByEmail : {},
        };
      }
    } catch (err) {
      console.warn('Could not read existing Stripe webhook store; initializing fresh store:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const eventKeys = Object.keys(this.state.processedEvents);
      if (eventKeys.length > MAX_STORED_EVENTS) {
        const sorted = eventKeys.sort(
          (a, b) => (this.state.processedEvents[a]?.receivedAt || 0) - (this.state.processedEvents[b]?.receivedAt || 0)
        );
        const toDrop = sorted.slice(0, eventKeys.length - MAX_STORED_EVENTS);
        for (const k of toDrop) {
          delete this.state.processedEvents[k];
        }
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to persist Stripe webhook store:', err);
    }
  }

  public linkUserCorrelations(input: {
    uid?: string;
    email?: string;
    customerId?: string;
    subscriptionId?: string;
  }): void {
    const uid = input.uid ? String(input.uid).trim() : '';
    const email = input.email ? String(input.email).trim().toLowerCase() : '';
    const customerId = input.customerId ? String(input.customerId).trim() : '';
    const subscriptionId = input.subscriptionId ? String(input.subscriptionId).trim() : '';

    if (uid && email) {
      this.state.uidByEmail[email] = uid;
    }
    if (uid && customerId) {
      this.state.uidByCustomerId[customerId] = uid;
    }
    if (uid && subscriptionId) {
      this.state.uidBySubscriptionId[subscriptionId] = uid;
    }

    // Promote any provisional customer:/email: record into the resolved uid bucket
    if (uid) {
      const provisionalKeys = [
        customerId ? `cus:${customerId}` : '',
        subscriptionId ? `sub:${subscriptionId}` : '',
        email ? `email:${email}` : '',
      ].filter(Boolean);

      for (const pKey of provisionalKeys) {
        if (this.state.subscriptions[pKey]) {
          const prev = this.state.subscriptions[pKey];
          const existingUidRec = this.state.subscriptions[uid];
          if (!existingUidRec || prev.updatedAt >= existingUidRec.updatedAt) {
            this.state.subscriptions[uid] = {
              ...prev,
              userKey: uid,
              uid,
              ...(email ? { email } : {}),
            };
          }
          delete this.state.subscriptions[pKey];
        }
        if (this.state.invoicesByUserKey[pKey]?.length) {
          const existingInvs = this.state.invoicesByUserKey[uid] || [];
          const seen = new Set(existingInvs.map((i) => i.id));
          for (const inv of this.state.invoicesByUserKey[pKey]) {
            if (!seen.has(inv.id)) {
              existingInvs.push({ ...inv, userId: uid });
            }
          }
          existingInvs.sort((a, b) => b.createdAt - a.createdAt);
          this.state.invoicesByUserKey[uid] = existingInvs.slice(0, 50);
          delete this.state.invoicesByUserKey[pKey];
        }
      }
    }

    this.persistToDisk();
  }

  public resolveUserKey(input: {
    uid?: string;
    customerId?: string;
    subscriptionId?: string;
    email?: string;
  }): { userKey: string; uid?: string; email?: string } {
    const cleanUid = input.uid ? String(input.uid).trim() : '';
    const cleanEmail = input.email ? String(input.email).trim().toLowerCase() : '';
    const cleanCus = input.customerId ? String(input.customerId).trim() : '';
    const cleanSub = input.subscriptionId ? String(input.subscriptionId).trim() : '';

    const resolvedUid =
      cleanUid ||
      (cleanSub && this.state.uidBySubscriptionId[cleanSub]) ||
      (cleanCus && this.state.uidByCustomerId[cleanCus]) ||
      (cleanEmail && this.state.uidByEmail[cleanEmail]) ||
      undefined;

    if (resolvedUid) {
      this.linkUserCorrelations({
        uid: resolvedUid,
        email: cleanEmail || undefined,
        customerId: cleanCus || undefined,
        subscriptionId: cleanSub || undefined,
      });
      return { userKey: resolvedUid, uid: resolvedUid, email: cleanEmail || undefined };
    }

    if (cleanCus) {
      return { userKey: `cus:${cleanCus}`, email: cleanEmail || undefined };
    }
    if (cleanSub) {
      return { userKey: `sub:${cleanSub}`, email: cleanEmail || undefined };
    }
    if (cleanEmail) {
      return { userKey: `email:${cleanEmail}`, email: cleanEmail };
    }
    return { userKey: 'unassigned' };
  }

  private addInvoice(userKey: string, uid: string | undefined, invoice: BillingInvoice): void {
    const list = this.state.invoicesByUserKey[userKey] || [];
    const idx = list.findIndex((i) => i.id === invoice.id);
    const normalized: BillingInvoice = { ...invoice, userId: uid || userKey };
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.unshift(normalized);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    this.state.invoicesByUserKey[userKey] = list.slice(0, 50);
  }

  public processWebhookEvent(event: any): {
    duplicate: boolean;
    handled: boolean;
    eventId: string;
    type: string;
    userKey: string;
    outcome: string;
    subscription?: ServerStripeSubscriptionRecord;
  } {
    const eventId = String(event?.id || '').trim();
    const eventType = String(event?.type || '').trim();
    const obj = event?.data?.object || {};
    const livemode = Boolean(event?.livemode);

    if (this.state.processedEvents[eventId]) {
      const existingLog = this.state.processedEvents[eventId];
      return {
        duplicate: true,
        handled: true,
        eventId,
        type: eventType,
        userKey: existingLog.userKey,
        outcome: 'duplicate_skipped',
        subscription: this.state.subscriptions[existingLog.userKey],
      };
    }

    const now = Date.now();
    let userKey = 'unassigned';
    let resolvedUid: string | undefined;
    let outcome = 'ignored_unhandled_event_type';
    let handled = true;
    let statusBefore: string | undefined;
    let statusAfter: string | undefined;
    let updatedSub: ServerStripeSubscriptionRecord | undefined;

    if (eventType === 'checkout.session.completed') {
      const customerId = obj.customer ? String(obj.customer) : undefined;
      const subscriptionId = obj.subscription ? String(obj.subscription) : undefined;
      const email = String(obj.customer_email || obj.customer_details?.email || '').toLowerCase() || undefined;
      const candidateUid = obj.client_reference_id || obj.metadata?.uid;

      const resolved = this.resolveUserKey({
        uid: candidateUid,
        customerId,
        subscriptionId,
        email,
      });
      userKey = resolved.userKey;
      resolvedUid = resolved.uid;

      const prev = this.state.subscriptions[userKey];
      statusBefore = prev?.status;

      const { planTier, billingCycle, priceId } = resolvePlanFromStripePriceOrMetadata({
        metadata: obj.metadata,
        fallbackTier: prev?.tier && prev.tier !== 'free' ? prev.tier : 'pro',
        fallbackCycle: prev?.billingCycle || 'monthly',
      });

      const isUnpaid = obj.payment_status === 'unpaid';
      const nextStatus: SubscriptionRecord['status'] = isUnpaid ? 'past_due' : 'active';
      const cycleDays = billingCycle === 'annual' ? 365 : 30;
      const fallbackRenewsAt = now + cycleDays * 86400 * 1000;

      updatedSub = {
        userKey,
        ...(resolvedUid ? { uid: resolvedUid } : {}),
        ...(email || prev?.email ? { email: email || prev?.email } : {}),
        tier: planTier,
        status: nextStatus,
        billingCycle,
        renewsAt: prev?.renewsAt && prev.renewsAt > now ? prev.renewsAt : fallbackRenewsAt,
        provider: 'stripe',
        ...(customerId || prev?.customerId ? { customerId: customerId || prev?.customerId } : {}),
        ...(subscriptionId || prev?.subscriptionId ? { subscriptionId: subscriptionId || prev?.subscriptionId } : {}),
        ...(priceId || prev?.priceId ? { priceId: priceId || prev?.priceId } : {}),
        cancelAtPeriodEnd: false,
        lastEventId: eventId,
        lastEventType: eventType,
        syncStatus: 'pending_admin_sync',
        updatedAt: now,
        pendingFirestoreSync: true,
        livemode,
      };
      this.state.subscriptions[userKey] = updatedSub;
      statusAfter = updatedSub.status;

      if (typeof obj.amount_total === 'number' && obj.amount_total >= 0) {
        const invId = String(obj.invoice || obj.id || `chk_${eventId}`).replace(/[^a-zA-Z0-9_\-]/g, '_');
        this.addInvoice(userKey, resolvedUid, {
          id: invId,
          userId: resolvedUid || userKey,
          amountCents: Math.round(obj.amount_total),
          currency: String(obj.currency || 'usd').toUpperCase(),
          planTier,
          status: isUnpaid ? 'pending' : 'paid',
          description: `NeatSpace ${planTier.toUpperCase()} (${billingCycle}) — Checkout`,
          createdAt: (Number(event.created) || Math.floor(now / 1000)) * 1000,
        });
      }
      outcome = `checkout_completed_${planTier}_${nextStatus}`;
    } else if (
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated'
    ) {
      const subscriptionId = obj.id ? String(obj.id) : undefined;
      const customerId = obj.customer ? String(obj.customer) : undefined;
      const candidateUid = obj.metadata?.uid;

      const resolved = this.resolveUserKey({
        uid: candidateUid,
        customerId,
        subscriptionId,
      });
      userKey = resolved.userKey;
      resolvedUid = resolved.uid;

      const prev = this.state.subscriptions[userKey];
      statusBefore = prev?.status;

      const firstItem = Array.isArray(obj.items?.data) ? obj.items.data[0] : undefined;
      const priceId = firstItem?.price?.id ? String(firstItem.price.id) : prev?.priceId;
      const interval = firstItem?.price?.recurring?.interval || firstItem?.plan?.interval;

      const { planTier, billingCycle } = resolvePlanFromStripePriceOrMetadata({
        priceId,
        metadata: obj.metadata,
        interval,
        fallbackTier: prev?.tier || 'pro',
        fallbackCycle: prev?.billingCycle || 'monthly',
      });

      const stripeStatus = String(obj.status || 'active').toLowerCase();
      let mappedStatus: SubscriptionRecord['status'] = 'active';
      let effectiveTier: PlanTier = planTier;

      if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
        mappedStatus = 'canceled';
        effectiveTier = 'free';
      } else if (
        stripeStatus === 'past_due' ||
        stripeStatus === 'unpaid' ||
        stripeStatus === 'incomplete'
      ) {
        mappedStatus = 'past_due';
      } else {
        mappedStatus = 'active'; // covers active and trialing
      }

      const periodEndSec = Number(obj.current_period_end || firstItem?.current_period_end || 0);
      const renewsAt = periodEndSec > 0 ? periodEndSec * 1000 : prev?.renewsAt || now + 30 * 86400 * 1000;
      const canceledAtSec = Number(obj.canceled_at || 0);

      updatedSub = {
        userKey,
        ...(resolvedUid ? { uid: resolvedUid } : {}),
        ...(prev?.email ? { email: prev.email } : {}),
        tier: effectiveTier,
        status: mappedStatus,
        billingCycle,
        renewsAt,
        ...(canceledAtSec > 0 ? { canceledAt: canceledAtSec * 1000 } : {}),
        provider: 'stripe',
        ...(customerId || prev?.customerId ? { customerId: customerId || prev?.customerId } : {}),
        ...(subscriptionId || prev?.subscriptionId ? { subscriptionId: subscriptionId || prev?.subscriptionId } : {}),
        ...(priceId ? { priceId } : {}),
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        ...(prev?.lastPaymentFailedAt && mappedStatus === 'past_due'
          ? { lastPaymentFailedAt: prev.lastPaymentFailedAt }
          : {}),
        lastEventId: eventId,
        lastEventType: eventType,
        syncStatus: 'pending_admin_sync',
        updatedAt: now,
        pendingFirestoreSync: true,
        livemode,
      };
      this.state.subscriptions[userKey] = updatedSub;
      statusAfter = updatedSub.status;
      outcome = `${eventType}_${effectiveTier}_${mappedStatus}`;
    } else if (eventType === 'customer.subscription.deleted') {
      const subscriptionId = obj.id ? String(obj.id) : undefined;
      const customerId = obj.customer ? String(obj.customer) : undefined;
      const candidateUid = obj.metadata?.uid;

      const resolved = this.resolveUserKey({
        uid: candidateUid,
        customerId,
        subscriptionId,
      });
      userKey = resolved.userKey;
      resolvedUid = resolved.uid;

      const prev = this.state.subscriptions[userKey];
      statusBefore = prev?.status;
      const canceledAtSec = Number(obj.canceled_at || event.created || 0);

      updatedSub = {
        userKey,
        ...(resolvedUid ? { uid: resolvedUid } : {}),
        ...(prev?.email ? { email: prev.email } : {}),
        tier: 'free',
        status: 'canceled',
        billingCycle: prev?.billingCycle || 'monthly',
        renewsAt: prev?.renewsAt || now,
        canceledAt: canceledAtSec > 0 ? canceledAtSec * 1000 : now,
        provider: 'stripe',
        ...(customerId || prev?.customerId ? { customerId: customerId || prev?.customerId } : {}),
        ...(subscriptionId || prev?.subscriptionId ? { subscriptionId: subscriptionId || prev?.subscriptionId } : {}),
        ...(prev?.priceId ? { priceId: prev.priceId } : {}),
        cancelAtPeriodEnd: false,
        lastEventId: eventId,
        lastEventType: eventType,
        syncStatus: 'pending_admin_sync',
        updatedAt: now,
        pendingFirestoreSync: true,
        livemode,
      };
      this.state.subscriptions[userKey] = updatedSub;
      statusAfter = 'canceled';
      outcome = 'subscription_deleted_downgraded_free';
    } else if (eventType === 'invoice.payment_failed') {
      const customerId = obj.customer ? String(obj.customer) : undefined;
      const subscriptionId = obj.subscription ? String(obj.subscription) : undefined;
      const email = String(obj.customer_email || '').toLowerCase() || undefined;
      const candidateUid =
        obj.subscription_details?.metadata?.uid || obj.metadata?.uid || undefined;

      const resolved = this.resolveUserKey({
        uid: candidateUid,
        customerId,
        subscriptionId,
        email,
      });
      userKey = resolved.userKey;
      resolvedUid = resolved.uid;

      const prev = this.state.subscriptions[userKey];
      statusBefore = prev?.status;

      const lineItem = Array.isArray(obj.lines?.data) ? obj.lines.data[0] : undefined;
      const priceId = lineItem?.price?.id ? String(lineItem.price.id) : prev?.priceId;
      const { planTier, billingCycle } = resolvePlanFromStripePriceOrMetadata({
        priceId,
        metadata: obj.subscription_details?.metadata || obj.metadata,
        fallbackTier: prev?.tier || 'pro',
        fallbackCycle: prev?.billingCycle || 'monthly',
      });

      updatedSub = {
        userKey,
        ...(resolvedUid ? { uid: resolvedUid } : {}),
        ...(email || prev?.email ? { email: email || prev?.email } : {}),
        tier: prev?.tier || planTier,
        status: 'past_due',
        billingCycle: prev?.billingCycle || billingCycle,
        renewsAt: prev?.renewsAt || now,
        provider: 'stripe',
        ...(customerId || prev?.customerId ? { customerId: customerId || prev?.customerId } : {}),
        ...(subscriptionId || prev?.subscriptionId ? { subscriptionId: subscriptionId || prev?.subscriptionId } : {}),
        ...(priceId ? { priceId } : {}),
        lastPaymentFailedAt: now,
        lastEventId: eventId,
        lastEventType: eventType,
        syncStatus: 'pending_admin_sync',
        updatedAt: now,
        pendingFirestoreSync: true,
        livemode,
      };
      this.state.subscriptions[userKey] = updatedSub;
      statusAfter = 'past_due';

      const invId = String(obj.id || `inv_fail_${eventId}`).replace(/[^a-zA-Z0-9_\-]/g, '_');
      const amountDue = Number(obj.amount_due ?? obj.amount_remaining ?? 0);
      this.addInvoice(userKey, resolvedUid, {
        id: invId,
        userId: resolvedUid || userKey,
        amountCents: Math.max(0, Math.round(amountDue)),
        currency: String(obj.currency || 'usd').toUpperCase(),
        planTier: updatedSub.tier,
        status: 'pending',
        description: `[Payment Failed — Attempt ${Number(obj.attempt_count || 1)}] NeatSpace ${updatedSub.tier.toUpperCase()}`,
        createdAt: (Number(event.created) || Math.floor(now / 1000)) * 1000,
      });
      outcome = `invoice_payment_failed_attempt_${Number(obj.attempt_count || 1)}`;
    } else {
      handled = false;
    }

    const logEntry: WebhookEventLogEntry = {
      id: eventId,
      type: eventType,
      receivedAt: now,
      userKey,
      outcome,
      livemode,
      ...(statusBefore ? { statusBefore } : {}),
      ...(statusAfter ? { statusAfter } : {}),
      ...(updatedSub ? { planTier: updatedSub.tier } : {}),
    };
    this.state.processedEvents[eventId] = logEntry;
    this.persistToDisk();

    return {
      duplicate: false,
      handled,
      eventId,
      type: eventType,
      userKey,
      outcome,
      subscription: updatedSub,
    };
  }

  public recordVerifiedCheckoutFromStripeSession(uid: string, email: string | undefined, session: any): ServerStripeSubscriptionRecord {
    const customerId = session.customer ? String(session.customer) : undefined;
    const subscriptionObj = typeof session.subscription === 'object' && session.subscription ? session.subscription : undefined;
    const subscriptionId = subscriptionObj?.id
      ? String(subscriptionObj.id)
      : session.subscription
      ? String(session.subscription)
      : undefined;

    this.linkUserCorrelations({ uid, email, customerId, subscriptionId });

    const prev = this.state.subscriptions[uid];
    const firstItem = Array.isArray(subscriptionObj?.items?.data) ? subscriptionObj.items.data[0] : undefined;
    const priceId = firstItem?.price?.id ? String(firstItem.price.id) : prev?.priceId;
    const { planTier, billingCycle } = resolvePlanFromStripePriceOrMetadata({
      priceId,
      metadata: session.metadata || subscriptionObj?.metadata,
      interval: firstItem?.price?.recurring?.interval,
      fallbackTier: prev?.tier && prev.tier !== 'free' ? prev.tier : 'pro',
      fallbackCycle: prev?.billingCycle || 'monthly',
    });

    const now = Date.now();
    const periodEndSec = Number(subscriptionObj?.current_period_end || 0);
    const renewsAt =
      periodEndSec > 0
        ? periodEndSec * 1000
        : now + (billingCycle === 'annual' ? 365 : 30) * 86400 * 1000;

    const nextStatus: SubscriptionRecord['status'] =
      session.payment_status === 'unpaid' ? 'past_due' : 'active';

    const rec: ServerStripeSubscriptionRecord = {
      userKey: uid,
      uid,
      ...(email ? { email: email.toLowerCase() } : prev?.email ? { email: prev.email } : {}),
      tier: planTier,
      status: nextStatus,
      billingCycle,
      renewsAt,
      provider: 'stripe',
      ...(customerId ? { customerId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(priceId ? { priceId } : {}),
      cancelAtPeriodEnd: Boolean(subscriptionObj?.cancel_at_period_end),
      lastEventId: prev?.lastEventId || `session_${String(session.id || '')}`,
      lastEventType: prev?.lastEventType || 'checkout.session.verified',
      syncStatus: 'pending_admin_sync',
      updatedAt: now,
      pendingFirestoreSync: true,
      livemode: Boolean(session.livemode),
    };
    this.state.subscriptions[uid] = rec;

    if (typeof session.amount_total === 'number' && session.amount_total >= 0) {
      const invId = String(session.invoice || session.id || `sess_${now}`).replace(/[^a-zA-Z0-9_\-]/g, '_');
      this.addInvoice(uid, uid, {
        id: invId,
        userId: uid,
        amountCents: Math.round(session.amount_total),
        currency: String(session.currency || 'usd').toUpperCase(),
        planTier,
        status: session.payment_status === 'unpaid' ? 'pending' : 'paid',
        description: `NeatSpace ${planTier.toUpperCase()} (${billingCycle}) — Verified Checkout`,
        createdAt: now,
      });
    }

    this.persistToDisk();
    return rec;
  }

  public getUserSubscriptionView(uid: string, email?: string): {
    subscription: ServerStripeSubscriptionRecord | null;
    invoices: BillingInvoice[];
  } {
    if (email) {
      const cleanEmail = email.toLowerCase();
      if (!this.state.uidByEmail[cleanEmail]) {
        this.linkUserCorrelations({ uid, email: cleanEmail });
      }
    }
    const sub = this.state.subscriptions[uid] || (email ? this.state.subscriptions[`email:${email.toLowerCase()}`] : undefined) || null;
    const invs = this.state.invoicesByUserKey[uid] || [];
    return { subscription: sub, invoices: invs };
  }

  public getAdminOverview(): {
    recentEvents: WebhookEventLogEntry[];
    subscriptions: ServerStripeSubscriptionRecord[];
    invoicesByUserKey: Record<string, BillingInvoice[]>;
    totalEventsProcessed: number;
    pendingFirestoreSyncCount: number;
  } {
    const recentEvents = Object.values(this.state.processedEvents)
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, 50);
    const subscriptions = Object.values(this.state.subscriptions).sort((a, b) => b.updatedAt - a.updatedAt);
    const pendingFirestoreSyncCount = subscriptions.filter((s) => s.pendingFirestoreSync).length;

    return {
      recentEvents,
      subscriptions,
      invoicesByUserKey: this.state.invoicesByUserKey,
      totalEventsProcessed: Object.keys(this.state.processedEvents).length,
      pendingFirestoreSyncCount,
    };
  }

  public markSyncedToFirestore(userKey: string, eventId?: string): ServerStripeSubscriptionRecord | null {
    const sub = this.state.subscriptions[userKey];
    if (!sub) return null;
    if (eventId && sub.lastEventId && sub.lastEventId !== eventId) {
      // A newer event arrived concurrently; keep pending flag true
      return sub;
    }
    sub.pendingFirestoreSync = false;
    sub.syncStatus = 'synced';
    sub.syncedToFirestoreAt = Date.now();
    this.persistToDisk();
    return sub;
  }

  public markCancelAtPeriodEnd(uid: string, cancelAtPeriodEnd: boolean): ServerStripeSubscriptionRecord | null {
    const sub = this.state.subscriptions[uid];
    if (!sub) return null;
    sub.cancelAtPeriodEnd = cancelAtPeriodEnd;
    sub.updatedAt = Date.now();
    sub.pendingFirestoreSync = true;
    sub.syncStatus = 'pending_admin_sync';
    this.persistToDisk();
    return sub;
  }

  public getEntitlementsForUser(uid: string, email?: string, isAdmin = false) {
    if (isAdmin) {
      return {
        planTier: 'premium' as PlanTier,
        status: 'active' as const,
        source: 'admin' as const,
        limits: {
          ...PLAN_SPECS.premium,
          maxSavedRooms: 500,
          maxRoomLayouts: 200,
        },
        subscription: this.getUserSubscriptionView(uid, email).subscription,
      };
    }

    const { subscription } = this.getUserSubscriptionView(uid, email);
    let effectiveTier: PlanTier = 'free';
    let effectiveStatus: SubscriptionRecord['status'] = 'active';
    let source: 'stripe_server' | 'free_default' = 'free_default';

    if (subscription) {
      source = 'stripe_server';
      effectiveStatus = subscription.status;
      if (subscription.status === 'active') {
        effectiveTier = subscription.tier;
      } else {
        // canceled or past_due users receive Free quotas until payment recovers
        effectiveTier = 'free';
      }
    }

    return {
      planTier: effectiveTier,
      status: effectiveStatus,
      source,
      limits: PLAN_SPECS[effectiveTier],
      subscription,
    };
  }
}
