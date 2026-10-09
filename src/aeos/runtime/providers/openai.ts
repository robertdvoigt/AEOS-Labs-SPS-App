import type {
  ProviderAdapter,
  ProviderTextRequest,
  ProviderTextResult,
  RuntimeModelClass,
} from "@/aeos/runtime/contracts";

const DEFAULT_MODELS: Record<RuntimeModelClass, string> = {
  fast: "gpt-6-luna",
  standard: "gpt-6.1-sol",
  deep: "gpt-6-astra",
  critical: "gpt-6-astra",
};

const REASONING_EFFORT: Record<RuntimeModelClass, "low" | "medium" | "high" | "xhigh"> = {
  fast: "low",
  standard: "medium",
  deep: "high",
  critical: "xhigh",
};

interface OpenAIResponsePayload {
  id: string;
  model: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: Record<string, unknown>;
}

function extractOutputText(response: OpenAIResponsePayload): string {
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

export class OpenAIResponsesAdapter implements ProviderAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly models: Partial<Record<RuntimeModelClass, string>> = {},
  ) {}

  async invokeText(request: ProviderTextRequest): Promise<ProviderTextResult> {
    const model = this.models[request.modelClass] ?? DEFAULT_MODELS[request.modelClass];
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: request.instructions,
        input: request.input,
        reasoning: { effort: REASONING_EFFORT[request.modelClass] },
        metadata: request.metadata ?? {},
        store: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI Responses API failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const payload = (await response.json()) as OpenAIResponsePayload;
    return {
      provider: "openai",
      model: payload.model,
      responseId: payload.id,
      outputText: extractOutputText(payload),
      usage: payload.usage ?? {},
    };
  }
}
