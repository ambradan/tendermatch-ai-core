# AI Output Contract — Evolution & Changelog

## Compliance Scorecard

---

## v1 — Current (Enforced)

**Status:** Active · Enforced  
**Schema:** `compliance-scorecard-v1`  
**Formula:** `score-formula-v1`

### Guarantees

- Dual output obbligatorio:
  - `report_markdown` (narrativo)
  - `scorecard_json` (machine-first)
- LLM NON produce punteggi numerici
- Tutti i punteggi sono calcolati esclusivamente nel backend
- Mapping deterministico PASS / PARTIAL / FAIL / ND
- ND → score null (mai fallback numerici)
- Degradazione sicura a ND in caso di errore
- UI e consumer downstream sono passivi

Questa versione è considerata stabile e auditabile.

---

## v2 — Planned Evolution (Backward Compatible)

**Status:** Planned · Non Enforced  
**Breaking changes:** NO

Questa sezione descrive evoluzioni previste.
Non rappresenta implementazione attiva.

### Obiettivi v2

- Migliorare affidabilità dell'output strutturato
- Rafforzare auditabilità ed explainability
- Mantenere piena compatibilità con consumer v1

### Evoluzioni previste

#### 1) Structured LLM Output (Direction)

- Migrazione da parsing di testo libero
- Possibile utilizzo futuro di:
  - JSON mode
  - tool calling
- La scelta tecnica non è ancora vincolante
- Fallback a ND resta obbligatorio in caso di violazioni

#### 2) Formula Version v2

- Introduzione di `score-formula-v2`
- Stesso schema `compliance-scorecard-v1`
- Nessun impatto strutturale sul contratto
- Formula versionata separatamente dallo schema

#### 3) Severity / Criticality (Additive)

- Campo opzionale per i check
- Valori possibili: `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`
- Non influisce direttamente sullo score numerico v2
- Additive-only, backward compatible

#### 4) Confidence Model v2 (Non Binding)

- Calcolo esplicito di `meta.confidence` (0–1)
- Basato su:
  - completezza input
  - quota ND
  - qualità strutturale dell'output
- Formula da definire in fase implementativa
- Non modifica score o status

#### 5) Explainability (Optional)

- Possibile estensione con note esplicative strutturate
- Supporto a audit e revisione umana
- Non vincolante per v2

---

## Cosa NON cambierà (Invariants)

- LLM non produce punteggi numerici
- `report_markdown` non viene mai parsato
- scoring solo backend
- ND non viene mai convertito in numeri
- schema unico per tutti gli endpoint AI

---

## v3 — Vision (Non Binding)

Possibili direzioni future:

- risk-adjusted scoring
- tagging normativo (GDPR, ISO, NIS2, ecc.)
- supporto multi-framework

Ogni cambiamento strutturale richiederà:

- nuovo `schema_version`
- documentazione esplicita

---

## Governance Rule

> Schema changes are explicit.  
> Formula changes are versioned.  
> Consumers must never guess.

---

**Document End**
