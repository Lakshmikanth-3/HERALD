'use client'

import { useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

// framer-motion's useReducedMotion() can resolve the real OS preference
// before the client's first paint settles, which mismatches the
// server-rendered (always "no preference") HTML and triggers a React
// hydration warning on any motion element whose `initial` prop depends on
// it. Deferring the real value until after mount guarantees the first
// client render always matches what the server sent.
export function useSafeReducedMotion(): boolean {
  const actual = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? !!actual : false
}
