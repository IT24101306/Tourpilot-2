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

type GeminiInteractionResponse = {
  id?: string;
  status?: string;
  outputs?: Array<{ type?: string; text?: string; content?: unknown }>;
  steps?: Array<{
    type?: string;
    status?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string; status?: string; code?: number };
};

/** Current Gemini default for new API keys (2.x flash is often blocked for new users). */
const GEMINI_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"];

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

/** Gemini rejects `models/` prefixes from ListModels. */
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

function isRetiredModelError(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes("no longer available") ||
    d.includes("not found") ||
    d.includes("is not found") ||
    d.includes("update your code to use a newer model")
  );
}

function extractInteractionText(raw: GeminiInteractionResponse): string {
  // Newer responses may expose outputs[]; steps[].content[] is the documented REST shape.
  if (Array.isArray(raw.outputs)) {
    const fromOutputs = raw.outputs
      .map((o) => (typeof o.text === "string" ? o.text : ""))
      .join("")
      .trim();
    if (fromOutputs) return fromOutputs;
  }

  const modelSteps = (raw.steps || []).filter((s) => s.type === "model_output");
  const texts: string[] = [];
  for (const step of modelSteps) {
    for (const part of step.content || []) {
      if (part.type === "text" && typeof part.text === "string") texts.push(part.text);
    }
  }
  return texts.join("").trim();
}

function buildInteractionInput(messages: ChatMessage[]): {
  systemInstruction: string | null;
  input: string;
} {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (turns.length === 0) {
    throw new AiProviderError("No user/assistant messages to send to Gemini", 400);
  }

  // Stateless multi-turn: fold history into one input (Interactions can also use previous_interaction_id).
  const input =
    turns.length === 1 && turns[0].role === "user"
      ? turns[0].content
      : turns
          .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
          .join("\n\n");

  return {
    systemInstruction: systemParts.length ? systemParts.join("\n\n") : null,
    input,
  };
}

/**
 * Gemini Interactions API (GA) — required for many new API keys; generateContent
 * rejects retired 2.x models with "no longer available to new users".
 */
async function geminiInteractionsOnce(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  const model = normalizeModelId(opts.model);
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const { systemInstruction, input } = buildInteractionInput(opts.messages);

  const body: Record<string, unknown> = {
    model,
    input,
    generation_config: {
      temperature: opts.temperature ?? 0.4,
    },
  };
  if (systemInstruction) body.system_instruction = systemInstruction;
  if (opts.responseFormatJson) {
    // Loose JSON object — callers validate their own schema.
    body.response_format = [
      {
        type: "text",
        mime_type: "application/json",
        schema: { type: "object" },
      },
    ];
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.ai.apiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error calling Gemini Interactions";
    throw new AiProviderError(`${msg} (endpoint=${endpoint})`, 502);
  }

  const raw = (await res.json().catch(() => ({}))) as GeminiInteractionResponse;
  if (!res.ok) {
    const detail = providerDetail(raw, res.status);
    const err = new AiProviderError(
      `Gemini Interactions API failed (model=${model}). ${detail}`,
      mapProviderStatus(res.status)
    );
    (err as AiProviderError & { detail: string }).detail = detail;
    throw err;
  }

  const text = extractInteractionText(raw);
  if (!text) {
    throw new AiProviderError(
      `Gemini Interactions returned an empty response (model=${model} endpoint=${endpoint})`,
      502
    );
  }
  return text;
}

async function geminiChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  const primary = normalizeModelId(config.ai.model);
  const candidates = [
    primary,
    ...GEMINI_FALLBACK_MODELS.filter((m) => m !== primary),
  ];

  let lastError: AiProviderError | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      const text = await geminiInteractionsOnce({ ...opts, model });
      if (i > 0) {
        console.warn(
          `[ai] OPENAI_MODEL=${primary} unavailable; succeeded with fallback model=${model}`
        );
      }
      return text;
    } catch (e) {
      if (!(e instanceof AiProviderError)) throw e;
      lastError = e;
      const detail = (e as AiProviderError & { detail?: string }).detail || e.message;
      const canRetry = i < candidates.length - 1 && isRetiredModelError(detail);
      if (!canRetry) break;
      console.warn(`[ai] model=${model} failed (${detail.slice(0, 160)}); trying next fallback`);
    }
  }

  throw new AiProviderError(
    `${lastError?.message || "Gemini request failed"}. Set OPENAI_MODEL to a current model (e.g. gemini-3.6-flash), then restart the API.`,
    lastError?.status ?? 502
  );
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
 * OpenAI-compatible chat, or Gemini Interactions API when BASE_URL is Google.
 * Never returns canned fallback text.
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<string> {
  assertAiConfigured();

  if (isGeminiHost(config.ai.baseUrl)) {
    return geminiChat(opts);
  }

  return openAiCompatibleChat(opts);
}
