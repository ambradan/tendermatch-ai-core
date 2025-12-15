# TenderMatch

AI-powered compliance analysis platform for Italian public procurement.

## Architecture Overview

TenderMatch implements a strict separation between AI processing and presentation layers.

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | React / Vite | UI, PDF rendering, user interaction |
| AI Backend | Node.js on Railway | All AI inference, compliance scoring |
| Data Layer | Supabase | Authentication, storage, persistence |

**Key design decision:** AI workloads run exclusively on a dedicated backend infrastructure. This separation enables independent scaling, audit isolation, and clear security boundaries.

No AI inference logic is deployed on Supabase in production.

## AI Engine Design

All AI processing is handled by a dedicated Railway backend.

**What the backend does:**
- Integrates with Claude API for document analysis
- Executes deterministic compliance scoring
- Produces structured output contracts

**What the backend does NOT do:**
- Render UI components
- Generate PDFs
- Store user sessions

**What the frontend does NOT do:**
- Execute AI inference
- Calculate compliance scores
- Interpret raw LLM output

This boundary is enforced by design, not convention.

## Data Flow & Contracts

Every AI operation produces two outputs:

| Output | Type | Consumer |
|--------|------|----------|
| report_markdown | string | Human-readable display |
| scorecard | JSON (Compliance Scorecard v1) | Programmatic consumption, audit |

**Contract guarantees:**
- Scorecard schema is versioned (compliance-scorecard-v1)
- Scoring formula is versioned independently (score-formula-v1)
- Backend is single source of truth for all numeric scores
- Frontend never parses markdown to extract scores

**PDF Generation:**
PDF export is a frontend responsibility. The backend provides data; the frontend renders documents. This ensures UI-level control and eliminates backend coupling for presentation concerns.

## Security & Compliance Considerations

**API Key Isolation:**
- Anthropic API keys are stored only in Railway environment
- Frontend has no access to AI provider credentials
- Supabase handles auth tokens separately

**Audit Trail:**
- Every compliance check produces a versioned scorecard
- Schema version enables backward-compatible evolution
- No implicit score derivation from unstructured text

**Data Flow:**
- Documents are processed client-side for text extraction
- Only extracted text is sent to backend (no raw file upload to AI layer)
- User data persistence is isolated in Supabase

## Runtime Configuration

| Variable | Required | Scope | Purpose |
|----------|----------|-------|---------|
| VITE_TENDERMATCH_BACKEND_URL | Yes | Frontend | Railway backend endpoint |
| VITE_SUPABASE_URL | Yes | Frontend | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Yes | Frontend | Supabase public key |
| ANTHROPIC_API_KEY | Yes | Backend (Railway env) | Claude API access |

Environment variables are injected at build time (Vite).

**Failure behavior:**
- Missing VITE_TENDERMATCH_BACKEND_URL: AI features fail with explicit error
- No silent fallback to alternative endpoints
- Console warnings indicate misconfiguration

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **AI Backend:** Node.js, Express, TypeScript (Railway)
- **Database & Auth:** Supabase (PostgreSQL, Auth, Storage)
- **AI Provider:** Anthropic Claude API

## Deployment

Frontend is deployed via Lovable publish. Backend is deployed on Railway with automatic scaling.

For system-level architecture and compliance logic, see the backend repository documentation.

To deploy frontend:
1. Open [Lovable](https://lovable.dev/projects/f22ecf68-1ba3-484b-820f-d1e2a44e9548)
2. Click Share → Publish

Custom domains can be configured in Project → Settings → Domains.
