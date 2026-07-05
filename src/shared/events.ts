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
  eventBus.emit(type, event);
  eventBus.emit('*', event);   // wildcard subscribers (SSE router)
}
