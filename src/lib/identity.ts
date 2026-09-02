import type { AgentActor, HumanActor, PermissionScope } from "../cf-foundation/actor.js";

/**
 * Same demo-identity approach as Cadence: a stable, unauthenticated local
 * id so every visitor lands on a populated application with zero signup.
 * See Cadence's README for the honest caveat — this is not real auth, but
 * the permission-grant mechanism it feeds is fully real.
 */
const STORAGE_KEY = "consequence.identity.v1";

function randomName(): string {
  const first = ["Jordan", "Riley", "Priya", "Wei", "Sam", "Noor"][Math.floor(Math.random() * 6)];
  const last = ["Whitfield", "Osei", "Nakamura", "Bergström", "Kahale"][Math.floor(Math.random() * 5)];
  return `${first} ${last}`;
}

export function loadOrCreateIdentity(): { human: HumanActor; makeAgent: (scope: PermissionScope) => AgentActor } {
  let raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  let parsed: { userId: string; name: string } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    parsed = { userId: crypto.randomUUID(), name: randomName() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // storage unavailable — identity just won't persist across reloads
    }
  }
  const human: HumanActor = { kind: "human", userId: parsed.userId, name: parsed.name };
  const makeAgent = (scope: PermissionScope): AgentActor => ({
    kind: "agent",
    agentId: `agent_${human.userId}`,
    name: `${human.name}'s Agent`,
    ownerUserId: human.userId,
    grant: { scope },
  });
  return { human, makeAgent };
}
