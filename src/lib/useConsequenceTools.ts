import { useMemo, useState } from "react";
import type { Actor } from "../cf-foundation/actor.js";
import { resolveToolNames } from "../cf-foundation/actor.js";
import { createActivityLog, type ConfirmFn, type DefinedTool } from "webmcp-kit";
import { useScopedTools } from "webmcp-kit/react";
import type { ApplicationStore } from "./store.js";
import { createConsequenceTools, type NavState } from "../tools/index.js";
import { CONSEQUENCE_TOOL_SCOPES } from "../shared/tool-scopes.js";

export type ConfirmRequest = { message: string; resolve: (approved: boolean) => void };

/**
 * The registered tool set here is deliberately *not* purely dynamic by
 * section the way Cadence's is by selection — every field-level tool stays
 * live throughout, because an agent working through a long application
 * needs to be able to jump between sections. What *does* change live is
 * the tool set itself changing shape with the applicant's own answers:
 * answering `employment_status = self_employed` makes the
 * self-employment section visible, and its section becomes reachable via
 * `get_section`/`answer_question` — no server-side tool list could have
 * offered those fields before the branch was taken, because they didn't
 * exist yet.
 */
export function useConsequenceTools(store: ApplicationStore, agent: Actor) {
  const activityLog = useMemo(() => createActivityLog(), []);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [nav, setNav] = useState<NavState>({ activeSectionId: "identity" });

  const confirmSubmit: ConfirmFn<any> = useMemo(
    () =>
      (() =>
        new Promise<boolean>((resolve) =>
          setConfirmRequest({ message: "Submit the application now? This cannot be undone.", resolve: (v) => { setConfirmRequest(null); resolve(v); } }),
        )) as unknown as ConfirmFn<any>,
    [],
  );

  const tools = useMemo(
    () =>
      createConsequenceTools({
        store,
        actor: agent,
        getNav: () => nav,
        setNav,
        confirmations: { confirmSubmit },
      }),
    [store, agent, nav, confirmSubmit],
  );

  const allowed = useMemo(() => new Set(resolveToolNames(CONSEQUENCE_TOOL_SCOPES, agent)), [agent]);
  const filterAllowed = (list: DefinedTool<any, any>[]) => list.filter((t) => allowed.has(t.name));

  const onInvoke = (entry: { toolName: string; input: unknown; output: unknown; error?: string; durationMs: number }) => {
    activityLog.log({ ...entry, actor: agent.kind });
  };

  useScopedTools(true, () => filterAllowed(tools.all), { onInvoke }, [tools]);

  const registeredCount = filterAllowed(tools.all).length;

  return { tools, activityLog, confirmRequest, registeredCount, nav, setNav };
}
