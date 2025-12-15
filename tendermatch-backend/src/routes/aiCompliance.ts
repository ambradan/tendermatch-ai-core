// tendermatch-backend/src/routes/aiCompliance.ts

import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";
import {
  buildScorecard,
  buildDegradedScorecard,
} from "../services/scoring";
import { RawChecksOutput, Scorecard } from "../types/scorecard";

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

// ============================================================
// PROMPT TEMPLATES
// ============================================================

const SYSTEM_PROMPT_CHECKS = `Sei TenderMatch AI Compliance Engine, modulo di verifica conformità documentale.

REGOLE ASSOLUTE:
1. NON generare MAI numeri di scoring (vietati "36/100", "80%", percentuali, punteggi)
2. Genera SOLO check discreti con status: PASS | PARTIAL | FAIL | ND
3. Per ogni check fornisci evidence (snippet dal documento) e rationale (breve motivazione)
4. Se non hai dati sufficienti per valutare, usa ND

Rispondi SOLO con un JSON valido con questa struttura:
{
  "sections": [
    {
      "section_id": "requisiti_amministrativi",
      "section_name": "Requisiti Amministrativi",
      "checks": [
        {
          "id": "check_1",
          "label": "Documento DURC presente",
          "status": "PASS" | "PARTIAL" | "FAIL" | "ND",
          "evidence": "snippet dal documento...",
          "rationale": "motivazione breve"
        }
      ]
    }
  ]
}

Le sezioni da valutare per compliance documentale sono:
- requisiti_amministrativi: DURC, visura camerale, casellario giudiziale, antimafia
- requisiti_tecnici: CV referenti, attestazioni esperienza, portfolio progetti
- requisiti_economici: bilanci, referenze bancarie, dichiarazioni fatturato
- documentazione_generale: domanda partecipazione, dichiarazioni sostitutive, firme digitali
- certificazioni: ISO 9001, ISO 27001, SOA, certificazioni settoriali`;

const SYSTEM_PROMPT_REPORT = `Sei TenderMatch AI Compliance Engine, modulo di verifica conformità documentale.

Genera un report in formato markdown chiaro e strutturato che includa:
1. Sintesi della documentazione analizzata
2. Requisiti di compliance coperti
3. Gap documentali identificati
4. Elementi critici o mancanti
5. Raccomandazioni operative prioritizzate

NON includere punteggi numerici nel report (verranno calcolati separatamente).`;

// ============================================================
// ROUTE HANDLER
// ============================================================

router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/ai-compliance-check - tenderId: ${req.body?.tenderId || "N/A"}`
  );

  try {
    const {
      tenderId,
      documents,
      language = "italiano",
    } = req.body as ComplianceCheckRequest;

    // Validazioni base
    if (!tenderId || !documents || !Array.isArray(documents) || !documents.length) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: tenderId e almeno un elemento in documents sono richiesti",
      });
    }

    const docSummary = buildDocumentsSummary(documents);

    const userPromptBase = `BANDO: ${tenderId}

DOCUMENTI PRESENTATI:
${docSummary}

---

Rispondi in ${language}.`;

    // ============================================================
    // CALL 1: Genera raw checks (JSON strutturato)
    // ============================================================
    let rawChecks: RawChecksOutput | null = null;
    let scorecard: Scorecard;

    try {
      const checksResponse = await anthropicClient.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        system: SYSTEM_PROMPT_CHECKS,
        messages: [
          {
            role: "user",
            content: userPromptBase + "\n\nGenera i check di compliance strutturati.",
          },
        ],
      });

      const checksText =
        checksResponse.content.find((b) => b.type === "text")?.text ?? "";

      // Parsing JSON (cerca il primo { ... } valido)
      const jsonMatch = checksText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawChecks = JSON.parse(jsonMatch[0]) as RawChecksOutput;
        scorecard = buildScorecard(rawChecks);
      } else {
        console.warn(
          `[${new Date().toISOString()}] ai-compliance - Nessun JSON trovato nei checks`
        );
        scorecard = buildDegradedScorecard("Nessun JSON valido nell'output LLM");
      }
    } catch (parseErr) {
      console.warn(
        `[${new Date().toISOString()}] ai-compliance - Errore parsing checks:`,
        parseErr instanceof Error ? parseErr.message : parseErr
      );
      scorecard = buildDegradedScorecard("Errore parsing output LLM");
    }

    // ============================================================
    // CALL 2: Genera report markdown
    // ============================================================
    const reportResponse = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      system: SYSTEM_PROMPT_REPORT + `\nRispondi in ${language}.`,
      messages: [
        {
          role: "user",
          content: userPromptBase,
        },
      ],
    });

    const reportMarkdown =
      reportResponse.content.find((b) => b.type === "text")?.text ?? "";

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: reportMarkdown,
      scorecard,
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
      scorecard: buildDegradedScorecard("Errore di sistema"),
    });
  }
});

export default router;
