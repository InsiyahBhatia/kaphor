# SOP-11 — Realtime, Security, Testing & Deployment
## Phases 19–22 of 22

**Prerequisite:** All previous phases complete and validated.  
**Estimated time:** 120 minutes

---

## PHASE 19 — REALTIME: SOCKET.IO & NOTIFICATIONS

### STEP 19.1 — Socket Handler (`src/lib/socketHandler.ts`)

```typescript
// Initialize in index.ts, call initSocketHandler(io)

function initSocketHandler(io: Server) {

  io.use(async (socket, next) => {
    // Auth: extract token from socket.handshake.auth.token
    // Verify JWT → attach socket.data.userId
    // On fail: next(new Error('UNAUTHORIZED'))
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    
    // Join personal room
    socket.join(`user:${userId}`);
    
    // Store userId→socketId in Redis (for lookup later)
    // Key: "socket:{userId}", Value: socket.id, TTL: 24h
    
    socket.on('join:garment', (garmentId: string) => {
      socket.join(`garment:${garmentId}`);
    });
    
    socket.on('leave:garment', (garmentId: string) => {
      socket.leave(`garment:${garmentId}`);
    });

    socket.on('disconnect', async () => {
      // Remove socket from Redis
    });
  });
}

// Helper: emit to specific user (works across server restarts via Redis pub/sub if scaling)
function emitToUser(userId: string, event: string, data: any): void {
  io.to(`user:${userId}`).emit(event, data);
}
```

### STEP 19.2 — Notification Service (`src/services/notification.service.ts`)

```typescript
async createAndSend(
  userId: string,
  type: NotifType,
  title: string,
  body: string,
  data?: any
): Promise<Notification>
  // 1. Create Notification in DB
  // 2. emitToUser(userId, 'notification:new', notification)
  // 3. (Optional) send Expo push notification if pushToken stored

// Specific notification helpers (called from other services):
notifyOrderConfirmed(buyerId, orderId, garmentTitle)
notifyOrderSold(sellerId, orderId, garmentTitle, amount)
notifySwapRequest(receiverId, initiatorName, garmentTitle)
notifySwapAccepted(initiatorId, receiverName)
notifyLifecycleChange(sellerId, garmentTitle, newState)
notifyNewFollower(userId, followerName)
notifyNewLike(postOwnerId, likerName)
notifyTierUpgrade(userId, newTier)
```

### STEP 19.3 — Notification Routes

```
GET   /notifications          authenticate  → list (paginated, newest first)
PATCH /notifications/:id/read authenticate  → markRead
PATCH /notifications/read-all authenticate  → markAllRead
DELETE /notifications/:id     authenticate  → delete
```

### STEP 19.4 — Frontend Socket Integration (`src/hooks/useSocket.ts`)

```typescript
// Custom hook
function useSocket() {
  // On mount: connect to SOCKET_URL with auth token
  // On reconnect: re-authenticate
  // Listen to: 'notification:new' → add to notifications store, show toast
  // Listen to: 'lifecycle:update' → update garment in store if cached
  // Listen to: 'order:confirmed' → navigate to order confirmed screen
  // Listen to: 'swap:request' → show swap request modal
  // On unmount: disconnect
}

// Call in app/_layout.tsx after authentication confirmed
```

---

## PHASE 20 — SECURITY HARDENING

### STEP 20.1 — Input Sanitization Audit

Go through EVERY route handler and verify:

```
□ All string inputs: trimmed, max length enforced
□ All text fields that will be rendered: sanitize HTML tags (use DOMPurify equivalent for Node: 'sanitize-html')
□ All UUID params: validated as UUID format before DB query
□ All file uploads: type checked (not just MIME header — also check file magic bytes)
□ All numeric inputs: isFinite() and within expected range
□ All date inputs: valid date, not in the past if required, not too far future
```

### STEP 20.2 — Authorization Audit

Go through EVERY route and verify ownership:

```typescript
// Pattern: never trust client-provided IDs for ownership
// WRONG:
const garment = await prisma.garment.findFirst({ where: { id: garmentId } });
await prisma.garment.update({ where: { id: garmentId }, data: newData });  // any user can update!

// CORRECT:
const garment = await prisma.garment.updateMany({
  where: { id: garmentId, sellerId: req.user.id },  // ownership enforced at DB level
  data: newData,
});
if (garment.count === 0) throw new AppError(403, 'FORBIDDEN', 'Not your garment');
```

### STEP 20.3 — Rate Limiting Matrix

Apply these limits:

| Route Group              | Window  | Max Requests | Notes                         |
|--------------------------|---------|--------------|-------------------------------|
| POST /auth/login         | 15 min  | 10           | Per IP                        |
| POST /auth/register      | 15 min  | 5            | Per IP                        |
| POST /interactions       | 1 min   | 60           | Per user (prevent spam)       |
| POST /social/posts       | 1 hour  | 20           | Per user                      |
| GET /ai/*                | 1 min   | 10           | Per user (AI is expensive)    |
| All other /api routes    | 15 min  | 100          | Per IP                        |

### STEP 20.4 — Helmet Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' },
}));
```

### STEP 20.5 — Sensitive Data Audit

Verify these fields NEVER appear in API responses:

```
□ User.passwordHash — excluded in every user select
□ User.refreshTokens — never included in responses
□ Stripe secret key — never in any response
□ Anthropic API key — never in any response or log
□ Internal error stack traces — only in development mode
□ Database error codes — wrapped in generic messages in production
```

---

## PHASE 21 — TESTING

### STEP 21.1 — Test Setup (`src/__tests__/setup.ts`)

```typescript
// Before all tests: connect to test database (DATABASE_URL_TEST)
// Run prisma migrate deploy on test DB
// Before each test: clear all tables (in correct order for FK constraints)
// After all tests: disconnect prisma and redis
// Mock: Stripe (jest.mock), Cloudinary (jest.mock), Anthropic (jest.mock)
// Mock Anthropic always returns valid JSON with styleVector, etc.
// Mock Stripe always returns succeeded PaymentIntent
```

### STEP 21.2 — Critical Tests to Write

**`auth.test.ts`**
```
✓ Register with valid data → 201, user in DB, ImpactRecord created
✓ Register with duplicate email → 409
✓ Register with weak password → 422
✓ Login with correct credentials → 200 with tokens
✓ Login with wrong password → 401 (same message as "user not found")
✓ Login 5 times wrong → 6th attempt is 429
✓ Refresh with valid token → 200, old token deleted from DB
✓ Refresh with invalid token → 401
✓ GET /auth/me with valid token → 200 (no passwordHash)
✓ GET /auth/me with expired token → 401
```

**`garment.test.ts`**
```
✓ Create garment → 201 with Cloudinary URLs (mocked)
✓ Create garment by unauthenticated user → 401
✓ GET /garments/feed → returns active garments with fitScore
✓ GET /garments/feed with category filter → filtered results
✓ GET /garments/:id → increments viewCount
✓ PUT /garments/:id by owner → 200
✓ PUT /garments/:id by non-owner → 403
✓ DELETE (soft) /garments/:id by owner → garment isActive=false
```

**`lifecycle.test.ts`**
```
✓ VIEW event → interestScore increases by 0.05
✓ ADD_TO_CART event → interestScore increases by 0.35
✓ 3× ADD_TO_CART → lifecycleState transitions to BUY_INTENT
✓ PURCHASE event → lifecycleState=OWNERSHIP
✓ 20 VIEW events in 7 days → saturation detected
✓ Saturated garment → action=SUPPRESS returned
✓ cosineSimilarity([1,0],[1,0]) = 1.0
✓ cosineSimilarity([1,0],[0,1]) = 0.5 (normalized)
```

**`order.test.ts`**
```
✓ Create order → Stripe PaymentIntent created, Order PENDING
✓ Create order for sold garment (OWNERSHIP state) → 409
✓ Create order for own garment → 400
✓ Stripe webhook payment_intent.succeeded → Order CONFIRMED, ImpactRecord updated
✓ Stripe webhook with invalid signature → 400
```

**`swap.test.ts`**
```
✓ Swap request for accessories → 201
✓ Swap request for non-accessory garment → 400
✓ Swap request for garment not owned by initiator → 403
✓ Accept swap → status=ACCEPTED
✓ Both confirm → status=COMPLETED, ownership transferred
```

**`impact.test.ts`**
```
✓ GET /impact/me → correct values
✓ SALE transaction → carbonSavedKg += 8, waterSavedL += 2700
✓ 30kg carbonSaved → tier = GOLD
✓ 150kg carbonSaved → tier = ELITE
✓ treesEquivalent = Math.floor(carbonSavedKg / 9)
```

### Run Tests

```bash
npm test
# Target: all critical tests passing
# Coverage: >70% on controllers and services
```

---

## PHASE 22 — DEPLOYMENT CONFIGURATION

### STEP 22.1 — Dockerfile (Backend)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q http://localhost:4000/health -O /dev/null || exit 1
CMD ["node", "dist/index.js"]
```

### STEP 22.2 — docker-compose.yml

```yaml
version: '3.9'
services:
  api:
    build: .
    ports: ["4000:4000"]
    env_file: .env.production
    depends_on: [postgres, redis]
    restart: unless-stopped
  
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kaphor_db
      POSTGRES_USER: kaphor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### STEP 22.3 — EAS Build Config (`eas.json`)

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://staging-api.kaphor.com/api/v1" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://api.kaphor.com/api/v1" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "team@kaphor.com" },
      "android": { "serviceAccountKeyPath": "./google-service-account.json" }
    }
  }
}
```

### STEP 22.4 — Environment Validation on Startup

```typescript
// src/utils/validateEnv.ts
const required = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'
];

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
// Call in index.ts before anything else
```

---

## FINAL SYSTEM VALIDATION

Before calling the build complete, verify end-to-end:

```
□ FULL PURCHASE FLOW:
  Register → Style Quiz → Browse Feed → View Garment → Buy Now → Stripe → Confirmed → ImpactRecord updated

□ FULL SELL FLOW:
  Login as seller → Create Listing → Garment appears in buyer feed with fitScore → Buyer purchases → Lifecycle=OWNERSHIP

□ FULL SWAP FLOW:
  Seller lists accessory → Buyer finds it → Request swap with own accessory → Seller accepts → Both confirm → Ownership swapped

□ FULL RENTAL FLOW:
  Browse rental → Select dates → Confirm booking → Payment → Active rental → Return confirmed

□ CIRCULAR FLOW:
  Upload garment photos → AI condition check → Schedule collection → ImpactRecord updated

□ SOCIAL FLOW:
  Create post with garment tag → Follower sees it in feed → Likes it → Comment notification received

□ AI FLOW:
  Chat query → Streaming response appears token by token → Recommendations load with fit scores

□ REALTIME:
  Order placed → Both buyer and seller receive socket notification instantly

□ SECURITY:
  All auth-protected routes return 401 without token
  All ownership-protected routes return 403 for wrong user
  Stripe webhook rejects invalid signatures
  5 failed logins → lockout works

□ PERFORMANCE:
  Feed loads in < 1 second (Redis cache working)
  Images load progressively (blurhash → full image)
  No memory leaks in long sessions

□ TESTS: npm test → all tests pass, coverage > 70%
```

---

**BUILD COMPLETE** ✓

*SOP-11 · Kaphor AI Agent Build Guide · v1.0*
