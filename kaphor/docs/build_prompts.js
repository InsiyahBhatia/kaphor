const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, PageNumber, Header, Footer, PageBreak, Table, TableRow, TableCell
} = require('docx');
const fs = require('fs');

const W = 9360;
const bdr = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };

const thBdr = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
const thBdrs = { top: thBdr, bottom: thBdr, left: thBdr, right: thBdr };

function sp(n = 120) {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: n, after: 0 } });
}
function pb() {
  return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });
}
function h1(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: t, bold: true, size: 36, font: 'Calibri', color: '1A0B0F' })],
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '8B0000', space: 6 } },
  });
}
function h2(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: t, bold: true, size: 28, font: 'Calibri', color: '5C0010' })],
    spacing: { before: 320, after: 140 },
  });
}
function h3(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text: t, bold: true, size: 24, font: 'Calibri', color: '333333' })],
    spacing: { before: 240, after: 100 },
  });
}
function body(t, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: t, size: 22, font: 'Calibri', ...opts })],
    spacing: { before: 60, after: 100 },
    alignment: AlignmentType.JUSTIFIED,
  });
}
function bullet(t) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text: t, size: 22, font: 'Calibri' })],
    spacing: { before: 40, after: 40 },
  });
}
function num(t) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: [new TextRun({ text: t, size: 22, font: 'Calibri' })],
    spacing: { before: 40, after: 40 },
  });
}

// Prompt box — styled card
function promptBox(number, title, content, stack) {
  const rows = [
    new TableRow({
      children: [
        new TableCell({
          borders: thBdrs,
          width: { size: W, type: WidthType.DXA },
          columnSpan: 2,
          shading: { fill: '1A0B0F', type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `PROMPT ${String(number).padStart(2,'0')}  ·  `, size: 18, font: 'Courier New', color: '8B0000', bold: true }),
                new TextRun({ text: title.toUpperCase(), size: 18, font: 'Courier New', color: 'FFFFFF', bold: true }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          borders: bdrs,
          width: { size: 6800, type: WidthType.DXA },
          shading: { fill: 'FAF8F8', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'PROMPT INSTRUCTION', size: 16, font: 'Courier New', color: '8B0000', bold: true })],
              spacing: { before: 0, after: 80 },
            }),
            ...content.map(line =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 20, font: 'Calibri', color: '222222' })],
                spacing: { before: 30, after: 30 },
              })
            ),
          ],
        }),
        new TableCell({
          borders: bdrs,
          width: { size: 2560, type: WidthType.DXA },
          shading: { fill: 'F0EDED', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'TECH STACK', size: 16, font: 'Courier New', color: '8B0000', bold: true })],
              spacing: { before: 0, after: 80 },
            }),
            ...stack.map(s =>
              new Paragraph({
                children: [new TextRun({ text: `· ${s}`, size: 18, font: 'Courier New', color: '444444' })],
                spacing: { before: 20, after: 20 },
              })
            ),
          ],
        }),
      ],
    }),
  ];

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [6800, 2560],
    rows,
  });
}

// ─────────────────────────────────────────────────────────────────────
// ALL PROMPTS
// ─────────────────────────────────────────────────────────────────────

const prompts = [

  // ═══ SECTION A: SETUP & FOUNDATION ═══════════════════════════════

  { section: 'A. PROJECT SETUP & FOUNDATION', prompts: [

    { n:1, title: 'Project Scaffolding & Monorepo Setup',
      content: [
        'Create a monorepo for the Kaphor application with the following structure:',
        '',
        'kaphor/',
        '  backend/     — Node.js + Express + TypeScript REST API',
        '  frontend/    — React Native + Expo mobile application',
        '  shared/      — Shared TypeScript types and utilities',
        '',
        'Backend: Initialise with package.json, tsconfig.json, .env.example.',
        'Install: express, prisma, @prisma/client, jsonwebtoken, bcryptjs,',
        'helmet, cors, express-rate-limit, zod, winston, socket.io, stripe, multer.',
        '',
        'Frontend: Initialise Expo project with expo-router, React Navigation,',
        'Zustand, TanStack Query, axios, expo-secure-store, expo-image-picker.',
        '',
        'Add .gitignore for both. Add README.md describing the project.',
        'Colour palette: background #0E0507, brand crimson #8B0000, text #F5F0EE.',
      ],
      stack: ['Node.js 20', 'TypeScript 5', 'React Native 0.73', 'Expo 50', 'PostgreSQL 16', 'Prisma 5'],
    },

    { n:2, title: 'Database Schema with Prisma',
      content: [
        'Create the full Prisma schema for Kaphor at backend/prisma/schema.prisma.',
        '',
        'Required models:',
        'User — id, email, passwordHash, username, displayName, avatarUrl, role',
        '        (BUYER/SELLER/BOTH/ADMIN), tier (BRONZE→ELITE), styleVector float[],',
        '        aestheticProfile json, carbonSaved, waterSaved, itemsCirculated.',
        '',
        'Garment — id, ownerId (FK User), title, description, brand, category,',
        '          condition (PRISTINE/MINOR_WEAR/GOOD/FAIR), size, color[], material[],',
        '          styleTags[], price, images[], garmentVector float[],',
        '          lifecycleState enum (LISTED→RECYCLE), isAccessory boolean.',
        '',
        'BehaviourEvent, BehaviourSignal, CirculationSchedule — for the LOE engine.',
        'Order, OrderItem, AccessorySwap (accessories only), CircularServiceRequest.',
        'StyleQuiz, WishlistItem, Post, Comment, Follow, Review, Notification, Address.',
        '',
        'Create migration. Create seed file with sample data.',
        'Add all necessary indexes for query performance.',
      ],
      stack: ['Prisma 5', 'PostgreSQL 16', 'UUID primary keys', 'Full-text search indexes'],
    },

  ]},

  // ═══ SECTION B: BACKEND API ═══════════════════════════════════════

  { section: 'B. BACKEND API DEVELOPMENT', prompts: [

    { n:3, title: 'Authentication System',
      content: [
        'Build a complete JWT authentication system at backend/src/.',
        '',
        'POST /api/v1/auth/register — validate email/username uniqueness,',
        '  hash password with bcrypt (rounds: 12), issue accessToken (15m)',
        '  and refreshToken (7d), store refresh token hash in DB, send',
        '  verification email via Nodemailer.',
        '',
        'POST /api/v1/auth/login — verify credentials, check isVerified,',
        '  return tokens + full user object.',
        '',
        'POST /api/v1/auth/refresh — validate refresh token, rotate it.',
        'POST /api/v1/auth/logout  — blacklist refresh token.',
        'POST /api/v1/auth/forgot-password — send reset email with 1-hour token.',
        'POST /api/v1/auth/reset-password  — validate token, update password.',
        'GET  /api/v1/auth/verify-email/:token — verify email.',
        'GET  /api/v1/auth/me — return authenticated user.',
        '',
        'Middleware: authenticate (verify JWT), requireAdmin.',
        'Validation with express-validator. Rate limit auth routes: 5 req/15min.',
      ],
      stack: ['JWT', 'bcryptjs (r:12)', 'Nodemailer', 'express-validator', 'express-rate-limit'],
    },

    { n:4, title: 'Garment CRUD & Image Upload',
      content: [
        'Build the complete garment API.',
        '',
        'POST /api/v1/garments — authenticated. Accept multipart/form-data with',
        '  up to 8 images. Upload images to Cloudinary. Validate all fields',
        '  with Zod. Set lifecycleState = LISTED. Initialise garmentVector as',
        '  empty array (will be populated by vector engine). isAccessory flag',
        '  determines if accessory swap is enabled.',
        '',
        'GET /api/v1/garments — public. Filters: category, condition, size,',
        '  priceMin, priceMax, brand, styleTags, isAccessory.',
        '  Pagination: page/limit. Sort: price, createdAt, popularityScore.',
        '',
        'GET  /api/v1/garments/:id        — public. Increment viewCount.',
        'PUT  /api/v1/garments/:id        — owner only.',
        'DELETE /api/v1/garments/:id      — owner or admin only.',
        'GET  /api/v1/garments/:id/lifecycle    — authenticated.',
        'GET  /api/v1/garments/:id/compatibility — authenticated. Returns score.',
        '',
        'After create/update: trigger vector update job asynchronously.',
      ],
      stack: ['Multer', 'Cloudinary', 'Zod', 'Sharp (image resize)'],
    },

    { n:5, title: 'Lifecycle Optimization Engine (LOE)',
      content: [
        'Build the core LOE service at backend/src/services/lifecycle.service.ts.',
        'This is the primary patentable component of Kaphor.',
        '',
        'runLOE(garmentId, userId): computes action PROMOTE | SUPPRESS | TRANSITION | SCHEDULE.',
        '',
        'Inputs: userStyleVector, garmentVector, BehaviourSignal fields:',
        '  interestScore, engagementRate, interactionDecay, recentEventCount.',
        '',
        'Logic:',
        '  1. Compute compatScore = cosine(userVec, garmentVec).',
        '  2. Check saturation: recentEventCount > 8 AND engagementRate < 0.2.',
        '     If saturated → SCHEDULE cooldown, find top-N new compatible users.',
        '  3. Check decline: interestScore < 0.15 OR interactionDecay > 0.7.',
        '     If declining AND state=OWNERSHIP → TRANSITION to DECLINE.',
        '  4. If compatScore ≥ 0.45 AND interestScore ≥ 0.3 → PROMOTE.',
        '  5. Else → SUPPRESS.',
        '',
        'processExpiredCooldowns(): cron job every 30min. Re-introduce garments.',
        'Emit socket events on state transitions.',
        '',
        'GET  /api/v1/lifecycle/:garmentId — get current state + metrics.',
        'POST /api/v1/lifecycle/:garmentId/trigger — manually trigger LOE.',
      ],
      stack: ['Cosine similarity', 'Cron (node-cron)', 'Socket.io', 'Prisma transactions'],
    },

    { n:6, title: 'Behaviour Tracking & Interest Scoring',
      content: [
        'Build the behaviour engine.',
        '',
        'POST /api/v1/interactions — authenticated. Body: { garmentId, eventType, metadata }.',
        'eventType ∈ { VIEW, SAVE, WISHLIST, ADD_TO_CART, PURCHASE_INITIATED,',
        '              PURCHASED, LISTED_FOR_SALE, REPOSTED, SHARED, REVIEWED }.',
        '',
        'On each event:',
        '  1. Persist BehaviourEvent.',
        '  2. Upsert BehaviourSignal for (userId, garmentId):',
        '     interestScore += eventWeight[eventType].',
        '     eventWeights: VIEW=0.1, SAVE=0.3, WISHLIST=0.4, ADD_TO_CART=0.6,',
        '                   PURCHASE_INITIATED=0.8, PURCHASED=1.0.',
        '  3. Apply time decay: interactionDecay = 1 - (score / daysSinceLastEvent).',
        '  4. Update garment popularityScore and viewCount/saveCount.',
        '  5. Run LOE asynchronously.',
        '  6. Update user styleVector using incremental embedding update.',
        '',
        'Increment garment viewCount on VIEW event without authentication.',
      ],
      stack: ['Prisma upsert', 'Async queue (bull or simple setTimeout)', 'Vector math'],
    },

    { n:7, title: 'Orders & Stripe Payment Integration',
      content: [
        'Build complete buy/sell order flow with Stripe.',
        '',
        'POST /api/v1/orders/payment-intent — authenticated buyer. Create Stripe',
        '  PaymentIntent for garment purchase. Calculate 10% platform fee.',
        '  Return clientSecret to frontend.',
        '',
        'POST /api/v1/orders — create order after payment confirmation.',
        '  Mark garment isAvailable=false. Set status=PENDING.',
        '  Notify seller via socket + email.',
        '',
        'POST /api/v1/webhooks/stripe — verify Stripe webhook signature.',
        '  On payment_intent.succeeded: confirm order, update garment',
        '  lifecycleState to OWNERSHIP, trigger LOE PURCHASED event.',
        '  On payment_intent.payment_failed: release garment, cancel order.',
        '',
        'GET  /api/v1/orders/my      — buyer and seller views.',
        'GET  /api/v1/orders/:id     — order detail.',
        'POST /api/v1/orders/:id/cancel — if status=PENDING only.',
        'POST /api/v1/orders/:id/confirm-delivery — buyer confirms receipt.',
        '  On confirm: release seller payout via Stripe Connect.',
        '',
        'Seller onboarding: POST /api/v1/users/me/stripe-connect.',
      ],
      stack: ['Stripe API', 'Stripe Connect', 'Stripe Webhooks', 'Stripe.js'],
    },

    { n:8, title: 'Accessory Swap API',
      content: [
        'Build accessory-only swap feature.',
        '',
        'Only garments with isAccessory=true can be swapped.',
        '',
        'POST /api/v1/swaps — authenticated initiator. Body: { garmentAId,',
        '  receiverId, garmentBId, message }. Validate both garments are',
        '  isAccessory=true and both available. Set status=REQUESTED.',
        '  Notify receiver via socket + push notification.',
        '',
        'POST /api/v1/swaps/:id/respond — receiver only.',
        '  { accept: true/false }. If accepted → status=ACCEPTED,',
        '  mark both garments unavailable, create meetup details.',
        '  If declined → status=DECLINED, notify initiator.',
        '',
        'POST /api/v1/swaps/:id/complete — either party.',
        '  status=COMPLETED. Transfer ownership of both garments.',
        '  Trigger LOE PURCHASED event on both garments.',
        '  Award sustainability points to both users.',
        '',
        'GET  /api/v1/swaps/my — list user swaps (initiated + received).',
        'DELETE /api/v1/swaps/:id — cancel if status=REQUESTED only.',
      ],
      stack: ['Socket.io (real-time)', 'Prisma transactions', 'Push notifications (Expo)'],
    },

    { n:9, title: 'Circular Services API',
      content: [
        'Build the circular economy services backend.',
        '',
        'POST /api/v1/circular/request — authenticated. Body: { garmentId,',
        '  serviceType (UPCYCLE/RECYCLE/REPAIR/ARCHIVE), description, images[] }.',
        '  Upload condition photos to Cloudinary. Assign nearest verified partner.',
        '  Set status=PENDING. Send confirmation email.',
        '',
        'GET  /api/v1/circular/partners — list all verified CircularPartner records.',
        '  Filter by serviceType, location.',
        '',
        'GET  /api/v1/circular/my-requests — user service history.',
        '',
        'POST /api/v1/circular/:id/schedule — schedule White-Glove Pickup.',
        '  Body: { scheduledAt, addressId }. Premium feature check.',
        '',
        'PATCH /api/v1/circular/:id/complete — admin/partner only.',
        '  On complete: update garment to REUSE/UPCYCLE/RECYCLE lifecycle state.',
        '  Calculate sustainability impact. Update user carbonSaved, waterSaved.',
        '  Award tier points. Check tier upgrade.',
        '',
        'Sustainability calculations: per garment category, material, weight.',
        'Store impact formulas in a config file.',
      ],
      stack: ['Cloudinary', 'Nodemailer', 'Sustainability impact calc', 'Geolocation (optional)'],
    },

    { n:10, title: 'Personalised Feed & Recommendation Engine',
      content: [
        'Build the AI-personalised feed.',
        '',
        'GET /api/v1/feed — authenticated. Returns ranked garment list.',
        '  Algorithm:',
        '  1. Load user styleVector.',
        '  2. Fetch available garments (isAvailable=true, not owned by user).',
        '  3. For each garment, compute: finalScore = 0.6*cosine(userVec,garmentVec)',
        '     + 0.2*popularityScore + 0.1*recencyScore + 0.1*diversityScore.',
        '  4. Filter out suppressed garments (from CirculationSchedule in cooldown).',
        '  5. Filter out already-purchased garments.',
        '  6. Sort by finalScore desc. Paginate: cursor-based.',
        '  7. Include "fit score" label: ≥0.9 = "98% FIT", ≥0.8 = "85% FIT" etc.',
        '',
        'GET /api/v1/feed/trending — top garments by popularityScore last 7 days.',
        'GET /api/v1/feed/new-drops — garments listed in last 24h.',
        'GET /api/v1/feed/curated  — editorial picks (admin-curated).',
        '',
        'Style vector update: on each interaction, update user styleVector',
        '  incrementally: newVec = 0.9*oldVec + 0.1*garmentVec * eventWeight.',
      ],
      stack: ['Vector math', 'Cursor pagination', 'Redis (cache feed, optional)', 'Prisma'],
    },

    { n:11, title: 'Social Features API',
      content: [
        'Build the social layer.',
        '',
        'POST /api/v1/social/posts — create post with images, tags.',
        'GET  /api/v1/social/posts — feed of followed users + trending.',
        'POST /api/v1/social/posts/:id/like    — toggle like.',
        'POST /api/v1/social/posts/:id/comments — add comment.',
        'DELETE /api/v1/social/posts/:id       — owner or admin.',
        '',
        'POST /api/v1/social/follow/:userId    — follow/unfollow toggle.',
        'GET  /api/v1/social/:userId/followers — list followers.',
        'GET  /api/v1/social/:userId/following — list following.',
        '',
        'GET  /api/v1/users/:id/profile — public profile with stats,',
        '  listed garments, post count, follower count, sustainability tier.',
        '',
        'POST /api/v1/reviews — authenticated buyer post-purchase.',
        '  Body: { garmentId, rating (1-5), comment }. One review per garment.',
        '',
        'Notifications: emit socket events on like, comment, follow, new match.',
        'Push notification via Expo Push API for mobile.',
      ],
      stack: ['Socket.io', 'Expo Push Notifications', 'Prisma', 'Cloudinary'],
    },

    { n:12, title: 'Style Quiz & Vector Initialisation',
      content: [
        'Build style quiz onboarding.',
        '',
        'POST /api/v1/users/me/style-quiz — save quiz answers.',
        '  Body: { aesthetic: string[], colourPalette: string[],',
        '          preferredBrands: string[], avoidCategories: string[] }.',
        '',
        '  On save: initialise user styleVector from quiz answers.',
        '  Vector construction: map each aesthetic tag to a predefined',
        '  128-dimensional tag embedding. Average all selected tag vectors.',
        '  Store result in User.styleVector.',
        '',
        '  Define 128-dim tag embedding map for all aesthetics:',
        '  MINIMALIST, VINTAGE, BOLD, ETHNIC, LUXURY, STREETWEAR,',
        '  SUSTAINABLE, CLASSIC, BOHEMIAN, AVANT_GARDE.',
        '',
        'GET /api/v1/users/me/style-quiz — return current quiz answers.',
        '',
        'PUT /api/v1/users/me — update profile: displayName, bio, location,',
        '  avatarUrl. Upload avatar to Cloudinary.',
        '',
        'GET /api/v1/users/me/impact — return sustainability dashboard data:',
        '  carbonSaved, waterSaved, itemsCirculated, tier progress,',
        '  equivalent trees planted, next milestone.',
      ],
      stack: ['Vector math', 'Cloudinary', 'Prisma', 'Zod validation'],
    },

    { n:13, title: 'Notifications & Real-time Events',
      content: [
        'Build the notification system.',
        '',
        'Socket.io events (server → client):',
        '  lifecycle:update — garment state changed.',
        '  feed:new_item    — new curated garment available.',
        '  order:update     — order status changed.',
        '  swap:request     — new accessory swap request.',
        '  social:like      — post liked.',
        '  social:comment   — new comment.',
        '  social:follow    — new follower.',
        '  notification:new — generic notification badge update.',
        '',
        'GET  /api/v1/notifications      — list, newest first. Unread count.',
        'PATCH /api/v1/notifications/:id/read   — mark single read.',
        'PATCH /api/v1/notifications/read-all   — mark all read.',
        '',
        'Expo Push: send push on order update, swap request, lifecycle alert.',
        '  Store Expo push token in User.expoPushToken.',
        '  POST /api/v1/users/me/push-token — register device token.',
        '',
        'Email notifications: order confirmation, shipping update,',
        '  lifecycle decline alert, tier upgrade congratulations.',
      ],
      stack: ['Socket.io', 'Expo Push API', 'Nodemailer', 'HTML email templates'],
    },

    { n:14, title: 'Security Hardening',
      content: [
        'Apply comprehensive security measures across the backend.',
        '',
        'Helmet: set all security headers. CSP, HSTS, X-Frame-Options.',
        'CORS: whitelist only frontend origin from .env ALLOWED_ORIGINS.',
        'Rate limiting:',
        '  Auth routes: 5 requests per 15 min per IP.',
        '  API routes: 100 requests per 15 min per user.',
        '  Image upload: 10 requests per hour per user.',
        '',
        'Input validation: Zod schemas on all POST/PUT endpoints.',
        '  Sanitise all string inputs. Reject unknown fields.',
        '',
        'SQL injection: use Prisma parameterised queries exclusively.',
        '  Never concatenate user input into queries.',
        '',
        'File upload security: validate MIME type + file extension.',
        '  Max file size: 5MB per image. Virus scan hook (optional ClamAV).',
        '',
        'JWT: short-lived access tokens (15m). Refresh token rotation.',
        '  Store refresh token hash in DB, not plain token.',
        '  Revoke all tokens on password change.',
        '',
        'Sensitive data: never log passwords, tokens, card data.',
        '  Mask email in logs. Use Winston with log levels.',
        '',
        'OWASP Top 10 checklist: document each item and its mitigation.',
      ],
      stack: ['Helmet', 'express-rate-limit', 'Zod', 'bcrypt', 'JWT rotation'],
    },

  ]},

  // ═══ SECTION C: MOBILE FRONTEND ══════════════════════════════════

  { section: 'C. MOBILE FRONTEND (React Native / Expo)', prompts: [

    { n:15, title: 'App Shell, Navigation & Design Tokens',
      content: [
        'Build the app shell with Expo Router.',
        '',
        'Design tokens (from Kaphor brand):',
        '  background: #0E0507  surface: #1A0B0F  border: #3A1520',
        '  crimson: #8B0000     textPrimary: #F5F0EE   textSecondary: #A89090',
        '  gold: #C8A882 (tier accent).',
        '',
        'Navigation structure (Expo Router file-based):',
        '  (auth)/login.tsx, (auth)/register.tsx, (auth)/onboarding.tsx',
        '  (tabs)/_layout.tsx — bottom tabs:',
        '    (tabs)/index.tsx        → SHOP (Home feed)',
        '    (tabs)/impact.tsx       → IMPACT (sustainability dashboard)',
        '    (tabs)/circular.tsx     → CIRCULAR (+ FAB, centre button)',
        '    (tabs)/archives.tsx     → ARCHIVES (orders + history)',
        '    (tabs)/profile.tsx      → PROFILE',
        '',
        'Tab bar: dark background, crimson active indicator, custom icons.',
        'Header: KAPHOR wordmark, cart icon, notification bell.',
        '',
        'Implement:',
        '  SplashScreen with KAPHOR logo fade-in.',
        '  AuthGate: redirect to (auth)/login if not logged in.',
        '  ThemeContext: light/dark (dark default).',
        '  ToastProvider using react-native-toast-message.',
      ],
      stack: ['Expo Router 3', 'React Navigation 6', 'Zustand', 'expo-splash-screen'],
    },

    { n:16, title: 'Authentication Screens',
      content: [
        'Build authentication screens matching Kaphor dark luxury aesthetic.',
        '',
        'Login screen:',
        '  Dark background #0E0507. KAPHOR wordmark top centre.',
        '  Email + password inputs with crimson focus border.',
        '  "SIGN IN" button: full-width crimson #8B0000.',
        '  "Forgot password?" link. "New to Kaphor? Register" link.',
        '  Subtle grain texture overlay using SVG pattern.',
        '',
        'Register screen:',
        '  Step 1: email, password, confirm password, username.',
        '  Step 2: displayName, optional bio and location.',
        '  Progress bar in crimson. "CREATE ACCOUNT" button.',
        '',
        'Onboarding / Style Quiz (STEP 04/10 style from screenshots):',
        '  "Select Your Aesthetic" — 4 grid options:',
        '  MINIMALIST, VINTAGE, BOLD, ETHNIC with cover images.',
        '  Selected item shows crimson checkmark overlay.',
        '  "Inspired by Your [selection]" section below with carousel.',
        '  "DAILY CURATOR" suggestion strip at bottom.',
        '  POST answers to /api/v1/users/me/style-quiz on completion.',
        '',
        'All screens: expo-haptics on button press. Keyboard avoiding view.',
        'Form validation with inline error messages in crimson.',
      ],
      stack: ['expo-haptics', 'expo-keyboard-avoiding-view', 'React Hook Form (optional)', 'Zustand auth store'],
    },

    { n:17, title: 'Home Feed Screen (SHOP)',
      content: [
        'Build the personalised garment feed screen matching designs.',
        '',
        'Search bar: "Search luxury vintage..." with filter icon.',
        'Filter chips row: Filters, Category ▾, Material ▾, Size — scrollable.',
        '',
        '"CURATED FOR YOU" section header with "View All" link.',
        'Garment grid: 2-column FlashList.',
        'Each card:',
        '  Full-bleed image (aspect 3:4).',
        '  Top-left: fit score badge "98% FIT" in crimson pill.',
        '  Top-right: heart wishlist button.',
        '  Bottom overlay: brand name (small caps), title, price.',
        '  Condition tag if not PRISTINE.',
        '',
        '"New Drops Daily" banner with crimson CTA "GET NOTIFIED".',
        '"Trending Now" horizontal scroll section.',
        '"SWAP" tab bottom-right (only for accessories).',
        '',
        'On garment card tap → navigate to GarmentDetail.',
        'On scroll: track VIEW events via interactionApi.track().',
        'Pull-to-refresh. Infinite scroll with cursor pagination.',
        'Empty state: "Your circle is quiet. Explore the archive."',
      ],
      stack: ['FlashList', 'TanStack Query', 'expo-image', 'Skeleton loading'],
    },

    { n:18, title: 'Garment Detail Screen',
      content: [
        'Build the garment detail screen.',
        '',
        'Header: full-screen image carousel with pagination dots.',
        '  Swipeable with react-native-reanimated.',
        '  Share button and wishlist heart top-right overlay.',
        '',
        'Content below image:',
        '  Brand (small caps, gold #C8A882), title (large bold), price.',
        '  Condition badge: PRISTINE / MINOR WEAR / etc.',
        '  Size, colour chips, material tags.',
        '  Description paragraph.',
        '  Seller profile row: avatar, username, location, rating.',
        '  "View Seller" link.',
        '',
        'Sustainability section:',
        '  Recyclable fibre % (circular chart matching screenshot).',
        '  Carbon footprint reduction vs new purchase.',
        '',
        '"ADD TO WISHLIST" outline button.',
        '"BUY NOW" full crimson button → triggers purchase intent flow.',
        '  Call interactionApi.track({ garmentId, eventType: "ADD_TO_CART" }).',
        '',
        'If garment isAccessory=true: show "REQUEST SWAP" secondary button.',
        '',
        'Reviews section: star rating summary + recent reviews list.',
        '',
        'Similar items: horizontal scroll, powered by compatibility score.',
      ],
      stack: ['react-native-reanimated', 'expo-image', 'react-native-svg (chart)', 'FlashList'],
    },

    { n:19, title: 'Checkout & Payment Screen',
      content: [
        'Build the checkout flow.',
        '',
        'Step 1 — Order Review:',
        '  Garment summary card: image, title, price.',
        '  Delivery address selector (from saved addresses).',
        '  "Add new address" option.',
        '  Order summary: item price, platform fee (10%), total.',
        '  "PROCEED TO PAYMENT" button.',
        '',
        'Step 2 — Payment:',
        '  Call POST /api/v1/orders/payment-intent to get clientSecret.',
        '  Integrate @stripe/stripe-react-native.',
        '  Show Stripe card form with dark theme matching app.',
        '  "PAY £XXX" button with loading spinner.',
        '',
        'Step 3 — Confirmation:',
        '  Success animation (circular check in crimson).',
        '  Order number, estimated delivery.',
        '  "VIEW ORDER" and "CONTINUE SHOPPING" buttons.',
        '  Track PURCHASED event via interactionApi.',
        '',
        'Error handling: payment failure with retry option.',
        'Address management screen: CRUD for delivery addresses.',
      ],
      stack: ['@stripe/stripe-react-native', 'TanStack Query mutations', 'expo-haptics (success)'],
    },

    { n:20, title: 'Impact Dashboard Screen',
      content: [
        'Build the IMPACT tab screen matching screenshot exactly.',
        '',
        'Header: user avatar with ELITE badge overlay.',
        '  Display name in large white bold.',
        '  "CIRCULAR VISIONARY" subtitle in gold small caps.',
        '  "Preserving elegance since [date]" italic.',
        '',
        'CARBON OFFSET card:',
        '  Large number "124.8 KG SAVED" with leaf icon.',
        '  Progress bar: current tier vs next tier.',
        '  "CURRENT TIER: GOLD" — "7.2KG TO PLATINUM" labels.',
        '',
        'Stats grid (2 columns):',
        '  Left card: circular chart (donut) — WATER SAVED "14k LITERS".',
        '  Right card: circular chart — CIRCULATED "32 ITEMS".',
        '  Both using react-native-svg donut charts.',
        '',
        'Impact equivalent banner:',
        '  Background image. "Your impact is equivalent to planting N trees."',
        '  "VIEW DETAILED REPORT →" in gold.',
        '',
        'Next Milestone card:',
        '  Achievement icon, title, progress description.',
        '',
        'Pull data from GET /api/v1/users/me/impact.',
        'Animated number count-up on screen mount.',
      ],
      stack: ['react-native-svg', 'react-native-reanimated (count-up)', 'expo-linear-gradient', 'TanStack Query'],
    },

    { n:21, title: 'Circular Service Screen',
      content: [
        'Build the CIRCULAR service screen matching screenshot.',
        '',
        'Header card:',
        '  Circular progress ring showing "75% RECYCLABLE FIBER".',
        '  "Garment Lifecycle" title, "Trace the journey" subtitle.',
        '',
        '"Garment Condition Check" section — 2x2 grid:',
        '  PRISTINE: "Like-new, for archival resale".',
        '  MINOR WEAR: "Small visible signs of use".',
        '  RECYCLE ONLY: "End of life fiber recovery".',
        '  UPCYCLE: "Repurpose into new art".',
        '  Each is a selectable card with icon, tapping selects it.',
        '',
        '"White-Glove Pickup" card with PREMIUM badge:',
        '  Earliest Availability: date/time picker.',
        '  Collection Address: from saved addresses, editable.',
        '',
        '"VERIFIED CIRCULAR PARTNERS" row:',
        '  Logo circles: Renewcell, KaPhor Lab, EcoCer.',
        '  Pull from GET /api/v1/circular/partners.',
        '',
        '"SCHEDULE CIRCULAR COLLECTION" full-width crimson button.',
        '  On tap → POST /api/v1/circular/request.',
        '',
        'Plus FAB button in centre bottom tab: opens this screen as modal.',
      ],
      stack: ['react-native-svg (ring)', 'expo-datetime-picker', 'TanStack Query', 'react-native-reanimated'],
    },

    { n:22, title: 'Sell / List a Garment Screen',
      content: [
        'Build the garment listing (sell) flow.',
        '',
        'Step 1 — Photos:',
        '  "Add up to 8 photos" grid with + cells.',
        '  expo-image-picker: camera or library.',
        '  Drag to reorder images.',
        '  First image auto-set as cover. Show cover badge.',
        '',
        'Step 2 — Details:',
        '  Title input, brand input, description textarea.',
        '  Category picker (SAREES, LEHENGAS, TOPS, etc.).',
        '  Condition selector: PRISTINE / MINOR WEAR / GOOD / FAIR.',
        '  Size input, colour selector (multi-select chips).',
        '  Material tags input (type + add).',
        '  Style tags input.',
        '  Toggle: "This is an accessory" (enables swap).',
        '',
        'Step 3 — Pricing:',
        '  Original price (optional). Selling price input.',
        '  Estimated platform fee shown (10%).',
        '  "You will receive: £XXX" net display.',
        '',
        'Step 4 — Review & Publish:',
        '  Summary card preview.',
        '  "PUBLISH LISTING" crimson button.',
        '  POST /api/v1/garments with FormData.',
        '  Track LISTED_FOR_SALE event.',
      ],
      stack: ['expo-image-picker', 'react-native-draggable-flatlist', 'FormData', 'TanStack Query'],
    },

    { n:23, title: 'Profile, Orders & Archives Screen',
      content: [
        'Build Profile and Archives screens.',
        '',
        'Profile screen:',
        '  Cover photo (optional) + avatar. Edit profile button.',
        '  Display name, tier badge, follower/following counts.',
        '  Bio, location.',
        '  Tab row: Listings | Sold | Reviews.',
        '  Settings icon → Settings screen.',
        '',
        'Settings screen:',
        '  Account: edit profile, change password, verify email.',
        '  Notifications: toggle email / push preferences.',
        '  Payment: manage Stripe Connect, saved cards.',
        '  Privacy: account visibility, block list.',
        '  "Delete Account" danger zone.',
        '  "Sign Out" button.',
        '',
        'Archives screen (order history):',
        '  Tabs: Purchases | Sales | Swaps.',
        '  Order card: image, title, price, status badge, date.',
        '  Status colours: PENDING=amber, CONFIRMED=blue,',
        '    DELIVERED=green, CANCELLED=red.',
        '  Tap → Order Detail screen.',
        '',
        'Order Detail:',
        '  Garment summary, seller/buyer info, timeline stepper,',
        '  tracking number, "CONFIRM DELIVERY" button (buyer).',
        '  "LEAVE REVIEW" button after delivery.',
      ],
      stack: ['TanStack Query', 'Zustand', 'expo-image-picker (avatar)', 'react-native-reanimated'],
    },

    { n:24, title: 'Social Feed & Community Screen',
      content: [
        'Build the social/community layer matching screenshot.',
        '',
        'Stories row: horizontal scroll of user avatars with crimson ring.',
        '  Labels: @username or category (Tips, New, Editors).',
        '',
        'Post card:',
        '  Header: avatar, @username, location, ... menu.',
        '  Image: full-width (aspect 4:5).',
        '  If garment attached: title + "SHOP LOOK" crimson pill overlay.',
        '  Footer: heart count, comment count, share icon, bookmark icon.',
        '',
        'Post detail on tap:',
        '  Full image, comment thread, like/comment actions.',
        '',
        'Create post:',
        '  Attach images, write caption, tag garments, add hashtags.',
        '  POST /api/v1/social/posts.',
        '',
        'Studio / Upcycle section:',
        '  Tabs: Tutorials | Services | Before & After.',
        '  Tutorial card: thumbnail, title, duration, level badge.',
        '  "Bespoke Redesign Service" promo card in crimson.',
        '  Before/After transformation cards: image split.',
        '',
        'Search: search users by @username.',
        'Follow/unfollow from profile or search results.',
      ],
      stack: ['FlashList', 'expo-image', 'react-native-reanimated', 'Socket.io client'],
    },

    { n:25, title: 'Rental / Heritage Collection Screen',
      content: [
        'Build the Heritage Rental Collection screen matching design.',
        '',
        'Full-bleed hero banner: "The Heritage Rental Collection".',
        '  "EXCLUSIVE COUTURE" label, subtitle text.',
        '',
        'Category tabs: Sarees | Lehengas | Sherwanis | Jewels.',
        '  Filter chips: fabric type (Banarasi Silk, Velvet, Zardosi).',
        '',
        '"RESERVE YOUR DATES" calendar:',
        '  Inline calendar view with LIVE AVAILABILITY indicator.',
        '  Selected dates highlighted in crimson.',
        '  Dates with bookings shown greyed out.',
        '',
        'Garment grid: 2-column with rental pricing.',
        '  Price format: "$240 / 3 days  RENT".',
        '  "AVAILABLE NOW" / "LAST PIECE" badges.',
        '  Heart save button.',
        '',
        'Note: Rental is a separate flow from buy/sell.',
        '  Rental order: POST /api/v1/rentals with startDate, endDate.',
        '  Build rental-specific fields on the Garment model: isRental,',
        '  rentalPricePerDay, rentalMinDays.',
        '  Add Rental model to Prisma schema.',
      ],
      stack: ['react-native-calendars', 'FlashList', 'TanStack Query', 'expo-haptics'],
    },

  ]},

  // ═══ SECTION D: TESTING & DEPLOYMENT ═════════════════════════════

  { section: 'D. TESTING & DEPLOYMENT', prompts: [

    { n:26, title: 'Backend Testing Suite',
      content: [
        'Write comprehensive tests for the backend.',
        '',
        'Unit tests (Jest):',
        '  lifecycle.service.ts — test all LOE decision paths.',
        '    Mock Prisma, test PROMOTE/SUPPRESS/TRANSITION/SCHEDULE outcomes.',
        '  auth.controller.ts  — register, login, token refresh.',
        '  garment.controller  — CRUD, lifecycle state transitions.',
        '  behaviour engine    — interest score calculation, decay formula.',
        '',
        'Integration tests (supertest):',
        '  Auth flow end-to-end: register → login → use token → refresh → logout.',
        '  Garment create → interact → LOE trigger → state change.',
        '  Order flow: create → payment webhook → confirm → complete.',
        '  Swap flow: request → accept → complete.',
        '',
        'Test database: use a separate test PostgreSQL database.',
        '  beforeEach: seed minimal data. afterEach: clean up.',
        '',
        'Coverage target: ≥80% on services and controllers.',
        'Add GitHub Actions CI: run tests on push to main.',
        'Lint + type-check in CI pipeline.',
      ],
      stack: ['Jest', 'Supertest', 'Prisma test client', 'GitHub Actions CI'],
    },

    { n:27, title: 'Deployment & Infrastructure',
      content: [
        'Set up production deployment.',
        '',
        'Backend deployment on Railway or Render:',
        '  Dockerfile: Node 20 alpine. Multi-stage build.',
        '  Expose PORT from environment.',
        '  Health check endpoint: GET /health.',
        '  Environment variables via platform secrets.',
        '  Run prisma migrate deploy before start.',
        '',
        'Database: Railway PostgreSQL or Supabase.',
        '  Connection pooling with PgBouncer.',
        '  Daily automated backups.',
        '',
        'Image storage: Cloudinary free tier for dev,',
        '  Cloudinary paid for production.',
        '',
        'Frontend: publish to Expo EAS.',
        '  eas.json with development, preview, production profiles.',
        '  expo-updates for OTA updates.',
        '  App store submission checklist.',
        '',
        'Environment management:',
        '  .env.development, .env.staging, .env.production.',
        '  Never commit secrets. Use .env.example as template.',
        '',
        'Monitoring: Winston logs shipped to Logtail or Papertrail.',
        '  Uptime monitoring with BetterUptime (free).',
        '  Error tracking with Sentry (backend + frontend).',
      ],
      stack: ['Docker', 'Railway / Render', 'EAS Build', 'Sentry', 'Cloudinary'],
    },

  ]},

];

// ─────────────────────────────────────────────────────────────────────
// BUILD DOCUMENT
// ─────────────────────────────────────────────────────────────────────

const children = [];

// Cover page
children.push(
  sp(1800),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'KAPHOR', bold: true, size: 96, font: 'Calibri', color: '8B0000' })],
    spacing: { before: 0, after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'AI-Driven Circular Fashion Platform', size: 40, font: 'Calibri', color: 'F5F0EE', italics: true })],
    spacing: { before: 0, after: 240 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: '8B0000', space: 1 }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '8B0000', space: 1 } },
    children: [new TextRun({ text: 'COMPLETE VIBE CODING PROMPT GUIDE — 27 PROMPTS', size: 28, font: 'Calibri', color: 'C8A882', bold: true })],
    spacing: { before: 160, after: 160 },
  }),
  sp(400),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Backend · Database · Frontend · Security · API · Deployment', size: 24, font: 'Calibri', color: 'A89090' })],
    spacing: { before: 0, after: 0 },
  }),
  sp(200),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Version 1.0  ·  2026  ·  Confidential', size: 20, font: 'Calibri', color: '6B5050' })],
  }),
  pb()
);

// Intro
children.push(
  h1('How to Use This Guide'),
  body('This document contains 27 structured prompts to build the complete Kaphor application from scratch using AI-assisted (vibe coding) development. Each prompt is self-contained and builds on the previous. Work through them in order for the smoothest experience.'),
  sp(80),
  h2('Technology Stack Overview'),
  body('Backend: Node.js 20 · TypeScript 5 · Express.js · Prisma ORM · PostgreSQL 16'),
  body('Frontend: React Native 0.73 · Expo 50 · Expo Router · TypeScript'),
  body('State: Zustand · TanStack Query (server state)'),
  body('Payments: Stripe API + Stripe Connect'),
  body('Media: Cloudinary (image storage)'),
  body('Real-time: Socket.io'),
  body('Auth: JWT (access 15min + refresh 7d) · bcryptjs'),
  body('Security: Helmet · CORS · Rate limiting · Zod validation'),
  body('Deploy: Docker · Railway (backend) · Expo EAS (mobile)'),
  sp(80),
  h2('Design Language'),
  body('Background: #0E0507 (deep maroon-black)  ·  Brand crimson: #8B0000'),
  body('Text: #F5F0EE (primary)  ·  Gold accent: #C8A882 (tier labels)'),
  body('Dark luxury editorial aesthetic. No flat minimalism — rich textures, grain overlays.'),
  sp(80),
  h2('Key Rules'),
  bullet('Swap is ONLY for accessories (isAccessory = true). All clothing is buy/sell only.'),
  bullet('Lifecycle states: LISTED → INTEREST → BUY_INTENT / SELL_INTENT → OWNERSHIP → DECLINE → CIRCULATION → REUSE/UPCYCLE/RECYCLE.'),
  bullet('The Lifecycle Optimization Engine (LOE) is the core patentable component — handle with care.'),
  bullet('Style vectors are 128-dimensional float arrays. Update incrementally on every interaction.'),
  bullet('Never commit .env files. Always use .env.example as the template.'),
  pb()
);

// Prompt sections
for (const section of prompts) {
  children.push(h1(section.section));
  children.push(sp(80));
  for (const p of section.prompts) {
    children.push(promptBox(p.n, p.title, p.content, p.stack));
    children.push(sp(200));
  }
  children.push(pb());
}

// Quick reference table
children.push(
  h1('Quick Reference — All 27 Prompts'),
  sp(80)
);

const refRows = [
  new TableRow({
    children: ['#', 'Title', 'Section'].map((t, i) =>
      new TableCell({
        borders: thBdrs,
        width: { size: [600, 7060, 1700][i], type: WidthType.DXA },
        shading: { fill: '1A0B0F', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })] })],
      })
    ),
  }),
];

const allPrompts = prompts.flatMap(s => s.prompts.map(p => ({ ...p, section: s.section.split('.')[1]?.trim().split('&')[0].trim() || s.section })));

allPrompts.forEach((p, i) => {
  refRows.push(new TableRow({
    children: [
      new TableCell({ borders: bdrs, width: { size: 600, type: WidthType.DXA }, shading: { fill: i%2===0?'FAF8F8':'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: String(p.n).padStart(2,'0'), size: 18, font: 'Courier New', color: '8B0000', bold: true })] })] }),
      new TableCell({ borders: bdrs, width: { size: 7060, type: WidthType.DXA }, shading: { fill: i%2===0?'FAF8F8':'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: p.title, size: 20, font: 'Calibri' })] })] }),
      new TableCell({ borders: bdrs, width: { size: 1700, type: WidthType.DXA }, shading: { fill: i%2===0?'FAF8F8':'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: p.section, size: 18, font: 'Calibri', color: '666666' })] })] }),
    ],
  }));
});

children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [600, 7060, 1700], rows: refRows }));

// Build doc
const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: 'Calibri', color: '1A0B0F' }, paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Calibri', color: '5C0010' }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Calibri', color: '333333' }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'KAPHOR — Vibe Coding Prompt Guide', size: 18, font: 'Calibri', color: '999999' })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } }, spacing: { before: 0, after: 120 } })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'Kaphor · Confidential · Page ', size: 18, font: 'Calibri', color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri', color: '999999' })], border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } }, spacing: { before: 120, after: 0 } })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/home/claude/Kaphor_VibeCoding_Prompts.docx', buf);
  console.log('Done');
});
