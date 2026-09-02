import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isWebMCPAvailable } from "webmcp-kit";
import type { PermissionScope } from "../cf-foundation/actor.js";
import { createApplicationStore } from "../lib/store.js";
import { connectSync, type SyncStatus } from "../lib/sync.js";
import { loadOrCreateIdentity } from "../lib/identity.js";
import { useConsequenceTools } from "../lib/useConsequenceTools.js";
import { blankApplication } from "../../seed/application.js";
import { APPLICATION_SCHEMA } from "../../seed/schema.js";
import { visibleSections } from "../shared/derive.js";
import { SectionNav } from "./SectionNav.js";
import { FieldRow } from "./FieldRow.js";
import { ReviewScreen } from "./ReviewScreen.js";
import { ActivityFeed } from "./ActivityFeed.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { WebMCPBanner } from "./WebMCPBanner.js";
import { SimulatedAgentPanel } from "./SimulatedAgentPanel.js";
import "./styles.css";

const identity = loadOrCreateIdentity();
const store = createApplicationStore(blankApplication(identity.human.name));

export function App() {
  const app = useSyncExternalStore(store.subscribe, store.getState);
  const [webMCPAvailable] = useState(isWebMCPAvailable());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [scope, setScope] = useState<PermissionScope>("triage");

  const agent = useMemo(() => identity.makeAgent(scope), [scope]);
  const { tools, activityLog, confirmRequest, registeredCount, nav, setNav } = useConsequenceTools(store, agent);

  useEffect(() => {
    const disconnect = connectSync(store, identity.human.userId, setSyncStatus, (snapshot) => store.hydrate(snapshot));
    return disconnect;
  }, []);

  const activeSectionId = nav.activeSectionId;
  const sections = useMemo(() => visibleSections(app), [app]);
  const activeSection = APPLICATION_SCHEMA.find((s) => s.id === activeSectionId) ?? sections[0];

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Consequence</span>
        <span style={{ color: "var(--text-faint)" }}>{identity.human.name}</span>
        <div className="spacer" />
        <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Agent grant:{" "}
          <select value={scope} onChange={(e) => setScope(e.target.value as PermissionScope)} aria-label="Agent permission scope">
            <option value="read">read</option>
            <option value="triage">triage</option>
            <option value="write">write</option>
            <option value="full">full</option>
          </select>
        </label>
        <span className={`tool-count${registeredCount > 0 ? " pulse" : ""}`}>
          {webMCPAvailable ? `${registeredCount} tools live` : "WebMCP unavailable"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>sync: {syncStatus}</span>
        <button
          title="Wipe this application back to a blank starting state. Only affects your own application."
          onClick={async () => {
            if (!confirm("Reset this application back to blank? This can't be undone.")) return;
            const res = await fetch(`/api/application/${identity.human.userId}/reset-if-idle`, { method: "POST" });
            const body = await res.json().catch(() => null);
            if (body?.reset) location.reload();
            else alert("Application was touched in the last 2 minutes — try again shortly.");
          }}
        >
          Reset demo data
        </button>
      </header>

      <WebMCPBanner available={webMCPAvailable} />

      <SectionNav app={app} activeSectionId={activeSectionId} onSelect={(id) => setNav({ activeSectionId: id })} />

      <main className="main-column">
        {activeSectionId === "__review__" || !activeSection ? (
          <ReviewScreen app={app} store={store} human={identity.human} />
        ) : (
          <>
            <h2>{activeSection.title}</h2>
            {activeSection.fields.map((field) => (
              <FieldRow key={field.id} field={field} app={app} store={store} human={identity.human} />
            ))}
          </>
        )}
      </main>

      <aside className="sidebar">
        <div className="sidebar-header">Agent activity</div>
        <ActivityFeed log={activityLog} />
        <SimulatedAgentPanel allTools={tools.all} activityLog={activityLog} getState={store.getState} />
      </aside>

      <ConfirmDialog request={confirmRequest} />
    </div>
  );
}
