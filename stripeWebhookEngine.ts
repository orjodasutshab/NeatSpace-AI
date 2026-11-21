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

