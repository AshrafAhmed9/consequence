import { APPLICATION_SCHEMA } from "../../seed/schema.js";
import type { Application, ConsistencyIssue, FieldDef, SectionDef } from "./types.js";

export function isSectionVisible(section: SectionDef, values: Application["values"]): boolean {
  if (!section.branchCondition) return true;
  const trigger = values[section.branchCondition.fieldId];
  if (!trigger) return false;
  return trigger.value === section.branchCondition.equals;
}

export function visibleSections(app: Application): SectionDef[] {
  return APPLICATION_SCHEMA.filter((s) => isSectionVisible(s, app.values));
}

export function visibleFields(app: Application): FieldDef[] {
  return visibleSections(app).flatMap((s) => s.fields);
}

export interface OpenQuestion {
  fieldId: string;
  sectionId: string;
  label: string;
  reason: "unset" | "pending_confirmation" | "missing_evidence";
}

export function openQuestions(app: Application): OpenQuestion[] {
  const out: OpenQuestion[] = [];
  for (const section of visibleSections(app)) {
    for (const field of section.fields) {
      if (!field.required) continue;
      const value = app.values[field.id];
      if (!value || value.value === null || value.value === "") {
        out.push({ fieldId: field.id, sectionId: section.id, label: field.label, reason: "unset" });
      } else if (value.pendingConfirmation) {
        out.push({ fieldId: field.id, sectionId: section.id, label: field.label, reason: "pending_confirmation" });
      } else if (field.permission === "evidence_required" && !app.evidence.some((e) => e.fieldId === field.id)) {
        out.push({ fieldId: field.id, sectionId: section.id, label: field.label, reason: "missing_evidence" });
      }
    }
  }
  return out;
}

export function blockingItems(app: Application): OpenQuestion[] {
  // Everything open blocks submission except a still-pending evidence
  // proposal that's merely awaiting review isn't strictly "blocking" until
  // a human looks at it — but for this app all opens block, to keep the
  // submit gate simple and honest about what's outstanding.
  return openQuestions(app);
}

function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / 86_400_000);
}

function asDate(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Real cross-field checks — the concrete task an agent can do that's
 * genuinely hard for a human eyeballing sixty-plus fields: overlapping
 * dates, an expired passport, income figures that don't add up.
 */
export function checkConsistency(app: Application): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const v = (id: string) => app.values[id]?.value ?? null;

  const passportExpiry = asDate(v("passport_expiry"));
  if (passportExpiry !== null && passportExpiry < Date.now()) {
    issues.push({ id: "passport_expired", severity: "error", message: "Passport expiry date is in the past.", fieldIds: ["passport_expiry"] });
  }

  const empStart = asDate(v("employment_start_date"));
  const empEnd = asDate(v("employment_end_date"));
  if (empStart !== null && empEnd !== null && empEnd < empStart) {
    issues.push({ id: "employment_dates_reversed", severity: "error", message: "Employment end date is before the start date.", fieldIds: ["employment_start_date", "employment_end_date"] });
  }

  const priorEnd = asDate(v("prior_employment_end_date"));
  if (empStart !== null && priorEnd !== null && priorEnd > empStart) {
    issues.push({
      id: "overlapping_employment",
      severity: "warning",
      message: `Previous employment ends ${daysBetween(empStart, priorEnd)} day(s) after current employment starts — overlapping dates.`,
      fieldIds: ["employment_start_date", "prior_employment_end_date"],
    });
  }

  const dob = asDate(v("date_of_birth"));
  if (dob !== null) {
    const ageYears = (Date.now() - dob) / (365.25 * 86_400_000);
    if (ageYears < 18) {
      issues.push({ id: "applicant_may_be_minor", severity: "error", message: "Declared date of birth implies the applicant is under 18.", fieldIds: ["date_of_birth"] });
    }
  }

  if (v("employment_status") === "self_employed" && v("annual_income") && !v("business_income_summary")) {
    issues.push({
      id: "self_employed_income_unexplained",
      severity: "warning",
      message: "Annual income is declared but no business income summary has been provided for a self-employed applicant.",
      fieldIds: ["annual_income", "business_income_summary"],
    });
  }

  if (v("has_dependants") === true && (!v("dependant_count") || Number(v("dependant_count")) < 1)) {
    issues.push({ id: "dependants_flagged_but_uncounted", severity: "warning", message: "Dependants are flagged but no dependant count was given.", fieldIds: ["has_dependants", "dependant_count"] });
  }
  if (v("dependant_count") && Number(v("dependant_count")) > 0 && !v("dependant_names")) {
    issues.push({ id: "dependants_uncounted_but_unnamed", severity: "warning", message: "Dependant count is set but no names were provided.", fieldIds: ["dependant_count", "dependant_names"] });
  }

  if (v("has_prior_refusals") === true && !v("prior_refusal_explanation")) {
    issues.push({ id: "refusal_unexplained", severity: "error", message: "A prior refusal was declared but no explanation has been written by the applicant.", fieldIds: ["prior_refusal_explanation"] });
  }

  return issues;
}
