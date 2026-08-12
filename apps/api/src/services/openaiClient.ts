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
  error?: { message?: string; type?: string; code?: string };
};

function isGeminiOpenAiCompat(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return (
      u.hostname === "generativelanguage.googleapis.com" ||
      u.hostname.endsWith(".generativelanguage.googleapis.com")
    );
  } catch {
    return false;
  }
}

/** Gemini's OpenAI-compat endpoint rejects `models/` prefixes from ListModels. */
function normalizeModelId(model: string, baseUrl: string): string {
  const trimmed = model.trim();
  if (!isGeminiOpenAiCompat(baseUrl)) return trimmed;
  return trimmed.replace(/^models\//i, "");
}

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

  const baseUrl = config.ai.baseUrl.replace(/\/$/, "");
  const model = normalizeModelId(config.ai.model, baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error calling AI provider";
    throw new AiProviderError(`${msg} (endpoint=${endpoint})`, 502);
  }

  const raw = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok) {
    const detail = raw.error?.message || `AI provider returned ${res.status}`;
    // Never bubble provider 404 as our route 404 — it confuses clients/ops.
    const mappedStatus =
      res.status === 404
        ? 502
        : res.status >= 400 && res.status < 600
          ? res.status
          : 502;
    const where = `model=${model} endpoint=${endpoint}`;
    const message =
      res.status === 404
        ? `AI model or endpoint not found (${where}). Provider said: ${detail}. Fix OPENAI_MODEL / OPENAI_BASE_URL and restart the API.`
        : `${detail} (${where})`;
    throw new AiProviderError(message, mappedStatus);
  }

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AiProviderError(
      `AI provider returned an empty response (model=${model} endpoint=${endpoint})`,
      502
    );
  }
  return content;
}
