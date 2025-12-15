// Compliance Scorecard Schema v1
// CONTRATTO PUBBLICO STABILE - Non modificare senza bump di schema_version

/**
 * Risultato discreto di un singolo check
 */
export type ComplianceResult = "PASS" | "PARTIAL" | "FAIL" | "ND";

/**
 * Singolo check di compliance
 */
export interface ComplianceCheck {
  id: string;
  result: ComplianceResult;
  evidence?: string[];
  rationale?: string;
}

/**
 * Sezione di compliance con aggregazione
 */
export interface ComplianceSection {
  id: string;
  label: string;
  checks: ComplianceCheck[];
  status: ComplianceResult;
  score: number | null;  // 0–100 o null se ND
  raw: number | null;    // 0–1 o null se ND
}

/**
 * Risultato complessivo aggregato
 */
export interface ComplianceOverall {
  status: ComplianceResult;
  score: number | null;  // 0–100 o null se ND
  raw: number | null;    // 0–1 o null se ND
}

/**
 * Metadati per audit e versioning
 */
export interface ComplianceScorecardMeta {
  schema_version: "compliance-scorecard-v1";
  formula_version: string;
  confidence?: number;
  determinism_mode: "locked";
  generated_at: string;  // ISO8601
}

/**
 * Schema principale Compliance Scorecard v1
 */
export interface ComplianceScorecardV1 {
  sections: ComplianceSection[];
  overall: ComplianceOverall;
  weights: Record<string, number>;
  meta: ComplianceScorecardMeta;
}
