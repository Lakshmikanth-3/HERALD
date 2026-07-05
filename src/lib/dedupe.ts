// Filters a list down to items not already seen, recording the new ones in
// the same pass. Extracted from FlowGraph's event-processing effects, where
// re-running over the whole accumulated event array on every new SSE event
// (instead of just the new ones) was silently double-counting node totals
// and re-spawning particles for every past event each time a new one arrived.
export function dedupeNewById<T extends { id: string }>(seen: Set<string>, items: T[]): T[] {
  const fresh: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    fresh.push(item)
  }
  return fresh
}
