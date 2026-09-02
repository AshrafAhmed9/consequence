import { defineTool } from "webmcp-kit";
import type { ApplicationStore } from "../lib/store.js";
import { blockingItems, openQuestions, visibleSections } from "../shared/derive.js";
import { APPLICATION_SCHEMA, findField } from "../../seed/schema.js";

export interface NavState {
  activeSectionId: string;
}

export function createReadTools(store: ApplicationStore, getNav: () => NavState) {
  const getApplicationStatus = defineTool({
    name: "get_application_status",
    description: "Get overall application progress: sections completed, open questions, and whether it's ready to submit.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      const app = store.getState();
      const open = openQuestions(app);
      const sections = visibleSections(app);
      return {
        applicantName: app.applicantName,
        submitted: app.submitted,
        totalSections: sections.length,
        openQuestionCount: open.length,
        readyToSubmit: open.length === 0 && !app.submitted,
        activeSection: getNav().activeSectionId,
      };
    },
  });

  const listOpenQuestions = defineTool({
    name: "list_open_questions",
    description: "List every unanswered or unconfirmed required field — the agent's work queue.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return openQuestions(store.getState());
    },
  });

  const listBlockingItems = defineTool({
    name: "list_blocking_items",
    description: "List everything currently blocking submission.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return blockingItems(store.getState());
    },
  });

  const explainRequirement = defineTool({
    name: "explain_requirement",
    description: "Get the plain-language requirement and permission class for one field.",
    inputSchema: {
      type: "object",
      properties: { fieldId: { type: "string" } },
      required: ["fieldId"],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const found = findField(input.fieldId);
      if (!found) return { error: `Unknown field "${input.fieldId}".` };
      return {
        fieldId: found.field.id,
        label: found.field.label,
        type: found.field.type,
        permission: found.field.permission,
        required: found.field.required,
        helpText: found.field.helpText ?? null,
        section: found.section.title,
      };
    },
  });

  const getSection = defineTool({
    name: "get_section",
    description: "Get all fields and current values for one section, by section id.",
    inputSchema: {
      type: "object",
      properties: { sectionId: { type: "string" } },
      required: ["sectionId"],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const app = store.getState();
      const section = APPLICATION_SCHEMA.find((s) => s.id === input.sectionId);
      if (!section) return { error: `Unknown section "${input.sectionId}".` };
      return {
        id: section.id,
        title: section.title,
        fields: section.fields.map((f) => ({
          ...f,
          value: app.values[f.id]?.value ?? null,
          source: app.values[f.id]?.source ?? "unset",
          pendingConfirmation: app.values[f.id]?.pendingConfirmation ?? false,
        })),
      };
    },
  });

  const getProvenanceReport = defineTool({
    name: "get_provenance_report",
    description: "Get who filled every field and when — the full provenance trail.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      const app = store.getState();
      return Object.values(app.values).map((v) => ({
        fieldId: v.fieldId,
        source: v.source,
        setBy: v.setBy,
        setAt: v.setAt,
        pendingConfirmation: v.pendingConfirmation ?? false,
      }));
    },
  });

  const listEvidence = defineTool({
    name: "list_evidence",
    description: "List evidence files attached to this application.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return store.getState().evidence;
    },
  });

  const listReviewItems = defineTool({
    name: "list_review_items",
    description: "List reviewer comments across all sections.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return store.getState().reviewComments;
    },
  });

  const getHistory = defineTool({
    name: "get_history",
    description: "Get the full, replayable mutation history for this application — who changed what, in order.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } }, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      // Populated from the Durable Object's hash-chained audit log via the
      // sync layer; see lib/sync.ts and worker/application-do.ts.
      return store.getAuditTrail().slice(0, input.limit ?? 50);
    },
  });

  return { getApplicationStatus, listOpenQuestions, listBlockingItems, explainRequirement, getSection, getProvenanceReport, listEvidence, listReviewItems, getHistory };
}
