# NeatSpace AI — Room Declutter & Organizer AI

**NeatSpace AI** is a full-stack, bilingual (**English & বাংলা**) AI-powered home organization, room decluttering, interior redesign, and space planning SaaS platform built with **React**, **TypeScript**, **Tailwind CSS**, **Express**, **Google Gemini**, **Firebase (Auth & Cloud Firestore)**, and **Stripe Billing**.

---

## Core Features

### 1. AI Room Analysis & Clutter Scoring
* Upload any room photo (`JPEG`, `PNG`, `WEBP`, or `HEIC`, up to 10 MB) or choose a built-in sample room.
* Receive a **0–100 Clutter Score**, estimated cleaning time, cleaning difficulty, detected object bounding markers, unnecessary item detection, and **Quick Wins**.
* Generates a structured 4-stage decluttering action plan: **PURGE → SORT → ORGANIZE → STORE**, with task priorities, time estimates, and interactive progress tracking.

### 2. AI Room Redesign & Before/After Comparison
* Generate clean interior redesign previews across multiple styles (*Minimalist*, *Scandinavian*, *Warm Cozy*, *Japandi*, *Modern Industrial*, etc.) with budget tiers and wall/furniture preferences while preserving room architecture.
* Upload an **After Photo** to compare clutter improvement and track cleanup progress.

### 3. Voice-Enabled AI Declutter Coach
* Multi-turn floating AI assistant with 4 distinct coaching personalities:
  * **Marie / Minimalist**
  * **Flash Blitz** (Speed Cleaner)
  * **Handy DIYer** (Budget & Zero-Waste)
  * **Master Zen** (Calm & Spatial Harmony)
* Supports quick prompts, bilingual responses (EN/BN), voice speech-to-text input, and browser text-to-speech playback.

### 4. Smart Home Organization Suite
* **2D Room Layout Planner:** Drag, rotate, resize, and optimize furniture coordinates for walking clearance and daylight flow.
* **Storage Inventory & Organizer Tools:** Track stored items by container/zone, draft marketplace/donation listings, generate DIY storage alternatives, 7-day maintenance schedules, spot-rescue micro-plans, and seasonal checklists.
* **Budget & Shopping Assistant:** Plan organizer purchases and export room plans & budgets as **PDF** or **CSV**.
* **Calendar, Reminders & Family Hub:** Schedule recurring room tasks, assign rooms to household members, track streaks/points/badges, and review cleaning history.

### 5. Authentication, Cloud Sync & Governance
* **Firebase Authentication:** Google Sign-In, Email/Password registration & login, email verification guard, and password reset.
* **Cloud Firestore Persistence:** Real-time per-user sync of saved rooms, redesigns, inventory, calendar tasks, notifications, family hub, and user preferences protected by hardened `firestore.rules`.
* **Admin Dashboard (`/admin`):** Role-protected console for user management (suspension/activation), subscription inspection, feedback & report moderation, feature flags, audit logs, runtime health monitoring, and Stripe webhook Firestore sync.

### 6. SaaS Subscriptions & Stripe Billing
* Three tiers with monthly and annual billing cycles:
  * **Free:** `$0` — Starter room scans, basic plans, limited saved rooms & layouts.
  * **Pro:** `$15/mo` or `$150/yr` (`$12.50/mo`) — Higher AI limits, AI room redesign, PDF reports, advanced analytics.
  * **Premium:** `$25/mo` or `$250/yr` (`$20.83/mo`) — Highest quotas, Family Hub collaboration, priority access.
* Real Stripe Checkout sessions, Stripe Billing Portal self-service, period-end cancellation, server-computed plan entitlements, and signed webhook processing with replay protection (`STRIPE_WEBHOOK_TOLERANCE=300`) and duplicate `event.id` idempotency.

---

## Project Architecture

```text
.
├── server.ts                    # Express backend, API routes, rate limiting, Gemini AI, Firebase token lookup & Stripe endpoints
├── stripeWebhookEngine.ts       # Stripe HMAC-SHA256 webhook verifier, price mapping, idempotent store & entitlement resolver
├── firebase-applet-config.json  # Firebase project & Firestore database configuration
├── firebase-blueprint.json      # Firestore collection & schema definitions
├── firestore.rules              # Hardened Cloud Firestore security rules
├── index.html                   # SPA HTML entry point & SEO metadata
├── metadata.json                # Application manifest metadata
├── API_DOCUMENTATION.md         # Complete REST & webhook endpoint reference
├── .env.example                 # Required and optional environment variable template
├── public/
│   ├── robots.txt               # Search engine crawl rules
│   └── sitemap.xml              # XML sitemap
└── src/
    ├── App.tsx                  # Main application shell, navigation, cloud sync & workspace orchestration
    ├── firebase.ts              # Firebase Auth & Firestore client SDK helpers
    ├── planConfig.ts            # Free / Pro / Premium pricing & quota specifications
    ├── i18n.ts                  # English & Bengali localization dictionary
    ├── types.ts                 # Shared TypeScript domain interfaces
    ├── data/sampleRooms.ts      # Built-in demo room presets
    ├── utils/                   # Image compression/validation & PDF export utilities
    └── components/              # Modular UI views, modals, coach chat, 2D planner, admin & billing views
```

---

## Environment Variables

Configure these variables in your server environment (never expose server secrets via `VITE_*` prefixes). See `.env.example` for reference:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for room analysis, redesign, comparison, and AI coach routes |
| `APP_URL` | Yes | Public application origin URL used for Stripe Checkout & Billing Portal redirects |
| `STRIPE_SECRET_KEY` | For Billing | Stripe API secret key (`sk_test_...` for Sandbox, `sk_live_...` for production) |
| `STRIPE_PUBLISHABLE_KEY` | Optional | Stripe publishable key |
| `STRIPE_PRICE_PRO_MONTH` | For Billing | Stripe Price ID for **Pro Monthly** (`$15/mo`) |
| `STRIPE_PRICE_PRO_ANNUAL` | For Billing | Stripe Price ID for **Pro Annual** (`$150/yr`) |
| `STRIPE_PRICE_PREMIUM_MC` | For Billing | Stripe Price ID for **Premium Monthly** (`$25/mo`) |
| `STRIPE_PRICE_PREMIUM_AN` | For Billing | Stripe Price ID for **Premium Annual** (`$250/yr`) |
| `STRIPE_WEBHOOK_SECRET` | Optional in Dev | Webhook signing secret (`whsec_...`). Optional during dev startup; mandatory whenever `/api/stripe/webhook` verifies incoming deliveries |
| `STRIPE_WEBHOOK_TOLERANCE` | Optional | Webhook replay tolerance window in seconds (defaults to `300`) |
| `ADMIN_EMAILS` | Optional | Comma-separated verified email addresses granted Admin Dashboard access |

---

## Getting Started & Scripts

### Prerequisites
* **Node.js** `20+`
* **npm**

### Install & Run Locally
```bash
npm install
npm run dev
```
The full-stack server (Express API + Vite dev middleware) starts on **port `3000`** (`http://localhost:3000`).

### Type Check, Build & Production Start
```bash
# TypeScript validation
npm run lint

# Build frontend (Vite -> dist/) and backend (esbuild -> dist/server.cjs)
npm run build

# Start production server
npm start
```

### Testing Stripe Webhooks Locally (Sandbox)
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```
Copy the signing secret (`whsec_...`) printed by the Stripe CLI into `STRIPE_WEBHOOK_SECRET` before sending test webhook events.

---

## Database & Security Notes
* **Cloud Firestore:** Stores user profiles, rooms, redesigns, inventory, calendar tasks, family data, feedback, reports, audit logs, and billing history (`firebase-blueprint.json` + `firestore.rules`).
* **Starter Tier Sync:** On Google-hosted Starter Tier Firebase projects without IAM credentials for server-side `firebase-admin` writes, verified Stripe webhook updates persist in the server store and sync to Firestore via authenticated Admin Console actions.
* **Email/Password Sign-In:** Ensure **Email/Password** is enabled in Firebase Console under **Authentication → Sign-in method** alongside Google Sign-In.

---

## API Reference
See [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) for detailed request/response schemas, authentication headers, rate limits, and error codes across all `/api/*` routes.
