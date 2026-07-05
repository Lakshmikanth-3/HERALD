# HERALD — Project Report

**Built for the Lepton Agents Hackathon (Canteen × Circle × Arc)**
**Live demo:** https://lepton-blue.vercel.app (frontend only — see [Known Limitations](#known-limitations))
**Report generated:** 2026-07-05

---

## 1. Executive Summary

HERALD is an autonomous research agent with its own Circle-managed crypto wallet.
Given a topic, it runs a fully unattended loop: it discovers sources, pays a
fraction of a cent to read the ones worth reading (real x402 nanopayments on
Arc testnet), synthesizes what it learned into a short brief using Gemini, and
sells that brief to other agents through its own x402 paywall. The same
wallet is both the buyer (paying sources) and the seller (charging for
briefs) — a live, two-sided micro-economy, not a demo of one side of it.

Everything in this report reflects **real, verified behavior** — real Circle
wallets, real Arc-testnet settlement, real 1Claw-vaulted secrets, real Gemini
synthesis. Nowhere in the codebase is there a mocked payment, a fabricated
metric, or a simulated response standing in for a real integration. Where a
claim below is backed by a live test performed during development (a real
transaction hash, a real independent wallet purchase), it's called out
explicitly.

**Current live state** (at report time):
- 4 real briefs published
- 59 real payment records logged (real x402 settlements + skips)
- $0.1923 real testnet USDC moved through the system total
- Agent wallet: `0x1fc8b69f563d2f3fe54ca8a693921f53d11eab89`

---

## 2. What HERALD Actually Does

```
[Topic + Budget]
      │
      ▼
 1. DISCOVER   — checks free RSS feeds + its own paid article shelf
 2. SCORE      — rates each source 0–1 (relevance, freshness, domain trust)
 3. BUY        — pays $0.001–$0.003 via real x402 for sources above 0.5
 4. SYNTHESIZE — Gemini writes a short, sourced brief from what it bought
 5. PUBLISH    — locks the brief behind its own x402 paywall (~2× cost)
      │
      ▼
[Other agents' wallets can buy the brief — a real, separate purchase]
```

Runs on a `node-cron` schedule (every 4 hours) or on demand via
`POST /api/agent/run`.

---

## 3. Architecture

```
Next.js frontend (:3000)  ──HTTP──>  Express API (:3001)  <──>  Circle Gateway / Arc testnet
                                            │
                                     Agent scheduler (node-cron, every 4h)
                                     discover → score → buy → synthesize → publish
                                            │
                                    SQLite (data/herald.db) + SSE event bus
```

| Layer | Location | Role |
|---|---|---|
| Agent loop | `src/agent/` | discovery, scoring, x402 buying, Gemini synthesis, brief publishing, Circle wallet ops |
| API server | `src/server/` | Express routes; `routes/briefs.ts` and `routes/sources.ts` are real x402 gates (buy + sell side) |
| Frontend | `src/app/` | Landing page + Deploy / Economy / Library screens |
| UI primitives | `src/components/ui/`, `src/lib/utils.ts` | shadcn-style Button/Accordion, ported for the landing page |
| Shared | `src/shared/` | SQLite client, SSE event bus, shared types |

### Circle/Arc/1Claw stack

| Technology | Used for |
|---|---|
| Circle Developer-Controlled Wallets | Agent wallet + sources-treasury wallet provisioning |
| Circle Gateway (x402 batching) | Buy-side purchases and sell-side settlement, both real |
| Arc testnet | Settlement network for all USDC transfers |
| 1Claw vault | Runtime secret storage — keys never sit in `process.env` while the agent runs |
| TestMint | x402-gated testnet USDC faucet |
| Google Gemini | Brief synthesis (`gemini-flash-latest`) |

---

## 4. Real, Verified Capabilities (the receipts)

These aren't design claims — each was exercised live during development and
the result observed directly, not assumed:

- **Real x402 buy-side settlement.** The agent paid real x402 nanopayments
  for its own originally-authored paid articles (a genuine seller endpoint,
  `src/server/routes/sources.ts`), settling to a *separate* treasury wallet
  — proving it's a real payment to another party, not the agent paying
  itself.
- **Real x402 sell-side settlement, including third-party.** Not only does
  the sell-side gate return genuine HTTP 402s and verify real signatures —
  a fully independent third wallet was provisioned, funded via a real
  on-chain transfer, and used to complete a real, non-self-transfer brief
  purchase. Confirmed via the resulting brief's `revenue`/`purchases`
  incrementing and a payment record showing the distinct buyer address.
- **Real Circle Gateway deposits.** `POST /api/agent/deposit` executes a
  genuine on-chain approve + deposit pair; both steps return real
  transaction hashes.
- **Real synthesis.** Every published brief is written by Gemini from
  content the agent actually paid to read — not templated text.
- **Real integration test suite.** `npm run test` drives the whole loop
  against a live server and passes end to end (health → trigger cycle →
  verify brief → verify free preview → verify the x402 gate rejects an
  unpaid request).

---

## 5. UI / UX

The frontend was redesigned around an "Electric Lime" visual identity
(ported from a reference template, `electric-landing-page-template/`, which
is excluded from the actual app build):

- **New landing page** — real HERALD content throughout: the actual 5-step
  loop, real topic categories, real economics ($0.001–$0.003 spend /
  $0.03–$0.10 earn), a live Stats section that fetches real numbers from the
  API (not marketing copy), and a functional topic input that hands off to
  the real Deploy flow. Sections with no real backing content (demo videos,
  customer testimonials) were dropped rather than faked.
- **Reskinned dashboard** — Deploy, Economy, and Library keep their existing
  functionality untouched; only the accent color, nav, and primary buttons
  were updated to match the new identity.
- **Design system** — Tailwind v3 (not upgraded to v4) with shadcn-style
  semantic tokens layered in alongside HERALD's existing dashboard color
  variables; the Economy dashboard's spend/earn/agent/warning colors were
  deliberately kept separate from the new brand accent since they carry
  real meaning in the live feed.

---

## 6. Bugs Found and Fixed

Every item below was found through direct testing (not code review alone)
and confirmed fixed with a follow-up verification.

### Backend / agent

| Bug | Root cause | Fix |
|---|---|---|
| Synthesis provider mismatch | Code called Anthropic/Claude while docs and pitch said otherwise (and later, Anthropic account had no credit) | Standardized on Gemini; fully removed the Anthropic dependency, vault secret, and all references |
| `test-e2e.ts` false read | Read `health.status`, a field that doesn't exist on `/api/agent/status` | Read the real fields (`configured`, `isRunning`) |
| Buy-side never exercised in practice | Public RSS feeds are free and never return HTTP 402, so the real payment code path never fired | Built a genuine second x402 seller (original paid articles + a separate treasury wallet) so the buy path fires for real |
| Transient `fetch failed` errors | Stale keep-alive connections on the long-running dev process, observed live against 1Claw and Circle | Added bounded retry to `secrets.ts`, `wallet.ts`, and `discover.ts`'s self-referential fetch |
| 1Claw vault occasionally 402s | 1Claw's vault answers a secret read with its own x402 "payment required" challenge (real Base mainnet USDC), most likely a rate-limit mechanism; self-resolves within seconds | Retry the specific 402 case with backoff — **never** auto-constructs or sends a payment, since that would be real money on a different chain than this project's testnet economy |
| Dead "selling price per brief" slider | Value is saved to config but never read — the agent always prices briefs via `priceBrief()`'s cost-based formula | **Flagged, not fixed** — a design decision beyond scope; documented in the README |

### Frontend

| Bug | Root cause | Fix |
|---|---|---|
| `BriefPreview.tsx` crash on Economy | Component assumed the full paid `Brief` shape, but the page correctly fetches the free `/preview` endpoint's metadata-only shape | Added a proper `BriefMetadata` type matching what the API actually returns; fixed the field references |
| Mobile nav overflow | Shared `HeraldNav` didn't collapse below 768px, causing horizontal scroll on Economy/Library | Responsive CSS for the nav bar and a mobile grid-collapse rule for the Economy layout |
| Hydration mismatch warning | `useReducedMotion()` can resolve the real OS preference before the client's first paint settles, mismatching server-rendered HTML | A mount-guarded `useSafeReducedMotion()` hook, applied across all 7 landing components |
| Vercel production build failed | `next build` runs ESLint in production mode (dev mode doesn't); 8 real lint errors (unescaped JSX quotes, unused vars/imports, an explicit `any`) had never surfaced | Fixed all 8 properly rather than disabling the lint rule |
| `.next` corruption | Running `npm run build` while `npm run dev` was still active corrupted the dev server's build cache, breaking every page with `Cannot find module` | Cleared `.next` and restarted (documented as a gotcha in the README) |
| Negative dollar amounts rendered as `$-0.0369` | Three places hardcoded a literal `$` in front of a `.toFixed()` value that already carried its own sign | Fixed the sign/dollar ordering in `economy/page.tsx`, `BalanceCard.tsx`, `BriefPreview.tsx` |
| **Economy page grew unboundedly during a live agent cycle** | Root cause traced to `shared/events.ts`'s `emit()` calling `eventBus.emit(type, event)` *and* `eventBus.emit('*', event)` — verified directly against `eventemitter2` that the first call alone already reaches `'*'` subscribers, so every event was broadcast to the frontend **twice**, doubling the Live Feed's growth rate and causing a real React "duplicate key" warning | Removed the redundant emit call; also hardened the flex/grid layout with `min-height: 0` on every Economy zone (a real, independent flexbox gotcha where a `flex: 1; overflow-y: auto` child without `min-height: 0` grows to fit its content instead of scrolling) |
| FlowGraph canvas fills silently failing | Two `ctx.fillStyle` assignments used `var(--css-custom-property)`, which Canvas 2D cannot resolve (it's outside the DOM/CSS cascade) — the browser silently ignores invalid fill assignments | Replaced with literal hex values |

Deploy and Library were both re-checked against the same bug classes
(overflow, duplicate keys, unbounded growth during a live cycle) and found
clean — Library in particular is structurally immune since it doesn't
subscribe to SSE and replaces its state on each poll rather than appending.

---

## 7. Known Limitations

- **The Vercel deployment is frontend-only.** Vercel only runs serverless
  functions; HERALD's Express API needs a persistent process (a writable
  SQLite file, a 4-hour cron scheduler, long-lived SSE connections) that
  serverless functions can't provide. The deployed UI is fully public and
  navigable, but every API-backed feature (wallet balance, live feed,
  deploy, buy) only works if a backend is also reachable — currently that
  means running it locally on the same machine that's viewing the page.
- **The "selling price per brief" slider doesn't affect pricing** (see
  bug table above) — not yet reconciled with the dynamic pricing formula.
- **1Claw's vault occasionally demands a real-money x402 payment** as an
  apparent rate-limit fallback. The code retries automatically but will
  never pay it; if it persists past the retry window, wait and retry
  manually or check the 1Claw dashboard.
- **7 pre-existing `npm audit` vulnerabilities** in `next` /
  `eslint-config-next` / `postcss` (would require a Next.js 14→16 major
  version bump) and `ws` (a dependency of `viem`, underneath the live x402
  signing path). Not fixed — both fixes carry more risk than the
  vulnerabilities themselves warrant right now.
- **`docs/` folder** (architecture write-ups beyond this report and the
  README) doesn't exist. Not required for the app to function.

---

## 8. Setup & Deployment

Full step-by-step setup (env vars, wallet provisioning, vault seeding,
running locally) is in [`README.md`](./README.md). Quick reference:

```bash
npm install
cp .env.example .env.local        # fill in 1Claw / Circle / Gemini keys
npm run provision:wallet          # creates the agent's real Arc-testnet wallet
npm run seed:vault                # pushes secrets into the 1Claw vault
npm run provision:sources-wallet  # creates the real sources-treasury wallet
npm run seed:sources              # seeds real x402-gated content
npm run dev                       # frontend :3000 + API :3001
```

**Live demo:** https://lepton-blue.vercel.app (frontend only, see
[Known Limitations](#known-limitations))

---

## 9. Testing Summary

- `npm run test` (`scripts/test-e2e.ts`) — 6/6 passing against a live server.
- Playwright-driven checks across all 4 pages (`/`, `/deploy`, `/economy`,
  `/library`) at desktop and mobile widths — 0 console errors, 0 horizontal
  overflow, confirmed both statically and under a real live agent cycle.
- Manual real-money-rail tests: Gateway deposit (real tx hashes), buy-side
  x402 settlement, sell-side x402 settlement from an independently
  provisioned third-party wallet.

---

*HERALD — built on Circle, Arc, x402, 1Claw, and Gemini.*
