import type { Actor } from "../cf-foundation/actor.js";
import type { ApplicationStore } from "../lib/store.js";
import type { Application, FieldDef } from "../shared/types.js";

function ProvenanceChip({ value }: { value: Application["values"][string] | undefined }) {
  if (!value || value.value === null || value.value === "") return <span className="provenance-chip unset">needs you</span>;
  if (value.pendingConfirmation) return <span className="provenance-chip pending">agent proposed — confirm?</span>;
  return <span className={`provenance-chip ${value.source}`}>{value.source === "agent" ? "filled by your agent" : "filled by you"}</span>;
}

export function FieldRow({ field, app, store, human }: { field: FieldDef; app: Application; store: ApplicationStore; human: Actor }) {
  const value = app.values[field.id];

  function commit(raw: string) {
    let parsed: string | number | boolean | null = raw;
    if (field.type === "number") parsed = raw === "" ? null : Number(raw);
    if (field.type === "boolean") parsed = raw === "true";
    if (field.type === "attestation") parsed = raw === "true";
    store.dispatch({ type: "set_field", payload: { fieldId: field.id, value: parsed } }, human);
  }

  return (
    <div className={`field-block ${field.permission.replace(/_/g, "-")}`}>
      <label htmlFor={field.id}>
        <span>
          {field.label}
          {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
        </span>
        <ProvenanceChip value={value} />
      </label>

      {field.type === "textarea" && (
        <textarea id={field.id} value={String(value?.value ?? "")} onChange={(e) => commit(e.target.value)} />
      )}
      {field.type === "text" && (
        <input id={field.id} type="text" value={String(value?.value ?? "")} onChange={(e) => commit(e.target.value)} />
      )}
      {field.type === "date" && (
        <input id={field.id} type="date" value={String(value?.value ?? "")} onChange={(e) => commit(e.target.value)} />
      )}
      {field.type === "number" && (
        <input id={field.id} type="number" value={value?.value === null || value?.value === undefined ? "" : String(value.value)} onChange={(e) => commit(e.target.value)} />
      )}
      {field.type === "select" && (
        <select id={field.id} value={String(value?.value ?? "")} onChange={(e) => commit(e.target.value)}>
          <option value="">— select —</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
      {(field.type === "boolean" || field.type === "attestation") && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={value?.value === true}
            onChange={(e) => commit(String(e.target.checked))}
          />
          {field.type === "attestation" ? "I confirm" : "Yes"}
        </label>
      )}

      {value?.pendingConfirmation && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button className="primary" onClick={() => store.dispatch({ type: "confirm_field", payload: { fieldId: field.id } }, human)}>
            Accept agent's answer
          </button>
          <button onClick={() => store.dispatch({ type: "reject_field", payload: { fieldId: field.id } }, human)}>Reject</button>
        </div>
      )}

      {field.helpText && <div className="field-help">{field.helpText}</div>}
      {field.permission === "human_only" && <div className="field-help">Human only — your agent cannot fill this in.</div>}
      {field.permission === "evidence_required" && <div className="field-help">Requires attached evidence — your agent can only propose a value here.</div>}
    </div>
  );
}
