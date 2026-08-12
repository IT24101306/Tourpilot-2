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
  error?: { message?: string; type?: string; code?: string | number; status?: string };
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string; status?: string; code?: number };
};

function isGeminiHost(baseUrl: string): boolean {
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

/** Gemini rejects `models/` prefixes from ListModels on both native + OpenAI-compat. */
function normalizeModelId(model: string): string {
  return model.trim().replace(/^models\//i, "");
}

function providerDetail(raw: unknown, status: number): string {
  if (!raw || typeof raw !== "object") return `AI provider returned ${status}`;
  const obj = raw as Record<string, unknown>;
  const err = obj.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
    if (typeof e.status === "string" && e.status.trim()) return e.status.trim();
  }
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  try {
    const s = JSON.stringify(raw);
    if (s && s !== "{}") return s.slice(0, 400);
  } catch {
    /* ignore */
  }
  return `AI provider returned ${status}`;
}

function mapProviderStatus(status: number): number {
  if (status === 404) return 502;
  if (status >= 400 && status < 600) return status;
  return 502;
}

/**
 * Native Gemini generateContent — more reliable than the OpenAI-compat shim
 * when model IDs churn (compat often returns opaque 404s).
 */
async function geminiGenerateContent(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  const model = normalizeModelId(opts.model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const systemParts = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const contents = opts.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    throw new AiProviderError("No user/assistant messages to send to Gemini", 400);
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.responseFormatJson ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (systemParts.length) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.ai.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error calling Gemini";
    throw new AiProviderError(`${msg} (endpoint=${endpoint})`, 502);
  }

  const raw = (await res.json().catch(() => ({}))) as GeminiGenerateResponse;
  if (!res.ok) {
    const detail = providerDetail(raw, res.status);
    throw new AiProviderError(
      `Gemini native API failed (model=${model}). ${detail}. Try OPENAI_MODEL=gemini-2.0-flash or gemini-flash-latest, then restart.`,
      mapProviderStatus(res.status)
    );
  }

  const text = raw.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) {
    throw new AiProviderError(
      `Gemini returned an empty response (model=${model} endpoint=${endpoint})`,
      502
    );
  }
  return text;
}

async function openAiCompatibleChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  const baseUrl = config.ai.baseUrl.replace(/\/$/, "");
  const model = normalizeModelId(config.ai.model);
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
    const detail = providerDetail(raw, res.status);
    throw new AiProviderError(
      `AI model or endpoint not found (model=${model} endpoint=${endpoint}). Provider said: ${detail}. Fix OPENAI_MODEL / OPENAI_BASE_URL and restart the API.`,
      mapProviderStatus(res.status)
    );
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

/**
 * Call OpenAI-compatible chat completions, or native Gemini when BASE_URL is Google.
 * Never returns canned fallback text.
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  assertAiConfigured();

  // Gemini OpenAI-compat often 404s on valid model names; use native API instead.
  if (isGeminiHost(config.ai.baseUrl)) {
    return geminiGenerateContent({
      model: config.ai.model,
      messages: opts.messages,
      temperature: opts.temperature,
      responseFormatJson: opts.responseFormatJson,
    });
  }

  return openAiCompatibleChat(opts);
}
