# Project rules: Bengaluru Bus Twin

Monorepo: `/simulator`, `/server`, `/client`, `/docs`. Open the **repo root** as the workspace.
Read before architecture work: `@../../docs/contract.md`. Read before UI work: `@../../DESIGN.md`.

## Stack
- Node 20, Express, Socket.IO 4, MongoDB native driver, zod, helmet, express-rate-limit, jsonwebtoken, bcrypt.
- Client: React + Vite + TypeScript, Tailwind v4, MapLibre GL JS, Zustand, TanStack Query, Radix UI, motion.
- Tests: Vitest (unit), Playwright + axe (UI). Every new module gets a small test and a README line.
- Ask before adding a new dependency. Prefer what is already installed.

## Data and honesty
- Live bus data is **simulated** on real routes/stops. Never scrape private BMTC endpoints.
- Never invent real-world facts (route numbers, stop names, coordinates). Use data from `/docs/data` or ask.
- The UI and README must state that live data is simulated.

## Realtime architecture (non-negotiable)
- Live state stays **in memory** on the server. MongoDB is for persistence, never in the hot path.
- Batch writes: `bulkWrite` / `insertMany` on timers (bus_state 10 s, positions 30 s, arrivals 5 s, roll-ups 60 s). **Never write per event.**
- Never broadcast full state. Send deltas `{batchSeq, t, rows:[[idx,lat,lng,speed,hdg,seq]]}` to rooms only (`cell:*`, `route:*`, `stop:*`).
- Per-bus `seq` is monotonic. Drop `seq <= lastSeq`. Clients apply the same rule when merging snapshot/history with live.
- Validate **every** input with zod (REST, ingest, socket events). Never trust device or client `progressM`; snap to the route polyline.
- Compute ETA only for stops that have subscribers. Emit `eta:update` only when it changes by 5 s or more.
- Alerts have cooldowns (see `/docs/contract.md`).
- TTL on `positions` (2 h), `arrivals` (48 h), `alerts` (3 d). Roll-ups are bounded and permanent.

## Security and config
- No secrets in code. Read `process.env`; update `.env.example` whenever a variable is added.
- Ingest requires an API key + per-key rate limit + max batch size. Admin routes require role `admin`. Sockets authenticate in the handshake (`io.use`).
- CORS allow-list, request size limits, helmet, rate-limit login.

## Working style
- Use **Planning mode** for anything touching ingest, sockets, ETA or data model. Write the plan, then wait for approval.
- Small, scoped tasks. One concern per change. Don't refactor unrelated files.
- Never change the event contract without updating `/docs/contract.md` and its tests in the same change.
- After a change: run tests, run the app, and report what you verified. Don't claim something works if you didn't run it.
- Measure, don't guess: performance claims need numbers saved in `/docs/perf`.
- Commit messages: imperative, one line, scope prefix (`server:`, `client:`, `sim:`, `docs:`).
