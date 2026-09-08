# SOP-04 — Authentication System
## Phase 4 of 22

**Prerequisite:** SOP-03 complete and validated.  
**Estimated time:** 90 minutes  
**Output:** Complete auth system — register, login, refresh, logout, brute force protection

---

## OBJECTIVE

Build bulletproof authentication. Every security decision is documented here. Follow it exactly.

---

## SECURITY DECISIONS — READ FIRST

```
DECISION 1: RS256 JWT, not HS256. Asymmetric keys — public key can verify without exposing signing key.
DECISION 2: Refresh token rotation. Every refresh issues NEW access + refresh tokens. Old refresh token invalidated.
DECISION 3: Refresh tokens stored in DB. Can be revoked server-side.
DECISION 4: Brute force protection via Redis counter. 5 failures → 15min lockout.
DECISION 5: Same error message for wrong email AND wrong password. Prevents user enumeration.
DECISION 6: Email verification required before first purchase (not before browsing).
DECISION 7: Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char.
DECISION 8: Stricter rate limit on auth routes: 10 req/15min per IP.
DECISION 9: Never return passwordHash in any response. Use Prisma select to exclude it always.
DECISION 10: Logout invalidates the specific refresh token (not all sessions).
```

---

## STEP 4.1 — Auth Validation Schemas (`src/routes/auth.routes.ts`)

Define Zod schemas for every auth endpoint:

```typescript
// registerSchema
{
  email: z.string().email().max(255),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  displayName: z.string().min(2).max(60),
}

// loginSchema
{ email: z.string().email(), password: z.string().min(1) }

// refreshSchema
{ refreshToken: z.string().min(1) }
```

---

## STEP 4.2 — Auth Service (`src/services/auth.service.ts`)

Build every auth function with this exact logic:

### `register(data)`
```
1. Check if email already exists → 409 "Email already registered"
2. Check if username already exists → 409 "Username taken"
3. Hash password with bcrypt (rounds: 12)
4. Create User in DB (role: BOTH, tier: BRONZE, isActive: true)
5. Create ImpactRecord for user (all zeros)
6. Send welcome email (non-blocking, don't await)
7. Sign access token and refresh token
8. Store refresh token in RefreshToken table with expiresAt = now + 7 days
9. Return { user (no passwordHash), accessToken, refreshToken }
```

### `login(email, password, ip)`
```
1. Check brute force: Redis key "login_fail:{ip}" 
   - If count >= 5 and TTL exists → 429 "Too many attempts. Try again in {minutes} minutes."
2. Find user by email (select: all fields including passwordHash)
3. If user not found → increment Redis counter + 409 "Invalid credentials"
   NOTE: Same error as wrong password — prevents enumeration
4. Compare password with hash
5. If wrong → increment Redis counter, set TTL 900s → 401 "Invalid credentials"
6. If correct → delete Redis brute force counter
7. Check user.isActive → 403 "Account suspended"
8. Sign tokens, store refresh token
9. Return { user (no passwordHash), accessToken, refreshToken }
```

### `refreshTokens(token)`
```
1. Verify refresh token with verifyRefreshToken()
2. Find token in DB (include user)
3. If not found → 401 "Invalid refresh token"
4. If expired (check expiresAt) → delete from DB → 401 "Refresh token expired"
5. Delete old token from DB
6. Sign new access token + new refresh token
7. Store new refresh token in DB
8. Return { accessToken, refreshToken }
```

### `logout(refreshToken)`
```
1. Delete refresh token from DB (where token = refreshToken)
2. Return { success: true }
   NOTE: Don't error if token not found — logout should always succeed
```

### `getMe(userId)`
```
1. Find user by ID
2. Include: impactRecord
3. Exclude: passwordHash
4. Return user
```

---

## STEP 4.3 — Auth Controller (`src/controllers/auth.controller.ts`)

Thin controllers — business logic stays in service:

```typescript
// Each controller function:
// 1. Extract validated data from req.body (validated by middleware)
// 2. Call service function
// 3. Set HTTP status code
// 4. Return ApiResponse<T> format
// 5. Use try/catch and pass errors to next()

register:  POST  → 201 { data: { user, accessToken, refreshToken } }
login:     POST  → 200 { data: { user, accessToken, refreshToken } }
refresh:   POST  → 200 { data: { accessToken, refreshToken } }
logout:    POST  → 200 { data: { success: true } }
getMe:     GET   → 200 { data: { user } }
```

---

## STEP 4.4 — Auth Routes (`src/routes/auth.routes.ts`)

```typescript
const router = express.Router();

// Apply auth-specific rate limit to all routes in this router
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login',    authLimiter, validate(loginSchema),    login);
router.post('/refresh',               validate(refreshSchema),   refresh);
router.post('/logout',                                           logout);
router.get('/me',         authenticate,                          getMe);
```

Mount in index.ts: `app.use('/api/v1/auth', authRoutes);`

---

## STEP 4.5 — Email Service (`src/services/email.service.ts`)

```typescript
// Use Nodemailer with SMTP config from env
// Create transporter singleton
// Functions:

sendWelcomeEmail(to: string, displayName: string): Promise<void>
  // Subject: "Welcome to Kaphor, {displayName}"
  // Body: plain text welcome message with login link

sendPasswordResetEmail(to: string, resetToken: string): Promise<void>
  // Subject: "Reset your Kaphor password"
  // Link: {FRONTEND_URL}/reset-password?token={resetToken}
  // Expires: 1 hour

sendOrderConfirmationEmail(to: string, order: OrderSummary): Promise<void>
  // Subject: "Your Kaphor order #{orderId} is confirmed"

// All send functions: catch errors, log them, never throw
// Email failures should never block user flows
```

---

## STEP 4.6 — Frontend Auth Store (`src/store/auth.store.ts`)

```typescript
// Zustand store

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login(email: string, password: string): Promise<void>;
  register(data: RegisterData): Promise<void>;
  logout(): Promise<void>;
  restoreSession(): Promise<void>;  // called on app launch
  updateUser(user: Partial<User>): void;
}

// restoreSession:
//   1. Read accessToken from SecureStore
//   2. If exists: call GET /auth/me
//   3. If 200: set user + isAuthenticated=true
//   4. If 401: try refresh token flow
//   5. If refresh fails: clear tokens, isAuthenticated=false

// login:
//   1. POST /auth/login
//   2. Store tokens in SecureStore
//   3. Set user + isAuthenticated=true
//   4. Navigate to (tabs) or style-quiz if !onboardingDone

// logout:
//   1. POST /auth/logout
//   2. Delete tokens from SecureStore
//   3. Clear store state
//   4. Navigate to (auth)/welcome
```

---

## STEP 4.7 — Protect Navigation

In `app/_layout.tsx`:
```typescript
// On app mount: call restoreSession()
// While loading: show SplashScreen
// After load:
//   - if isAuthenticated && onboardingDone → navigate to (tabs)
//   - if isAuthenticated && !onboardingDone → navigate to style-quiz
//   - if !isAuthenticated → navigate to (auth)
// Use expo-router's Redirect component
```

---

## PHASE 4 VALIDATION CHECKLIST

```
□ POST /auth/register with valid data → 201 with tokens, user in DB, ImpactRecord created
□ POST /auth/register with duplicate email → 409 with "Email already registered"
□ POST /auth/register with weak password → 422 with validation details
□ POST /auth/login with correct credentials → 200 with tokens
□ POST /auth/login with wrong password → 401 with "Invalid credentials"
□ POST /auth/login 5 times with wrong password → 429 with lockout message
□ GET /auth/me with valid token → 200 with user (no passwordHash field)
□ GET /auth/me without token → 401
□ GET /auth/me with expired token → 401
□ POST /auth/refresh with valid refresh token → 200 with new tokens, old token deleted from DB
□ POST /auth/refresh with invalid token → 401
□ POST /auth/logout → 200, refresh token deleted from DB
□ Frontend: login flow stores tokens in SecureStore and navigates correctly
□ Frontend: restoreSession works on app reload
□ No passwordHash ever returned in any response
```

**PROCEED TO SOP-05 only when all boxes are checked.**

---

*SOP-04 · Kaphor AI Agent Build Guide · v1.0*
