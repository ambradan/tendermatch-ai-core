// tendermatch-backend/src/routes/aiCompliance.ts

import { Router, Request, Response } from "express";
import { generateComplianceOutput } from "../services/anthropicClient";
import {
  scoreCompliance,
  buildDegradedScorecard,
} from "../services/scoring";
import { ComplianceScorecardV1 } from "../types/complianceScorecard";

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

// Pesi sezioni per compliance check
const SECTION_WEIGHTS: Record<string, number> = {
  requisiti_amministrativi: 0.25,
  requisiti_tecnici: 0.30,
  requisiti_economici: 0.20,
  documentazione_generale: 0.15,
  certificazioni: 0.10,
};

// Helper per formattare i documenti
function buildDocumentsSummary(docs: ComplianceDocument[]): string {
  if (!docs || docs.length === 0) return "Nessun documento fornito.";
  return docs
    .map(
      (doc, index) =>
        `${index + 1}. Nome: ${doc.name}\n   Tipo: ${doc.type}\n   Sintesi: ${doc.summary}`
    )
    .join("\n\n");
}

// Sinonimi comuni → ID canonici
const SECTION_SYNONYMS: Record<string, string> = {
  // requisiti_amministrativi
  "amministrativi": "requisiti_amministrativi",
  "amministrativo": "requisiti_amministrativi",
  "req_amministrativi": "requisiti_amministrativi",
  "requisiti amministrativi": "requisiti_amministrativi",
  // requisiti_tecnici
  "tecnici": "requisiti_tecnici",
  "tecnico": "requisiti_tecnici",
  "req_tecnici": "requisiti_tecnici",
  "requisiti tecnici": "requisiti_tecnici",
  // requisiti_economici
  "economici": "requisiti_economici",
  "economico": "requisiti_economici",
  "req_economici": "requisiti_economici",
  "requisiti economici": "requisiti_economici",
  "finanziari": "requisiti_economici",
  // documentazione_generale
  "documentazione": "documentazione_generale",
  "documenti": "documentazione_generale",
  "doc_generale": "documentazione_generale",
  "documentazione generale": "documentazione_generale",
  // certificazioni
  "certificazione": "certificazioni",
  "cert": "certificazioni",
  "iso": "certificazioni",
  "soa": "certificazioni",
};

/**
 * Normalizza ID sezione in snake_case e mappa sinonimi
 */
function normalizeSectionId(input: string): string {
  // Converti in lowercase e snake_case
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  // Cerca sinonimo
  if (SECTION_SYNONYMS[normalized]) {
    return SECTION_SYNONYMS[normalized];
  }

  // Cerca anche versione con spazi (per label)
  const withSpaces = input.toLowerCase().trim();
  if (SECTION_SYNONYMS[withSpaces]) {
    return SECTION_SYNONYMS[withSpaces];
  }

  return normalized;
}

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

    if (!tenderId || !documents || !Array.isArray(documents) || !documents.length) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: tenderId e almeno un elemento in documents sono richiesti",
      });
    }

    const docSummary = buildDocumentsSummary(documents);

    const userPrompt = `BANDO: ${tenderId}

DOCUMENTI PRESENTATI:
${docSummary}`;

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
      // B1+B2: Normalizza ID e filtra solo sezioni con peso definito
      const normalizedSections = raw_checks.sections
        .map((section) => ({
          ...section,
          id: normalizeSectionId(section.id),
        }))
        .filter((section) => section.id in SECTION_WEIGHTS);

      // B4: Log diagnostico
      console.log(
        "[SCORING]",
        "sections_in=", raw_checks.sections.length,
        "sections_used=", normalizedSections.length,
        "ids_used=", normalizedSections.map((s) => s.id)
      );

      // B3: Fallback se nessuna sezione mappabile
      if (normalizedSections.length === 0) {
        scorecard = buildDegradedScorecard("Sezioni LLM non mappabili ai pesi");
      } else {
        scorecard = scoreCompliance({
          sections: normalizedSections,
          weights: SECTION_WEIGHTS,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: report_markdown,
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
