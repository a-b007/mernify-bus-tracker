# Project rules (paste into the Antigravity rules file)
- Stack: Node 20 + Express + Socket.IO 4 + MongoDB native driver; React + Vite + MapLibre GL.
- Event contract lives in /docs/contract.md. Never change it without updating the doc and tests.
- Live state stays in memory; MongoDB writes are batched (bulkWrite/insertMany), never per event.
- Never broadcast full state: send deltas {rows:[[idx,lat,lng,speed,hdg,seq]]} to rooms only.
- Validate every input with zod. Never trust client or simulator-provided progressM.
- Do not put bus positions in React state; use the mutable store + requestAnimationFrame.
- No secrets in code. Read from process.env; update .env.example when adding variables.
- Every new module needs a small test (vitest/jest) and a README line.