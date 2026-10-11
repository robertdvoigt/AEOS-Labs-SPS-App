import Link from "next/link";
import { signInWithPassword } from "./actions";

type LoginSearchParams = Promise<{
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Link href="/" className="brand-link">AEOS Labs</Link>
        <p className="eyebrow">Internal alpha</p>
        <h1 id="login-title" className="page-title">Sign in</h1>
        <p className="lede compact">
          Use your AEOS alpha account to resume projects from canonical state.
        </p>

        <form action={signInWithPassword} className="stack-form">
          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="primary-button">Sign in</button>
        </form>

        {params.error ? (
          <p className="form-error" role="alert">
            Sign-in failed. Check your email and password and try again.
          </p>
        ) : null}

        <p className="panel-copy">
          Alpha accounts are created by the project administrator. Public signup and
          production email delivery will be added separately.
        </p>
      </section>
    </main>
  );
}
