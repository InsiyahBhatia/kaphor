# Kaphor — Database Documentation

**Source:** `kaphor/backend/prisma/schema.prisma` (935 lines) · Prisma 5.22 · PostgreSQL
**Datasource:** `DATABASE_URL` (main) + `DIRECT_URL` (direct connection) · `@@map` to snake_case table names.
**Conventions:** UUID primary keys (`@default(uuid())`), soft-delete for users, JSON columns for flexible payloads, `Float[]` for vector columns, three key indexes per lookup path.

---

## 1. Tables (28 models)

| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Accounts, roles, tiers, verification, auth state, style vector |
| `Address` | `addresses` | Shipping/delivery addresses (India, default-flag) |
| `RefreshToken` | `refresh_tokens` | Refresh-token rotation + revocation |
| `Garment` | `garments` | Listings (sale/rental/swap), lifecycle, vectors, pricing |
| `BehaviourEvent` | `behaviour_events` | Raw interaction event log (EventType) |
| `BehaviourSignal` | `behaviour_signals` | Per user↔garment aggregated LOE signals |
| `CartItem` | `cart_items` | Shopping bag (unique per user+garment) |
| `CirculationSchedule` | `circulation_schedules` | LOE cooldown/rotation targeting |
| `Order` | `orders` | Buy orders + payment reference fields |
| `OrderItem` | `order_items` | Order lines → garments |
| `OrderMessage` | `order_messages` | Post-payment seller/buyer coordination |
| `Swap` | `swaps` | Accessory swap requests (offered ↔ wanted) |
| `Rental` | `rentals` | Peer rentals + full milestone timestamps |
| `PeerReview` | `peer_reviews` | Ratings (buyer→seller, order-scoped) |
| `Review` | `reviews` | Garment reviews (unique user+garment) |
| `Post` / `Like` / `Comment` / `Follow` | `posts`/`likes`/`comments`/`follows` | Social graph (outfits, tutorials, transformations, circular stories) |
| `ImpactRecord` | `impact_records` | Per-user circular impact ledger (1:1) |
| `CircularRequest` | `circular_requests` | Scheduled recycling/collection pickups |
| `BespokeRequest` | `bespoke_requests` | Studio reconstruction/bespoke work |
| `StyleQuizAnswer` | `style_quiz_answers` | Onboarding quiz responses |
| `Notification` | `notifications` | Bell notifications (type/title/body/data JSON) |
| `AuditLog` | `audit_logs` | Admin/security audit (IP + UA) |
| `ChatConversation` | `chat_conversations` | Stylist-AI chat sessions (per user) |
| `ChatMessage` | `chat_messages` | AI chat turns (role user/assistant) |
| `UpcycleRequest` | `upcycle_requests` | User upcycle proposals + admin review |
| `Tutorial` | `tutorials` | Studio repair/upcycle tutorials |
| `Transformation` | `transformations` | Before/after transformations gallery |
| `MaterialImpact` | `material_impact_db` | Material baselines (co2Kg, waterL, avgWeightG, reuseFactor) |
| `Conversation` | `conversations` | 1:1 user messaging threads (typed: SALE/SWAP/RENTAL/GENERAL) |
| `DirectMessage` | `direct_messages` | DMs (with image, flag, read-state) |
| `UserReport` | `user_reports` | Trust & safety reports |
| `GLIECorrection` | `glie_corrections` | GLIE feedback loop (A/B routing corrections) |
| `PayoutAccount` | `payout_accounts` | Seller bank/UPI payout details |

---

## 2. Enums

| Enum | Values |
|---|---|
| `UserRole` | `BUYER SELLER BOTH ADMIN` |
| `ConversationType` | `SALE SWAP RENTAL GENERAL` |
| `VerificationStatus` | `UNVERIFIED PENDING_REVIEW VERIFIED REJECTED` |
| `UserTier` | `BRONZE SILVER GOLD PLATINUM ELITE` |
| `GarmentState` | `LISTED INTEREST PURCHASE_INTENT SELL_INTENT OWNERSHIP DECLINE CIRCULATION REUSE_UPCYCLE_RECYCLE RESERVED_SALE` |
| `GarmentCondition` | `PRISTINE MINOR_WEAR UPCYCLE RECYCLE_ONLY` |
| `ListingType` | `SALE RENTAL ACCESSORY_SWAP` |
| `OrderStatus` | `PENDING CONFIRMED SHIPPED DELIVERED CANCELLED REFUNDED` |
| `SwapStatus` | `REQUESTED ACCEPTED REJECTED COMPLETED CANCELLED` |
| `RentalStatus` | `REQUESTED APPROVED DECLINED RESERVED DISPATCHED ACTIVE RETURN_DISPATCHED RETURNED COMPLETED CANCELLED OVERDUE` |
| `EventType` | `VIEW SAVE WISHLIST ADD_TO_CART SEARCH FILTER_APPLY PURCHASE_INTENT PURCHASE RENTAL_INTENT RENTAL_CONFIRMED SWAP_INTENT SWAP_CONFIRMED SELL_INTENT RELIST REPOST LOG_WEAR` |
| `StyleAesthetic` | `MINIMALIST VINTAGE BOLD ETHNIC STREETWEAR LUXURY` |
| `PostType` | `OUTFIT TUTORIAL TRANSFORMATION CIRCULAR_STORY` |
| `UpcycleRequestStatus` | `PENDING_REVIEW APPROVED IN_PROGRESS COMPLETED REJECTED CANCELLED` |

---

## 3. Core Models (field detail)

### User (`users`)
`email` (UQ), `username` (UQ), `passwordHash?`, `googleId?` (UQ), `displayName`, `avatar?`, `bio?`, `location?`,
`role` (default BOTH), `tier` (default BRONZE), `isVerified`, `verificationStatus` (default UNVERIFIED), `verificationType?`, `verificationDocUrl?`, `idNumberLast4?`, `isActive` (soft disable), `styleVector Float[]`, `styleAesthetic?`, `preferenceProfile Json?`, `onboardingDone`, `failedLoginAttempts`, `lockUntil?`, `verificationToken/Expires?`, `pushToken?`, timestamps.

> Soft-delete: `prisma/lib` overrides `user.delete` → renames email/username to `_deleted_<epoch>` + `isActive=false`.

### Garment (`garments`)
`sellerId`, `title`, `description`, `brand`, `category`, `subCategory?`, `size`, `color String[]`, `material String[]`, `fabric?`, `style?`, `sleeve?`, `shape?`, `pattern?`, `weight?`, `condition` (GarmentCondition), `images String[]`, `tags String[]`, `styleTags String[]`, `garmentVector Float[]` (20-dim), `lifecycleState` (default LISTED), `listingType` (default SALE), `reservedOrderId?`, `price?`, `originalPrice?`, `rentalPriceDay?`, `rentalPriceWeek?`, `recyclableFiber?`, `popularityScore`, `diversityScore`, `viewCount`, `isActive`, `materialId?`, `reuseCount`.
Indexes: `[sellerId]`, `[isActive, createdAt]`, `[category, isActive]`, `[listingType, isActive]`, `[reservedOrderId]`.

### Order (`orders`)
`buyerId`, `sellerId`, `status` (OrderStatus), `totalAmount` (Int paise), `currency` (default **USD** — legacy quirk), `stripePaymentId?`, `razorpayOrderId?`, `razorpayPaymentId?`, `shippingAddress Json?`, `trackingNumber?`, `carrier?`, `trackingHistory Json?`, `notes?`.

### Swap (`swaps`)
`initiatorId`, `receiverId`, `garmentOffered`, `garmentWanted` (both FK→garments), `status`, `message?`, `metadata Json?` (enriched bias/values).

### Rental (`rentals`)
`garmentId`, `renterId`, `startDate/endDate`, `totalPrice`, `status`, `stripeId?`, `message?`, `shippingAddress Json?`, `trackingNumber/carrier?`, `returnTracking/returnCarrier?`, mirrors `approvedAt/paidAt/dispatchedAt/deliveredAt/returnDispatchedAt/returnDeliveredAt/depositRefundedAt`, `declineReason?`, `metadata Json?`.

### ImpactRecord (`impact_records`)
`userId` (UQ 1:1), `carbonSavedKg`, `waterSavedL`, `itemsCirculated`, `itemsUpcycled`, `itemsRecycled`, `wasteSavedG`.

### BehaviourSignal (`behaviour_signals`)
`interestScore`, `recentEventCount`, `engagementRate`, `interactionDecay` — `@@unique([userId, garmentId])`.

---

## 4. Relations Map (key edges)

```
User 1──N Garment            User 1──N Order (asBuyer/asSeller)
User 1──N Swap (asInitiator/asReceiver)
User 1──N Rental             Garment 1──N Rental
User 1──N BehaviourSignal ↔ Garment
User 1──1 ImpactRecord       Garment 1──N OrderItem
Swap : offeredGarment / wantedGarment → Garment
Conversation → participant1+2 | garment? | order? | swap? | rental?
ChatConversation 1──N ChatMessage (AI stylist)
MaterialImpact ← Garment.materialId
User 1──N PayoutAccount | Address | RefreshToken | Notification | AuditLog | GLIECorrection
```

Cascade rules: deletes cascade for children (addresses, refresh tokens, events, signals, notifications, messages, cart items); `SetNull` for audit log, chat/garment links, GLIE corrections, peer-seller reference; no-cascade for commerce roots (orders, swaps, rentals).

---

## 5. Migrations

Folder: `prisma/migrations/` — incremental history from initial schema through:
1. swap metadata enrichment fields
2. GLIE corrections table
3. sale-reservation fields (`reservedOrderId`, `RESERVED_SALE`) & reservation triggers
(each represented by a dated migration directory with `migration.sql` + `migration_lock.toml`).

## 6. Data Notes / Gotchas

- `Order.currency` defaults to `"USD"` though all pricing is INR (container amounts are treated as paise at the API/payment boundary) — leave as-is to avoid migration churn, but normalize at read-time when possible.
- `Garment.condition` (GarmentCondition) is the coarse persistable condition; fine-grained `conditionScore` CS lives in assessment payloads/GLIE corrections, not a column.
- Vectors are Postgres `float8[]`/array columns (`Float[]` in Prisma); cosine similarity computed in app code, not SQL.
- `MaterialImpact` is the lookup baseline used by `impact.service`; rows point to source refs with `co2Kg/waterL/avgWeightG/reuseFactor`.
- Recycler directory data (partners, FTS, pincode prefixes) is **in-code** (`circular.controller.ts VERIFIED_RECYCLER_DIRECTORY`), not persisted — only `circular_requests` are stored.
- No dedicated Wallet/Payout-ledger table: commission math (10%) is computed at read-time in `payment-ops.controller`; only `payout_accounts` persist.

---

## 7. Backup & tooling
- `npm run db:migrate` (dev), `db:generate` (client), `db:studio` (GUI), `db:seed` (`prisma/seed.ts`).
- `docs/` research SOPs recommend nightly dumps + off-site cold storage for recovery; enforce `DIRECT_URL` for migrations on hosted Postgres.