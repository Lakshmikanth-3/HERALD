# HERALD

### *The agent that pays to learn and sells what it knows.*

Built for the Lepton Agents Hackathon (Canteen × Circle × Arc).

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

Live dashboard: watch the agent's balance, its spend/earn feed, and a
force-directed graph of who it paid and who paid it, in real time.

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
| `npm run test` | End-to-end integration test against a running `dev` server |

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
- `src/app/` — the three screens: Deploy (onboarding), Economy (live
  dashboard), Library (your briefs + marketplace).
- `src/shared/` — SQLite client, SSE event bus, shared types.

## Circle/Arc/1Claw stack

| Technology | Used for |
|---|---|
| Circle Developer-Controlled Wallets | Agent wallet provisioning (`scripts/provision-wallet.ts`, `src/agent/wallet.ts`) |
| Circle Gateway (x402 batching) | Both buy-side purchases (`src/agent/buyer.ts`) and sell-side settlement (`src/server/routes/briefs.ts`) |
| Arc testnet | Settlement network for all USDC transfers |
| 1Claw vault | Runtime secret storage — Circle/Gemini keys never sit in `process.env` while the agent runs (`src/agent/secrets.ts`) |
| TestMint | x402-gated testnet USDC faucet for funding the agent wallet |
| Google Gemini | Brief synthesis (`src/agent/synthesize.ts`) |
