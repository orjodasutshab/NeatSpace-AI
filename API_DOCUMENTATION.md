# NeatSpace AI — Backend API Documentation

Base URL (Local / Production): `http://localhost:3000` (or `APP_URL`)

All endpoints return JSON (`Content-Type: application/json`), enforce security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), and apply sliding-window IP rate limiting (`15 req/min` on heavy multimodal AI routes, `60 req/min` on standard routes; `/api/health` and Stripe webhooks bypass rate limiting).

---

## Authentication Model
- **Firebase Bearer Auth**: Protected billing and admin endpoints inspect `Authorization: Bearer <Firebase_ID_Token>` and verify signatures/expiry via Firebase Auth REST `accounts:lookup`.
- **Admin Authorization**: `/api/admin/*` routes additionally require `emailVerified === true` and membership in `ADMIN_EMAILS` (default: `abc085876@gmail.com`).
- **Webhook Security**: `/api/stripe/webhook` and `/api/billing/webhook` verify raw HTTP body bytes against `Stripe-Signature` (`t=...,v1=...`) using HMAC-SHA256 and `STRIPE_WEBHOOK_TOLERANCE` (default `300` seconds). Missing `STRIPE_WEBHOOK_SECRET` does not block app startup or checkout/portal endpoints during development, but webhook delivery verification always requires a valid secret and signature.

---

## 1. System Health

### `GET /api/health`
Public liveness check.
- **Response (`200`)**: `{ "status": "ok", "time": "2026-...", "uptimeSeconds": 124 }`

---

## 2. AI Room Analysis, Redesign & Smart Organization

### `POST /api/analyze-room`
Analyzes an uploaded room photo (JPEG, PNG, WEBP, or HEIC; validated magic bytes & <= 10 MB decoded).
- **Body**:
  ```json
  {
    "imageBase64": "data:image/jpeg;base64,...",
    "mimeType": "image/jpeg",
    "roomType": "bedroom",
    "focusGoal": "quick_wins",
    "language": "en",
    "customContext": "Keep desk ergonomics clean",
    "dailyMinutes": 20
  }
  ```
- **Response (`200`)**: `{ "success": true, "analysis": { "id", "roomName", "clutterScore", "cleaningDifficulty", "estimatedCleaningMinutes", "detectedItems", "detectedObjects", "triageItems", "quickWins", "problemAreas", "actionPlan", "storageRecommendations", "spaceUtilization", "colorDecor", "recyclingTips", "layoutAdvice", "maintenanceHabits", "minimalistTip" } }`
- **Errors**: `400` (missing/corrupt image or unsupported format), `429` (rate limit), `500` (AI service error).

### `POST /api/redesign-room`
Generates a decluttered interior redesign preview preserving room architecture.
- **Body**: `{ "imageBase64", "mimeType", "roomType", "style", "budgetTier", "furniturePreference", "wallColorPreference", "customInstructions", "language" }`
- **Response (`200`)**: `{ "success": true, "imageUrl": "data:image/png;base64,...", "summary": "...", "style": "minimalist" }`

### `POST /api/compare-after`
Evaluates an "After Decluttering" photo against the baseline clutter score.
- **Body**: `{ "afterImageBase64", "mimeType", "roomType", "beforeScore", "beforeRoomName", "language" }`
- **Response (`200`)**: `{ "success": true, "afterClutterScore": 18, "afterSummary": "..." }`

### `POST /api/chat`
Multi-turn AI Declutter Coach supporting 4 personalities (`minimalist`, `speed_cleaner`, `budget_diy`, `feng_shui`).
- **Body**: `{ "messages": [{ "sender": "user", "text": "..." }], "persona": "minimalist", "roomContext": {...}, "userStats": {...}, "language": "en" }`
- **Response (`200`)**: `{ "success": true, "reply": "...", "quickReplies": ["...", "..."] }`

### `POST /api/donation-listing`
Drafts marketplace/donation item titles & descriptions.
- **Body**: `{ "items": ["..."], "roomName": "...", "language": "en" }`

### `POST /api/deep-clean-schedule`
Generates a 7-day structured maintenance schedule.
- **Body**: `{ "roomName", "roomType", "problemAreas", "dailyMinutes", "language" }`

### `POST /api/spot-rescue`
Provides a rapid 3-step micro-reset plan for a specific clutter zone.
- **Body**: `{ "zone", "roomType", "language" }`

### `POST /api/generate-floorplan`
Generates structured spatial floorplan zones (`0..11` x `0..7`).
- **Body**: `{ "roomName", "roomType", "layoutAdvice", "detectedItems", "language" }`

### `POST /api/diy-alternatives`
Generates zero/low-cost upcycled DIY alternatives for storage products.
- **Body**: `{ "storageItems": [...], "roomType", "language" }`

### `POST /api/seasonal-checklist`
Generates 6-step scenario checklists (e.g., `guest_blitz`, `seasonal_reset`, `moving`).
- **Body**: `{ "scenario", "roomType", "roomName", "language" }`

### `POST /api/storage-optimize`
Analyzes stored inventory items and suggests relocation/grouping/donation actions.
- **Body**: `{ "items": [...], "rooms": [...], "language" }`

### `POST /api/shopping-assistant`
Generates budget-aware organizer category and dimension recommendations.
- **Body**: `{ "roomType", "budget", "currency", "roomWidth", "roomLength", "unit", "focusNeed", "language" }`

### `POST /api/layout-suggestions`
Optimizes 2D room furniture placement coordinates respecting door clearances & daylight.
- **Body**: `{ "roomType", "unit", "width", "length", "openings": [...], "furniture": [...], "language" }`

---

## 3. Stripe Billing, Entitlements & Webhooks

Plans: Free (`$0`), Pro (`$15/mo` or `$150/yr`), Premium (`$25/mo` or `$250/yr`).
Configured via `STRIPE_SECRET_KEY` and Price IDs `STRIPE_PRICE_PRO_MONTH`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_PREMIUM_MC`, `STRIPE_PRICE_PREMIUM_AN` (plus optional `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_TOLERANCE=300`).

### `GET /api/billing/status` (alias: `GET /api/stripe/status`)
Public readiness check (never leaks secrets).
- **Response (`200`)**: `{ "provider": "stripe", "configured": true, "hasSecretKey": true, "hasPriceIds": true, "allPriceIdsConfigured": true, "configuredPricePlans": { "proMonthly": true, "proAnnual": true, "premiumMonthly": true, "premiumAnnual": true }, "hasWebhookSecret": false, "webhookConfigured": false, "webhookOptionalInDev": true, "webhookToleranceSeconds": 300, "sandboxMode": true, "webhookEndpoint": "/api/stripe/webhook" }`

### `POST /api/billing/create-checkout`
**Auth**: `Bearer <Firebase_ID_Token>`
Creates a Stripe Subscription Checkout session with `client_reference_id` and UID metadata.
- **Body**: `{ "planTier": "pro" | "premium", "billingCycle": "monthly" | "annual" }`
- **Response (`200`)**: `{ "success": true, "url": "https://checkout.stripe.com/...", "sessionId": "cs_test_..." }`

### `POST /api/billing/customer-portal` (alias: `POST /api/stripe/portal`)
**Auth**: `Bearer <Firebase_ID_Token>`
Creates a Stripe Billing Portal session for managing cards, invoices, and subscriptions.
- **Response (`200`)**: `{ "success": true, "url": "https://billing.stripe.com/..." }`

### `POST /api/billing/cancel-subscription` (alias: `POST /api/stripe/cancel`)
**Auth**: `Bearer <Firebase_ID_Token>`
Schedules `cancel_at_period_end=true` on the authenticated user's active Stripe subscription.
- **Response (`200`)**: `{ "success": true, "cancelAtPeriodEnd": true, "subscription": {...} }`

### `GET /api/billing/entitlements`
**Auth**: `Bearer <Firebase_ID_Token>`
Returns authoritative server-computed plan tier, status, and feature/quota limits.

### `GET /api/stripe/subscription`
**Auth**: `Bearer <Firebase_ID_Token>`
Returns server-verified Stripe subscription and billing invoice history for the signed-in user.

### `POST /api/stripe/verify-checkout`
**Auth**: `Bearer <Firebase_ID_Token>`
Verifies a completed Stripe Checkout `sessionId` (`cs_test_...` / `cs_live_...`) directly against Stripe APIs and records entitlement.
- **Body**: `{ "sessionId": "cs_test_..." }`

### `POST /api/stripe/webhook` (alias: `POST /api/billing/webhook`)
Verified webhook receiver supporting:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- **Headers**: `Stripe-Signature: t=<unix>,v1=<hmac_sha256>`
- **Replay Window**: Controlled by `STRIPE_WEBHOOK_TOLERANCE` (default `300` seconds).
- **Idempotency**: Duplicate `event.id` deliveries return `200` with `"duplicate": true` without mutating state twice.

---

## 4. Admin Governance & Telemetry

All `/api/admin/*` endpoints require a verified Firebase ID token whose email is verified and listed in `ADMIN_EMAILS`.

### `GET /api/admin/overview`
Returns AI route call volumes, Stripe subscription aggregates (`activePaidCount`, `pastDueCount`, `canceledCount`, `estimatedMrrUsd`), webhook status, and API request/error totals.

### `GET /api/admin/health`
Returns server uptime, RSS/heap memory MB, Gemini/Stripe/Webhook readiness, endpoint call counters, and recent server errors.

### `GET /api/admin/stripe-events`
Returns recent verified webhook event logs, server subscription records, and invoice map.

### `POST /api/admin/stripe-mark-synced`
Marks a server-verified Stripe subscription record as synced into Cloud Firestore by the Admin Console (`{ "userKey": "<uid>", "eventId": "evt_..." }`).
