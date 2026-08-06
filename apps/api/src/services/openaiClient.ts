import { config } from "../lib/config.js";

export class AiNotConfiguredError extends Error {
  status = 503;
  code = "AI_NOT_CONFIGURED";
  constructor(message = "AI is not configured. Set OPENAI_API_KEY on the API.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiProviderError extends Error {
  status: number;
  code = "AI_PROVIDER_ERROR";
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

export function assertAiConfigured(): void {
  if (!config.ai.apiKey) {
    throw new AiNotConfiguredError();
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/**
 * Call OpenAI-compatible chat completions. Throws if key missing or provider fails.
 * Never returns canned fallback text.
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  assertAiConfigured();

  const body: Record<string, unknown> = {
    model: config.ai.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error calling AI provider";
    throw new AiProviderError(msg, 502);
  }

  const raw = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok) {
    const detail = raw.error?.message || `AI provider returned ${res.status}`;
    throw new AiProviderError(detail, res.status >= 400 && res.status < 600 ? res.status : 502);
  }

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AiProviderError("AI provider returned an empty response", 502);
  }
  return content;
}
