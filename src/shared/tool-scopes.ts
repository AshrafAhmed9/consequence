import type { ToolScopeRegistry } from "../cf-foundation/actor.js";

/**
 * A reviewer's agent gets a `read`-scoped grant, so `resolveToolNames`
 * excludes `answer_question`, `propose_answer`, and `submit_application`
 * from what it ever sees — enforced the same way as Cadence's per-agent
 * scoping, before registration, not by the tool refusing at call time.
 */
export const CONSEQUENCE_TOOL_SCOPES: ToolScopeRegistry = {
  get_application_status: "read",
  list_open_questions: "read",
  list_blocking_items: "read",
  explain_requirement: "read",
  get_section: "read",
  get_provenance_report: "read",
  list_evidence: "read",
  get_history: "read",
  list_review_items: "read",

  navigate_to_section: "read",
  add_review_comment: "read",

  answer_question: "triage",
  propose_answer: "triage",
  validate_section: "triage",
  request_human_action: "triage",
  request_evidence: "triage",
  check_consistency: "triage",
  summarize_application: "triage",
  read_evidence: "triage",

  submit_application: "full",
};
