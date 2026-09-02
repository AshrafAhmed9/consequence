import { SyncedDurableObject, type Actor, type Patch } from "../cf-foundation/index.js";
import { reduce, type ActionType } from "../shared/reducer.js";
import type { Application } from "../shared/types.js";
import { blankApplication } from "../../seed/application.js";

/**
 * One Durable Object per application. Same pattern as Cadence's
 * BoardDurableObject: authoritative state, mutations through the shared
 * `reduce`, every change appended to the hash-chained audit log. Also
 * serves the audit trail over a plain GET for `get_history` — WebSocket
 * clients get live patches, but the tool needs a point-in-time read.
 */
export class ApplicationDurableObject extends SyncedDurableObject {
  private cached: Application | null = null;

  private async loadState(): Promise<Application> {
    if (this.cached) return this.cached;
    const stored = await this.state.storage.get<Application>("application");
    this.cached = stored ?? blankApplication();
    if (!stored) await this.state.storage.put("application", this.cached);
    return this.cached;
  }

  protected async snapshot(): Promise<Application> {
    return this.loadState();
  }

  protected async applyPatch(patch: Patch): Promise<{ entityId: string; before: unknown; after: unknown }> {
    const state = await this.loadState();
    const action = { type: patch.type, payload: patch.payload } as ActionType;
    const result = reduce(state, action, patch.actor as Actor);
    this.cached = result.state;
    await this.state.storage.put("application", this.cached);
    return { entityId: result.entityId, before: result.before, after: result.after };
  }

  protected async resetState(): Promise<void> {
    this.cached = blankApplication();
    await this.state.storage.put("application", this.cached);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/history")) {
      const trail = await this.getAuditTrail();
      return Response.json(trail);
    }
    return super.fetch(request);
  }
}
