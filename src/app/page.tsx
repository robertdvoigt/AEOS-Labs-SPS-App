import { GOVERNING_VERSIONS } from "@/aeos/contracts/versions";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">AEOS Labs</p>
        <h1 id="page-title">Software &amp; Product Specialization</h1>
        <p className="lede">
          Increment 0 establishes the production-intended foundation for a governed,
          persistent, AI-native AEOS web application.
        </p>
        <div className="status-card">
          <div><span className="status-dot" aria-hidden="true" /><strong>Increment 0</strong></div>
          <p>Repository foundation established. External platform verification is next.</p>
        </div>
      </section>
      <section className="versions" aria-label="Governing specifications">
        <h2>Governing specifications</h2>
        <dl>
          <div><dt>Core</dt><dd>v{GOVERNING_VERSIONS.core}</dd></div>
          <div><dt>Software &amp; Product</dt><dd>v{GOVERNING_VERSIONS.softwareProduct}</dd></div>
          <div><dt>Runtime</dt><dd>v{GOVERNING_VERSIONS.runtime}</dd></div>
          <div><dt>Product</dt><dd>v{GOVERNING_VERSIONS.product}</dd></div>
        </dl>
      </section>
    </main>
  );
}
