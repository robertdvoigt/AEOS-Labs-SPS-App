import Link from "next/link";
import { listProjects } from "@/server/project-state";
import { createProjectAction, signOutAction } from "./actions";

type ProjectsSearchParams = Promise<{ error?: string }>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: ProjectsSearchParams;
}) {
  const params = await searchParams;
  const projects = await listProjects();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AEOS Labs</p>
          <h1 className="page-title">Projects</h1>
        </div>
        <form action={signOutAction}>
          <button className="secondary-button" type="submit">Sign out</button>
        </form>
      </header>

      <section className="panel">
        <h2>Create project</h2>
        <p className="panel-copy">
          Start with the outcome. AEOS will establish the project state before choosing
          implementation details.
        </p>
        <form action={createProjectAction} className="genesis-section">
          <label>
            <span>Project name</span>
            <input
              type="text"
              name="name"
              required
              maxLength={160}
              placeholder="e.g. Scheduling assistant MVP"
            />
          </label>
          <label>
            <span>Project goal</span>
            <textarea
              name="goal"
              required
              maxLength={1200}
              rows={3}
              placeholder="Describe the outcome you want to create in plain language."
            />
          </label>
          <button type="submit" className="primary-button">Create project</button>
        </form>
        {params.error ? (
          <p className="form-error" role="alert">Project creation failed. Try again.</p>
        ) : null}
      </section>

      <section className="project-list" aria-labelledby="project-list-title">
        <div className="section-heading">
          <h2 id="project-list-title">Your projects</h2>
          <span>{projects.length}</span>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            No projects yet. Create the first one above.
          </div>
        ) : (
          <div className="card-grid">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="project-card">
                <div className="project-card-top">
                  <strong>{project.name}</strong>
                  <span className="status-pill">{project.status}</span>
                </div>
                <p>Open canonical project state</p>
                <small>
                  Core v{project.core_version} · Product v{project.software_product_version} · Runtime v{project.runtime_version}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
