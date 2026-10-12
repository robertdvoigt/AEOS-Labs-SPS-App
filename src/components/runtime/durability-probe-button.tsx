"use client";

import { useFormStatus } from "react-dom";

export function DurabilityProbeButton({
  mode,
}: {
  mode: "start" | "cancel";
}) {
  const { pending } = useFormStatus();
  const isStart = mode === "start";

  return (
    <button
      type="submit"
      className={isStart ? "secondary-button" : "secondary-button"}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending
        ? isStart
          ? "Starting durable workflow…"
          : "Requesting cancellation…"
        : isStart
          ? "Run durability check"
          : "Cancel at next safe boundary"}
    </button>
  );
}
