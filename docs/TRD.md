# Kaphor — Technical Requirements Document (TRD)

**Version:** 1.0
**Date:** 2026-09-19
**Status:** Draft (derived from live codebase analysis)

---

## 1. System Overview

```
┌───────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│ kaphor-frontend│ REST │ ┌──────────────────────────┐ │      │ PostgreSQL      │
│ (Expo RN)      │──────┼▶│  kaphor/backend (Express)│ │─────▶│  (Prisma ORM)   │
│  app/(tabs)*   │      │ │  Express + Socket.io     │ │      │                 │
└───────────────┘      │ │  Redis · JWT · Zod       │ │      │ Redis (cache/socket
                       │ └──────────────────────────┘ │      │ registry)
                       └──────────────────────────────┘      └─────────────────┘
              integr.   Cloudinary/S3 (images) · Firebase (FCM) · Gemini/Groq/Qwen (AI)
                        Razorpay/Stripe (payments) · Expo Push
  (The former website_extracted/ marketing site and ml/ training dir were removed from repo;
   https://kaphor-backend.onrender.com/api/v1 is the sole API base.)
```

---

## 2. Technology Stack

| Layer | Tech | Version / Notes |
|---|---|---|
| **Mobile app** | Expo (React Native) | Expo ~55, RN 0.83, React 19.2, TypeScript |
| **Navigation** | expo-router | File-based routing `app/**` |
| **State** | Zustand + React Context | stores: auth, garment, notification, toast |
| **Backend** | Node.js + Express + TypeScript | Express ^4.22, ESM-free CJS, strict TS, `@/*` → `./src/*` |
| **ORM / DB** | Prisma 5.22 + PostgreSQL | schema at `prisma/schema.prisma` (935 lines) |
| **Realtime** | Socket.io 4.7.5 | rooms, typing, notifications |
| **Cache / pub-sub** | ioredis 5.4 | with in-memory fallback (`MemoryStore`) |
| **Auth** | JWT (HS256) + argon2id | access 15 m, refresh 7 d, rotation in DB |
| **Validation** | zod | body/query/params middleware |
| **AI** | google-generative-ai 0.24, Groq HTTP, optional Qwen2-VL | multi-key × multi-model rotation |
| **Imaging** | multer, S3 (@aws-sdk/client-s3) + Cloudinary | presigned URL caching |
| **Payments** | razorpay 2.9, stripe 15.12 | webhook-confirmed flows |
| **Push** | firebase-admin (FCM v1) + Expo push API | Android high-priority + channel |
| **Logging** | winston + DailyRotateFile | 14-day rotation |
| **Web (marketing)** | Vite + React + threejs/R3F/drei + GSAP | separate package, gitignored |
| **Infra** | docker-compose, Render (free), GitHub Actions CI | Node 20 |

---

## 3. Environment & Configuration

Validated at boot via zod (`src/index.ts`):

- Required: `DATABASE_URL`, `JWT_SECRET` (≥16), `JWT_REFRESH_SECRET` (≥16)
- Optional: `PORT` (4000), `API_VERSION` (`v1`), `REDIS_URL`, `NODE_ENV`
- AI: `GEMINI_API_KEY` (+ `GEMINI_API_KEY1..8`), `GROQ_API_KEY` (+1..8), `GROQ_MODEL` (`qwen/qwen3.8-27b`), optional `QWEN_GLIE_URL`
- Storage: `AWS_*`/`S3_BUCKET_NAME`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`
- Payments: `RAZORPAY_KEY_ID/KEY_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Push: `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (or service-account file)
- CORS: `ALLOWED_ORIGINS` (comma-separated, default `http://localhost:8081`)
- Frontend base URL (app): `https://kaphor-backend.onrender.com/api/v1`

---

## 4. Backend Architecture

### 4.1 Middleware pipeline (in order)
1. `helmet()` security headers
2. `compression()`
3. Stripe webhook raw body (`express.raw`) mounted at `/api/v1/payments/webhook` → sets `req.rawBody`
4. `express.json({ limit: '15mb' })`
5. Static mounts: `/uploads`, `/api/v1/uploads`
6. Custom request logger
7. CORS (allow-list in prod, `*` in dev)
8. Global rate limit **1000 req / 15 min**
9. Auth-specific rate limits **5 / min** on `/auth/login|register|google|forgot-password|reset-password`
10. Routers under `/api/v1/*`
11. 404 handler + global error handler `{ error, message }`

### 4.2 Auth middleware (`middleware/auth.ts`)
- `authenticate`: Bearer → `jwt.verify` → strict DB check (`findUnique` + `isActive`) → `req.user { id, email, role, displayName }`. Missing/invalid/inactive → 401.
- `requireRole(roles)` → 403 `FORBIDDEN`; `requireAdmin`.
- `optionalAuth`: silently accepts valid tokens, else anonymous.

### 4.3 Validation (`middleware/validate.ts`)
Zod `body / query / params` schemas → `400` `VALIDATION_ERROR` with per-field messages.

### 4.4 Upload (`middleware/upload.middleware.ts`)
Multer memory storage; `jpeg/png/webp`; max **10 MB**; used for garment images (≤8), avatar, GLIE temp.

### 4.5 Core libs (`src/lib/`)
- `prisma.ts` — PrismaClient with query logging; `withPrismaRetry(op, 2, 120 ms)`; **soft-delete override on `user.delete`** (renames email/username to `_deleted_<epoch>`).
- `redis.ts` — ioredis with `MemoryStore` fallback; `redisGet/Set/Del`; `isRedisAvailable`.
- `cache.ts` — in-memory Map cache (`cacheGet/Set/Clear`, default 30 s TTL).
- `socket.ts` — Socket.io server; rooms `user:{id}`; redis `socket:user:{id}` TTL 24 h; `emitToUser`.
- `socketHandler.ts` — join/leave user/garment/conversation rooms; `typing` → `user_typing`.
- `s3.ts` — presigned-URL cache (50-min TTL, evicts stale past 1000), local upload fallback, `getDownloadUrl`.
- `cloudinary.ts` — upload/URL optimization (`f_auto`,`q_auto`); re-exports S3 helpers.
- `firebase.ts` — firebase-admin init.
- `stripe.ts` — null-safe Stripe client.
- `impact.constants.ts` — impact constants + tier calculator.
- `logger.ts` — winston + DailyRotateFile.

### 4.6 Frontend API layer (`kaphor-frontend/src/services/api.ts`)
- axios; bearer injection; **single-flight refresh-queue interceptor** (`POST /auth/refresh`).
- GET cache (60 s TTL) + AsyncStorage offline fallback (`cachedGet`, `fetchFresh`, `invalidateCache`).

---

## 5. Frontend Architecture

### 5.1 Navigation (expo-router)
- `app/index.tsx` → redirect by auth state.
- `app/(auth)/_layout.tsx` — 7 auth screens, bg `#1A0C10`.
- `app/(tabs)/_layout.tsx` — TabBar; 6 visible tabs: **Home, Shop, Circular Hub, Cart, Profile** + ~30 hidden routes (`href: null`) for swap/*, rental/*, shop/*, studio/*, circular/*, impact/*, orders, notifications, messages, profile/wardrobe, rental/lease/[id].
- `app/(admin)/` — admin dashboard.
- Root: legal, messages/[conversationId], profile/*, settings, reviews, my-listings, payouts, shop/edit/[id].

### 5.2 State (Zustand)
- `authStore` — user / accessToken / isHydrated.
- `garmentStore` — feed + pagination cursor; excludes own listings; listens `garment:delisted`.
- `notificationStore` — unread counts, prefs (`@kaphor_notif_preferences`), filters `DIRECT_MESSAGE` from bell.
- `toastStore` — 3.5 s auto-hide toasts.

### 5.3 Storage (`utils/storage.ts`)
`safeStorage` cascade: AsyncStorage + SecureStore (≤2000 chars) on native, localStorage on web. Keys: `kaphor_access_token`, `kaphor_refresh_token`, `auth_data`.

### 5.4 Payments (frontend)
Razorpay via `@codearcade/expo-razorpay`; all amounts in **paise**; escrow for swaps (₹500) and rental deposits.

---

## 6. Data Layer

- Single PostgreSQL DB `kaphor_db` (docker-compose local) / managed provider (Render/Railway).
- Prisma migrations under `prisma/migrations/` (init through GLIE corrections & swap-metadata & sale reservations).
- See `docs/DATABASE.md` for the full model reference.

---

## 7. Integrations Matrix

| Integration | Purpose | Auth | Notes |
|---|---|---|---|
| Razorpay | Order creation, verify, webhook | Key/Secret | Amounts in paise |
| Stripe | PaymentIntent + webhook | Secret + webhook secret | Raw-body handling |
| Cloudinary | Upload / CDN URLs | Cloud/Key/Secret | S3-compatible fallback |
| AWS S3 | Object storage + presigned URLs | Access keys | TTL 50 min |
| Gemini | GLIE vision, vectors, chat, quiz | API key ×8 | Model chain rotation |
| Groq | Background validator, text, fashion agent | API key ×8 | Temp 0.1 for scoring |
| Qwen2-VL | Optional local fine-tuned GLIE | URL | Falls back to Gemini |
| Firebase FCM | Android push | service account | High priority + channel |
| Expo Push | iOS/Android push | none | `exp.host` HTTP |
| YouTube | Repair tutorial search | API key | maxResults 6 |

---

## 8. Environment / Secrets Security

- `.env*` gitignored; `render.yaml` uses `sync:false` secrets.
- Passwords hashed with **argon2id** (mem 2^16, time 3, parallelism 1).
- Keys support `#`-suffix stripping (e.g. `GEMINI_API_KEY1=pk#suffix`).
- Firebase private key `\n` un-escaped at runtime.
- Audit log captures IP + user-agent for admin actions.

---

## 9. Testing & CI

- **CI** (`.github/workflows/ci.yml`, on main): `typecheck` (`tsc --noEmit`), `lint` (`eslint src/ --ext .ts`), `test` with postgres:16-alpine service (`kaphor_test`).
- Jest coverage; existing tests: `src/services/repair.service.test.ts`, `src/services/glie/formulas.test.ts`, `src/services/glie/loaders.test.ts`.

---

## 10. Deployment Targets

- **Render** (web service): build `npm install --include=dev && npm run build`, start `node dist/index.js`, health `/health`, port 10000.
- **Docker**: `docker-compose.yml` — postgres:16-alpine, redis:7-alpine, backend (port 4000), volumes `pgdata`, `uploads`.
- **Mobile**: EAS build profiles `preview` / `production`.

---

## 11. Known Technical Notes / Caveats

- **Removed dead dependencies**: `@langchain/core`, `@langchain/langgraph`, `@modelcontextprotocol/sdk`, `bcryptjs`, and `sharp` were declared in `package.json` but never imported by any source file — they have been removed from the dependency list (2026-09-19). LLM orchestration is hand-rolled via `geminiClient`/`groqClient` helpers; hashing uses argon2id; image uploads do not use local sharp processing.
- Docs historically mention Anthropic/Stripe/RS256; **actual code** uses Gemini+Groq+Qwen, Razorpay+Stripe, HS256 + refresh rotation.
- GLIE endpoints: code exposes `/api/v1/glie/*`; the RN app's older repair screens wire `/repair/assess`/`/repair/lookup` returning a GLIE sub-object.
- No `Wallet`/`Karma` model exists — impact ledger + payout accounts are the only monetary/motivational models.