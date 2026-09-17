# Kaphor — Design System & Color Specification

## Brand Positioning

Circular fashion marketplace for India: buy/sell pre-loved designer pieces, occasion rentals, cashless swaps. Editorial-archive aesthetic (curated, premium, "authenticated luxury") aimed at a Gen Z audience raised on Depop/Vinted-style resale culture. Trust and provenance matter as much as style, since this is peer-to-peer.

## Strict 5-Role Color Palette

Each color has **exactly one job**. Do not reuse a color for a second meaning — that keeps the palette legible as the app grows.

| Color | Hex | Role / Single Job |
|---|---|---|
| **Cream** | `#F5F1E8` | Base / paper background surface |
| **Ink** | `#141414` | Text, structure, primary buttons, AI features (AI Advisor, Condition Scan) |
| **Crimson** | `#C81E2C` | Urgency / live states only (active nav tab, notification count, "ending soon") |
| **Emerald** | `#0F5C46` | Sustainability data only (CO₂ saved, water saved, circular impact metrics) |
| **Gold** | `#B8912F` | Status / prestige only (membership tier badges "Silver", "Gold" + "Curated Match" tags) |

---

## Rules & Principles

1. **Single Purpose Rule**: One color, one meaning. Never let two colors compete for the same "notice me" job.
2. **Text on Color Fills**: Text on any colored fill uses the darkest shade from that same family, never plain black or gray:
   - **Emerald Fill**: Text in `#072B20` (darkest emerald) or `#E6F4EF` (light emerald)
   - **Crimson Fill**: Text in `#5C0B12` (darkest crimson) or `#FCEBEF` (light crimson)
   - **Gold Fill**: Text in `#4A3A13` (darkest gold/mustard) or `#FDF9EE` (light gold)
   - **Ink Fill**: Text in `#F5F1E8` (Cream) or White
3. **Von Restorff Effect**: Reserve Crimson strictly for urgency/live states so it draws the eye when it appears.
4. **Social Currency**: Give the Emerald impact block high visual weight (live CO₂ and water stats).

---

## Typography

- **Display:** Bebas Neue (`BebasNeue_400Regular`) — headlines, wordmark
- **Mono:** IBM Plex Mono (`IBMPlexMono_400Regular`) — labels, metadata, tags
- **Body:** Humanist serif / readable sans for long-form text & bot responses

---

## Logo

- Crown-topped "K" mark signaling luxury/prestige for P2P resale trust.
