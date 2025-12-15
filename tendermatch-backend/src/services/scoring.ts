// Scoring Engine v1 - Deterministic Compliance Scoring
// UNICA fonte di verità per i punteggi

import {
  ComplianceResult,
  ComplianceCheck,
  ComplianceSection,
  ComplianceOverall,
  ComplianceScorecardV1,
  ComplianceScorecardMeta,
} from "../types/complianceScorecard";

// ============================================================
// CONSTANTS
// ============================================================

export const SCHEMA_VERSION = "compliance-scorecard-v1" as const;
export const FORMULA_VERSION = "score-formula-v1";

/**
 * Mapping check result → valore numerico
 * ND è escluso (null)
 */
const RESULT_VALUE: Record<ComplianceResult, number | null> = {
  PASS: 1.0,
  PARTIAL: 0.5,
  FAIL: 0.0,
  ND: null,
};

// ============================================================
// SECTION SCORING
// ============================================================

interface SectionInput {
  id: string;
  label: string;
  checks: ComplianceCheck[];
}

interface SectionScoreOutput {
  status: ComplianceResult;
  score: number | null;
  raw: number | null;
}

/**
 * Calcola status da raw score (0–1)
 */
function statusFromRaw(raw: number): ComplianceResult {
  const percent = raw * 100;
  if (percent >= 80) return "PASS";
  if (percent >= 50) return "PARTIAL";
  return "FAIL";
}

/**
 * Calcola score di una sezione dai suoi checks
 * - Se tutti ND → status "ND", score null
 * - Altrimenti: raw = media valori, score = round(raw * 100)
 */
export function scoreSection(checks: ComplianceCheck[]): SectionScoreOutput {
  const values: number[] = [];

  for (const check of checks) {
    const val = RESULT_VALUE[check.result];
    if (val !== null) {
      values.push(val);
    }
  }

  // Tutti ND
  if (values.length === 0) {
    return { status: "ND", score: null, raw: null };
  }

  const raw = values.reduce((a, b) => a + b, 0) / values.length;
  const score = Math.round(raw * 100);
  const status = statusFromRaw(raw);

  return { status, score, raw };
}

/**
 * Costruisce una ComplianceSection completa
 */
export function buildSection(input: SectionInput): ComplianceSection {
  const { status, score, raw } = scoreSection(input.checks);

  return {
    id: input.id,
    label: input.label,
    checks: input.checks,
    status,
    score,
    raw,
  };
}

// ============================================================
// OVERALL SCORING
// ============================================================

interface OverallInput {
  sections: ComplianceSection[];
  weights: Record<string, number>;
}

/**
 * Calcola score overall con media pesata
 * - Solo sezioni con score !== null
 * - Se nessuna valida o somma pesi = 0 → ND, score null
 */
export function scoreOverall(input: OverallInput): ComplianceOverall {
  const { sections, weights } = input;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const section of sections) {
    if (section.raw === null) continue;

    const weight = weights[section.id] ?? 0;
    if (weight <= 0) continue;

    weightedSum += section.raw * weight;
    totalWeight += weight;
  }

  // Nessuna sezione valida
  if (totalWeight === 0) {
    return { status: "ND", score: null, raw: null };
  }

  const raw = weightedSum / totalWeight;
  const score = Math.round(raw * 100);
  const status = statusFromRaw(raw);

  return { status, score, raw };
}

// ============================================================
// MAIN BUILDER
// ============================================================

interface ComplianceInput {
  sections: SectionInput[];
  weights: Record<string, number>;
}

/**
 * Costruisce Compliance Scorecard v1 completa
 * Entry point principale per lo scoring
 */
export function scoreCompliance(input: ComplianceInput): ComplianceScorecardV1 {
  // Build sections with scores
  const sections = input.sections.map(buildSection);

  // Calculate overall
  const overall = scoreOverall({ sections, weights: input.weights });

  // Build meta
  const meta: ComplianceScorecardMeta = {
    schema_version: SCHEMA_VERSION,
    formula_version: FORMULA_VERSION,
    determinism_mode: "locked",
    generated_at: new Date().toISOString(),
  };

  return {
    sections,
    overall,
    weights: { ...input.weights },
    meta,
  };
}

// ============================================================
// DEGRADED SCORECARD (fallback per errori parsing)
// ============================================================

/**
 * Crea scorecard degradata quando parsing LLM fallisce
 * Tutti ND, nessun score numerico
 */
export function buildDegradedScorecard(reason?: string): ComplianceScorecardV1 {
  const meta: ComplianceScorecardMeta = {
    schema_version: SCHEMA_VERSION,
    formula_version: FORMULA_VERSION,
    determinism_mode: "locked",
    generated_at: new Date().toISOString(),
  };

  const sections: ComplianceSection[] = [
    {
      id: "parse_error",
      label: reason || "Analisi non completata",
      checks: [
        {
          id: "llm_output_invalid",
          result: "ND",
          rationale: "Output LLM non validabile",
        },
      ],
      status: "ND",
      score: null,
      raw: null,
    },
  ];

  return {
    sections,
    overall: { status: "ND", score: null, raw: null },
    weights: {},
    meta,
  };
}
