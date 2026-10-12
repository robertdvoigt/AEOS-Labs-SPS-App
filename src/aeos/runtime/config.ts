import type { RuntimeModelProfile } from "@/aeos/runtime/contracts";

export type RuntimeModelConfig = {
  routine: RuntimeModelProfile;
  deep: RuntimeModelProfile;
};

export function getRuntimeModelConfig(): RuntimeModelConfig {
  return {
    routine: {
      class: "fast",
      model: process.env.OPENAI_MODEL_ROUTINE?.trim() || "gpt-6-luna",
    },
    deep: {
      class: "deep",
      model: process.env.OPENAI_MODEL_DEEP?.trim() || "gpt-6.1-sol",
    },
  };
}
