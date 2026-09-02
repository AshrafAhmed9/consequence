# Consequence

An application your agent can't sign for you.

Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/). Consequence is a long, branching, fictional high-stakes application: residency for the invented "Skyward Residency Program," no real agency, seal, or form referenced anywhere. A human and their agent split the work by **who is actually qualified to do each part**, and that split is enforced in code, not just in the UI.

**Live:** [consequence-webmcp.ashrafahmed1232.workers.dev](https://consequence-webmcp.ashrafahmed1232.workers.dev)

```js
document.modelContext.registerTool({
  name: "answer_question",
  description: "Answer a field directly. Refuses with a structured reason for human_only fields.",
  inputSchema: {
    type: "object",
    properties: { fieldId: { type: "string" }, value: { type: "string" } },
    required: ["fieldId", "value"],
  },
  execute: async ({ fieldId, value }) => {
    const field = APPLICATION_SCHEMA.flatMap((s) => s.fields).find((f) => f.id === fieldId);
    if (field?.permission === "human_only") {
      return { content: [{ type: "text", text: `Refused: "${fieldId}" requires the human's own action. An agent cannot set it.` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(answerField(fieldId, value)) }] };
  },
});
```
*(Simplified. The real registration goes through [`webmcp-kit`](https://github.com/AshrafAhmed9/webmcp-kit)'s `defineTool`/`registerTools`, and the refusal is enforced in the shared reducer, not just here. See `src/tools/write.ts`.)*

## The mechanic

Every field declares a permission class:

- **`agent_fillable`**: your agent may set it directly. Addresses, dates, employment history, anything it can transcribe or reason about.
- **`human_only`**: attestations and signatures. Calling `answer_question` on one of these doesn't fail quietly. It throws a structured `HumanOnlyFieldError` naming the field and telling the agent to hand back to you. An agent cannot sign your name.
- **`evidence_required`**: fields like a bank-balance summary. Your agent can only `propose_answer`, which lands the value as *pending confirmation*, never as answered, until you accept it.

This is enforced twice: once in the WebMCP tool layer, and again in the shared reducer every mutation path goes through (client UI, Durable Object, tool call). See `src/shared/reducer.ts`. There's no code path that skips it.

## Try it

Open the deployed URL in ChatGPT's in-app browser (or Chrome with `chrome://flags/#enable-webmcp-testing`) and ask your agent to fill out the application. Watch it complete the `agent_fillable` sections, then hit a wall the moment it reaches the attestations. That refusal, not the form itself, is the point. In any other browser, the sidebar's **Simulated Agent** panel includes a "Try to sign the attestation (will be refused)" button that produces the exact same refusal through the exact same code path.

## Why this is a strong fit for WebMCP

A server-side MCP server fronting a REST API has no way to know which fields on a live, half-filled, unsaved form are attestations versus transcribable facts, unless the API itself encodes that. And even then, it can't stop an agent from calling `POST /submit` with a forged signature value, because it has no relationship to the UI a human is actually looking at. Here, the tool *is* the form: `answer_question`'s refusal comes from the same schema (`seed/schema.ts`) that renders the field with a red border and a "human only" label in the UI. The permission boundary can't drift out of sync with what the human sees. There's only one definition of it.

The conditional branches make the same point about tool *existence*, not just behavior. Answering `employment_status = self_employed` makes the Self-Employment Details section visible, and only then do `answer_question` calls against its fields (`business_name`, `trading_period_start`, …) become meaningful, because only then do those fields exist in the schema `get_section` and `list_open_questions` read from.

## How it improves the experience

Long, branching, high-stakes applications are exactly where people currently either pay a consultant or make expensive mistakes filling them out alone. An agent that can do the transcription and cross-referencing (`check_consistency` catches an expired passport, overlapping employment dates, an unexplained prior refusal: real checks against real answers, see `src/shared/derive.ts`) while being structurally incapable of forging the parts that require a human's actual consent is a meaningfully different, and meaningfully safer, way to get this kind of paperwork done.

## Tools

20 tools across ~63 fields and 9 sections.

| Tool | Kind | What it does |
|---|---|---|
| `get_application_status` | read | Sections completed, open questions, readiness to submit |
| `list_open_questions` | read | Every unanswered or unconfirmed required field |
| `list_blocking_items` | read | Everything currently blocking submission |
| `explain_requirement` | read | Plain-language requirement and permission class for one field |
| `get_section` | read | All fields and current values for one section |
| `check_consistency` | read | Cross-field contradictions: overlapping dates, an expired passport, income mismatches |
| `summarize_application` | read | Plain-language progress summary |
| `read_evidence` | read | Extract a plain-text summary from an attached file (stub, see Known limitations) |
| `list_evidence` | read | Evidence files attached to this application |
| `get_provenance_report` | read | Who filled every field, and when |
| `get_history` | read | Full, replayable mutation history |
| `list_review_items` | read | Reviewer comments across all sections |
| `navigate_to_section` | write | Move the active section |
| `answer_question` | write | Set a field directly; refuses `human_only` fields with a structured reason |
| `propose_answer` | write | Propose a value for an `evidence_required` field, pending human confirmation |
| `validate_section` | write | Check one section for unanswered required fields |
| `request_human_action` | write | Escalate a field or issue to the human |
| `request_evidence` | write | Ask the human to attach supporting evidence (the agent cannot attach it itself) |
| `add_review_comment` | write | Comment on a section under the caller's own identity |
| `submit_application` | write, confirmation-gated | Refuses while anything required is open or unsigned |

## Architecture

- **`seed/schema.ts`**: ~63 fields across 9 sections (7 base, 2 conditional branches), each with a `PermissionClass`.
- **`src/shared/reducer.ts`**: the one mutation path, enforcing permission classes for every actor kind.
- **`src/shared/derive.ts`**: `openQuestions`, `blockingItems`, `checkConsistency`. Real, concrete cross-field checks.
- **`src/tools/`**: ~20 tools on [`webmcp-kit`](https://github.com/AshrafAhmed9/webmcp-kit)'s `defineTool`. `submit_application` is confirmation-gated via `withConfirmation` and independently refuses if anything required is still open.
- **`src/worker/`**: Cloudflare Worker + Durable Object, same pattern as [Cadence](https://github.com/AshrafAhmed9/cadence), with a hash-chained audit log exposed via `get_history`/`get_provenance_report`.

## Known limitations

- **Auth is a local demo identity, not real passkey authentication.** See Cadence's README for the same caveat; it applies identically here. The permission-class enforcement this document describes is fully real regardless of how the human is authenticated.
- **`read_evidence` is a clearly-labeled stub, not a working OCR pipeline.** See `SECURITY.md`. It demonstrates the intended agent-propose-human-confirm shape without overclaiming document parsing that isn't built.
- **Evidence storage is metadata-only in this pass** (filename, uploader, timestamp). Real file bytes aren't persisted. The permission boundary this app demonstrates, that an agent can never attach evidence and can only request it, doesn't depend on real file storage to be genuine.
- **Multi-party review** (inviting a second reviewer with a scoped agent grant) is modeled in the data layer and tool-scope registry (`add_reviewer`, `CONSEQUENCE_TOOL_SCOPES`), but there's no dedicated invite UI yet. Reviewers can be added via the store API today.

## Development

```bash
npm install
npm run dev
npm run worker:dev
npm run build
npm run deploy
```

## License

MIT. See [LICENSE](./LICENSE).
