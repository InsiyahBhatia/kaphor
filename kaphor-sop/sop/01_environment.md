# SOP-01 — Environment & Project Structure
## Phase 1 of 22

**Read AGENT_SOP.md before this file.**  
**Estimated time:** 30 minutes  
**Output:** Two initialized projects, folder structure, all config files

---

## OBJECTIVE

Set up the complete monorepo structure with both backend and frontend projects fully configured and ready to receive feature code.

---

## STEP 1.1 — Create Monorepo Root

```bash
mkdir kaphor && cd kaphor
git init
echo "node_modules/\ndist/\n.env\n*.log\n.DS_Store" > .gitignore
```

Create `kaphor/package.json`:
```json
{
  "name": "kaphor-monorepo",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev:backend":  "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run start",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\""
  }
}
```

---

## STEP 1.2 — Backend Project Structure

Create exactly this folder tree:

```
backend/
├── src/
│   ├── index.ts              ← entry point
│   ├── routes/               ← one file per feature domain
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── garment.routes.ts
│   │   ├── order.routes.ts
│   │   ├── swap.routes.ts
│   │   ├── rental.routes.ts
│   │   ├── circular.routes.ts
│   │   ├── impact.routes.ts
│   │   ├── social.routes.ts
│   │   ├── studio.routes.ts
│   │   ├── ai.routes.ts
│   │   ├── payment.routes.ts
│   │   └── notification.routes.ts
│   ├── controllers/          ← one file per feature domain (mirrors routes)
│   ├── services/             ← business logic, one file per domain
│   │   ├── auth.service.ts
│   │   ├── garment.service.ts
│   │   ├── lifecycle.service.ts   ← LOE engine lives here
│   │   ├── compatibility.service.ts
│   │   ├── order.service.ts
│   │   ├── impact.service.ts
│   │   ├── ai.service.ts
│   │   ├── notification.service.ts
│   │   └── email.service.ts
│   ├── middleware/
│   │   ├── authenticate.ts   ← JWT verification
│   │   ├── authorize.ts      ← role-based access
│   │   ├── validate.ts       ← Zod schema validation wrapper
│   │   ├── upload.ts         ← Multer + Cloudinary
│   │   └── errorHandler.ts   ← global error handler
│   ├── lib/
│   │   ├── prisma.ts         ← PrismaClient singleton
│   │   ├── redis.ts          ← Redis client singleton
│   │   ├── cloudinary.ts     ← Cloudinary config
│   │   ├── stripe.ts         ← Stripe client
│   │   ├── anthropic.ts      ← Anthropic client
│   │   ├── socket.ts         ← Socket.IO instance export
│   │   └── logger.ts         ← Winston logger
│   ├── types/
│   │   ├── express.d.ts      ← augment Request with user
│   │   └── index.ts          ← all shared types
│   ├── utils/
│   │   ├── jwt.ts            ← sign / verify helpers
│   │   ├── hash.ts           ← bcrypt helpers
│   │   ├── pagination.ts     ← cursor pagination helper
│   │   ├── impact.ts         ← impact calculation helpers
│   │   └── vectors.ts        ← cosine similarity
│   └── constants/
│       └── index.ts          ← IMPACT constants, TIER constants, THRESHOLDS
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── .env                      ← gitignored
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## STEP 1.3 — Backend Config Files

### `backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", "prisma/seed.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### `backend/jest.config.js`
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  coverageThreshold: { global: { lines: 70, functions: 70 } },
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
};
```

---

## STEP 1.4 — Frontend Project Structure

```
frontend/
├── app/                      ← Expo Router file-based routing
│   ├── _layout.tsx           ← root layout
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── style-quiz.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       ← bottom tab navigator
│   │   ├── index.tsx         ← Home
│   │   ├── shop.tsx          ← Shop
│   │   ├── circular.tsx      ← Circular (centre + button)
│   │   ├── social.tsx        ← Social
│   │   └── profile.tsx       ← Profile
│   ├── shop/
│   │   ├── [id].tsx
│   │   ├── sell.tsx
│   │   └── checkout/[orderId].tsx
│   ├── swap/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── rental/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   └── reserve.tsx
│   ├── studio/
│   │   ├── index.tsx
│   │   └── tutorial/[id].tsx
│   ├── impact/
│   │   └── index.tsx
│   ├── circular/
│   │   └── index.tsx
│   └── notifications/
│       └── index.tsx
├── src/
│   ├── components/
│   │   ├── common/           ← Button, Input, Badge, Card, Avatar, etc.
│   │   ├── garment/          ← GarmentCard, GarmentDetail, FitBadge
│   │   ├── social/           ← PostCard, CommentItem, StoryReel
│   │   └── impact/           ← ProgressRing, StatCard, TierBadge
│   ├── services/
│   │   └── api.ts            ← Axios instance + all endpoint functions
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── garment.store.ts
│   │   ├── cart.store.ts
│   │   └── ui.store.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGarmentFeed.ts
│   │   └── useSocket.ts
│   ├── theme/
│   │   └── index.ts          ← Colors, Typography, Spacing, Radius
│   ├── types/
│   │   └── index.ts          ← all shared frontend types
│   └── utils/
│       ├── format.ts         ← currency, date, number formatters
│       └── storage.ts        ← SecureStore helpers
├── assets/
│   └── fonts/                ← Cormorant Garamond, DM Sans, JetBrains Mono
├── app.json
├── .env.example
├── package.json
└── tsconfig.json
```

### `frontend/app.json`
```json
{
  "expo": {
    "name": "Kaphor",
    "slug": "kaphor",
    "version": "1.0.0",
    "scheme": "kaphor",
    "platforms": ["ios", "android"],
    "ios": { "bundleIdentifier": "com.kaphor.app", "supportsTablet": false },
    "android": { "package": "com.kaphor.app" },
    "splash": { "backgroundColor": "#0F0609" },
    "plugins": ["expo-router", "expo-font", "expo-secure-store",
                "expo-image-picker", "expo-notifications", "expo-camera"]
  }
}
```

---

## STEP 1.5 — Environment Variables

### `backend/.env.example`
```
NODE_ENV=development
PORT=4000
API_VERSION=v1

DATABASE_URL="postgresql://kaphor:password@localhost:5432/kaphor_db"
REDIS_URL=redis://localhost:6379

JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
STRIPE_PUBLISHABLE_KEY=pk_test_

ANTHROPIC_API_KEY=sk-ant-

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@kaphor.com

ALLOWED_ORIGINS=http://localhost:8081
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10

INTEREST_THRESHOLD=0.4
DECLINE_THRESHOLD=0.15
SATURATION_WINDOW_DAYS=7
SATURATION_MAX_EVENTS=20
```

### `frontend/.env.example`
```
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_
EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

## STEP 1.6 — Generate RSA Key Pair for JWT

```bash
# Run in backend directory
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
# Paste content into JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env
# Use \n to represent newlines in the .env string
```

---

## PHASE 1 VALIDATION CHECKLIST

```
□ Both project directories exist with correct folder trees
□ All package.json files are complete with correct dependencies
□ tsconfig.json in backend has strict: true
□ .env.example files have ALL required variables documented
□ RSA key pair generated and stored in .env (never in code)
□ .gitignore includes: .env, dist/, node_modules/, *.key, *.pem
□ app.json has correct bundle IDs and all required plugins
□ git init completed with initial commit of config files only
```

**PROCEED TO SOP-02 only when all boxes are checked.**

---

*SOP-01 · Kaphor AI Agent Build Guide · v1.0*
