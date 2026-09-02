import type { Actor } from "../cf-foundation/actor.js";
import type { ActionType } from "../shared/reducer.js";
import { reduce } from "../shared/reducer.js";
import type { Application } from "../shared/types.js";

export type StoreListener = (state: Application) => void;

/**
 * Client-side application store. Same shape as Cadence's — dispatch routes
 * every mutation through the shared `reduce()`, `applyRemote` absorbs
 * server-broadcast patches from other viewers (the applicant, an invited
 * reviewer) without re-broadcasting, `hydrate` adopts the initial server
 * snapshot. No undo stack here: an application's history is meant to be
 * append-only and auditable (see `get_history`/the hash-chained audit log
 * in `../cf-foundation/actor.js`), not silently rewound.
 */
export function createApplicationStore(initial: Application) {
  let state = initial;
  let auditTrail: unknown[] = [];
  const listeners = new Set<StoreListener>();
  let onDispatch: ((action: ActionType, actor: Actor) => void) | null = null;

  function getState(): Application {
    return state;
  }

  function subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify(): void {
    for (const listener of listeners) listener(state);
  }

  function onLocalDispatch(handler: (action: ActionType, actor: Actor) => void): void {
    onDispatch = handler;
  }

  function dispatch(action: ActionType, actor: Actor, options: { broadcast?: boolean } = {}): unknown {
    const result = reduce(state, action, actor);
    state = result.state;
    notify();
    if (options.broadcast !== false) onDispatch?.(action, actor);
    return result.after;
  }

  function applyRemote(action: ActionType, actor: Actor): void {
    state = reduce(state, action, actor).state;
    notify();
  }

  function hydrate(next: Application): void {
    state = next;
    notify();
  }

  function setAuditTrail(records: unknown[]): void {
    auditTrail = records;
  }

  function getAuditTrail(): unknown[] {
    return auditTrail;
  }

  return { getState, subscribe, dispatch, applyRemote, hydrate, onLocalDispatch, setAuditTrail, getAuditTrail };
}

export type ApplicationStore = ReturnType<typeof createApplicationStore>;
