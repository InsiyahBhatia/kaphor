# SOP-03 — Backend Core: Server, Middleware & Utilities
## Phase 3 of 22

**Prerequisite:** SOP-02 complete and validated.  
**Estimated time:** 60 minutes  
**Output:** Fully running Express server with all middleware, lib clients, and utility functions

---

## OBJECTIVE

Build the server backbone. Every route written in later phases will depend on this infrastructure. Get it right once here.

---

## STEP 3.1 — Logger (`src/lib/logger.ts`)

Use Winston. Two transports: console (dev) and file (prod).

```typescript
// Log levels: error > warn > info > http > debug
// Format: timestamp + level + message + metadata JSON
// Console: colorized in development
// File: logs/error.log (errors only) + logs/combined.log (all)
// Never log: passwords, tokens, card numbers, PII
// Export: logger.info(), logger.error(), logger.warn(), logger.debug()
```

Add a `httpLogger` middleware using morgan with the logger stream.

---

## STEP 3.2 — Redis Client (`src/lib/redis.ts`)

```typescript
// Use ioredis (install: npm install ioredis @types/ioredis)
// Create singleton client
// Connect on startup, log connection status
// Export helper functions:
//   get(key): Promise<string | null>
//   set(key, value, ttlSeconds): Promise<void>
//   del(key): Promise<void>
//   exists(key): Promise<boolean>
//   incr(key): Promise<number>
//   expire(key, seconds): Promise<void>
// Handle connection errors gracefully (log + retry)
```

---

## STEP 3.3 — External Service Clients

### `src/lib/cloudinary.ts`
```typescript
// Configure with CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET
// Export upload function:
//   uploadImage(buffer: Buffer, folder: string): Promise<{ url: string, publicId: string }>
// Upload options: auto quality, auto format, max 2000px width
// On error: throw with descriptive message
```

### `src/lib/stripe.ts`
```typescript
// Initialize Stripe with STRIPE_SECRET_KEY
// Export: stripe client instance
// Export helper: createPaymentIntent(amount: number, currency: string, metadata: object)
// Amount must be in CENTS (multiply by 100 before passing)
```

### `src/lib/anthropic.ts`
```typescript
// Initialize Anthropic client with ANTHROPIC_API_KEY
// Export: anthropic client instance
// Default model: 'claude-sonnet-4-6'
// Export helper: generateCompletion(system: string, user: string, maxTokens: number)
// Handle rate limits: retry once after 1 second on 429
```

### `src/lib/socket.ts`
```typescript
// Export: io (Server instance) — initialized in index.ts
// Export: getSocketId(userId) — Redis lookup user→socketId
// Export: emitToUser(userId, event, data) — send to specific user
// Export: emitToRoom(room, event, data) — send to room
```

---

## STEP 3.4 — JWT Utilities (`src/utils/jwt.ts`)

```typescript
// Use jsonwebtoken with RS256 algorithm
// Read private/public keys from process.env

signAccessToken(payload: { id: string; email: string; role: string }): string
  // expires: JWT_EXPIRES_IN (default 15m)
  // algorithm: RS256

signRefreshToken(userId: string): string
  // expires: JWT_REFRESH_EXPIRES_IN (default 7d)
  // algorithm: RS256

verifyAccessToken(token: string): JWTPayload
  // throws: JsonWebTokenError | TokenExpiredError

verifyRefreshToken(token: string): { userId: string }
  // throws on invalid/expired
```

---

## STEP 3.5 — Hash Utilities (`src/utils/hash.ts`)

```typescript
hashPassword(password: string): Promise<string>
  // bcrypt, rounds: 12

comparePassword(plain: string, hash: string): Promise<boolean>
```

---

## STEP 3.6 — Pagination Utility (`src/utils/pagination.ts`)

All list endpoints use cursor-based pagination. Never use offset/limit.

```typescript
interface PaginationParams {
  after?: string;   // cursor (base64-encoded ID)
  limit?: number;   // default 20, max 50
}

interface PaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
  total?: number;
}

// encodeCursor(id: string): string  — base64 encode
// decodeCursor(cursor: string): string  — base64 decode
// buildPrismaArgs(params: PaginationParams): { take, skip, cursor }
// buildMeta(items: any[], limit: number): PaginationMeta
```

---

## STEP 3.7 — Vector Utilities (`src/utils/vectors.ts`)

```typescript
// Cosine similarity for style vectors
cosineSimilarity(a: number[], b: number[]): number
  // returns value between -1 and 1
  // normalize to 0-1 range: (similarity + 1) / 2
  // return 0 if either vector is empty or different lengths

// Convert similarity to fit percentage
toFitPercentage(similarity: number): number
  // returns integer 0-100
```

---

## STEP 3.8 — Constants (`src/constants/index.ts`)

```typescript
export const IMPACT_VALUES = {
  SALE:    { carbonKg: 8,  waterL: 2700 },
  RENTAL:  { carbonKg: 3,  waterL: 1000 },
  UPCYCLE: { carbonKg: 12, waterL: 3500 },
  RECYCLE: { carbonKg: 5,  waterL: 1500 },
  TREE_CO2_KG_PER_YEAR: 9,
};

export const USER_TIERS = [
  { tier: 'BRONZE',   min: 0   },
  { tier: 'SILVER',   min: 10  },
  { tier: 'GOLD',     min: 30  },
  { tier: 'PLATINUM', min: 80  },
  { tier: 'ELITE',    min: 150 },
];

export const LOE_THRESHOLDS = {
  INTEREST:    Number(process.env.INTEREST_THRESHOLD)    || 0.4,
  DECLINE:     Number(process.env.DECLINE_THRESHOLD)     || 0.15,
  SATURATION_WINDOW_DAYS:  Number(process.env.SATURATION_WINDOW_DAYS)  || 7,
  SATURATION_MAX_EVENTS:   Number(process.env.SATURATION_MAX_EVENTS)   || 20,
  COOLDOWN_BASE_DAYS: 3,
};

export const EVENT_WEIGHTS: Record<string, number> = {
  VIEW:         0.05,
  SAVE:         0.15,
  WISHLIST:     0.20,
  ADD_TO_CART:  0.35,
  BUY_INTENT:   0.50,
  PURCHASE:     1.00,
};

export const ACCESSORY_CATEGORIES = ['bags', 'jewellery', 'belts', 'scarves', 'accessories'];
```

---

## STEP 3.9 — Middleware

### `src/middleware/authenticate.ts`
```typescript
// Extract Bearer token from Authorization header
// Verify with verifyAccessToken()
// Attach { id, email, role } to req.user
// On missing token: 401 { error: "UNAUTHORIZED", message: "No token provided" }
// On invalid/expired: 401 { error: "TOKEN_INVALID", message: "Invalid or expired token" }
```

### `src/middleware/authorize.ts`
```typescript
// Factory function: authorize(...roles: string[])
// Returns middleware that checks req.user.role is in allowed roles
// On fail: 403 { error: "FORBIDDEN", message: "Insufficient permissions" }
```

### `src/middleware/validate.ts`
```typescript
// Factory: validate(schema: ZodSchema)
// Validates req.body against schema
// On fail: 422 { error: "VALIDATION_ERROR", message: "...", details: zodErrors }
// On pass: calls next()
```

### `src/middleware/upload.ts`
```typescript
// Multer with memoryStorage (files stay in buffer, uploaded to Cloudinary in controller)
// single('image') and array('images', 8) exports
// File filter: allow only image/jpeg, image/png, image/webp
// Size limit: 10MB per file
// On invalid file type: 400 { error: "INVALID_FILE", message: "Only JPEG, PNG, WebP allowed" }
```

### `src/middleware/errorHandler.ts`
```typescript
// Global error handler (4 params: err, req, res, next)
// Handle: ZodError, PrismaClientKnownRequestError, JsonWebTokenError, 
//         MulterError, Stripe errors, generic Error
// In production: never expose stack traces
// Always log error with logger.error()
// Return standard error format
```

---

## STEP 3.10 — Express App Entry (`src/index.ts`)

Assemble everything:

```typescript
// 1. Load dotenv
// 2. Validate required env vars (throw if missing: DATABASE_URL, JWT_PRIVATE_KEY, etc.)
// 3. Create Express app
// 4. Create HTTP server
// 5. Attach Socket.IO to HTTP server
// 6. Apply middleware in order:
//    helmet() → compression() → cors() → express.json() → morgan → rateLimiter
// 7. Mount all route files under /api/v1/
// 8. GET /health — returns { status, timestamp, version, uptime }
// 9. 404 handler
// 10. errorHandler middleware (LAST)
// 11. Start listening on PORT
// 12. Handle graceful shutdown: SIGTERM/SIGINT → close DB + Redis connections
```

---

## STEP 3.11 — TypeScript Types (`src/types/index.ts`)

Define shared types:

```typescript
// AuthUser — attached to req.user
interface AuthUser { id: string; email: string; role: string; }

// Augment Express Request
declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

// ApiResponse<T>
interface ApiResponse<T> { data: T; meta?: PaginationMeta; }

// ApiError
interface ApiError { error: string; message: string; statusCode: number; details?: any; }
```

---

## PHASE 3 VALIDATION CHECKLIST

```
□ npm run dev starts without errors
□ GET http://localhost:4000/health returns { status: "ok" }
□ Logger writes to console in development mode
□ Redis connects successfully (check logs)
□ Prisma client connects successfully (check logs)
□ POST /api/v1/unknown-route returns 404 with standard format
□ cosineSimilarity([1,0,0], [1,0,0]) returns 1.0
□ cosineSimilarity([1,0,0], [0,1,0]) returns 0.5 (normalized)
□ hashPassword and comparePassword work correctly
□ signAccessToken produces valid JWT, verifyAccessToken decodes it
□ Multer rejects non-image files with correct error
□ Global error handler returns standard format (test by throwing in a route)
```

**PROCEED TO SOP-04 only when all boxes are checked.**

---

*SOP-03 · Kaphor AI Agent Build Guide · v1.0*
