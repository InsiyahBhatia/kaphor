# Kaphor One-Click Production Deployment Guide

This guide enables you to access Kaphor without opening terminals, typing `npm run dev`, or enduring development-mode lag and loading delays.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │          RENDER / RAILWAY             │
                      │  https://kaphor-backend.onrender.com   │
                      │       (Always-On Cloud Server)        │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
     ┌───────────────────────┐                       ┌───────────────────────┐
     │   Kaphor Android APK  │                       │   Local / Web Client  │
     │  (Installed on Phone) │                       │ (Fast production bundle)│
     │ No laptop or terminal │                       │   Zero dev rebuild lag│
     │  Zero lag / Instant   │                       │                       │
     └───────────────────────┘                       └───────────────────────┘
```

---

## Step 1: Deploy Backend to Render (Free Always-On HTTPS)

The blueprint file [`render.yaml`](file:///c:/Users/Insiyah/Kaphor/render.yaml) has already been created in the repository root.

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and log in with your GitHub account (`InsiyahBhatia`).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your repository: `InsiyahBhatia/kaphor`.
4. Render will read `render.yaml` and configure the backend service automatically.
5. In the **Environment Variables** prompt, fill in your production secrets (copied from `kaphor/backend/.env`):
   * `DATABASE_URL`: `postgresql://postgres.gaeekrwudwzbqjazuqws:xFBkv3p3nYtgwZMs@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&sslmode=require`
   * `DIRECT_URL`: `postgresql://postgres.gaeekrwudwzbqjazuqws:xFBkv3p3nYtgwZMs@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require`
   * `JWT_SECRET`: `b89c210f859111184821a97afb839fe4da6a4b1ebe6255ad766b0fd7c22a6b44`
   * `JWT_REFRESH_SECRET`: `5d23e17bcfb87ade2b4c4b7b31d674b45ec26ae85933e7714785d3ef50940c54`
   * `GEMINI_API_KEY`: *(Your Google Gemini API key)*
   * `RAZORPAY_KEY_ID`: *(Your Razorpay key ID)*
   * `RAZORPAY_KEY_SECRET`: *(Your Razorpay secret)*
6. Click **Apply**.
7. Once deployed, Render will give you a public URL, for example:  
   `https://kaphor-backend.onrender.com`
8. Verify it by visiting:  
   `https://kaphor-backend.onrender.com/health` $\rightarrow$ `{"status":"ok"}`

---

## Step 2: Build the Standalone Android APK

Your EAS account (`insi` / `insiyahmbhatia@gmail.com`, Project ID `3aeb7c93-08b6-4700-b8aa-d55744986915`) is already connected and ready.

1. In `kaphor-frontend/.env`, set your public cloud backend URL:
   ```env
   EXPO_PUBLIC_API_URL=https://kaphor-backend.onrender.com/api/v1
   EXPO_PUBLIC_SOCKET_URL=https://kaphor-backend.onrender.com
   ```
2. In your terminal inside `c:\Users\Insiyah\Kaphor\kaphor-frontend`, run:
   ```bash
   eas build -p android --profile preview
   ```
3. Expo will build a standalone APK in the cloud.
4. When finished, EAS provides a **direct download link and QR code**.
5. Scan the QR code with your phone or download the `.apk` directly to install it.

> **Why this fixes the lag completely:**  
> In development mode (Expo Go), JavaScript is compiled dynamically over your Wi-Fi/hotspot and images re-stream every time. A standalone release APK bundles all JavaScript bytecode, assets, and Hermes engine natively onto the device. It opens instantly, has zero loading wait, and works wherever you have mobile internet.

---

## Step 3: Fast Local Production Mode (Optional / Instant Laptop Use)

If you ever want to run locally on your laptop without development overhead or hot-reloading lag:

1. **Start production backend (compiled dist):**
   ```bash
   cd c:\Users\Insiyah\Kaphor\kaphor\backend
   npm run build
   npm start
   ```
2. **Start frontend in release/optimized mode:**
   ```bash
   cd c:\Users\Insiyah\Kaphor\kaphor-frontend
   npx expo start --no-dev --minify
   ```
This disables React development hooks, debug logging, and devtools overhead, providing smooth 60fps performance.
