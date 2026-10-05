# Kaphor

A circular fashion app. Buy, sell, rent and swap clothes, fix or upcycle old ones, and see the impact you make.

## What's in this repo

| Folder | What it is |
| --- | --- |
| `kaphor-frontend/` | The app (Expo / React Native, runs on Android, iOS and web) |
| `kaphor/backend/` | The API (Node, Express, Prisma, PostgreSQL, Redis) |
| `docs/` | Product notes, database and deployment guides |

## Run it on your computer

You need Node 20 or newer.

**1. Backend**

```bash
cd kaphor/backend
cp .env.example .env        # fill in the values
npm ci
npx prisma migrate deploy
npm run dev                 # http://localhost:4000
```

**2. App**

```bash
cd kaphor-frontend
cp .env.example .env        # point EXPO_PUBLIC_API_URL at your backend
npm ci
npm start
```

## Checks before you ship

```bash
cd kaphor-frontend && npm run typecheck
cd kaphor/backend  && npx tsc --noEmit && npm test
```

## Deploy

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for the step-by-step guide and the security checklist.

## Design

One theme everywhere: warm paper background, ink text, rose for main actions, green for good news, gold for small touches. Colors, fonts and spacing live in `kaphor-frontend/src/theme/index.ts`. Every loading screen uses the same `Loader` in `src/components/common/Loader.tsx`.
