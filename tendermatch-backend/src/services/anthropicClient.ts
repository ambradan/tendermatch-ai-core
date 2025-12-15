import Anthropic from "@anthropic-ai/sdk";
import { ComplianceCheck } from "../types/complianceScorecard";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY non configurata. Imposta la variabile di ambiente prima di avviare il server."
  );
}

/**
 * Modello Anthropic usato da TenderMatch.
 */
export const MODEL = "claude-sonnet-4-5-20250929";

export const DEFAULT_MAX_TOKENS = 8000;
export const DEFAULT_TEMPERATURE = 0.3;

// ============================================================
// RAW CHECKS OUTPUT TYPE
// ============================================================

/**
 * Struttura raw_checks_json prodotta dall'LLM
 * NESSUN campo numerico di scoring
 */
export interface RawChecksSection {
  id: string;
  label: string;
  checks: ComplianceCheck[];
}

export interface RawChecksJson {
  sections: RawChecksSection[];
}

export interface LLMComplianceOutput {
  report_markdown: string;
  raw_checks: RawChecksJson;
}

// ============================================================
// SYSTEM PROMPTS (NO NUMERICAL SCORES)
// ============================================================

const SYSTEM_PROMPT_CHECKS = `Sei TenderMatch AI Compliance Engine.
Il tuo compito è analizzare documenti e bandi per verificare la compliance.

REGOLE ASSOLUTE:
- NON generare MAI punteggi numerici (vietati "36/100", "80%", "rating", score, cifre, percentuali)
- Produci SOLO checks discreti: PASS, PARTIAL, FAIL, ND
- Ogni check deve avere evidence (snippet testuali) e rationale (spiegazione breve)

STRUTTURA OUTPUT OBBLIGATORIA:
L'output JSON DEVE contenere ESATTAMENTE queste 5 sezioni, sempre presenti, sempre in questo ordine:
1. requisiti_amministrativi
2. requisiti_tecnici
3. requisiti_economici
4. documentazione_generale
5. certificazioni

REGOLE VINCOLANTI:
- Gli "id" delle sezioni DEVONO essere ESATTAMENTE quelli sopra (lowercase, con underscore)
- È VIETATO creare sezioni extra o con nomi diversi
- Se una sezione non ha elementi verificabili → "checks": []
- Ogni sezione DEVE avere "id", "label" e "checks"

OUTPUT RICHIESTO (JSON valido):
{
  "sections": [
    {
      "id": "requisiti_amministrativi",
      "label": "Requisiti Amministrativi",
      "checks": [...]
    },
    {
      "id": "requisiti_tecnici",
      "label": "Requisiti Tecnici",
      "checks": [...]
    },
    {
      "id": "requisiti_economici",
      "label": "Requisiti Economici",
      "checks": [...]
    },
    {
      "id": "documentazione_generale",
      "label": "Documentazione Generale",
      "checks": [...]
    },
    {
      "id": "certificazioni",
      "label": "Certificazioni",
      "checks": [...]
    }
  ]
}

Struttura di ogni check:
{
  "id": "check_id_univoco",
  "result": "PASS" | "PARTIAL" | "FAIL" | "ND",
  "evidence": ["snippet rilevante dal documento..."],
  "rationale": "Breve spiegazione del risultato"
}

Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`;

const SYSTEM_PROMPT_REPORT = `Sei TenderMatch AI Compliance Engine.
Genera un report di compliance in formato Markdown, leggibile e strutturato.

REGOLE ASSOLUTE:
- NON includere MAI punteggi numerici finali (vietati "36/100", "80%", "rating")
- NON usare percentuali come valutazione finale
- Puoi usare indicatori qualitativi: ✅ Conforme, ⚠️ Parziale, ❌ Non conforme, ℹ️ Non determinabile
- Struttura il report con sezioni chiare
- Includi evidenze e raccomandazioni

STRUTTURA REPORT:
1. Sintesi esecutiva (qualitativa, NO numeri)
2. Analisi per sezione
3. Gap identificati
4. Raccomandazioni operative
5. Prossimi passi`;

// ============================================================
// SERVER-SIDE RATE LIMITING (in-memory, single instance)
// ============================================================

type RateRecord = { t: number; tokens: number };

let history: RateRecord[] = [];
let lastReqAt = 0;

const TOKEN_BUDGET_PER_MIN = 25_000;
const MIN_DELAY_MS = 2500;
const WINDOW_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
  const maxTokens = Number(params?.max_tokens ?? DEFAULT_MAX_TOKENS);
  const inputText = extractTextFromMessages(params);

  const looksLikeBase64 =
    /base64,|data:application\/pdf;base64/i.test(inputText) ||
    /JVBERi0xL/i.test(inputText);

  if (looksLikeBase64) {
    console.error(
      "🚨 ALERT: inputText contiene pattern base64/data URI."
    );
  }

  const inputTokens = Math.ceil(inputText.length / 4);
  const total = inputTokens + maxTokens;

  console.log(
    `📊 Token estimate: chars=${inputText.length}, inputTokens≈${inputTokens}, maxOutput=${maxTokens}, total≈${total}`
  );

  if (inputText.length > 500_000) {
    console.error(
      `🚨 ALERT: Input enorme (${inputText.length} chars).`
    );
  }

  return total;
}

async function waitForRateLimit(estimatedTokens: number): Promise<void> {
  const now = Date.now();
  const sinceLast = now - lastReqAt;
  if (sinceLast < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - sinceLast;
    console.log(`⏳ Min delay: waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  if (estimatedTokens > TOKEN_BUDGET_PER_MIN) {
    console.error(
      `🚨 SINGLE REQUEST OVER BUDGET: estimated=${estimatedTokens} > limit=${TOKEN_BUDGET_PER_MIN}.`
    );
    throw new Error(
      `Request too large for token budget (${estimatedTokens} > ${TOKEN_BUDGET_PER_MIN}).`
    );
  }

  while (true) {
    const cutoff = Date.now() - WINDOW_MS;
    history = history.filter((r) => r.t > cutoff);

    const used = history.reduce((s, r) => s + r.tokens, 0);

    if (used + estimatedTokens <= TOKEN_BUDGET_PER_MIN) {
      lastReqAt = Date.now();
      history.push({ t: Date.now(), tokens: estimatedTokens });

      console.log(
        `✅ Rate limit OK: req=${estimatedTokens} (total last 60s=${used + estimatedTokens}/${TOKEN_BUDGET_PER_MIN})`
      );
      return;
    }

    const oldest = history[0];
    const waitMs = oldest
      ? Math.max(1000, oldest.t + WINDOW_MS - Date.now())
      : 60_000;

    console.log(
      `⏳ BUDGET EXCEEDED: used=${used}, req=${estimatedTokens}. waiting ${waitMs}ms`
    );
    await sleep(waitMs);
  }
}

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

// Client Anthropic base
const baseClient = new Anthropic({ apiKey });

const rawMessagesCreate = baseClient.messages.create.bind(baseClient.messages);

(baseClient.messages as any).create = async (params: any) => {
  const estimatedTokens = estimateTokensFromParams(params);
  await waitForRateLimit(estimatedTokens);
  return callAnthropicWithRetry(() => rawMessagesCreate(params));
};

export const anthropicClient = baseClient;

// ============================================================
// MAIN COMPLIANCE FUNCTION
// ============================================================

/**
 * Estrae testo dalla risposta Anthropic
 */
function extractText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === "text") {
      return block.text;
    }
  }
  return "";
}

/**
 * Sezioni canoniche (ordine e ID vincolanti)
 */
const CANONICAL_SECTIONS = [
  { id: "requisiti_amministrativi", label: "Requisiti Amministrativi" },
  { id: "requisiti_tecnici", label: "Requisiti Tecnici" },
  { id: "requisiti_economici", label: "Requisiti Economici" },
  { id: "documentazione_generale", label: "Documentazione Generale" },
  { id: "certificazioni", label: "Certificazioni" },
] as const;

/**
 * Parsing sicuro del JSON raw_checks
 */
function parseRawChecks(text: string): RawChecksJson | null {
  try {
    // Rimuovi eventuale markdown code block
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validazione minima struttura
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      console.error("❌ raw_checks: missing sections array");
      return null;
    }

    return parsed as RawChecksJson;
  } catch (err) {
    console.error("❌ Failed to parse raw_checks JSON:", err);
    return null;
  }
}

/**
 * Canonicalizza raw_checks: assicura 5 sezioni standard nell'ordine corretto
 */
function canonicalizeRawChecks(raw: RawChecksJson): RawChecksJson {
  // Mappa sezioni esistenti per ID
  const sectionMap = new Map<string, RawChecksSection>();
  for (const section of raw.sections) {
    sectionMap.set(section.id, section);
  }

  // Ricostruisci nell'ordine canonico
  const canonicalSections: RawChecksSection[] = CANONICAL_SECTIONS.map(
    (canonical) => {
      const existing = sectionMap.get(canonical.id);
      if (existing) {
        return {
          id: canonical.id,
          label: existing.label || canonical.label,
          checks: existing.checks || [],
        };
      }
      // Sezione mancante: aggiungi vuota
      return {
        id: canonical.id,
        label: canonical.label,
        checks: [],
      };
    }
  );

  return { sections: canonicalSections };
}

interface GenerateComplianceParams {
  userPrompt: string;
  language?: string;
}

/**
 * Genera output compliance completo (dual-call pattern)
 * 
 * Call 1: Genera raw_checks_json (checks discreti, NO numeri)
 * Call 2: Genera report_markdown (narrativa, NO numeri)
 * 
 * I due output sono indipendenti - scorecard calcolata in scoring.ts
 */
export async function generateComplianceOutput(
  params: GenerateComplianceParams
): Promise<LLMComplianceOutput> {
  const { userPrompt, language = "italiano" } = params;

  // Call 1: raw_checks (temperature 0 per massimo determinismo)
  const checksResponse = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: 0,
    system: SYSTEM_PROMPT_CHECKS,
    messages: [
      {
        role: "user",
        content: `Analizza quanto segue e produci i checks in formato JSON.\nLingua: ${language}\n\n${userPrompt}`,
      },
    ],
  });

  const checksText = extractText(checksResponse);
  let rawChecks = parseRawChecks(checksText);

  // Canonicalizza: assicura 5 sezioni standard
  if (rawChecks) {
    rawChecks = canonicalizeRawChecks(rawChecks);
    console.log(
      "[RAW_CHECKS]",
      "sections=", rawChecks.sections.length,
      "checks_total=", rawChecks.sections.reduce((s, x) => s + (x.checks?.length || 0), 0)
    );
  }

  // Call 2: report markdown
  const reportResponse = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: 0.3,
    system: SYSTEM_PROMPT_REPORT,
    messages: [
      {
        role: "user",
        content: `Genera un report di compliance dettagliato.\nLingua: ${language}\n\n${userPrompt}`,
      },
    ],
  });

  const reportMarkdown = extractText(reportResponse);

  // Se parsing fallisce, ritorna struttura vuota (scoring.ts gestirà degradation)
  if (!rawChecks) {
    return {
      report_markdown: reportMarkdown,
      raw_checks: { sections: [] },
    };
  }

  return {
    report_markdown: reportMarkdown,
    raw_checks: rawChecks,
  };
}
