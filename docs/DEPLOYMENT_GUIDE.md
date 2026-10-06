# Kaphor Deployment Guide

A short, step-by-step guide to put Kaphor online. You will set up:

1. A database (PostgreSQL)
2. Redis (a small fast store used for live features)
3. Image storage (Cloudinary)
4. The backend on Render
5. Razorpay payments and webhooks
6. The Android app (EAS build)
7. The web app

**Golden rule:** never paste a real password, key or secret into a file in this repo, a chat, or an issue. Put them only in the Render dashboard (Environment tab) or in your own private `.env` file, which git ignores.

---

## Before you start

You need free accounts on: GitHub, Render, Neon (or Supabase), Cloudinary, Razorpay, Expo, and Google Cloud (for Gemini and Google sign-in).

Make random secrets on your computer with this command (run it twice, you need two different values):

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Step 1. Database

1. Create a PostgreSQL database on **Neon**, **Supabase**, or **Render Postgres**. Pick a region close to your Render region.
2. Copy the connection string. It looks like `postgresql://USER:PASSWORD@HOST:5432/DBNAME`.
3. If the provider gives you two strings (a pooled one and a direct one), use the pooled one for `DATABASE_URL` and the direct one for `DIRECT_URL`.
4. You do not need to run anything by hand. The backend applies database updates (migrations) every time it starts.

## Step 2. Redis

1. Create a Redis instance on **Render Key Value**, **Upstash**, or similar.
2. Copy its URL (starts with `redis://` or `rediss://`). This is `REDIS_URL`.
3. Without Redis the app still works, but only on a single server.

## Step 3. Image storage (Cloudinary)

1. Create a Cloudinary account. On the dashboard copy the **Cloud name**, **API key** and **API secret**.
2. These become `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Do not skip this in production. Render erases local files on every deploy.

## Step 4. Backend on Render

1. Push your code to GitHub.
2. In Render: **New +**, then **Blueprint**, then pick your repo. Render reads `render.yaml`.
3. Fill in the environment variables when asked (see the table below). Leave optional ones empty if you do not use that feature.
4. Click **Apply**. Render builds the app, runs the database migrations, and starts it.
5. Open `https://YOUR-SERVICE.onrender.com/health`. You should see `{"status":"ok"}`.
6. Open `https://YOUR-SERVICE.onrender.com/ready`. You should see `{"status":"ready"}`. If you see `not_ready`, the database address is wrong.
7. Set `ALLOWED_ORIGINS` to the address of your web app (for example `https://app.example.com`). The server refuses to start in production without it.
8. Optional automatic deploys from GitHub Actions: in Render open your service, **Settings**, **Deploy Hook**, copy the URL, and save it in GitHub as the repository secret `RENDER_DEPLOY_HOOK_URL`.

The free Render plan goes to sleep when idle and the first request after that is slow. Use a paid plan for launch.

### Make your first admin

Admins are never created automatically. On your own computer, with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set in your private `.env`, run from `kaphor/backend`:

```
npx ts-node scripts/upsert-admin.ts
```

## Step 5. Razorpay payments and webhooks

1. In Razorpay, switch to **Live mode** only when you are ready. Test mode uses separate keys.
2. Copy **Key ID** and **Key Secret** (Settings, API Keys). These are `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Go to Settings, **Webhooks**, **Add new webhook**:
   - URL: `https://YOUR-SERVICE.onrender.com/api/v1/payments/razorpay/webhook`
   - Secret: type a long random value. Save the same value in Render as `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.captured` and `order.paid`.
4. In Razorpay test mode, make a small payment and check the order becomes confirmed.
5. The mobile app only needs the Key ID (not the secret).

If you also use Stripe: add a webhook to `https://YOUR-SERVICE.onrender.com/api/v1/payments/webhook` with the event `payment_intent.succeeded`, and save its signing secret as `STRIPE_WEBHOOK_SECRET`.

## Step 6. Android app (EAS)

1. Install the tools once: `npm install -g eas-cli`, then `eas login`.
2. In `kaphor-frontend`, set these public settings (in `eas.json` env or a private `.env`):
   ```
   EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com/api/v1
   EXPO_PUBLIC_SOCKET_URL=https://YOUR-SERVICE.onrender.com
   EXPO_PUBLIC_RAZORPAY_KEY_ID=your live Razorpay key id
   ```
3. Build a test APK: `eas build -p android --profile preview`
4. Build the Play Store bundle: `eas build -p android --profile production`
5. Download the file from the link EAS prints, then install it or upload it to the Play Console.
6. Never put secret keys (anything ending in `_SECRET`) in the app. Everything in the app can be read by users.

## Step 7. Web app

1. From `kaphor-frontend`, run `npm run build:web`. It creates a `dist` folder.
2. Upload `dist` to any static host (Render Static Site, Netlify, Vercel, Cloudflare Pages).
3. Make the web address match `ALLOWED_ORIGINS` on the backend exactly (including `https://`, no trailing slash).

---

## Environment variables

Set these on Render. "Required" means the server will not start (or a main feature breaks) without it.

| Variable | Required | What it is |
|---|---|---|
| `NODE_ENV` | Yes | Set to `production` (already in `render.yaml`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_URL` | Neon / Supabase | Direct (non-pooled) database string |
| `JWT_SECRET` | Yes | Random, at least 32 characters |
| `JWT_REFRESH_SECRET` | Yes | Random, at least 32 characters, different from `JWT_SECRET` |
| `ALLOWED_ORIGINS` | Yes | Web addresses allowed to call the API, comma separated |
| `FRONTEND_URL` | Yes | Web app address, used in email links |
| `BACKEND_URL` | Yes | Your Render address, used for image links |
| `REDIS_URL` | Recommended | Redis address |
| `RAZORPAY_KEY_ID` | For payments | Razorpay key id |
| `RAZORPAY_KEY_SECRET` | For payments | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | For payments | Secret you typed into the Razorpay webhook |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | With Stripe | Stripe webhook signing secret |
| `GEMINI_API_KEY` | For AI checks | Google Gemini key |
| `GROQ_API_KEY` | For AI chat | Groq key |
| `YOUTUBE_API_KEY` | Optional | Only for the guide-enrichment script |
| `CLOUDINARY_CLOUD_NAME` | For images | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For images | Cloudinary key |
| `CLOUDINARY_API_SECRET` | For images | Cloudinary secret |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` | Optional | Only if you store images in S3 (all four together) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | For push | Firebase service account (all three together) |
| `GOOGLE_CLIENT_ID` | For Google sign-in | Web client id from Google Cloud |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Optional | Extra Google client ids accepted at sign-in |
| `API_VERSION` | No | Default `v1` |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | No | Defaults `15m` and `7d` |
| `LOG_LEVEL` | No | `info` by default |

The full list with comments is in `kaphor/backend/.env.example`.

---

## Performance notes

Plain-English tips to keep the app fast.

1. **Apply the database indexes.** Indexes make lists (shop feed, orders, rentals, swaps, messages, notifications) load quickly. Run this once per deploy from `kaphor/backend` (Render does it automatically if your start command already includes it):
   `npx prisma migrate deploy`
2. **Use the pooled database address with these settings** on `DATABASE_URL` (Supabase pooler or Neon pooled string):
   `?pgbouncer=true&connection_limit=5&pool_timeout=20`
   Keep `DIRECT_URL` as the direct (non-pooled) address. It is only used for migrations.
3. **Redis is optional.** Without it, the server keeps a small in-memory cache (15 to 120 seconds) and everything still works on a single server. Set `CACHE_DISABLED=true` if you ever need to rule out stale data while debugging.
4. **Render cold starts.** On the free plan the server sleeps when idle and the first request takes about 30 seconds. Point an uptime checker (for example UptimeRobot) at `/health` every 5 minutes, or use a paid plan. `/health` does no database work, so it is cheap to ping.
5. **Photos.** Uploads are resized (max 1600 px) and Cloudinary serves them as WebP/AVIF automatically. List screens also receive a small `thumbnailUrl` for faster loading.
6. **AI calls** time out after about 25 seconds and fall back to built-in answers. Identical AI requests are reused for 3 minutes. Photos over 6 MB are refused.
n---

## Pre-launch security checklist

Tick every line before you go live.

- [ ] **Rotate old secrets.** Earlier versions of this guide contained real JWT secrets and a database password. Treat them as leaked: create new JWT secrets and a new database password, and delete the old ones. Also rotate any key that was ever pasted into a file or chat.
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are new, random, 32+ characters, and different from each other.
- [ ] `NODE_ENV=production` on Render.
- [ ] `ALLOWED_ORIGINS` lists only your real web address(es). No `*`.
- [ ] Razorpay is in Live mode with live keys, and the webhook secret is set on both sides.
- [ ] Made one small real payment and one refund end to end.
- [ ] Cloudinary (or S3) is set up, so photos are not lost on deploy.
- [ ] `/health` and `/ready` both answer OK.
- [ ] Database has automatic backups turned on, and you tested one restore.
- [ ] Only one admin account exists and it has a strong, unique password.
- [ ] No `.env`, key file or service-account file is in git (`git ls-files | grep -i env`).
- [ ] The app contains no `_SECRET` values (check `eas.json` and `.env` in `kaphor-frontend`).
- [ ] Run `npm audit --omit=dev` in `kaphor/backend` and fix anything marked high.
- [ ] Turn on GitHub secret scanning, and on two-step login for GitHub, Render, Razorpay, Cloudinary and Expo.
- [ ] Set up an uptime check (for example UptimeRobot) on `/health`, and an alert for errors in Render logs.
- [ ] Privacy policy and terms are linked in the app and in the store listing.
