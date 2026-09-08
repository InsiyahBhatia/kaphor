# SOP-10 — Frontend: All Screens
## Phases 14–18 of 22

**Prerequisite:** Backend phases 1–13 complete and validated. API running on :4000.  
**Estimated time:** 240 minutes

---

## DESIGN RULES — APPLY TO EVERY SCREEN

```
RULE F1: Background is ALWAYS Colors.bg (#0F0609). No exceptions.
RULE F2: Cards use Colors.bgCard (#1A0C10) background.
RULE F3: All headings use Cormorant Garamond font.
RULE F4: All body text uses DM Sans font.
RULE F5: Primary action button: Colors.crimson background, Colors.textPrimary text.
RULE F6: Every screen must handle: loading state, empty state, error state.
RULE F7: All images use expo-image with blurhash placeholder.
RULE F8: Touch targets minimum 44×44 px.
RULE F9: Safe area insets applied on every screen.
RULE F10: Keyboard avoidance on all screens with inputs.
```

---

## PHASE 14 — APP SHELL & NAVIGATION

### `app/_layout.tsx`
```
1. Load fonts: Cormorant Garamond (Regular, SemiBold, Bold, Italic), DM Sans (Regular, Medium, SemiBold), JetBrains Mono
2. Hide splash screen after fonts loaded
3. On mount: call authStore.restoreSession()
4. While restoring: show full-screen dark splash with KAPHOR logotype
5. After restore:
   - isAuthenticated && onboardingDone → router.replace('/(tabs)')
   - isAuthenticated && !onboardingDone → router.replace('/(auth)/style-quiz')
   - !isAuthenticated → router.replace('/(auth)/welcome')
6. Wrap everything in SafeAreaProvider and GestureHandlerRootView
```

### `app/(tabs)/_layout.tsx` — Bottom Tab Navigator
```
Tabs: Home | Shop | + (Circular) | Social | Profile

Tab bar style:
  background: Colors.bgCard
  border top: 1px Colors.border
  active tint: Colors.gold
  inactive tint: Colors.textMuted
  height: 60px

CENTER TAB (Circular):
  Custom circular button: 56px diameter, Colors.crimson background
  Elevated above tab bar with shadow
  Icon: recycle/loop icon in white
  On press: router.push('/circular')

Tab icons (feather icons from @expo/vector-icons):
  Home: 'home'  Shop: 'shopping-bag'  Social: 'users'  Profile: 'user'
```

---

## PHASE 15 — AUTH & ONBOARDING SCREENS

### `app/(auth)/welcome.tsx`
```
Layout:
  Full screen, no safe area padding at top
  Background: Colors.bg
  
  Hero area (top 60% of screen):
    Full-bleed editorial photograph (use local asset for now)
    Dark gradient overlay (bottom 40% of image, #0F0609 to transparent)
  
  Content area (bottom 40%):
    "KAPHOR" — Cormorant Garamond Bold, 48px, Colors.textPrimary, centered, letter-spacing: 6px
    Tagline: "Redefining the Garment Lifecycle" — DM Sans, 14px, Colors.textSecond, italic, centered
    
    Spacing: 32px
    
    "Start Your Cycle" button: full width, Colors.crimson bg, 52px height, 12px radius
    "Explore Collection" button: full width, outlined (1px Colors.border), 52px height, 12px radius, ivory text
    
    Spacing: 16px
    "Already have an account? Sign In" — small link text in Colors.gold
  
  Animation: fade-in everything on mount (Reanimated, 600ms)
```

### `app/(auth)/login.tsx`
```
Layout:
  Back button (top left)
  Title: "Welcome Back" in Cormorant Garamond, 32px
  Subtitle: "Sign into your account" in DM Sans, 14px, textMuted

Inputs (custom Input component):
  Email input: keyboard=email-address, autoCapitalize=none
  Password input: secureTextEntry=true with show/hide toggle

Below inputs:
  "Forgot Password?" — right-aligned, Colors.gold, 12px

Primary button: "Sign In" — full width, crimson

Bottom: "Don't have an account? Create one" with gold link

Error handling:
  Show toast notification for auth errors
  Clear password field on failed login
  Show remaining lockout time if rate limited

On success: authStore.login() handles navigation
```

### `app/(auth)/register.tsx`
```
Inputs: displayName, email, username, password
Password strength indicator bar below password input:
  Weak → red (only letters)
  Medium → orange (letters + numbers)
  Strong → green (letters + numbers + special)

Terms checkbox: "I agree to the Terms of Service and Privacy Policy" (gold link)

Button disabled until: all fields filled + terms checked + password strong
```

### `app/(auth)/style-quiz.tsx`
```
State: currentStep (0–9), answers (Record<string, any>)

Header:
  Progress bar: thin crimson bar, width = (step/10 * 100)%
  Step counter: "3 of 10" in textMuted

Content (varies per step type):

TYPE A — Visual Grid (step 1: Aesthetic, step 3: Colors):
  3×2 grid of image cards (120px height)
  Selected: crimson border + checkmark overlay
  Multi-select for colors

TYPE B — Pill Chips (step 2: Categories, step 8: Fabrics):
  Horizontal wrapping chips
  Selected chip: crimson background, white text
  Unselected: borderLight, textMuted

TYPE C — Large Chips (step 4: Fit):
  4 full-width cards, 72px height
  Selected: crimson left border + bg tint

TYPE D — Slider (step 7: Price, step 9: Frequency):
  Custom styled slider with crimson track and gold thumb
  Value label displayed above thumb

TYPE E — Scale (step 8: Sustainability):
  1–5 row of circular buttons
  Selected: crimson fill, numbers white

TYPE F — Tag Input (step 10: Brands):
  Text input that creates gold pill tags on Enter/comma
  Max 8 tags

Navigation:
  "Next →" button (crimson) — disabled until step answered
  "← Back" ghost button — not shown on step 0
  
  Animated slide transition between steps (Reanimated, 300ms)
  
On final step submit:
  Show loading overlay with "Analyzing your style..."
  POST /ai/style-quiz
  On success: router.replace('/(tabs)')
```

---

## PHASE 16 — SHOP SCREENS

### `app/(tabs)/shop.tsx`
```
Header:
  "KAPHOR" wordmark centered — Cormorant Garamond, 20px, gold
  Search bar below: "Search luxury vintage..." 
    Background: bgMuted, 12px radius, search icon left, mic icon right

Filter row (horizontal scroll, no scrollbar):
  "Filters" chip (with filter icon)
  "Category ▾", "Size ▾", "Material ▾", "Condition ▾" chips
  Active filters: crimson background chip with ✕

Section: "CURATED FOR YOU" label + "View All" right
  2-column masonry FlatList of GarmentCards
  Pull-to-refresh
  Footer: loading indicator when fetching next page

GarmentCard component:
  Full-bleed image (4:5 ratio, rounded 12px)
  Top-left: "{score}% FIT" badge — crimson pill, DM Sans Medium 10px
  Top-right: heart icon (outline → filled gold on save)
  Bottom overlay gradient (image → #0F0609, 40% height):
    Brand name: DM Sans 10px, textMuted, uppercase, tracking 1.5px
    Title: DM Sans Medium 13px, textPrimary
    Price: DM Sans SemiBold 14px, gold
  Tap: navigate to /shop/[id]
  Long press: quick save
```

### `app/shop/[id].tsx`
```
Header: absolute positioned, transparent
  Back button (floating, bgCard bg)
  Share button (floating, right)

Image carousel:
  Full width, 75% screen height
  Swipe horizontal
  Dot indicators below

Scrollable content:
  Section 1 — Product Info:
    Brand: DM Sans 11px, gold, uppercase, tracking 2px
    Title: Cormorant Garamond SemiBold, 28px, textPrimary
    Price: DM Sans SemiBold, 24px, textPrimary
    
    AI Fit Score card:
      "{score}% FIT" large crimson badge
      4 sub-scores below: Color Match | Style Match | Size | Occasion
      Each as labeled progress bar, crimson fill

    Condition badge: pill with color coding
    
  Section 2 — Description:
    Expandable (show 3 lines → "Show more")
    
  Section 3 — Details:
    Material chips, Size, Category
    Lifecycle state (subtle: S₁ LISTED badge, textMuted)

  Section 4 — Seller:
    Row: avatar + displayName + tier badge + location
    "Sold X items" stat
    Tap: navigate to seller profile

  Section 5 — Reviews:
    Star rating summary
    2 recent reviews
    "See all {n} reviews" link

Bottom bar (fixed):
  "SAVE" button (outlined, left) + "BUY NOW" button (crimson, right, flex:1)
  Above bar: "💚 Buying this saves ~8kg CO₂ and 2700L of water"
```

### `app/shop/sell.tsx` — 4-step wizard
```
Step indicator: 4 numbered circles at top, current = crimson, done = gold check

Step 1 — Photos:
  Photo grid: 8 slots, 2×4
  Tapping empty slot → ImagePicker (camera or gallery)
  Tapping filled slot → preview with delete option
  Drag-to-reorder: react-native-reanimated sortable list

Step 2 — Details:
  All fields from garment schema
  Category: bottom sheet picker with icons for each category
  Condition: 4 image cards with descriptions
  Style Tags: pill input (max 5)

Step 3 — Pricing:
  Listing type selector: 3 large cards (Sale / Rental / Accessory Swap)
  Sale: price input
  Rental: day price + week price inputs (both shown)
  Note below: "Kaphor takes 12% on sale. Rental: 8%."

Step 4 — Preview + Publish:
  Shows exactly how the listing will look in the feed
  "Publish Listing" button
  Success: confetti animation + "Your garment is now live" screen
```

### `app/shop/checkout/[orderId].tsx`
```
Order summary card:
  Garment image (small, left) + title + price
  Delivery estimate: "3–5 business days"

Shipping address:
  List of saved addresses (radio select)
  "+ Add New Address" → form modal

Payment:
  Stripe payment sheet (use @stripe/stripe-react-native)
  Show card brands accepted: Visa, MC, Amex

Total breakdown:
  Item: $XXX
  Shipping: $XX
  Platform fee (included in price): —
  Total: $XXX (crimson, bold)

"Place Order" button
  Loading: spinner + "Processing payment..."
  
On success: router.replace('/shop/order-confirmed')
```

---

## PHASE 17 — LIFECYCLE & CIRCULAR SCREENS

### `app/(tabs)/circular.tsx` → redirect to `/circular`

### `app/circular/index.tsx`
```
Header: "Circular Service" + subtitle "Close the loop on fashion waste"

Section 1 — Circular Progress Ring:
  Animated SVG ring (ProgressRing component)
  Centre: "75%" large number (recyclable fiber of last checked garment)
  Label: "Recyclable Fiber" below ring

Section 2 — Garment Condition Check:
  Title: "Check Your Garment"
  4 condition cards in 2×2 grid:
    Each: icon + label + short description
    PRISTINE (gold) / MINOR WEAR (green) / UPCYCLE (amber) / RECYCLE ONLY (muted)
  "Upload Photos for AI Assessment" button → /circular/condition-check

Section 3 — White Glove Pickup:
  "PREMIUM" badge
  Title: "White-Glove Collection Service"
  Date picker: calendar
  Time slot: morning / afternoon / evening chips
  Address selector
  "Schedule Circular Collection" crimson button

Section 4 — Verified Partners:
  Horizontal scroll of partner logo chips
  Renewcell / KaPhor Lab / EcoCer / Fibretrace

Bottom: impact preview card "Your contribution: ~5kg CO₂ saved"
```

### `app/impact/index.tsx`
```
Profile section:
  Avatar (80px) with tier badge overlay (bottom-right)
  displayName: Cormorant Garamond, 24px
  Tier label: "ELITE CIRCULAR MEMBER" uppercase gold label
  Join date: "Member since March 2024"

Carbon Offset hero section:
  Large number: "{carbonSavedKg} KG" — Cormorant Garamond 48px, textPrimary
  Label: "Carbon Offset" — DM Sans, textMuted
  Progress bar to next tier: crimson fill, borderLight track
  Next tier label: "32kg until Platinum"

Stats row (2 cards side by side):
  Water Saved: "{waterSavedL}L" + wave icon
  Items Circulated: "{count}" + cycle icon
  Both cards: bgCard background, gold numbers

Environmental equivalent card:
  Leaf icon
  "Your impact is equivalent to planting {trees} French Oaks"
  textSecond, italic

Milestone card:
  Crown icon (gold)
  Progress description
  "You are {n}kg away from {nextTier}"

On mount: animate all numbers counting up from 0 (Reanimated interpolation)
```

### `app/rental/index.tsx`
```
Hero: "The Heritage Rental Collection" — Cormorant Garamond, large, centered on dark image

Category tabs: Sarees | Lehengas | Sherwanis | Jewels
  Selected: gold underline + gold text

Filter chips: Banarasi Silk | Velvet | Zardosi | Hand-embroidered

Date picker section:
  "Reserve Your Dates" label
  Inline calendar (week view by default)
  Available dates: normal; Booked: strikethrough gray; Selected: crimson

Product grid: 2 columns
  GarmentCard variant with "₹XX/3 days" pricing
  "AVAILABLE NOW" badge (green) or "LAST PIECE" (amber)

On card tap: → /rental/[id]
```

### `app/swap/index.tsx`
```
Header note bar: "Swaps are available for accessories only — bags, jewellery, belts & scarves"

My Accessories section (horizontal scroll):
  Cards of user's ACCESSORY_SWAP listings
  "Tap to offer in a swap"

Available to Swap section (vertical grid):
  Other users' accessory listings with swap icon
  Tap: → /swap/[id] to initiate request

Incoming Requests section:
  List of pending swap requests where user is receiver
  Each: offered item → wanted item + "Accept" / "Decline" buttons
```

---

## PHASE 18 — SOCIAL, STUDIO & PROFILE SCREENS

### `app/(tabs)/social.tsx`
```
Stories row (horizontal scroll, 80px circles):
  First: user's own circle with "+" icon
  Others: followed users' avatars with username below
  Unviewed: gold ring border

Feed (FlatList):
  PostCard component:
    User header row: avatar (40px) | @username bold | CITY, COUNTRY muted | "···" menu right
    Full-width image (tap to expand full-screen)
    "SHOP LOOK" floating crimson button (bottom-right of image)
    Garment name overlay (bottom-left of image, gold label)
    Action row: ♥ {likes}  💬 {comments}  ↗ Share
    Caption: DM Sans 13px, {hashtags} gold colored
    "View all {n} comments" muted link
    Timestamp: "2 hours ago"
  
  PostCard tap interactions:
    Double-tap image: like animation (heart pop)
    ♥ button: toggleLike
    💬: navigate to post detail with keyboard open
    "SHOP LOOK": navigate to garment detail
```

### `app/studio/index.tsx`
```
Tab row: Tutorials | Services | Before & After

TUTORIALS tab:
  Featured video card (full width):
    Thumbnail with play button overlay
    Duration badge (top-right)
    "NEW RELEASE" badge (top-left, crimson)
    Title below: Cormorant Garamond, 18px
    Category label: DM Sans 10px, gold
  
  "TRANSFORMATIONS" horizontal scroll:
    Square before/after cards (150px)
    Split image: BEFORE | AFTER labels
  
  Grid: all tutorials
    Thumbnail | Title | Duration | Difficulty badge

SERVICES tab:
  "Bespoke Redesign Service" card:
    crimson background
    Title, description
    3-step process: numbered list
    "REQUEST CONSULTATION" outlined ivory button
  
  "Kaphor Circular Lab" card:
    Upcycling partnership info

BEFORE & AFTER tab:
  Full-width transformation cards
  Split-image layout
  Creator username + story caption
```

### `app/(tabs)/profile.tsx`
```
Cover image (top 35% height, tap to change)
Avatar: 80px circle, overlapping cover bottom edge
Tier badge: small pill overlay on avatar

displayName: Cormorant Garamond 24px
styleAesthetic label: gold uppercase
Join date + location

Stats row: 3 numbers
  Listings | Sold | Following | Followers
  Each: number bold, label muted below, tap → list screen

Tab row: Listings | Sold | Purchases | Reviews
  Each tab shows corresponding FlatList grid

Settings entry: gear icon top-right
  Settings screen includes:
    - Edit Profile (displayName, bio, avatar, location)
    - Notifications preferences (toggles)
    - Saved Addresses (list + add)
    - Payment Methods (Stripe cards, manage)
    - Privacy Settings
    - Change Password
    - Help & Support
    - Log Out (confirm dialog)
```

---

## PHASES 14–18 VALIDATION CHECKLIST

```
□ App launches to Welcome screen when unauthenticated
□ Welcome → Register → Style Quiz → Home tab flow works end-to-end
□ Welcome → Login → Home tab flow works
□ Style quiz all 10 steps work, data sent to API on completion
□ Shop feed loads garments with fit scores from API
□ GarmentCard shows fit badge, save heart, correct price
□ Garment detail shows all sections, carousel, seller profile, buy/save buttons
□ Sell flow: all 4 steps work, images upload, garment appears in feed after publish
□ Checkout: Stripe payment sheet appears, test card works
□ Circular screen: condition check upload + AI response displays
□ Impact screen: numbers animate on mount, correct values from API
□ Rental: date picker shows availability, booking flow works
□ Swap: only accessories shown, request/respond flow works
□ Social feed: loads posts, like toggle works, comments appear
□ Studio: tutorials grid, transformation cards, bespoke form submits
□ Profile: correct stats, listings grid, settings navigable
□ All screens handle loading, empty, and error states
□ Dark theme consistent across ALL screens (bg = #0F0609)
□ Fonts load correctly (Cormorant Garamond visible in headings)
```

**PROCEED TO SOP-11 only when all boxes are checked.**

---

*SOP-10 · Kaphor AI Agent Build Guide · v1.0*
