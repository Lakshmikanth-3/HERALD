const fs = require('fs');
let f = fs.readFileSync('src/app/page.tsx', 'utf8');

const replacements = [
  [/Shashi\.ai/g, 'HERALD'],
  [/Autonomous Hospitality/g, 'Autonomous Research'],
  [/AGENTIC AI — HOSPITALITY/g, 'AGENTIC AI — RESEARCH'],
  [/orchestrates and personalises every guest interaction — from first booking to final checkout — through a single intelligent layer that connects your entire hotel ecosystem./g, 'autonomously navigates the web, using x402 nanopayments to purchase premium sources and synthesize high-value intelligence briefs.'],
  [/PILOT LIVE — SHASHI HOTEL/g, 'LIVE ON ARC TESTNET'],
  [/SECTOR: HOSPITALITY TECH/g, 'SECTOR: WEB3 AI'],
  [/PLATFORM: HERALD/g, 'PROTOCOL: x402 & EIP-3009'],
  [/Guest Experience Engine/g, 'Economic Research Engine'],
  [/PERSONALISATION/g, 'DISCOVERY'],
  [/AUTOMATION/g, 'SYNTHESIS'],
  [/HERALD doesn\\'t replace your existing hotel technology\. It sits above your PMS and CRS as an intelligent orchestration layer — unifying fragmented guest data, automating decisions in real time, and delivering hyper-personalised experiences without a single rip-and-replace\./g, "HERALD doesn't just read free RSS feeds. It sits above the x402 protocol layer — utilizing programmatic stablecoin wallets to bypass paywalls, evaluate content value, and acquire intelligence without human intervention."],
  [/EXISTING SYSTEMS/g, 'NEWS SOURCES'],
  [/PMS &amp; CRS/g, 'Paywalled APIs'],
  [/INTELLIGENCE/g, 'ECONOMIC LAYER'],
  [/HERALD Layer/g, 'HERALD Agent'],
  [/EXPERIENCE/g, 'MARKETPLACE'],
  [/Guest App/g, 'Brief Library'],
  [/Ready to Orchestrate<br \/>\n\s*<span className="italic text-neutral-500">Every Stay\?<\/span>/g, 'Ready to Deploy<br />\n              <span className="italic text-neutral-500">Your Agent?</span>'],
  [/Join the hotels already delivering the future\. Schedule a personalised demo and see HERALD live\./g, 'Join the agents already participating in the x402 economy. Configure a budget and see HERALD live.']
];

for (const [regex, replacement] of replacements) {
  f = f.replace(regex, replacement);
}

fs.writeFileSync('src/app/page.tsx', f);
console.log('Replacements applied successfully.');
