// HERALD — Global SSE Event Bus
// All agent decisions are emitted here and pushed to connected dashboards

import { EventEmitter2 } from 'eventemitter2';
import type { EconomyEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

export const eventBus = new EventEmitter2({
  wildcard: true,
  maxListeners: 100,
});

export function emit(type: EconomyEvent['type'], data: Record<string, unknown>): void {
  const event: EconomyEvent = {
    id: uuidv4(),
    type,
    data,
    timestamp: Date.now(),
  };
  // With wildcard mode on, emitting the specific type already reaches '*'
  // subscribers (verified: eventemitter2 matches '*' against the type-named
  // emit itself). A second explicit eventBus.emit('*', event) call here
  // double-fired every listener on '*' — including the SSE route in
  // server/routes/agent.ts — sending each real event to the frontend twice.
  // That doubling was silently duplicating every Live Feed entry, cycle
  // event, and FlowGraph edge, and was the root cause of the React
  // "duplicate key" warning and the Economy page growing unbounded during a
  // live agent cycle.
  eventBus.emit(type, event);
}
