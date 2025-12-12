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

/**
 * Estrae testo "reale" dai messages (string o array blocks con .text)
 * Nota: non logghiamo MAI il contenuto, solo lunghezze.
 */
function extractTextFromMessages(params: any): string {
  const messages = Array.isArray(params?.messages) ? params.messages : [];
  return messages
    .map((m: any) => {
      const c = m?.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c
          .map((b: any) => (typeof b?.text === "string" ? b.text : ""))
          .join(" ");
      }
      return "";
    })
    .join("\n");
}

function estimateTokensFromParams(params: any): number {
  // Stima veloce e robusta:
  // - input: somma lunghezze di messages/content (stringhe o array blocks)
  // - output: aggiunge max_tokens
  const maxTokens = Number(params?.max_tokens ?? DEFAULT_MAX_TOKENS);
  const inputText = extractTextFromMessages(params);

  // Guard anti-base64 / input non testuale (non blocca, ma segnala)
  const looksLikeBase64 =
    /base64,|data:application\/pdf;base64/i.test(inputText) ||
    /JVBERi0xL/i.test(inputText); // header tipico PDF in base64

  if (looksLikeBase64) {
    console.error(
      "🚨 ALERT: inputText contiene pattern base64/data URI. Questo NON dovrebbe essere inviato come testo."
    );
  }

  // Stima: ~4 chars ≈ 1 token (IT). + maxTokens (output)
  // (manteniamo la tua euristica, ma la rendiamo leggibile/diagnosticabile)
  const inputTokens = Math.ceil(inputText.length / 4);
  const total = inputTokens + maxTokens;

  // Diagnostica (senza contenuti sensibili)
  console.log(
    `📊 Token estimate: chars=${inputText.length}, inputTokens≈${inputTokens}, maxOutput=${maxTokens}, total≈${total}`
  );

  if (inputText.length > 500_000) {
    console.error(
      `🚨 ALERT: Input enorme (${inputText.length} chars). Possibili duplicazioni o estrazione errata.`
    );
  }

  return total;
}

async function waitForRateLimit(estimatedTokens: number): Promise<void> {
  // 1) min delay tra richieste
  const now = Date.now();
  const sinceLast = now - lastReqAt;
  if (sinceLast < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - sinceLast;
    console.log(`⏳ Min delay: waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  // 2) se singola request supera il budget -> THROW (deve essere chunkata a monte)
  if (estimatedTokens > TOKEN_BUDGET_PER_MIN) {
    console.error(
      `🚨 SINGLE REQUEST OVER BUDGET: estimated=${estimatedTokens} > limit=${TOKEN_BUDGET_PER_MIN}. Chunking required.`
    );
    throw new Error(
      `Request too large for token budget (${estimatedTokens} > ${TOKEN_BUDGET_PER_MIN}). Chunking required.`
    );
  }

  // 3) rolling window LOOP finché budget realmente disponibile
  while (true) {
    const cutoff = Date.now() - WINDOW_MS;
    history = history.filter((r) => r.t > cutoff);

    const used = history.reduce((s, r) => s + r.tokens, 0);

    if (used + estimatedTokens <= TOKEN_BUDGET_PER_MIN) {
      // Budget OK: registra PRIMA di loggare "OK"
      lastReqAt = Date.now();
      history.push({ t: Date.now(), tokens: estimatedTokens });

      console.log(
        `✅ Rate limit OK: req=${estimatedTokens} (total last 60s=${used + estimatedTokens}/${TOKEN_BUDGET_PER_MIN})`
      );
      return;
    }

    // Budget superato: aspetta finché scade la finestra del record più vecchio
    const oldest = history[0];
    const waitMs = oldest
      ? Math.max(1000, oldest.t + WINDOW_MS - Date.now())
      : 60_000;

    console.log(
      `⏳ BUDGET EXCEEDED: used=${used}, req=${estimatedTokens}, limit=${TOKEN_BUDGET_PER_MIN}. waiting ${waitMs}ms`
    );
    await sleep(waitMs);
  }
}

/**
 * Retry con exponential backoff su errore 429.
 * Minimo 20s, backoff 2x (20s -> 40s -> 80s -> 160s)
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  let attempt = 0;
  let delay = 20_000;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        err?.code === 429 ||
        err?.error?.type === "rate_limit_error" ||
        /rate.?limit/i.test(err?.message ?? "") ||
        /rate.?limit/i.test(err?.error?.message ?? "");

      if (!isRateLimit || attempt >= maxRetries) {
        throw err;
      }

      attempt += 1;
      console.warn(
        `⚠️ 429 Rate Limit. Retry ${attempt}/${maxRetries} in ${delay}ms`
      );

      await sleep(delay);
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
 * continua a funzionare uguale, ma ora con guardrail lato server.
 */
(baseClient.messages as any).create = async (params: any) => {
  const estimatedTokens = estimateTokensFromParams(params);
  await waitForRateLimit(estimatedTokens);

  return callAnthropicWithRetry(() => rawMessagesCreate(params));
};

export const anthropicClient = baseClient;
