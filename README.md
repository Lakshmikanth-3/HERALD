# HERALD

### *The agent that pays to learn and sells what it knows.*

Built for the Lepton Agents Hackathon (Canteen × Circle × Arc).

**Live demo (frontend only):** [lepton-blue.vercel.app](https://lepton-blue.vercel.app)
— the UI is public, but every API call (wallet balance, live feed, deploy, buy)
only works if you're also running the backend locally on the same machine (see
Setup below). Vercel only hosts the Next.js frontend; the Express API needs a
persistent process (SQLite file, a 4-hour cron scheduler, long-lived SSE
connections) that serverless functions can't provide.

HERALD is an autonomous research agent with its own Circle Agent Wallet. Every
session it:

1. **Discovers** sources on a topic you give it (RSS/news feeds).
2. **Scores** each source's relevance and **pays** for the ones worth reading —
   real x402 nanopayments, settled through Circle Gateway on Arc testnet.
3. **Synthesizes** what it read into a short research brief using Gemini.
4. **Publishes** the brief behind its own x402 paywall — so other agents (or
   humans, via their own agent's wallet) can pay to read it.

The same agent wallet is both the buyer (paying sources) and the seller
(charging for briefs) — HERALD runs a live, sub-cent, two-sided x402 economy,
not a demo of one side of it.

Live dashboard: watch the agent's balance, a scrolling payment ticker, an
icon-based cycle stepper, a live decision log ("Agent Reasoning"), and a
force-directed graph of who it paid and who paid it (sources, buyers, and
other agents it bought marketplace briefs from) — all in real time, all
built from the same events and DB rows the API returns, nothing staged for
appearances. A dedicated brief page (`/library/:id`) shows the full
Gemini-written body plus a real payment-receipt manifest — every citation
linked to its own on-chain payment. `/economy?demo=1` gives a clean,
zoomed-in "stage" view for screen recordings (nav hidden, reasoning panel
open) — presentational only, no functional change.

## Verify it's real

Don't take the pitch above on faith — every claim in it is checkable in under
a minute, without reading a line of code.

**1. The agent wallet is a real address on a real (test) chain.**
Open it on the [Arc testnet explorer](https://testnet.arcscan.app/address/0x1fc8b69f563d2f3fe54ca8a693921f53d11eab89)
— or, once you've run your own `provision:wallet`, your own wallet's address
is on the `/how-it-works` page, with a one-click copy and explorer link (also
`GET /api/agent/chain-info`, no auth required).

**2. A brief's paywall is a real HTTP 402, not a fake "upgrade to pro" dialog:**

```bash
# Grab the latest published brief id, then hit its paywalled endpoint directly
BRIEF_ID=$(curl -s http://localhost:3001/api/briefs?limit=1 | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')
curl -i http://localhost:3001/api/briefs/$BRIEF_ID
```

Expect back a real `HTTP/1.1 402 Payment Required` with a JSON body listing
Circle Gateway's exact payment requirements (asset, amount, `payTo`) — the
same response the agent's own buy-side code parses in `src/agent/buyer.ts`.
The `/how-it-works` page has a copy button wired to the same request against
whatever brief is currently live.

**3. Payments settle for real, on-chain, and you can watch it happen.** The
Economy page's Live Feed, each brief's "Payment receipts" expander in the
Library, and the public `/network` dashboard all link real transaction
hashes to the explorer — a genuine on-chain hash (a Circle Gateway deposit's
approve/deposit calls, or a withdrawal) links out; a Circle Gateway x402
*settlement id* (its batched-payment API returns an id, not an on-chain hash,
since batched payments settle on-chain later — see Known limitations) is
labeled "settlement" and deliberately left unlinked rather than pointing at
a URL that wouldn't resolve. Click "Run Now" on the Economy page and watch
the stepper, the flow graph, and the feed all update from the same real
cycle in real time.

**4. Purchases in the UI complete for real.** The Library's "Read"/"Buy"
buttons pay through a separate, real **demo buyer wallet** (clearly labeled
in the UI, `src/agent/demoBuyer.ts`) rather than the agent's own wallet —
Circle's Gateway facilitator correctly rejects a wallet paying itself as
`self_transfer` (confirmed live), so a genuinely independent buyer is what
actually completes a purchase in this single-agent deployment.

---

## Prerequisites

```bash
node -v       # v20+
```

You'll also need accounts with:

- **[1Claw](https://1claw.dev)** — vault that stores all API keys/secrets; the
  agent fetches them at runtime and they never live in `process.env` during
  normal operation.
- **[Circle](https://console.circle.com)** — Developer-Controlled Wallets API
  key, used to provision the agent's wallet on Arc testnet.
- **[Google AI Studio](https://aistudio.google.com/apikey)** — free Gemini API
  key, used for brief synthesis.
- **[TestMint](https://testmint.myproceeds.xyz)** — x402-gated faucet to fund
  the agent wallet with testnet USDC.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `ONECLAW_AGENT_ID`, `ONECLAW_AGENT_API_KEY`, `ONECLAW_VAULT_ID` (from
your 1Claw vault) and `CIRCLE_API_KEY` / `GEMINI_API_KEY`. Leave
`HERALD_WALLET_ID`, `HERALD_WALLET_ADDRESS`, and `CIRCLE_ENTITY_SECRET` blank —
the next step fills them in.

### 3. Provision the agent's wallet

```bash
npm run provision:wallet
```

This generates a Circle entity secret, creates a wallet set, and creates the
agent's wallet on Arc testnet. Copy the printed `Wallet ID`, `Wallet Address`,
and `Entity Secret` into `.env.local` (`HERALD_WALLET_ID`,
`HERALD_WALLET_ADDRESS`, `CIRCLE_ENTITY_SECRET`).

### 4. Push secrets into the 1Claw vault

```bash
npm run seed:vault
```

Reads `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `GEMINI_API_KEY`,
`HERALD_WALLET_ID`, and `HERALD_WALLET_ADDRESS` out of `.env.local` and stores
them in your 1Claw vault. From this point on, the running agent reads these
values from 1Claw at runtime — not from the environment.

### 5. Provision the sources treasury wallet and seed real gated content

Public RSS feeds are free, so they never trigger the agent's real x402 buy
path. To exercise that path for real (not a mock), HERALD hosts its own
originally-authored research notes behind a genuine x402 gate, paid to a
*separate* wallet:

```bash
npm run provision:sources-wallet   # creates a second Arc-testnet wallet
npm run seed:sources               # populates real, x402-gated content
```

Add the printed `HERALD_SOURCES_WALLET_ID` / `HERALD_SOURCES_WALLET_ADDRESS`
to `.env.local`.

### 6. Fund the wallet

Visit [testmint.myproceeds.xyz](https://testmint.myproceeds.xyz), pay a
nanopayment to mint testnet USDC, and send it to the `HERALD_WALLET_ADDRESS`
printed in step 3.

### 7. Run

```bash
npm run dev
```

Starts the Next.js frontend (`:3000`) and the Express API + agent scheduler
(`:3001`) together. Open `http://localhost:3000`, configure a topic/budget on
the Deploy screen, and watch it run on the Economy screen.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + API server together (development) |
| `npm run dev:next` / `npm run dev:server` | Just the frontend / just the API server |
| `npm run build` / `npm run start` | Production build / start |
| `npm run provision:wallet` | Create the Circle Agent Wallet on Arc testnet |
| `npm run provision:sources-wallet` | Create the sources treasury wallet (separate payTo for gated content) |
| `npm run seed:vault` | Push secrets from `.env.local` into the 1Claw vault |
| `npm run seed:sources` | Populate real x402-gated original content the agent can buy |
| `npm run test` | Integration tests against a running `dev` server — real cycle trigger, real x402 purchase via the demo buyer wallet, public API checks, agent-to-agent self-exclusion check |
| `npm run test:unit` | Pure logic unit tests, no server needed — `priceBrief()`, `scoreSource()`, `formatSigned()`, `dedupeNewById()`, `relevanceScore()`, Live Feed skip-grouping (30 checks) |
| `npm run test:playwright` | Real Chromium checks against a running `dev` server — every page at 1440px/375px, overlap detection, a live triggered cycle, the payment ticker, the brief detail page, skip-grouping, `?demo=1`, and reduced-motion final-state assertions (38 checks) |
| `npm run test:all` | Everything above in sequence: lint → typecheck → unit → integration → Playwright |
| `npm run demo` | Triggers one real cycle and prints a recording walkthrough: page order, real wallet/explorer links, a live 402 curl repro — see Recording a demo below |

## Recording a demo

```bash
npm run dev     # in one terminal
npm run demo    # in another, once it's running
```

`scripts/demo.ts` triggers one real agent cycle (the same `POST
/api/agent/run` the Economy page's "Run Now" button calls), waits for it to
finish, then prints the real data it produced (latest brief, spend/earn,
recent payments) plus a suggested page order for a screen recording — landing
→ deploy → economy (click "Run Now" live) → library → network → how-it-works
— along with a direct explorer link for the agent wallet and a copy-pasteable
curl command that reproduces a live 402 for whatever brief was just
published. Nothing in the script is scripted content — it's real output from
a real cycle, meant to be narrated over, not read from.

For the Economy screen specifically, open `/economy?demo=1` instead of
`/economy` — same page, same real data, just nav hidden, ~15% larger, and
the Agent Reasoning panel pre-expanded, so there's less to explain and more
room in the recording for the ticker/stepper/graph. See `DEMO_SCRIPT.md`
for a suggested shot-by-shot sequence.

## Testing

Three layers, all real (no mocked network/DOM):

- **Unit** (`scripts/test-unit.ts`, 30 checks) — pure functions, no server.
  Includes regression tests for real bugs found along the way: the
  `-$0.0369`-style double-negative sign bug (`formatSigned`), the FlowGraph
  event double-processing bug (`dedupeNewById`), agent-to-agent relevance
  matching (`relevanceScore`), and the Live Feed's skip-grouping logic.
- **Integration** (`scripts/test-e2e.ts`, 10 checks) — against a running
  `npm run dev`. Triggers a real agent cycle, verifies the x402
  402-then-pay-then-content round trip using the real demo buyer wallet
  (not a mock payment), and checks the public `/network` APIs and the
  agent-to-agent self-exclusion behavior.
- **Browser** (`scripts/test-playwright.ts`, 38 checks) — a real Chromium
  instance, not jsdom. Sweeps all 6 pages at desktop and mobile widths;
  triggers a live cycle while watching for unbounded page growth or
  duplicate-key warnings; checks the payment ticker doesn't overlap
  anything, the brief detail page renders its receipt manifest, the Live
  Feed's skip-grouping expands, `?demo=1` renders cleanly, and no
  reduced-motion-gated element reports a running CSS animation.

Empty states (no briefs, no history) are covered by code review rather than
a live check — this suite intentionally never wipes the real SQLite
database just to screenshot a from-scratch state.

Run `npm run test:all` before committing anything that touches the agent
loop, payment routes, or the Economy/Library/Network pages.

## Architecture

```
Next.js frontend (:3000)  ──HTTP──>  Express API (:3001)  <──>  Circle Gateway / Arc testnet
                                            │
                                     Agent scheduler (node-cron, every 4h)
                                     discover → score → buy → synthesize → publish
                                            │
                                    SQLite (data/herald.db) + SSE event bus
```

- `src/agent/` — the autonomous loop: source discovery, relevance scoring,
  x402 purchasing (`buyer.ts`), Gemini synthesis (`synthesize.ts`), brief
  publishing, and Circle wallet operations.
- `src/server/` — Express API. `routes/briefs.ts` is the x402 sell-side gate
  for the agent's own briefs; `routes/sources.ts` is a real x402 gate for
  originally-authored content the agent buys (settled to a separate
  treasury wallet, not the agent's own) — this is what makes buyer.ts's
  payment path fire for real instead of every RSS source just being free.
  Both return real HTTP 402s and verify payment via Circle's Gateway
  batching API.
- `src/app/` — the landing page (`page.tsx` + `components/landing/`), Deploy
  (onboarding), Economy (live dashboard: payment ticker, hero cycle stepper,
  balance card, cinematic force-directed FlowGraph, Live Feed with
  skip-grouping, the Agent Reasoning decision log, and per-cycle report
  history), Library (your briefs + marketplace, with source- and
  brief-level payment receipts, linking out to `/library/:id` for the full
  reading view), the public read-only `/network` dashboard (network-wide
  stats, the same FlowGraph, and a real per-cycle net-P&L timeline strip),
  and How it works (the x402 loop explained, with a live wallet explorer
  link and a copyable curl snippet that reproduces a real 402 response).
  The landing page's Stats section fetches real numbers from your own API
  — no placeholder marketing copy.
- `src/app/economy/PaymentTicker.tsx`, `ReasoningPanel.tsx` — both derive
  everything they show from events the agent already emits (real amounts,
  domains, relevance scores, skip reasons); no new backend fields were
  needed for either. `src/app/network/CycleTimeline.tsx` reads real rows
  from `GET /api/agent/cycles`.
- `src/app/library/[id]/page.tsx` — a dedicated brief reading page: pays for
  the full content via the demo buyer wallet on demand, then shows the real
  Gemini body alongside a receipt manifest (who bought the brief, what the
  agent paid per cited source, with settlement/explorer links for each).
- `src/agent/demoBuyer.ts` — a separate, real Arc testnet wallet the Library
  UI pays from, lazily provisioned and funded on first use. `src/agent/
  agentToAgent.ts` — the agent checks the marketplace for another agent's
  relevant, affordable brief before researching its own (real x402 purchase
  logic; see Known limitations for why it's always a documented no-op here).
  `src/agent/withdraw.ts` — a real on-chain USDC transfer out of the agent's
  own wallet, exposed as a Withdraw form on the Economy page's Balance card.
- `src/components/ui/` + `src/lib/utils.ts` — small shadcn-style primitives
  (Button, Accordion) backing the landing page, ported from
  `electric-landing-page-template/` and adapted onto the existing Tailwind
  v3 setup (see that folder's `components/` for the original reference
  design — it's excluded from the app build via `.vercelignore`/tsconfig).
- `src/shared/` — SQLite client, SSE event bus, shared types.

## Circle/Arc/1Claw/TestMint stack

| Technology | Used for | Key file(s) |
|---|---|---|
| Circle Developer-Controlled Wallets | Agent + demo-buyer wallet provisioning, real on-chain transfers/withdrawals | `scripts/provision-wallet.ts`, `src/agent/wallet.ts`, `src/agent/withdraw.ts`, `src/agent/demoBuyer.ts` |
| Circle Gateway (x402 batching) | Buy-side purchases, sell-side settlement, Gateway deposits | `src/agent/buyer.ts`, `src/server/routes/briefs.ts`, `src/agent/gateway.ts` |
| Arc testnet (chain id `5042002`) | Settlement network for every USDC transfer | `src/shared/chain.ts` |
| 1Claw vault | Runtime secret storage — Circle/Gemini keys never sit in `process.env` while the agent runs | `src/agent/secrets.ts` |
| TestMint | x402-gated testnet USDC faucet for funding the agent wallet | manual step, see Setup §6 |
| Google Gemini | Brief synthesis | `src/agent/synthesize.ts` |

A few representative snippets, so you can see the real API calls without
opening every file:

```ts
// src/agent/circleSign.ts — signing a real x402 payment as the agent wallet
const signer = await getCircleEvmSigner();
const scheme = new BatchEvmScheme(signer);
const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
```

```ts
// src/agent/gateway.ts — a real on-chain Gateway deposit (approve + deposit)
await executeContractCall(usdcAddress, 'approve(address,uint256)', [GATEWAY_WALLET_ADDRESS, amountAtomic]);
await executeContractCall(GATEWAY_WALLET_ADDRESS, 'deposit(address,uint256)', [usdcAddress, amountAtomic]);
```

```ts
// src/server/routes/briefs.ts — verifying + settling a real x402 payment
const verifyResult = await facilitator.verify(paymentPayload, requirements);
const settleResult = await facilitator.settle(paymentPayload, requirements);
```

## Known limitations

- **Agent-to-agent purchasing is real code with a single-instance no-op.**
  Every cycle, the agent checks `/api/marketplace` for another agent's brief
  worth buying (`src/agent/agentToAgent.ts`) — real scoring, a real x402
  purchase attempt if one clears the relevance/budget bars. But this
  deployment runs one HERALD instance, `/api/marketplace` only lists this
  instance's own SQLite briefs, and listings don't even carry a remote API
  URL to buy from one. Every candidate therefore shares this agent's own
  wallet address and is correctly self-excluded (Circle's Gateway facilitator
  rejects same-wallet payments as `self_transfer` anyway — confirmed live).
  The code path would complete a genuine cross-agent purchase the moment a
  second, truly independent HERALD instance existed to buy from.
- **1Claw's vault occasionally answers a secret read with its own x402
  "payment required" challenge** (HTTP 402, denominated in real Base
  mainnet USDC — not this project's Arc testnet fake money), most likely a
  rate-limit/quota mechanism on their side. It self-resolves within
  seconds; `secrets.ts` retries it a few times with backoff. It never
  constructs or sends a payment for this automatically — that would be a
  real financial decision, not something to make unattended in a research
  agent's secret-fetch path. If you see `1Claw vault is rate-limited` in an
  error, wait a moment and retry.
- **Running `npm run build` while `npm run dev` is active corrupts the
  `.next` dev cache** (a general Next.js dev-vs-build artifact conflict,
  not HERALD-specific) and breaks every page with `Cannot find module
  './NNN.js'`. Fix: stop `dev`, `rm -rf .next`, restart `npm run dev`.
- **7 pre-existing `npm audit` vulnerabilities** in `next`/
  `eslint-config-next`/`postcss` (would need a Next.js 14→16 major
  version bump) and `ws` (a dependency of `viem`, used by the real x402
  signing path). Not fixed — the Next.js bump is a breaking change out of
  scope here, and `ws` sits underneath the live signing code.
