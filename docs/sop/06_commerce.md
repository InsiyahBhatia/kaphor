# SOP-06 — Commerce: Orders, Accessory Swap & Rental
## Phases 6, 7, 8 of 22

**Prerequisite:** SOP-05 complete and validated.  
**Estimated time:** 120 minutes  
**Output:** Complete purchase flow with Stripe, accessory swap system, rental booking

---

## PHASE 6 — ORDERS & STRIPE PAYMENTS

### STEP 6.1 — Order Service Logic

```typescript
// src/services/order.service.ts

createOrder(buyerId: string, garmentId: string, shippingAddress: Address)
  // GUARD CHECKS (fail fast):
  //   1. Garment exists and isActive=true → else 404
  //   2. Garment lifecycleState is LISTED, INTEREST, or BUY_INTENT → else 409 "Not available"
  //   3. Garment sellerId != buyerId → else 400 "Cannot buy your own garment"
  //   4. Garment listingType = SALE → else 400 "Not for sale"
  //
  // PROCESS:
  //   5. Create Stripe PaymentIntent:
  //      amount: Math.round(garment.price * 100)  // convert to cents
  //      currency: 'usd'
  //      metadata: { garmentId, buyerId, sellerId }
  //   6. Create Order in DB: status=PENDING, stripePaymentIntentId
  //   7. Create OrderItem
  //   8. Return { clientSecret, orderId }

confirmOrder(stripePaymentIntentId: string, stripeEvent: Stripe.Event)
  // Called ONLY from Stripe webhook handler
  // NEVER called directly from user request
  //
  // 1. Find Order by stripePaymentIntentId
  // 2. If already CONFIRMED → return (idempotent)
  // 3. Update Order status=CONFIRMED
  // 4. Update Garment lifecycleState=OWNERSHIP
  // 5. Create BehaviourEvent type=PURCHASE for buyer
  // 6. Update seller ImpactRecord:
  //    carbonSavedKg += IMPACT_VALUES.SALE.carbonKg
  //    waterSavedL   += IMPACT_VALUES.SALE.waterL
  //    itemsCirculated++
  // 7. Recalculate seller tier
  // 8. Send order confirmation email to buyer
  // 9. Send sale notification email to seller
  // 10. Emit socket events: "order:confirmed" to buyer, "order:sold" to seller

cancelOrder(orderId: string, userId: string)
  // 1. Verify order belongs to buyer or is seller cancelling
  // 2. Status must be PENDING or CONFIRMED (not SHIPPED)
  // 3. If Stripe PaymentIntent exists: cancel it
  // 4. Update Order status=CANCELLED
  // 5. Revert Garment lifecycleState to LISTED
```

### STEP 6.2 — Stripe Webhook Handler

```typescript
// POST /api/v1/payments/webhook
// RAW BODY required — use express.raw() for this route only, before express.json()

// Verify signature:
//   stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
//   If fails → 400 (Stripe will retry)

// Handle these events:
//   'payment_intent.succeeded'  → confirmOrder()
//   'payment_intent.canceled'   → cancelOrder()
//   'payment_intent.payment_failed' → notify buyer of failure

// Always return 200 to Stripe quickly (process async if needed)
// Log all webhook events received
```

### STEP 6.3 — Order Routes

```
POST   /orders                 authenticate, validate → createOrder
GET    /orders                 authenticate           → listMyOrders (buyer + seller)
GET    /orders/:id             authenticate           → getOrder (only buyer or seller)
PATCH  /orders/:id/cancel      authenticate           → cancelOrder
POST   /orders/:id/shipped     authenticate           → markShipped (seller only)
POST   /orders/:id/delivered   authenticate           → markDelivered (buyer confirms)
POST   /payments/webhook       raw body               → stripeWebhook
```

---

## PHASE 7 — ACCESSORY SWAP

### IMPORTANT: Swap constraints
```
RULE: Swaps are ONLY allowed for accessories.
RULE: Both garments in a swap MUST have category in ACCESSORY_CATEGORIES constant.
RULE: Initiator MUST own the offered garment.
RULE: Receiver MUST own the requested garment.
RULE: A garment cannot be in two active swaps simultaneously.
```

### STEP 7.1 — Swap Service

```typescript
// src/services/swap.service.ts

requestSwap(initiatorId: string, offeredGarmentId: string, requestedGarmentId: string, message?: string)
  // GUARD CHECKS:
  //   1. Fetch both garments
  //   2. Both garments must have ACCESSORY_SWAP in listingType → else 400
  //   3. Both must be in ACCESSORY_CATEGORIES → else 400 "Swaps only for accessories"
  //   4. offeredGarment.sellerId == initiatorId → else 403 "You don't own this item"
  //   5. requestedGarment.sellerId == receiverId (the other person)
  //   6. No existing REQUESTED or ACCEPTED swap for either garment → else 409
  //
  // PROCESS:
  //   7. Create Swap: status=REQUESTED
  //   8. Emit socket "swap:request" to receiver
  //   9. Send in-app notification to receiver
  //   10. Return swap with both garments populated

respondToSwap(swapId: string, userId: string, accept: boolean)
  // 1. Fetch swap, verify userId == receiverId
  // 2. Status must be REQUESTED
  //
  // If accept=false:
  //   3. Update status=REJECTED
  //   4. Notify initiator
  //
  // If accept=true:
  //   3. Update status=ACCEPTED
  //   4. Notify initiator
  //   NOTE: Physical exchange must still happen. Status=COMPLETED only after confirmSwap()

confirmSwap(swapId: string, userId: string)
  // Either party can confirm physical exchange complete
  // After BOTH parties confirm → status=COMPLETED
  // Update both garments: swap sellerId (ownership transferred)
  // Update both users' ImpactRecord (use SALE impact values for both)
  // Emit "swap:completed" to both users
```

### STEP 7.2 — Swap Routes

```
POST   /swaps                  authenticate, validate  → requestSwap
GET    /swaps                  authenticate            → listMySwaps
GET    /swaps/:id              authenticate            → getSwap
PATCH  /swaps/:id              authenticate, validate  → respondToSwap (accept/reject)
POST   /swaps/:id/confirm      authenticate            → confirmSwap
```

---

## PHASE 8 — RENTAL SYSTEM

### STEP 8.1 — Rental Service

```typescript
// src/services/rental.service.ts

checkAvailability(garmentId: string, startDate: Date, endDate: Date): Promise<boolean>
  // Query Rental table for overlapping active rentals:
  //   WHERE garmentId = ? 
  //   AND status IN (RESERVED, ACTIVE)
  //   AND NOT (endDate <= startDate OR startDate >= endDate)
  // Return false if any overlap found

listAvailableRentals(filters: RentalFilters, userId: string)
  // Filter: garments with listingType=RENTAL
  // For each garment: check availability for requested dateRange
  // Include: isLastPiece flag (only one garment of this type from this seller)
  // Sort by: popularityScore DESC

reserveRental(renterId: string, garmentId: string, startDate: Date, endDate: Date, shippingAddress: Address)
  // GUARD CHECKS:
  //   1. Garment exists, isActive, listingType=RENTAL
  //   2. Available for requested dates → else 409 "Dates not available"
  //   3. startDate must be >= tomorrow
  //   4. endDate must be > startDate
  //   5. Max rental period: 30 days
  //
  // CALCULATE PRICE:
  //   days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
  //   if days >= 7 AND rentalPriceWeek: price = Math.floor(days/7)*rentalPriceWeek + (days%7)*rentalPriceDay
  //   else: price = days * rentalPriceDay
  //
  // PROCESS:
  //   6. Create Stripe PaymentIntent (amount in cents)
  //   7. Create Rental: status=RESERVED
  //   8. Return { clientSecret, rentalId, totalPrice, days }

// Webhook: on payment success → Rental status=ACTIVE, update ImpactRecord (RENTAL values)
// PATCH /rentals/:id/return → status=RETURNED, update impact
```

### STEP 8.2 — Rental Routes

```
GET    /rentals/available         authenticate           → listAvailable
GET    /rentals/available/:id     authenticate           → getRentalDetail
POST   /rentals                   authenticate, validate → reserveRental
GET    /rentals/me                authenticate           → myRentals
PATCH  /rentals/:id/return        authenticate           → confirmReturn (renter)
```

---

## PHASE 6–8 VALIDATION CHECKLIST

```
□ POST /orders with valid garment → Stripe PaymentIntent created, Order in DB as PENDING
□ Stripe webhook payment_intent.succeeded → Order CONFIRMED, Garment in OWNERSHIP state
□ POST /orders on another user's own garment → 400
□ POST /orders on garment in OWNERSHIP state → 409
□ Stripe webhook handler rejects invalid signatures → 400
□ POST /swaps with non-accessory garment → 400 with clear error message
□ POST /swaps with garment not owned by initiator → 403
□ PATCH /swaps/:id accept=true → status=ACCEPTED, notifications sent to both users
□ POST /swaps/:id/confirm both parties → status=COMPLETED, ownership transferred
□ GET /rentals/available with overlapping dates → conflicted garments excluded
□ POST /rentals with dates in the past → 400
□ POST /rentals → price calculated correctly (7-day discount applied if applicable)
□ Rental payment webhook → Rental status=ACTIVE, ImpactRecord updated
□ ImpactRecord.itemsCirculated increments on all confirmed transactions
□ Socket events emitted on: order confirmed, swap request/response, rental confirmed
```

**PROCEED TO SOP-07 only when all boxes are checked.**

---

*SOP-06 · Kaphor AI Agent Build Guide · v1.0*
