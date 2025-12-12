import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY non configurata. Imposta la variabile di ambiente prima di avviare il server."
  );
}

/**
 * Modello Anthropic usato da TenderMatch.
 * ⚠️ Deve essere esattamente uguale a quello configurato in Workbench:
 *    claude-sonnet-4-5-20250929
 */
export const MODEL = "claude-sonnet-4-5-20250929";

export const DEFAULT_MAX_TOKENS = 8000;
export const DEFAULT_TEMPERATURE = 0.3;

// ============================================================
// SERVER-SIDE RATE LIMITING (in-memory, single instance)
// ============================================================

type RateRecord = { t: number; tokens: number };

let history: RateRecord[] = [];
let lastReqAt = 0;

const TOKEN_BUDGET_PER_MIN = 25_000; // safety sotto ~30k
const MIN_DELAY_MS = 2500;
const WINDOW_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function estimateTokensFromParams(params: any): number {
  // Stima veloce e robusta:
  // - input: somma lunghezze di messages/content (stringhe o array blocks)
  // - output: aggiunge max_tokens
  const maxTokens = Number(params?.max_tokens ?? DEFAULT_MAX_TOKENS);

  const messages = Array.isArray(params?.messages) ? params.messages : [];
  const inputText = messages
    .map((m: any) => {
      const c = m?.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        // supporto content in formato array (es. blocks)
        return c
          .map((b: any) => (typeof b?.text === "string" ? b.text : ""))
          .join(" ");
      }
      return "";
    })
    .join("\n");

  // ~4 chars per token + 10% margine
  const inputTokens = Math.ceil(inputText.length * 0.25 * 1.1);

  // totale = input + output (max_tokens)
  return inputTokens + maxTokens;
}

async function waitForRateLimit(estimatedTokens: number): Promise<void> {
  const now = Date.now();

  // 1) min delay tra richieste
  const sinceLast = now - lastReqAt;
  if (sinceLast < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - sinceLast;
    console.log(`⏳ Min delay: waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  // 2) rolling window token budget
  history = history.filter((r) => r.t > Date.now() - WINDOW_MS);
  const used = history.reduce((s, r) => s + r.tokens, 0);

  if (used + estimatedTokens > TOKEN_BUDGET_PER_MIN) {
    const oldest = history[0];
    if (oldest) {
      const waitMs = oldest.t + WINDOW_MS - Date.now();
      if (waitMs > 0) {
        console.log(
          `⏳ Token budget: waiting ${waitMs}ms (used: ${used}, requested: ${estimatedTokens})`
        );
        await sleep(waitMs);
      }
    }
  }

  lastReqAt = Date.now();
  history.push({ t: Date.now(), tokens: estimatedTokens });

  console.log(
    `✅ Rate limit OK: ${estimatedTokens} tokens (total last 60s: ${used + estimatedTokens})`
  );
}

/**
 * Funzione generica di retry con exponential backoff.
 * Serve a gestire i rate_limit_error (429) di Anthropic
 * senza restituire subito errore 500 al frontend.
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1500
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        err?.code === 429 ||
        err?.error?.type === "rate_limit_error" ||
        /rate limit/i.test(err?.message ?? "");

      if (!isRateLimit || attempt >= maxRetries) {
        // Non è un rate limit O abbiamo esaurito i retry -> rilanciamo
        throw err;
      }

      attempt += 1;

      console.warn(
        `⚠️ 429 Rate Limit. Retry ${attempt}/${maxRetries} in ${delay}ms`
      );

      // Aspetta con exponential backoff (1.5s -> 3s -> 6s)
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Client Anthropic "base"
const baseClient = new Anthropic({
  apiKey,
});

// Salviamo il metodo originale
const rawMessagesCreate = baseClient.messages.create.bind(baseClient.messages);

/**
 * Patch: avvolgiamo automaticamente messages.create con:
 * - rate limiting server-side (token/min + min delay)
 * - retry (429)
 *
 * Tutto il resto del codice che fa:
 *   anthropicClient.messages.create({ ... })
 * continuerà a funzionare uguale, ma ora con guardrail lato server.
 */
(baseClient.messages as any).create = async (params: any) => {
  const estimatedTokens = estimateTokensFromParams(params);
  await waitForRateLimit(estimatedTokens);

  return callAnthropicWithRetry(() => rawMessagesCreate(params));
};

export const anthropicClient = baseClient;
