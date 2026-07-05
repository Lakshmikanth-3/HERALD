// Signed USD formatting — a real, if minor, bug lived here three times over
// (a hardcoded `-` prefix ahead of a value that could itself carry a sign,
// producing `-$0.0369`-style double negatives). Centralized so a future fix
// only has to happen once, and so the sign-placement logic itself has
// something to unit test.
export function formatSigned(amount: number, decimals = 4): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(amount).toFixed(decimals)}`
}
