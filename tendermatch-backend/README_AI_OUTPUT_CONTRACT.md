# AI Output Contract – Compliance Scorecard v1

**Status:** Active · Enforced · v1  
**Last Updated:** 2025-01-15  
**Schema Version:** `compliance-scorecard-v1`  
**Formula Version:** `score-formula-v1`

---

## 1. Purpose

`tendermatch-backend` is the **AI Compliance Engine** and the **single source of truth** for all compliance scoring, status determination, and audit-ready output.

This contract defines the formal, binding specification for all AI-generated outputs.

### Why Two Outputs?

| Output | Target | Purpose |
|--------|--------|---------|
| `report_markdown` | Humans | Narrative explanation, evidence, recommendations |
| `scorecard_json` | Machines | Structured, auditable, versioned scoring data |

These outputs serve fundamentally different purposes and must never be conflated.

---

## 2. Dual Output Contract

### 2.1 report_markdown

**Type:** `string`

**What it is:**
- Human-readable Markdown narrative
- Contains explanations, evidence snippets, recommendations
- Qualitative indicators (✅ ⚠️ ❌ ℹ️)

**What it is used for:**
- Display to end users
- Human review and understanding
- Contextual explanations

**What it must NEVER be used for:**
- ❌ Parsing to extract numerical scores
- ❌ Extracting compliance status
- ❌ Any machine processing for scoring
- ❌ Source of truth for downstream systems

### 2.2 scorecard_json

**Type:** `ComplianceScorecardV1` (see schema)

**What it is:**
- Machine-first structured JSON
- Deterministically computed scores
- Versioned and auditable
- Single source of truth for all scoring

**What it is used for:**
- UI rendering of scores and status
- Downstream system integration
- Audit trails
- Analytics and reporting

**Critical rule:**
> `scorecard_json` is NEVER derived from parsing `report_markdown`.  
> Both outputs are generated independently.

---

## 3. Non-Negotiable Rules (Guardrails)

| Rule | Enforcement |
|------|-------------|
| LLM does NOT produce final numerical scores | Prompt-level prohibition |
| All scores computed ONLY in `scoring.ts` | Code architecture |
| ND ≠ FAIL | Semantic distinction |
| ND → `score: null`, never fallback numbers | No hardcoded defaults |
| Parsing report_markdown for scores is FORBIDDEN | Consumer responsibility |
| Single schema for all AI endpoints | `ComplianceScorecardV1` |

### ND Semantics

`ND` (Not Determinable) means:
- Insufficient data to evaluate
- NOT a failure
- NOT a pass
- Score contribution: **excluded from calculation**
- Numeric value: **null** (not 0, not 50, not 75)

---

## 4. Compliance Scorecard v1 – Schema Overview

**Schema Name:** Compliance Scorecard v1  
**Source File:** `src/types/complianceScorecard.ts`

### Meta Fields

```typescript
meta: {
  schema_version: "compliance-scorecard-v1"  // Immutable per release
  formula_version: "score-formula-v1"        // Can evolve independently
  determinism_mode: "locked"                 // No runtime variations
  generated_at: string                       // ISO8601 timestamp
  confidence?: number                        // Optional confidence metric
}
```

### Structure

```typescript
ComplianceScorecardV1 {
  sections: ComplianceSection[]   // Per-section breakdown
  overall: ComplianceOverall      // Aggregated result
  weights: Record<string, number> // Section weights used
  meta: ComplianceScorecardMeta   // Versioning & audit info
}

ComplianceSection {
  id: string
  label: string
  checks: ComplianceCheck[]
  status: "PASS" | "PARTIAL" | "FAIL" | "ND"
  score: number | null   // 0-100 or null if ND
  raw: number | null     // 0-1 or null if ND
}

ComplianceCheck {
  id: string
  result: "PASS" | "PARTIAL" | "FAIL" | "ND"
  evidence?: string[]
  rationale?: string
}

ComplianceOverall {
  status: "PASS" | "PARTIAL" | "FAIL" | "ND"
  score: number | null
  raw: number | null
}
```

---

## 5. Deterministic Scoring v1

### Check Result Mapping

| Result | Raw Value | Contribution |
|--------|-----------|--------------|
| PASS | 1.0 | Included |
| PARTIAL | 0.5 | Included |
| FAIL | 0.0 | Included |
| ND | null | **Excluded** |

### Section Score Calculation

```
If all checks are ND:
  → status = "ND", score = null, raw = null

Otherwise:
  → raw = average of non-ND check values
  → score = round(raw × 100)
  → status:
      raw ≥ 0.80 → "PASS"
      raw ≥ 0.50 → "PARTIAL"
      raw < 0.50 → "FAIL"
```

### Overall Score Calculation

```
weighted_sum = Σ (section.raw × weight) for sections where score ≠ null
total_weight = Σ weight for included sections

If total_weight = 0:
  → status = "ND", score = null, raw = null

Otherwise:
  → raw = weighted_sum / total_weight
  → score = round(raw × 100)
  → status derived from raw (same thresholds)
```

### Default Section Weights

| Section ID | Weight |
|------------|--------|
| requisiti_amministrativi | 0.25 |
| requisiti_tecnici | 0.30 |
| requisiti_economici | 0.20 |
| documentazione_generale | 0.15 |
| certificazioni | 0.10 |

---

## 6. API Response Contract

All AI endpoints return:

```json
{
  "ok": true,
  "data": "<report_markdown>",
  "scorecard": { /* ComplianceScorecardV1 */ }
}
```

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/tender-ready` | Company-tender alignment analysis |
| `POST /api/ai-compliance-check` | Document compliance verification |

### Backward Compatibility

- `data` field remains `string` (Markdown)
- `scorecard` is additive (new field)
- No breaking changes to existing consumers

---

## 7. Versioning Policy

### schema_version

- Format: `compliance-scorecard-v{N}`
- Changes ONLY with structural breaking changes
- Consumer must check and fail-fast if unsupported

### formula_version

- Format: `score-formula-v{N}`
- Can evolve independently (weights, thresholds)
- Does not require schema version bump if structure unchanged

### Consumer Responsibility

```typescript
if (scorecard.meta.schema_version !== "compliance-scorecard-v1") {
  // Fail-fast: do not render scores
  // Show qualitative status only or error
}
```

---

## 8. Failure & Degradation Behavior

### When LLM output is invalid or unparseable:

| Aspect | Behavior |
|--------|----------|
| `scorecard` | Degrades to all-ND state |
| `overall.score` | `null` |
| `overall.status` | `"ND"` |
| Fallback numbers | **NEVER** (forbidden) |
| `report_markdown` | Still returned if available |

### Degraded Scorecard Structure

```json
{
  "sections": [{
    "id": "parse_error",
    "label": "Analisi non completata",
    "checks": [{
      "id": "llm_output_invalid",
      "result": "ND",
      "rationale": "Output LLM non validabile"
    }],
    "status": "ND",
    "score": null,
    "raw": null
  }],
  "overall": { "status": "ND", "score": null, "raw": null },
  "weights": {},
  "meta": { ... }
}
```

---

## 9. Known Limitations (v1)

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| raw_checks generated as free text | Parsing fragility | JSON validation + degradation |
| No guaranteed JSON from LLM | Potential parse failures | Safe fallback to ND |
| Single-instance rate limiting | Not distributed | Acceptable for current scale |

### Roadmap (v2)

- Migrate to Anthropic tool calling for guaranteed JSON
- Add confidence scoring based on evidence coverage
- Distributed rate limiting for horizontal scaling

---

## 10. Final Rule

> **If it's not in `scorecard_json`, it does not exist.**

All downstream systems, UIs, and integrations must treat `scorecard_json` as the sole source of truth for compliance scoring and status.

Parsing `report_markdown` for scores, status, or any machine-readable data is strictly prohibited.

---

**Document End**
