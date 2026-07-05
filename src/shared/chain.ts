// HERALD — Arc Testnet chain configuration
// Single source of truth for the network identifier and USDC token address
// used across the x402 buy side (agent/buyer.ts, server/routes/agent.ts)
// and sell side (server/routes/briefs.ts). No fallback values: if these
// aren't configured, x402 payments cannot be signed or verified correctly,
// so callers must fail loudly instead of guessing.

export const NETWORK = process.env.NETWORK ?? 'ARC-TESTNET';

// Verified 2026-07-04 directly against Arc Testnet via https://rpc.testnet.arc.network:
//   - eth_call to name()    on the USDC contract decodes to "USDC"
//   - eth_call to version() on the USDC contract decodes to "2"
//   - chain id 5042002 comes from viem's official `arcTestnet` chain definition
// These are the exact values the deployed contract's EIP-712 domain separator
// uses, so they must match exactly or signed authorizations will be rejected
// on-chain even though Circle's off-chain signing API will happily sign them.
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const USDC_DOMAIN_NAME = 'USDC';
export const USDC_DOMAIN_VERSION = '2';

export function getUsdcTokenAddress(): string {
  const address = process.env.USDC_ARC_TESTNET_ADDRESS;
  if (!address) {
    throw new Error(
      'USDC_ARC_TESTNET_ADDRESS is not configured. Set it in .env.local to the real USDC token contract address on Arc Testnet before making x402 payments.'
    );
  }
  return address;
}

// Real x402 protocol config for Circle's Gateway batching (@circle-fin/x402-batching),
// the actual reference implementation the Lepton hackathon points to
// (github.com/circlefin/arc-nanopayments). Verified live 2026-07-04 by calling
// BatchFacilitatorClient.getSupported() against Circle's real testnet Gateway API —
// not scraped/guessed. The x402 protocol network id is CAIP-2 format
// ("eip155:5042002"), distinct from Circle's wallet-API blockchain enum ("ARC-TESTNET")
// used elsewhere in this codebase for wallet creation/balance calls.
export const X402_NETWORK = 'eip155:5042002';
export const GATEWAY_API_TESTNET_URL = 'https://gateway-api-testnet.circle.com';
export const GATEWAY_WALLET_ADDRESS = '0x0077777d7eba4688bdef3e311b846f25870a19b9';
export const GATEWAY_BATCHING_DOMAIN_NAME = 'GatewayWalletBatched';
export const GATEWAY_BATCHING_DOMAIN_VERSION = '1';
