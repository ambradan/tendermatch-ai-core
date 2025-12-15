// tendermatch-backend/src/routes/tenderReady.ts

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
  SECTION_WEIGHTS,
} from "../services/scoring";
import { RawChecksOutput, Scorecard } from "../types/scorecard";

const router = Router();

interface TenderReadyRequest {
  companyProfile: string;
  tenderText: string;
  language?: string;
}

// ============================================================
// PROMPT TEMPLATES
// ============================================================

const SYSTEM_PROMPT_CHECKS = `Sei TenderMatch AI, motore di valutazione allineamento bando/azienda.

REGOLE ASSOLUTE:
1. NON generare MAI numeri di scoring (vietati "36/100", "80%", percentuali, punteggi)
2. Genera SOLO check discreti con status: PASS | PARTIAL | FAIL | ND
3. Per ogni check fornisci evidence (snippet dal testo) e rationale (breve motivazione)
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
          "label": "Iscrizione Camera di Commercio",
          "status": "PASS" | "PARTIAL" | "FAIL" | "ND",
          "evidence": "snippet dal documento...",
          "rationale": "motivazione breve"
        }
      ]
    }
  ]
}

Le sezioni da valutare sono:
- requisiti_amministrativi: iscrizioni, certificati, regolarità fiscale
- requisiti_tecnici: competenze, esperienze pregresse, personale qualificato
- requisiti_economici: fatturato, solidità finanziaria, referenze bancarie
- documentazione_generale: completezza documentale, conformità formale
- certificazioni: ISO, SOA, certificazioni di settore`;

const SYSTEM_PROMPT_REPORT = `Sei TenderMatch, un motore AI specializzato nell'aiutare le aziende italiane a valutare la propria idoneità rispetto ai bandi di gara.

Il tuo compito è generare un report in formato markdown chiaro e strutturato che includa:
1. Sintesi breve del bando (max 5 righe)
2. Requisiti obbligatori identificati
3. Gap principali tra azienda e bando
4. Azioni consigliate (punti operativi chiari)
5. Considerazioni finali

NON includere punteggi numerici nel report (verranno calcolati separatamente).`;

// ============================================================
// ROUTE HANDLER
// ============================================================

router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/tender-ready - Inizio elaborazione`
  );

  try {
    const { companyProfile, tenderText, language = "italiano" } =
      req.body as TenderReadyRequest;

    if (!companyProfile || !tenderText) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: companyProfile e tenderText sono richiesti",
      });
    }

    const userPromptBase = `PROFILO AZIENDA:
${companyProfile}

---

TESTO DEL BANDO:
${tenderText}

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
            content: userPromptBase + "\n\nGenera i check strutturati.",
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
          `[${new Date().toISOString()}] tender-ready - Nessun JSON trovato nei checks`
        );
        scorecard = buildDegradedScorecard("Nessun JSON valido nell'output LLM");
      }
    } catch (parseErr) {
      console.warn(
        `[${new Date().toISOString()}] tender-ready - Errore parsing checks:`,
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
      `[${new Date().toISOString()}] POST /api/tender-ready - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: reportMarkdown,
      scorecard,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/tender-ready - Errore dopo ${duration}ms:`,
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
