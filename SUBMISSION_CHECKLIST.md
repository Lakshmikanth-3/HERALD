# HERALD — Submission Checklist

**Lepton Agents Hackathon (Canteen × Circle × Arc)**
Numbers below pulled live from a running instance — rerun
`curl http://localhost:3001/api/agent/network-stats` to get current ones;
don't treat these as fixed.

## Real, live economic activity

| Metric | Value |
|---|---|
| Briefs published | 9 |
| Sources purchased (real x402) | 50 |
| Total spent (buy-side) | $0.2347 |
| Total earned (brief sales) | $1.1581 |
| Total source sales (sell-side, separate treasury) | $0.0270 |
| Total payment records logged | 421 |
| Agent wallet balance right now | $7.8689 USDC |

## Real, verifiable addresses (Arc testnet, chain id `5042002`)

| What | Address / value |
|---|---|
| Agent wallet | `0x1fc8b69f563d2f3fe54ca8a693921f53d11eab89` |
| Sources treasury wallet | `0x6c1a620d4d8eded0ee2de5a4051e1d1ef3c90e9d` |
| USDC contract | `0x3600000000000000000000000000000000000000` |
| Gateway wallet contract | `0x0077777d7eba4688bdef3e311b846f25870a19b9` |
| Explorer | https://testnet.arcscan.app |

Every address above is clickable/copyable live on `/how-it-works` and
`/network`.

## Functional completeness

- [x] Real Circle Developer-Controlled Wallets (agent + sources treasury +
      demo buyer, three separate wallets)
- [x] Real x402 buy-side settlement (agent pays for sources)
- [x] Real x402 sell-side settlement, including a genuine third-party
      purchase from an independently funded wallet
- [x] Real Circle Gateway deposits (on-chain approve + deposit, real tx hashes)
- [x] Real Gemini synthesis from actually-paid-for content
- [x] Real 1Claw-vaulted secrets (never sit in `process.env` at runtime)
- [x] Agent-to-agent marketplace purchasing — real scoring/purchase code,
      documented single-instance no-op (self-exclusion confirmed live)
- [x] Brief detail page with a full real payment-receipt manifest
- [x] Live Agent Reasoning decision log (built from real emitted fields,
      nothing new invented for display)
- [x] Public, read-only `/network` dashboard with a real per-cycle P&L timeline
- [x] `?demo=1` presentation mode for recordings (no functional change)

## Test gate (all green as of this submission)

- [x] `next lint` — 0 warnings/errors
- [x] `tsc --noEmit` — 0 errors
- [x] `npm run test:unit` — 30/30 passing
- [x] `npm run test` (integration, live server) — 10/10 passing
- [x] `npm run test:playwright` (real Chromium, 1440px + 375px) — 38/38 passing
- [x] `npm run build` — succeeds with the dev server stopped

## Known, honestly-documented limitations

- Vercel deployment (`lepton-blue.vercel.app`) is frontend-only — the
  Express API/agent loop needs a persistent process, so live features
  require running the backend locally alongside it.
- Agent-to-agent purchasing self-excludes in this single-instance
  deployment (real code, would complete a genuine cross-agent purchase
  against a second independent HERALD instance).
- 1Claw's vault occasionally answers with its own real-money x402
  challenge as an apparent rate-limit fallback — never auto-paid, retried
  with backoff instead.
- 7 pre-existing `npm audit` findings (Next.js/postcss/ws) — not fixed,
  judged lower risk than a mid-hackathon major-version bump.

## Where to look

- **Live demo (frontend only):** https://lepton-blue.vercel.app
- **Full write-up:** [`PROJECT_REPORT.md`](./PROJECT_REPORT.md)
- **Setup & architecture:** [`README.md`](./README.md)
- **Recording walkthrough:** [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
