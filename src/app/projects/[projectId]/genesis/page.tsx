import Link from "next/link";
import { notFound } from "next/navigation";
import { readProjectState } from "@/server/project-state";
import { saveGenesisAction } from "./actions";

function listValue(values: string[]) {
  return values.join("\n");
}

export default async function GenesisPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
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

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div>
          <Link href={"/projects/" + projectId} className="back-link">← Project workspace</Link>
          <p className="eyebrow">AEOS Genesis</p>
          <h1 className="page-title">Establish enough state to act responsibly</h1>
          <p className="lede compact">
            These are the decision-relevant inputs needed for the first Product Model and primary Next Best Action.
          </p>
        </div>
        <div className="revision-badge">Revision {state.profile.revision}</div>
      </header>

      {query.error === "stale" ? (
        <div className="notice warning" role="alert">
          The project changed while this form was open. Review the current values and submit again.
        </div>
      ) : null}
      {query.error && query.error !== "stale" ? (
        <div className="notice warning" role="alert">
          Genesis could not be reconciled. Check the required fields and try again.
        </div>
      ) : null}

      <form action={saveGenesisAction} className="genesis-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="expectedRevision" value={state.profile.revision} />

        <section className="panel genesis-section">
          <p className="eyebrow">Outcome</p>
          <label>
            <span>Project mission</span>
            <textarea name="mission" required rows={3} defaultValue={core.mission ?? ""} placeholder="What outcome should this project create, independent of the implementation?" />
          </label>
          <label>
            <span>Target condition</span>
            <textarea name="targetCondition" required rows={3} defaultValue={core.targetCondition ?? ""} placeholder="What should be materially different when the project succeeds?" />
          </label>
          <label>
            <span>Success basis</span>
            <textarea name="successBasis" required rows={3} defaultValue={core.successStandard ?? ""} placeholder="What observable result would be sufficient to call this direction successful?" />
          </label>
        </section>

        <section className="panel genesis-section">
          <p className="eyebrow">Product hypothesis</p>
          <label>
            <span>Intended user</span>
            <textarea name="intendedUser" required rows={2} defaultValue={product.intendedUser ?? ""} placeholder="Who is this for?" />
          </label>
          <label>
            <span>Problem / opportunity</span>
            <textarea name="problemOpportunity" required rows={3} defaultValue={product.problemOpportunity ?? ""} placeholder="What important problem, friction, or opportunity should change for that user?" />
          </label>
          <label>
            <span>Minimum value</span>
            <textarea name="promisedMinimumValue" required rows={3} defaultValue={product.promisedMinimumValue ?? ""} placeholder="What is the smallest meaningful value the product must deliver?" />
          </label>
          <label>
            <span>Initial product hypothesis</span>
            <textarea name="productHypothesis" required rows={3} defaultValue={product.productHypothesis ?? ""} placeholder="What product approach might create that value? Treat this as provisional." />
          </label>
        </section>

        <section className="panel genesis-section">
          <p className="eyebrow">MVP direction</p>
          <label>
            <span>Critical workflow</span>
            <textarea name="criticalWorkflow" required rows={3} defaultValue={product.criticalWorkflow ?? ""} placeholder="Describe the smallest end-to-end workflow that must work." />
          </label>
          <label>
            <span>MVP scope — one item per line</span>
            <textarea name="mvpScope" required rows={6} defaultValue={listValue(product.mvpScope)} placeholder={"Create project\nEstablish product direction\nProduce a verified result"} />
          </label>
          <label>
            <span>Major exclusions — one item per line</span>
            <textarea name="mvpExclusions" rows={4} defaultValue={listValue(product.mvpExclusions)} placeholder="What is intentionally outside this MVP?" />
          </label>
        </section>

        <section className="panel genesis-section">
          <p className="eyebrow">Boundaries</p>
          <label>
            <span>Material constraints — one per line</span>
            <textarea name="constraints" rows={4} defaultValue={listValue(core.constraints)} placeholder="Budget, timeline, platform, legal, security, or other meaningful constraints." />
          </label>
          <label>
            <span>Human authority boundaries — one per line</span>
            <textarea name="authorityBoundaries" rows={4} defaultValue={listValue(core.authorityBoundaries)} placeholder="Decisions AEOS must not make without your approval." />
          </label>
        </section>

        <button type="submit" className="primary-button genesis-submit">
          Reconcile Genesis and derive Next Best Action
        </button>
      </form>
    </main>
  );
}
