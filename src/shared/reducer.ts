import type { Actor } from "../cf-foundation/actor.js";
import type { Application, EvidenceFile, FieldValue, ReviewComment } from "./types.js";
import { findField } from "../../seed/schema.js";

/**
 * Permission enforcement lives here, not just in the tool layer — the
 * reducer is the single mutation path for the client UI, the Durable
 * Object, and every WebMCP tool, so a human_only field can't be set by an
 * agent no matter which of those three calls in. `answer_question`'s
 * refusal (see tools/write.ts) is this error surfacing to the agent as a
 * structured, actionable message rather than a generic failure.
 */
export class HumanOnlyFieldError extends Error {
  constructor(fieldId: string) {
    super(`"${fieldId}" is a human_only field — an agent cannot set it. Ask the human to fill this in themselves.`);
    this.name = "HumanOnlyFieldError";
  }
}

export class EvidenceRequiredError extends Error {
  constructor(fieldId: string) {
    super(`"${fieldId}" requires evidence — an agent may only propose a value for human confirmation (use propose_answer), not set it directly.`);
    this.name = "EvidenceRequiredError";
  }
}

export class UnknownFieldError extends Error {
  constructor(fieldId: string) {
    super(`Unknown field "${fieldId}".`);
    this.name = "UnknownFieldError";
  }
}

export type ActionType =
  | { type: "set_field"; payload: { fieldId: string; value: FieldValue["value"] } }
  | { type: "propose_field"; payload: { fieldId: string; value: FieldValue["value"] } }
  | { type: "confirm_field"; payload: { fieldId: string } }
  | { type: "reject_field"; payload: { fieldId: string } }
  | { type: "attach_evidence"; payload: { evidence: Omit<EvidenceFile, "uploadedBy" | "uploadedAt"> } }
  | { type: "add_review_comment"; payload: { sectionId: string; body: string } }
  | { type: "add_reviewer"; payload: { userId: string; name: string; sectionIds: string[] } }
  | { type: "request_human_action"; payload: { fieldId: string | null; reason: string } }
  | { type: "resolve_human_action"; payload: { id: string } }
  | { type: "submit"; payload: Record<string, never> };

export interface ReduceResult {
  state: Application;
  entityId: string;
  before: unknown;
  after: unknown;
}

function touch(app: Application): Application {
  return { ...app, updatedAt: Date.now() };
}

export function reduce(state: Application, action: ActionType, actor: Actor): ReduceResult {
  switch (action.type) {
    case "set_field": {
      const { fieldId, value } = action.payload;
      const found = findField(fieldId);
      if (!found) throw new UnknownFieldError(fieldId);
      if (actor.kind === "agent") {
        if (found.field.permission === "human_only") throw new HumanOnlyFieldError(fieldId);
        if (found.field.permission === "evidence_required") throw new EvidenceRequiredError(fieldId);
      }
      const before = state.values[fieldId] ?? null;
      const fieldValue: FieldValue = { fieldId, value, source: actor.kind, setBy: actor.name, setAt: Date.now() };
      const after = touch({ ...state, values: { ...state.values, [fieldId]: fieldValue } });
      return { state: after, entityId: fieldId, before, after: fieldValue };
    }

    case "propose_field": {
      const { fieldId, value } = action.payload;
      const found = findField(fieldId);
      if (!found) throw new UnknownFieldError(fieldId);
      if (found.field.permission === "human_only") throw new HumanOnlyFieldError(fieldId);
      const before = state.values[fieldId] ?? null;
      const fieldValue: FieldValue = {
        fieldId,
        value,
        source: actor.kind,
        setBy: actor.name,
        setAt: Date.now(),
        pendingConfirmation: true,
      };
      const after = touch({ ...state, values: { ...state.values, [fieldId]: fieldValue } });
      return { state: after, entityId: fieldId, before, after: fieldValue };
    }

    case "confirm_field": {
      if (actor.kind !== "human") throw new Error("Only a human can confirm a proposed field value.");
      const existing = state.values[action.payload.fieldId];
      if (!existing) throw new UnknownFieldError(action.payload.fieldId);
      const before = existing;
      const after = touch({
        ...state,
        values: { ...state.values, [existing.fieldId]: { ...existing, pendingConfirmation: false } },
      });
      return { state: after, entityId: existing.fieldId, before, after: after.values[existing.fieldId] };
    }

    case "reject_field": {
      if (actor.kind !== "human") throw new Error("Only a human can reject a proposed field value.");
      const existing = state.values[action.payload.fieldId];
      if (!existing) throw new UnknownFieldError(action.payload.fieldId);
      const before = existing;
      const { [action.payload.fieldId]: _removed, ...rest } = state.values;
      const after = touch({ ...state, values: rest });
      return { state: after, entityId: action.payload.fieldId, before, after: null };
    }

    case "attach_evidence": {
      if (actor.kind !== "human") throw new Error("Only a human can attach evidence files — an agent may only request evidence.");
      const evidence: EvidenceFile = { ...action.payload.evidence, uploadedBy: actor.name, uploadedAt: Date.now() };
      const after = touch({ ...state, evidence: [...state.evidence, evidence] });
      return { state: after, entityId: evidence.id, before: null, after: evidence };
    }

    case "add_review_comment": {
      const comment: ReviewComment = {
        id: crypto.randomUUID(),
        sectionId: action.payload.sectionId,
        author: actor.name,
        authorRole: "reviewer",
        body: action.payload.body,
        createdAt: Date.now(),
      };
      const after = touch({ ...state, reviewComments: [...state.reviewComments, comment] });
      return { state: after, entityId: comment.id, before: null, after: comment };
    }

    case "add_reviewer": {
      if (actor.kind !== "human") throw new Error("Only the applicant can invite a reviewer.");
      const reviewer = { userId: action.payload.userId, name: action.payload.name, sectionIds: action.payload.sectionIds };
      const after = touch({ ...state, reviewers: [...state.reviewers, reviewer] });
      return { state: after, entityId: reviewer.userId, before: null, after: reviewer };
    }

    case "request_human_action": {
      const request = {
        id: crypto.randomUUID(),
        fieldId: action.payload.fieldId,
        reason: action.payload.reason,
        requestedBy: actor.name,
        createdAt: Date.now(),
        resolved: false,
      };
      const after = touch({ ...state, humanActionRequests: [...state.humanActionRequests, request] });
      return { state: after, entityId: request.id, before: null, after: request };
    }

    case "resolve_human_action": {
      if (actor.kind !== "human") throw new Error("Only a human can resolve a request for human action.");
      const before = state.humanActionRequests.find((r) => r.id === action.payload.id) ?? null;
      const after = touch({
        ...state,
        humanActionRequests: state.humanActionRequests.map((r) => (r.id === action.payload.id ? { ...r, resolved: true } : r)),
      });
      return { state: after, entityId: action.payload.id, before, after: after.humanActionRequests.find((r) => r.id === action.payload.id) ?? null };
    }

    case "submit": {
      if (actor.kind !== "human") throw new Error("Only a human can submit the application.");
      const before = state.submitted;
      const after = touch({ ...state, submitted: true, submittedAt: Date.now() });
      return { state: after, entityId: state.id, before, after: true };
    }
  }
}
