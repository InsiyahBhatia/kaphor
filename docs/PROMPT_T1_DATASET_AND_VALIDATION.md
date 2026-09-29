# GLIE T1 Dataset + Formula Validation Prompts

Two-stage pipeline:

1. **Stage 1 (AI annotation)** — Gemini vision reads each garment photo in
   `docs/glie-images/` and emits a full T1 row *plus* the model's own routing
   opinion.
2. **Stage 2 (formula validation)** — the backend GLIE formulas compute a
   routing for the same row using the real T2 (fiber), T3 (market) and T4
   (sustainability) datasets, and the two routings are compared for agreement.

---

## Stage 1 — Dataset Annotation Prompt (vision)

**Job:** You are a garment condition assessor for a circular-fashion platform.

**Input:** one photograph of a garment.

**Task:** evaluate the garment and return STRICT JSON. No markdown, no prose.
Only a single JSON object with exactly these fields:

```json
{
  "garment_category": "kurta|saree|jeans|jacket|trousers|shirt|tshirt|dress|blouse|lehenga|sweater|socks|skirt|hoodie|top|sweatshirt|palazzo|dupatta|kurti|other",
  "garment_subcategory": "short subtype, e.g. slim-fit jeans / A-line dress / crew-neck tee",
  "fiber": "most likely fabric composition, e.g. cotton, denim, silk, polyester, wool, linen",
  "photo_angle": "front | back | side | detail | flat",
  "damage_ratio": 0.0,
  "stain_ratio": 0.0,
  "wear_zone_ratio": 0.0,
  "fiber_degradation": 0.0,
  "damage_types": ["none|tear|hole|stain|fading|pilling|broken_zip|loose_threads|seam_split|bleaching|snag|color_transfer"],
  "damage_location": "overall|sleeve|hem|collar|pocket|knee|back|front|cuffs|seam",
  "condition_score": 0.0,
  "human_condition_label": "like_new|good|fair|poor|destroyed",
  "ai_routing": "RESELL|UPCYCLE|RECYCLE",
  "routing_confidence": 0.0,
  "description": "one sentence covering garment + condition"
}
```

### Scoring rubric

Ranges are inclusive and honest — visible damage must lower the score:

| condition_score | human_condition_label | meaning |
|---|---|---|
| 1.00 | like_new | no visible wear |
| 0.80–0.95 | like_new | like new w/ faint signs of wear |
| 0.70–0.79 | good | light wear, minor pilling/fading |
| 0.55–0.69 | fair | visible tear/stain/wear but largely wearable |
| 0.40–0.54 | fair | worn: significant damage in wear zones |
| 0.25–0.39 | poor | heavily damaged, limited wearability |
| 0.05–0.24 | destroyed | severe damage / staining / thinning |

`condition_score` must stay internally consistent with
`damage_ratio + stain_ratio + wear_zone_ratio + fiber_degradation`
(higher damage → lower score). Default all ratios to 0 for a pristine item.

### Routing opinion (ai_routing)

Give your **independent** routing recommendation based ONLY on what the photo
shows, aligned to the formula's intent:

- `RESELL` — the garment is in good/excellent shape and clearly resale-able.
- `UPCYCLE` — damaged but made of a valuable/upcyclable material (denim,
  cotton, silk, wool, linen, jersey…) with usable panels, or minor damage.
- `RECYCLE` — destroyed/rotted (very low condition) or a cheap low-value
  fiber with heavy damage — beyond economical upcycle.

`routing_confidence` is a 0–1 float for how sure you are about `ai_routing`
based on image quality and ambiguity. When the photo is a collage, tutorial
screenshot or shows multiple garments, assess the **main garment** honestly
and lower `routing_confidence`.

---

## Stage 2 — Formula Validation

For every annotated row, compare:

```
formula_routing = getRouting(computeGLIE(cs, ms, mds, ss), cs, fiber, category)
ai_routing     = model's independent opinion (from Stage 1)
```

where `ms`, `mds`, `ss` come from the real datasets:

- `ms` = `computeMaterialScore(lookupT2(resolveFiber(fiber)))`
- `ss` = `computeSustainabilityScore(lookupT4(fiber), t2.eco_rating)`
- `mds` = `computeMarketDemandScore(queryT3(category, cs))`
- `glie` = `computeGLIE(cs, ms, mds, ss)`

### Output report

`data/T1_glie_validation.json`:

```json
{
  "total": 100,
  "agreement_rate": 0.0,
  "agreement_matrix": { "RESELL": {...}, "UPCYCLE": {...}, "RECYCLE": {...} },
  "rows": [
    {
      "image": "download (1).jpg",
      "garment_category": "tshirt",
      "fiber": "cotton",
      "condition_score": 0.65,
      "ai_routing": "UPCYCLE",
      "ai_confidence": 0.8,
      "formula_routing": "RESELL",
      "glie_score": 0.61,
      "ms": 0.6, "mds": 0.5, "ss": 0.5,
      "agree": false,
      "note": "formula says RESELL because cs=0.65 >= 0.45 -> UPCYCLE mate"
    }
  ]
}
```

### Interpreting the report

- **High agreement** → the formula's routing matches human/AI intuition.
- **Systematic disagreement** (e.g. formula over-`RESELL`s, or under-`UPCYCLE`s)
  → the thresholds in `formulas.getRouting()` (or the GLIE weights) need tuning.
- Flag rows where `ai_routing` is `RECYCLE` but formula says otherwise — these
  are the highest-risk routing errors.