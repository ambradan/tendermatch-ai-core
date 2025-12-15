## v0.1.0 — Initial Core Release

Initial core release of the TenderMatch AI compliance backend.

This release establishes the core architecture, contracts, and governance
for AI-driven tender compliance evaluation.

### Included

- Deterministic scoring and output normalization
- Integration with Anthropic Claude via controlled backend mediation
- Dual output contract:
  - Human-readable compliance report (markdown)
  - Machine-readable Compliance Scorecard (JSON, versioned)
- Strict separation between frontend, backend, and AI layers
- Backend-only scoring logic and schema enforcement
- Audit-oriented design with traceability guarantees

### Architecture & Governance

- Clear system boundaries (Frontend / Backend / AI / Data)
- Versioned output schemas and scoring formulas
- No AI inference or scoring logic deployed on frontend or Supabase
- Closed-source governance model

### Notes

This release represents a functional MVP focused on correctness,
auditability, and security rather than feature completeness.

Future changes will preserve backward compatibility at the contract level
whenever possible.

### Documentation

- System architecture and design decisions: [ARCHITECTURE_BACKEND.md](./ARCHITECTURE_BACKEND.md)
- API behavior and output contracts: [README.md](./README.md)
- Forward-looking technical direction: [TECHNICAL ROADMAP.md](./TECHNICALROADMAP.md)
