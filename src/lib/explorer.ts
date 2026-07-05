// Arc testnet's real Blockscout-based block explorer (confirmed live,
// chain id 5042002 — matches src/shared/chain.ts's ARC_TESTNET_CHAIN_ID).
// Single source of truth so every "verify it's real" link in the UI points
// to the same place.
export const ARC_EXPLORER = 'https://testnet.arcscan.app'

export function txUrl(txHash: string): string {
  return `${ARC_EXPLORER}/tx/${txHash}`
}

export function addressUrl(address: string): string {
  return `${ARC_EXPLORER}/address/${address}`
}

export function shortAddr(address: string): string {
  return address.length > 12 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address
}

export function shortTx(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash
}

// Circle Gateway batches multiple x402 micropayments and settles them
// on-chain later — its settle() response returns a settlement/batch ID
// (a UUID), not the eventual on-chain tx hash, so it won't resolve on a
// block explorer. Only real EVM tx hashes (e.g. from direct wallet
// transfers or Gateway approve/deposit calls) match this shape. Checking
// before linking avoids showing a broken "view on explorer" link.
export function isRealTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}
