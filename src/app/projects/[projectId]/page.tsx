import Link from "next/link";
import { notFound } from "next/navigation";
import type { Json } from "@/lib/supabase/database.types";
import { readProjectState } from "@/server/project-state";
import { updateMissionAction } from "./actions";

function missionFromState(value: Json) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const mission = value.mission;
    return typeof mission === "string" ? mission : "";
  }
  return "";
}

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;

  let state;
  try {
    state = await readProjectState(projectId);
  } catch {
    notFound();
  }

  const mission = missionFromState(state.profile.core_state);

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div>
          <Link href="/projects" className="back-link">← Projects</Link>
          <p className="eyebrow">Project workspace</p>
          <h1 className="page-title">{state.project.name}</h1>
        </div>
        <div className="revision-badge">Revision {state.profile.revision}</div>
      </header>

      {query.updated === "1" ? (
        <div className="notice success" role="status">
          Canonical project state updated and revision advanced.
        </div>
      ) : null}
      {query.error === "stale" ? (
        <div className="notice warning" role="alert">
          This project changed before your update was applied. The newer state was preserved.
          Review it and submit again if the change is still correct.
        </div>
      ) : null}
      {query.error && query.error !== "stale" ? (
        <div className="notice warning" role="alert">
          The project state could not be updated.
        </div>
      ) : null}

      <section className="workspace-grid">
        <article className="panel">
          <p className="eyebrow">Project mission</p>
          <h2>{mission || "Not established yet"}</h2>
          <p className="panel-copy">
            This field is stored in the canonical Project Profile, not in conversation memory.
          </p>

          <form action={updateMissionAction} className="stack-form">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="expectedRevision" value={state.profile.revision} />
            <label>
              <span>Mission / intended outcome</span>
              <textarea
                name="mission"
                required
                rows={5}
                defaultValue={mission}
                placeholder="What outcome should this project create?"
              />
            </label>
            <button type="submit" className="primary-button">
              Update canonical state
            </button>
          </form>
        </article>

        <aside className="panel">
          <p className="eyebrow">State integrity</p>
          <dl className="state-list">
            <div><dt>Status</dt><dd>{state.project.status}</dd></div>
            <div><dt>Revision</dt><dd>{state.profile.revision}</dd></div>
            <div><dt>Parent revision</dt><dd>{state.profile.source_revision_parent ?? "—"}</dd></div>
            <div><dt>Current NBA</dt><dd>{state.profile.current_nba_action_id ?? "Not selected yet"}</dd></div>
          </dl>
          <p className="panel-copy">
            Stale writes are rejected at the database boundary so an older browser state cannot
            silently overwrite a newer project revision.
          </p>
        </aside>
      </section>
    </main>
  );
}
