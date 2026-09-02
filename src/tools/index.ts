import type { Actor } from "../cf-foundation/actor.js";
import type { ApplicationStore } from "../lib/store.js";
import { createReadTools, type NavState } from "./read.js";
import { createWriteTools } from "./write.js";
import { createHigherOrderTools, type HigherOrderDeps } from "./higher-order.js";

export type { NavState } from "./read.js";

export function createConsequenceTools(params: {
  store: ApplicationStore;
  actor: Actor;
  getNav: () => NavState;
  setNav: (n: NavState) => void;
  confirmations: HigherOrderDeps;
}) {
  const read = createReadTools(params.store, params.getNav);
  const write = createWriteTools(params.store, params.actor, params.setNav);
  const higherOrder = createHigherOrderTools(params.store, params.actor, params.confirmations);

  return {
    read: Object.values(read),
    write: Object.values(write),
    higherOrder: Object.values(higherOrder),
    all: [...Object.values(read), ...Object.values(write), ...Object.values(higherOrder)],
  };
}
