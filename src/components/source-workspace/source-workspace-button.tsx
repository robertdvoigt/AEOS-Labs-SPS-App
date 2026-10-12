"use client";

import { useFormStatus } from "react-dom";

export function SourceWorkspaceButton({
  idle,
  pending,
  primary = false,
}: {
  idle: string;
  pending: string;
  primary?: boolean;
}) {
  const status = useFormStatus();

  return (
    <button
      type="submit"
      className={primary ? "primary-button" : "secondary-button"}
      disabled={status.pending}
      aria-disabled={status.pending}
    >
      {status.pending ? pending : idle}
    </button>
  );
}
