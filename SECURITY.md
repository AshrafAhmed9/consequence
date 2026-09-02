# Security & trust model

Consequence registers ~20 [WebMCP](https://github.com/webmachinelearning/webmcp) tools with `document.modelContext`, on top of a form containing real personal-application data (fictional, but structurally identical to what a real applicant would submit). The trust model here is stricter than a typical WebMCP app, since the domain itself is high-stakes.

## What the tool surface does not expose

- **No network egress.** No tool calls anything outside this app's own Durable Object.
- **Permission enforcement is defense-in-depth**, not a single checkpoint: `human_only` and `evidence_required` fields are refused both in the tool layer (`answer_question`, see `src/tools/write.ts`) *and* in the shared reducer (`src/shared/reducer.ts`'s `HumanOnlyFieldError`/`EvidenceRequiredError`). Every mutation path (tool call, UI edit, remote sync) goes through the same reducer, so there is exactly one place permission rules can be enforced, and no path that bypasses it.
- **An agent cannot attach evidence files.** `attach_evidence` throws for any non-human actor in the reducer. An agent can only `request_evidence`, surfacing a request in the human's queue.
- **An agent cannot submit unattended.** `submit_application` is wrapped with `withConfirmation` and additionally refuses in its own handler while any required field is unanswered, unconfirmed, or missing evidence. That's two independent checks, not one.
- **User content never renders as markup.** All field values and comments render as plain text.
- **Every mutation is attributed and audited.** Field values carry `source`/`setBy`/`setAt`; the Durable Object appends every change to the hash-chained audit log (`appendAuditRecord`, vendored in `src/cf-foundation/`), exposed via `get_history` and `get_provenance_report`.
- **Reviewer agents are scope-limited.** A reviewer's own agent gets a `read` grant (`CONSEQUENCE_TOOL_SCOPES`), so `resolveToolNames` excludes `answer_question`, `propose_answer`, and `submit_application` from what it's ever offered. A reviewer's agent can read and comment, never answer or sign.

## `read_evidence` is a stub, not real OCR

`read_evidence` (`src/tools/higher-order.ts`) returns a clearly-labeled placeholder string, not a real document parse. It exists to show the intended shape of the human/agent evidence workflow (agent reads → agent proposes → human confirms) without claiming an OCR pipeline that isn't built. Do not read its output as extracted document content.

## Out of scope for this pass

- Real authentication (see README's "Known limitations").
- Rate limiting on the Durable Object's WebSocket/HTTP endpoints.
- Actual file-content storage for evidence (metadata only is tracked: filename, uploader, timestamp, not bytes).

Found an issue? This is a hackathon submission without a dedicated security contact; please open a GitHub issue.
