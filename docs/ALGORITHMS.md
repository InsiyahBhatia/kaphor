# Kaphor — Algorithms & Engine Documentation

**Version:** 1.0
**Date:** 2026-09-19
**Coverage:** GLIE assessment pipeline, RAG retrieval, vision agreement/audit, LOE, contamination checklist, recommendations, fit-score, interaction scoring, state machines (order/rental/swap/garment), auth token rotation, impact recording.

Formulas referenced here (constants, weights, thresholds) are defined in `docs/FORMULAS.md`; RAG internals in `docs/RAG_SYSTEM.md`.

---

## 1. GLIE Assessment Pipeline — `services/glie/index.ts` (`assessGarment`)

**Input:** garment image (+ optional cloth type / sub category / current CS).
**Output:** `{ cs, fiber, pattern, category, glie, routing, dataWeight, auditWeight, baselineValuation, marketStats, specialPath, suggestions, rankedCategories, rejected }`.

1. **Vision call (primary)** — Gemini with temperature-appropriate generation config; multi-key chain rotation on failure; prompt built by `prompt-builder.ts` (RAG-augmented with T1/T2/T3/T4/T5).
2. **Background validator (Groq)** — scores the same image with temperature **0.1**; strict structured JSON.
3. **Agreement & audit** — agreement filter and BLEU-weight-style QA scoring produce `agreementScore`, `bleuScore` → `dataWeight`/`auditWeight` decide trust; low agreement → `rejected: true` without silently low `dataWeight`.
4. **Condition (CS)** — from primary vision; overrides honored: `Qwen2-VL` local model if `QWEN_GLIE_URL` set; "new with tags"/"one-time wear" detection triggers special path.
5. **Material (MS), Sustainability (SS), Market (MDS)** — T2 fiber props, T4 lookup, `queryT3(category, cs)`.
6. **GLIE + routing** — `computeGLIE`, `getRouting` (see FORMULAS §1).
7. **Best-category auto-selection** — ranked by `belief` × `categorySupport` probability; confidence-ordered; rejected categories falling below thresholds removed.
8. **Valuation** — special paths (watches, shoes, bags, luxury tags) use `getEstimatedGarmentValue` overrides; otherwise T3 price stats → `baselineValuation`.
9. **LSG (attire) & LOE recompute** — garment events trigger re-evaluation (see §4).

### Consensus & trust guard
- Both models must agree within **±0.1** on CS; `agreementScore = 1 − |Δ|`.
- Prompt-side QA measures semantics of returned JSON (BLEU-style) to compute `bleuScore`.
- Final trust = weighted combo; on mismatch the engine **rejects** rather than trusting a low-confidence read.

---

## 2. RAG Retrieval Engine — `services/glie/*`

| Dataset | Role | Retriever |
|---|---|---|
| T1 `t1-examples.ts` | Example garments per condition band | Ranked: `fiber 0.40 + category 0.30 + CS-proximity 0.30 − |ΔCS|×0.50`, keep `>0.10`, top-10, diversity fallback |
| T2 `t2-fibers.ts` | Fiber/materials library | keyword→fiber properties incl. `reusability_index` |
| T3 `t3-market.ts` | 5000+ market listings (T3.csv) | category + `CS ± 0.15` filter → aggregate stats + `demand_trend` |
| T4 `t4-sustainability.ts` | Sustainability benchmarks | category/fiber lookup → `carbon/water saving`, `eco_rating` |
| T5 `t5-guides.ts` | Repair/upcycle guides | rank: `fiber 0.40 + damage 0.30 + category 0.20 + quality 0.10`, `score ≥ 0.10`, top-5 |

- All datasets loaded once at startup (T3 CSV parsed with quote-aware parser, boolean normalization, `labelToCondition` backfill).
- **Prompt builder** fuses (a) vision system prompt, (b) T1 few-shots, (c) T2 fiber facts, (d) T3 market context, (e) T4 sustainability framing, (f) T5 repair guidance, plus strict JSON schema + output contract + safety/ethics guardrails.
- Details: `docs/RAG_SYSTEM.md`.

---

## 3. AI Vision & Chat — `services/glie/gemini.ts`, `controllers/ai.controller.ts`

- **Multi-key × multi-model rotation**: primary Gemini, fallbacks across up to 8 keys; Groq secondary validator; optional Qwen2-VL.
- **Stylist chat**: persona "The Editor", vision-augmented, returns product cards + outfit looks; **SSE streaming**; conversation memory from `ai_message` table; Groq-based fashion-agent scorer for advanced suggestions.
- **Listing analysis**: extracts `title, brand, category, condition, estimatedPrice, suggestedRentalPriceDay, suggestedRentalPriceWeek, tags`.
  - `suggestedRentalPriceDay = 10–15% of estimatedPrice` (min ₹199); `suggestedRentalPriceWeek = 4–5× daily`.
  - `estimatedPrice` default **₹1200** when absent; luxury brands bumped to `≥ ₹1500`.
- **Fit-score** (`/ai/fit-score/:userId/:garmentId`): hybrid of style-vector cosine, category-condition pricing, size compatibility heuristic (`80 + rand(0..20)`, capped 100) → `{ likelihood, confidence, reasons[], recommendedPrice }`. (Note: size leg is heuristic/simulated in current code.)
- **Style quiz**: maps 6+ answers to an aesthetic archetype (e.g., "The 2000s Visionary") with tagline, color palette, then updates user 20-dim style vector; skip supported.

---

## 4. LOE — Lifecycle Optimization Engine — `services/lifecycle.service.ts`

`evaluateLifecycle(garmentId, userId, eventType)`:
1. Load garment, user, `behaviourSignal` (interest/engagement/decay/eventCount).
2. `compatScore = cosine(user.styleVector, garment.garmentVector)`; `COMPAT_MIN = 0.45`.
3. `saturationScore = 0.5×recentEventCount + (1 − engagementRate) + 0.5×interactionDecay`.
4. **Saturation** if `recentEventCount ≥ 20` **or** `saturationScore > 10` → `SUPPRESS`, schedule cooldown for top-20 compatible users via `circulationSchedule` (`cooldownHrs = 24 × min(events/20, 3)`).
5. **Decline**: `interestScore < 0.15 && interactionDecay > 0.7 && state ≠ DECLINE` → `TRANSITION → DECLINE` (+push to seller).
6. **DECLINE → CIRCULATION** with cooldown + user targeting.
7. **Interest**: `interestScore > 0.4` → `TRANSITION → INTEREST`.
8. Default: **PROMOTE**.
- `initiateResell`: only seller; `state === 'OWNERSHIP'` → `SELL_INTENT`.
- Interaction weights (controller): `VIEW` base, `SAVE 0.15`, `WISHLIST 0.20` feed into `behaviourSignal`.

---

## 5. Recycling Center Routing — `controllers/circular.controller.ts`

Centers come from the hand-curated `VERIFIED_RECYCLER_DIRECTORY` (Goonj, RC Nishat/National Kultur, Panipat Respun, Mumbai/Bengaluru aggregators, SADS) with pincode prefixes, certifications, and import-hub flags. Distance is approximated by a simple rule: pincode-prefix match → "3.5 km away", same-city → "In your city (~5-8 km)", else "Regional Facility".

**Contamination & sorting guidance** (`generateContaminationChecklist`): universal tasks (wash, detach zippers/buttons, strip care labels) + fiber-specific (blends → CAUTION route multi-fiber hubs; denim rivets/leather patches; protein fibers separate) + damage-specific. **Hard reject** on mold/mildew/odor/rot (batch contamination risk).

---

## 6. Initial Lifecycle Assessment — `circular.controller` + `lifecycle.controller`

- `recommendedAction` from `recyclableFiber` heuristic: `>80 → RECYCLE_ONLY`, `>50 → UPCYCLE`, else `RE_SELL`.
- `initiateResell / relist / markCircularEnd` transition garment lifecycle state and (for `markCircularEnd`) update circular target + `lifecycleState = REUSE_UPCYCLE_RECYCLE`.
- Recycling center lookup (`getRecyclingCenters`) resolves user city/pincode from default saved address and enriches each facility with a distance label.

---

## 7. Recommendations — `services/recommendation.service.ts`

- **Garment vector**: weighted blend (FORMULAS §7). User vector = blended style-profile vector.
- **Similar[garment]** → cosine `> 0.5`, re-ranked by contextual score.
- **For-you** → ranked product of cosine score × category affinity (implicit signals from quiz/activity + `interaction.controller` writes).
- **Fair-swap recs** → filter accessories/footwear + price-variance ≤15/20%.
- Scores include `priceScore` and `sizeScore` components (each ×0.10 in combined rank) and `cooldownMultiplier`.
- Uses in-memory cache / Redis overlay (`recommendation.cache` TTL 2 min) to keep feed fast.

---

## 8. State Machines

### 8.1 Order — `controllers/order.controller.ts`
```
PENDING ─approve→ CONFIRMED ─ship→ SHIPPED ─deliver→ DELIVERED
   │                                                    │
   └──reject→ CANCELLED                        refund→ REFUNDED
```
- `createInquiryOrder` / `createCartOrder` → dedupe; `createPaymentIntent` links Razorpay/Stripe.
- Webhook (`stripe.controller`, `razorpay.controller`) auto-confirms matched `paymentIntentId` orders and fires notifications.

### 8.2 Rental
```
RESERVED → DISPATCHED → ACTIVE → RETURN_DISPATCHED → RETURNED → COMPLETED
   │approve→DISPATCHED      └─cancel→ CANCELLED      └─returned→ RELEASE deposit
RESERVED ─decline→ REJECTED
```
- Deposit released on confirmed return; `calculate` endpoint computes totals (FORMULAS §4).
- Rental payment via intent (`confirmRentalPayment`).

### 8.3 Swap (accessories only)
```
PENDING ─respond accept→ AGREEMENT (sign, shipping-address share) → IN_SHIPPING ─confirm-received→ COMPLETED
   │respond reject→ REJECTED                     │dispute→ DISPUTED (auto-resolve→COMPLETED winner)
   └──cancel→ CANCELLED                          ▲commerce timeouts
```
- **₹500 security deposit escrow** each party: `paySecurityDeposit` → `verifySecurityDeposit`; released/completed or unwound on cancel/dispute.
- Agreement doc + own e-signature required before addresses shared.

### 8.4 Garment lifecycle
```
OWNERSHIP → SELL_INTENT → (listed) ACTIVE → SOLD (state per order)
          → wardrobe (paused)                 → DECLINE/CIRCULATION/INTEREST (LOE)
          → REUSE_UPCYCLE_RECYCLE (circular end / upcycle / recycle)
```

---

## 9. Auth & Session Flows

- **Registration/login** → argon2id verify → issue pair: `{ access 15m HS256, refresh 7d }`.
- **Refresh rotation**: `POST /auth/refresh` validates, rotates, and stores new refresh hash; old tokens invalidated (per-user family tracking).
- **Logout** revokes family; **5-fail lockout (15 min)**; **global rate limit 1000/15min**, auth burst 5/min.
- **Frontend (`services/api.ts`)**:
  - single-flight refresh queue — concurrent 401s share one refresh promise;
  - GET response cache 60 s + AsyncStorage offline fallback;
  - token re-hydrated on app start (`auth_data`).

---

## 10. Impact Recording — `services/impact.service.ts` + `lib/impact.constants.ts`

1. `updateImpactOnTransaction(orderId)` → per order-item `recordImpact`.
2. `recordImpact`: match `materialImpact` (title/fabric/category string match, traditional first, category fallback) → `co2 = co2Kg×reuseFactor`, `water = waterL×reuseFactor`, fallbacks 2.4 kg / 1800 L / 450 g.
3. Upsert `impactRecord` incrementing carbon/water/waste + `itemsCirculated`; increment garment `reuseCount`.
4. Wear events credit per-fabric wear savings (FORMULAS §2.3).
5. Tier lookup from carbon threshold table (BRONZE…ELITE), vouchers at 30/60 kg.

---

## 11. Repair & Upcycle — `services/repair.service.ts` / `glie/t5-guides.ts`

- **Assess**: GLIE condition → T5 guide ranking (fiber/damage/category/quality weights) → segregated **YouTube search** (`maxResults=6`, query built from garment + damage + routing decision) for *repair* vs *upcycle* tutorials; transcript enrichment.
- **Lookup**: same pipeline minus re-assessment; returns `glie_score`-eligible sub-object + guides + YouTube.
- Safeness: guides scored against repair centroids; unsafe operations excluded/flagged (RF exposure, dye chemistry without PPE).

---

## 12. Trust, Moderation & Safety

- Admin actions logged (IP + UA).
- User report endpoint → moderation queue; ban/churn controls block buy/sell & feed visibility.
- Webhook signature verification (Stripe HMAC, Razorpay HMAC) — no auth bypass.
- CORS allow-list (prod); helmet; request ID logging.