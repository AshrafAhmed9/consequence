import type { Actor } from "../cf-foundation/actor.js";
import { defineTool } from "@ashraf009/webmcp-kit";
import type { ApplicationStore } from "../lib/store.js";
import { APPLICATION_SCHEMA, findField } from "../../seed/schema.js";
import type { NavState } from "./read.js";

export function createWriteTools(store: ApplicationStore, actor: Actor, setNav: (n: NavState) => void) {
  const navigateToSection = defineTool({
    name: "navigate_to_section",
    description: "Move the active section — affects which section-scoped tools are registered next.",
    inputSchema: {
      type: "object",
      properties: { sectionId: { type: "string" } },
      required: ["sectionId"],
      additionalProperties: false,
    } as const,
    handler(input) {
      setNav({ activeSectionId: input.sectionId });
      return { ok: true, activeSectionId: input.sectionId };
    },
  });

  const answerQuestion = defineTool({
    name: "answer_question",
    description:
      "Answer a field directly. Refuses with a structured reason for human_only fields (attestations, signatures) and evidence_required fields (use propose_answer instead).",
    inputSchema: {
      type: "object",
      properties: {
        fieldId: { type: "string" },
        value: { type: "string", description: "Stringify numbers/booleans as needed; dates as YYYY-MM-DD." },
      },
      required: ["fieldId", "value"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const found = findField(input.fieldId);
      if (!found) return { error: `Unknown field "${input.fieldId}".` };
      const value = coerce(input.value, found.field.type);
      const after = store.dispatch({ type: "set_field", payload: { fieldId: input.fieldId, value } }, actor);
      return { ok: true, field: after };
    },
  });

  const proposeAnswer = defineTool({
    name: "propose_answer",
    description:
      "Propose a value for an evidence_required field (e.g. transcribed from an attached document). Lands as 'needs your confirmation' — never sets the field outright.",
    inputSchema: {
      type: "object",
      properties: { fieldId: { type: "string" }, value: { type: "string" }, basedOnEvidenceId: { type: "string" } },
      required: ["fieldId", "value"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const found = findField(input.fieldId);
      if (!found) return { error: `Unknown field "${input.fieldId}".` };
      const value = coerce(input.value, found.field.type);
      const after = store.dispatch({ type: "propose_field", payload: { fieldId: input.fieldId, value } }, actor);
      return { ok: true, field: after, note: "Awaiting human confirmation before this is treated as answered." };
    },
  });

  const validateSection = defineTool({
    name: "validate_section",
    description: "Check one section for unanswered required fields.",
    inputSchema: {
      type: "object",
      properties: { sectionId: { type: "string" } },
      required: ["sectionId"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const app = store.getState();
      const section = APPLICATION_SCHEMA.find((s) => s.id === input.sectionId);
      if (!section) return { error: `Unknown section "${input.sectionId}".` };
      const missing = section.fields.filter((f) => f.required && !app.values[f.id]?.value).map((f) => f.id);
      return { sectionId: section.id, complete: missing.length === 0, missingFieldIds: missing };
    },
  });

  const requestHumanAction = defineTool({
    name: "request_human_action",
    description: "Escalate to the human: flag a field or general issue that needs their attention. Surfaces in the 'needs you' queue.",
    inputSchema: {
      type: "object",
      properties: { fieldId: { type: "string" }, reason: { type: "string" } },
      required: ["reason"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const after = store.dispatch({ type: "request_human_action", payload: { fieldId: input.fieldId ?? null, reason: input.reason } }, actor);
      return { ok: true, request: after };
    },
  });

  const requestEvidence = defineTool({
    name: "request_evidence",
    description: "Ask the human to attach a document supporting an evidence_required field. The agent cannot attach files itself.",
    inputSchema: {
      type: "object",
      properties: { fieldId: { type: "string" } },
      required: ["fieldId"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const found = findField(input.fieldId);
      if (!found) return { error: `Unknown field "${input.fieldId}".` };
      const after = store.dispatch(
        { type: "request_human_action", payload: { fieldId: input.fieldId, reason: `Please attach evidence for "${found.field.label}".` } },
        actor,
      );
      return { ok: true, request: after };
    },
  });

  const addReviewComment = defineTool({
    name: "add_review_comment",
    description: "Add a review comment to a section, authored under the caller's own identity.",
    inputSchema: {
      type: "object",
      properties: { sectionId: { type: "string" }, body: { type: "string" } },
      required: ["sectionId", "body"],
      additionalProperties: false,
    } as const,
    handler(input) {
      const after = store.dispatch({ type: "add_review_comment", payload: input }, actor);
      return { ok: true, comment: after };
    },
  });

  return { navigateToSection, answerQuestion, proposeAnswer, validateSection, requestHumanAction, requestEvidence, addReviewComment };
}

function coerce(raw: string, type: string): string | number | boolean | null {
  if (type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "boolean" || type === "attestation") {
    return raw === "true" || raw === "1" || raw.toLowerCase() === "yes";
  }
  return raw;
}
