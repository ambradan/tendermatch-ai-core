// tendermatch-backend/src/routes/tenderReady.ts

import { Router, Request, Response } from "express";
import {
  generateComplianceOutput,
  RawChecksJson,
} from "../services/anthropicClient";
import {
  scoreCompliance,
  buildDegradedScorecard,
} from "../services/scoring";
import { ComplianceScorecardV1 } from "../types/complianceScorecard";

const router = Router();

interface TenderReadyRequest {
  companyProfile: string;
  tenderText: string;
  language?: string;
}

// Pesi sezioni per tender-ready
const SECTION_WEIGHTS: Record<string, number> = {
  requisiti_amministrativi: 0.25,
  requisiti_tecnici: 0.30,
  requisiti_economici: 0.20,
  documentazione_generale: 0.15,
  certificazioni: 0.10,
};

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

    const userPrompt = `PROFILO AZIENDA:
${companyProfile}

---

TESTO DEL BANDO:
${tenderText}`;

    // Genera output compliance (dual-call: checks + report)
    const { report_markdown, raw_checks } = await generateComplianceOutput({
      userPrompt,
      language,
    });

    // Calcola scorecard deterministico
    let scorecard: ComplianceScorecardV1;

    if (raw_checks.sections.length === 0) {
      scorecard = buildDegradedScorecard("Output LLM non validabile");
    } else {
      scorecard = scoreCompliance({
        sections: raw_checks.sections,
        weights: SECTION_WEIGHTS,
      });
    }

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/tender-ready - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: report_markdown,
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
