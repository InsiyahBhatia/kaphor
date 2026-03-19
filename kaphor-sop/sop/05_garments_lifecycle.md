# SOP-05 — Garments & Lifecycle Optimization Engine
## Phase 5 of 22

**Prerequisite:** SOP-04 complete and validated.  
**Estimated time:** 120 minutes  
**Output:** Complete garment CRUD, behavioral signal engine, and the LOE (core IP)

---

## OBJECTIVE

Build the garment system and the Lifecycle Optimization Engine (LOE). The LOE is the core patentable innovation — it must be accurate, tested, and performant.

---

## STEP 5.1 — Garment Validation Schemas

Define Zod schemas:

```typescript
// createGarmentSchema
{
  title:         z.string().min(3).max(100),
  description:   z.string().min(10).max(2000),
  brand:         z.string().min(1).max(100),
  category:      z.string().min(1),
  subCategory:   z.string().optional(),
  size:          z.string().min(1),
  color:         z.array(z.string()).min(1).max(5),
  material:      z.array(z.string()).min(1).max(5),
  condition:     z.enum(['PRISTINE','MINOR_WEAR','UPCYCLE','RECYCLE_ONLY']),
  tags:          z.array(z.string()).max(10).default([]),
  styleTags:     z.array(z.string()).max(5).default([]),
  listingType:   z.enum(['SALE','RENTAL','ACCESSORY_SWAP']),
  price:         z.number().positive().optional(),
  rentalPriceDay:  z.number().positive().optional(),
  rentalPriceWeek: z.number().positive().optional(),
  recyclableFiber: z.number().min(0).max(100).optional(),
}
// Validation: if listingType=SALE → price required
//             if listingType=RENTAL → rentalPriceDay required

// interactionSchema
{
  garmentId: z.string().uuid(),
  eventType: z.enum(['VIEW','SAVE','WISHLIST','ADD_TO_CART','BUY_INTENT','SELL_INTENT']),
  sessionId: z.string().optional(),
  metadata:  z.record(z.any()).optional(),
}

// feedQuerySchema
{
  category:  z.string().optional(),
  size:      z.string().optional(),
  color:     z.string().optional(),
  priceMin:  z.number().optional(),
  priceMax:  z.number().optional(),
  condition: z.string().optional(),
  listingType: z.string().optional(),
  after:     z.string().optional(),
  limit:     z.number().int().min(1).max(50).default(20),
}
```

---

## STEP 5.2 — Compatibility Service (`src/services/compatibility.service.ts`)

```typescript
computeScore(userVector: number[], garmentVector: number[]): number
  // 1. If either vector empty or length mismatch → return 0
  // 2. cosine similarity from utils/vectors.ts
  // 3. Normalize to 0–1 range
  // 4. Return as decimal (e.g., 0.98 = 98% fit)

computeStyleBreakdown(user: User, garment: Garment): FitBreakdown
  // Returns: { colorMatch, styleMatch, sizeCompatibility, occasionFit, overall }
  // All values 0–100 (integers)
  // overall = weighted average: colorMatch*0.2 + styleMatch*0.4 + size*0.3 + occasion*0.1
  // Size compatibility: exact match=100, adjacent size=70, 2 sizes away=40, other=10
  // Color/style: computed via cosine similarity on sub-vectors

batchComputeScores(userId: string, garmentIds: string[]): Promise<Record<string, number>>
  // Cache key: "compat:{userId}" → JSON map of garmentId→score
  // TTL: 30 minutes
  // If cache hit: return cached map
  // If cache miss: compute all scores, cache result, return
```

---

## STEP 5.3 — Lifecycle Optimization Engine (`src/services/lifecycle.service.ts`)

**THIS IS THE CORE INNOVATION. Build it carefully.**

```typescript
// ── SIGNAL PROCESSING ────────────────────────────────────────────

async processInteraction(userId: string, garmentId: string, eventType: string): Promise<LOEResult>
  // 1. Create BehaviourEvent in DB
  // 2. Upsert BehaviourSignal:
  //    a. Get weight for eventType from EVENT_WEIGHTS constants
  //    b. interestScore = Math.min(1.0, current + weight)
  //    c. recentEventCount++ 
  //    d. recalculate engagementRate = positiveEvents / totalEvents (last 7 days)
  //    e. recalculate interactionDecay = timeSinceLastPositive / MAX_DAYS
  // 3. Call evaluateLifecycle(garmentId, userId)
  // 4. Return LOEResult

// ── SATURATION DETECTION ─────────────────────────────────────────

async detectSaturation(garmentId: string, userId: string): Promise<SaturationResult>
  // Input variables:
  //   R = recentEventCount (events in last SATURATION_WINDOW_DAYS days)
  //   E = engagementRate (positive events / total events)
  //   D = interactionDecay (normalized time since last positive event)
  //
  // saturationScore = (α × R/SATURATION_MAX_EVENTS) + (1 - E) + (β × D)
  // where α = 0.3, β = 0.3
  //
  // Return: { isSaturated: score > 0.7, score, recommendation }

// ── LIFECYCLE EVALUATION ─────────────────────────────────────────

async evaluateLifecycle(garmentId: string, userId: string): Promise<LOEResult>
  // Fetch: garment (with current state), behaviourSignal for (userId, garmentId)
  //
  // STATE TRANSITION RULES (evaluate in order):
  //
  // Current: LISTED
  //   → INTEREST if interestScore > LOE_THRESHOLDS.INTEREST
  //   → No change otherwise
  //
  // Current: INTEREST
  //   → BUY_INTENT if eventType is ADD_TO_CART or BUY_INTENT
  //   → SELL_INTENT if eventType is SELL_INTENT
  //   → No change otherwise
  //
  // Current: OWNERSHIP
  //   → DECLINE if interestScore < LOE_THRESHOLDS.DECLINE
  //   → SELL_INTENT if seller explicitly signals
  //
  // Current: DECLINE
  //   → CIRCULATION if compatibilityScore > 0.5 for any user in DB
  //   → TERMINAL if no match found and garment.condition = RECYCLE_ONLY
  //
  // Current: CIRCULATION
  //   → LISTED (re-list) if new buyer found (compatibility > threshold)
  //   → TERMINAL if garment age > 180 days with no engagement
  //
  // Determine ACTION:
  //   PROMOTE:    show garment to this user (score high, not saturated)
  //   SUPPRESS:   hide from this user (saturated or low score)
  //   TRANSITION: lifecycle state changed
  //   SCHEDULE:   add to CirculationSchedule for cooldown
  //
  // If action = SCHEDULE: create CirculationSchedule record
  // If state changed: update garment.lifecycleState in DB
  // Emit socket event: io.to(`garment:${garmentId}`).emit('lifecycle:update', result)
  //
  // Return: { action, newState, score, previousState }

// ── CIRCULATION SCHEDULER ────────────────────────────────────────

async scheduleCooldown(garmentId: string, userId: string, saturationScore: number): Promise<void>
  // cooldownDays = COOLDOWN_BASE_DAYS + Math.ceil(saturationScore * 7)
  // Create CirculationSchedule: status=PENDING, cooldownEnd = now + cooldownDays
  // Suppress garment from user's feed until cooldownEnd

async processCooldownExpiries(): Promise<void>
  // Called by a cron job every hour
  // Find all CirculationSchedule where status=PENDING AND cooldownEnd <= now
  // For each: find top 5 compatible new users, emit "garment:available" socket event
  // Update status=COMPLETED
```

---

## STEP 5.4 — Garment Service (`src/services/garment.service.ts`)

```typescript
createGarment(sellerId: string, data: CreateGarmentData, images: Buffer[])
  // 1. Upload each image to Cloudinary (folder: "kaphor/garments")
  // 2. Generate garmentVector: 
  //    Use Anthropic API to embed garment attributes into a vector
  //    Prompt: "Generate a 64-dimensional float array representing this garment: {JSON}"
  //    If AI fails: generate simple hash-based vector as fallback
  // 3. Create Garment in DB with lifecycleState=LISTED
  // 4. Return garment

getFeed(userId: string, filters: FeedFilters, pagination: PaginationParams)
  // 1. Check cache: "feed:{userId}:{filterHash}" → 30min TTL
  // 2. If cache miss:
  //    a. Fetch all compatible garments (active, not user's own)
  //    b. Apply filters (category, size, price range, etc.)
  //    c. Get compatibility scores for user (batchComputeScores)
  //    d. Sort by: compatibilityScore DESC, createdAt DESC
  //    e. Apply cursor pagination
  //    f. Cache result
  // 3. Return garments with fitScore attached

getGarmentById(id: string, requestingUserId?: string)
  // 1. Fetch garment with seller profile
  // 2. If requestingUserId: create VIEW BehaviourEvent asynchronously
  // 3. Increment viewCount (use prisma atomic increment)
  // 4. If requestingUserId: attach fitScore from compatibility service
  // 5. Return garment

updateGarment(garmentId: string, sellerId: string, data: UpdateData)
  // 1. Verify garment belongs to sellerId → 403 if not
  // 2. Update fields
  // 3. If lifecycle state changed: validate transition is legal

deleteGarment(garmentId: string, sellerId: string)
  // Soft delete: set isActive=false
  // Verify ownership before deleting
```

---

## STEP 5.5 — Garment Routes (`src/routes/garment.routes.ts`)

```
GET    /garments/feed               authenticate  → getFeed
GET    /garments/me                 authenticate  → getMySell
GET    /garments/:id                              → getById
POST   /garments                    authenticate, upload.array('images',8), validate → create
PUT    /garments/:id                authenticate, validate → update
DELETE /garments/:id                authenticate  → softDelete
GET    /garments/:id/lifecycle      authenticate  → getLifecycle
POST   /interactions                authenticate, validate → recordInteraction
```

---

## STEP 5.6 — Garment Service: `recordInteraction`

```typescript
async recordInteraction(userId: string, garmentId: string, eventType: string, sessionId?: string)
  // 1. Validate garment exists and is active
  // 2. Validate eventType is in allowed EventTypes
  // 3. Call lifecycleService.processInteraction()
  // 4. Return LOEResult (action, newState, fitScore)
```

---

## PHASE 5 VALIDATION CHECKLIST

```
□ POST /garments with 3 images → garment created with Cloudinary URLs in images array
□ GET /garments/feed → returns garments with fitScore field (0–100 integer)
□ GET /garments/feed with category filter → only matching garments returned
□ GET /garments/:id → increments viewCount, creates VIEW BehaviourEvent
□ POST /interactions with VIEW event → BehaviourEvent created, signal updated
□ POST /interactions with ADD_TO_CART (3 times) → garment transitions to BUY_INTENT state
□ LOE: interestScore increases correctly per EVENT_WEIGHTS
□ LOE: saturation detection fires after >20 events in 7 days
□ LOE: DECLINE state triggers when interestScore falls below threshold
□ cosineSimilarity used correctly in compatibility score
□ Feed is sorted by compatibility score descending
□ Cursor pagination works: GET /garments/feed?after={cursor} returns next page
□ DELETE /garments/:id by non-owner → 403
□ Garment vector generated on creation (even if fallback)
```

**PROCEED TO SOP-06 only when all boxes are checked.**

---

*SOP-05 · Kaphor AI Agent Build Guide · v1.0*
