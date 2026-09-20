# Kaphor — REST API Routes Reference

**Base URL:** `https://kaphor-backend.onrender.com/api/v1`
**Auth:** `Authorization: Bearer <accessToken>` (JWT HS256, 15 min) · `POST /auth/refresh` rotates refresh token.
**Conventions:** global rate limit 1000/15 min; auth routes 5/min; errors `{ error, message }`.

Legend: 🔓 public · 👤 authenticated · 👤? optional auth · 🛡️ admin · ✈️ upload(s)

---

## 1. Auth — `/api/v1/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | 🔓 | Register (email/password) |
| POST | `/login` | 🔓 | Login |
| POST | `/google` | 🔓 | Google OAuth |
| POST | `/logout` | 👤 | Revoke refresh token |
| POST | `/refresh` | 🔓(refresh) | Rotating refresh → new token pair |
| POST | `/forgot-password` | 🔓 | 1h reset slot |
| POST | `/reset-password` | 🔓 | Reset using token |
| GET | `/verify-email/:token` | 🔓 | 24h email verify |
| GET | `/me` | 👤 | Current user |

## 2. Users — `/api/v1/users`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/profile/:userId/public` | 🔓 | Public profile summary |
| GET | `/profile/:userId/reviews` | 🔓 | User reviews |
| GET | `/me` | 👤 | Get self |
| PUT | `/me` | 👤 | Update self |
| PUT | `/me/avatar` | 👤 ✈️ | Upload avatar |
| GET | `/me/listings` | 👤 | My listings |
| GET | `/me/wardrobe` | 👤 | Digital closet |
| POST | `/me/wardrobe/items` | 👤 | Add to closet |
| GET | `/me/purchases` | 👤 | My purchases |
| POST | `/me/verify-identity` | 👤 | Identity doc upload |
| GET | `/me/verification-status` | 👤 | Verification status |
| POST | `/me/push-token` | 👤 | Register push token |
| POST | `/me/test-push` | 👤 | Test push |
| GET | `/me/addresses` | 👤 | List addresses |
| POST | `/me/addresses` | 👤 | Create address |
| PUT | `/me/addresses/:id` | 👤 | Update address |
| DELETE | `/me/addresses/:id` | 👤 | Delete address |
| POST | `/me/addresses/:id/default` | 👤 | Set default |
| GET | `/me/payout-accounts` | 👤 | List payout accounts |
| POST | `/me/payout-accounts` | 👤 | Create payout account |
| DELETE | `/me/payout-accounts/:id` | 👤 | Remove payout account |

## 3. Garments — `/api/v1/garments`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | 👤? | Search |
| GET | `/feed` | 👤? | Paginated feed (excludes own) |
| GET | `/me` | 👤 | My listings |
| GET | `/wishlist` | 👤 | My wishlist |
| GET | `/browse` | 👤? | Browse/filter |
| GET | `/:id/insights` | 👤 | Eco savings + GLIE sub-scores |
| GET | `/:id` | 🔓 | Garment by id |
| GET | `/:id/lifecycle` | 👤 | Lifecycle timeline |
| GET | `/:id/compatibility` | 👤 | Score vs me |
| POST | `/` | 👤 ✈️ | Create (≤8 images) |
| PUT | `/:id` | 👤 ✈️ | Update |
| DELETE | `/:id` | 👤 | Delete |
| POST | `/:id/pause` | 👤 | Pause listing |
| POST | `/:id/wardrobe` | 👤 | Move to wardrobe |
| POST | `/:id/initiate-resell` | 👤 | Start resell |
| POST | `/:id/relist` | 👤 | Relist |
| POST | `/:id/circular-end` | 👤 | Mark resell/upcycle/recycle end |

## 4. Orders — `/api/v1/orders`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/inquiry` | 👤 | Inquiry order |
| POST | `/cart` | 👤 | Cart checkout |
| POST | `/` | 👤 | Create payment-intent order |
| POST | `/:orderId/approve` | 👤 | Seller approve |
| POST | `/:orderId/reject` | 👤 | Seller reject |
| GET | `/summary` | 👤 | Aggregate summary |
| GET | `/transactions` | 👤 | Transaction list |
| GET | `/:orderId` | 👤 | Detail |
| GET | `/:orderId/payment` | 👤 | Payment details |
| PATCH | `/:orderId/address` | 👤 | Set shipping address |
| PATCH | `/:orderId/ship` | 👤 | Mark shipped + tracking |
| PATCH | `/:orderId/deliver` | 👤 | Mark delivered |
| GET | `/:orderId/messages` | 👤 | Order messages |
| POST | `/:orderId/messages` | 👤 | Post order message |
| POST | `/:orderId/peer-review` | 👤 | Peer review |

## 5. Cart — `/api/v1/cart`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | 👤 | My cart |
| POST | `/` | 👤 | Add item |
| DELETE | `/:garmentId` | 👤 | Remove item |

## 6. Rentals — `/api/v1/rentals`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/available` | 👤? | Available rentals |
| GET | `/check-availability` | 👤? | Availability check |
| POST | `/calculate` | 🔓 | Pricing breakdown |
| POST | `/` | 👤 | Create rental request |
| GET | `/me` | 👤 | My rentals |
| GET | `/:id` | 👤 | Detail |
| GET | `/:id/escrow` | 👤 | Escrow status |
| POST | `/:id/approve` | 👤 | Approve |
| POST | `/:id/decline` | 👤 | Decline |
| POST | `/:id/confirm-payment` | 👤 | Pay via intent |
| POST | `/:id/confirm-delivery` | 👤 | Received |
| POST | `/:id/confirm-return-delivery` | 👤 | Return in transit |
| POST | `/:id/release-deposit` | 👤 | Release deposit |
| PATCH | `/:id/dispatch` | 👤 | Dispatch |
| PATCH | `/:id/return` | 👤 | Mark returned |
| POST | `/:id/review` | 👤 | Review rental |

## 7. Swaps — `/api/v1/swaps`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/feed` | 👤? | Swap feed |
| GET | `/` | 👤 | My swaps |
| POST | `/` | 👤 | Submit swap request |
| GET | `/:id` | 👤 | Detail |
| PATCH | `/:id` | 👤 | Respond (accept/reject) |
| POST | `/:id/respond` | 👤 | Respond (alt) |
| GET | `/:id/agreement` | 👤 | Agreement doc |
| POST | `/:id/sign-agreement` | 👤 | E-sign |
| GET | `/:id/shipping-address` | 👤 | Shared address |
| POST | `/:id/address` | 👤 | Share address |
| POST | `/:id/ship` | 👤 | Mark shipped |
| POST | `/:id/confirm-received` | 👤 | Confirm received |
| POST | `/:id/complete` | 👤 | Complete swap |
| POST | `/:id/pay-deposit` | 👤 | ₹500 deposit |
| POST | `/:id/verify-deposit` | 👤 | Verify deposit |
| GET | `/:id/deposit` | 👤 | Deposit status |
| POST | `/:id/dispute` | 👤 | Open dispute |
| GET | `/:id/dispute` | 👤 | Get dispute |
| POST | `/:id/cancel` | 👤 | Cancel |
| POST | `/:id/review` | 👤 | Review |

## 8. Messages — `/api/v1/messages`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/unread-count` | 👤 | Unread count |
| GET | `/conversations` | 👤 | List conversations |
| POST | `/conversations` | 👤 | Get-or-create |
| POST | `/orders/:orderId/conversation` | 👤 | Order thread |
| GET | `/conversations/:conversationId` | 👤 | Messages |
| DELETE | `/conversations/:conversationId` | 👤 | Delete thread |
| PATCH | `/conversations/:conversationId/garment` | 👤 | Link garment |
| POST | `/conversations/:conversationId` | 👤 | Send DM |
| POST | `/users/:userId/report` | 👤 | Report user |

## 9. Notifications — `/api/v1/notifications`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/unread-count` | 👤 | Unread count |
| GET | `/` | 👤 | List notifications |
| PATCH | `/read-all` | 👤 | Mark all read |
| PATCH | `/:id/read` | 👤 | Mark one read |
| DELETE | `/clear-all` | 👤 | Clear all |
| DELETE | `/:id` | 👤 | Delete one |

## 10. Impact — `/api/v1/impact`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/platform-summary` | 👤 | Platform totals |
| GET | `/me` | 👤 | My impact ledger |
| GET | `/me/report` | 👤 | Personal report |

## 11. Circular — `/api/v1/circular`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/garment/:id` | 👤 | Garment lifecycle |
| GET | `/partners` | 👤 | Partners |
| GET | `/recycling-centers` | 👤? | Recycling directory |
| POST | `/onboard-partner` | 👤 | Onboard partner |
| POST | `/schedule-collection` | 👤 | Schedule pickup |
| POST | `/verify-prep` | 👤 | Verify prep checklist |

## 12. Studio — `/api/v1/studio`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/tutorials` | 🔓 | Tutorials |
| GET | `/transformations` | 🔓 | Transformations gallery |
| POST | `/bespoke-request` | 👤 | Bespoke/reconstruction request |

## 13. AI / Stylist — `/api/v1/ai`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/fit-score/:userId/:garmentId` | 👤 | Fit-score recommendation |
| GET | `/price-recommendation` | 👤? | T3 market price |
| GET | `/style-profile` | 👤 | Style profile |
| POST | `/style-quiz` | 👤 | Submit quiz |
| POST | `/style-quiz/skip` | 👤 | Skip quiz |
| GET | `/recommendations` | 👤 | Recs |
| POST | `/chat` | 👤 | Stylist chat (SSE) |
| GET | `/history` | 👤 | Chat history |
| GET | `/history/:conversationId` | 👤 | One thread |
| POST | `/upcycle-suggestions` | 👤 | Upcycle ideas |
| POST | `/assess-condition` | 👤 | Re-appraise condition |
| POST | `/analyze-listing` | 👤 ✈️ | Vision listing assistant |

## 14. GLIE — `/api/v1/glie` (inline in index.ts)

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/upload-temp` | 👤 ✈️ | Temp upload → Cloudinary |
| POST | `/assess` | 👤 | Full GLIE assessment + routing |
| POST | `/corrections` | 👤 | Feedback loop → `glie_corrections` |

## 15. Recommendations — `/api/v1/recommendations`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/similar/:garmentId` | 👤? | Semantic similarity |
| GET | `/for-you` | 👤? | Personalized feed |
| GET | `/rentals` | 👤? | Rental recs |
| GET | `/swaps` | 👤? | Swap recs |
| GET | `/profile` | 👤 | Taste profile |

## 16. Repair — `/api/v1/repair`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/lookup` | 🔓 | T5 + YouTube guide lookup |
| POST | `/assess` | 🔓 | Safeness/centroid assessment (GLIE sub-object) |

## 17. Payments — `/api/v1/payments`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/webhook` | 🔓(raw) | **Stripe webhook** (raw body, signature) |
| GET | `/history` | 👤 | Payment history |
| GET | `/payouts` | 👤 | Seller payouts |
| POST | `/refund` | 👤 | Request refund |

## 18. Payments / Razorpay — `/api/v1/payments/razorpay`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/create-order` | 👤 | Create Razorpay order |
| POST | `/create-order-for-order` | 👤 | Order-linked intent |
| POST | `/create-rental-order` | 👤 | Rental intent |
| POST | `/verify` | 👤 | Verify payment |
| POST | `/webhook` | 🔓 | **Razorpay webhook** (signature) |

## 19. Interactions — `/api/v1/interactions`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/` | 👤 | Record interaction (rec usage) |

## 20. Admin — `/api/v1/admin`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/monitor` | 🛡️ | Platform metrics |
| GET | `/bespoke-requests` | 🛡️ | List bespoke |
| PATCH | `/bespoke-requests/:id` | 🛡️ | Update status |
| GET | `/swaps` | 🛡️ | Admin swaps |
| GET | `/rentals` | 🛡️ | Admin rentals |
| GET | `/users` | 🛡️ | Admin users |
| PATCH | `/users/:id` | 🛡️ | Ban/unban/promote |
| DELETE | `/users/:id` | 🛡️ | Delete user |
| GET | `/garments` | 🛡️ | Admin garments |

## 21. Misc / Infrastructure

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | 🔓 | Health probe (Probe: server-status-200-OK, 90s interval) |
| GET/… | `/uploads/*`, `/api/v1/uploads/*` | 🔓 | Static image serving |

## 22. Socket.IO Events (`/` namespace)

| Event (client→server) | Event (server→client) |
|---|---|
| `join_user` → `user:{id}` room | `typing` → `user_typing` (conversation room) |
| `join_garment` → `garment:{id}` room | `notification` |
| `join_conversation` → `conversation:{id}` room | `garment:delisted` |
| `leave_*` | `swap:counter-update` |
| `typing` | `system` |
| | `rental-request` |

---

### Auth middleware map
- `authenticate` — most routers below (`/users`, `/garments`/me-routes, `/orders`, `/cart`, `/rentals`, `/swaps`, `/messages`, `/notifications`, `/impact`, `/circular`, `/studio`, `/ai`, `/interactions`, `/recommendations/profile`, `/payments*`).
- `optionalAuth` — search/feed/browse, available rentals, swap feed, recs.
- `requireAdmin` — `/admin/*`.
- Webhooks (`/payments/webhook`, `/payments/razorpay/webhook`) — **no auth middleware**, signature-verified.