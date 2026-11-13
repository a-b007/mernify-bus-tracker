# UI/UX rules (apply to everything in /client)

Source of truth: `@../../DESIGN.md`. Read the relevant sections **before** writing UI. If a request conflicts with it, say so and propose a DESIGN.md update instead of silently deviating.

## The product flow (don't break it)
welcome → locate (on tap only) → nearby buses + "Where to?" → filter by destination or stop → select bus → "Notify me" → tracking bar → arriving alert. Every step has loading, empty and error states and one clear next action. Implement as the `journey` state machine in Zustand.

## Visual rules
- **Tokens only.** All colour, radius, shadow, spacing and motion values come from `client/src/styles/tokens.css`. No hard-coded hex or magic px in components. (The map style files are the only other place colours live.)
- Font is **Inter Variable**, self-hosted. Weights 400/500/600 only. Tabular numerals on every changing number. Mobile inputs are 16 px.
- Layout follows Felt: full-bleed map, floating compact panels, hairline borders, left-aligned. Desktop: one 384 px panel top-left. Mobile: bottom sheet (peek / half / full).
- The **route chip** is the signature element. Build it once, reuse it in lists, detail, tracking bar and map labels.
- One icon family (Phosphor, regular). No emoji.
- Colour carries meaning: teal = primary/actions, saffron = *your* bus / arriving, red = disruption. Never rely on colour alone.

## Make it not look AI-generated
Do not use: gradients (except map data ramps), glassmorphism/backdrop blur, glow, large soft shadows, gradient text, centred hero sections, three-identical-cards rows, uniform `rounded-2xl shadow-xl`, unmodified shadcn defaults, stock illustrations, lorem ipsum, "Welcome to…" copy. Use real Bengaluru place names and plain words ("running 3 min late", not "delay: 180s").

## Smoothness (top priority)
- Bus positions live in a mutable store outside React. **Never put positions or per-tick data in React state.** One rAF loop updates the MapLibre GeoJSON source.
- Render buses ~2 s in the past and interpolate between updates. No teleporting. Interpolate heading by shortest angle.
- Camera moves use `flyTo`/`easeTo` with `setPadding` so targets are centred in the visible (non-panel) area. Pause follow-mode when the user touches the map.
- Re-sort bus lists at most every 5 s and never while the pointer is down/hovering. Stable keys, layout animations.
- Skeletons, not spinners. Reserve heights. No layout shift.
- Keep content on screen when the connection drops; show a quiet pill and data age.
- Honour `prefers-reduced-motion` (jump instead of fly, fades ≤ 100 ms).
- Lazy-load charts, non-default i18n catalogs and non-Latin fonts. Initial JS budget in DESIGN.md §8.

## Map rules
- 2D only (pitch 0, rotation off). Custom style from `style.light.json` / `style.dark.json`. Hide most POIs; keep bus/metro stations, airport, rail.
- Draw only the **selected** route line, never all routes. Filtered-out buses are removed via `setFilter`.
- Geolocation is requested only after a user tap. Handle denied, low accuracy and outside-Bengaluru.
- Attribution always visible. A persistent **Demo data** pill is always visible.

## Accessibility and i18n
- WCAG 2.2 AA. Use `--primary-700` and `--text-2` for text, not `--primary-600` / `--text-3`.
- Everything on the map is also reachable as a list. Full keyboard path. 2 px focus ring. `aria-live` only for the tracked bus.
- All user-facing strings go through `react-i18next` (EN / ಕನ್ನಡ / हिन्दी). No sentence concatenation.

## Verify before saying "done"
1. Run the dev server and drive the flow with the **browser agent**.
2. Capture screenshots at 390×844, 768×1024, 1440×900, light and dark, for each state you touched (including loading/empty/error). Save to `/docs/screens/`.
3. Check there is no React re-render per bus tick.
4. Run `axe` via Playwright. Fix violations.
5. Compare against DESIGN.md §13. List anything that doesn't match.
