---
name: creative-3d-web
description: Best practices, constraints, and architecture for building Awwwards-caliber interactive 3D websites using Three.js, React Three Fiber, Drei, and GSAP.
---

# Creative 3D Web & Immersive Experience Skill

Use this skill when building immersive, scroll-driven, Awwwards-style 3D storytelling websites (similar to Igloo.inc, Lusion, Apple product showcases, and Active Theory).

---

## 1. The Core Philosophy: "The World IS The Website"

- **No Canvas-in-a-Box**: Never build a standard HTML page that embeds 3D canvas cards in a grid.
- **Single Persistent WebGL Viewport**: The 3D canvas spans `fixed inset-0 w-screen h-screen` and never unmounts.
- **UI as a Transparent HUD**: HTML is styled as a non-blocking Heads-Up Display (`pointer-events-none`), with `pointer-events-auto` strictly applied only to interactive buttons and drawers.
- **Garment / Object as Protagonist**: The 3D model is the focal point of the story, not background decoration.

---

## 2. Model Positioning & Bounding Box Rules

### Rule 1: Always Use `<Center>`
Never rely on manual coordinate offsets for third-party GLTF/GLB models. Raw Blender/Sketchfab files frequently have root node translations (e.g. `translation: [0, 1.98, 0]`) that throw the model off-screen into the ceiling or floor.
```tsx
import { Center } from '@react-three/drei';

<Center>
  <primitive object={clonedScene} />
</Center>
```

### Rule 2: Automatic Scale Normalization
Compute bounding box dimensions and normalize so the primary object scales proportionally regardless of original modeling units:
```tsx
const box = new THREE.Box3().setFromObject(clone);
const size = new THREE.Vector3();
box.getSize(size);
const maxDim = Math.max(size.x, size.y, size.z);
const targetScale = maxDim > 0 ? 2.2 / maxDim : 1;
clone.scale.setScalar(targetScale);
```

---

## 3. Lighting & Contrast (Anti-Mud Rules)

### Rule 1: Never Use Pure `#000000` Pitch Black
Pure black absorbs all shadows and makes dark materials (denim, leather, dark metals) completely invisible.
- Use a **Studio Cyclorama Vignette**:
  ```css
  bg-[radial-gradient(circle_at_70%_45%,_rgba(45,49,58,0.75)_0%,_rgba(18,19,22,1)_70%)]
  ```

### Rule 2: Mandatory 3-Point + Rim Lighting Rig
- **Key Light**: High intensity directional or spotlight (`intensity: 2.5 - 3.5`) casting soft shadows.
- **Rim Light (Backlight)**: High intensity silvery or tinted light (`intensity: 2.5 - 3.0`) positioned behind and to the side of the model (`position: [-4, 3, -2]`). This carves out the silhouette and separates the 3D model from the background.
- **Fill / Bounce Light**: Warm under-light (`intensity: 1.0 - 1.5`) to illuminate the underside of garments.
- **Environment Map**: Always include `<Environment preset="city" />` or `"studio"` to give PBR materials glossy highlights and realistic fresnel reflections.

---

## 4. Interaction & Performance Guidelines

### 1. Direct Raycasting Drag-to-Rotate
Implement smooth inertia and damping rather than snapping:
```tsx
// In useFrame:
if (!isDragging.current) {
  groupRef.current.rotation.y += momentum.current.y;
  groupRef.current.rotation.x += momentum.current.x;
  momentum.current.y = THREE.MathUtils.lerp(momentum.current.y, 0.003, 0.05);
  momentum.current.x = THREE.MathUtils.lerp(momentum.current.x, 0, 0.05);
}
```

### 2. Never Mutate React State Inside `useFrame`
Directly mutate Three.js objects and references inside `useFrame`. Triggering React re-renders on every frame destroys 60 FPS performance.

### 3. Multiplying Inventory with `InstancedMesh`
When showing dozens or hundreds of items (e.g. infinite circular galaxy / racks), never load separate GLB meshes. Use Three.js `InstancedMesh` with an instanced matrix and instanced color buffer.

---

## 5. Public Open-Source References & Benchmarks
- **Awwwards SOTD Showcase**: [Igloo.inc](https://www.igloo.inc/) (by abeto & Bureaux).
- **GitHub Three.js Skills Packages**:
  - `alton47/threejs-skills`
  - `Impertio-Studio/Three.js-Claude-Skill-Package`
- **Bruno Simon**: Three.js Journey & Creative Web Architecture.
