# Kaphor RAG Bot — Master Reference Document
### GLIE Algorithm · Dataset Schema · Task Tracker

> **How to use this file:** Work through Section 6 (Task Tracker) top to bottom. Every task references a section in this document for the exact formula or schema you need.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [GLIE Master Formula](#2-glie-master-formula)
3. [Sub-Score Formulas (All 4 Components)](#3-sub-score-formulas)
4. [Routing Decision Logic](#4-routing-decision-logic)
5. [Dataset Schema (All 5 Tables)](#5-dataset-schema)
6. [Task Tracker](#6-task-tracker)
7. [Garment Lifecycle Passport Schema](#7-garment-lifecycle-passport-schema)
8. [API Contract](#8-api-contract)
9. [RAG Bot Architecture](#9-rag-bot-architecture)
10. [Patentability Summary](#10-patentability-summary)
11. [Viva Q&A Reference](#11-viva-qa-reference)

---

## 1. Project Overview

**Platform:** Kaphor — AI-driven circular fashion platform for the Indian market  
**RAG Bot purpose:** Analyse a user's garment (via photo + metadata) and route it to its optimal end-of-life pathway: Resell, Upcycle, or Recycle  
**Core algorithm:** Garment Lifecycle Intelligence Engine (GLIE)  
**Tech stack:** React Native · Node.js/Express · PostgreSQL + Prisma · pgvector · Google Gemini · AWS S3

### The 4 GLIE Components

| Component | Abbrev | Weight | Data source |
|-----------|--------|--------|-------------|
| Condition Score | CS | 0.35 | Gemini Vision AI on user photo |
| Material Score | MS | 0.25 | RAG Knowledge Base (T2 table) |
| Market Demand Score | MDS | 0.20 | T3 listing dataset + style vector engine |
| Sustainability Score | SS | 0.20 | T4 LCA lookup table |

---

## 2. GLIE Master Formula

```
GLIE = (W1 × ConditionScore)
     + (W2 × MaterialScore)
     + (W3 × MarketDemandScore)
     + (W4 × SustainabilityScore)
```

### Default Weights

| Symbol | Component | Value | Rationale |
|--------|-----------|-------|-----------|
| W1 | ConditionScore | **0.35** | Physical state is the primary resellability gate in Indian resale market |
| W2 | MaterialScore | **0.25** | Material quality determines upcycle potential |
| W3 | MarketDemandScore | **0.20** | Live market fit affects actual circular value |
| W4 | SustainabilityScore | **0.20** | Environmental impact informs recycle routing |

> **Constraint:** W1 + W2 + W3 + W4 = 1.00 always  
> **Range:** All sub-scores are normalised to [0.0, 1.0]  
> **Final GLIE range:** [0.0, 1.0]

### Weight Configuration Note

Weights are configurable per use case. For a sustainability-brand partner, W4 can be increased. For a luxury resale platform, W3 can be increased. Always re-normalise so weights sum to 1.0.

---

## 3. Sub-Score Formulas

---

### 3.1 ConditionScore (CS) — Weight: 0.35

**Source:** Google Gemini Vision API  
**Input:** User-uploaded garment photograph(s)

#### Formula

```
CS = 1 - ( (0.40 × DamageRatio)
          + (0.30 × WearZoneRatio)
          + (0.20 × StainRatio)
          + (0.10 × FiberDegradationScore) )
```

#### Sub-components

| Sub-component | Definition | Detection method |
|---------------|------------|-----------------|
| DamageRatio | Proportion of garment surface with tears, holes, or cuts | Gemini Vision — structural damage detection |
| WearZoneRatio | Fraction of high-wear zones (collar, cuffs, knees, armpit, seat) showing degradation | Gemini Vision — zone-level wear analysis |
| StainRatio | Proportion of surface with permanent stains (not removable) | Gemini Vision — discolouration detection |
| FiberDegradationScore | AI assessment of pilling, fraying, or structural fiber breakdown | Gemini Vision — texture analysis |

All sub-components range: 0.0 → 1.0

#### CS Interpretation Scale

| CS Range | Label | Meaning |
|----------|-------|---------|
| 0.85 – 1.00 | Like new | Lightly worn or never worn, near-original quality |
| 0.65 – 0.84 | Good | Visible use but no significant damage |
| 0.40 – 0.64 | Fair | Visible wear, still sellable with disclosure |
| 0.20 – 0.39 | Poor | Heavy wear — upcycle candidate |
| 0.00 – 0.19 | End of life | Beyond repair — recycle only |

---

### 3.2 MaterialScore (MS) — Weight: 0.25

**Source:** RAG Knowledge Base (T2 dataset — retrieved at inference time by fiber type)  
**Input:** Fabric composition of garment (from listing data or Gemini label-reading)

#### Formula

```
MS = (0.40 × FiberQualityScore)
   + (0.35 × EcoRating)
   + (0.25 × ReusabilityIndex)
```

#### Sub-components

| Sub-component | Definition | Source |
|---------------|------------|--------|
| FiberQualityScore | Ranked score of fiber type durability | T2 lookup by fiber_name |
| EcoRating | Environmental footprint of the material's production | T2 lookup — Ecoinvent / Carbonfact data |
| ReusabilityIndex | How many circular lifecycles the material can withstand | T2 lookup: max_circular_cycles / 20 |

#### Fiber Quality Reference Table (populate T2 from this)

| Fiber | FiberQualityScore | EcoRating | Notes |
|-------|------------------|-----------|-------|
| Silk (mulberry) | 1.00 | 0.75 | Luxury, highly durable |
| Cashmere | 0.95 | 0.65 | Extremely durable, water-intensive to produce |
| Merino Wool | 0.90 | 0.70 | Durable, biodegradable |
| Banarasi / Zari | 0.88 | 0.72 | Silk base with metallic thread |
| Organic Cotton | 0.85 | 0.90 | High eco, strong durability |
| Khadi | 0.82 | 0.95 | Handspun, highest eco rating |
| Linen | 0.80 | 0.88 | Natural, biodegradable |
| Cotton (standard) | 0.65 | 0.70 | Common, moderate durability |
| Georgette | 0.60 | 0.55 | Delicate — upcycle difficulty high |
| Chiffon | 0.55 | 0.50 | Very delicate, tears easily |
| Viscose / Rayon | 0.50 | 0.45 | Semi-synthetic, moderate eco |
| Chanderi | 0.72 | 0.68 | Cotton-silk blend, Indian specialty |
| Polyester | 0.40 | 0.25 | Microplastic shedding, low eco |
| Nylon | 0.38 | 0.22 | Low eco, poor biodegradability |
| Acrylic | 0.30 | 0.15 | Worst eco score |
| Mixed / Unknown | 0.20 | 0.20 | Cannot assess — flag for manual review |

---

### 3.3 MarketDemandScore (MDS) — Weight: 0.20

**Source:** Kaphor Style Vector engine + T3 listing dataset  
**Input:** Garment's style vector, current trend cluster vector, platform listing data

#### Formula

```
MDS = (0.40 × StyleTrendIndex)
    + (0.35 × PlatformDemandScore)
    + (0.25 × ResaleValueRatio)
```

#### Sub-components

| Sub-component | Definition | Formula |
|---------------|------------|---------|
| StyleTrendIndex | Cosine similarity between item's style vector and current trending vector cluster | cosine_similarity(item_vector, trend_cluster_vector) |
| PlatformDemandScore | Normalised saves / wishlists for similar items on Kaphor | saves_for_item / max_saves_in_category |
| ResaleValueRatio | Estimated resale price as fraction of original retail price | min(estimated_resale_price / original_price, 1.0) |

#### ResaleValueRatio Formula

```
ResaleValueRatio = min( EstimatedResalePrice / OriginalRetailPrice , 1.0 )
```

> **Why MDS is the novel patentable element:** No existing resale or recycling platform uses live style trend data to influence EOL routing. A physically worn item that is currently trending receives a boosted MDS and may route to RESELL instead of UPCYCLE. This is unique to GLIE.

#### StyleTrendIndex — Cosine Similarity

```
StyleTrendIndex = cos(θ) = (A · B) / (||A|| × ||B||)

Where:
  A = 64-dimensional style vector of the garment
  B = 64-dimensional "current trend" centroid vector
  θ = angle between the two vectors
  Result range: 0.0 (no match) to 1.0 (perfect match)
```

---

### 3.4 SustainabilityScore (SS) — Weight: 0.20

**Source:** T4 LCA lookup table + Kaphor Impact Formula engine  
**Input:** Fiber type → lookup T4 for CO2 and water benchmarks

#### Formula

```
SS = (0.50 × CarbonSavingScore)
   + (0.30 × WaterSavingScore)
   + (0.20 × CirculationMultiplierBonus)
```

#### Impact Base Formulas

```
CarbonSaved (kg)        = BaseMaterialCO2Cost × CirculationMultiplier
WaterSaved (L)          = BaseMaterialWaterCost × CirculationMultiplier
TreesEquivalent         = TotalCarbonSaved / 22

CarbonSavingScore       = min( CarbonSaved / MaxCarbonBenchmark , 1.0 )
WaterSavingScore        = min( WaterSaved / MaxWaterBenchmark , 1.0 )
CirculationMultiplierBonus = 0.10 × min(circular_count, 5) / 5
```

> Default benchmarks: MaxCarbonBenchmark = 40 kg, MaxWaterBenchmark = 7,600 L  
> CirculationMultiplierBonus rewards garments already in the circular economy (max bonus = 0.10 after 5 cycles)

#### LCA Reference Values (populate T4 from these)

| Garment type | Fiber | CO2 per garment (kg) | Water per garment (L) | Source |
|--------------|-------|---------------------|-----------------------|--------|
| Saree | Silk | 8.0 | 1,900 | Ecoinvent |
| Kurta | Cotton | 5.5 | 2,700 | Ecoinvent |
| Kurta | Khadi | 3.2 | 1,200 | Published LCA |
| Jeans | Denim cotton | 33.4 | 7,600 | Ecoinvent |
| T-shirt | Cotton | 5.5 | 2,700 | Ecoinvent |
| Coat | Wool | 40.0 | 3,100 | Ecoinvent |
| Saree | Banarasi silk | 9.5 | 2,100 | Estimated |
| Kurta | Polyester | 5.5 | 90 | Ecoinvent |
| Lehenga | Georgette | 7.2 | 1,600 | Estimated |
| Blouse | Chanderi | 4.8 | 1,450 | Estimated |

---

## 4. Routing Decision Logic

### GLIE Thresholds

```
if GLIE >= 0.70  →  RESELL
if GLIE >= 0.40  →  UPCYCLE
if GLIE < 0.40   →  RECYCLE
```

### What happens at each route

#### RESELL path (GLIE ≥ 0.70)
- Auto-generate Kaphor listing
- AI-suggested price = OriginalPrice × ResaleValueRatio
- Style-match to buyers whose Style Vector is similar to this garment's vector
- Log carbon and water saved to user's Impact Dashboard

#### UPCYCLE path (0.40 ≤ GLIE < 0.70)
- RAG query: retrieve top-5 guides from T5 corpus using:
  `query = f(fiber_type + damage_type + garment_category + damage_location)`
- Pass retrieved guides + garment photo to Gemini
- Gemini generates a bespoke step-by-step tutorial for THIS specific garment
- Display difficulty rating, time estimate, and tools required to user

#### RECYCLE path (GLIE < 0.40)
- Geo-query T4 / recycler database for nearest industrial recycler
- Match by fiber type (not all recyclers accept all materials)
- Schedule pickup or provide drop-off point
- Log maximum carbon offset to Impact Dashboard

---

## 5. Dataset Schema

> **Primary key linkage:** All tables are linked via `garment_id` (T1 → T3) and `fiber_id` (T2 → T4). T5 retrieval keys match T1 enums exactly.

---

### Table T1 — Garment Condition Dataset

**Purpose:** Train the ConditionScore vision model  
**Format:** CSV + images on S3  
**Minimum rows:** 2,000 | **Target:** 10,000+  
**Collection method:** Manual photography + human annotation

#### Feature Schema

| Feature | Type | Values / Range | Required | Notes |
|---------|------|---------------|----------|-------|
| **IDENTIFIERS** | | | | |
| garment_id | UUID | unique | YES | Primary key, links across all tables |
| photo_id | UUID | unique per photo | YES | One garment can have 3–5 photos |
| image_url | STRING | S3 path | YES | Never store raw image in DB |
| photo_angle | ENUM | front / back / detail / label / full_body | YES | Minimum: front + detail |
| **GARMENT IDENTITY** | | | | |
| garment_category | ENUM | saree / kurta / lehenga / anarkali / blouse / jeans / tshirt / dress / coat / other | YES | Indian + global categories |
| garment_subcategory | STRING | e.g. "silk saree", "denim jacket" | NO | Freeform, helps RAG retrieval |
| brand | STRING | brand name | NO | Leave blank if unknown |
| original_price_inr | FLOAT | 0 – 500,000 | YES | Original retail price in INR |
| age_months | INT | 0 – 360 | YES | Months since purchase (estimate ok) |
| times_worn | INT | 0 – 500 | NO | Approximate — strong signal for wear |
| **DAMAGE LABELS** | | | | |
| damage_ratio | FLOAT | 0.0 – 1.0 | YES | % of surface with tears / holes / cuts |
| stain_ratio | FLOAT | 0.0 – 1.0 | YES | % of surface with permanent stains |
| wear_zone_ratio | FLOAT | 0.0 – 1.0 | YES | % of high-wear zones degraded |
| fiber_degradation | FLOAT | 0.0 – 1.0 | YES | Pilling, fraying, structural breakdown |
| damage_types | ARRAY | tear / hole / stain / fading / pilling / fraying / broken_zip / missing_button / embroidery_damage / none | YES | Multi-select — all that apply |
| damage_location | ARRAY | collar / cuff / hem / armpit / knee / seat / pocket / zipper / embroidery / overall | YES | Where on garment is the damage |
| **COMPUTED LABELS** | | | | |
| condition_score | FLOAT | 0.0 – 1.0 | YES | Computed via CS formula — training label |
| human_condition_label | ENUM | like_new / good / fair / poor / end_of_life | YES | Secondary label for cross-validation |
| glie_routing | ENUM | RESELL / UPCYCLE / RECYCLE | YES | Final routing label |
| annotator_id | STRING | unique annotator code | YES | Track inter-annotator agreement |
| annotation_confidence | FLOAT | 0.0 – 1.0 | YES | Exclude rows below 0.6 from training |

#### Data Collection Notes for T1

- Aim for class balance: roughly 40% RESELL / 35% UPCYCLE / 25% RECYCLE
- Collect at least 3 photos per garment: front, back, and damage close-up
- Indian ethnic wear must represent at least 60% of total rows for market relevance
- Use a labelling tool (Label Studio or CVAT — both free) for structured annotation
- Have each garment annotated by 2 annotators; flag where they disagree

---

### Table T2 — Material Science Knowledge Base

**Purpose:** Build the MaterialScore RAG knowledge base  
**Format:** CSV + JSON (indexed into pgvector)  
**Minimum rows:** 200 fiber types | **Target:** 500+  
**Collection method:** Ecoinvent, Carbonfact, published LCA studies, manual research

#### Feature Schema

| Feature | Type | Values / Range | Required | Notes |
|---------|------|---------------|----------|-------|
| **FIBER IDENTITY** | | | | |
| fiber_id | UUID | unique | YES | Primary key |
| fiber_name | STRING | e.g. "Organic Cotton" | YES | Full common name |
| fiber_family | ENUM | natural_plant / natural_animal / synthetic / semi_synthetic / recycled | YES | Top-level family |
| fiber_aliases | ARRAY | ["rayon","viscose","art silk"] | NO | Helps RAG match user-entered names |
| common_in_india | BOOL | true / false | YES | Prioritise Indian market fabrics |
| **QUALITY & DURABILITY** | | | | |
| fiber_quality_score | FLOAT | 0.0 – 1.0 | YES | FiberQualityScore lookup value |
| durability_rating | ENUM | very_low / low / medium / high / very_high | YES | Qualitative durability label |
| max_circular_cycles | INT | 1 – 20 | YES | Max resell/upcycle cycles before EOL |
| reusability_index | FLOAT | 0.0 – 1.0 | YES | Computed: max_circular_cycles / 20 |
| washability | ENUM | machine / hand / dry_clean_only / spot_only | YES | Affects resale value and upcycle difficulty |
| **ECO RATINGS** | | | | |
| eco_rating | FLOAT | 0.0 – 1.0 | YES | Core EcoRating value in MaterialScore |
| is_biodegradable | BOOL | true / false | YES | Natural fibers = true |
| is_recyclable_industrially | BOOL | true / false | YES | Can industrial recycler process this? |
| microplastic_shedding | ENUM | none / low / medium / high | YES | High for synthetics — lowers eco_rating |
| certifications | ARRAY | GOTS / OEKO-TEX / BCI / Fair_Trade / none | NO | Boosts eco_rating if certified |
| **UPCYCLE & REPAIR PROPERTIES** | | | | |
| upcycle_difficulty | ENUM | easy / medium / hard / expert_only | YES | Key for upcycle routing decision |
| dyeable | BOOL | true / false | YES | Synthetics often cannot be re-dyed |
| stitchable | BOOL | true / false | YES | Fine silks can split under machine stitch |
| repair_notes | TEXT | freeform | NO | RAG-indexed: e.g. "use French seams on chiffon" |
| data_source | STRING | Ecoinvent / WRAP / manual | YES | Data traceability |

#### Priority Fibers to Populate First (Indian Market)

Silk, Khadi, Organic Cotton, Standard Cotton, Banarasi / Zari, Chanderi, Georgette, Chiffon, Kanjivaram Silk, Tussar Silk, Linen, Viscose, Polyester, Acrylic, Cotton-Polyester blend

---

### Table T3 — Market Demand Listing Dataset

**Purpose:** Train the MarketDemandScore model  
**Format:** CSV  
**Minimum rows:** 5,000 | **Target:** 50,000+  
**Collection method:** OLX India, Meesho, Facebook Marketplace India, manual entry, Kaphor platform listings

#### Feature Schema

| Feature | Type | Values / Range | Required | Notes |
|---------|------|---------------|----------|-------|
| **LISTING IDENTITY** | | | | |
| listing_id | UUID | unique | YES | Primary key |
| garment_id | UUID | FK → T1 | NO | Link if listing is in your platform |
| garment_category | ENUM | same as T1 | YES | Must match T1 categories |
| listing_date | DATE | YYYY-MM-DD | YES | Needed for trend decay computation |
| **PRICING SIGNALS** | | | | |
| original_price_inr | FLOAT | 0 – 500,000 | YES | MRP / original retail price |
| listed_price_inr | FLOAT | 0 – 500,000 | YES | What seller asked |
| sold_price_inr | FLOAT | 0 – 500,000 | NO | Actual transaction price (null if unsold) |
| was_sold | BOOL | true / false | YES | Key label for demand modelling |
| days_to_sell | INT | 0 – 365 | NO | Velocity signal — fast sale = high demand |
| resale_value_ratio | FLOAT | 0.0 – 1.0 | YES | sold_price / original_price, capped at 1.0 |
| **DEMAND SIGNALS** | | | | |
| num_views | INT | 0 – 100,000 | NO | Platform views (if available) |
| num_saves | INT | 0 – 10,000 | NO | Wishlist / bookmark count |
| num_offers | INT | 0 – 100 | NO | Number of buyer offers received |
| platform_demand_score | FLOAT | 0.0 – 1.0 | YES | Normalised: saves / max_saves_in_category |
| **STYLE & TREND SIGNALS** | | | | |
| style_tags | ARRAY | ethnic / fusion / minimal / boho / formal / bridal / casual / officewear | YES | Used to compute StyleTrendIndex |
| color_family | ENUM | neutrals / pastels / brights / darks / prints / metallics | YES | Color trends are cyclical |
| season | ENUM | festive / summer / winter / monsoon / all_season | YES | Critical for Indian fashion market |
| trend_score_at_listing | FLOAT | 0.0 – 1.0 | YES | StyleTrendIndex at time of listing |
| **CONDITION AT LISTING** | | | | |
| seller_condition_label | ENUM | new_with_tags / like_new / good / fair / poor | YES | Seller-reported condition |
| condition_score_at_listing | FLOAT | 0.0 – 1.0 | NO | Link to T1 ConditionScore if available |
| source_platform | ENUM | kaphor / olx / meesho / facebook_marketplace / manual | YES | Track for quality weighting |

#### Data Collection Priority

1. First 500 rows: manual entry from existing Indian resale listings
2. Next 5,000: scrape OLX India ethnic wear listings (Python + BeautifulSoup)
3. Ongoing: instrument Kaphor platform to log every listing event automatically

---

### Table T4 — Sustainability LCA Lookup

**Purpose:** Populate SustainabilityScore — direct lookup at inference time  
**Format:** CSV  
**Minimum rows:** 50 fiber types | **Target:** 200+  
**Collection method:** Ecoinvent, Carbonfact, published academic LCA studies

#### Feature Schema

| Feature | Type | Values / Range | Required | Notes |
|---------|------|---------------|----------|-------|
| **IDENTITY** | | | | |
| fiber_id | UUID | FK → T2 | YES | Join key to MaterialScore table |
| fiber_name | STRING | must match T2 | YES | Redundant for human readability |
| garment_type_example | STRING | e.g. "cotton kurta" | YES | Contextualises the numbers |
| **CARBON FOOTPRINT** | | | | |
| co2_per_garment_kg | FLOAT | 0 – 100 | YES | BaseMaterialCO2Cost in GLIE formula |
| co2_raw_material_kg | FLOAT | 0 – 50 | NO | Breakdown: farming / extraction phase |
| co2_processing_kg | FLOAT | 0 – 50 | NO | Breakdown: dyeing, finishing, spinning |
| co2_source | STRING | Ecoinvent / Carbonfact / DOI | YES | Cite source — required for patent credibility |
| **WATER FOOTPRINT** | | | | |
| water_per_garment_litres | FLOAT | 0 – 20,000 | YES | BaseMaterialWaterCost in GLIE formula |
| water_source | STRING | source citation | YES | Water LCA data must be cited |
| **CIRCULATION MULTIPLIER** | | | | |
| circulation_multiplier_base | FLOAT | 1.0 – 3.0 | YES | Multiplier applied when item stays in circulation |
| carbon_saving_per_cycle_kg | FLOAT | 0 – 100 | YES | = co2_per_garment × circulation_multiplier |
| water_saving_per_cycle_l | FLOAT | 0 – 20,000 | YES | = water_per_garment × circulation_multiplier |
| trees_equivalent_per_cycle | FLOAT | 0 – 5 | YES | = carbon_saving / 22 |
| **NORMALISED SCORES** | | | | |
| carbon_saving_score | FLOAT | 0.0 – 1.0 | YES | = min(carbon_saving / 40, 1.0) |
| water_saving_score | FLOAT | 0.0 – 1.0 | YES | = min(water_saving / 7600, 1.0) |
| max_co2_benchmark_kg | FLOAT | default: 40 | YES | Normalisation denominator — update as data grows |
| max_water_benchmark_l | FLOAT | default: 7,600 | YES | Normalisation denominator |

---

### Table T5 — Upcycle Tutorial RAG Corpus

**Purpose:** RAG retrieval — generate bespoke upcycling tutorials at inference time  
**Format:** JSON documents indexed as vectors in pgvector / Pinecone  
**Minimum documents:** 500 | **Target:** 2,000+  
**Collection method:** Original authored guides + curated web sources (Instructables, Pinterest, YouTube transcripts)

#### Document Schema

| Feature | Type | Values / Range | Required | Notes |
|---------|------|---------------|----------|-------|
| **DOCUMENT IDENTITY** | | | | |
| doc_id | UUID | unique | YES | Primary key in vector DB |
| doc_type | ENUM | repair / upcycle / reuse_idea / dye_guide / embellishment | YES | Determines which RAG path retrieves it |
| title | STRING | descriptive title | YES | e.g. "Patching a torn silk kurta with kantha stitch" |
| **RETRIEVAL KEYS** | | | | |
| fiber_types | ARRAY | FK → T2 fiber_name values | YES | Multiple fibers ok |
| damage_types | ARRAY | same ENUM as T1 damage_types | YES | Must match T1 tags for query to hit |
| garment_categories | ARRAY | same ENUM as T1 garment_category | YES | e.g. ["saree","lehenga"] |
| damage_location | ARRAY | same ENUM as T1 damage_location | NO | Collar-specific repairs tag "collar" |
| **GUIDE CONTENT** | | | | |
| difficulty | ENUM | beginner / intermediate / advanced / tailor_required | YES | Shown to user |
| time_minutes | INT | 5 – 600 | YES | Estimated completion time |
| tools_required | ARRAY | needle / thread / scissors / iron / fabric_glue / dye / patches | YES | User sees before starting |
| steps | JSON | [{"step":1,"instruction":"...","tip":"..."}] | YES | Minimum 3 steps, maximum 15 |
| full_text | TEXT | complete prose guide | YES | This field is vectorised and RAG-indexed |
| **QUALITY METADATA** | | | | |
| source | STRING | URL or "original" | YES | Cite web sources |
| indian_context | BOOL | true / false | YES | Prioritise Indian garments and techniques |
| technique_style | ARRAY | kantha / zari / patchwork / block_print / embroidery / plain_repair | NO | Boosts relevance for ethnic wear |
| embedding_vector | VECTOR | 1536-dim float array | YES | Generated by Gemini embedding on full_text |
| quality_score | FLOAT | 0.0 – 1.0 | YES | Human-rated — exclude below 0.6 from training |

#### RAG Query Construction (at inference time)

```
query = {
  "fiber_type": garment.fabric_composition,
  "damage_type": vision_ai.detected_damage_types,
  "garment_category": garment.category,
  "damage_location": vision_ai.detected_damage_locations
}

retrieved_docs = vector_db.similarity_search(
  query_embedding = embed(query),
  top_k = 5,
  filter = { "quality_score": { "$gte": 0.6 } }
)

tutorial = gemini.generate(
  system = "Generate a bespoke upcycling tutorial for this specific garment",
  context = retrieved_docs,
  image = garment_photo
)
```

---

## 6. Task Tracker

> Mark tasks with [x] when complete. Work top to bottom within each phase.

---

### Phase 1 — Foundation (Do this first)

#### 1.1 Algorithm finalisation

- [ ] Confirm GLIE weight configuration (default: 0.35 / 0.25 / 0.20 / 0.20) — adjust if needed for Indian market
- [ ] Define routing thresholds (default: ≥0.70 RESELL / ≥0.40 UPCYCLE / <0.40 RECYCLE)
- [ ] Create GLIE calculator prototype in Python to validate formula with test inputs
- [ ] Run the worked example (Section 3 formulas) manually with 5 real garments from your wardrobe to sense-check outputs

#### 1.2 Infrastructure setup

- [ ] Set up PostgreSQL database with pgvector extension installed
- [ ] Create S3 bucket for garment image storage
- [ ] Set up Prisma schema with GarmentLifecyclePassport (see Section 7)
- [ ] Configure Gemini API key and test Vision API with a test image
- [ ] Install and configure vector DB (pgvector preferred — already in Postgres stack)

---

### Phase 2 — T2 and T4 Tables (Quick wins — no images needed)

#### 2.1 T2 Material Science table

- [ ] Create T2 CSV template with all columns from Section 5 (T2 schema)
- [ ] Populate 15 priority Indian fiber rows: Silk, Khadi, Organic Cotton, Standard Cotton, Banarasi, Chanderi, Georgette, Chiffon, Kanjivaram, Tussar, Linen, Viscose, Polyester, Cotton-Poly blend, Acrylic
- [ ] Source eco_rating and reusability data from Ecoinvent (free academic access) or Carbonfact
- [ ] Add fiber_aliases for each row (especially regional Indian names)
- [ ] Expand to 50+ fiber rows using published material science data
- [ ] Set up pgvector indexing on repair_notes field for RAG retrieval
- [ ] **Target milestone:** 50 fiber rows complete

#### 2.2 T4 Sustainability LCA table

- [ ] Create T4 CSV template with all columns from Section 5 (T4 schema)
- [ ] Populate co2_per_garment_kg and water_per_garment_litres for 15 priority fibers using reference values from Section 3.4
- [ ] Compute and populate all derived fields: carbon_saving_per_cycle_kg, water_saving_per_cycle_l, trees_equivalent_per_cycle, carbon_saving_score, water_saving_score
- [ ] Set max_co2_benchmark_kg = 40 and max_water_benchmark_l = 7,600 as defaults
- [ ] Add co2_source and water_source citations for every row
- [ ] Expand to match T2 row count (every T2 fiber must have a T4 row)
- [ ] **Target milestone:** T4 complete for all T2 fibers

---

### Phase 3 — T5 Upcycle Corpus (Your competitive moat)

#### 3.1 Write original guides (do before web curation)

- [ ] Write 10 original repair guides for Indian ethnic wear — use this matrix:
  - Silk saree + hem tear
  - Silk saree + zari embroidery damage
  - Cotton kurta + collar fray
  - Cotton kurta + fading (re-dye guide)
  - Lehenga + embroidery damage
  - Anarkali + underarm stain
  - Georgette dupatta + edge fray
  - Banarasi kurta + missing button / hook
  - Chiffon blouse + small tear
  - Denim / cotton blend + knee wear
- [ ] For each guide: fill all T5 fields from Section 5, including retrieval keys (fiber_types, damage_types, garment_categories)
- [ ] Rate your own guides for quality_score — be strict, target 0.8+
- [ ] **Target milestone:** 10 original guides complete and formatted as T5 JSON

#### 3.2 Curate web sources

- [ ] Identify 50 high-quality upcycling guides from Instructables, Pinterest, YouTube (transcript), and Indian craft blogs
- [ ] For each: rewrite in your own words (do not copy-paste), add T5 metadata fields, rate quality_score
- [ ] Flag indian_context = true for any guide using kantha, zari, block print, embroidery techniques
- [ ] **Target milestone:** 100 total T5 documents

#### 3.3 Generate embeddings and index

- [ ] Write script to call Gemini Embedding API on full_text field of each T5 document
- [ ] Store 1536-dim embedding_vector in pgvector table
- [ ] Test retrieval: send 5 test queries and verify top-k results are semantically correct
- [ ] **Target milestone:** All T5 documents indexed and retrieval verified

---

### Phase 4 — T3 Market Demand Dataset

#### 4.1 Manual collection (first 200 rows)

- [ ] Create T3 CSV template with all columns from Section 5 (T3 schema)
- [ ] Record 50 sold listings from OLX India ethnic wear section (note: original price, asking price, sold price if visible, days listed, category)
- [ ] Record 50 unsold listings (was_sold = false) for negative examples
- [ ] Record 100 listings from Facebook Marketplace India (same fields)
- [ ] Compute resale_value_ratio for each row: sold_price / original_price
- [ ] Assign style_tags, color_family, and season manually for each row
- [ ] **Target milestone:** 200 T3 rows complete

#### 4.2 Automated collection (scale up)

- [ ] Write Python scraper for OLX India ethnic wear category
- [ ] Write Python scraper for Meesho second-hand listings (if available)
- [ ] Set up scheduled data collection (weekly runs)
- [ ] Build data cleaning pipeline: remove duplicates, fill null prices with median
- [ ] **Target milestone:** 5,000 T3 rows

---

### Phase 5 — T1 Garment Condition Dataset (Heaviest lift)

#### 5.1 Equipment and setup

- [ ] Install Label Studio (free, open source) for image annotation — run locally
- [ ] Define annotation guidelines document (share with all annotators so labels are consistent)
- [ ] Create S3 folder structure: /kaphor-dataset/T1/images/{garment_id}/
- [ ] Test annotation workflow end-to-end with 5 garments before scaling

#### 5.2 Initial collection (your own wardrobe)

- [ ] Photograph all 13 garments from your rental catalogue:
  - 3 photos each: front, back, detail/damage close-up
  - Consistent background (white/light wall)
  - Good lighting (natural light preferred)
- [ ] Annotate all 13 garments in Label Studio — fill all T1 fields including damage ratios
- [ ] Compute condition_score for each using CS formula from Section 3.1
- [ ] Cross-check your CS score against human_condition_label for sanity
- [ ] **Target milestone:** 13 garments (39 photos) annotated

#### 5.3 Scale up via network

- [ ] Ask 5–10 friends/family to photograph 3–5 old garments each (collect by WhatsApp)
- [ ] Target garment condition diversity: collect deliberately worn/damaged items
- [ ] Annotate all collected images in Label Studio
- [ ] Aim for at minimum 2 annotators per garment — flag disagreement rows
- [ ] **Target milestone:** 200 annotated garments (600+ photos)

#### 5.4 Quality control

- [ ] Calculate inter-annotator agreement (Cohen's Kappa) — target kappa > 0.7
- [ ] Remove rows with annotation_confidence < 0.6 from training set
- [ ] Check class distribution: if RECYCLE rows < 20%, actively seek heavily damaged garments
- [ ] Audit first 50 rows end-to-end: image → annotation → CS score → routing

---

### Phase 6 — Model Training and Integration

#### 6.1 ConditionScore vision model

- [ ] Fine-tune Gemini Vision on T1 dataset with CS as target label
- [ ] Evaluate on held-out test set (80/20 train/test split)
- [ ] Target metrics: MAE < 0.05 on CS, routing accuracy > 85%
- [ ] Deploy as `/api/glie/condition` endpoint in Node.js backend

#### 6.2 MaterialScore RAG integration

- [ ] Build RAG retrieval service: fiber_type → query T2 pgvector → return MS sub-scores
- [ ] Test with 20 fiber types — verify correct scores are returned
- [ ] Handle unknown / mixed fibers: return MS = 0.20 and flag for manual review

#### 6.3 MarketDemandScore model

- [ ] Train regression model on T3 dataset with resale_value_ratio as target
- [ ] Features: garment_category, season, style_tags, color_family, age_months, condition_score
- [ ] Integrate with Kaphor's existing Style Vector cosine similarity engine
- [ ] Deploy as `/api/glie/market-demand` endpoint

#### 6.4 SustainabilityScore lookup

- [ ] Build T4 lookup service: fiber_type → query T4 → return SS sub-scores
- [ ] Test with 15 fiber types — verify carbon and water scores are correct
- [ ] Deploy as `/api/glie/sustainability` endpoint

#### 6.5 Full GLIE integration

- [ ] Implement master GLIE formula combining all 4 sub-scores with weights
- [ ] Implement routing decision logic (thresholds from Section 4)
- [ ] Build `POST /api/glie/assess` endpoint (see Section 8)
- [ ] End-to-end test: upload garment photo → receive full GLIE response
- [ ] Write GLIE assessment result to GarmentLifecyclePassport (see Section 7)

---

### Phase 7 — Validation and Iteration

- [ ] Run 50 real garments through full GLIE pipeline — review every routing decision
- [ ] Compare AI routing vs human expert routing — flag disagreements
- [ ] Tune weights if needed (e.g. if MDS is too dominant for your user base)
- [ ] Collect user feedback on upcycle tutorials — rate tutorials 1–5 for usefulness
- [ ] Use low-rated tutorials to identify T5 gaps — write new guides to fill them
- [ ] Update GLIE formula version in database after each weight adjustment

---

## 7. Garment Lifecycle Passport Schema

The GLP is the persistent record for each garment across its full circular life on Kaphor. Every GLIE assessment writes to this record.

```
GarmentLifecyclePassport {
  garment_id              UUID    (PK)
  listing_id              UUID    (FK → Listings)
  brand                   String
  fabric_composition      String[]
  original_price          Decimal
  original_owner_id       UUID    (FK → Users)

  glie_assessments        GLIEAssessment[]
  circular_count          Int          (how many times item has circulated)
  current_state           Enum [LISTED, SOLD, RENTED, UPCYCLING, RECYCLED]

  total_carbon_saved      Decimal (kg)
  total_water_saved       Decimal (L)
  total_trees_eq          Decimal

  created_at              Timestamp
  last_assessed_at        Timestamp
}

GLIEAssessment {
  id                      UUID    (PK)
  garment_id              UUID    (FK)
  assessed_by             UUID    (FK → Users)
  glie_score              Float
  condition_score         Float
  material_score          Float
  market_demand_score     Float
  sustainability_score    Float
  routing_decision        Enum [RESELL, UPCYCLE, RECYCLE]
  upcycle_tutorial        Text    (RAG-generated, nullable)
  recycler_matched        String  (nullable)
  assessed_at             Timestamp
}
```

---

## 8. API Contract

### POST /api/glie/assess

**Request**
```json
{
  "garment_id":   "uuid",
  "image_url":    "s3://kaphor-bucket/garments/...",
  "listing_id":   "uuid",
  "user_id":      "uuid"
}
```

**Response**
```json
{
  "glie_score":             0.7796,
  "routing_decision":       "RESELL",
  "condition_score":        0.945,
  "material_score":         0.855,
  "market_demand_score":    0.626,
  "sustainability_score":   0.549,
  "carbon_saved_kg":        6.6,
  "water_saved_l":          3240,
  "trees_equivalent":       0.3,
  "upcycle_tutorial":       null,
  "recycler_matched":       null,
  "passport_id":            "uuid"
}
```

### Routing-specific response additions

| Route | Additional fields |
|-------|------------------|
| RESELL | `suggested_price_inr`, `matched_buyer_ids[]` |
| UPCYCLE | `upcycle_tutorial` (full text), `tutorial_difficulty`, `tutorial_time_minutes`, `tools_required[]` |
| RECYCLE | `recycler_matched` (name), `recycler_address`, `pickup_available` (bool) |

---

## 9. RAG Bot Architecture

```
User uploads garment photo
        │
        ├──► Gemini Vision API          → ConditionScore (CS)
        │       damage_ratio, stain_ratio,
        │       wear_zone_ratio, fiber_degradation
        │
        ├──► T2 RAG Knowledge Base      → MaterialScore (MS)
        │       fiber_quality_score,
        │       eco_rating, reusability_index
        │
        ├──► T3 + Style Vector engine   → MarketDemandScore (MDS)
        │       style_trend_index,
        │       platform_demand_score,
        │       resale_value_ratio
        │
        └──► T4 LCA Lookup              → SustainabilityScore (SS)
                 carbon_saving_score,
                 water_saving_score,
                 circulation_multiplier_bonus
                        │
                        ▼
         GLIE = 0.35×CS + 0.25×MS + 0.20×MDS + 0.20×SS
                        │
              Decision Router (thresholds)
              /           │            \
          RESELL       UPCYCLE       RECYCLE
             │             │             │
        Auto-list     T5 RAG query   Geo-match
        + price       → Gemini gen   recycler
        suggestion    bespoke guide  + schedule
             │             │             │
          ───────────────────────────────
                            │
                   Write to GLP (Postgres)
                   Log impact (Dashboard)
```

---

## 10. Patentability Summary

| # | Novel element | Why it is novel |
|---|---------------|----------------|
| 1 | GLIE weighted formula | First algorithm to combine CV condition + material science RAG + live market demand + sustainability into a single EOL routing score |
| 2 | Market-demand-weighted EOL routing | No existing resale or recycling platform uses live style trend signals to influence lifecycle routing |
| 3 | RAG-personalised upcycle tutorials | Generates bespoke step-by-step guides unique to each garment's fabric × damage × style combination |
| 4 | Garment Lifecycle Passport (GLP) | Persistent AI-maintained digital identity for individual garments across multiple circular lifecycles |
| 5 | CirculationMultiplierBonus | Rewards garments already in the circular economy with a sustainability bonus — incentivises multi-cycle reuse |

### Suggested Patent Title

> *"A multi-modal weighted scoring system and method for automated garment end-of-life lifecycle routing using computer vision, retrieval-augmented knowledge, real-time market demand signals, and sustainability impact metrics"*

---

## 11. Viva Q&A Reference

**Q: What is the core innovation in the GLIE algorithm?**  
The GLIE formula is the first to combine four independent signals — physical condition from computer vision, material science knowledge from a RAG database, live market demand from style vector analytics, and environmental sustainability — into a single weighted routing decision. Existing tools either check condition only (ThredUp) or material only (recycling apps). GLIE treats EOL routing as a multi-variable optimisation problem.

**Q: Why is MarketDemandScore included in an EOL algorithm?**  
A garment's circular value is not purely physical. A lightly worn item in an unfashionable style has lower circular value than a heavily worn item that is currently trending. The MarketDemandScore uses Kaphor's existing Style Vector cosine similarity engine to determine whether the item matches the current trend cluster — a signal no existing recycling platform captures. This is the most novel and patentable element.

**Q: How does the RAG Bot generate personalised upcycle tutorials?**  
When GLIE routes to UPCYCLE, the system queries the T5 corpus with a compound key of fiber type + damage type + garment category + damage location. It retrieves the top-5 most semantically similar guides via pgvector cosine similarity. These are fed to Gemini along with the garment photo and a structured prompt. The output is a step-by-step tutorial written specifically for that exact garment — not a generic guide.

**Q: What is the Garment Lifecycle Passport?**  
The GLP is a persistent PostgreSQL record that follows an individual garment across its entire life on Kaphor. It stores every GLIE assessment ever run on the item, cumulative environmental savings, and the garment's current circular state. Over time it builds a verifiable sustainability history for each item — a persistent AI-maintained digital identity for individual garments. This concept is a separate patentable contribution from the GLIE formula itself.

**Q: How do you handle unknown or mixed fiber garments?**  
If the fabric composition cannot be read from the label (Gemini Vision label-reading) or is not in T2, the system sets MaterialScore = 0.20 (unknown / mixed default) and flags the garment for manual review. This conservative default prevents the system from over-routing unknown materials to RESELL.

**Q: Why PostgreSQL + pgvector instead of a dedicated vector database like Pinecone?**  
pgvector keeps the entire system within the existing PostgreSQL stack, reducing operational complexity and cost. For Kaphor's dataset size (thousands to tens of thousands of documents), pgvector's HNSW index provides sub-millisecond similarity search — comparable to Pinecone. If the corpus grows beyond 1 million documents, migration to Pinecone can be done without changing the GLIE logic.

---

*KaPhor Research Paper — K.J. Somaiya Institute of Technology*  
*Supervised by Dr. Sarika Mane | Team: Moli, Nida Bepari, Insiyah Bhatia*  
*Last updated: June 2026*
