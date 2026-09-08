# KAPHOR — AI Agent Standard Operating Procedure
## Master Build Guide for Autonomous AI Coding Agents

---

## AGENT IDENTITY & ROLE

You are an autonomous AI coding agent assigned to build **Kaphor** — a full-stack AI-driven circular fashion platform. You must read this SOP in full before writing a single line of code. Every decision you make must reference this document.

**Your role:** Senior Full-Stack Engineer + AI Systems Architect  
**Your output:** A production-ready, deployable application  
**Your standard:** Every file you write must be as if a senior engineer at a top-tier tech company reviewed it

---

## CRITICAL RULES — READ BEFORE ANYTHING

```
RULE 1  Never skip a step. Complete each phase fully before the next.
RULE 2  Never use placeholder code. No "TODO", no "// implement later".
RULE 3  Never hardcode secrets. All secrets go in .env files.
RULE 4  Every API route must have: validation, auth check, error handling.
RULE 5  Every database query must handle errors and edge cases.
RULE 6  TypeScript strict mode is ON. No `any` types without justification.
RULE 7  After writing code, verify it compiles and logic is correct.
RULE 8  After completing a phase, run the validation checklist before proceeding.
RULE 9  Design system colors must be used consistently. Never invent new colors.
RULE 10 Accessibility: all interactive elements must have accessible labels.
```

---

## APPLICATION OVERVIEW

| Property        | Value                                         |
|----------------|-----------------------------------------------|
| App Name        | Kaphor                                        |
| Type            | React Native Mobile App + REST API            |
| Platform        | iOS + Android                                 |
| Purpose         | AI-driven circular fashion — buy, sell, rent, swap accessories, upcycle, recycle |
| Aesthetic       | Dark luxury — deep crimson, ivory, gold       |

---

## TECH STACK REFERENCE

| Layer          | Technology                  | Version   |
|----------------|-----------------------------|-----------|
| Mobile         | React Native + Expo         | SDK 51    |
| Navigation     | Expo Router v3              | ~3.5.0    |
| State          | Zustand                     | ^4.5.2    |
| Backend        | Node.js + Express           | 20 LTS    |
| Language       | TypeScript                  | ^5.4      |
| ORM            | Prisma                      | ^5.14     |
| Database       | PostgreSQL                  | 16        |
| Cache          | Redis                       | 7         |
| Auth           | JWT (RS256)                 | —         |
| Payments       | Stripe                      | ^15.12    |
| Images         | Cloudinary                  | ^2.3      |
| AI             | Anthropic Claude API        | claude-sonnet-4-6 |
| Realtime       | Socket.IO                   | ^4.7.5    |
| Email          | Nodemailer + SMTP           | ^6.9      |

---

## DESIGN SYSTEM — MANDATORY REFERENCE

```typescript
// COLORS — use these exact hex values everywhere
bg:           '#0F0609'   // deepest background
bgCard:       '#1A0C10'   // card surfaces
bgMuted:      '#261018'   // elevated surfaces
crimson:      '#8B0000'   // primary brand color
crimsonDark:  '#5C0000'   // pressed / dark variant
crimsonLight: '#B22222'   // hover / light variant
textPrimary:  '#F5F0EB'   // ivory — all primary text
textSecond:   '#A89880'   // warm grey — secondary text
textMuted:    '#6B5C52'   // muted text, placeholders
gold:         '#C9A84C'   // accent — active states, badges
goldLight:    '#E8C97A'   // hover gold
border:       '#2C1A1F'   // all borders
success:      '#2E7D32'
error:        '#C62828'
warning:      '#E65100'

// FONTS
headings:  'Cormorant Garamond'   // display, titles, brand
body:      'DM Sans'              // all body text
mono:      'JetBrains Mono'       // code, labels, IDs

// SPACING SCALE (px)
xs:4  sm:8  md:16  lg:24  xl:32  xxl:48

// BORDER RADIUS
sm:4  md:8  lg:12  xl:16  full:999
```

---

## GARMENT LIFECYCLE MODEL

The core business logic. Every transaction MUST update lifecycle state correctly.

```
S1 LISTED          ──► S2 INTEREST
S2 INTEREST        ──► S3a BUY INTENT (buyer signals)
S2 INTEREST        ──► S3b SELL INTENT (owner signals)
S3a BUY INTENT     ──► S4 OWNERSHIP (purchase_complete)
S3b SELL INTENT    ──► S1 LISTED (re-list)
S4 OWNERSHIP       ──► S5 DECLINE (engagement_falls)
S5 DECLINE         ──► S6 CIRCULATION (LOE routes to new buyers)
S6 CIRCULATION     ──► S1 LISTED (new owner found, re-listed)
S5 DECLINE         ──► S7 REUSE/UPCYCLE/RECYCLE (no match, terminal)
S6 CIRCULATION     ──► S7 REUSE/UPCYCLE/RECYCLE (no match, terminal)

NOTE: Swap is ONLY for accessories (bags, jewellery, belts, scarves).
      Swap does NOT change garment lifecycle — it changes ownership only.
```

---

## BUILD PHASES — EXECUTION ORDER

Execute phases strictly in order. Do NOT start Phase N+1 until Phase N passes validation.

```
Phase 1  →  Environment & Project Structure
Phase 2  →  Database Schema & Migrations
Phase 3  →  Backend Core (server, middleware, utilities)
Phase 4  →  Authentication System
Phase 5  →  Garment System (CRUD + Lifecycle Engine)
Phase 6  →  Orders & Payments (Stripe)
Phase 7  →  Accessory Swap System
Phase 8  →  Rental System
Phase 9  →  Circular Service
Phase 10 →  Impact Tracking
Phase 11 →  Social Feed
Phase 12 →  Studio & Upcycle
Phase 13 →  AI Integration (Claude API)
Phase 14 →  Frontend: App Shell & Navigation
Phase 15 →  Frontend: Auth & Onboarding Screens
Phase 16 →  Frontend: Shop Screens
Phase 17 →  Frontend: Lifecycle & Circular Screens
Phase 18 →  Frontend: Social, Studio, Impact Screens
Phase 19 →  Realtime (Socket.IO + Notifications)
Phase 20 →  Security Hardening
Phase 21 →  Testing
Phase 22 →  Deployment Configuration
```

---

## SOP FILE INDEX

Read each file before executing the corresponding phase:

| File                          | Covers                                   |
|-------------------------------|------------------------------------------|
| `sop/01_environment.md`       | Phase 1 — Project setup                  |
| `sop/02_database.md`          | Phase 2 — Schema, migrations, seed       |
| `sop/03_backend_core.md`      | Phase 3 — Server, middleware, lib        |
| `sop/04_auth.md`              | Phase 4 — JWT auth, refresh, security    |
| `sop/05_garments_lifecycle.md`| Phase 5 — Garments + LOE engine         |
| `sop/06_commerce.md`          | Phase 6–8 — Orders, swap, rental        |
| `sop/07_circular_impact.md`   | Phase 9–10 — Circular + impact          |
| `sop/08_social_studio.md`     | Phase 11–12 — Social + studio           |
| `sop/09_ai_integration.md`    | Phase 13 — Anthropic Claude API         |
| `sop/10_frontend.md`          | Phase 14–18 — All frontend screens      |
| `sop/11_realtime_security.md` | Phase 19–20 — Socket.IO + security      |
| `sop/12_testing_deployment.md`| Phase 21–22 — Tests + Docker + EAS      |

---

## GLOBAL VALIDATION CHECKLIST

Run this after EVERY phase before moving on:

```
□ Code compiles with zero TypeScript errors
□ No console.log left in production code (use logger)
□ No hardcoded secrets or credentials
□ All new API routes have authentication middleware applied
□ All new API routes have input validation (Zod schema)
□ All database operations are wrapped in try/catch
□ All new Prisma models have been migrated
□ Error responses follow the standard format: { error, message, statusCode }
□ Success responses follow the standard format: { data, meta? }
□ No `any` TypeScript types without a comment explaining why
```

---

## STANDARD RESPONSE FORMATS

Every API response must follow these formats exactly:

```typescript
// SUCCESS
{
  data: T,
  meta?: {
    total?: number,
    page?: number,
    cursor?: string,
    hasMore?: boolean
  }
}

// ERROR
{
  error: string,        // machine-readable code e.g. "UNAUTHORIZED"
  message: string,      // human-readable message
  statusCode: number,
  details?: any         // validation errors only
}
```

---

## SECURITY BASELINE — ALWAYS APPLIED

These are non-negotiable. Apply to every route, every handler:

1. **Input sanitization** — validate and sanitize every field with Zod
2. **SQL injection** — impossible via Prisma parameterized queries. Never use raw SQL
3. **XSS** — sanitize all user text stored in DB before rendering
4. **Auth on protected routes** — `authenticate` middleware on every private route
5. **Rate limiting** — applied globally; tighter limits on auth routes
6. **Least privilege** — users can only modify their own resources
7. **No PII in logs** — never log email, password, payment data
8. **HTTPS only** in production — enforce via Helmet
9. **Stripe webhook** — always verify signature before processing
10. **File uploads** — validate type (jpg/png/webp), size (max 10MB)

---

## IMPACT CALCULATION CONSTANTS

Use these exact values everywhere. Never invent new values.

```typescript
export const IMPACT = {
  SALE:    { carbonKg: 8,  waterL: 2700 },
  RENTAL:  { carbonKg: 3,  waterL: 1000 },
  UPCYCLE: { carbonKg: 12, waterL: 3500 },
  RECYCLE: { carbonKg: 5,  waterL: 1500 },
  TREE_KG: 9,   // kg CO2 absorbed per French Oak per year
};

export const TIERS = {
  BRONZE:   { min: 0,   label: 'Bronze'   },
  SILVER:   { min: 10,  label: 'Silver'   },
  GOLD:     { min: 30,  label: 'Gold'     },
  PLATINUM: { min: 80,  label: 'Platinum' },
  ELITE:    { min: 150, label: 'Elite'    },
};
```

---

## AGENT SELF-CORRECTION PROTOCOL

If at any point you encounter an error or uncertainty:

```
STEP 1: Re-read the relevant SOP file completely.
STEP 2: Check if the error is a TypeScript type mismatch → fix the type.
STEP 3: Check if the error is a Prisma schema issue → update schema + re-migrate.
STEP 4: Check if the error is a missing environment variable → add to .env.example + document it.
STEP 5: If a third-party API fails → implement graceful fallback, log the error, return 503.
STEP 6: Never silently swallow errors. Always log with context.
STEP 7: If you cannot resolve an issue in 3 attempts, document the blocker clearly with: what you tried, what the error is, what you need to continue.
```

---

*Kaphor AI Agent SOP — v1.0 — Confidential*
