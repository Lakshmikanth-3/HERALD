# HERALD — Demo Script (≤3 minutes)

A shot-by-shot sequence for a Loom/screen recording. Everything below is
real: no staged data, no rehearsed numbers — narrate over what's actually
on screen. Run `npm run dev` first and confirm both servers are up
(`http://localhost:3001/api/agent/status` should return `configured: true`).

---

## 0:00 – 0:15 — Open the stage

Navigate to **`http://localhost:3000/economy?demo=1`**.

> "This is HERALD — an autonomous research agent with its own real Circle
> wallet on Arc testnet. It pays to read sources, and sells what it learns.
> Everything on this screen is live data from a running agent, not a mock."

`?demo=1` hides the nav and zooms the dashboard ~15% for the recording —
same page, same real data, nothing simulated.

## 0:15 – 0:35 — Trigger a real cycle

Click **▶ Run Now**.

> "Watch the stepper — Discover, Score, Pay, Synthesize, Publish. Each step
> lights up as the agent actually completes it."

Point out, as they appear:
- The **payment ticker** scrolling real events under the nav.
- The **cycle stepper** filling in with a live pulse on the active step.
- The **Agent Reasoning** panel (already expanded in demo mode) printing
  real decision lines — `scoring <domain>… <score> → skip` /
  `→ paying $0.00X` — pulled straight from the same relevance scores and
  skip reasons the agent emits, not scripted text.

## 0:35 – 1:05 — Sources get paid for, brief publishes

> "Sources that clear the relevance bar get a real x402 nanopayment — watch
> the Agent Flow graph: a particle actually travels from the source node to
> HERALD when a payment settles."

Let the cycle finish (~20–30s). When `agent:cycle:end` fires:

> "And there's the brief — synthesized by Gemini from what it just paid to
> read, published behind HERALD's own x402 paywall."

## 1:05 – 1:45 — Open the brief detail page, show the receipts

Click through to the new brief (Library link, or `/library/:id` directly).

> "Every brief has its own page now. This teaser is free — reading the full
> body pays through a separate demo buyer wallet, since Circle correctly
> rejects the agent paying itself."

Click **Unlock full brief**. Scroll to the **Payment Receipts** section.

> "This is the real receipt manifest — every purchase of this brief, and
> what the agent paid for every cited source, each with a settlement ID or
> a real on-chain transaction hash linking straight to the Arc explorer."

Click one `tx …` link to show it resolves on `testnet.arcscan.app`.

## 1:45 – 2:15 — Library: the profitable flip

Navigate to `/library`.

> "Every brief tracks real revenue against real production cost."

If a brief crosses from break-even to profitable during the recording, the
card does a one-time mint glow and the badge pops to **PROFITABLE ✓** — real
state, not staged. If none flips live, point at an already-profitable card:

> "Cost to produce, revenue from real purchases, net — all real numbers,
> updated from the same database every 15 seconds."

## 2:15 – 2:45 — Network page: the whole economy, zoomed out

Navigate to `/network`.

> "This is a public, read-only view — no login. Total briefs, total spent,
> total earned, sources purchased — every number here comes straight from
> the database or a live API call."

Point at the **Cycle Timeline** strip at the bottom:

> "Each bar is one real cycle — mint above the line when a brief's price
> outweighed what it cost to make, red below. This is the whole economy's
> health over time, at a glance."

## 2:45 – 3:00 — Prove the 402 is real

Open a terminal, run:

```bash
BRIEF_ID=$(curl -s http://localhost:3001/api/briefs?limit=1 | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')
curl -i http://localhost:3001/api/briefs/$BRIEF_ID
```

> "And to prove none of this is theater — here's the raw HTTP response for
> that same brief's paywall, with no payment attached: a real
> `402 Payment Required`, with Circle Gateway's exact payment requirements
> in the body. That's what the agent itself parses to pay for a source, and
> what the demo buyer wallet parses to unlock a brief."

---

**Total: ~3:00.** Trim the middle wait (0:35–1:05) in editing if the cycle
runs long — the agent's own timing varies with real network conditions,
which is the point.
