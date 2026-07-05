# HERALD
## *The agent that pays to learn and sells what it knows.*

**Lepton Agents Hackathon — Canteen × Circle × Arc**
**RFB Alignment: RFB 01 (Autonomous Paying Agents) + RFB 06 (Creator Monetization) — but breaks both.**

---

## 0. Why This Wins: The One-Paragraph Pitch

> Every AI agent today burns resources for free. It fetches articles, scrapes data,
> and processes information without any economic accountability. HERALD flips this.
> Your HERALD agent has a wallet, a budget, and a job: research your topic.
> It *pays* for every source it reads (x402 nanopayments, sub-cent, on Arc).
> It *earns* by selling its synthesized briefs to other agents and humans.
> You watch it run its own micro-economy in a live dashboard — earning, spending,
> deciding, optimizing. This is not a paywall. Not a tip jar. It is the first
> product where an AI agent acts as a responsible economic actor — because
> it has actual skin in the game.

---

## 1. Problem Statement

### The Broken Content Economy (two sides)

**For creators and researchers:**
- Quality long-form content earns zero when AI agents scrape it as free substrate
- No mechanism exists to charge AI crawlers per citation or per read
- Subscriptions are the only model — but they demand audience scale most creators don't have

**For AI agent builders:**
- Agents fetch content with zero cost signal — so they have no basis for quality discrimination
- No mechanism to make agents *accountable* for what they consume
- No way for an agent to "earn back" the cost of its research by productizing its synthesis

### The Gap Nobody Is Filling
The hackathon notes this explicitly in Prior Art #01:
> *"The fastest-growing consumers of content are AI agents and aggregators,
> and they read the work as free substrate."*

And in the Distribution Bootstrap:
> *"The LLM Crawler Citation-Toll Layer: per-citation micropayments at the
> agent boundary that settle to source authors when their work grounds a
> generated answer."*

**HERALD makes this real.** The agent pays at the moment of reading, not at the moment of citing. And then it earns by selling what it learned.

---

## 2. Solution: What HERALD Is

HERALD is a deployable autonomous research agent with a self-sustaining economic loop:

```
  [Topic + Budget]
       ↓
  HERALD AGENT
  ┌─────────────────────────────────────┐
  │                                     │
  │  SPEND: buys x402-gated sources     │
  │         $0.001–$0.01 per read       │
  │                                     │
  │  THINK:  synthesizes with Claude    │
  │          into a daily research brief│
  │                                     │
  │  EARN:  publishes brief as x402     │
  │         endpoint at $0.03–$0.10     │
  │         other agents auto-buy it    │
  │                                     │
  └─────────────────────────────────────┘
       ↓
  [Live Dashboard: economy, P&L, briefs]
```

**The circular economy:** The agent's earnings partially offset its research costs.
**The judge "wow" moment:** An AI agent running a profitable (or break-even) knowledge business, entirely autonomously, with every economic decision visible in real time.

---

## 3. Novel Use of Circle/Arc Technologies

This is the section judges will scrutinize most. Here is how HERALD uses every major
Circle/Arc technology in a way that has *never been done before.*

### 3.1 x402 as a Two-Sided Protocol (the innovation)
**What everyone else does:** x402 on the sell side only — "lock my API, let agents pay to unlock."

**What HERALD does:** The same agent is BOTH buyer AND seller on x402.
- The agent *pays* x402-gated content sources (buy side)
- The agent *publishes* its brief as an x402-gated endpoint (sell side)
- This creates a machine-to-machine content market — agents paying agents — using a
  single open protocol. The agent's wallet address is both payer and payee.

This directly demonstrates Arc's core thesis: *"agents as autonomous economic actors."*

### 3.2 Circle Gateway Nanopayments — Used for Source-Level Pricing
**What everyone else does:** Charge $0.05 per article.

**What HERALD does:** Charge per *engagement signal* — the agent pays $0.001 for the
article metadata/preview, then decides to pay an additional $0.003 only if the preview
signals relevance. This is *two-step purchase validation* using nanopayments, a pricing
model that only makes sense at sub-cent resolution. A $0.001 "evaluation fee" would be
unthinkable without Gateway's gas-free batched settlement.

### 3.3 Agent Wallets — The Agent Holds Its Own USDC
The HERALD agent is provisioned with a Circle Agent Wallet. It holds test USDC from
the user's initial deposit. The agent autonomously:
- Decides how much to allocate per source (budget-aware)
- Receives payments from buyers of its reports
- Rebalances its per-session spend based on its current balance

The wallet is the agent's *skin in the game*. It cannot spend what it does not have.

### 3.4 Circle CLI — Agent Provisioning and Operation
The entire agent lifecycle is managed via Circle CLI:
- `circle wallets create` — provisions the agent wallet on Arc
- `circle wallets transfer` — funds the wallet from test USDC
- `circle wallets balance` — the agent checks its own balance before each session

### 3.5 1Claw — Secure Key Management for the Agent
The agent needs the Circle API key, Anthropic API key, and 1Claw vault credentials.
Using 1Claw's MCP server integration, these secrets are never in the agent's context
window. The agent fetches them at runtime from the 1Claw vault.
- Code: `const key = await oneClawClient.secrets.get(vaultId, 'circle-api-key')`
- This demonstrates production-grade agent security, not demo-grade.

### 3.6 Arc Blockchain — Settlement of Agent Earnings
All x402 payments settle via Circle Gateway on Arc:
- Sub-second finality means the agent knows in real time if a source accepted payment
- USDC gas means the agent never needs to hold volatile tokens
- The agent's earnings accumulate in its Gateway balance, withdrawable to Arc

### 3.7 TestMint — Initial Wallet Funding
Users fund their HERALD agent's wallet using TestMint (testmint.myproceeds.xyz),
which itself uses x402 — a beautiful dogfooding moment where the user pays a
nanopayment to get test USDC to fund their agent's first research session.

---

## 4. UX Architecture: UX as the System

> **The principle:** In HERALD, watching the agent work IS the product.
> The UX is not a dashboard on top of a system — the UX is how the system is understood.
> Every decision the agent makes is a UX event.

### 4.1 The Three-Screen Philosophy

HERALD has exactly three primary views. No more.

| Screen | Name | Job |
|--------|------|-----|
| 1 | **Deploy** | Set up your agent in 3 steps |
| 2 | **Economy** | Watch your agent's live micro-economy |
| 3 | **Library** | Read your agent's briefs + browse the market |

### 4.2 Screen 1: Deploy (Onboarding)

**Concept:** "Tell HERALD one thing and let it work."

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   HERALD                                          [Dark bg] │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │  What should your agent research?                  │   │
│   │                                                     │   │
│   │  ┌───────────────────────────────────────────────┐ │   │
│   │  │  e.g. "AI regulation in the EU"               │ │   │
│   │  └───────────────────────────────────────────────┘ │   │
│   │                                                     │   │
│   │  Weekly research budget                            │   │
│   │  [$1] ──────●──────────── [$10]                   │   │
│   │             $3.00 / week                           │   │
│   │                                                     │   │
│   │  Selling price per brief                           │   │
│   │  [$0.01] ──────●────── [$0.20]                    │   │
│   │                $0.05 per brief                     │   │
│   │                                                     │   │
│   │  [  Fund Agent with TestMint → Deploy HERALD  ]    │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Agent will:  read ~60 sources/week  ·  publish ~7 briefs  │
│   Estimated earnings:  $0.20–$1.40/week from other agents   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**UX decisions:**
- No wallet address visible at this stage. Complexity is hidden.
- The earnings estimate is calculated from the HERALD agent network size
  (how many other agents are active and might buy your topic's briefs).
- "Fund Agent with TestMint" opens TestMint in an iframe — the user pays
  a nanopayment (~$0.01) to receive $5 in test USDC, which funds the agent wallet.
  This is the first nanopayment the user experiences, before they even deploy.

**What happens on deploy:**
1. Circle CLI provisions an Agent Wallet on Arc
2. 1Claw vault stores all API keys
3. The agent process starts, scheduled to run every 4 hours
4. User is taken to the Economy screen

---

### 4.3 Screen 2: Economy (The Core UX)

**Concept:** "Watch your agent's economic brain."

This is the heart of HERALD. It has four zones.

```
┌────────────────────────────────────────────────────────────────────┐
│  HERALD                              "AI Regulation in the EU"      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │
│  │   BALANCE    │  │  LIVE ECONOMY FEED                           │ │
│  │              │  │                                              │ │
│  │  $4.23 USDC  │  │  ● Paid $0.003 → Politico EU               │ │
│  │  ─────────── │  │    "Draft regulation text unlocked"  2m ago │ │
│  │  Spent today │  │                                              │ │
│  │  $0.41       │  │  ● Paid $0.001 → Reuters preview           │ │
│  │              │  │    "Skipped: low relevance score"    5m ago │ │
│  │  Earned today│  │                                              │ │
│  │  $0.15       │  │  ★ Earned $0.05 ← Agent #A7F2             │ │
│  │              │  │    "Brief #12 purchased"            12m ago │ │
│  │  Net today   │  │                                              │ │
│  │  -$0.26      │  │  ● Paid $0.002 → EUobserver article        │ │
│  │              │  │    "Purchased: high signal"          18m ago│ │
│  └──────────────┘  │                                              │ │
│                    │  [Load more ↓]                               │ │
│  ┌──────────────┐  └──────────────────────────────────────────────┘ │
│  │  AGENT FLOW  │                                                    │
│  │              │  ┌──────────────────────────────────────────────┐ │
│  │  [Live node  │  │  LAST BRIEF PREVIEW                          │ │
│  │   graph of   │  │                                              │ │
│  │   sources →  │  │  Brief #12 · Published 2h ago               │ │
│  │   agent →    │  │  "EU AI Act: Implementation Timeline"       │ │
│  │   buyers]    │  │                                              │ │
│  │              │  │  Synthesized from 14 sources · Cost: $0.038 │ │
│  │              │  │  Revenue so far: $0.15 (3 purchases)        │ │
│  │              │  │  Status: PROFITABLE ✓                       │ │
│  │              │  │                                              │ │
│  └──────────────┘  │  [Read Brief]  [Share x402 Link]            │ │
│                    └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**The four zones explained:**

**Zone A — Balance card (top-left):**
Spent / Earned / Net for today. Simple three-number summary.
Color: green if net positive, amber if slightly negative, red if overspending.

**Zone B — Live Economy Feed (top-right, the hero):**
Real-time stream of every agent decision as a UX event:
- `●` = outgoing payment (spending, colored blue/dim)
- `★` = incoming payment (earning, colored mint/bright)
- Each entry shows: amount, destination/source name, decision reason, timestamp
- "Skipped: low relevance score" entries are deliberately shown — the agent's
  rejections are as interesting as its purchases. This is the "economic brain" made visible.

**Zone C — Agent Flow diagram (bottom-left):**
A live force-directed graph:
- Center node = your agent (pulsing circle)
- Left nodes = sources the agent paid (size ∝ amount paid)
- Right nodes = agents/users who bought your brief (size ∝ earnings)
- Edges animate when a payment occurs (a small particle travels along the edge)
- This is the "Bloomberg Terminal" moment — seeing your agent's economy as a network

**Zone D — Last Brief Preview (bottom-right):**
Shows the most recent published brief with its economic performance:
- Cost to produce vs. revenue earned (profitability indicator)
- Number of purchases
- A "Share x402 Link" button that copies the x402-gated URL for the brief

---

### 4.4 Screen 3: Library

```
┌─────────────────────────────────────────────────────────────────┐
│  HERALD Library                                    [Your Agent]  │
│  ───────────────────────────────────────────────────────────────│
│                                                                  │
│  YOUR BRIEFS (7)                                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Brief #14 · EU AI Act: Enforcement Mechanisms            │   │
│  │ Published 4h ago · 12 sources · Cost $0.041              │   │
│  │ Revenue: $0.25 (5 purchases) · NET +$0.21  ✓ Profitable  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Brief #13 · MEPs push back on model transparency clause  │   │
│  │ Published 1d ago · 8 sources · Cost $0.029               │   │
│  │ Revenue: $0.05 (1 purchase) · NET -$0.01   ~ Break-even  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  HERALD MARKETPLACE  (buy from other agents)                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  "DeFi Regulatory Landscape — Weekly Digest"             │   │
│  │  Agent #A7F2 · Published 3h ago · 19 sources             │   │
│  │  $0.05 to read  ·  47 purchases this week                │   │
│  │  [  Buy with agent wallet — $0.05  ]                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  "USDC on-chain transaction volume — daily brief"        │   │
│  │  Agent #C3B1 · Published 6h ago · 7 sources              │   │
│  │  $0.03 to read  ·  12 purchases this week                │   │
│  │  [  Buy with agent wallet — $0.03  ]                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**The "Buy with agent wallet" button:**
When a human clicks this, their *own agent* is the one purchasing — using their agent wallet's USDC, routed through x402. This is a critical UX choice: humans never pay from their personal wallet. The agent always pays. This reinforces the concept that the agent is an economic actor.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  HERALD SYSTEM OVERVIEW                                             │
└─────────────────────────────────────────────────────────────────────┘

USER BROWSER                 HERALD BACKEND                 EXTERNAL
─────────────────────────────────────────────────────────────────────

  Next.js App         ←→    Express API Server        ←→   Circle API
  (React dashboard)          /api/agent/*                   Agent Wallets
                             /api/briefs/*                  Gateway
                             /api/marketplace/*             Nanopayments
                                   ↕
                         HERALD Agent Process              Claude API
                         (Node.js autonomous loop)    ←→   (synthesis)
                                   ↕
                              1Claw Vault                  1Claw API
                         (secrets at runtime)              (key fetch)
                                   ↕
                         SQLite / PostgreSQL               Arc Testnet
                         (agent decisions,            ←→   (settlement)
                          brief index,
                          payment log)
                                   ↕
                         x402 Seller Endpoint
                         /briefs/:id (gated)

X402 BUYER FLOW (agent purchasing sources):
  Agent → GET source URL → 402 Response → Sign EIP-3009 auth
  → Retry with auth → Source delivers content → Gateway batches → Arc settles

X402 SELLER FLOW (agent selling briefs):
  Other agent → GET /briefs/:id → 402 Response (HERALD's price)
  → Other agent signs auth → HERALD verifies → Returns brief
  → Gateway credits HERALD's agent wallet
```

### 5.1 The Agent Loop (runs every 4 hours)

```
HERALD AGENT CYCLE
──────────────────

1. CHECK BALANCE
   circle wallets balance --wallet-id $AGENT_WALLET_ID
   → If balance < $0.10: pause, notify user
   → If balance OK: continue

2. DISCOVER SOURCES
   Search RSS feeds, news APIs, and known x402-gated sources
   for content matching the topic vector.
   Filter to sources not read in last 24h.
   Score each source by predicted relevance (title + metadata).

3. EVALUATE & PAY (per source, up to session budget)
   For each candidate source (sorted by relevance score):
   a. Fetch preview (free or minimal cost)
   b. If relevance_score > threshold:
      → Send x402 nanopayment via Circle Gateway
      → Fetch full content
      → Add to synthesis queue
   c. Else:
      → Log as "Skipped: low relevance (score: X)"
      → Do not pay

   Budget guard: stop when session_spend > daily_budget / 6

4. SYNTHESIZE (Claude API)
   Prompt: [SYSTEM: You are a research synthesizer...]
   Input: all purchased source content + topic + prior briefs
   Output: structured research brief (title, key findings, sources, gaps)

5. PUBLISH BRIEF
   a. Store brief in database with unique ID
   b. Register x402 payment gate on /briefs/:id at configured price
   c. Log "Brief published: $PRICE per read"

6. CHECK INCOMING PAYMENTS
   circle wallets transactions --wallet-id $AGENT_WALLET_ID
   → Log any new brief purchases as "Earned $X from Agent #YYY"

7. EMIT EVENTS
   Push all decisions as Server-Sent Events to connected dashboards
   (the Live Economy Feed in real time)
```

---

## 6. Agent Decision Logic

The agent's "brain" is not complex ML — it is a set of explicit, transparent rules
that are visually legible to users. This is intentional: the agent's decisions should
be understandable, not a black box.

### 6.1 Relevance Scoring

```javascript
// Source relevance scoring (0.0 to 1.0)
function scoreSource(source, topicVector) {
  const titleScore = cosineSimilarity(embed(source.title), topicVector);
  const ageScore = Math.exp(-source.ageHours / 48); // freshness decay
  const domainScore = TRUSTED_DOMAINS[source.domain] ?? 0.5;
  const lengthScore = Math.min(source.wordCount / 1000, 1.0); // penalize stubs
  
  return (titleScore * 0.5) + (ageScore * 0.2) + 
         (domainScore * 0.2) + (lengthScore * 0.1);
}

// Pay threshold: only pay if relevance > 0.65
const PAY_THRESHOLD = 0.65;
```

### 6.2 Budget Allocation

```javascript
// Per-session budget guard
const SESSION_BUDGET = weeklyBudget / (7 * 6); // 6 sessions/day

// Dynamic per-source spend limit
function maxPayForSource(relevanceScore, sessionBudgetRemaining) {
  const base = 0.001; // floor: $0.001
  const ceiling = Math.min(0.01, sessionBudgetRemaining * 0.2); // max 20% of remaining
  return base + (relevanceScore - PAY_THRESHOLD) * ceiling;
  // High-relevance sources get more; low-relevance sources get floor price
}
```

### 6.3 Brief Pricing

```javascript
// Brief price = cost + target margin
function priceBrief(productionCost, sourcesCount) {
  const targetMargin = 2.0; // aim to earn 2x production cost
  const basePrice = productionCost * targetMargin;
  const qualityBonus = Math.log(sourcesCount) * 0.005; // more sources = higher price
  return Math.max(0.03, Math.min(0.10, basePrice + qualityBonus)); // clamp $0.03–$0.10
}
```

---

## 7. Circle/Arc Technology Map

| Technology | HERALD Usage | File/Module |
|---|---|---|
| **Circle CLI** | Agent wallet provisioning, balance checks | `scripts/provision-agent.sh` |
| **Agent Wallets** | Agent holds + manages its own USDC | `src/agent/wallet.ts` |
| **Circle Gateway / Nanopayments** | All x402 purchases (buy side) | `src/agent/buyer.ts` |
| **x402 Middleware** | Brief gating (sell side) | `src/server/x402-middleware.ts` |
| **Circle Gateway** | Brief payment verification | `src/server/verify-payment.ts` |
| **USDC on Arc** | Settlement of all agent transactions | Arc testnet config |
| **1Claw Vault** | Secure storage of all API keys | `src/agent/secrets.ts` |
| **TestMint** | Initial test USDC funding flow | `src/app/onboarding/fund.tsx` |

---

## 8. Technical Stack

### Backend
- **Runtime:** Node.js 20+ (LTS)
- **Framework:** Express.js (API server)
- **Agent Process:** Node.js with `node-cron` (scheduled runs)
- **Database:** SQLite (local dev) / PostgreSQL (production)
- **SSE:** Native Node.js EventEmitter for real-time feed

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React + Tailwind CSS
- **Charts:** Recharts (P&L over time)
- **Graph viz:** D3.js force simulation (Agent Flow diagram)
- **Fonts:** Space Grotesk (display) + Inter (body) + JetBrains Mono (amounts)

### Agent
- **LLM:** Claude claude-sonnet-4-6 via Anthropic API (synthesis)
- **Embeddings:** `@xenova/transformers` (local embedding for relevance scoring)
- **x402 Client:** `x402-fetch` from `circlefin/arc-nanopayments`
- **Secrets:** 1Claw SDK + MCP server

### Infrastructure
- **Blockchain:** Arc Testnet
- **Settlement:** Circle Gateway (batched)
- **Wallet:** Circle Agent Wallets
- **Secrets:** 1Claw (HSM-backed)
- **Testnet USDC:** TestMint (x402-gated faucet)

---

## 9. Project Directory Structure

```
herald/
├── README.md
├── package.json
├── .env.example               # never commit real values — use 1Claw
│
├── scripts/
│   ├── provision-agent.sh     # Circle CLI: create wallet, fund it
│   ├── seed-sources.ts        # pre-register known x402 sources
│   └── deploy-x402.ts         # register HERALD's brief endpoint
│
├── src/
│   │
│   ├── agent/                 # The autonomous agent (core)
│   │   ├── index.ts           # agent loop orchestrator (runs every 4h)
│   │   ├── discover.ts        # source discovery (RSS, news APIs)
│   │   ├── score.ts           # relevance scoring logic
│   │   ├── buyer.ts           # x402 purchase client (nanopayments)
│   │   ├── synthesize.ts      # Claude synthesis prompt + call
│   │   ├── publish.ts         # brief publication + x402 gate registration
│   │   ├── wallet.ts          # Circle Agent Wallet operations
│   │   └── secrets.ts         # 1Claw vault: fetch API keys at runtime
│   │
│   ├── server/                # Express API server
│   │   ├── index.ts           # server entry point
│   │   ├── routes/
│   │   │   ├── agent.ts       # GET /api/agent/status, /economy-feed (SSE)
│   │   │   ├── briefs.ts      # GET /api/briefs (list), /api/briefs/:id
│   │   │   ├── marketplace.ts # GET /api/marketplace (all agents' briefs)
│   │   │   └── config.ts      # POST /api/config (topic, budget, price)
│   │   ├── x402-middleware.ts # x402 payment gate for /briefs/:id
│   │   └── verify-payment.ts  # Circle Gateway payment verification
│   │
│   ├── app/                   # Next.js frontend
│   │   ├── layout.tsx         # root layout, fonts, globals
│   │   ├── page.tsx           # redirect: → /deploy or /economy
│   │   ├── deploy/
│   │   │   └── page.tsx       # Screen 1: Deploy (onboarding)
│   │   ├── economy/
│   │   │   ├── page.tsx       # Screen 2: Economy dashboard
│   │   │   ├── LiveFeed.tsx   # SSE-connected live feed component
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── FlowGraph.tsx  # D3 force graph (agent economy network)
│   │   │   └── BriefPreview.tsx
│   │   └── library/
│   │       ├── page.tsx       # Screen 3: Library + Marketplace
│   │       ├── YourBriefs.tsx
│   │       └── Marketplace.tsx
│   │
│   └── shared/
│       ├── types.ts           # shared TypeScript types
│       ├── db.ts              # database client + migrations
│       └── events.ts          # SSE event bus
│
├── x402-sources/              # mock x402-gated sources (for demo)
│   ├── server.ts              # local x402 source server
│   └── content/               # sample articles (HTML/JSON)
│
└── docs/
    ├── architecture.md
    ├── agent-behavior.md
    └── circle-stack-usage.md
```

---

## 10. Setup Instructions

### Prerequisites
```bash
node -v       # v20.18.2+
python -m pip install uv  # for ARC CLI
npm -g install @circle-fin/cli  # Circle CLI
```

### Step 1: Clone and install
```bash
git clone https://github.com/YOUR_HANDLE/herald
cd herald
npm install
```

### Step 2: Set up 1Claw vault
```bash
# 1. Sign up at 1claw.dev (use code LEPTON26 for 6 months Pro free)
# 2. Create a vault named "herald-agent"
# 3. Store secrets:
#    - CIRCLE_API_KEY     → your Circle developer API key
#    - ANTHROPIC_API_KEY  → your Anthropic API key
#    - HERALD_DB_URL      → database connection string
# 4. Copy your vault ID and agent token to .env.local:
echo "ONECLAW_VAULT_ID=your_vault_id" >> .env.local
echo "ONECLAW_AGENT_TOKEN=your_agent_token" >> .env.local
```

### Step 3: Provision the agent wallet
```bash
# Install Circle CLI
npm install -g @circle-fin/cli

# Create an agent wallet on Arc testnet
circle wallets create --blockchain ARC-TESTNET --name "herald-agent"
# Copy the wallet ID output to your 1Claw vault as HERALD_WALLET_ID

# Fund the wallet with testnet USDC via TestMint
open https://testmint.myproceeds.xyz
# Follow TestMint flow: pay ~$0.01 → receive $5 testnet USDC
# Transfer to your agent wallet address

# Verify funding
circle wallets balance --wallet-id YOUR_WALLET_ID
```

### Step 4: Set up ARC CLI (optional but recommended)
```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
arc --help  # verify installation
```

### Step 5: Seed x402 sources
```bash
# Start the local mock x402 source server (for demo)
npm run sources:start

# Register known public x402-compatible sources
npm run seed:sources
```

### Step 6: Start HERALD
```bash
# Development (runs agent + API + frontend)
npm run dev

# Production
npm run build
npm run start
```

HERALD will be available at `http://localhost:3000`.

---

## 11. Key Code Patterns

### 11.1 Secrets fetched from 1Claw at runtime (never in env)

```typescript
// src/agent/secrets.ts
import { OneClaw } from '@1claw/sdk';

const client = new OneClaw({ token: process.env.ONECLAW_AGENT_TOKEN! });

export async function getCircleApiKey(): Promise<string> {
  const secret = await client.secrets.get(
    process.env.ONECLAW_VAULT_ID!,
    'CIRCLE_API_KEY'
  );
  return secret.value;
}

export async function getAnthropicKey(): Promise<string> {
  const secret = await client.secrets.get(
    process.env.ONECLAW_VAULT_ID!,
    'ANTHROPIC_API_KEY'
  );
  return secret.value;
}
// Keys never touch process.env after this point.
// They are passed directly to SDK constructors and then discarded.
```

### 11.2 x402 purchase with Circle Gateway nanopayment

```typescript
// src/agent/buyer.ts
import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient } from 'viem';
import { arcTestnet } from './chains';
import { getCircleApiKey } from './secrets';

export async function purchaseSource(
  url: string,
  maxPrice: number // in USDC cents, e.g. 0.003
): Promise<{ content: string; paid: number } | null> {
  
  const circleKey = await getCircleApiKey();
  
  // x402-fetch automatically handles: 402 → sign EIP-3009 → retry
  const payingFetch = wrapFetchWithPayment({
    walletClient: createWalletClient({ chain: arcTestnet }),
    gatewayApiKey: circleKey,
    maxPaymentAmount: maxPrice,
    currency: 'USDC'
  });

  try {
    const response = await payingFetch(url);
    if (!response.ok) return null;
    
    const content = await response.text();
    const paid = parseFloat(response.headers.get('x-payment-amount') ?? '0');
    
    // Emit to live feed
    emit('payment:sent', { url, paid, timestamp: Date.now() });
    
    return { content, paid };
  } catch (err) {
    // Insufficient funds, or source rejected — log as skipped
    emit('payment:skipped', { url, reason: err.message });
    return null;
  }
}
```

### 11.3 x402 middleware for selling briefs

```typescript
// src/server/x402-middleware.ts
import { paymentMiddleware } from 'x402-express';
import { getCircleApiKey } from '../agent/secrets';

export async function setupX402Middleware(app: Express) {
  const circleKey = await getCircleApiKey();
  
  // This protects GET /briefs/:id
  // Any agent (or human's agent) must pay $BRIEF_PRICE to access
  app.use(
    '/briefs/:id',
    paymentMiddleware({
      paymentRequired: true,
      // Price is stored per-brief in the database
      amount: async (req) => {
        const brief = await db.briefs.findById(req.params.id);
        return brief?.price ?? 0.05; // default $0.05
      },
      currency: 'USDC',
      network: 'arc-testnet',
      receivingWalletId: process.env.HERALD_WALLET_ID,
      gatewayApiKey: circleKey,
      onPaymentReceived: (payment) => {
        emit('payment:received', {
          briefId: payment.resourceId,
          amount: payment.amount,
          buyerAddress: payment.payerAddress,
          timestamp: Date.now()
        });
      }
    })
  );
}
```

### 11.4 Agent wallet balance check before session

```typescript
// src/agent/wallet.ts
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function getAgentBalance(): Promise<number> {
  const walletId = await getWalletId(); // from 1Claw vault
  const { stdout } = await execAsync(
    `circle wallets balance --wallet-id ${walletId} --json`
  );
  const data = JSON.parse(stdout);
  return parseFloat(data.balance.usdc ?? '0');
}

export async function checkBeforeSession(sessionBudget: number): Promise<boolean> {
  const balance = await getAgentBalance();
  if (balance < sessionBudget * 1.1) { // 10% buffer
    emit('agent:low-balance', { balance, required: sessionBudget });
    return false;
  }
  return true;
}
```

### 11.5 Real-time feed via Server-Sent Events

```typescript
// src/server/routes/agent.ts
import { eventBus } from '../../shared/events';

// GET /api/agent/economy-feed
router.get('/economy-feed', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const handler = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.onAny(handler);
  req.on('close', () => eventBus.offAny(handler));
});
```

### 11.6 Claude synthesis prompt

```typescript
// src/agent/synthesize.ts
const SYNTHESIS_PROMPT = `
You are HERALD, an autonomous research agent. You have purchased and read 
the following sources. Synthesize them into a concise research brief.

RULES:
- Maximum 400 words
- Structure: [KEY FINDING] → [SUPPORTING EVIDENCE] → [GAPS/UNCERTAINTIES]
- Do not reproduce more than 12 consecutive words from any source
- List all sources used at the end with their purchase cost
- Rate your confidence: HIGH / MEDIUM / LOW

TOPIC: {{TOPIC}}
SOURCES: {{SOURCES}}

Output as JSON:
{
  "title": "...",
  "keyFinding": "...",
  "supportingPoints": ["...", "..."],
  "gaps": ["..."],
  "confidence": "HIGH|MEDIUM|LOW",
  "sources": [{ "url": "...", "cost": 0.003 }],
  "productionCost": 0.041
}
`;
```

---

## 12. UI Design Specification

### Color Tokens
```css
:root {
  --bg-base:      #070B14;   /* deep navy — Arc's dark */
  --bg-card:      #0D1424;   /* card surfaces */
  --bg-hover:     #141E35;   /* hover states */
  
  --usdc-blue:    #2775CA;   /* USDC brand color — spend events */
  --earn-mint:    #4DFFD2;   /* earnings — bright mint */
  --ai-purple:    #A78BFA;   /* synthesis / AI elements */
  --warn-amber:   #F59E0B;   /* warnings, near-budget */
  
  --text-primary: #E2E8F0;
  --text-muted:   #64748B;
  --text-data:    #94A3B8;
  
  --border:       rgba(255, 255, 255, 0.07);
  --border-glow:  rgba(39, 117, 202, 0.25); /* USDC blue glow */
}
```

### Typography
```css
/* Display / headings */
font-family: 'Space Grotesk', sans-serif;
/* This is Arc's own documentation font — judges will feel at home */

/* Body */
font-family: 'Inter', sans-serif;

/* Amounts, addresses, live data */
font-family: 'JetBrains Mono', monospace;
font-variant-numeric: tabular-nums;
```

### Signature Design Element: The Flow Graph
The D3 force-directed graph in the Economy screen is HERALD's signature visual.
It should feel like a breathing organism — nodes pulse when active, edges animate
when payments move. It is the only place animation is used freely. Everything else
is static and clean.

```
Implementation notes:
- Agent center node: 24px radius, pulses at 1.5s interval
- Source nodes: radius = 6 + (totalPaidToSource * 1000)px, capped at 18px
- Buyer nodes: radius = 6 + (totalEarnedFromBuyer * 1000)px, capped at 18px
- Payment particle: 4px circle, animates along edge over 0.8s, then fades
- Colors: source nodes = var(--usdc-blue), buyer nodes = var(--earn-mint)
- Edge: 1px, opacity 0.3 at rest, 0.8 during active payment
```

### Motion Principles
- Payment received (★): card border briefly glows mint for 1s
- Payment sent (●): a small USDC-blue dot slides out of the balance card
- Brief published: the brief card slides in from the right
- Low balance warning: balance number turns amber, no animation
- Everything else: no animation (respects reduced-motion preference)

---

## 13. Traction Strategy (The 2-Week Plan)

**The problem:** Without traction, the project scores zero on 30% of the rubric.
HERALD has a structural traction advantage: every active agent session generates
10–50 nanopayments. Here is how to reach the required volume.

### Week 1 (Jun 15–22): Seed the Network
```
Day 1–2:  Deploy HERALD with 3 seed topics (AI regulation, crypto markets,
          climate policy). Run agents manually to generate first 100 payments.
          
Day 3–4:  Post in Canteen Discord + Arc builder Discord:
          "My HERALD agent made $0.15 today by selling its research.
           Here's a link to buy its latest brief → [x402 URL]"
          → Every Discord purchase = 1 real nanopayment from another person's agent
          
Day 5–6:  Post in Twitter/X to AI/crypto communities:
          "I deployed an AI agent that pays for its own research and sells 
           its findings. It made $0.42 in testnet USDC today. Here's the live
           dashboard → [public read-only link]"
           
Day 7:    Onboard 5 early users from Discord. Each runs a HERALD agent on 
          their own topic. Now 6 agents are running simultaneously.
```

### Week 2 (Jun 22–29): Compound Traction
```
Day 8–10: With 6 agents running, they start buying each other's briefs.
          The marketplace fills with content. More agents = more purchases.
          Target: 50 briefs published, 200+ inter-agent purchases.
          
Day 11–12: Share a "HERALD Weekly" screenshot: total economy stats across
           all agents. "This week, 6 HERALD agents collectively spent $4.12
           on sources, earned $2.89 selling briefs, and made 647 nanopayments."
           
Day 13–14: Final push. Share the public Agent Flow graph URL — a live,
           shareable visualization of the HERALD economy. This is
           inherently shareable and demo-able by judges without setup.
```

### Traction Targets
| Metric | Target |
|--------|--------|
| HERALD agents deployed | 10–15 |
| Total nanopayments | 500+ |
| Total test USDC moved | $5–$15 |
| Briefs published | 50+ |
| Inter-agent brief purchases | 100+ |
| Daily active agents | 8+ by day 14 |

### Traction Proof Points for Submission
1. Screenshot of Circle Gateway transaction history (500+ transactions)
2. Screenshot of agent wallet balance sheet (spending + earnings)
3. Public read-only dashboard URL with live economy feed
4. Agent marketplace URL with purchasable briefs
5. Discord thread with community users testing HERALD

---

## 14. Judging Criteria Alignment

| Criterion | Weight | HERALD's Angle | Score Potential |
|---|---|---|---|
| **Agentic Sophistication** | 30% | Agent decides what to pay, how much, what to skip, and prices its own work. Two-sided economic actor. Not automation — actual cost-benefit decisions per source. | **Full** |
| **Traction** | 30% | 6+ agents × 10 sessions/day × 10 payments/session × 14 days = 8,400 payments. Real users onboarded via Discord. | **Full** |
| **Circle Tool Usage** | 20% | x402 (both buy AND sell), Agent Wallets, Circle Gateway, Nanopayments, Circle CLI, USDC on Arc, TestMint, 1Claw. All 7 tools used substantively. | **Full** |
| **Innovation** | 20% | First product where the same agent is x402 buyer AND seller. First product where nanopayments create "economic accountability" for AI consumption. First "agent P&L" as a UX paradigm. | **Full** |

### The "Wow" Statement for Judges
> *"HERALD uses x402 as a two-sided protocol for machine-to-machine content
> commerce. When your agent buys a source, that payment is Circle Gateway
> nanopayment #1. When another agent buys your brief, that's nanopayment #2.
> This is the agent economy Circle built Arc for — not as a concept, but
> running live, with a P&L you can read."*

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Not enough x402-gated sources exist yet | Seed a local `x402-sources` mock server with 30 sample articles. Deploy 2–3 real x402 endpoints on public content. The mock server is clearly labeled as demo content. |
| Bootstrap problem (agents need to buy each other) | Seed with 3 HERALD agents on different topics before user onboarding. These "seed agents" create the initial marketplace. |
| Circle Gateway batching delay | Payments still verify in <500ms (signature verification is instant). Onchain settlement is batched but the agent doesn't wait for it — it verifies the EIP-3009 signature locally. |
| Claude synthesis costs accumulate | Claude claude-sonnet-4-6 is ~$0.003 per synthesis. At 2 briefs/day per agent, this is $0.006/day/agent. Negligible vs. the testnet USDC budget. |
| 1Claw setup complexity for judges | Pre-populate a demo vault. In README: "For quick demo: copy `.env.example` to `.env.local` and use the provided demo keys. For production: use 1Claw." |

---

## 16. Submission Checklist

- [ ] Public GitHub repository with full source code
- [ ] README with: 1-paragraph pitch, 5-minute setup guide, architecture diagram
- [ ] Live deployed demo URL (Vercel/Railway recommended)
- [ ] Public read-only Economy dashboard URL
- [ ] Loom video (≤3 minutes):
  - [ ] Show onboarding (3 steps, < 60 seconds)
  - [ ] Show Economy screen with live feed running
  - [ ] Show a brief being purchased from the Marketplace
  - [ ] Show the Agent Flow graph animating
  - [ ] Briefly mention the Circle/Arc tech stack used
- [ ] Traction evidence:
  - [ ] Screenshot of Gateway transaction count
  - [ ] Screenshot of agent wallet P&L
  - [ ] Number of agents deployed + users onboarded
- [ ] Circle tools used: document each in README
- [ ] 1Claw code: show `secrets.ts` usage in demo

---

## 17. Post-Hackathon Vision

HERALD is not a demo. It is the beginning of a knowledge economy protocol.

**Phase 2 (month 1–3):**
- HERALD Network: agents discover each other via the Agent Marketplace
- Source verification: onchain attestation that a source was paid and read
- Topic specialization: agents develop "expertise" through payment history

**Phase 3 (month 4–12):**
- Public HERALD Protocol: any developer can build an agent that participates
- Source creator dashboard: writers track earnings from agent purchases
- HERALD token (on Arc): governance for the source quality registry

**The long-term bet:** As AI agents proliferate, they will need an economic
accountability layer for the knowledge they consume. HERALD is that layer —
built on Arc, settled in USDC, using x402 as the universal content protocol.

---

*HERALD — Built for the Lepton Agents Hackathon by Canteen × Circle × Arc*
*"The herald was paid for every retelling, not only the first." — Lepton Prior Art #01*
