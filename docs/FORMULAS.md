# Kaphor — Formulas Reference

**Source:** `kaphor/backend/src/services/glie/formulas.ts`, `src/utils/pricing.ts`, `src/services/impact.service.ts`, `src/lib/impact.constants.ts`, `src/services/lifecycle.service.ts`, `src/services/glie/t3-market.ts`, `src/services/garmentVector.service.ts`.

---

## 1. GLIE — Garment Lifecycle Intelligence Engine

> `GLIE = 0.35×CS + 0.25×MS + 0.20×MDS + 0.20×SS` (all clamped to [0,1])

| Symbol | Meaning | Computed by |
|---|---|---|
| **CS** | Condition Score (0–1) | Gemini vision (condition assessment) + optional Qwen2-VL |
| **MS** | Material Score | T2 fiber properties |
| **MDS** | Market Demand Score | T3 market aggregation |
| **SS** | Sustainability Score | T4 sustainability lookup + eco rating |

### 1.1 Material Score (MS) — `computeMaterialScore`
```
MS = 0.40×fiber_quality + 0.35×eco_rating + 0.25×reusability_index
```
`T2Props`: `fiber_quality_score`, `durability_rating`, `reusability_index`, `eco_rating`.

### 1.2 Sustainability Score (SS) — `computeSustainabilityScore`
```
SS = 0.50×carbon_saving_score + 0.30×water_saving_score + 0.20×eco_rating
```
`T4Props`: `carbon_saving_score`, `water_saving_score`, `max_co2_benchmark`, `max_water_benchmark`.

### 1.3 Market Demand Score (MDS) — `computeMarketDemandScore`
```
MDS = avg_demand_score × avg_resale_ratio × trendModifier          (clamped [0,1])
```
| `demand_trend` | trendModifier |
|---|---|
| `rising` | 1.2 |
| `moderate` | 0.9 |
| `stable` | 1.0 |
| `declining` | 0.8 |

`demand_trend` derived in `queryT3` from avg `trend_score_at_listing`:
`≥0.70 rising · ≥0.50 moderate · ≥0.30 stable · else declining`.

T3 query window: category match (exact or substring, normalized) **AND** `conditionScore ± 0.15`. Defaults on no/empty matches: `median_days_to_sell = 21`, `avg_resale_ratio = 0.45`, `avg_demand_score = 0.5`.

### 1.4 GLIE routing — `getRouting`
Primary rules (when CS provided):
1. `CS ≥ 0.70 OR GLIE ≥ 0.63` → **RESELL**
2. Upcycling safeguard: fiber in `[denim, cotton, canvas, corduroy, wool, cashmere, leather, suede, linen, silk, jute, hemp, jersey, flannel]` **or** category in `[jeans, jacket, shirt, t-shirt, top, saree, kurti, kurta, socks, sweater, hoodie, lehenga, dress, skirt, blouse]` **and** `CS > 0.20` → **UPCYCLE** (never shredded unless destroyed/rotted)
3. `CS ≥ 0.45 OR GLIE ≥ 0.50` → **UPCYCLE**
4. else → **RECYCLE**

Without CS: `GLIE ≥ 0.63 → RESELL`; upcyclable item with `GLIE > 0.25 → UPCYCLE`; `GLIE ≥ 0.50 → UPCYCLE`; else RECYCLE.

---

## 2. Environmental Impact

### 2.1 `computeImpact` (GLIE-level, pure)
```
conditionMultiplier = 0.5 + conditionScore × 0.5
carbonSaved  = co2PerGarmentKg      × circulationMultiplier × conditionMultiplier
waterSaved   = waterPerGarmentL     × circulationMultiplier × conditionMultiplier
treesEquivalent = carbonSaved / 22.0
```

### 2.2 Impact channel constants — `src/lib/impact.constants.ts`
| Channel | CO₂ saved / item | Water saved / item |
|---|---|---|
| SALE | 8 kg | 2700 L |
| RENTAL | 3 kg | 1000 L |
| UPCYCLE | 12 kg | 3500 L |
| RECYCLE | 5 kg | 1500 L |
| Wear (closet) | per fabric class (below) | per fabric class |
| `TREE_CO2_EQ_KG` | 9 kg CO₂ = 1 tree | — |

### 2.3 Impact ledger — `impact.service.ts`
- **Purchase (`recordImpact`)**: `co2Saved = material.co2Kg × material.reuseFactor` (fallback **2.4 kg**); `waterSaved = material.waterL × material.reuseFactor` (fallback **1800 L**); `wasteSaved = material.avgWeightG` (fallback **450 g**). `reuseCount` incremented.
- **Wear (`recordWearImpact`)** — fabric-scaled, per wear:
  | Fabric | CO₂ / wear | Water / wear |
  |---|---|---|
  | silk, pashmina, wool, cashmere | 0.75 kg | 350 L |
  | khadi, linen, cotton, denim | 0.45 kg | 180 L |
  | default | 0.35 kg | 120 L |
- **Circular end (`recordCircularEndImpact`)**: fixed `+1.2 kg CO₂`, `+400 L`, `+450 g waste`; increments `itemsUpcycled` (UPCYCLE) or `itemsRecycled` (RECYCLE).

### 2.4 Impact tiers — `impact.constants.ts`
| Tier | Threshold (kg CO₂) |
|---|---|
| BRONZE | 0 |
| SILVER | 10 |
| GOLD | 30 |
| PLATINUM | 80 |
| ELITE | 150 |

Vouchers: `CIRCULAR_VOUCHER_1` auto-issued at **30 kg**, `CIRCULAR_VOUCHER_2` at **60 kg**.

---

## 3. Pricing / Valuation — `src/utils/pricing.ts`

```
estimatedValue = categoryBaseline × brandMultiplier          (rounded to integer INR)
```
`base = 2499` default; category overrides:
| Category | Baseline ₹ |
|---|---|
| watch / timepiece | 5999 |
| bag / handbag / clutch / tote | 4999 |
| shoe / sneaker / heel / boot | 3999 |
| jewel / necklace / earring / ring / bracelet | 3499 |
| eyewear / sunglass / glasses | 2999 |
| belt / wallet / cardholder | 1999 |
| scarf / hat / tie | 1499 |
| dress / gown / lehenga / saree / sherwani | 6999 |
| jacket / coat / blazer | 4499 |

Brand multipliers:
- **Ultra-luxury (×2.8):** gucci, prada, chanel, louis vuitton, dior, rolex, hermes, balenciaga, fendi, saint laurent, versace, burberry, cartier, omega.
- **Premium (×1.6):** coach, michael kors, tory burch, kate spade, sabyasachi, manish malhotra, tarun tahiliani, ralph lauren, hugo boss, armani.

Related pricing helpers: commission **10%** on sales; rental constants below; listing price recommendation joins T3 `median` price bucket and brand/fiber/category.

---

## 4. Rental Pricing Breakdown — `rentals.controller.ts#calculateRentalBreakdown`

```
total = baseRentalPrice + deposit + insurance + delivery
```
Constants (configurable): day rate & week rate from garment `rentPrice`/`weekRentPrice`;
`deposit = pickupGarment.deposit ?? 299`; `insurance = 49`; `delivery = 199`. Deposit released on confirmed return.

---

## 5. Swap Fairness — `swap-metadata.service.ts`

Acceptable price variance from valuation: **≤15% ideal, ≤20% max**. If variance exceeds ideal but ≤ max → flagged with warning; > max → warning/block path.

---

## 6. LOE — Lifecycle Optimization Engine — `lifecycle.service.ts`

Thresholds (env-overridable unless marked fixed):
| Key | Value |
|---|---|
| `INTEREST_THRESHOLD` | 0.4 |
| `DECLINE_THRESHOLD` | 0.15 |
| `SATURATION_WINDOW_DAYS` | 7 |
| `SATURATION_MAX_EVENTS` | 20 |
| `COMPAT_MIN` (fixed) | 0.45 |
| `ENGAGEMENT_MIN` (fixed) | 0.2 |
| `DECAY_MAX` (fixed) | 0.7 |
| `COOLDOWN_BASE_HRS` (fixed) | 24 |

**Compatibility score:** cosine similarity of `user.styleVector` × `garment.garmentVector`.

**Saturation score:**
```
saturationScore = 0.5×recentEventCount + (1 − engagementRate) + 0.5×interactionDecay
```
**Saturated** when `recentEventCount ≥ 20 OR saturationScore > 10`.

**Cooldown (severity-scaled):**
```
severityMultiplier = min(recentEventCount / SATURATION_MAX_EVENTS, 3)
cooldownHrs = COOLDOWN_BASE_HRS × severityMultiplier
```

**Decision flow:** transition to `DECLINE` if `interestScore < 0.15 && interactionDecay > 0.7`; transition `DECLINE → CIRCULATION`; transition to `INTEREST` if `interestScore > 0.4`; else `PROMOTE`. Compatible-user targeting: sample ≤200 users, cosine ≥ 0.45, top-20 → `circulationSchedule`.

---

## 7. Style Vectors — `garmentVector.service.ts`

**Garment vector generation** (`generateGarmentVector`) — weighted blend of matched dimensions (re-normalized by present weights):
| Dimension | Weight |
|---|---|
| category | 0.35 |
| style | 0.25 |
| color | 0.15 |
| fabric | 0.15 |
| pattern | 0.10 |

Lookups from embedded tables; user vector a 20-dim blend of their style-profile/quiz vectors. Hybrid generator tries Gemini image → encoded 20-dim vector first, else fallback to attribute-table vector.

---

## 8. Recommendations — `recommendation.service.ts`

- **Similar garments:** `cosine(garmentVector A, garmentVector B) > 0.5`, then re-rank by contextual signals (condition, price proximity, availability).
- **For-you feed:** cosine of 20-dim blended **user vector** × garment vectors; intersection with implicitly-scored categories.
- **Discounting for fit-score:** lower-fit garments get discounted recommended price.

---

## 9. Fit-Score / T3 Price Recommendation — `ai.controller.ts`

- Fit-score returns `{ likelihood (0–1), confidence (0–1), reasons[], recommendedPrice }` from style-vector cosine + category/condition/pricing heuristics.
- Price recommendation: `queryT3(category, conditionScore)` → `avg_listed_price`, `median_days_to_sell`, `avg_resale_ratio primitives` + brand/fiber correction onto the estimator in §3.

---

## 10. Condition-By-Label Backfill — `t3-market.ts#labelToCondition`

| Label contains | Score |
|---|---|
| `new_with_tags` | 1.00 |
| `new` | 0.95 |
| `like_new` | 0.92 |
| `excellent` | 0.88 |
| `good` | 0.80 |
| `fair` | 0.60 |
| `poor` | 0.40 |
| unknown | 0.50 |

---

## 11. Repair Safeness

- Repair guides ranked by a weighted centroid score: fiber 40% + damage type 30% + category 20% + quality 10%.
- Safeness score gates guides: **unsafe** (e.g. electrical/dye-dangerous) → excluded or flagged; checked against repair-centroid profiles.
- YouTube enrichment: `youtube-transcript` transcription + `maxResults: 6` search for tutorial videos.

> Note: vendor prices/promo math for sale/bid price history and payout commission are vested in `orders.controller` / `payouts` logic rather than a single formula module — see respective services for the transaction-level figures.