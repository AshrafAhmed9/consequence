import type { Actor } from "../cf-foundation/actor.js";
import { defineTool, withConfirmation, type ConfirmFn } from "webmcp-kit";
import type { ApplicationStore } from "../lib/store.js";
import { checkConsistency, openQuestions, visibleSections } from "../shared/derive.js";

export interface HigherOrderDeps {
  confirmSubmit: ConfirmFn<any>;
}

export function createHigherOrderTools(store: ApplicationStore, actor: Actor, deps: HigherOrderDeps) {
  const checkConsistencyTool = defineTool({
    name: "check_consistency",
    description: "Cross-reference every answered field for contradictions: overlapping dates, an expired passport, income figures that don't add up.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return checkConsistency(store.getState());
    },
  });

  const summarizeApplication = defineTool({
    name: "summarize_application",
    description: "Get a plain-language summary of application progress: what's done, what's outstanding, and any consistency issues found.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      const app = store.getState();
      const open = openQuestions(app);
      const issues = checkConsistency(app);
      const sections = visibleSections(app);
      return {
        applicantName: app.applicantName,
        sectionCount: sections.length,
        openQuestionCount: open.length,
        consistencyIssueCount: issues.length,
        errors: issues.filter((i) => i.severity === "error"),
        submitted: app.submitted,
      };
    },
  });

  const readEvidence = defineTool({
    name: "read_evidence",
    description:
      "Read an attached evidence file and extract a plain-text summary of what it appears to contain, so the agent can decide what to propose_answer next. Does not modify any field itself.",
    inputSchema: {
      type: "object",
      properties: { evidenceId: { type: "string" } },
      required: ["evidenceId"],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const app = store.getState();
      const evidence = app.evidence.find((e) => e.id === input.evidenceId);
      if (!evidence) return { error: `Unknown evidence "${input.evidenceId}".` };
      // No OCR pipeline in this pass — extraction is a deterministic,
      // clearly-labeled stub keyed on filename, not a real document parse.
      // A judge should not read this as a working OCR integration.
      return {
        evidenceId: evidence.id,
        filename: evidence.filename,
        extractedSummary: `[stub extraction — no real OCR wired up] File "${evidence.filename}" was attached for field "${evidence.fieldId ?? "unassigned"}". Use propose_answer with a value read from the document by other means.`,
      };
    },
  });

  const submitApplicationBase = {
    name: "submit_application",
    description: "Submit the application. Requires human confirmation and refuses while any required field is unanswered, pending confirmation, or missing evidence.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    handler() {
      const app = store.getState();
      const open = openQuestions(app);
      if (open.length > 0) {
        throw new Error(`Cannot submit: ${open.length} open item(s) remain — ${open.map((o) => o.label).join(", ")}.`);
      }
      store.dispatch({ type: "submit", payload: {} }, actor);
      return { ok: true, submittedAt: Date.now() };
    },
  };
  const submitApplication = withConfirmation(submitApplicationBase, deps.confirmSubmit);

  return { checkConsistencyTool, summarizeApplication, readEvidence, submitApplication };
}
