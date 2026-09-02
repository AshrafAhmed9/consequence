import { useState } from "react";
import type { ActivityLog, DefinedTool } from "webmcp-kit";
import { APPLICATION_SCHEMA } from "../../seed/schema.js";
import type { Application } from "../shared/types.js";

function findTool(tools: DefinedTool<any, any>[], name: string): DefinedTool<any, any> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool "${name}"`);
  return tool;
}

async function runLogged(tools: DefinedTool<any, any>[], log: ActivityLog, name: string, input: unknown) {
  const tool = findTool(tools, name);
  const start = performance.now();
  try {
    const output = await tool.call(input as never);
    log.log({ toolName: name, input, output, actor: "agent", durationMs: performance.now() - start });
    return output;
  } catch (err) {
    log.log({ toolName: name, input, output: undefined, error: err instanceof Error ? err.message : String(err), actor: "agent", durationMs: performance.now() - start });
    throw err;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAMPLE_VALUES: Record<string, string> = {
  full_legal_name: "Amara Okonkwo-Reyes",
  date_of_birth: "1994-03-11",
  nationality: "Fictional Republic of Veridia",
  passport_number: "VR8827194",
  passport_expiry: "2031-06-01",
  current_address: "14 Windmere Court, Lakeview District",
  address_country: "Veridia",
  email: "amara.ok@example.test",
  phone: "+1-555-0142",
  emergency_contact_name: "Diego Reyes",
  emergency_contact_relation: "Spouse",
  emergency_contact_phone: "+1-555-0199",
  employment_status: "employed",
  employer_name: "Northlake Analytics",
  job_title: "Senior Data Engineer",
  employment_start_date: "2021-09-01",
  annual_income: "94000",
  income_currency: "USD",
};

/**
 * Drives the exact same `tool.call(input)` functions a real WebMCP agent
 * would call. The "Try to sign the attestation" script is the app's
 * central proof: it deliberately calls `answer_question` on a human_only
 * field and shows the refusal land in the activity feed, unaltered.
 */
export function SimulatedAgentPanel({
  allTools,
  activityLog,
  getState,
}: {
  allTools: DefinedTool<any, any>[];
  activityLog: ActivityLog;
  getState: () => Application;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function runFillIdentity() {
    setRunning("fill");
    setNote(null);
    try {
      const values = getState().values;
      const remaining = Object.entries(SAMPLE_VALUES).filter(
        ([fieldId, value]) => values[fieldId]?.value !== value,
      );
      if (remaining.length === 0) {
        setNote("All agent-fillable fields are already set. Nothing to do.");
        return;
      }
      for (const [fieldId, value] of remaining) {
        await delay(150);
        await runLogged(allTools, activityLog, "answer_question", { fieldId, value });
      }
    } finally {
      setRunning(null);
    }
  }

  async function runConsistencyCheck() {
    setRunning("consistency");
    try {
      await runLogged(allTools, activityLog, "check_consistency", {});
    } finally {
      setRunning(null);
    }
  }

  async function runTrySign() {
    setRunning("sign");
    try {
      const attestationField = APPLICATION_SCHEMA.flatMap((s) => s.fields).find((f) => f.permission === "human_only");
      if (attestationField) {
        await runLogged(allTools, activityLog, "answer_question", { fieldId: attestationField.id, value: "true" });
      }
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="simulated-agent">
      <h4>Simulated agent (works without WebMCP)</h4>
      <button disabled={running !== null} onClick={runFillIdentity}>
        {running === "fill" ? "Filling…" : "Fill agent-fillable fields"}
      </button>
      <button disabled={running !== null} onClick={runConsistencyCheck}>
        {running === "consistency" ? "Checking…" : "Check consistency"}
      </button>
      <button disabled={running !== null} onClick={runTrySign} className="danger">
        {running === "sign" ? "Trying…" : "Try to sign the attestation (will be refused)"}
      </button>
      {note && <p className="simulated-agent-note">{note}</p>}
    </div>
  );
}
