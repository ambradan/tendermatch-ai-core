// tendermatch-backend/src/services/scoring.ts
// Deterministic Scoring Engine v1

import {
  CheckStatus,
  RawChecksOutput,
  Scorecard,
  ScorecardSection,
  ScorecardMeta,
} from "../types/scorecard";

// ============================================================
// FORMULA VERSION & WEIGHTS
// ============================================================

export const SCHEMA_VERSION = "1.0.0";
export const FORMULA_VERSION = "v1-weighted-avg";

/**
 * Pesi per sezione (somma = 1.0)
 * Modificare qui per cambiare l'importanza relativa
 */
export const SECTION_WEIGHTS: Record<string, number> = {
  requisiti_amministrativi: 0.25,
  requisiti_tecnici: 0.30,
  requisiti_economici: 0.20,
  documentazione_generale: 0.15,
  certificazioni: 0.10,
};

/**
 * Mapping status → punteggio (0-100)
 * ND => null (non contribuisce alla media)
 */
const STATUS_SCORE: Record<CheckStatus, number | null> = {
  PASS: 100,
  PARTIAL: 50,
  FAIL: 0,
  ND: null,
};

// ============================================================
// SCORING FUNCTIONS
// ============================================================

/**
 * Calcola lo score di una sezione dalla lista di checks
 * Se tutti ND → null
 * Altrimenti media dei check valutabili
 */
export function computeSectionScore(
  checks: Array<{ status: CheckStatus }>
): number | null {
  const validScores: number[] = [];

  for (const check of checks) {
    const s = STATUS_SCORE[check.status];
    if (s !== null) {
      validScores.push(s);
    }
  }

  if (validScores.length === 0) {
    return null; // tutti ND
  }

  const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
  return Math.round(avg);
}

/**
 * Calcola overall score con media pesata
 * Sezioni con score null vengono escluse e i pesi ridistribuiti
 */
export function computeOverallScore(
  sections: ScorecardSection[]
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const section of sections) {
    if (section.score === null) continue;

    const weight = SECTION_WEIGHTS[section.section_id] ?? 0.1; // fallback weight
    weightedSum += section.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null; // tutte le sezioni ND
  }

  // Normalizza per i pesi effettivamente usati
  return Math.round(weightedSum / totalWeight);
}

/**
 * Determina risk level dallo score
 * null → ND
 */
export function computeRiskLevel(
  score: number | null
): "LOW" | "MEDIUM" | "HIGH" | "ND" {
  if (score === null) return "ND";
  if (score >= 70) return "LOW";
  if (score >= 40) return "MEDIUM";
  return "HIGH";
}

/**
 * Determina confidence dalla % di check valutabili
 */
export function computeConfidence(
  sections: ScorecardSection[]
): "HIGH" | "MEDIUM" | "LOW" | "ND" {
  let totalChecks = 0;
  let ndChecks = 0;

  for (const section of sections) {
    for (const check of section.checks) {
      totalChecks++;
      if (check.status === "ND") ndChecks++;
    }
  }

  if (totalChecks === 0) return "ND";

  const ndRatio = ndChecks / totalChecks;
  if (ndRatio >= 0.5) return "LOW";
  if (ndRatio >= 0.2) return "MEDIUM";
  return "HIGH";
}

// ============================================================
// MAIN BUILDER
// ============================================================

/**
 * Costruisce Scorecard completa da RawChecksOutput
 */
export function buildScorecard(raw: RawChecksOutput): Scorecard {
  const sections: ScorecardSection[] = raw.sections.map((sec) => ({
    section_id: sec.section_id,
    section_name: sec.section_name,
    checks: sec.checks.map((c) => ({
      id: c.id,
      label: c.label,
      status: c.status,
      evidence: c.evidence,
      rationale: c.rationale,
    })),
    score: computeSectionScore(sec.checks),
  }));

  const overall_score = computeOverallScore(sections);
  const risk_level = computeRiskLevel(overall_score);
  const confidence = computeConfidence(sections);

  const meta: ScorecardMeta = {
    schema_version: SCHEMA_VERSION,
    formula_version: FORMULA_VERSION,
    weights: { ...SECTION_WEIGHTS },
    confidence,
    determinism_mode: "STRICT",
    generated_at: new Date().toISOString(),
  };

  return {
    meta,
    sections,
    overall_score,
    risk_level,
  };
}

/**
 * Crea una Scorecard degradata (tutti ND) per fallback
 */
export function buildDegradedScorecard(reason?: string): Scorecard {
  const meta: ScorecardMeta = {
    schema_version: SCHEMA_VERSION,
    formula_version: FORMULA_VERSION,
    weights: { ...SECTION_WEIGHTS },
    confidence: "ND",
    determinism_mode: "STRICT",
    generated_at: new Date().toISOString(),
  };

  // Sezione placeholder
  const sections: ScorecardSection[] = [
    {
      section_id: "parsing_failed",
      section_name: "Analisi non completata",
      checks: [
        {
          id: "parse_error",
          label: reason || "Output LLM non validabile",
          status: "ND",
          rationale: "Impossibile estrarre checks strutturati",
        },
      ],
      score: null,
    },
  ];

  return {
    meta,
    sections,
    overall_score: null,
    risk_level: "ND",
  };
}
