# SOP-07 — Circular Service, Impact, Social, Studio & AI
## Phases 9–13 of 22

**Prerequisite:** SOP-06 complete and validated.  
**Estimated time:** 150 minutes

---

## PHASE 9 — CIRCULAR SERVICE

### STEP 9.1 — Circular Routes & Logic

```
GET    /circular/garment/:id           authenticate  → getCircularData
POST   /circular/condition-check       authenticate, upload.array('images',4) → conditionCheck
POST   /circular/schedule-collection   authenticate, validate → scheduleCollection
GET    /circular/partners              public → listPartners
```

### Circular Service (`src/services/circular.service.ts`)

```typescript
conditionCheck(garmentId: string, imageBuffers: Buffer[])
  // 1. Upload images to Cloudinary (folder: "kaphor/circular-checks")
  // 2. Call Anthropic API:
  //    system: "You are a garment condition assessment expert."
  //    user: "Assess these garment images and return JSON: { condition: 'PRISTINE'|'MINOR_WEAR'|'UPCYCLE'|'RECYCLE_ONLY', recommendedAction: 'RE_SELL'|'UPCYCLE'|'RECYCLE', recyclableFiber: number (0-100), notes: string }"
  //    Pass image URLs in the message
  // 3. Parse response, update garment.condition and garment.recyclableFiber in DB
  // 4. Determine lifecycleAction based on condition
  // 5. Return { condition, recommendedAction, recyclableFiber, estimatedImpact }

getCircularData(garmentId: string)
  // Return: garment with condition, lifecycleState, recyclableFiber, recommendedAction
  // Include: impact estimate if recycled/upcycled

scheduleCollection(userId: string, data: CollectionRequest)
  // 1. Validate garment belongs to user
  // 2. Store collection request (create CircularCollection model or use metadata)
  // 3. Send confirmation email with slot details
  // 4. If action=RECYCLE: update garment lifecycleState=TERMINAL, ImpactRecord.itemsRecycled++
  // 5. If action=UPCYCLE: update garment lifecycleState=TERMINAL, ImpactRecord.itemsUpcycled++
  // 6. Update ImpactRecord with RECYCLE or UPCYCLE values
```

---

## PHASE 10 — IMPACT TRACKING

### STEP 10.1 — Impact Service (`src/services/impact.service.ts`)

```typescript
getUserImpact(userId: string): Promise<ImpactDashboard>
  // 1. Fetch ImpactRecord
  // 2. Calculate tier: find highest tier where carbonSavedKg >= min
  // 3. Calculate nextTier: next tier after current
  // 4. Calculate treesEquivalent: Math.floor(carbonSavedKg / TREE_CO2_KG_PER_YEAR)
  // 5. Calculate nextMilestoneKg: nextTier.min - carbonSavedKg
  // 6. Return full dashboard data

recalculateTier(userId: string): Promise<UserTier>
  // After any impact update, recalculate and update User.tier
  // Return new tier
  // If tier changed: emit socket "tier:upgraded" to user

getImpactReport(userId: string): Promise<ImpactReport>
  // Monthly breakdown of carbon and water saved
  // Per-garment contribution history (join with orders/rentals)
  // Community comparison: user's carbonKg vs avg for users of same age

// updateImpact is called from order/rental/circular services — not from routes directly
updateImpact(userId: string, type: 'SALE'|'RENTAL'|'UPCYCLE'|'RECYCLE'): Promise<void>
  // Atomic increment using Prisma updateMany with increment
  // Then recalculateTier()
```

### STEP 10.2 — Impact Routes

```
GET /impact/me         authenticate → getMyImpact
GET /impact/me/report  authenticate → getImpactReport
```

---

## PHASE 11 — SOCIAL FEED

### STEP 11.1 — Social Service (`src/services/social.service.ts`)

```typescript
getFeed(userId: string, params: PaginationParams): Promise<PostFeed>
  // 1. Get IDs of users that userId follows
  // 2. Fetch posts from those users + curated public posts
  // 3. Exclude user's own posts from "others" section
  // 4. Include per post: likeCount, commentCount, isLikedByMe
  // 5. Include user profile: avatar, username, location
  // 6. Cursor pagination
  // 7. Cache: "social_feed:{userId}" → 5min TTL

createPost(userId: string, data: CreatePostData, imageBuffers: Buffer[])
  // 1. Upload images to Cloudinary (folder: "kaphor/posts")
  // 2. Validate garmentIds exist if provided
  // 3. Create Post in DB
  // 4. Invalidate user's followers' feed caches: Redis keys "social_feed:*"
  // 5. Return created post

toggleLike(userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }>
  // If Like exists: delete it (unlike), return { liked: false }
  // If Like not exists: create it, emit "like:new" socket to post owner
  // Return current likeCount

addComment(userId: string, postId: string, content: string): Promise<Comment>
  // Validate content length: 1–500 chars
  // Create Comment
  // Emit "comment:new" socket to post owner (include commenter profile)
  // Return comment with user profile

followUser(followerId: string, followingId: string)
  // Upsert Follow (create or ignore if exists)
  // Emit socket "follow:new" to followingId
  // Invalidate follower's feed cache

unfollowUser(followerId: string, followingId: string)
  // Delete Follow
  // Invalidate follower's feed cache
```

### STEP 11.2 — Social Routes

```
GET    /social/feed                    authenticate           → getFeed
POST   /social/posts                   authenticate, upload   → createPost
GET    /social/posts/:id               authenticate           → getPost
DELETE /social/posts/:id               authenticate           → deletePost (own only)
POST   /social/posts/:id/like          authenticate           → toggleLike
GET    /social/posts/:id/comments      authenticate           → getComments
POST   /social/posts/:id/comments      authenticate, validate → addComment
POST   /social/follow/:userId          authenticate           → followUser
DELETE /social/follow/:userId          authenticate           → unfollowUser
GET    /social/users/:userId/profile   authenticate           → getUserProfile
```

---

## PHASE 12 — STUDIO & UPCYCLE

### STEP 12.1 — Studio Service (`src/services/studio.service.ts`)

```typescript
// Tutorials are stored in DB or as a seeded static dataset
// Create Tutorial model if not in schema (add: id, title, thumbnail, videoUrl, duration, difficulty, type, isNewRelease, createdAt)

getTutorials(filter?: { type?: string; difficulty?: string })
  // Return tutorials sorted by: isNewRelease DESC, createdAt DESC

getTransformations()
  // Return posts with type=TRANSFORMATION, ordered by likeCount DESC

createBespokeRequest(userId: string, data: BespokeData)
  // data: { garmentId, description, contactEmail }
  // Store as a simple notification/record
  // Send email to admin: SMTP
  // Send confirmation email to user
  // Return { success: true, referenceNumber }

getUpcycleSuggestions(garmentId: string)
  // Call Anthropic API:
  //   system: "You are a sustainable fashion upcycling expert."
  //   user: "Suggest 3 specific upcycling transformations for: {garmentDetails}. Return JSON array: [{ title, description, difficulty: 'BEGINNER'|'INTERMEDIATE'|'ADVANCED', materialsNeeded: string[], estimatedTime: string }]"
  // Cache response per garmentId: TTL 24h
  // Return 3 suggestions
```

### STEP 12.2 — Studio Routes

```
GET  /studio/tutorials             public  → getTutorials
GET  /studio/tutorials/:id         public  → getTutorialById
GET  /studio/transformations       public  → getTransformations
POST /studio/bespoke               authenticate, validate → createBespokeRequest
GET  /studio/upcycle/:garmentId    authenticate           → getUpcycleSuggestions
```

---

## PHASE 13 — AI INTEGRATION

### STEP 13.1 — AI Service (`src/services/ai.service.ts`)

```typescript
processStyleQuiz(userId: string, answers: QuizAnswer[])
  // 1. Format answers as a structured prompt
  // 2. Call Anthropic:
  //    system: "You are a luxury fashion AI stylist. Analyze style quiz answers and output ONLY valid JSON."
  //    user: "{formatted answers}"
  //    instruction: "Return JSON with keys: styleVector (array of 64 floats between -1 and 1), styleAesthetic (MINIMALIST|VINTAGE|BOLD|ETHNIC|STREETWEAR|LUXURY), recommendedCategories (array of strings), colorPalette (array of 5 hex colors), stylePersona (2-sentence description)"
  // 3. Parse JSON response (strip markdown if present)
  // 4. Update user.styleVector and user.styleAesthetic in DB
  // 5. Return style profile

getRecommendations(userId: string)
  // 1. Get user with styleVector
  // 2. If styleVector empty → return most popular garments
  // 3. Fetch all active garments (not user's own, not already purchased)
  // 4. batchComputeScores for user
  // 5. Sort by score DESC, take top 30
  // 6. Cache "recommendations:{userId}" → 30min
  // 7. Return garments with fitScore

getFitBreakdown(userId: string, garmentId: string)
  // Full breakdown: colorMatch, styleMatch, sizeCompatibility, occasionFit, overall
  // Cache "fit:{userId}:{garmentId}" → 1h

streamAIChat(userId: string, message: string, history: ChatMessage[])
  // Returns AsyncIterable<string> (streamed tokens)
  // System prompt:
  //   "You are KaPhor, an AI luxury sustainable fashion consultant.
  //    Help users discover garments, understand their environmental impact,
  //    and build circular wardrobes. Align with circular fashion principles.
  //    Be concise, knowledgeable, and aspirational in tone.
  //    User's style aesthetic: {user.styleAesthetic}"
  // Use Anthropic streaming API
  // Route uses SSE (Server-Sent Events) to stream to frontend
```

### STEP 13.2 — AI Routes

```
POST /ai/style-quiz             authenticate, validate → processStyleQuiz
GET  /ai/recommendations        authenticate           → getRecommendations
GET  /ai/fit-score/:garmentId   authenticate           → getFitBreakdown
GET  /ai/chat                   authenticate           → streamChat (SSE)
GET  /ai/upcycle/:garmentId     authenticate           → getUpcycleSuggestions (proxy to studio service)
```

### STEP 13.3 — Chat SSE Endpoint

```typescript
// GET /ai/chat?message={encoded}&history={base64JSON}
// Set headers:
//   Content-Type: text/event-stream
//   Cache-Control: no-cache
//   Connection: keep-alive
// Stream: for await (const chunk of ai.streamAIChat(...)) { res.write(`data: ${chunk}\n\n`) }
// End: res.write('data: [DONE]\n\n'); res.end()
```

---

## PHASES 9–13 VALIDATION CHECKLIST

```
□ POST /circular/condition-check uploads images to Cloudinary and returns AI-assessed condition
□ GET /circular/garment/:id returns lifecycleState and recyclableFiber correctly
□ GET /impact/me returns carbonSavedKg, waterSavedL, tier, treesEquivalent, nextMilestoneKg
□ Tier upgrades to GOLD when carbonSavedKg crosses 30kg
□ POST /social/posts creates post with uploaded images
□ GET /social/feed returns posts from followed users in reverse chronological order
□ POST /social/posts/:id/like toggles correctly (like → unlike → like)
□ GET /studio/tutorials returns seeded tutorials
□ GET /studio/upcycle/:id returns 3 AI suggestions (cached on second call)
□ POST /ai/style-quiz updates user.styleVector and user.styleAesthetic in DB
□ GET /ai/recommendations returns garments sorted by fitScore DESC
□ GET /ai/chat streams tokens in SSE format, response ends with [DONE]
□ ImpactRecord updates correctly for RECYCLE and UPCYCLE via circular service
□ Studio bespoke request sends email to admin
```

**PROCEED TO SOP-10 only when all boxes are checked.**

---

*SOP-07 · Kaphor AI Agent Build Guide · v1.0*
