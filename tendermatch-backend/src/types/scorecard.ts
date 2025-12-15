// tendermatch-backend/src/types/scorecard.ts
// Scorecard Schema v1 – AI Compliance Engine

/**
 * Stato di un check discreto
 * - PASS: requisito soddisfatto
 * - PARTIAL: parzialmente soddisfatto
 * - FAIL: non soddisfatto
 * - ND: non determinabile (dati insufficienti)
 */
export type CheckStatus = "PASS" | "PARTIAL" | "FAIL" | "ND";

/**
 * Singolo check di una sezione
 */
export interface SectionCheck {
  id: string;
  label: string;
  status: CheckStatus;
  evidence?: string;      // snippet di evidenza dal documento/bando
  rationale?: string;     // breve motivazione (max ~100 chars)
}

/**
 * Sezione valutata con i suoi check
 */
export interface ScorecardSection {
  section_id: string;
  section_name: string;
  checks: SectionCheck[];
  score: number | null;   // null se tutti ND o non calcolabile
}

/**
 * Metadati obbligatori per auditabilità
 */
export interface ScorecardMeta {
  schema_version: string;           // "1.0.0"
  formula_version: string;          // "v1-weighted-avg"
  weights: Record<string, number>;  // { "requisiti_tecnici": 0.3, ... }
  confidence: "HIGH" | "MEDIUM" | "LOW" | "ND";
  determinism_mode: "STRICT";       // sempre deterministico
  generated_at: string;             // ISO timestamp
}

/**
 * Scorecard completa (oggetto strutturato)
 */
export interface Scorecard {
  meta: ScorecardMeta;
  sections: ScorecardSection[];
  overall_score: number | null;     // null se non calcolabile
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "ND";
}

/**
 * Output raw dall'LLM (solo checks, nessun numero)
 */
export interface RawChecksOutput {
  sections: Array<{
    section_id: string;
    section_name: string;
    checks: Array<{
      id: string;
      label: string;
      status: CheckStatus;
      evidence?: string;
      rationale?: string;
    }>;
  }>;
}

/**
 * Risposta unificata degli endpoint
 */
export interface ScorecardResponse {
  ok: true;
  data: string;           // report markdown (compatibilità)
  scorecard: Scorecard;   // nuovo: strutturato
}

export interface ScorecardErrorResponse {
  ok: false;
  error: string;
  data?: string;          // report parziale se disponibile
  scorecard?: Scorecard;  // degradato a ND
}
