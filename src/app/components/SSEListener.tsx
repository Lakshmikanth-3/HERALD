'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { EconomyEvent } from '../../shared/types'

interface Props {
  onEvent: (event: EconomyEvent) => void
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function SSEListener({ onEvent }: Props) {
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const es = new EventSource(`${API}/api/agent/economy-feed`)
    esRef.current = es

    // Listen to all named events the agent emits
    const eventTypes: EconomyEvent['type'][] = [
      'payment:sent',
      'payment:received',
      'payment:skipped',
      'brief:published',
      'agent:cycle:start',
      'agent:cycle:end',
      'agent:low-balance',
      'agent:deposit',
      'agent:withdrawal',
      'discovery:bought',
      'discovery:skipped',
    ]

    eventTypes.forEach(type => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          onEvent(JSON.parse(e.data) as EconomyEvent)
        } catch {}
      })
    })

    es.onerror = () => {
      // Reconnect after 3s on error
      setTimeout(() => {
        if (esRef.current?.readyState === EventSource.CLOSED) connect()
      }, 3000)
    }
  }, [onEvent])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])

  return null  // no UI — pure side-effect component
}
