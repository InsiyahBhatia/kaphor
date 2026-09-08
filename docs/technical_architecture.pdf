# Kaphor — Detailed Technical Architecture & Logic

This document provides a deep dive into the technical implementation, algorithms, and logical flows of the Kaphor circular luxury platform.

---

## 🏗️ 1. Core Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React Native (Expo) | Cross-platform mobile application (iOS/Android). |
| **Backend** | Node.js + Express + TypeScript | Robust, type-safe RESTful API & Services. |
| **Database** | PostgreSQL + Prisma ORM | Relational data management with schema safety. |
| **Real-time** | Socket.IO | Push notifications, live interactions, and lifecycle updates. |
| **Caching** | Redis | Session state, rate limiting, and API response caching. |
| **Auth** | Firebase + Custom JWT | Identity via Google/Firebase + internal HS256 JWT rotation. |
| **AI** | Anthropic (Claude 3.5) | Predictive styling, condition assessment, and upcycling. |
| **Storage** | Cloudinary | Globally distributed image hosting and optimization. |
| **Payments** | Stripe | Secure marketplace transactions and subscriptions. |

---

## 👗 2. Garment Lifecycle Optimization Engine (LOE)

The LOE is the system's "brain," managing how garments transition through different states to ensure maximum circulation.

### A. Garment State Machine
Every garment follows a high-level state flow:
1.  **LISTED**: Initial state. Available for sale/rent.
2.  **INTEREST**: Triggered when users engage with the item (Save, Wishlist, multiple views).
3.  **BUY_INTENT / SELL_INTENT**: High-signal states where a transaction is likely.
4.  **OWNERSHIP**: After purchase, the item is moved to the buyer's virtual wardrobe.
5.  **CIRCULATION**: The item is back in the market for swapping or re-selling.
6.  **REUSE / UPCYCLE / RECYCLE**: The "End of Life" (EOL) phase managed by AI assessment.

### B. Saturation Detection Logic
To prevent "feed fatigue," the system tracks how many times a user sees an item without acting on it.
*   **Formula**: `SaturationScore = (0.3 × R / MAX_R) + (1 - ER) + (0.3 × Decay)`
    *   `R`: Recent Event Count (views/saves in last 7 days).
    *   `ER`: Engagement Rate (Positive interactions / total views).
    *   `Decay`: Time since last positive interaction (normalized).
*   **Threshold**: If `SaturationScore > 0.7`, the garment is suppressed (hidden) from that user's feed for a cooldown period (7+ days).

---

## 🧠 3. Personalization & Behavior Engine

### A. Style Vector Algorithm
Every user and garment is represented by a 64-dimensional **Style Vector**.
*   **Generation**: On creation, Anthropic's API analyzes garment attributes (brand, fabric, cut, "vibe") and maps them to a normalized float array.
*   **Matching**: The system uses **Cosine Similarity** to compare User Vectors and Garment Vectors.
*   **Formula**: `Similarity Score = (A · B) / (||A|| * ||B||)`
    *   Result ranges from `0` to `1` (e.g., `0.98` = 98% aesthetic match).

### B. Interest Scoring
Individual user signals are weighted to dynamically adjust their personal feed:
*   **VIEW**: +0.05
*   **SAVE / WISHLIST**: +0.20
*   **ADD_TO_CART**: +0.50
*   **Score Decay**: Scores decrease by `-0.02` per day of inactivity to ensure the feed stays fresh.

---

## 🌍 4. Circular Impact Formulas

Kaphor Quantifies the environmental benefit of every transaction.

### A. Carbon & Water Savings
When an item is purchased second-hand or upcycled instead of bought new, the system credits the user with saved resources:
*   **Carbon Saved (Kg)** = `Base_Material_CO2_Cost` × `Circulation_Multiplier`
*   **Water Saved (L)** = `Base_Material_Water_Usage` × `Circulation_Multiplier`
    *   *Example*: A luxury cotton trench coat (~25kg CO2 / 2,700L water) sold second-hand saves ~20kg CO2 and 2,500L water (accounting for dry cleaning/shipping impact).

### B. Tree Equivalency
To make data relatable:
*   `Trees_Saved = Math.floor(Total_Carbon_Saved / 22)`
    *   *(Assumes an average mature tree absorbs ~22kg of CO2 per year).*

---

## 🤖 5. Artificial Intelligence (AI) Features

### A. Condition Assessment Expert
When a user wants to recycle or upcycle, they upload images for a "Condition Check":
1.  Images are passed to Claude 3.5.
2.  AI returns a structured JSON assessing:
    *   **Physical Integrity**: Tears, stains, fading.
    *   **Recyclable Fiber %**: Suitability for industrial recycling.
    *   **Recommended Action**: RE_SELL, UPCYCLE, or RECYCLE.

### B. Upcycling Suggestion Engine
For items in `MINOR_WEAR` or `UPCYCLE` condition, the AI generates 3 specific transformations:
*   **Input**: Brand, Material, Current Damage.
*   **Output**: Title, Difficulty (Beginner/Expert), Materials Needed, and Estimated Time.
    *   *Example*: "Transform faded luxury denim into a bespoke structured tote bag."

---

## 🛡️ 6. Security & Infrastructure

*   **JWT Rotation**: Kaphor uses HS256 JWTs with a short-lived `accessToken` (15m) and a persistent [refreshToken](file:///c:/Users/Insiyah/Kaphor/kaphor/backend/src/controllers/auth.controller.ts#301-359) (7d).
*   **Database Constraints**: Prisma ensures referential integrity for complex relations (e.g., specific `SwapInitiator` and `SwapReceiver` links).
*   **Audit Logging**: Every sensitive action (auth, large payments, state changes) is recorded in an [AuditLog](file:///c:/Users/Insiyah/Kaphor/kaphor/backend/src/services/audit.service.ts#5-12) table with IP and UserAgent for security tracking.
