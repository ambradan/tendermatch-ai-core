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
 * Patch: avvolgiamo automaticamente messages.create con il retry.
 * Tutto il resto del codice che fa:
 *
 *   anthropicClient.messages.create({ ... })
 *
 * continuerà a funzionare uguale, ma ora con retry automatico.
 */
(baseClient.messages as any).create = async (params: any) => {
  return callAnthropicWithRetry(() => rawMessagesCreate(params));
};

export const anthropicClient = baseClient;
