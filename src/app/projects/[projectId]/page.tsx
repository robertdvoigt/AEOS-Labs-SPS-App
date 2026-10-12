import Link from "next/link";
import { notFound } from "next/navigation";
import type { Json } from "@/lib/supabase/database.types";
import { readProjectState } from "@/server/project-state";
import {
  cancelDurabilityProbeAction,
  confirmMvpAction,
  executeCurrentActionAction,
  startDurabilityProbeAction,
} from "./actions";
import { RuntimeSubmitButton } from "@/components/runtime/runtime-submit-button";
import { RuntimeStatusPoller } from "@/components/runtime/runtime-status-poller";
import { isRuntimeStateActive } from "@/aeos/runtime/status";
import { DurabilityProbeButton } from "@/components/runtime/durability-probe-button";
import { readLatestDurabilityProbe } from "@/server/durable-runtime";

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

function jsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function runtimeSummary(value: Json) {
  const root = jsonObject(value);
  const observed = jsonObject(root.observedResult as Json);
  return typeof observed.summary === "string" ? observed.summary : null;
}

function usageLabel(value: Json) {
  const usage = jsonObject(value);
  const total = typeof usage.totalTokens === "number" ? usage.totalTokens : 0;
  return total ? total.toLocaleString() + " tokens" : "—";
}

function runtimeErrorMessage(code?: string) {
  switch (code) {
    case "provider_configuration_missing":
      return "OpenAI execution is not configured yet. Add the server-side OPENAI_API_KEY and retry.";
    case "verification_failed":
      return "The model result did not satisfy the deterministic acceptance check. The action remains retryable.";
    case "capability_not_available":
      return "This action requires a Runtime capability that is not active in the Minimum Runtime.";
    case "action_not_current":
    case "action_not_executable":
      return "The action changed before execution. Refresh the current project state.";
    default:
      return code ? "Runtime execution failed safely. The current project state was preserved." : null;
  }
}

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    error?: string;
    genesis?: string;
    confirmed?: string;
    runtime?: string;
    runtime_error?: string;
    durability?: string;
    durability_error?: string;
  }>;
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
  const runtimeError = runtimeErrorMessage(query.runtime_error);
  const durability = await readLatestDurabilityProbe(projectId);
  const durabilityActive = durability?.active ?? false;
  const runtimeActionInProgress =
    Boolean(state.currentAction) &&
    state.currentAction?.owner === "aeos" &&
    state.currentAction?.action_type === "analysis" &&
    (
      state.currentAction?.status === "active" ||
      (
        state.latestRuntime?.action_id === state.currentAction?.id &&
        isRuntimeStateActive(state.latestRuntime?.state)
      )
    );

  return (
    <main className="app-shell">
      <RuntimeStatusPoller active={runtimeActionInProgress || durabilityActive} />
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
      {query.runtime === "success" ? (
        <div className="notice success" role="status">
          AEOS executed and verified the action, reconciled the result, and advanced the project state.
        </div>
      ) : null}
      {runtimeError ? (
        <div className="notice warning" role="alert">{runtimeError}</div>
      ) : null}
      {query.durability === "started" ? (
        <div className="notice success" role="status">
          Durable workflow started. You can leave this page; progress is persisted independently of this request.
        </div>
      ) : null}
      {query.durability === "cancel_requested" ? (
        <div className="notice warning" role="status">
          Cancellation requested. The workflow will stop at its next safe boundary.
        </div>
      ) : null}
      {query.durability_error ? (
        <div className="notice warning" role="alert">
          The durable workflow check could not be started or updated. Canonical project state was preserved.
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
                <p className="eyebrow">Product Model</p>
                <h2>Current MVP direction</h2>
              </div>
              <span>{product.status}</span>
            </div>
            <div className="product-model-grid">
              <div><h3>Problem / opportunity</h3><p>{product.problemOpportunity}</p></div>
              <div><h3>Product hypothesis</h3><p>{product.productHypothesis}</p></div>
              <div>
                <h3>MVP scope</h3>
                <ul className="scope-list">{product.mvpScope.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>Build-ready requirements</h3>
                {product.requirements.length ? (
                  <ul className="scope-list">
                    {product.requirements.map((item, index) => (
                      <li key={String((item as Record<string, unknown>).id ?? index)}>
                        {String((item as Record<string, unknown>).title ?? "Requirement")}
                      </li>
                    ))}
                  </ul>
                ) : <p>Not defined yet.</p>}
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
                ) : runtimeActionInProgress ? (
                  <div className="runtime-running-card" role="status" aria-live="polite">
                    <span className="runtime-spinner" aria-hidden="true" />
                    <div>
                      <strong>AEOS is working on this action.</strong>
                      <p>
                        Execution has started and this page will refresh automatically as status changes.
                      </p>
                    </div>
                  </div>
                ) : state.currentAction.owner === "aeos" &&
                    state.currentAction.action_type === "analysis" &&
                    state.currentAction.status === "ready" ? (
                  <div className="runtime-action">
                    <p>
                      The Minimum Runtime can execute this bounded analysis action using canonical project context, structured output, and deterministic verification.
                    </p>
                    <form action={executeCurrentActionAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="actionId" value={state.currentAction.id} />
                      <input type="hidden" name="expectedRevision" value={state.profile.revision} />
                      <RuntimeSubmitButton />
                    </form>
                  </div>
                ) : state.currentAction.owner === "aeos" ? (
                  <div className="notice success">
                    This action is correctly owned by AEOS, but it requires coding/sandbox capabilities beyond the synchronous Minimum Runtime.
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          {state.currentAction?.owner === "aeos" &&
          state.currentAction.action_type === "build" ? (
            <section className="panel durability-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Implementation verification</p>
                  <h2>Durable Runtime continuity</h2>
                </div>
                <span>{durability?.execution.state ?? "not run"}</span>
              </div>
              <p className="panel-copy">
                This operational check proves that Runtime progress survives the initiating request and browser session before coding/sandbox execution is enabled.
              </p>

              {durability ? (
                <>
                  <dl className="runtime-grid">
                    <div>
                      <dt>Workflow run</dt>
                      <dd>{durability.execution.workflow_run_id ?? "starting…"}</dd>
                    </div>
                    <div>
                      <dt>Checkpoints</dt>
                      <dd>{durability.checkpoints.length}</dd>
                    </div>
                    <div>
                      <dt>Verification</dt>
                      <dd>{durability.verification?.status ?? "pending"}</dd>
                    </div>
                  </dl>

                  {durability.checkpoints.length ? (
                    <ol className="checkpoint-list">
                      {durability.checkpoints.map((checkpoint) => (
                        <li key={checkpoint.sequence}>
                          <strong>{checkpoint.phase}</strong>
                          <span>Checkpoint {checkpoint.sequence}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {durability.active ? (
                    <form action={cancelDurabilityProbeAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input
                        type="hidden"
                        name="runtimeExecutionId"
                        value={durability.execution.id}
                      />
                      <DurabilityProbeButton mode="cancel" />
                    </form>
                  ) : (
                    <form action={startDurabilityProbeAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input
                        type="hidden"
                        name="expectedRevision"
                        value={state.profile.revision}
                      />
                      <DurabilityProbeButton mode="start" />
                    </form>
                  )}
                </>
              ) : (
                <form action={startDurabilityProbeAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input
                    type="hidden"
                    name="expectedRevision"
                    value={state.profile.revision}
                  />
                  <DurabilityProbeButton mode="start" />
                </form>
              )}
            </section>
          ) : null}

          {state.latestRuntime ? (
            <section className="panel runtime-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Latest Runtime execution</p>
                  <h2>{state.latestRuntime.state}</h2>
                </div>
                <span>{state.latestRuntime.model_class ?? "runtime"}</span>
              </div>
              <div className="runtime-grid">
                <div><dt>Model</dt><dd>{state.latestRuntime.model ?? "—"}</dd></div>
                <div><dt>Usage</dt><dd>{usageLabel(state.latestRuntime.usage)}</dd></div>
                <div><dt>Verification</dt><dd>{state.latestVerification?.status ?? "—"}</dd></div>
              </div>
              {runtimeSummary(state.latestRuntime.result) ? (
                <p className="runtime-summary">{runtimeSummary(state.latestRuntime.result)}</p>
              ) : null}
              {state.latestRuntime.error_message ? (
                <p className="form-error">{state.latestRuntime.error_message}</p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
