import Link from "next/link";
import { requestMagicLink } from "./actions";

type LoginSearchParams = Promise<{
  sent?: string;
  email?: string;
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Link href="/" className="brand-link">AEOS Labs</Link>
        <p className="eyebrow">Sign in</p>
        <h1 id="login-title" className="page-title">Continue your project</h1>
        <p className="lede compact">
          Enter your email. We&apos;ll send a secure sign-in link so your AEOS projects
          can resume from canonical state.
        </p>

        {sent ? (
          <div className="notice success" role="status">
            Sign-in link sent to <strong>{params.email}</strong>. Open the link in
            this browser to continue.
          </div>
        ) : (
          <form action={requestMagicLink} className="stack-form">
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
            <button type="submit" className="primary-button">Send sign-in link</button>
          </form>
        )}

        {params.error ? (
          <p className="form-error" role="alert">
            We couldn&apos;t complete sign-in. Check the email address and try again.
          </p>
        ) : null}
      </section>
    </main>
  );
}
