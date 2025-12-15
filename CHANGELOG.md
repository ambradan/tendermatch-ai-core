# Changelog

## [2.0.0] - 2025-01 — Architecture Consolidation

### Infrastructure
- AI processing consolidated on dedicated Railway backend
- Removed Supabase Edge Functions from AI pipeline
- Established clear frontend/backend responsibility boundaries

### Contracts
- Introduced Compliance Scorecard v1 schema
- Implemented dual-output model (markdown + structured JSON)
- Scoring logic centralized in backend

### Governance
- All numeric scores computed server-side only
- Schema and formula versioning for audit compatibility
- PDF generation scoped to frontend

### Documentation
- Architecture documentation formalized
- Security considerations documented
- Runtime configuration requirements specified

---

## [1.0.0] - 2024 — Initial Release

- Prototype implementation
- Mixed processing architecture
- No formal output contracts
