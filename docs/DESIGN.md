# KAPHOR — Visual Design System
## Editorial Fashion Illustration × Circular Fashion

Kaphor should feel like a premium fashion editorial that has been
hand-drawn and animated, while keeping all actual garment/product
photography completely REAL.

The design language combines:

- French fashion illustration
- Editorial magazine layouts
- Hand-drawn ink sketches
- Watercolor / gouache textures
- Vintage couture advertising
- Botanical/floral line art
- Fashion silhouettes
- Handwritten annotations
- Archival paper textures
- Modern luxury e-commerce UI

IMPORTANT:
PRODUCT/GARMENT IMAGES MUST REMAIN REAL PHOTOGRAPHS.
Do NOT cartoonize, watercolorize, trace, or AI-redraw product photos.

--------------------------------------------------
1. CORE VISUAL PRINCIPLE
--------------------------------------------------

Kaphor =

REAL CLOTHING PHOTOGRAPHY
+
HAND-DRAWN EDITORIAL ILLUSTRATIONS
+
ARCHIVAL PAPER UI
+
MODERN COMMERCE COMPONENTS

The illustration layer should decorate and frame the interface,
not replace the real products.

Example:

        ✿ hand-drawn flower
             |
   ┌──────────────────┐
   │                  │
   │ REAL GARMENT     │
   │ PHOTOGRAPH       │
   │                  │
   └──────────────────┘
        handwritten
        annotation

--------------------------------------------------
2. COLOR PALETTE
--------------------------------------------------

Primary background:

--paper: #F5F0E6
--paper-light: #FAF7F0
--paper-dark: #E8DFD1

Ink:

--ink: #171717
--ink-soft: #4B4843

Fashion accents:

--rose: #A82222
--dusty-rose: #B83A3A
--blush: #C9614F
--mauve: #8C3B3B

Sustainability:

--forest: #176451
--sage: #819B83

Luxury:

--gold: #B89A3E

Product cards should primarily use:
cream + black + real photography.

Red/rose should be used sparingly for active states,
notifications and important CTAs.

--------------------------------------------------
3. TYPOGRAPHY
--------------------------------------------------

Use three typography roles.

DISPLAY / EDITORIAL:

A high-contrast fashion serif.

Examples:
- Cormorant Garamond
- Playfair Display
- Libre Baskerville

HEADINGS:

Condensed editorial sans.

Examples:
- Bebas Neue
- Oswald
- Archivo Narrow

BODY:

Readable serif or neutral sans.

Examples:
- DM Sans
- Inter
- Source Sans 3

ANNOTATIONS:

Handwritten/script font.

Examples:
- Caveat
- Cormorant Italic
- handwritten SVG text

Do NOT use a handwritten font everywhere.

Handwritten typography should appear as:
- annotations
- fashion notes
- small editorial labels
- decorative captions

--------------------------------------------------
4. ILLUSTRATION STYLE
--------------------------------------------------

Illustrations should look HAND-DRAWN.

Characteristics:

- thin imperfect black ink outlines
- slightly irregular line weight
- minimal shading
- watercolor-like fills
- muted pastel colors
- visible paper texture
- simplified facial features
- elongated fashion proportions
- elegant poses
- flowing dresses
- ribbons
- flowers
- leaves
- architectural sketches
- sewing tools
- scissors
- thread
- bows
- hangers

Avoid:

- photorealistic illustrations
- 3D cartoon characters
- glossy vector graphics
- generic corporate illustrations
- anime aesthetics
- overly saturated colors
- perfect geometric SVG shapes

The illustration should feel like it was drawn by a fashion
illustrator with ink and watercolor.

--------------------------------------------------
5. HOW ILLUSTRATIONS SHOULD BE IMPLEMENTED
--------------------------------------------------

Do NOT create every illustration using CSS.

Use SVG assets.

Preferred structure:

/public
  /illustrations
    /floral
      flower-01.svg
      flower-02.svg
      branch-01.svg
      leaves-01.svg

    /fashion
      woman-dress.svg
      woman-standing.svg
      woman-shopping.svg
      woman-rental.svg

    /decorative
      ribbon.svg
      scissors.svg
      hanger.svg
      thread.svg
      bow.svg
      sewing-machine.svg

    /architecture
      paris-building.svg
      staircase.svg
      balcony.svg

SVG illustrations must support:

- transparent backgrounds
- scalable dimensions
- recoloring where appropriate
- subtle rotation
- animation
- layering

--------------------------------------------------
6. ILLUSTRATION COMPOSITION
--------------------------------------------------

Illustrations should NEVER completely cover the interface.

Use them as editorial framing.

Examples:

HOME:

       flower branch
             \
              \
    ┌─────────────────────┐
    │                     │
    │   CIRCULAR          │
    │   FASHION           │
    │   LIVES LONGER      │
    │                     │
    │      [illustrated   │
    │       fashion       │
    │       figure]       │
    │                     │
    └─────────────────────┘
             /
       ribbon

ARCHIVE:

Flowers around corners.

Small architectural sketch behind heading.

Handwritten annotation:

"pre-loved pieces,
new beginnings."

PRODUCT GRID:

REAL PRODUCT PHOTOS

+
small hand-drawn flowers around the card edges.

--------------------------------------------------
7. REAL PRODUCT PHOTOGRAPHY
--------------------------------------------------

This is CRITICAL.

Garment images must remain untouched.

Do not:

- apply filters
- cartoonize
- convert to watercolor
- generate replacement garments
- alter garment colors
- replace the background automatically

Use the original product image.

The editorial styling should exist OUTSIDE the photograph.

Example:

[hand-drawn flower]

┌────────────────────┐
│                    │
│ REAL PRODUCT PHOTO │
│                    │
└────────────────────┘

"ARCHIVAL PIECE"
₹1,200

--------------------------------------------------
8. HOME SCREEN
--------------------------------------------------

Hero section:

Editorial fashion illustration.

Headline:

CIRCULAR
FASHION
LIVES LONGER

Subheading:

Buy, sell, swap & rent
pre-loved fashion with
zero retail waste.

CTA:

EXPLORE ARCHIVE →

Background:

warm paper texture.

Decorations:

- illustrated woman
- Parisian architectural sketch
- flowing ribbon
- botanical flowers
- handwritten annotations

Below hero:

BUY & SELL
RENTALS
SWAP
DIGITAL ATELIER

These should look like small editorial tiles.

--------------------------------------------------
9. ARCHIVE / SHOP
--------------------------------------------------

Header:

THE ARCHIVE

Subtitle:

Pre-loved pieces,
new beginnings.

Decorations:

- flowers
- ribbon
- handwritten notes
- architectural line drawings

Product cards:

REAL PHOTOGRAPH

+
cream information panel.

Example:

┌────────────────────┐
│                    │
│  REAL GARMENT      │
│  PHOTOGRAPH        │
│                    │
├────────────────────┤
│ PRISTINE           │
│ Dhawal Men's Kurta │
│ ₹80        -39%    │
└────────────────────┘

Do not turn the garment itself into an illustration.

--------------------------------------------------
10. RENTAL SCREEN
--------------------------------------------------

Editorial title:

RENTALS

SHORT-TERM LEASING // OCCASION WEAR

Decorative illustration:

fashion woman wearing an elegant dress,
drawn in ink/watercolor.

Behind her:

light architectural sketch.

Products remain REAL.

--------------------------------------------------
11. SWAP SCREEN
--------------------------------------------------

Title:

SWAP

Subtitle:

PEER-TO-PEER EXCHANGE

Use a hand-drawn illustration of:

two women exchanging a garment.

Keep illustration in the HERO AREA.

Below:

real product cards.

--------------------------------------------------
12. UPCYCLE STUDIO
--------------------------------------------------

This section can use the strongest illustration language.

Hero illustration:

old garment → scissors → thread → new garment

Use:

- sewing machine illustration
- scissors
- fabric swatches
- denim scraps
- thread
- bows
- flowers
- hand-drawn arrows

Example annotation:

"Old garments,
new possibilities."

Product/tutorial thumbnails remain REAL PHOTOGRAPHS.

--------------------------------------------------
13. PROFILE / CURATOR ATELIER
--------------------------------------------------

Keep this more restrained.

Use:

cream paper
+
black ink
+
small botanical illustrations.

Style dossier:

ACUBI

Verified

Subversive Korean streetwear,
muted earth tones &
cyber-minimalism.

The actual moodboard photographs remain real.

Decorative illustrations can appear around the moodboard.

--------------------------------------------------
14. AI STYLIST / THE DECK
--------------------------------------------------

This should feel like an editorial fashion desk.

Header:

THE DECK

AI STYLIST

Search:

> QUERY_DATABASE

Real product cards.

AI-generated recommendations should be displayed as
editorial notes.

Example:

"Try this with your oversized
black cargo trousers."

Small hand-drawn arrows can point toward products.

--------------------------------------------------
15. MICRO-INTERACTIONS
--------------------------------------------------

Animations should feel like paper/fashion editorial animation.

Use:

- ribbon gently moving
- flowers swaying
- handwritten underline drawing itself
- ink appearing gradually
- cards sliding like magazine pages
- subtle paper grain movement
- illustration parallax
- gentle floating particles

Avoid:

- excessive bounce
- neon animations
- glassmorphism
- aggressive gradients
- generic SaaS transitions

Animation duration:

150–500ms for UI.

800–2000ms for editorial illustration animation.

--------------------------------------------------
16. PAGE TRANSITIONS
--------------------------------------------------

Pages should feel like turning pages of a fashion magazine.

Possible transition:

paper texture
→ illustration appears
→ content slides into position.

Use subtle opacity + translate animations.

--------------------------------------------------
17. BOTTOM NAVIGATION
--------------------------------------------------

Keep the existing five sections:

HOME
SHOP
SWAP
RENTAL
PROFILE

Use:

cream background
thin black border
small icons
editorial typography.

Active state:

Kaphor red / rose.

Do not make navigation overly decorative.

--------------------------------------------------
18. AI / ILLUSTRATION ASSET PIPELINE
--------------------------------------------------

Claude Code should NOT attempt to generate complex fashion
illustrations directly in JSX.

Instead:

1. Generate illustration assets.
2. Save them as SVG/PNG/WebP.
3. Place them in /public/illustrations.
4. Build reusable React components around them.

Example:

<EditorialIllustration
  src="/illustrations/fashion/woman-dress.svg"
  className="hero-fashion-figure"
/>

Decorative components:

<FloralCorner />
<EditorialRibbon />
<FashionSketch />
<ParisSketch />
<HandwrittenNote />

--------------------------------------------------
19. REUSABLE COMPONENT SYSTEM
--------------------------------------------------

Create:

EditorialHero
EditorialCard
ProductCard
IllustrationLayer
FloralDecoration
FashionFigure
HandwrittenAnnotation
PaperSection
ArchiveHeader
EditorialButton
Moodboard
CircularImpactCard
MagazineDivider
IllustratedEmptyState

All pages must use these components.

--------------------------------------------------
20. RESPONSIVE DESIGN
--------------------------------------------------

Mobile-first.

The current Kaphor mobile UI should remain highly usable.

Illustrations must never:

- block buttons
- cover product information
- interfere with scrolling
- cover navigation
- reduce readability

Desktop can use larger editorial compositions.

Mobile should simplify the illustration layer.

--------------------------------------------------
21. VISUAL HIERARCHY
--------------------------------------------------

Priority order:

1. PRODUCT
2. ACTION / CTA
3. INFORMATION
4. ILLUSTRATION
5. DECORATION

The illustration should enhance the experience,
never compete with the product.

--------------------------------------------------
22. IMPORTANT RULE
--------------------------------------------------

KAPHOR IS NOT A CARTOON FASHION STORE.

It is a REAL circular-fashion marketplace presented
through the visual language of an illustrated fashion magazine.

REAL PRODUCTS.
REAL PEOPLE.
REAL PHOTOS.

ILLUSTRATED WORLD AROUND THEM.

That distinction must be preserved throughout the application.