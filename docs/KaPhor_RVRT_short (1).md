KaPhor — RVRT (Recycler Verification & Route-Tracking)

**KaPhor**

Recycler Verification & Risk-Weighted Route-Tracking Layer (RVRT)

*A patentable extension to GLIE's RECYCLE pathway — companion to the GLIE Master Reference Document*

Team: Nida Bepari · Insiyah Bhatia · Molisha Jain · Dr. Sarika Mane, KJSIT
# **1. The Gap This Closes**
GLIE's RECYCLE branch (GLIE < 0.40) currently does one thing: geo-query the recycler database and match by fiber type to the nearest facility. It applies no verification, safety, or sourcing criteria. Given that India's recycling sector is largely undocumented and that investigative reporting (CNN, The Guardian, ThePrint, Atmos) documents serious worker respiratory illness concentrated at high-volume, import-heavy hubs like Panipat, routing blindly by distance risks sending KaPhor's highest-risk garments — the ones needing the harshest processing — to the least safe, least accountable facilities.

RVRT replaces that single step with a sub-router, the same way GLIE's UPCYCLE branch already has its own RAG-retrieval sub-process. It adds one new idea on top of a simple filter, which is what makes it algorithmic rather than a business rule: the weight given to a facility's safety profile is not fixed — it scales with how risky the specific garment is to process.
# **2. Formulas**
## **2.1 ProcessingIntensityScore (PIS) — how risky this garment is to process**
Reuses GLIE's existing ConditionScore and T2 fiber data — no new input pipeline needed.

|<p>PIS = (0.45 × (1 - ConditionScore))</p><p>`    `+ (0.35 × SyntheticFiberRatio)</p><p>`    `+ (0.20 × BlendComplexity)</p><p> </p><p>SyntheticFiberRatio = 1.0 synthetic / 0.5 blend / 0.0 natural  (T2 lookup)</p><p>BlendComplexity      = 1.0 if 2+ fiber types in composition, else 0.0</p><p>Range: PIS ∈ [0.0, 1.0] — higher = harsher processing required</p>|
| :- |
## **2.2 FacilityTrustScore (FTS) — the facility's report card**

|<p>FTS = (0.40 × VerificationTierScore)</p><p>`    `+ (0.30 × SourcingRiskScore)</p><p>`    `+ (0.20 × SafetyAuditScore)</p><p>`    `+ (0.10 × RecencyScore)</p><p> </p><p>VerificationTierScore: UNVERIFIED=0.10  SELF\_REPORTED=0.40</p><p>`                       `FIELD\_VERIFIED=0.75  AUDITED=1.00</p><p>SourcingRiskScore:     DOMESTIC\_ONLY=1.00  MIXED=0.60</p><p>`                       `IMPORT\_HEAVY=0.30  UNKNOWN=0.20</p><p>SafetyAuditScore     = avg(ppe\_score, ventilation\_score, effluent\_score)</p><p>RecencyScore         = max(0, 1 - days\_since\_verified / 180)</p>|
| :- |
## **2.3 RouteScore — the adaptive combination (core novel mechanism)**
Facility-selection weights are computed per garment from PIS, not fixed:

|<p>if PIS >= 0.70:   Wd=0.15  Wf=0.55  Wc=0.20  Wm=0.10   // trust dominates</p><p>elif PIS >= 0.40: Wd=0.30  Wf=0.35  Wc=0.20  Wm=0.15</p><p>else:             Wd=0.45  Wf=0.15  Wc=0.20  Wm=0.20   // distance dominates</p><p> </p><p>RouteScore = (Wd×DistanceScore) + (Wf×FTS)</p><p>`           `+ (Wc×CapacityAvailability) + (Wm×MaterialMatch)</p><p> </p><p>chosen\_facility = argmax(RouteScore) over all candidates</p>|
| :- |

*Wd+Wf+Wc+Wm = 1.00 always, consistent with GLIE's own top-level weight constraint.*
# **3. Routing Logic and Verification Decay**

|<p>if GLIE < 0.40:</p><p>`    `PIS = computeProcessingIntensity(condition\_score, fiber\_type)</p><p>`    `candidates = Facility.query(materials\_accepted CONTAINS fiber\_type,</p><p>`                                 `within\_radius(location, max\_distance\_km))</p><p>`    `for f in candidates: f.RouteScore = computeRouteScore(PIS, f)</p><p>`    `chosen = candidates.sort\_by(RouteScore, desc)[0]</p><p>`    `emit RouteDecisionRecord(garment\_id, chosen.facility\_id, PIS,</p><p>`                              `weights\_used, chosen.RouteScore)</p><p>`    `return { recycler\_matched, verification\_badge, route\_decision\_id }</p><p> </p><p>// Daily scheduled job</p><p>for facility in T6.all():</p><p>`    `if days\_since(facility.last\_verified\_at) > 180:</p><p>`        `facility.verification\_tier = downgrade\_one\_tier(...)</p>|
| :- |

Every routing decision logs the exact weights and scores that produced it (RouteDecisionRecord) — this makes facility selection auditable, mirroring how GLIEAssessment already logs all four sub-scores. Verification tiers auto-downgrade after 180 days without re-check, so trust signals can't go stale silently.
## **User-facing badge (shown at the same disposal screen as the carbon badge)**

|**Tier**|**Badge text**|
| :- | :- |
|AUDITED|“Independently audited safe-handling partner”|
|FIELD\_VERIFIED|“Verified safe-handling partner”|
|SELF\_REPORTED|“Partner-reported, not independently checked”|
|UNVERIFIED|“Routed via informal network — verification unavailable”|

*Same UI slot GLIE already uses for carbon/water savings — no new screen required.*
# **4. Dataset Schema — Table T6: Recycler Verification**
Format: PostgreSQL/Prisma, joined to the existing recycler reference via facility\_id. Launch target: 10–15 named partners (Goonj, Saahas Zero Waste, Respun, EcoDhaga, Bombay Recycling Concern), populated via self-onboarding form.

|**Field**|**Values / Range**|**Notes**|
| :- | :- | :- |
|facility\_id, name|UUID, string|Primary key + display name|
|materials\_accepted|cotton/polyester/wool/blended/mixed|Must match T2 fiber\_family|
|location, monthly\_capacity\_kg, current\_load\_kg|geo; 0–1,000,000|Feeds DistanceScore, CapacityAvailability|
|verification\_tier|unverified/self\_reported/field\_verified/audited|Drives VerificationTierScore|
|last\_verified\_at, verified\_by|timestamp; kaphor\_team/3rd\_party/self|Drives RecencyScore + decay job|
|ppe\_score, ventilation\_score, effluent\_score|0\.0–1.0 each|From onboarding photo review → SafetyAuditScore|
|sourcing\_profile|domestic\_only/mixed/import\_heavy/unknown|Drives SourcingRiskScore|
|output\_pathway|yarn\_recycling/fiber\_extraction/upcycled\_product/export\_reuse|Informs “likely outcome” text to user|

*Table T6 — extends T1–T5 in the same format.*
# **5. API Addition (RECYCLE branch only)**
Extends POST /api/glie/assess — RESELL and UPCYCLE responses are unchanged.

|<p>{</p><p>`  `"recycler\_matched":      "Saahas Zero Waste — Bengaluru TRF",</p><p>`  `"recycler\_address":      "...",</p><p>`  `"pickup\_available":      true,</p><p>`  `"verification\_tier":     "FIELD\_VERIFIED",</p><p>`  `"verification\_badge":    "Verified safe-handling partner",</p><p>`  `"processing\_intensity":  0.81,</p><p>`  `"facility\_trust\_score":  0.78,</p><p>`  `"route\_score":           0.74,</p><p>`  `"route\_decision\_id":     "uuid"</p><p>}</p>|
| :- |
# **6. Patentability Summary**
Extends Section 10 of the GLIE Master Reference Document with three new rows:

|**#**|**Novel element**|**Why it is novel**|
| :- | :- | :- |
|**6**|PIS-adaptive facility weighting|No existing recycling-routing system varies its own selection weights based on a computed estimate of how intensively the item must be processed — the algorithm changes its own logic per input, not a static formula applied to all items.|
|**7**|Decaying, tiered verification|FacilityTrustScore auto-downgrades after 180 days without re-check — prevents stale trust signals from persisting, with no equivalent in existing CSR/sustainability disclosure tools.|
|**8**|Auditable RouteDecisionRecord|Every routing decision logs the exact weights/scores that produced it, extending GLIEAssessment's audit-trail pattern to facility selection.|

*Suggested patent title: “A computer-implemented method for risk-adaptive facility selection in automated textile end-of-life routing, wherein selection-criteria weighting is dynamically computed from a garment-specific processing-intensity estimate, combined with a time-decaying, tiered facility verification record.”*

Position RVRT as a dependent claim attached to the existing GLIE application rather than a separate filing — it reuses GLIE's ConditionScore as a direct input and demonstrates the same weighted multi-factor philosophy applied to a second problem. Confirm this structure with your patent attorney; combining vs. separate filing is a legal call, not a technical one.
# **7. Next Steps**
1. Sense-check the PIS/RouteScore default weights with the team before locking them, same as GLIE's own weights.
1. Onboard 5–10 named partners (Goonj, Saahas, Respun, EcoDhaga) via a simple self-reported form — populates T6 at SELF\_REPORTED tier fast.
1. Defer automated photo-based safety scoring to a later phase — start with manual review; a CV classifier needs labelled data you don't have yet.
1. Build the 180-day decay job early — cheap, and keeps the trust layer honest as the partner list grows.
1. Bring Sections 2.3 and 6 to your next patent attorney conversation — the adaptive-weighting mechanism is the strongest individual claim.
Page 
