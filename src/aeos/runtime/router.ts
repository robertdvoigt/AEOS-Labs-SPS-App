import type { RuntimeModelConfig } from "@/aeos/runtime/config";
import { getRuntimeModelConfig } from "@/aeos/runtime/config";
import type { RuntimeModelProfile } from "@/aeos/runtime/contracts";

export type RoutableAction = {
  action_type: string;
  objective: string;
  required_capabilities: unknown;
};

export type RuntimeExecutionStrategy = {
  primary: RuntimeModelProfile;
  fallback: RuntimeModelProfile | null;
  rationale: string;
};

function requiresDeepReasoning(action: RoutableAction) {
  const objective = action.objective.toLowerCase();
  return (
    action.action_type === "analysis" ||
    objective.includes("requirements") ||
    objective.includes("architecture") ||
    objective.includes("strategy")
  );
}

export function selectExecutionStrategy(
  action: RoutableAction,
  config: RuntimeModelConfig = getRuntimeModelConfig(),
): RuntimeExecutionStrategy {
  if (requiresDeepReasoning(action)) {
    return {
      primary: config.deep,
      fallback: config.deep.model === config.routine.model ? null : config.routine,
      rationale: "The action is a consequential structured analysis task.",
    };
  }

  return {
    primary: config.routine,
    fallback: null,
    rationale: "The action is routine, reversible, and directly verifiable.",
  };
}
