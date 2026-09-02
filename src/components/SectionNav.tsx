import { visibleSections } from "../shared/derive.js";
import type { Application } from "../shared/types.js";

export function SectionNav({
  app,
  activeSectionId,
  onSelect,
}: {
  app: Application;
  activeSectionId: string;
  onSelect: (id: string) => void;
}) {
  const sections = visibleSections(app);

  return (
    <nav className="nav-column" aria-label="Application sections">
      {sections.map((section) => {
        const missing = section.fields.filter((f) => f.required && !app.values[f.id]?.value).length;
        return (
          <div
            key={section.id}
            className={`nav-item${section.id === activeSectionId ? " active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(section.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(section.id); } }}
          >
            <span>{section.title}</span>
            {missing > 0 && <span className="badge-count">{missing}</span>}
          </div>
        );
      })}
      <div
        className={`nav-item${activeSectionId === "__review__" ? " active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect("__review__")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect("__review__"); } }}
        style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}
      >
        <span>Review &amp; submit</span>
      </div>
    </nav>
  );
}
