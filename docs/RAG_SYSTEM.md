# Kaphor — RAG System Documentation

**Version:** 1.0
**Date:** 2026-09-19
**Code:** `kaphor/backend/src/services/glie/` (+ `data/` CSV assets) + `gemini.ts` model layer.
**What it is:** The Retrieval-Augmented Generation pipeline behind **GLIE** (`assessGarment`) — a domain-specific, multi-vector/corpora RAG that grounds Google Gemini vision scoring of second-hand garments with five curated knowledge corpora (T1–T5) and a Groq background validator.

---

## 1. Architecture

```
                         ┌──────────────────────────────────────────────────────────┐
  Garment image + attrs  │  GLIE Orchestrator (index.ts assessGarment)             │
 ───────────────────────▶│                                                          │
                         │  1. RAG retrieval (startup-loaded corpora)              │
                         │     resolveFiber → T2/T4 lookup                         │
                         │     T1 queryT1 (calibration few-shots)                  │
                         │     T3 queryT3(preliminary CS) (market stats)           │
                         │     T5 queryT5 (repair guides)                          │
                         │  2. buildPrompts → { systemPrompt, userPrompt }         │
                         │  3. callGeminiVision (GSI + Groq validator + optional   │
                         │     Qwen2-VL override, multi-key rotation, causality)   │
                         │  4. Phase-2 T3 re-query @ real CS                       │
                         │  5. computeMaterial/Sustainability/MarketDemand/GLIE    │
                         │     + routing (getRouting) + impact + price             │
                         └──────────────────────────────────────────────────────────┘
                                          │ result: GLIE + routing + sub-scores +
                                          │ rag_context (examples_used, guides_matched,
                                          │ market_listings_matched, prompt_tokens_estimated,
                                          │ model_agreement, validator_condition_score,
                                          │ gemini_model) + confidence_flags
```

- All corpora loaded once at startup via `initGLIE()`: `loadT1→loadT5`.
- Every corpus-parser has a quote-aware CSV reader + value normalization (booleans, numbers) + backfill rules.

---

## 2. The Five Corpora (T1–T5)

| ID | File / module | Source | Rows | Content | Retrieval |
|---|---|---|---|---|---|
| **T1** | `data/T1_balanced.csv` → `t1-examples.ts` | Generated (`scripts/generate-t1-balanced.ts`) | **~560 balanced** | Calibration examples: category, subcategory, fiber, `damage_ratio`, `stain_ratio`, `wear_zone_ratio`, `fiber_degradation`, `damage_types`, `damage_location`, `condition_score`, `human_condition_label`, `glie_routing`, `annotation_confidence`. Balanced across every CS band (0.10–1.00) | `queryT1` ranking (below) |
| **T2** | `t2-fibers.ts` (in-memory map) | curated fiber taxonomy | ~fibers | `fiber_name`, `fiber_family`, `fiber_quality_score`, `durability_rating`, `reusability_index`, `eco_rating`, `upcycle_difficulty`, `repair_notes`, `washability`, `dyeable`, `stitchable`; `resolveFiber()` synonym map (denim→Standard Cotton, silk→Mulberry Silk…) | `lookupT2(fiber)` / `resolveFiber` |
| **T3** | `data/T3.csv` → `t3-market.ts` | curated market dataset | **5,000+ listings** | `listed_price_inr`, `sold_price_inr`, `was_sold`, `days_to_sell`, `resale_value_ratio`, `platform_demand_score`, `style_tags`, `color_family`, `season`, `trend_score_at_listing`, `seller_condition_label`, `condition_score_at_listing` | `queryT3(category, cs)` filter + aggregation |
| **T4** | `t4-sustainability.ts` (in-memory map) | curated sustainability benchmarks | per fiber/category | `co2_per_garment_kg`, `water_per_garment_litres`, `circulation_multiplier_base`, `carbon_saving_score`, `water_saving_score`, `max_co2_benchmark_kg`, `max_water_benchmark_l` | `lookupT4(fiber)` |
| **T5** | `t5-guides.ts` (in-memory map + enrichment) | curated repair/upcycle guides (+ YouTube) | ~guides | `doc_type` (REPAIR/UPCYCLE), `title`, `difficulty`, `time_minutes`, `tools_required`, `steps`, `technique_style`, `damage_tags`, `fiber_tags`, `category_tags`, `quality_score` | `queryT5` weighted rank (below) |

> T1–T3 live in `data/*.csv`; T2/T4/T5 are embedded TypeScript datasets (no network at inference).

---

## 3. Retrieval Algorithms

### 3.1 `queryT1(fiber, category, conditionScore)` → top-10 few-shots
```
score = 0
  + 0.40  if fiber substring-match (normalized)
  + 0.30  if category substring-match
  + (0.30 − |ΔCS|×0.50)  if example CS within [target−0.15, target+0.15]
keep score > 0.10 → sort desc → top 10
fallback (top < 3): getDiverseExamples → same-category pool (≥5 else all), take 5 closest to target CS
```

### 3.2 `queryT3(category, conditionScore)` → aggregated `T3Stats`
Filter: normalized category substring-match **AND** `CS ∈ [target−0.15, target+0.15]`.
Aggregates: `avg_listed_price`, `median_days_to_sell` (sold only, default **21**), `avg_resale_ratio` (sold ratios; else all ratios; default **0.45**), `avg_demand_score` (default **0.5**), `total_listings_matched`, `demand_trend` from mean `trend_score_at_listing` (`≥0.70 rising · ≥0.50 moderate · ≥0.30 stable · else declining`).
Backfill: missing `condition_score_at_listing` mapped from `seller_condition_label` (`new_with_tags 1.0 · new 0.95 · like_new 0.92 · excellent 0.88 · good 0.80 · fair 0.60 · poor 0.40 · unknown 0.5`).

### 3.3 `queryT5(fiber, damageTypes, category)` → top-5 guides
Filter: `doc_type` ∈ requested; then rank:
```
score = 0.40×fiber_norm_match + 0.30×damage_match + 0.20×category_match + 0.10×quality_score
keep score ≥ 0.10 → sort desc → top 5   (per doc_type)
```

### 3.4 Lookups
- `lookupT2(fiber)` → `T2Props` (via `resolveFiber` canonicalization).
- `lookupT4(fiber)` → `T4Sustainability`.

---

## 4. Prompt Construction — `prompt-builder.ts`

`buildPrompts(garment, ragContext)` returns `{ systemPrompt, userPrompt }`.

**System prompt** = GLIE persona + rubric (CS anchor values 1.00→0.10) + circular-classification hard rules (denim/knit/shirt/saree/socks/wool upcycle routes; RECYCLE reserved for dry-rot elastane, melted polyester, bio-contaminated, sub-palm scraps) + GLIE master formula + routing thresholds, then appended **RAG sections**:
```
RETRIEVED: FIBER PROPERTIES (T2)      — quality/durability/reusability/eco/repair/wash/dyeable/stitchable
RETRIEVED: SUSTAINABILITY (T4)        — CO₂ kg, water L, circulation multiplier, saving scores, benchmarks
RETRIEVED: MARKET DEMAND (T3)         — avg price ₹, median days, resale ratio, demand score, trend
RETRIEVED: REPAIR/UPCYCLE GUIDES (T5) — ≤5 condensed guides (title, difficulty, 4 tools, 2 steps)
RETRIEVED: CALIBRATION EXAMPLES (T1)  — ≤5 examples (category, damage/stain/wear ratios, score, label, route)
```

**User prompt** = the garment card (category, fiber, price ₹, style, color, season) + strict JSON instruction:
```json
{ "condition_score": 0..1, "damage_ratio": 0..1, "wear_zone_ratio": 0..1,
  "stain_ratio": 0..1, "fiber_degradation_score": 0..1,
  "damage_types": ["tear","stain","fading","pilling","hole","none"], "description": "..." }
```
`estimatePromptTokens` ≈ `totalChars / 4`.

---

## 5. Model Layer — `gemini.ts` (`callGeminiVision`)

1. **Primary**: Gemini vision call with the built prompts + base64 image; multi-key chain on failure/429 (up to 8 keys), model rotation.
2. **Background validator**: independent **Groq** (Llama/Qwen scored) call at temperature **0.1** → `validator_condition_score`.
3. **Agreement**: `model_agreement = |gemini_cs − groq_cs| ≤ 0.1`.
4. **Qwen2-VL override**: if `QWEN_GLIE_URL` set, tries local fine-tuned Qwen2-VL as primary; falls back to Gemini.
5. **Fallback**: if every model fails → `cs = condition_override ?? 0.5`, `damageBreakdown` zeros, and `confidence_flags.model_ok = false`, `rag_context` records it.

---

## 6. Orchestration — `assessGarment` (index.ts) Step-by-step

1. `initGLIE()` — idempotent startup loader.
2. **Retrieval (phase A)** — resolve fiber → T2/T4; `queryT3(category, preliminaryCS=0.5|override)`; `queryT5`; `queryT1`.
3. **Prompt build** + token estimate.
4. **Vision call** → CS + damage breakdown (or fallback).
5. **Phase-2 market re-query** — re-run `queryT3` at the *real* Gemini CS (falls back to phase-A stats if no match).
6. **Sub-scores** — `computeMaterialScore(T2Props)`; `computeSustainabilityScore(T4,carbon,water,eco)`; `computeMarketDemandScore(T3)`; each with principled defaults when data missing:
   - T2 missing → all `0.5`; T4 missing → `SS = 0.4`; T3 missing → `MDS = 0.4`.
7. **GLIE master formula** + `getRouting(glieScore, cs, fiber, category)`.
8. **Impact** — `computeImpact(co2, water, circulationMultiplier, cs)` from T4 or fallback `(5.0 kg, 500 L, 1.8×)`.
9. **Repair feasibility** — `getRepairFeasibility(cs, damageRatio, fiberDegradation)` (bands 0.85/0.70/0.55/0.40/0.25).
10. **Suggested price** — for `RESELL`: `round(originalPrice × avg_resale_ratio)` (else `cs×0.6`).
11. **Confidence flags** — `fiber_unknown`, `market_data_too_small` (< `MIN_MARKET_LISTINGS = 10`), `all_models_failed`.
12. **Return** full `AssessGarmentResult` incl. `rag_context` for auditability.

---

## 7. Production Endpoints (in `src/index.ts`, not the router files)

| Route | Behavior |
|---|---|
| `POST /api/v1/glie/upload-temp` | Multer single image → Cloudinary 'glie-temp' → `{ url }` |
| `POST /api/v1/glie/assess` | `{ imageUrl or base64, fiber_type, garment_category, original_price_inr, … }` → full assessment |
| `POST /api/v1/glie/corrections` | Persist human override → `glie_corrections` (continuous feedback loop) |

Related consumers: `repair.service` (GLIE condition → T5 + YouTube), `ai.controller` price-recommendation → `queryT3`.

---

## 8. Safety & Guardrails

- **Prompts enforce**: strict JSON output; circular-classification rules; RECYCLE reserved for truly destroyed/degraded items; category/brand ambiguity resolution.
- **Trust**: dual-model agreement gate (`±0.1`); `confidence_flags` never hides failure; rejected/low-agreement assessments return explicit flags instead of silently guessing.
- **Valuation overrides** for luxury/high-value special paths (watches, shoes, bags) in payment/pricing layer.
- RAG data is static & curated (no live web crawling at inference), so prompt poisoning surface is limited to the curated sets.

---

## 9. Operational Notes

- **Memory**: corpus CSV (T1, T3) parsed & held in RAM at boot; 5,000+ T3 rows is the largest.
- **Latency**: one or two T3 CSV linear scans (phase A + phase B) per assessment + LLM round-trips; acceptable for the current scale.
- **Extending**: add rows to `data/T1_balanced.csv` / `data/T3.csv` or extend `t2-fibers` / `t4-sustainability` / `t5-guides` maps; loaders are restart-on-boot.
- **Tuning knobs**: `MIN_MARKET_LISTINGS`, `queryT1` score weights, T3 `CS ± 0.15` window, T5 tie thresholds, `resolveFiber` synonyms, validator temperature 0.1.