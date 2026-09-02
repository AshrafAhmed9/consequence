import type { Application, FieldValue } from "../src/shared/types.js";

/**
 * Not actually blank: seeds two fields an agent would plausibly have
 * already transcribed from documents, chosen so `check_consistency` has a
 * real, immediately-catchable contradiction on first use — a previous job
 * that "ended" three weeks after the current one "started". Without this,
 * every fresh application has zero filled fields, so `check_consistency`
 * can only ever return `[]` until something fills in contradictory data
 * first, which reads as broken rather than correct-on-empty-input.
 */
export function blankApplication(applicantName = "Demo Applicant"): Application {
  const now = Date.now();
  const day = 86_400_000;
  const field = (fieldId: string, value: string): FieldValue => ({
    fieldId,
    value,
    source: "agent",
    setBy: "seed-agent",
    setAt: now - 2 * day,
  });
  return {
    id: crypto.randomUUID(),
    applicantName,
    values: {
      employment_start_date: field("employment_start_date", new Date(now - 400 * day).toISOString().slice(0, 10)),
      prior_employment_end_date: field("prior_employment_end_date", new Date(now - 380 * day).toISOString().slice(0, 10)),
    },
    evidence: [],
    reviewComments: [],
    reviewers: [],
    humanActionRequests: [],
    submitted: false,
    submittedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
