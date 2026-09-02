export type FieldType = "text" | "textarea" | "date" | "number" | "select" | "boolean" | "attestation";

/**
 * The core mechanic: every field declares who is allowed to fill it.
 * `agent_fillable` — an agent may set it directly (addresses, dates, transcription).
 * `human_only` — attestations and signatures. `answer_question` refuses these with a
 *   structured reason; only a human, acting through the UI, can set them.
 * `evidence_required` — an agent may only `propose_answer` (landing as "needs your
 *   confirmation"), never set it outright, even if it could technically parse a value
 *   from an attached document.
 */
export type PermissionClass = "agent_fillable" | "human_only" | "evidence_required";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  permission: PermissionClass;
  options?: readonly string[];
  helpText?: string;
  required: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
  /** If set, this section only appears once `branchCondition` is satisfied by current answers. */
  branchCondition?: { fieldId: string; equals: string | boolean };
}

export type ProvenanceSource = "human" | "agent" | "unset";

export interface FieldValue {
  fieldId: string;
  value: string | number | boolean | null;
  source: ProvenanceSource;
  setBy: string; // actor name
  setAt: number;
  /** Set when an agent proposed this value from evidence but a human hasn't confirmed it yet. */
  pendingConfirmation?: boolean;
}

export interface EvidenceFile {
  id: string;
  fieldId: string | null; // which field this evidence supports, if any
  filename: string;
  uploadedBy: string;
  uploadedAt: number;
  sizeBytes: number;
}

export interface ReviewComment {
  id: string;
  sectionId: string;
  author: string;
  authorRole: "reviewer";
  body: string;
  createdAt: number;
}

export interface ConsistencyIssue {
  id: string;
  severity: "warning" | "error";
  message: string;
  fieldIds: string[];
}

export interface HumanActionRequest {
  id: string;
  fieldId: string | null;
  reason: string;
  requestedBy: string;
  createdAt: number;
  resolved: boolean;
}

export interface Reviewer {
  userId: string;
  name: string;
  sectionIds: string[]; // sections this reviewer may see/comment on
}

export interface Application {
  id: string;
  applicantName: string;
  values: Record<string, FieldValue>;
  evidence: EvidenceFile[];
  reviewComments: ReviewComment[];
  reviewers: Reviewer[];
  humanActionRequests: HumanActionRequest[];
  submitted: boolean;
  submittedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const SCHEMA_VERSION = 1;
