// tendermatch-backend/src/routes/aiCompliance.ts

import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";

const router = Router();

interface ComplianceDocument {
  name: string;
  type: string;
  summary: string;
}

interface ComplianceCheckRequest {
  tenderId: string;
  documents: ComplianceDocument[];
  language?: string;
}

// Helper per formattare brevemente i documenti
function buildDocumentsSummary(docs: ComplianceDocument[]): string {
  if (!docs || docs.length === 0) return "Nessun documento fornito.";
  return docs
    .map(
      (doc, index) =>
        `${index + 1}. Nome: ${doc.name}\n   Tipo: ${doc.type}\n   Sintesi: ${doc.summary}`
    )
    .join("\n\n");
}

router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/ai-compliance-check - Inizio elaborazione`
  );

  try {
    const {
      tenderId,
      documents,
      language = "italiano",
    } = req.body as ComplianceCheckRequest;

    // ✅ Validazioni base
    if (!tenderId || !documents || !Array.isArray(documents) || !documents.length) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: tenderId e almeno un elemento in documents sono richiesti",
      });
    }

    const docSummary = buildDocumentsSummary(documents);

    // 🔧 SYSTEM PROMPT
    const systemPrompt = `
Sei TenderMatch AI Compliance Engine. Valuti la conformità documentale ai requisiti di gara.

DEVI restituire PRIMA un JSON valido con questa struttura ESATTA:

{
  "score": number,               // da 0 a 100
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "summary": "breve riassunto (5–7 righe)",
  "details": "testo markdown dettagliato"
}

Dopo il JSON puoi aggiungere testo libero se necessario.
Rispondi sempre in ${language}.
`;

    // 🔧 USER PROMPT
    const userPrompt = `
BANDO: ${tenderId}

DOCUMENTI PRESENTATI:
${docSummary}

1. Analizza la conformità documentale rispetto a un bando tipico per la Pubblica Amministrazione italiana.
2. Assegna uno score tra 0 e 100, dove:
   - 0 = documentazione del tutto insufficiente
   - 100 = documentazione perfettamente allineata
3. Classifica il rischio complessivo come LOW, MEDIUM o HIGH.
4. Restituisci per PRIMO il JSON richiesto nel system prompt.
5. Dopo il JSON includi il testo completo e dettagliato (in markdown) con:
   - requisiti coperti
   - gap documentali
   - raccomandazioni operative.
`;

    // 🧠 Chiamata ad Anthropic
    const response = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const textBlock: any = response.content.find(
      (block: any) => block.type === "text"
    );
    const fullText: string = textBlock?.text ?? "";

    // 🧩 Proviamo a estrarre il JSON iniziale
    let score: number | null = null;
    let risk: string | null = null;
    let summary = "";
    let details = fullText;

    try {
      const jsonMatch = fullText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = typeof parsed.score === "number" ? parsed.score : null;
        risk = typeof parsed.risk === "string" ? parsed.risk : null;
        summary = typeof parsed.summary === "string" ? parsed.summary : "";
        details =
          typeof parsed.details === "string" && parsed.details.length > 0
            ? parsed.details
            : fullText;
      }
    } catch (e) {
      console.warn(
        `[${new Date().toISOString()}] AI Compliance - Errore nel parsing del JSON:`,
        e instanceof Error ? e.message : e
      );
      // In caso di errore teniamo comunque fullText in details
      details = fullText;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      score,
      risk,
      summary,
      details,
      raw: fullText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Errore dopo ${duration}ms:`,
      error instanceof Error ? error.message : "Errore sconosciuto"
    );

    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore durante l'elaborazione della richiesta",
    });
  }
});

export default router;
