import Link from "next/link";
import { notFound } from "next/navigation";
import { readProjectState } from "@/server/project-state";
import { confirmMvpAction } from "./actions";

function ownerLabel(owner: string) {
  if (owner === "aeos") return "AEOS will do this";
  if (owner === "user") return "You need to decide";
  return "AEOS can continue after your input";
}

function acceptanceLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "See action acceptance criteria.";
  const entries = Object.keys(value as Record<string, unknown>);
  return entries.length ? entries.join(", ") : "See action acceptance criteria.";
}

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; genesis?: string; confirmed?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;

  let state;
  try {
    state = await readProjectState(projectId);
  } catch {
    notFound();
  }

  const core = state.canonical.coreState;
  const product = state.canonical.specializationState.productModel;
  const genesisEstablished = core.genesis.status === "established" && product.status !== "not_started";

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

      {query.genesis === "1" ? (
        <div className="notice success" role="status">
          Genesis and the provisional Product Model were reconciled. A primary Next Best Action is now active.
        </div>
      ) : null}
      {query.confirmed === "1" ? (
        <div className="notice success" role="status">
          MVP direction confirmed. The primary Next Best Action was reassessed.
        </div>
      ) : null}
      {query.error === "stale" ? (
        <div className="notice warning" role="alert">
          The project changed before that decision was applied. The newer state was preserved.
        </div>
      ) : null}
      {query.error && query.error !== "stale" ? (
        <div className="notice warning" role="alert">
          The project state could not be updated.
        </div>
      ) : null}

      {!genesisEstablished ? (
        <section className="panel genesis-cta">
          <p className="eyebrow">Genesis required</p>
          <h2>Establish the project before committing to product scope.</h2>
          <p className="panel-copy">
            AEOS needs enough mission, user, success, product-hypothesis, MVP, constraint, and authority context to select a responsible next action.
          </p>
          <Link href={"/projects/" + projectId + "/genesis"} className="primary-link">Start Genesis</Link>
        </section>
      ) : (
        <>
          <section className="workspace-grid">
            <article className="panel">
              <p className="eyebrow">Project mission</p>
              <h2>{core.mission}</h2>
              <dl className="state-list">
                <div><dt>Intended user</dt><dd>{product.intendedUser}</dd></div>
                <div><dt>Minimum value</dt><dd>{product.promisedMinimumValue}</dd></div>
                <div><dt>Critical workflow</dt><dd>{product.criticalWorkflow}</dd></div>
              </dl>
              <Link href={"/projects/" + projectId + "/genesis"} className="secondary-link correction-link">
                Correct Genesis / MVP direction
              </Link>
            </article>

            <aside className="panel">
              <p className="eyebrow">State integrity</p>
              <dl className="state-list">
                <div><dt>Status</dt><dd>{state.project.status}</dd></div>
                <div><dt>Revision</dt><dd>{state.profile.revision}</dd></div>
                <div><dt>Parent revision</dt><dd>{state.profile.source_revision_parent ?? "—"}</dd></div>
                <div><dt>Product Model</dt><dd>{product.status}</dd></div>
              </dl>
            </aside>
          </section>

          <section className="panel product-model-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Provisional Product Model</p>
                <h2>Current MVP direction</h2>
              </div>
              <span>{product.status}</span>
            </div>
            <div className="product-model-grid">
              <div>
                <h3>Problem / opportunity</h3>
                <p>{product.problemOpportunity}</p>
              </div>
              <div>
                <h3>Product hypothesis</h3>
                <p>{product.productHypothesis}</p>
              </div>
              <div>
                <h3>MVP scope</h3>
                <ul className="scope-list">
                  {product.mvpScope.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h3>Major exclusions</h3>
                {product.mvpExclusions.length ? (
                  <ul className="scope-list">
                    {product.mvpExclusions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p>None recorded.</p>}
              </div>
            </div>
          </section>

          <section className="panel nba-panel" aria-labelledby="nba-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Primary Next Best Action</p>
                <h2 id="nba-title">{state.currentAction?.title ?? "No current action"}</h2>
              </div>
              {state.currentAction ? <span className="ownership-chip">{ownerLabel(state.currentAction.owner)}</span> : null}
            </div>

            {state.currentAction ? (
              <>
                <p className="nba-objective">{state.currentAction.objective}</p>
                <dl className="state-list compact-list">
                  <div><dt>Why it matters</dt><dd>{state.currentAction.objective}</dd></div>
                  <div><dt>What result counts</dt><dd>{acceptanceLabel(state.currentAction.acceptance_condition)}</dd></div>
                  <div><dt>Bound to revision</dt><dd>{state.currentAction.profile_revision}</dd></div>
                </dl>

                {state.humanDependency ? (
                  <div className="human-dependency">
                    <strong>{state.humanDependency.prompt}</strong>
                    <p>{state.humanDependency.why_human}</p>
                    <form action={confirmMvpAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="expectedRevision" value={state.profile.revision} />
                      <button type="submit" className="primary-button">Confirm MVP direction</button>
                    </form>
                  </div>
                ) : state.currentAction.owner === "aeos" ? (
                  <div className="notice success">
                    This action is ready for AEOS execution. Governed Runtime execution is the next implementation increment.
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
