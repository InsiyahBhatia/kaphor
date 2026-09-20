# Kaphor — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-09-19
**Status:** Draft (derived from live codebase analysis)

---

## 1. Overview

Kaphor is a **circular fashion marketplace for India**. It is an "editorial-archive" experience aimed at Gen-Z, built around the lifecycle of pre-loved garments and accessories:

- **Buy & sell** pre-loved designer / heritage pieces (resale marketplace)
- **Occasion rental** of high-value ethnic + luxury garments (peer-to-peer leasing)
- **Fair swaps** of accessories & footwear (cashless peer exchange)
- **AI-driven garment intelligence** (condition scoring, circularity routing, price recommendations)
- **Circularity & environmental impact tracking** (CO₂ / water / waste metrics, user tiers)
- **Repair / upcycle / recycle routing** (GLIE engine)
- **Digital closet / wardrobe** (personal garment archive + style profile)

The product treats every garment as a persistent asset tracked through states:
`OWN → WEAR → SELL → BUY → RENT → SWAP → REUSE` and finally `RESELL / UPCYCLE / RECYCLE`.

---

## 2. Goals & Non-Goals

### Goals
1. Give pre-loved fashion a verified, trustworthy resale/value lifecycle.
2. Reduce textile waste by routing garments to their highest-value circular path (resell → upcycle → recycle).
3. Encourage reuse through rentals and cashless accessory swaps.
4. Quantify and gamify environmental impact (impact ledger + tiers).
5. Use AI (vision LLMs + RAG market/material data) to standardize garment condition scoring.

### Non-Goals (v1)
- No point-of-sale/inventory for physical brick-and-mortar retail.
- No cross-border shipping/logistics (India-only pincode-aware flows).
- No third-party wallet or token; payouts are bank/UPI based via Razorpay/Stripe.
- The former `ml/` workspace (YOLO models, training scripts) and the `website_extracted/` marketing site were removed from the repo — not part of the app runtime. AI vision scoring is served by the GLIE pipeline (Gemini/Groq/Qwen-T5 RAG), not local ML models.

---

## 3. Users & Personas

| Persona | Role | Needs |
|---|---|---|
| **The Editor (Buyer)** | `BUYER` | Discover curated pieces, checkout safely, track order, review sellers |
| **The Archivist (Seller)** | `SELLER` | List quickly with AI-assistance, get fair price guidance, get paid out |
| **The Stylist (Renter)** | `RENTER` | Find occasion wear, lease, return, deposit handling |
| **The Trader (Swapper)** | `SWAPPER` | Offer accessories, match fair-value swaps, escrow protection |
| **The Conscious Consumer** | any | Track personal CO₂/water impact, earn tier status, access upcycle/repair guides |
| **Admin / Studio ops** | `ADMIN` | Monitor marketplace, manage bespoke & upcycle requests, moderate users |

---

## 4. Product Concepts (Domain Glossary)

- **GLIE** — Garment Lifecycle Intelligence Engine. AI scorer producing `GLIE` score + routing (`RESELL | UPCYCLE | RECYCLE`).
- **GLP** — Garment Lifecycle Passport: per-garment record of condition, circular count, impact savings.
- **LOE** — Lifecycle Optimization Engine: feed saturation / interest management for listings.
- **T1–T5** — GLIE datasets: examples, fibers, market, sustainability, repair guides.
- **Style Vector** — 20-dim aesthetic embedding of a garment or user.
- **Impact Record** — per-user running ledger of `carbonSavedKg`, `waterSavedL`, `wasteSavedG`, `items*`.
- **Digital Closet / Wardrobe** — user's owned garments and saved pieces.

---

## 5. Functional Requirements

### FR-1 — Onboarding & Identity
- FR-1.1 Email/password registration + Google OAuth login.
- FR-1.2 JWT access (15 min) + refresh-token rotation (7 d) with per-token revocation.
- FR-1.3 Password reset (1 h link), email verification (24 h link).
- FR-1.4 5-failed-login lockout (15 min).
- FR-1.5 Identity verification with document upload (`VERIFIED` statuses).
- FR-1.6 Style-quiz onboarding (or skip) → assigns aesthetic + 20-dim style vector.
- FR-1.7 Push-token registration & Expo/FCM push notifications.

### FR-2 — Garment Listing & Discovery
- FR-2.1 Create/update/delete/pause listings (up to 8 images) with zod validation.
- FR-2.2 Listings are `SALE | RENTAL | ACCESSORY_SWAP`.
- FR-2.3 AI-assisted listing analysis (vision) → title, brand, category, condition, price + rental suggestions.
- FR-2.4 Feed: search, browse, category/condition/listing-type filters, wishlist, seller's listings.
- FR-2.5 Garment insights & lifecycle state; compatibility score vs current user.
- FR-2.6 Initiate resell from wardrobe; relist; mark circular end.

### FR-3 — Commerce (Orders & Payments)
- FR-3.1 Inquiry order flow → payment-intent order → cart order.
- FR-3.2 Payments via **Razorpay** (primary, paise) and **Stripe** (webhook-confirmed), both with signature-verified webhooks.
- FR-3.3 Order states: `PENDING → CONFIRMED → SHIPPED → DELIVERED`, plus `CANCELLED / REFUNDED`.
- FR-3.4 Order-line messages, peer reviews after delivery, shipping address + tracking.
- FR-3.5 Platform commission **10%** on sales; payout accounts (bank/IFSC/UPI), payout history, refunds.

### FR-4 — Rentals
- FR-4.1 Availability + `calculate` breakdown endpoint; request → approve/decline.
- FR-4.2 Lifecycle: `RESERVED → DISPATCHED → ACTIVE → RETURN_DISPATCHED → RETURNED → COMPLETED`, deposit released.
- FR-4.3 Rental pricing: day rate, week rate, security deposit ₹299, insurance ₹49, delivery ₹199.

### FR-5 — Swaps (Accessories & Footwear only)
- FR-5.1 Create/accept/reject swap requests; agreement + e-sign flow.
- FR-5.2 **₹500 security deposit escrow** per switcher. Tracking + shipping-address sharing.
- FR-5.3 Dispute opening/resolution; reviews; cancel.
- FR-5.4 Fair-swap matching: price variance ≤15% ideal, ≤20% max.

### FR-6 — Circular & Impact
- FR-6.1 Per-user impact ledger on sale/rental/upcycle/recycle/wear events.
- FR-6.2 Impact tiers: `BRONZE→SILVER(10)→GOLD(30)→PLATINUM(80)→ELITE(150)` kg CO₂.
- FR-6.3 Recycling centers directory (Goonj etc.), scheduling collections, partner onboarding, prep checklist, verify-prep.
- FR-6.4 Platform summary rollup + personal impact report.

### FR-7 — Studio / Social / AI
- FR-7.1 Tutorials & transformations gallery; bespoke (reconstruction) requests.
- FR-7.2 AI chat (stylist agent) with vision, product cards, outfit looks, follow-ups (SSE stream support).
- FR-7.3 Upcycle suggestions; condition assessment; repair lookup (T5 + YouTube).
- FR-7.4 Direct user-to-user conversations (sale/swap/rental-linked), reporting, notifications.

### FR-8 — Notifications
- FR-8.1 Bell notifications (order, swap, rental, message, system), unread count, read/clear-all.

### FR-9 — Admin
- FR-9.1 Monitor dashboard; manage bespoke + upcycle requests, swaps, rentals, users, garments.

---

## 6. Non-Functional Requirements

- **API**: REST under `/api/v1`; JSON; errors shaped `{ error, message }`.
- **Realtime**: Socket.IO rooms per user/garment/conversation; typing events.
- **Security**: helmet, CORS allow-list, rate limits (global + auth), argon2id passwords, soft-delete users, audit logs.
- **Availability target**: free-tier Render web service; `/health` probing.
- **Performance**: Redis + in-memory caches; presigned image URLs (S3/Cloudinary).
- **Observability**: winston + daily rotating logs.
- **Mobile**: Expo React Native (iOS/Android/web); 44px touch targets; dark editorial theme.

---

## 7. Success Metrics (proposed)

- % of listings routed to `RESELL` vs `UPCYCLE` vs `RECYCLE` (GLIE accuracy).
- Median days-to-sell per category (T3 benchmark).
- GMV by channel: SALE / RENTAL / ACCESSORY_SWAP.
- Swap conversion rate + dispute rate.
- Average carbon saved per user; % users reaching SILVER+ tier.
- Reported clean-rate of direct messages (trust & safety).

---

## 8. Milestones (suggested)

| Phase | Scope |
|---|---|
| M1 | Auth, listings, feed, orders + Razorpay, notifications |
| M2 | Rentals, swaps + escrow, payout accounts |
| M3 | GLIE assess + corrections, impact ledger + tiers, circular routing |
| M4 | AI chat stylist, style quiz, repair/upcycle studio, social/messages |
| M5 | Web 3D atelier window, admin ops, platform summaries |

---

## 9. Risks & Open Questions

- AI cost/security of multi-key Gemini + Groq rotation.
- Escrow payout liability timing (₹500 swap deposits) and 10% commission holds.
- GLIE model drift — mitigated by `glie_corrections` feedback loop.
- Legal: IT Act §79 intermediary status, consumer-protection (CPA 2019), DPDP 2023 data practices, rental bailment (§148 Contract Act).