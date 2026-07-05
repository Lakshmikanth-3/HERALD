// HERALD — Paid Sources Seeder
// Populates the paid_sources table with genuine, originally-authored short
// research notes that HERALD's own server charges to read via a real x402
// gate (src/server/routes/sources.ts). This is what gives the agent's
// buyer.ts something that actually responds HTTP 402 in practice — the
// public RSS feeds in discover.ts never do.
//
// Usage: npx tsx scripts/seed-paid-sources.ts

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { insertPaidSource } from '../src/shared/db';
import type { PaidSource } from '../src/shared/types';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

const now = Math.floor(Date.now() / 1000);

const NOTES: Array<{ id: string; title: string; priceUsd: number; content: string }> = [
  {
    id: 'note-nanopayment-economics',
    title: 'Why Sub-Cent Nanopayments Change Agent Economics',
    priceUsd: 0.001,
    content: `Most content pricing assumes a human decides once whether $5-10/month is worth it. An
autonomous agent evaluating hundreds of sources per day needs a unit price small enough that a
wrong call costs nothing to unwind. That's the real argument for sub-cent settlement: it isn't
about making payments "smaller," it's about making the wrong purchase decision economically
irrelevant, which is what lets an agent try a source instead of researching it in advance.

This only works if the settlement layer's fixed costs are also near zero. A payment rail with
meaningful gas or per-transaction fees pushes the practical minimum price back up into cents,
which reintroduces the same "is this worth it" calculation a human would make — except now an
agent is making it thousands of times a day, at which point the fee overhead dominates the actual
content value.

The interesting design space is two-step evaluation: pay a fraction of a cent for a preview or
metadata signal, then decide whether the full-price read is worth it. That pattern is only
economically sane at sub-cent resolution — a $0.001 "is this worth reading" fee would be
meaningless at typical web-payment price floors, but it's exactly the right shape for an agent
that reads thousands of headlines and only wants to commit real budget to a handful of them.

None of this requires the content itself to be expensive. A $0.002 article and a $20 article can
use the same settlement rail; what changes is how many of them an agent is willing to sample
before it finds one worth synthesizing.`,
  },
  {
    id: 'note-agent-marketplaces',
    title: 'Agent-to-Agent Content Marketplaces: What Actually Has to Be True',
    priceUsd: 0.001,
    content: `For agents to buy and sell each other's work — not just consume human-produced content — a
few conditions have to hold simultaneously, and most "agent economy" pitches only satisfy one or
two of them.

First, the buying agent needs an actual budget it can't exceed, not a soft limit enforced by
application logic. A budget that's just a config value the same process could ignore isn't a
constraint, it's a suggestion. A wallet that literally cannot spend more than it holds is a
different kind of guarantee, and it's the one that makes "the agent decided this wasn't worth it"
a real economic signal rather than a scripted branch.

Second, the seller has to be able to price and gate content without a human in the loop per
transaction. That means the payment challenge and its verification have to be automatable end to
end — no manual invoice, no human approving each sale — or the "market" is just a slow B2B sales
process wearing an agent costume.

Third, and easiest to miss: the same agent being both a buyer and a seller isn't a novelty, it's
close to necessary for the economics to close. An agent that only spends needs an external funding
source forever. An agent that only earns has no reason to exist unless something else is doing the
paying. The interesting case is the one where an agent's own research spend is partially offset by
selling what it learned — because that's the only version where the loop can run without a human
topping up the balance every week.`,
  },
  {
    id: 'note-stablecoin-settlement',
    title: 'Comparing Stablecoin Settlement Rails for Machine-to-Machine Payments',
    priceUsd: 0.001,
    content: `When the payer and payee are both software, the settlement rail's properties matter more than
its brand. Three things dominate the comparison: finality latency, fee structure at small
transaction sizes, and whether the payer needs to hold a volatile gas token.

Finality latency matters because an agent's decision loop is often blocking on "did the payment go
through" before it does anything with the content it just bought. A rail with multi-minute
finality forces the agent to either wait (bad for throughput) or optimistically proceed before
settlement confirms (bad for correctness if the payment later fails). Sub-second finality collapses
that tradeoff — the agent can treat "payment accepted" and "content unlocked" as effectively the
same event.

Fee structure at small transaction sizes is the more consequential of the two once you're doing
volume. A rail that charges a small fixed fee per transfer is fine for a $20 purchase and useless
for a $0.002 one — the fee dwarfs the price. Batched settlement, where many small authorizations
are aggregated into fewer on-chain transactions, is one practical way around this: the agent still
gets to price and settle per-source, but the chain only sees the aggregate.

Gas-token custody is the detail that's easy to underweight in a pitch deck and expensive in
practice: an agent whose "USDC budget" also requires it to separately hold and manage a second,
price-volatile token for gas has effectively doubled its treasury-management surface area for no
benefit to the actual transaction it's trying to make. Paying gas in the same stable asset you're
already settling in removes an entire category of operational failure mode.`,
  },
  {
    id: 'note-ai-agent-enterprise',
    title: 'What "Autonomous" Actually Means in Enterprise Agent Deployments',
    priceUsd: 0.001,
    content: `"Autonomous" gets used to describe systems with wildly different amounts of actual
independent judgment. It's worth separating three tiers, because the risk profile and the
monitoring requirements are completely different at each.

The first tier is scripted automation with an LLM step inside it — the control flow is fixed, the
model fills in one or two fields, and the "autonomy" is really just natural-language parsing
bolted onto a deterministic pipeline. This is the safest and least interesting tier, but a lot of
enterprise "AI agent" rollouts are actually here.

The second tier is bounded decision-making: the model chooses among a fixed menu of actions based
on context, but every action has been pre-approved and the menu doesn't change. This is where most
production agent deployments that actually touch money or customer-facing systems currently sit,
because it's auditable — you can enumerate every possible action the system could have taken and
review the policy around each one.

The third tier is open-ended tool use where the agent can chain novel sequences of actions that
weren't individually anticipated. This is the tier most "autonomous agent" marketing implies, and
it's also the tier where the actual economic guardrail — a budget the agent literally cannot
exceed, verified by something outside the agent's own control flow — stops being a nice-to-have
and becomes the only thing standing between "agent explored a bad plan" and "agent did something
expensive and irreversible." Systems that claim tier-three autonomy without a tier-three-appropriate
hard constraint are usually tier two with more confident language.`,
  },
  {
    id: 'note-climate-financing-gap',
    title: 'The Climate Adaptation Financing Gap Is a Deployment Problem, Not Just a Funding One',
    priceUsd: 0.001,
    content: `Adaptation financing — money spent preparing for climate impacts that are already locked in,
as opposed to mitigation spending aimed at preventing further warming — gets less attention than
mitigation, and the usual explanation is that there simply isn't enough capital committed to it.
That's true, but it undersells a second, more tractable problem: a meaningful share of adaptation
funding that is committed doesn't reach the projects it was earmarked for, or arrives too slowly
to matter for the decision it was meant to inform.

Three structural reasons show up repeatedly. First, adaptation projects are often small and
localized — a drainage system for one district, a drought-resistant seed program for one region —
which makes them expensive to originate and monitor relative to their size, so financing
intermediaries systematically prefer larger, more centralized projects even when the smaller ones
have better return-on-resilience. Second, the entities best positioned to identify where adaptation
spending is most urgently needed (local governments, community organizations) are often the least
equipped to satisfy the reporting and compliance requirements that international or institutional
funders attach to disbursement. Third, adaptation benefits are harder to quantify ex ante than
mitigation benefits — "tons of CO2 avoided" is a standardized metric; "flood damage avoided in a
county that hasn't flooded yet" is not — which makes adaptation projects harder to compare against
each other for capital allocation purposes, even when the underlying need is clear.

None of these are funding-level problems in the sense of "not enough money exists." They're
allocation and monitoring-infrastructure problems, which means the fix is not purely more
commitments at climate summits — it's smaller-project financing vehicles, standardized
adaptation-outcome metrics, and disbursement mechanisms that don't require a small municipal office
to run a grant-compliance department.`,
  },
  {
    id: 'note-semiconductor-supply-chains',
    title: 'Semiconductor Supply Chain Resilience After Repeated Export Control Shifts',
    priceUsd: 0.001,
    content: `Every round of export control tightening on advanced semiconductor equipment produces the
same predictable second-order effect: affected firms accelerate diversification of their supplier
base, and unaffected firms in adjacent markets accelerate stockpiling in anticipation of being
next. Both responses increase measured "supply chain resilience" in the short term while doing
very little to address the underlying concentration risk, because the equipment and materials
being diversified toward are frequently sourced from the same small set of upstream suppliers as
before — diversification of the assembler doesn't help if the photolithography equipment, the
specialty gases, or the advanced packaging substrates all still trace back to one or two real
bottlenecks a few tiers up the chain.

The more durable resilience gains have come from a less visible source: standardization efforts
that let a fab qualify a second supplier's component against the same process specification without
re-validating an entire production line from scratch. That kind of work doesn't generate the same
headlines as a new fab announcement, but it's the difference between "we have a second supplier on
paper" and "we could actually switch to that second supplier within a production-relevant
timeframe if the first one became unavailable."

The practical takeaway for anyone modeling supply chain risk in this sector is to weight
concentration at the equipment and materials tier more heavily than concentration at the assembly
or packaging tier — headline diversification announcements tend to be at the tier that's easiest
to diversify and least load-bearing for actual resilience.`,
  },
];

async function main() {
  console.log('HERALD — Paid Sources Seeder');
  console.log('=============================\n');

  for (const note of NOTES) {
    const source: PaidSource = {
      id: note.id,
      title: note.title,
      domain: 'herald-originals',
      content: note.content.trim(),
      priceUsd: note.priceUsd,
      wordCount: wordCount(note.content),
      publishedAt: now,
      revenue: 0,
      purchases: 0,
    };
    insertPaidSource(source);
    console.log(`  ✓ ${note.id} — $${note.priceUsd.toFixed(3)} — "${note.title}"`);
  }

  console.log(`\n✅ Seeded ${NOTES.length} paid sources.`);
  console.log('The agent will now discover these via GET /api/sources and may pay to read them for real.');
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
