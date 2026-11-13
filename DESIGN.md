# DESIGN.md — Bengaluru Bus Twin (rider app)

Working title: **Bus Twin** (rename freely). This file is the source of truth for the look, feel and flow of the rider-facing client in `/client`. If code and this file disagree, fix the code or update this file in the same change.

**Data disclosure:** live buses are simulated on real Bengaluru route geometry. The UI must say so (see §10).

---

## 1. Product goal and principles

A person who has just arrived in Bengaluru opens the app and, without reading anything, knows what to do: **tell us where you are → see buses near you → say where you're going → pick a bus → get told when it's close.**

1. **The map is the app.** Full-bleed map, small floating panels on top. No landing page, no marketing hero, no login wall. The first screen is the working product.
2. **One question at a time.** Each step asks one thing ("Where are you?", then "Where to?"). Everything else is hidden until needed.
3. **Answer, then detail.** Lead with the thing a rider needs: *which bus, how many minutes, how far to walk.* Reg. number, depot and speed are one tap deeper.
4. **Never surprise the user.** Nothing jumps, reorders under a finger, or teleports. Smoothness is a feature (see §8).
5. **Readable at a glance, outdoors, on a cheap phone, in one hand.**
6. **Honest.** Show data age, signal loss and simulated data plainly.

### Reference direction
- **Felt** → floating, compact, low-chrome panels over the map; thin borders; small precise type; a quiet legend; color reserved for data.
- **Google Maps** → map legibility at a glance: clear road hierarchy, few labels, obvious "you are here", search card top-left.
- **Not** Google Maps' blue/colour overload, and **not** a generic SaaS dashboard.

---

## 2. The core journey (states)

Implement as an explicit state machine (`journey` in the Zustand store): `welcome → locating → nearby → destination → busDetail → tracking → arriving → done | missed`. Every state must have loading, empty and error variants.

### S0 · Welcome (first open)
- Map is already visible, centred on Bengaluru (Majestic / Kempegowda Bus Station area) or the user's last location.
- A compact card (not a modal), anchored left on desktop, as the sheet on mobile:
  - Title: **"Where are you right now?"**
  - Primary button: **Use my location**
  - Secondary: **Search a place or bus stop**
  - Tertiary text link: **Just show me the map**
- Geolocation is requested **only after the tap**, never on page load.
- Persistent top-right pill: **Demo data** (opens a one-line explainer).

### S1 · Locating
- Button becomes a progress state ("Finding you…"), map stays interactive.
- Permission denied → inline message + "Search a place instead" + "Drop a pin on the map". Never a dead end.
- Accuracy worse than 200 m → show accuracy circle and "Not quite right? Drag the pin."
- Outside Bengaluru → "You seem to be outside Bengaluru. Showing Majestic instead." with a one-tap way to override.
- Remember the choice (localStorage), but always allow "Change location".

### S2 · Nearby ("what's around me")
- Camera flies to the user (zoom ≈ 15.5), with map padding so the user dot sits in the **visible** area, not under the panel.
- Show up to 5 stops within ~600 m, nearest first, and live buses on routes serving them.
- Panel:
  1. **"Where to?"** search field (always at top).
  2. Stops, each as a group header: stop name · walk time and distance (`4 min walk · 320 m`).
  3. Under each stop, bus rows sorted by **catchable ETA** (ETA minus walk time).
- Bus row: `[route chip] towards {destination}` · type badge · crowding · **ETA** right-aligned and large.
- A bus you cannot catch in time is shown muted with "Leaves before you arrive".
- Tapping a stop header focuses that stop (filter by stop).

### S3 · Destination
- The search field is **universal**: places, landmarks, stops, and route numbers (`335E`).
- Results grouped: Recent · Saved (Home, Work) · Places · Bus stops · Routes.
- On selecting a destination, the panel becomes **"Buses to {place}"**:
  - Direct buses first. Each row: route chip, "Board at {stop} · 4 min walk", ETA, "≈ 52 min ride", "Get off at {stop}".
  - No direct bus → say so, show nearest reachable stop, and (stretch goal) one-change options.
- **Filter bar** (horizontal chips, single row, scrolls): `At: Nearby ▾` / `{Stop name} ▾` · `AC` · `Non-AC` · `Electric` · `Not crowded` · `Within 10 min`.
  - Two ways to scope buses, as the product asked: **by destination** or **by stop**. Both live in the same bar; active filters are visible and one tap to clear.
- Map: destination pin, candidate stops, candidate buses only (others hidden).

### S4 · Bus detail
- Opens by tapping a row **or** a bus on the map (both routes lead to the same panel; selection is mirrored in both).
- Map: bus gets the tracked style, the route line draws, stops appear, the user's boarding stop and destination stop are emphasised, remaining path from bus to boarding stop is drawn heavier.
- Panel top to bottom:
  1. Route chip + "towards {destination}" + close/back.
  2. **Big ETA** ("4 min") + "3 stops away" + confidence (small, text, not a coloured badge only).
  3. A walking hint: **"Leave in 2 min to catch it."** / **"Leave now."** / **"You may miss this one."**
  4. Primary button: **Notify me when it's close**.
  5. Details (collapsed list): registration no., type, depot, crowding, next stop, "running 2 min late".
  6. Later stops with times (collapsed).

### S5 · Tracking and the alert
- After "Notify me": a 3-option picker appears inline (not a modal): **2 min · 5 min · 10 min before** (default: walk time + 1 min if the user is not yet at the stop, else 2 min). Ask for notification permission **here**, with a one-line reason.
- Panel collapses to a persistent **tracking bar** (route chip · ETA · stops-away rail). It stays while the user explores the map.
- Delivery: in-app banner + `navigator.vibrate` + Web Push if permitted + optional sound (off by default). Request a screen Wake Lock while the tab is open and tracking.
- Alert escalation (visual states of the tracking bar):
  | State | Trigger | Treatment |
  |---|---|---|
  | tracking | ETA > threshold | neutral surface |
  | approaching | ETA ≤ threshold | amber bar, "Arriving in 2 min · head to {stop}" |
  | arriving | ETA < 60 s | amber filled, large "Arriving now" |
  | done | bus passes stop | teal, "Your bus has reached {stop}" |
  | missed | passed and user not at stop | "Just missed it. Next 335E in 9 min" + **Track next** |
  | stale | no signal > 30 s | muted, "No signal for 40 s. Last seen near {stop}." |
  | disrupted | server alert (breakdown) | red-tinted, shows alternatives |
- Never block with a modal. Always give one clear next action.

### S6 · On the bus (phase 2, optional)
"I'm on this bus" → stops ahead + alert before the user's stop: "Get off at {stop} in 2 stops."

### Branches (same components, different entry)
| Who | Entry point | Notes |
|---|---|---|
| First-time visitor (default) | S0 | Plain words, landmark search ("Airport", "Majestic"), language switch visible. |
| Knows the bus number | Search `500D` | Shows all buses on that route + direction toggle; skips S2. |
| Commuter | Saved places | One-tap "Home → Work", recents, pinned routes. |
| Waiting at a stop | Tap a stop on map | Departure board view: all routes, next 3 each. |
| Poor network / offline | Automatic | Cached stops and routes; last known buses labelled with age. |
| Operator / admin | `/ops` (role-gated) | Denser, dark by default. Fleet health, alerts feed, fault injection, per-stop analytics (headway, hour-of-day). Same tokens and components. |

Rider-facing analytics are friendly summaries only (e.g. "Usually every 12 min. Busiest 8–10 am") shown in the stop panel. Full charts live in `/ops` or an analytics drawer.

---

## 3. Layout

| Breakpoint | Layout |
|---|---|
| **≥ 1024 px** | Full-bleed map. One floating panel, top-left, `384 px` wide, `12 px` from edges, max-height `calc(100dvh − 24px)`, scrolls internally. Bus detail replaces panel content (drill-in with back), never opens a second competing panel. Map controls bottom-right. Top-right: language, theme, Demo-data pill. |
| **640–1023 px** | Same, panel `340 px`. |
| **< 640 px** | Bottom sheet with 3 snap points: **peek** (~112 px, search visible), **half** (50 dvh), **full** (`100dvh − 56px`). Map controls float above the sheet and fade at full. Respect `env(safe-area-inset-*)`. Primary actions sit in the thumb zone. |

Always call `map.setPadding()` / `easeTo({padding})` so camera targets are centred in the **unobscured** part of the map.

Panel anatomy (Felt-like): 1 px border, soft shadow, 12 px radius, header row (title + small icon actions), body, optional sticky footer for the primary action. No cards inside cards: use dividers and spacing.

Top-left of the map on desktop has no toolbar. There is no navbar. Brand is a small wordmark inside the panel header.

---

## 4. Colour

Starting palette (from the brief): `#E9EDE3` `#80A48D` `#45796D` `#6B7887` `#1E2229`. It is a good calm base. Three changes for usability:

1. **Teal `#45796D` fails 4.5:1 as small text on paper** (≈ 4.2:1). It stays as a **fill** (white text on it is ≈ 5:1). For text and links use the darker `--primary-700 #2F6358` (≈ 5.8:1 on paper).
2. **Slate `#6B7887` fails 4.5:1 as body text** (≈ 3.8:1). Use only for icons, dividers, large text. Secondary text uses `#4F5A66`.
3. **Added one warm accent, saffron `#D98E2B`**, reserved for "this is your bus / arriving now". A transit app needs one colour that means *look here*; green-on-green can't do that.

Colour is semantic, not decorative. Never use colour as the only signal (add icon or text).

```css
/* client/src/styles/tokens.css  — Tailwind v4 */
:root {
  /* Neutrals */
  --paper:        #E9EDE3;  /* app background, chip fill, hover */
  --surface:      #FAFBF7;  /* panels, sheets */
  --surface-2:    #F1F4EC;  /* sunken areas, inputs */
  --border:       #D3D9CC;
  --border-strong:#B8C0B0;
  --text:         #1E2229;
  --text-2:       #4F5A66;
  --text-3:       #6B7887;  /* icons, placeholders, disabled only */

  /* Brand */
  --primary-50:   #EDF3EE;
  --primary-100:  #DCE8E0;
  --primary-600:  #45796D;  /* fills (white text OK) */
  --primary-700:  #2F6358;  /* text, links, hover fill */
  --primary-800:  #244C44;  /* pressed */
  --sage-200:     #C5D6C9;
  --sage-400:     #80A48D;  /* secondary graphics, sparklines */

  /* Signal */
  --amber-500:    #D98E2B;  /* tracked bus, arriving. text on it: --text */
  --amber-100:    #F6E6C8;
  --red-600:      #B4493B;  /* disruption, missed. white text OK */
  --red-100:      #F3DAD5;
  --location:     #2D6CDF;  /* user location dot ONLY (convention newcomers know) */

  /* Radii: don't make everything the same */
  --r-sm: 6px;    /* route chips, badges */
  --r-md: 8px;    /* inputs, buttons */
  --r-lg: 12px;   /* panels, sheets */
  --r-pill: 999px;/* filter chips only */

  --shadow-panel: 0 1px 2px rgb(30 34 41 / .06), 0 4px 16px rgb(30 34 41 / .08);
  --shadow-sheet: 0 -2px 16px rgb(30 34 41 / .10);

  --ease-out: cubic-bezier(.2, 0, 0, 1);
  --ease-in-out: cubic-bezier(.4, 0, .2, 1);
  --dur-1: 100ms; --dur-2: 160ms; --dur-3: 240ms; --dur-4: 360ms;
}

[data-theme="dark"] {
  --paper:#14181D; --surface:#1E2229; --surface-2:#262C34;
  --border:#323A44; --border-strong:#46505C;
  --text:#E9EDE3; --text-2:#A9B3BC; --text-3:#7C8794;
  --primary-50:#1F2D2A; --primary-100:#26403A;
  --primary-600:#6FAE9E; /* fill: use --text-on-primary = #14181D */
  --primary-700:#6FAE9E; --primary-800:#8CC2B4;
  --amber-500:#E3A24A; --amber-100:#3A2E1A;
  --red-600:#D9695B;   --red-100:#3A2220;
  --location:#5B93F0;
  --shadow-panel: 0 1px 2px rgb(0 0 0 / .4), 0 4px 16px rgb(0 0 0 / .35);
}

@theme inline {
  --color-paper: var(--paper);       --color-surface: var(--surface);
  --color-surface-2: var(--surface-2); --color-border: var(--border);
  --color-text: var(--text);         --color-text-2: var(--text-2);
  --color-primary: var(--primary-600); --color-primary-text: var(--primary-700);
  --color-amber: var(--amber-500);   --color-danger: var(--red-600);
  --font-sans: "Inter Variable", "Noto Sans Kannada", "Noto Sans Devanagari", system-ui, sans-serif;
}
```

Set `data-theme` on `<html>` before first paint (tiny inline script: saved choice, else `prefers-color-scheme`). Light is the default and the hero theme; dark must be complete, not an afterthought, because the map style also switches (§6).

Crowding scale (always with icon + words): `Seats available` sage-400 · `Standing room` amber-500 · `Very crowded` red-600.

---

## 5. Typography, spacing, components

**Font: Inter**, self-hosted via `@fontsource-variable/inter` (latin subset, `font-display: swap`, preloaded; use a metric-matched fallback to avoid layout shift). Do not load from a CDN.

- Enable `font-feature-settings: "cv11" 1` (single-storey *a*: makes Inter feel less default).
- `font-variant-numeric: tabular-nums` on every number that changes: ETAs, times, distances, route chips.
- Weights: **400, 500, 600 only.** No bold 700+.
- Kannada and Hindi: lazy-load `Noto Sans Kannada` / `Noto Sans Devanagari` subsets only when that language is selected. Inter has no Kannada glyphs.

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Meta, badges, attributions |
| `text-sm` | 13 / 18 | Secondary rows, chips |
| `text-base` | 14 / 20 | Body (desktop). **16 px on mobile inputs** (prevents iOS zoom) |
| `text-md` | 16 / 24 | Row titles, buttons |
| `text-lg` | 20 / 28 | Panel titles, −0.01em |
| `text-xl` | 28 / 32 | Stop name headline, −0.02em |
| `eta` | 36 / 40, 600 | The ETA number. One per screen. |

Spacing is a 4 px grid. Panel padding 16. Row min-height 56 (64 on touch). Touch targets ≥ 44 × 44.

### Signature element: the route chip
Route numbers (`335E`, `500D`, `KIA-9`) are what a rider matches against the bus in front of them, so the chip is the visual identity.
- Height 24, min-width 44, padding 0 8, radius 6, `text-sm` 600, tabular, letter-spacing 0.02em.
- Default: ink background (`--text`), paper text. AC routes: `--primary-700` background. Electric: add a bolt glyph; AC: snowflake glyph. The glyph is always present, so colour is never the only cue.
- Tracked bus: 2 px amber ring around the chip, in lists and on the map label.

### Components to build (once, reuse everywhere)
`Panel`, `BottomSheet`, `SearchField` (combobox), `FilterChip`, `RouteChip`, `StopGroup`, `BusRow`, `EtaBlock`, `TrackingBar`, `Banner`, `Toast`, `Legend` (small Felt-style floating card: crowding scale + "You / Your bus / Other bus"), `MapControls` (zoom, locate me), `Skeleton`, `EmptyState`, `ConnectionPill`, `DemoDataPill`.

Buttons: primary (primary-600 fill, white text, 8 px radius, 44 px tall), secondary (surface-2 fill + border), ghost (text only). Max one primary button per panel. No full-width gradient CTAs.

Icons: **Phosphor (regular weight)**, 20 px in rows, 16 px in chips. One icon family only. Custom SVG for bus and stop glyphs. No emoji anywhere.

Elevation: 1 px `--border` + `--shadow-panel`. Nothing heavier. No glassmorphism, no backdrop-blur panels, no gradients (data ramps on the map excepted).

---

## 6. Map style (readable like Google Maps, calmer, no 3D)

2D only, pitch 0, rotation disabled by default (`dragRotate: false`, `touchZoomRotate` with rotation off). Use a custom MapLibre style JSON, built on a free-tier vector provider (OpenFreeMap / MapTiler / Stadia; not the public OSM tile server). Attribution always visible: OpenStreetMap contributors + provider. Keep the style in `client/src/map/style.light.json` and `style.dark.json`, generated from the tokens where possible.

**Hierarchy: the map shows only what a bus rider needs.**

| Layer | Light | Dark | Rule |
|---|---|---|---|
| Land | `#E9EDE3` | `#1B2026` | |
| Parks / green | `#D3E0CB` | `#1F2B27` | No icons, label only if large |
| Water | `#BCD4D9` | `#1F3038` | Slight cool tint so lakes read instantly |
| Buildings | `#DFE4D8` | `#222830` | Visible only z ≥ 16, no 3D extrusion |
| Minor roads | `#FFFFFF`, casing `#D5DBCF` | `#2C333C` | |
| Main roads | white, wider, casing `#C9D0C2` | `#343C46` | Labels along line |
| Highways / ORR | `#F4E7C3`, casing `#D9C9A0` | `#4A4132` | Shield-free, plain labels |
| Rail / Metro | thin `#9AA5B1` dashed | | Metro stations shown as small labelled markers: key landmarks for newcomers |
| Labels | text `#3E4853`, halo `#F4F6EF` 1.5 px | text `#AEB8C0`, halo `#14181D` | 2 sizes max per class |

- **POIs:** hide almost all. Keep: bus stations, metro stations, airport, railway station, major malls/hospitals/colleges (one icon style, no colour). This is a bus map, not a restaurant map.
- **Language:** labels use `coalesce(name:en, name)` by default; switch to `name:kn` when Kannada is selected. Hosted glyph font must cover the scripts used.
- **Zoom behaviour:**
  - `z < 11`: buses as 4 px dots, no stops.
  - `z 11–13`: buses 8 px.
  - `z ≥ 14`: stops appear (white circle, `--primary-600` 2 px ring).
  - `z ≥ 15`: route-number labels next to buses, names for nearby stops.
  - `z ≥ 16`: heading chevrons on buses.
- **Bus marker:** 14 px `--primary-600` dot with 2 px white ring and soft 1 px dark outline for contrast on white roads. Stale (> 30 s): 40% opacity.
- **Tracked bus:** 20 px, ink fill, white ring, amber halo (pulsing 2 s, off if reduced motion), route chip label always visible.
- **Filtered-out buses** are removed from the layer (via `setFilter`), not just faded. Clean view beats context.
- **Selected route line:** `--primary-600`, 5 px, white 2 px casing, rounded joins; remaining path to the user's stop `--amber-500` 3 px dashed → solid as the bus nears. Unselected routes are **never** drawn (80 lines of spaghetti helps nobody).
- **User location:** `--location` dot, white ring, accuracy circle at 12% alpha. Destination: ink pin with white glyph.
- Layer order bottom → top: base, route line, stops, destination, buses, tracked bus, user dot, labels for tracked items.
- Map controls: zoom +/−, locate-me, and nothing else by default. No compass, no layer switcher, no street view.

---

## 7. Content and copy

Plain, short, local. Written for someone new to the city, possibly not a native English speaker.

- Use "bus stop", "walk", "towards", "running late". Avoid "headway", "telemetry", "node", "dwell".
- Times: `4 min`, `Arriving`, `1 h 5 min`. Clock: `4:32 pm`. Distances: `320 m`, `1.4 km`. Time zone `Asia/Kolkata`.
- Real place names in all examples and empty states (Majestic, Indiranagar, Whitefield, Silk Board, the Airport). **No lorem ipsum, no "John Doe", no "Acme".**
- No marketing voice ("Seamlessly track…", "Unlock…", "Welcome to the future of…"). No exclamation marks. No sparkle icons or "AI" mentions.
- Empty and error states say what happened and what to do next:
  - "No buses to Whitefield from here right now. A stop 400 m away has 2 routes. Show it?"
  - "Can't find you. Search a place or drop a pin instead."
  - "Connection lost. Showing buses from 12 s ago." (with the age updating)
- Alert copy: `"335E is 2 min away. Head to Majestic Gate 3."`
- All strings through i18n (`react-i18next`, ICU plurals). English, ಕನ್ನಡ, हिन्दी. No string concatenation for sentences.

---

## 8. Motion and smoothness (UX priority #1)

Targets: **60 fps** during pan, zoom, sheet drag and bus movement. Interaction response < 100 ms. INP < 200 ms.

**Map and buses**
- Buses never teleport. Render positions **~2 s in the past** and interpolate linearly between the last two server updates (update interval is 2 s), so there is always a next point to move toward. Heading interpolates by shortest angle.
- Positions live in a mutable `Map` outside React. One rAF loop (4–5 fps for the map source is enough when zoomed out; 30–60 fps for the tracked bus only) updates the GeoJSON source. Never `setState` per tick.
- Camera: `flyTo` 900 ms for big jumps (`ease-out`), `easeTo` 300–400 ms for small ones. Follow-mode for the tracked bus uses `easeTo`, pauses the instant the user touches the map, and offers a "Recentre" button.
- Debounce `viewport:set` 300 ms. Subscribing/unsubscribing rooms must never visibly affect the map.

**UI**
- Durations: 100 (press) · 160 (small) · 240 (panels) · 360 (sheets, camera-coordinated). Easing: `--ease-out` for entering, `--ease-in-out` for moves, shorter for exits. Springs for the bottom sheet (`stiffness 380, damping 38`) with velocity-aware snapping.
- Panel drill-in: shared-element feel. The tapped row's route chip and ETA move into the detail header (`layout` animation) rather than a hard swap.
- **List stability:** bus rows have stable keys and animate reorders with a layout transition, but **re-sort at most once every 5 s** and **never while the pointer is down or hovering a row**. A row must not move away from a finger about to tap it.
- Numbers: update ETA only when it changes by ≥ 5 s or crosses a minute; digits cross-fade (120 ms) with tabular figures so nothing shifts width.
- Use **skeletons**, never full-panel spinners. Reserve heights to avoid layout shift.
- Optimistic UI: selecting a bus or stop updates the panel instantly from cached data, then refines.
- Hover effects only under `@media (hover: hover)`. Press = background tint in 80 ms, no bouncy scale.
- Connection: if the socket drops, keep everything on screen, show a quiet `ConnectionPill` ("Reconnecting…"), label data age. On reconnect: snapshot, then deltas (seq rule), no flash.
- `prefers-reduced-motion`: replace `flyTo` with `jumpTo`, transitions with ≤ 100 ms fades, stop the amber pulse.

**Loading and caching**
- Static data (stops, routes) cached in IndexedDB + service worker (stale-while-revalidate). The app opens usable on a second visit with no network.
- Budgets: first map paint + welcome card ≤ 2 s on throttled 4G / mid-range Android. Initial JS (excluding the MapLibre chunk) ≤ 250 KB gzip. Analytics/charts, i18n catalogs and fonts for non-default scripts are **lazy-loaded**.
- Installable PWA (`vite-plugin-pwa`), because push alerts and Wake Lock make it feel native.

---

## 9. Accessibility

- WCAG 2.2 AA: text contrast ≥ 4.5:1 (use `--primary-700` / `--text-2` for text), UI components ≥ 3:1.
- The map is not the only way in: every bus and stop on the map is also reachable as a list item. Full keyboard operation: `/` focuses search, arrow keys in lists, `Esc` goes back one state.
- Visible focus ring: 2 px `--primary-700`, 2 px offset, on every interactive element.
- Landmarks and labels: `role="search"`, `aria-live="polite"` only for the **tracked** bus status (not for every ETA tick), buttons have names, chips have `aria-pressed`.
- Respects 200% text zoom and `prefers-reduced-motion`. Don't convey crowding, AC/EV or status by colour alone.
- Touch targets ≥ 44 px. One-handed use: primary action in the bottom 40% of the screen on mobile.

---

## 10. Honesty and trust

- Persistent **Demo data** pill; tapping explains: "Bus positions are simulated on real routes and stops. This is a prototype."
- Show data age on tracked buses ("updated 3 s ago") when > 10 s.
- Show confidence in words ("Estimate may change") rather than a score.
- Credits: OpenStreetMap contributors, route data source and licence, tile provider (in the map attribution and an About sheet).

---

## 11. How to avoid an "AI-generated" look

Hard don'ts:
- Purple/blue-to-pink gradients, glowing blobs, gradient text, glass panels, big soft shadows.
- Centred hero + three identical feature cards + "Get started" CTA.
- Every element `rounded-2xl` with `shadow-xl`. Follow the radius table in §4.
- Default shadcn/Material look unchanged. Components must be restyled to these tokens.
- Emoji as icons, sparkle icons, mixed icon families, stock illustrations.
- Lorem ipsum, generic "User 1" data, vague copy.
- Over-animated entrances (staggered bounces on everything).

Do instead:
- Left-aligned, dense-but-calm layout like Felt: small type, hairline borders, generous map.
- The route chip as the recurring motif; tabular numerals; one strong number per screen.
- Real Bengaluru names, real units, real states (late, stale, missed).
- Colour only where it carries meaning; amber appears rarely, which is why it works.
- Restraint: if an element isn't helping someone catch a bus, remove it.

---

## 12. Libraries (decisions)

| Need | Use | Note |
|---|---|---|
| App | React + Vite + **TypeScript** | TS strongly recommended for the socket/event contract |
| Styling | **Tailwind CSS v4** + tokens above | Utilities map to tokens only |
| Primitives | **Radix UI** (unstyled) + `class-variance-authority` | Accessibility for free. Restyle fully. |
| Bottom sheet | **vaul** (or `@use-gesture/react` + `motion`) | Snap points + velocity |
| Animation | **motion** (Framer Motion) | `layout` and springs for UI only, not for the map |
| Map | **MapLibre GL JS**, used imperatively in a `useMap` hook | Not a React wrapper for the hot layers |
| Search combobox | **cmdk** or Downshift | Grouped results, keyboard friendly |
| UI state | **Zustand** | Journey state, filters, selection. **Not** bus positions. |
| Server state | **TanStack Query** | REST (stops, routes, bus details, stats) |
| Realtime | `socket.io-client` | Optional msgpack parser |
| Charts | **Recharts**, restyled with tokens | Lazy-loaded; `/ops` and stop drawer only |
| Icons | **Phosphor** | One family |
| i18n | **react-i18next** | EN / ಕನ್ನಡ / हिन्दी |
| Dates | `date-fns` + `date-fns-tz` | `Asia/Kolkata` |
| PWA | `vite-plugin-pwa` | Push, offline static data |
| Tests | **Vitest** + **Playwright** + `@axe-core/playwright` | Screenshots and a11y in CI |

---

## 13. Definition of done for any UI change

1. Uses tokens only (no hard-coded hex/px outside `tokens.css` and the map style).
2. Light and dark both checked.
3. Screenshots captured at **390×844**, **768×1024**, **1440×900** for each affected state, including loading, empty and error.
4. No React re-render per bus tick (React Profiler or render counter).
5. `axe` passes; keyboard-only path works; reduced-motion path works.
6. Copy follows §7; strings are in i18n.
7. Journey in §2 still works end to end: welcome → locate → nearby → destination → bus → alert.
