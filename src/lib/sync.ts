import type { Actor } from "../cf-foundation/actor.js";
import type { ActionType } from "../shared/reducer.js";
import type { Application } from "../shared/types.js";
import type { ApplicationStore } from "./store.js";

export type SyncStatus = "connecting" | "open" | "closed" | "unavailable";

export function connectSync(
  store: ApplicationStore,
  applicationId: string,
  onStatus: (status: SyncStatus) => void,
  onSnapshot?: (state: Application) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closedByCaller = false;

  async function fetchHistory() {
    try {
      const res = await fetch(`/api/application/${applicationId}/history`);
      if (res.ok) store.setAuditTrail(await res.json());
    } catch {
      // history is best-effort — get_history just returns [] if unavailable
    }
  }

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    onStatus("connecting");
    try {
      ws = new WebSocket(`${proto}//${location.host}/api/application/${applicationId}`);
    } catch {
      onStatus("unavailable");
      return;
    }

    ws.addEventListener("open", () => {
      onStatus("open");
      void fetchHistory();
    });
    ws.addEventListener("close", () => {
      onStatus("closed");
      if (!closedByCaller) setTimeout(connect, 2000);
    });
    ws.addEventListener("error", () => onStatus("unavailable"));

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "snapshot") {
        onSnapshot?.(msg.payload as Application);
      } else if (msg.type === "patch") {
        const patch = msg.payload as { type: ActionType["type"]; payload: unknown; actor: Actor };
        store.applyRemote({ type: patch.type, payload: patch.payload } as ActionType, patch.actor);
        void fetchHistory();
      }
    });
  }

  store.onLocalDispatch((action, dispatchActor) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: action.type, payload: action.payload, actor: dispatchActor, timestamp: Date.now() }));
    }
  });

  connect();

  return () => {
    closedByCaller = true;
    ws?.close();
  };
}
