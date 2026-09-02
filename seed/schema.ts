import type { SectionDef } from "../src/shared/types.js";

/**
 * The application schema for the fictional "Skyward Residency Program" —
 * an invented agency, invented process, invented form numbers. No real
 * government seal, name, or form is referenced anywhere in this app.
 *
 * Every field declares a PermissionClass. Two sections are conditional
 * branches (`branchCondition`) whose fields — and matching WebMCP tools —
 * only exist once the triggering answer is given; see
 * `src/lib/useConsequenceTools.ts` for where that becomes a live
 * `document.modelContext` registration change.
 */
export const APPLICATION_SCHEMA: SectionDef[] = [
  {
    id: "identity",
    title: "Applicant Identity",
    fields: [
      { id: "full_legal_name", label: "Full legal name", type: "text", permission: "agent_fillable", required: true },
      { id: "date_of_birth", label: "Date of birth", type: "date", permission: "agent_fillable", required: true },
      { id: "nationality", label: "Nationality", type: "text", permission: "agent_fillable", required: true },
      { id: "passport_number", label: "Passport number", type: "text", permission: "agent_fillable", required: true },
      { id: "passport_expiry", label: "Passport expiry date", type: "date", permission: "agent_fillable", required: true },
      { id: "current_address", label: "Current residential address", type: "textarea", permission: "agent_fillable", required: true },
      { id: "address_country", label: "Country of current residence", type: "text", permission: "agent_fillable", required: true },
      { id: "years_at_address", label: "Years at current address", type: "number", permission: "agent_fillable", required: false },
    ],
  },
  {
    id: "contact",
    title: "Contact & Emergency",
    fields: [
      { id: "email", label: "Email address", type: "text", permission: "agent_fillable", required: true },
      { id: "phone", label: "Phone number", type: "text", permission: "agent_fillable", required: true },
      { id: "emergency_contact_name", label: "Emergency contact name", type: "text", permission: "agent_fillable", required: true },
      { id: "emergency_contact_relation", label: "Relationship to emergency contact", type: "text", permission: "agent_fillable", required: true },
      { id: "emergency_contact_phone", label: "Emergency contact phone", type: "text", permission: "agent_fillable", required: true },
    ],
  },
  {
    id: "employment",
    title: "Employment History",
    fields: [
      {
        id: "employment_status",
        label: "Current employment status",
        type: "select",
        permission: "agent_fillable",
        options: ["employed", "self_employed", "unemployed", "student", "retired"],
        required: true,
      },
      { id: "employer_name", label: "Employer name", type: "text", permission: "agent_fillable", required: false },
      { id: "job_title", label: "Job title", type: "text", permission: "agent_fillable", required: false },
      { id: "employment_start_date", label: "Employment start date", type: "date", permission: "agent_fillable", required: false },
      { id: "employment_end_date", label: "Employment end date (leave blank if current)", type: "date", permission: "agent_fillable", required: false },
      { id: "annual_income", label: "Annual income (declared)", type: "number", permission: "agent_fillable", required: true },
      { id: "income_currency", label: "Income currency", type: "text", permission: "agent_fillable", required: true },
      { id: "prior_employer_name", label: "Previous employer (if less than 2 years at current)", type: "text", permission: "agent_fillable", required: false },
      { id: "prior_employment_start_date", label: "Previous employment start date", type: "date", permission: "agent_fillable", required: false },
      { id: "prior_employment_end_date", label: "Previous employment end date", type: "date", permission: "agent_fillable", required: false },
    ],
  },
  {
    id: "self_employment",
    title: "Self-Employment Details",
    branchCondition: { fieldId: "employment_status", equals: "self_employed" },
    fields: [
      { id: "business_name", label: "Business name", type: "text", permission: "agent_fillable", required: true },
      { id: "business_registration_number", label: "Business registration number", type: "text", permission: "agent_fillable", required: true },
      { id: "trading_period_start", label: "Trading period start date", type: "date", permission: "agent_fillable", required: true },
      { id: "business_income_summary", label: "Summary of business income (last 12 months)", type: "textarea", permission: "agent_fillable", required: true },
      { id: "accountant_letter_reference", label: "Accountant confirmation letter reference", type: "text", permission: "evidence_required", required: true, helpText: "Requires an attached accountant letter" },
    ],
  },
  {
    id: "financial",
    title: "Financial Standing",
    fields: [
      { id: "bank_name", label: "Primary bank", type: "text", permission: "agent_fillable", required: true },
      { id: "account_balance_summary", label: "Account balance summary (last 6 months)", type: "textarea", permission: "evidence_required", required: true, helpText: "Requires an attached bank statement" },
      { id: "outstanding_debts", label: "Outstanding debts or loans (describe, or state none)", type: "textarea", permission: "agent_fillable", required: true },
      { id: "sponsor_name", label: "Financial sponsor name, if any", type: "text", permission: "agent_fillable", required: false },
      { id: "sponsor_relationship", label: "Relationship to sponsor", type: "text", permission: "agent_fillable", required: false },
      { id: "sponsor_income_evidence_ref", label: "Sponsor income evidence reference", type: "text", permission: "evidence_required", required: false },
    ],
  },
  {
    id: "background",
    title: "Background Declarations",
    fields: [
      { id: "has_prior_refusals", label: "Have you ever been refused a visa or residency permit by any country?", type: "boolean", permission: "agent_fillable", required: true },
      { id: "has_criminal_record", label: "Do you have any criminal convictions?", type: "boolean", permission: "agent_fillable", required: true },
      { id: "has_prior_overstay", label: "Have you ever overstayed a visa in any country?", type: "boolean", permission: "agent_fillable", required: true },
    ],
  },
  {
    id: "background_explanations",
    title: "Background Explanations",
    branchCondition: { fieldId: "has_prior_refusals", equals: true },
    fields: [
      { id: "prior_refusal_country", label: "Country that issued the refusal", type: "text", permission: "agent_fillable", required: true },
      { id: "prior_refusal_date", label: "Date of refusal", type: "date", permission: "agent_fillable", required: true },
      { id: "prior_refusal_explanation", label: "Explanation of circumstances", type: "textarea", permission: "human_only", required: true, helpText: "Must be written by the applicant in their own words" },
    ],
  },
  {
    id: "dependants",
    title: "Sponsor & Dependants",
    fields: [
      { id: "has_dependants", label: "Are you including any dependants on this application?", type: "boolean", permission: "agent_fillable", required: true },
      { id: "dependant_count", label: "Number of dependants", type: "number", permission: "agent_fillable", required: false },
      { id: "dependant_names", label: "Dependant full names (one per line)", type: "textarea", permission: "agent_fillable", required: false },
      { id: "dependant_relationship", label: "Relationship of dependants to applicant", type: "textarea", permission: "agent_fillable", required: false },
    ],
  },
  {
    id: "attestations",
    title: "Attestations & Signature",
    fields: [
      { id: "attest_accuracy", label: "I attest that all information in this application is accurate and complete.", type: "attestation", permission: "human_only", required: true },
      { id: "attest_consent_processing", label: "I consent to Skyward processing this data for the purpose of this application.", type: "attestation", permission: "human_only", required: true },
      { id: "attest_no_material_omission", label: "I confirm I have not omitted any information that could materially affect this decision.", type: "attestation", permission: "human_only", required: true },
      { id: "applicant_signature", label: "Signature (typed full legal name)", type: "text", permission: "human_only", required: true },
      { id: "date_signed", label: "Date signed", type: "date", permission: "human_only", required: true },
    ],
  },
];

export function allFieldIds(): string[] {
  return APPLICATION_SCHEMA.flatMap((s) => s.fields.map((f) => f.id));
}

export function findField(fieldId: string): { section: SectionDef; field: (typeof APPLICATION_SCHEMA)[number]["fields"][number] } | null {
  for (const section of APPLICATION_SCHEMA) {
    const field = section.fields.find((f) => f.id === fieldId);
    if (field) return { section, field };
  }
  return null;
}
