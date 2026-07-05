# HERALD — Project Report

**Built for the Lepton Agents Hackathon (Canteen × Circle × Arc)**
**Live demo:** https://lepton-blue.vercel.app (frontend only — see [Known Limitations](#known-limitations))
**Report generated:** 2026-07-06

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

**Current live state** (pulled live from the running API at report time):
- **9 real briefs published**, 21 real third-party purchases across them
- **378 real payment records** logged (x402 settlements, deposits, and
  scored-but-skipped sources)
- **$0.9481** real testnet USDC earned from brief sales, **$0.2347** spent
  buying sources, **$0.027** in direct paid-article sales — all real Arc
  testnet movement, not simulated
- **50 sources purchased** via real x402 nanopayments
- Agent wallet: `0x1fc8b69f563d2f3fe54ca8a693921f53d11eab89` — currently
  holding **$7.87 USDC** real testnet balance
- This is a live, growing ledger — rerun `curl http://localhost:3001/api/agent/network-stats`
  against a running instance to get the current numbers; don't treat the
  figures above as static.

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
| Frontend | `src/app/` | Landing page + Deploy / Economy / Library / Network / How-it-works screens |
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
- **A new "How it works" page** (`/how-it-works`) — a plain-language walk
  through the 5-step loop, a real explanation of x402, and a "Verify it's
  real" panel that pulls live chain-info from the API (agent wallet,
  sources-treasury wallet, USDC contract, Gateway contract — each with a
  copy button and a real explorer link) plus a copyable `curl` command that
  reproduces a genuine HTTP 402 challenge against the most recently
  published brief.
- **Motion pass, added this session** — every number that represents real
  money or a real count (wallet balance, spent/earned/net, brief revenue,
  Network page stat tiles, Library's total revenue) now counts up from its
  previous value with an eased `requestAnimationFrame` animation instead of
  snapping; the Economy sparkline draws itself in along its real measured
  path length (`getTotalLength()`) rather than appearing instantly; cards
  and list rows across Economy, Network, Library, Deploy, and How-it-works
  stagger in on load. All of it is gated behind the existing
  `useSafeReducedMotion()` hook, so `prefers-reduced-motion` users see the
  final state immediately with no animation.

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
| "Selling price per brief" slider was saved but never read | The agent always priced briefs via `priceBrief()`'s cost-based formula alone | Wired the saved value in as a real price *floor* — `priceBrief(cost, sources, floorUsd)` now returns `max(floorUsd, 2× cost + log(sources) bonus)`, clamped to $0.01–$0.20 (`src/agent/synthesize.ts`, `src/agent/publish.ts`) |

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

### Round 2 — found by actually using the deployed app, not just testing it

A second pass of bugs surfaced by driving the real app in a browser as a
judge or user would, rather than through automated checks alone:

| Bug | Root cause | Fix |
|---|---|---|
| Economy page cards overlapping on load | A `height: 100vh` flex column had the growing Cycle History list appended as a flex *sibling* instead of living below the fold — it got squeezed/overlapped instead of letting the page scroll | Split into a fixed-height `.economy-dashboard` section (nav + stepper + grid) and a separate scrollable section below it for Cycle History; added an automated overlap-detection Playwright check (`scripts/test-playwright.ts`) that measures real `getBoundingClientRect()` overlap between cards so this can't silently regress |
| Off-topic queries produced irrelevant briefs (e.g. "trading" not recognized as finance) | `detectCategory()` matched whole words only (`/trade/`), which never matches "trading" | Rewrote the category patterns as word-stems (`financ\|market\|stock\|econom\|trad\|invest`, etc.) across every topic category |
| Agent Flow graph on the Economy page stayed permanently empty despite real history existing | Two compounding bugs: (1) `getFeedHistory()` filled its result window with low-value `skipped` rows before real purchase/sale rows, crowding them out; (2) the FlowGraph's history-seeding `useEffect` had an empty dependency array, so it only ever ran once against the not-yet-loaded (empty) history | Query real economic events (sent/received/deposit/withdrawal) first and only backfill remaining room with skips; fixed the effect's dependency array to `[history]` (safe — `dedupeNewById` already prevents re-processing) |
| Network page's flow-graph canvas rendered ~2352px tall instead of a normal card height | The wrapper `div` used `minHeight: 360` (not a definite height); combined with CSS Grid's default row-stretch, every cell in the row inherited the tallest sibling's natural content height | Changed to a definite `height: 480` on both the graph and the adjacent Recent Activity card |
| Demo buyer wallet (used for judge/demo purchases) ran out of funds mid-testing | Its original funding amount (`$0.6`) was sized for a much shorter test run | Wrote a reusable top-up script (`scripts/topup-demo-buyer.ts`) that re-funds the *already-provisioned* wallet via a real on-chain transfer + real Gateway deposit; raised the default funding amount for any future fresh deployment from $0.6 to $2.1 |
| A failed Circle Gateway deposit only reported "ended in state FAILED" with no reason | `waitForTransaction()` discarded Circle's real `errorReason`/`errorDetails` fields and only surfaced the terminal state | Now surfaces Circle's actual error reason/details; the Deploy page also fetches the real wallet balance up front and blocks an over-budget deploy client-side with a clear message, before it ever reaches the chain |

All fixes above went through the same discipline as round 1: root-caused
against real behavior (never assumed), fixed, then verified with
`tsc --noEmit`, `next lint`, and the full `npm run test:all` suite passing
before commit.

---

## 7. Known Limitations

- **The Vercel deployment is frontend-only.** Vercel only runs serverless
  functions; HERALD's Express API needs a persistent process (a writable
  SQLite file, a 4-hour cron scheduler, long-lived SSE connections) that
  serverless functions can't provide. The deployed UI is fully public and
  navigable, but every API-backed feature (wallet balance, live feed,
  deploy, buy) only works if a backend is also reachable — currently that
  means running it locally on the same machine that's viewing the page.
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

`npm run test:all` runs all three layers in sequence and currently passes
end to end (`lint` → `tsc --noEmit` → unit → integration → Playwright):

- **Unit** (`scripts/test-unit.ts`) — 19/19 passing: brief pricing (floor +
  clamping), source scoring, `formatSigned` sign-placement (regression test
  for a past `$-0.0369` display bug), and `dedupeNewById` event
  de-duplication (regression test for the FlowGraph double-processing bug).
- **Integration** (`scripts/test-e2e.ts`) — 10/10 passing against a live
  server: health → trigger cycle → verify brief → verify free preview →
  verify the x402 gate rejects an unpaid request, plus the newer
  balance/deposit/withdrawal checks added in later phases.
- **Playwright, real browser** (`scripts/test-playwright.ts`) — 29/29
  passing across all 5 pages (`/`, `/deploy`, `/economy`, `/library`,
  `/network`, `/how-it-works`) at desktop and mobile widths: 0 console
  errors, 0 horizontal overflow, and a dedicated overlap-detection check
  (pairwise `getBoundingClientRect()` comparison, excluding intentionally
  `position: fixed` toasts) added this session after the Economy
  card-overlap bug — verified to both fail against the reintroduced bug and
  pass against the fix.
- **Manual real-money-rail tests**: Gateway deposit (real tx hashes),
  buy-side x402 settlement, sell-side x402 settlement from an independently
  provisioned third-party wallet, and a live re-triggered cycle used to
  confirm the topic-categorization fix against a real "trading"-topic query.

---

*HERALD — built on Circle, Arc, x402, 1Claw, and Gemini.*
