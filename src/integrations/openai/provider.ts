import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  RuntimeModelProfile,
  RuntimeProviderResult,
  RuntimeUsage,
} from "@/aeos/runtime/contracts";
import { runtimeAnalysisOutputSchema } from "@/aeos/runtime/contracts";
import type { RuntimeExecutionContext } from "@/aeos/runtime/context-builder";

const RUNTIME_INSTRUCTIONS = `
You are executing one AEOS Runtime Action Contract.

Use only the supplied canonical project state and Action Contract.
Do not invent authority, user decisions, evidence, numeric thresholds, or product facts.
For this action, translate the confirmed MVP direction into bounded build-ready requirements.
Each requirement must state observable acceptance criteria and credible verification methods.
Preserve unresolved assumptions and limitations explicitly.
Return only the structured output requested by the response schema.
Do not include private chain-of-thought.
`.trim();

export class RuntimeProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeProviderError";
  }
}

function normalizeUsage(usage: unknown): RuntimeUsage {
  const value = (usage ?? {}) as {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };

  return {
    inputTokens: value.input_tokens ?? 0,
    outputTokens: value.output_tokens ?? 0,
    totalTokens: value.total_tokens ?? 0,
  };
}

function normalizeOpenAIError(error: unknown): RuntimeProviderError {
  if (error instanceof RuntimeProviderError) return error;

  const value = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  const status = value?.status;
  const code = value?.code || "openai_error";
  const retryable = status === 408 || status === 409 || status === 429 || (typeof status === "number" && status >= 500);

  return new RuntimeProviderError(
    code,
    retryable,
    value?.message || "OpenAI execution failed.",
  );
}

export class OpenAIProvider {
  async executeStructuredAnalysis(
    context: RuntimeExecutionContext,
    profile: RuntimeModelProfile,
  ): Promise<RuntimeProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new RuntimeProviderError(
        "provider_configuration_missing",
        true,
        "OPENAI_API_KEY is not configured.",
      );
    }

    const client = new OpenAI({ apiKey });

    try {
      const response = await client.responses.parse({
        model: profile.model,
        instructions: RUNTIME_INSTRUCTIONS,
        input: JSON.stringify(context),
        text: {
          format: zodTextFormat(runtimeAnalysisOutputSchema, "aeos_runtime_analysis"),
        },
      });

      if (response.status !== "completed" || !response.output_parsed) {
        throw new RuntimeProviderError(
          "incomplete_model_response",
          true,
          "The model did not return a completed structured result.",
        );
      }

      return {
        provider: "openai",
        model: profile.model,
        providerResponseId: response.id,
        output: response.output_parsed,
        usage: normalizeUsage(response.usage),
      };
    } catch (error) {
      throw normalizeOpenAIError(error);
    }
  }
}
