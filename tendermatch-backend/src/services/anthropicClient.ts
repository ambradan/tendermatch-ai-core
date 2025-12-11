import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY non configurata. Imposta la variabile di ambiente prima di avviare il server."
  );
}

export const anthropicClient = new Anthropic({
  apiKey,
});

export const MODEL = "claude-sonnet-4-5-20250929";
export const DEFAULT_MAX_TOKENS = 1500;
export const DEFAULT_TEMPERATURE = 0.1;
