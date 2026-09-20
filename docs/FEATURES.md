# Kaphor — Features List

**Version:** 1.0
**Date:** 2026-09-19
**Source:** Live inventory of `kaphor/backend`, `kaphor-frontend`. (The former `website_extracted/` marketing site and `ml/` training folder were removed — not part of the runtime app.)

Status legend: `✅ shipped` · `🟡 partial/gated` · `🧊 dormant/dead-code path`

---

## 1. Onboarding & Accounts
- ✅ Email/password registration (argon2id), login, logout.
- ✅ Google OAuth login (`/auth/google`) using `google-auth-library`.
- ✅ JWT access token (15 m) + rotating refresh token (7 d), stored encrypted in app `SecureStore`.
- ✅ Password forgot / reset (1 h expiry slots) and email verification (24 h).
- ✅ 5-failed-login 15-min lockout; per-IP auth rate limit 5/min.
- ✅ Soft-delete users (email/username renamed `_deleted_<ts>`); admin can hard-update.
- 🟡 Identity verification (document upload; statuses `PENDING/VERIFIED/REJECTED`).
- ✅ Push-token register/unregister (Expo + FCM), per-user notification preferences.
- ✅ Style-quiz onboarding (multi-question aesthetic mapping) with skip + re-take.

## 2. Garments & Wardrobe
- ✅ Create/update/delete/pause listings (image upload ≤8, multi-brand, GARI reimagined fields: fiber composition, weave, tailoring, fit, occasion, aesthetic, components).
- ✅ Listing types: `SALE`, `RENTAL`, `ACCESSORY_SWAP`.
- ✅ Feed (paginated, excludes own listings, blocks banned/churned sellers, optional condition filter).
- ✅ Browse/search (query, category, brand, condition, listing types, min/max price).
- ✅ Wishlist add/remove/list.
- ✅ Uploadcare-agnostic image pipeline → S3/Cloudinary with presigned URL caching.
- ✅ Garment Insights (eco savings, condition trail, GLIE sub-scores), lifecycle timeline.
- ✅ Compatibility score: matching a garment vs a specific user.
- ✅ Initiating resell from wardrobe; relist; mark circular end.
- ✅ Seller's listings (`/garments/me`).

## 3. Orders & Commerce
- ✅ Inquiry flow → payment-intent order → cart checkout.
- ✅ Order lifecycle `PENDING → CONFIRMED → SHIPPED → DELIVERED → CANCELLED/REFUNDED`.
- ✅ Razorpay ordering + verification (paise amounts) + signature-verified webhook auto-confirm.
- ✅ Stripe PaymentIntent + webhook confirm (raw body handling) fallback.
- ✅ Payment intent coverage for lease/lend rental agreements and swap service fee.
- ✅ Order summary aggregate (gross, platform fees, count by status) for seller dashboard.
- ✅ Transactions list (orders, rentals, swaps, payouts) per user or admin.
- ✅ Shipping addresses + tracking number updates.
- 🟡 Peer reviews after delivery.

## 4. Rental (Occasion Leasing)
- ✅ Availability + pricing breakdown calculator (`/rentals/:id/calculate`).
- ✅ Lifecycle: `RESERVED → DISPATCHED → ACTIVE → RETURN_DISPATCHED → RETURNED → COMPLETED` + `CANCELLED/REJECTED`.
- ✅ Deposit handling (₹299 default) released on return; ₹49 insurance; ₹199 delivery.
- ✅ Request/approve/decline peer rental; pay lease via payment intent.
- ✅ Peer reviews; rental history & details.

## 5. Swap (Accessories & Footwear)
- ✅ Submit/accept/reject swap requests with notes.
- ✅ Agreement + e-sign (own signature) + tracking + address sharing on mutual accept.
- ✅ **⧋ ₹500 security deposit escrow** per switcher (held until both ships).
- ✅ Reviews, dispute resolution (auto-pay winner on timeout), cancel with escrow unwind.
- ✅ Fair-match guidance: price variance ≤15% ideal / ≤20% max.
- ✅ Swap metadata enrichment (bias values, locker based on S3).

## 6. Circularity & Impact
- ✅ Impact ledger: `carbonSavedKg`, `waterSavedL`, `wasteSavedG` (+ availability by channel and `closetCount`).
- ✅ Impact constants per event: SALE 8 kg / 2700 L, RENTAL 3 kg / 1000 L, UPCYCLE 12 kg / 3500 L, RECYCLE 5 kg / 1500 L. Trees equivalent: 9 kg CO₂ = 1 tree.
- ✅ Tier thresholds: `BRONZE` (default) → `SILVER` 10 → `GOLD` 30 → `PLATINUM` 80 → `ELITE` 150 kg.
- ✅ `markCircularEnd` paths: `UPCYCLE` (garment dominant) / `RECYCLE` / `RESALE` target state.
- ✅ Recycling centers directory (Goonj featured) + onboarding partners.
- ✅ Collection scheduling + prep checklist (`verify-prep`) for donations/recycling.
- ✅ Platform summary + personal impact report endpoints.
- ✅ Vouchers: `CIRCULAR_VOUCHER_1/2` auto-issued at 30/60 kg.

## 7. GLIE — Garment Lifecycle Intelligence Engine
- ✅ Vision-based assessment over uploaded image (Gemini multi-key rotate, Groq background validator, optional Qwen2-VL local).
- ✅ Produces condition score, fiber, pattern, category; computes `GLIE` with T3 market stats; weight/BLEU-quality audit trace.
- ✅ Routes: `RESELL (≥0.63) / UPCYCLE (≥0.565) / RECYCLE (<0.565)`.
- ✅ Auto-select best category with confidence.
- ✅ Corrections feedback loop (`/glie/corrections`) → `glie_corrections` table.
- ✅ Special-path handling (watches, shoes, bags, "new with tags"/"one-time wear") with valuation overrides → baseline price.
- ✅ RAG-augmented prompt (T1 examples, T2 fibers, T3 market, T4 sustainability, T5 guides).
- ✅ LSG (attire appropriateness) + LOE (listing-energy) recomputation on garment events.
- 🧊 Custom-local + runway-model style evaluation hooks existed in historical docs; **not** in current runtime.

## 8. AI / Stylist Services
- ✅ AI fit-score recommendation (`/ai/fit-score/:userId/:garmentId`) — likelihood, confidence, reasons, discounted pricing.
- ✅ AI price recommendation (T3 market median, brand, category) via `queryT3`.
- ✅ Stylist chat (`POST /ai/chat`) — persona-driven, vision-aware, product cards, outfit looks, garment-condition-aware follow-ups, SSE streams; 1-on-1 DMs; Groq fashion-agent output.
- ✅ Style-profile extraction; upcycle suggestions (Gemini, T1/T2 scoring + LAUNCH persona); garment-condition assessment (re-appraisal route).
- ✅ Listing analysis (vision title/brand/category/price + rental suggestion).
- ✅ Swappability advisor (aesthetic-match scoring); recommendations by style vector (cosine).

## 9. Recommendations
- ✅ Similar garments (semantic style vector cosine > 0.5) + context & condition re-rank.
- ✅ For-you feed (20-dim blended user vector, cosine).
- ✅ Rental + swap recommendations; profile-based recs from style-quiz.
- ✅ Recommendation usage events tracked for personalization.

## 10. Studio / Social / Repair
- ✅ Studio: tutorials + transformations gallery; bespoke/unhemmed reconstruction requests with approval flow.
- ✅ Self-reported garment health (wear events) → re-rating via `ratingService`.
- ✅ Repair lookup → T5 repair guides + YouTube tutorial enrichment; repair centroids + safeness scoring.
- ✅ User-to-user messaging (sale/swap/rental conversations), unread counts, typing events, user report → moderation.

## 11. Notifications & Realtime
- ✅ Socket.io rooms (user/garment/conversation), typing indicators, garment delisted push, swap-counter update after accept.
- ✅ Bell notifications with categories, unread count, read/read-all, clear-all; filters DIRECT_MESSAGE (DMs go to Messages tab).
- ✅ Configurable notification preferences (bell vs DM vs promo) with FCM/Expo delivery.

## 12. Admin & Ops
- ✅ Admin monitor dashboard: platform metrics inventory (orders, rentals, swaps, users, garments).
- ✅ Admin management: bespoke requests (approve/reject), upcycle requests, swaps, rentals, users (ban/churn), garments.
- ✅ Audit log on admin actions (with IP/UA).

## 13. Web 3D Atelier (Marketing Site — removed)
- ⛔ The `website_extracted/` marketing site (React-Three-Fiber showcase) was removed from the repo — it was not wired into the app runtime. The Expo app is the only client surface.

## 14. Frontend App Surface (Expo)
- ✅ 6-tab shell (Home, Shop, Circular Hub, Cart, Profile) + 30+ hidden/deep routes (swap, rental lease/return, studio, circular, impact, orders, notifications, messages, wardrobe, my-listings, payouts, settings, reviews, admin).
- ✅ Auth flows (login/register/forgot/reset/verify/onboarding/style-quiz).
- ✅ 26 UI components (cards, header, listing-actions, absentee, empty-state, favorites, confirming-sheet…) + 26 service clients (auth, garments, swap, rentals, orders, payouts, circular, ai, glie, recommendations, notifications, search, chat, uploadcare, impact, messages, admin, favorites, studio, repair, reviews, rating, weight inference, polarity, external-outfits…).
- ✅ 4 Zustand stores + dark editorial theme (`#1A0C10`, serif display) in `theme.ts`.
- ✅ Toasts, pull-to-refresh, wishlist/Favorites persistence, SSE-streamed chat UI.

## 15. Marketplace Support Features
- ✅ Payout accounts (bank/account-holder/IFSC/UPI), payout history, seller payout listing.
- ✅ Rental ownership: `RENTAL_OWNER`, `NEW_OWNER` per-entity marker (buyer owns after sale).
- ✅ Fabric/fiber composition reimagined list: Cotton, Modal, Linen, Silk, Wool, Cashmere, Chiffon, Satin, Denim, Leather, Satin-Silk, etc.
- ✅ Season and occasion validation against allowed constants.

---

### Cross-cutting platform services
- Global API rate limit (1000/15 min) + auth burst limit (5/min).
- Uploads (files + remote URL capture) with strict MIME/size guards.
- Structured zod validation on body/query/params for all critical routes.
- Central `error`/`message` JSON contract; S3 presigned caching (50-min TTL); Redis + in-memory cache shims.
- Daily rotating logs; CI (typecheck, lint, jest with Postgres service); Docker/Render/EAS deploy targets.