# Kaphor – Pre-launch TODO

Status after the typography, loader, backend-hardening and Stripe-removal passes.
Nothing below has been compiled or run in the audit environment (no Node installed there), so **step 0 comes first**.

## 0. Verify before anything else
- [ ] `cd kaphor-frontend && npx tsc --noEmit` and fix any errors
- [ ] `cd kaphor/backend && npx tsc --noEmit && npm test`
- [ ] `cd kaphor/backend && npm uninstall stripe` (Stripe code was removed; the package and lockfile entry remain)
- [ ] `cd kaphor-frontend && npx expo-doctor && npx expo install --check`
- [ ] Run the app on a device and click through: Home, Shop, Swap, Rental, Messages, Profile, Orders, Sell, Circular, Impact
- [ ] Apply migrations to a **scratch** database with `npx prisma migrate deploy` and confirm the new
      `20260930000000_baseline_missing_tables` migration runs cleanly on both an empty DB and the current one

## 1. Launch blockers (need your accounts / keys)
- [ ] Razorpay: put the **live** key (`rzp_live_…`) in the production profile of `kaphor-frontend/eas.json` (currently `rzp_test_…`)
- [ ] Razorpay: set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` on Render and register the webhook
- [ ] Google Sign-In (Android): add the EAS keystore SHA-1 and the Play App Signing SHA-1 in Firebase, re-download `google-services.json`
- [ ] Render env: `ALLOWED_ORIGINS` (required in production), `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `BACKEND_URL`
- [ ] Email: create a Resend account, verify a sender domain, set `RESEND_API_KEY` and `EMAIL_FROM` (verification / password-reset mail is not delivered without it)
- [ ] Move Render off the `free` plan (it sleeps after 15 min idle and cold-starts)
- [ ] Restrict the Firebase / Google API keys by package name + SHA-1 in Google Cloud

## 2. Should fix
- [ ] Verification / reset email links point at `FRONTEND_URL/verify-email`; decide how they open the mobile app (deep link / universal link)
- [ ] Per-user rate limits on costly AI routes: `/ai/chat`, `/ai/assess-condition`, `/ai/analyze-listing`, `/ai/upcycle-suggestions`, `/repair/assess`, `/repair/lookup`
- [ ] Route the Qwen call in `backend/src/services/glie/gemini.ts` through `aiGuard` (it bypasses size/cache checks)
- [ ] Check `/ai/fit-score/:userId/:garmentId`: any authenticated user can query another user's fit data?
- [ ] Rate limiter uses an in-memory store; move to Redis before running more than one instance
- [ ] Migrations run on every cold start; consider Render `preDeployCommand`
- [ ] RLS migration (`20261005010000_supabase_security_rls`) only covers tables that existed then, and assumes the DB role owns the tables / has BYPASSRLS; skip it on non-Supabase Postgres
- [ ] Undocumented env vars: `AI_TIMEOUT_MS`, `AUTH_CACHE_TTL_MS`, `CACHE_MAX_ENTRIES`, `CACHE_TTL_SCALE`, `INTEREST_THRESHOLD`, `DECLINE_THRESHOLD`, `SATURATION_MAX_EVENTS`, `SATURATION_WINDOW_DAYS`, `GROQ_API_KEY2/3`, `GEMINI_API_KEY2`, `QWEN_GLIE_URL`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` (backend reads these)
- [ ] `eas.json`: no Android service-account key for submit, no iOS config; remove `ios`/`web` from `app.json` platforms if Android-only
- [ ] `babel.config.js`: redundant `react-native-reanimated/plugin` (Reanimated 4 uses the worklets plugin); test a release build after changing
- [ ] `EXPO_PUBLIC_*` fetch-based services should reuse `resolveApiBaseUrl()` from `src/services/api.ts`
- [ ] Android permission `READ_EXTERNAL_STORAGE` is likely unnecessary on API 33+
- [ ] Load all fonts in the first `useFonts` call in `app/_layout.tsx` (second batch can flash system font)

## 3. Cleanup
- [ ] Remove unused packages: backend `morgan`, `youtube-transcript`; frontend `@expo-google-fonts/outfit` (use `npm uninstall`)
- [ ] ~45 one-off scripts in `kaphor/backend/scripts/` (S3/Cloudinary migrations, recovery fragments) – move out of the deployable tree
- [ ] 65 tracked files under backend `uploads/`, `logs/`, `data/` – confirm intent (note `data/` is needed by GLIE at runtime)
- [ ] `kaphor-frontend/assets/_source` is ~91 MB tracked in git – move out of the repo
- [ ] ~55 `console.warn` calls in catch blocks – route through a `__DEV__` logger
- [ ] Dead dev code: `192.168.` LAN image-URL logic in `backend/src/lib/cloudinary.ts` and `s3.ts`; hard-coded `onrender.com` fallbacks in `index.ts` / `cloudinary.ts`; `redis://localhost` fallback
- [ ] Rename `rentals.stripeId` (holds the Razorpay order id) and drop `orders.stripePaymentId` with a migration
- [ ] `src/data/legalPolicies.ts` still says payments use "Razorpay and/or Stripe" – update the legal copy
- [ ] Other docs (`PRD`, `TRD`, architecture, SOPs) still mention Stripe
- [ ] Add a privacy-policy URL and Play data-safety form before store submission
- [ ] Add CI: typecheck + `expo-doctor` + backend tests; add payment / auth / order tests

## 4. UI follow-ups
- [ ] Replace literal `fontSize` numbers with the `fontSizes` tokens from `src/theme` over time (`python kaphor-frontend/scripts/audit-typography.py` reports off-scale sizes)
- [ ] Review screens on a device for sizes that now feel too small after the scale snap (Profile, Messages, Orders, Swap)
- [ ] Bebas Neue (`typography.condensed`) is still used on auth screens and the logo; decide whether to keep it

## Done in this pass
- Typography scale, shared title styles, skeleton loaders that mirror real screens, cache-first recycling centers
- Backend: baseline migration for 5 missing tables, fail-closed swap deposit, required `ALLOWED_ORIGINS`, `DIRECT_URL` fallback,
  real impact report, Resend email delivery, webhook rate-limit exemption, Stripe removed
- Frontend: removed test-key fallback, production log cleanup, dead/duplicate routes removed
