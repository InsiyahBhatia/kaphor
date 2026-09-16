# KAPHOR — Figma-ready template

Import the SVGs into Figma. They are vector-based, so text, lines, borders, buttons and shapes can be edited after import.

Frames:
00 Design System
01 Hero
02 AI Analysis
03 Digital Twin
04 Your Style
05 Swap
06 Buy / Discover
07 Sell
08 Rent
09 Accessories
10 Ecosystem
11 Final

3D implementation handoff:
- Hero: drag rotates the real GLB jacket; scroll controls the camera.
- Analysis: scan ring intersects the garment; defect marker is anchored in 3D.
- Digital Twin: real garment geometry transforms into particles → wireframe → digital twin.
- Style: click accessories to add/remove them from the outfit.
- Discover: click garments to focus camera and reveal product UI.
- Swap: garments/accessories physically travel between two wardrobes.
- Sell: garment travels through upload → AI analysis → value → listing.
- Rent: select garment → camera focus → rental UI.
- Ecosystem: use InstancedMesh for repeated garments.
- Final: all objects converge around Kaphor.

Recommended implementation: React + TypeScript + React Three Fiber + Three.js + Drei + GSAP/ScrollTrigger.
