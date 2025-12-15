# TenderMatch Backend — Architecture

## Purpose

This document provides a technical deep dive into the TenderMatch backend architecture.
It complements the README by detailing system boundaries, data flows, security constraints,
and scalability considerations.

---

## System Architecture (High Level)
```text
+---------------------------+
|        Frontend           |
|   (Lovable / Web App)     |
|                           |
|  - UI & workflow          |
|  - Client-side extraction |
+-----------+---------------+
            |
            | HTTPS / JSON
            v
+---------------------------+
|       AI Backend          |
|        (Railway)          |
|                           |
|  - Request validation     |
|  - Claude API integration |
|  - Compliance scoring     |
|  - Output normalization   |
|  - Audit logging          |
+-----------+---------------+
            |
            | Structured Output
            v
+---------------------------+
|    Output Contract        |
|                           |
|  - report_markdown        |
|  - Compliance Scorecard   |
|    (JSON, versioned)      |
+---------------------------+
```

---

## System Boundaries

### AI Backend (Railway)

**Responsibilities**

- Request validation and rate limiting
- Integration with Anthropic Claude API
- Deterministic compliance evaluation
- Enforcement of output schemas and scoring formulas
- Audit logging and traceability

**Constraints**

- No UI rendering
- No PDF generation
- Stateless request handling
- No long-term document storage

### Data Layer (Supabase)

**Responsibilities**

- User authentication and authorization
- Session persistence
- Storage of non-AI application data
- Access control via RLS

**Constraints**

- No AI inference
- No scoring logic
- No direct LLM access
- No prompt or model configuration

---

## Data Flow — Compliance Evaluation

1. Frontend sends extracted tender text and metadata to backend
2. Backend validates request and initializes a compliance session
3. Backend calls Claude API with controlled prompts
4. LLM output is normalized and validated server-side
5. Backend produces dual output:
   - `report_markdown` (human-readable)
   - `scorecard` (machine-readable, versioned)
6. Structured response is returned to frontend

---

## Output Contract

| Field | Type | Description |
|-------|------|-------------|
| report_markdown | string | Narrative compliance analysis |
| scorecard | ComplianceScorecardV1 | Structured scoring output |
| scorecard.meta.schema_version | string | Output schema version |
| scorecard.meta.formula_version | string | Scoring logic version |

**Invariant:**
All numeric scores are computed server-side.
Frontend never derives scores from text.

---

## Security Boundaries

| Area | Enforcement |
|------|-------------|
| AI API keys | Railway environment variables |
| User authentication | Supabase Auth |
| Scoring logic | Backend-only |
| Prompt governance | Backend-controlled |
| Audit trail | Backend logging |

---

## Scalability & Extension Points

- Multi-tenant isolation via backend logic and Supabase RLS
- Support for additional AI providers through adapter pattern
- Extended audit and explainability layers
- Enterprise-grade access controls

**Design Principle:**
All extensions preserve determinism, auditability, and security guarantees.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Railway for AI backend | Isolated scaling and key security |
| Claude via API | High-quality reasoning with controlled prompts |
| Dual output contract | Separation of narrative and machine data |
| Schema versioning | Backward compatibility and auditability |
| No Supabase Edge AI | Clear security and trust boundaries |
