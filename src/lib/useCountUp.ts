'use client'

import { useEffect, useRef, useState } from 'react'
import { useSafeReducedMotion } from '../app/components/landing/useSafeReducedMotion'

// Animates a real number from its previous value to its new one — used on
// balances, revenue, and network stats so a live number update reads as
// "counting up" rather than just popping to a new digit. Never invents the
// number itself; it only animates the transition between two real values
// already fetched from the API.
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const reducedMotion = useSafeReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value)
      prevRef.current = value
      return
    }
    const from = prevRef.current
    const to = value
    if (from === to) return
    const start = performance.now()
    let raf: number

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs, reducedMotion])

  return display
}
