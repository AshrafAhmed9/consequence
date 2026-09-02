import type { Actor } from "../cf-foundation/actor.js";
import { checkConsistency, openQuestions, visibleFields } from "../shared/derive.js";
import type { Application } from "../shared/types.js";
import type { ApplicationStore } from "../lib/store.js";

export function ReviewScreen({ app, store, human }: { app: Application; store: ApplicationStore; human: Actor }) {
  const open = openQuestions(app);
  const issues = checkConsistency(app);
  const fields = visibleFields(app);
  const readyToSubmit = open.length === 0 && !app.submitted;

  return (
    <div className="review-trail">
      <h2>Review &amp; provenance trail</h2>
      {app.submitted ? (
        <p style={{ color: "var(--success)" }}>Submitted {new Date(app.submittedAt ?? 0).toLocaleString()}.</p>
      ) : (
        <>
          <p style={{ color: readyToSubmit ? "var(--success)" : "var(--text-dim)" }}>
            {readyToSubmit ? "Ready to submit." : `${open.length} item(s) remain open.`}
          </p>
          {open.length > 0 && (
            <ul>
              {open.map((o) => (
                <li key={o.fieldId} className="issue-row">{o.label} — {o.reason.replace(/_/g, " ")}</li>
              ))}
            </ul>
          )}
          <button
            className="primary"
            disabled={!readyToSubmit}
            onClick={() => store.dispatch({ type: "submit", payload: {} }, human)}
          >
            Submit application
          </button>
        </>
      )}

      {issues.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Consistency issues</h3>
          {issues.map((i) => (
            <div key={i.id} className={`issue-row ${i.severity}`}>{i.message}</div>
          ))}
        </>
      )}

      <h3 style={{ marginTop: 24 }}>Who filled what</h3>
      <table>
        <thead>
          <tr><th>Field</th><th>Value</th><th>By</th><th>When</th></tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const v = app.values[f.id];
            return (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td>{v ? String(v.value) : "—"}</td>
                <td>
                  {v ? (
                    <span className={`provenance-chip ${v.source}`}>{v.source}</span>
                  ) : (
                    <span className="provenance-chip unset">unset</span>
                  )}
                </td>
                <td>{v ? new Date(v.setAt).toLocaleDateString() : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
