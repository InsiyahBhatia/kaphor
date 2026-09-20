# SOP-02 — Database Schema & Migrations
## Phase 2 of 22

**Prerequisite:** SOP-01 complete and validated.  
**Estimated time:** 45 minutes  
**Output:** Complete Prisma schema, migrations run, database seeded

---

## OBJECTIVE

Define every database model the application needs. Get it right here — changing schema later is expensive. Think through all relationships, indexes, and constraints before writing a line of code.

---

## STEP 2.1 — Install Prisma & Initialize

```bash
cd backend
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider postgresql
```

---

## STEP 2.2 — Write the Schema

Write `prisma/schema.prisma`. Build all models in this exact order:

### ENUMS (define before any model)

```prisma
enum UserRole         { BUYER SELLER BOTH ADMIN }
enum UserTier         { BRONZE SILVER GOLD PLATINUM ELITE }
enum GarmentState     { LISTED INTEREST BUY_INTENT SELL_INTENT OWNERSHIP DECLINE CIRCULATION TERMINAL }
enum GarmentCondition { PRISTINE MINOR_WEAR UPCYCLE RECYCLE_ONLY }
enum ListingType      { SALE RENTAL ACCESSORY_SWAP }
enum OrderStatus      { PENDING CONFIRMED SHIPPED DELIVERED CANCELLED REFUNDED }
enum SwapStatus       { REQUESTED ACCEPTED REJECTED COMPLETED CANCELLED }
enum RentalStatus     { RESERVED ACTIVE RETURNED OVERDUE }
enum EventType        { VIEW SAVE WISHLIST ADD_TO_CART BUY_INTENT PURCHASE SELL_INTENT RELIST }
enum StyleAesthetic   { MINIMALIST VINTAGE BOLD ETHNIC STREETWEAR LUXURY }
enum PostType         { OUTFIT TUTORIAL TRANSFORMATION CIRCULAR_STORY }
enum NotifType        { ORDER SWAP RENTAL LIFECYCLE SOCIAL SYSTEM }
```

### MODELS — required fields for each

**User**
- id, email (unique), username (unique), passwordHash
- displayName, avatar, bio, location
- role (UserRole), tier (UserTier)
- isVerified, isActive, onboardingDone
- styleVector (Float[]), styleAesthetic (StyleAesthetic?)
- createdAt, updatedAt
- Relations: garments, ordersAsBuyer, ordersAsSeller, swapsInitiated, swapsReceived, rentals, behaviourEvents, behaviourSignals, posts, likes, comments, followers, following, notifications, impactRecord, refreshTokens, styleQuizAnswers, reviews, addresses

**Address**
- id, userId (FK→User), label, line1, line2?, city, country, postcode, isDefault

**RefreshToken**
- id, token (unique), userId (FK→User), expiresAt

**Garment**
- id, sellerId (FK→User), title, description, brand
- category, subCategory?, size, color (String[]), material (String[])
- condition (GarmentCondition), images (String[]), tags (String[]), styleTags (String[])
- garmentVector (Float[])
- lifecycleState (GarmentState default LISTED)
- listingType (ListingType default SALE)
- price (Float?), rentalPriceDay (Float?), rentalPriceWeek (Float?)
- recyclableFiber (Float?)
- popularityScore (Float default 0), diversityScore (Float default 0), viewCount (Int default 0)
- isActive (Boolean default true)
- createdAt, updatedAt

**BehaviourEvent**
- id, userId (FK→User), garmentId (FK→Garment)
- eventType (EventType), sessionId?, metadata (Json?)
- createdAt
- @@index([userId, garmentId])
- @@index([garmentId, createdAt])

**BehaviourSignal**
- id, userId (FK→User), garmentId (FK→Garment)
- interestScore (Float default 0)
- recentEventCount (Int default 0)
- engagementRate (Float default 0)
- interactionDecay (Float default 0)
- updatedAt
- @@unique([userId, garmentId])

**CirculationSchedule**
- id, garmentId (FK→Garment), userId (FK→User)
- cooldownStart, cooldownEnd, saturationScore
- status (String default "PENDING")
- createdAt

**Order**
- id, buyerId (FK→User, relation "BuyerOrders"), sellerId (FK→User, relation "SellerOrders")
- status (OrderStatus default PENDING)
- totalAmount (Float), currency (String default "USD")
- stripePaymentIntentId?, stripeSessionId?
- shippingAddress (Json?)
- notes?, createdAt, updatedAt
- items (OrderItem[])

**OrderItem**
- id, orderId (FK→Order), garmentId (FK→Garment)
- price (Float), quantity (Int default 1)

**Swap** — ACCESSORIES ONLY
- id, initiatorId (FK→User, "SwapInitiator"), receiverId (FK→User, "SwapReceiver")
- offeredGarmentId (FK→Garment), requestedGarmentId (FK→Garment)
- status (SwapStatus default REQUESTED)
- message?, completedAt?, createdAt, updatedAt
- NOTE: add check logic in service — both garments must be category=ACCESSORIES

**Rental**
- id, garmentId (FK→Garment), renterId (FK→User)
- startDate, endDate, totalPrice (Float)
- status (RentalStatus default RESERVED)
- stripePaymentIntentId?
- createdAt, updatedAt

**Post**
- id, userId (FK→User), type (PostType)
- caption?, images (String[]), garmentIds (String[]), tags (String[])
- isPublished (Boolean default true)
- createdAt, updatedAt

**Like**
- id, userId (FK→User), postId (FK→Post)
- createdAt
- @@unique([userId, postId])

**Comment**
- id, userId (FK→User), postId (FK→Post)
- content, createdAt

**Follow**
- id, followerId (FK→User, "Followers"), followingId (FK→User, "Following")
- createdAt
- @@unique([followerId, followingId])

**ImpactRecord**
- id, userId (FK→User) @unique
- carbonSavedKg (Float default 0)
- waterSavedL (Float default 0)
- itemsCirculated (Int default 0)
- itemsUpcycled (Int default 0)
- itemsRecycled (Int default 0)
- updatedAt

**StyleQuizAnswer**
- id, userId (FK→User), questionId, answer
- createdAt

**Review**
- id, userId (FK→User), garmentId (FK→Garment)
- rating (Int), comment?, createdAt
- @@unique([userId, garmentId])

**Notification**
- id, userId (FK→User), type (NotifType)
- title, body, data (Json?), isRead (Boolean default false)
- createdAt

---

## STEP 2.3 — Run Migrations

```bash
# Create and apply the initial migration
npx prisma migrate dev --name init

# Verify migration created correctly
npx prisma migrate status

# Generate Prisma client
npx prisma generate
```

---

## STEP 2.4 — Create Singleton Prisma Client

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## STEP 2.5 — Write Seed File

`prisma/seed.ts` — create realistic sample data:

```
Users to create:
  - admin@kaphor.com / admin / ADMIN role
  - seller@kaphor.com / luxury_seller / SELLER role (onboarding complete, styleVector populated)
  - buyer@kaphor.com / fashion_buyer / BUYER role (onboarding complete)

Garments to create (for the seller):
  - 3 SALE garments: saree, leather jacket, linen dress (LISTED state)
  - 2 RENTAL garments: Banarasi silk lehenga, vintage sherwani (LISTED state)
  - 2 ACCESSORY_SWAP garments: beaded clutch, pearl necklace (LISTED state)
  - 1 garment in DECLINE state (for lifecycle testing)

Style quiz answers for both buyer and seller.
ImpactRecord for all users (zeroed out for buyer, populated for seller).

Sample posts (2 OUTFIT posts, 1 TRANSFORMATION).
Sample follows: buyer follows seller.

Password for all seed users: Kaphor2026!
Hash with argon2id (memoryCost 64MB, timeCost 3) before inserting.
```

Add to `package.json`:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

Run:
```bash
npx prisma db seed
```

---

## STEP 2.6 — Index Verification

After migration, verify these indexes exist in your DB:

```sql
-- Run in psql or Prisma Studio
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

Required indexes:
- `behaviour_events`: (userId, garmentId), (garmentId, createdAt)
- `behaviour_signals`: unique (userId, garmentId)
- `likes`: unique (userId, postId)
- `follows`: unique (followerId, followingId)
- `reviews`: unique (userId, garmentId)
- `refresh_tokens`: unique (token)

---

## PHASE 2 VALIDATION CHECKLIST

```
□ schema.prisma compiles: npx prisma validate → no errors
□ Migration ran successfully: npx prisma migrate status → "Database schema is up to date"
□ Prisma client generated: node -e "require('@prisma/client')" → no error
□ Seed ran successfully: npx prisma db seed → no errors
□ All 3 seed users exist in DB (verify with Prisma Studio)
□ Garment seed data has correct lifecycleState values
□ ImpactRecord created for every seeded user
□ All unique constraints working (try inserting duplicate email → error expected)
□ src/lib/prisma.ts exports singleton PrismaClient
```

**PROCEED TO SOP-03 only when all boxes are checked.**

---

*SOP-02 · Kaphor AI Agent Build Guide · v1.0*
