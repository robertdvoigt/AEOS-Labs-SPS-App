"use client";

import { useFormStatus } from "react-dom";

export function RuntimeSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="runtime-submit">
      <button
        type="submit"
        className="primary-button runtime-submit-button"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? <span className="runtime-spinner" aria-hidden="true" /> : null}
        {pending ? "AEOS is working…" : "Run with AEOS"}
      </button>

      {pending ? (
        <p className="runtime-pending-copy" role="status" aria-live="polite">
          Execution started. AEOS is generating and verifying the result. This can take a minute or more.
        </p>
      ) : null}
    </div>
  );
}
