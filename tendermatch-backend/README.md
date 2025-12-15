# TenderMatch Backend

> All AI outputs are generated exclusively by this backend and comply with the AI Output Contract.

AI-powered backend for TenderMatch — tender document analysis and compliance evaluation.

This service is designed as a **standalone AI backend**, independent from the frontend hosting platform. It integrates directly with the Anthropic Claude API and is deployed on **Railway** via Docker.

---

## Architecture Overview

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| AI Backend | Node.js / Express / TypeScript | All AI inference, scoring, contract enforcement |
| AI Provider | Anthropic Claude API | Document analysis and compliance reasoning |
| Infrastructure | Railway (Docker) | Isolated, scalable deployment |

**Key design decisions:**

- AI workloads run exclusively on this dedicated backend
- No AI logic is deployed on frontend or edge functions
- All scoring is deterministic and server-side only
- Output contracts are versioned for auditability

---

## Core Capabilities

- **Privacy by Design** — No sensitive data is logged or persisted
- **Human-in-the-Loop Friendly** — AI outputs are designed to support, not replace, human decision-making
- **Deterministic Scoring** — All numeric outputs computed server-side
- **Containerized** — Production-ready for Railway, Render, Fly.io, or any container platform
- **Type-Safe** — Full TypeScript implementation

---

## API Reference

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "tendermatch-backend",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### `POST /api/tender-ready`

Analyzes a tender document against a company profile.

**Request:**
```json
{
  "companyProfile": "Company description, sector, certifications, revenue...",
  "tenderText": "Full tender document text...",
  "language": "italiano"
}
```

**Response:**
```json
{
  "ok": true,
  "data": "## 1. TENDER SUMMARY\n...",
  "scorecard": { ... }
}
```

---

### `POST /api/ai-compliance-check`

Evaluates document compliance for a tender submission.

**Request:**
```json
{
  "tenderId": "TENDER-2025-001",
  "documents": [
    {
      "name": "Chamber of Commerce Extract",
      "type": "legal_document",
      "summary": "Updated 2025, share capital €100,000..."
    },
    {
      "name": "ISO 9001 Certification",
      "type": "certification",
      "summary": "ISO 9001:2015, valid until 2026..."
    }
  ],
  "language": "italiano"
}
```

**Response:**
```json
{
  "ok": true,
  "data": "## 1. DOCUMENT ANALYSIS OVERVIEW\n...",
  "scorecard": { ... }
}
```

---

## Output Contract

Every AI operation produces dual outputs:

| Output | Type | Purpose |
|--------|------|---------|
| `data` | string (markdown) | Human-readable analysis |
| `scorecard` | JSON (Compliance Scorecard v1) | Machine-readable, auditable |

**Contract guarantees:**

- Schema version: `compliance-scorecard-v1`
- Formula version: `score-formula-v1`
- All numeric scores computed server-side only
- Frontend never parses markdown to derive scores

See: [AI Output Contract — Compliance Scorecard v1](./README_AI_OUTPUT_CONTRACT.md)

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `PORT` | No | `3000` | Server port |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | CORS whitelist (comma-separated) |

---

## Local Development
```bash
# Clone and install
git clone https://github.com/your-org/tendermatch-backend.git
cd tendermatch-backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Start development server
npm run dev

# Server available at http://localhost:3000
```

**Test endpoints:**
```bash
# Health check
curl http://localhost:3000/health

# Tender analysis
curl -X POST http://localhost:3000/api/tender-ready \
  -H "Content-Type: application/json" \
  -d '{
    "companyProfile": "IT company, 50 employees, ISO 27001 certified",
    "tenderText": "IT services tender, ISO 27001 required, min revenue €1M"
  }'
```

---

## Build
```bash
npm run build
# Output: ./dist/
```

---

## Docker
```bash
# Build
docker build -t tendermatch-backend .

# Run
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e ALLOWED_ORIGINS=https://tendermatch.lovable.app \
  tendermatch-backend
```

---

## Railway Deployment

1. Create project on [Railway](https://railway.app) → Deploy from GitHub
2. Configure environment variables:
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_ORIGINS`
3. Railway auto-detects Dockerfile and deploys

Production URL: `https://tendermatch-backend-production.up.railway.app`

---

## Security

| Area | Implementation |
|------|----------------|
| API credentials | Environment variables only, never logged |
| Request logging | Timestamp, endpoint, tenderId only — no sensitive data |
| CORS | Explicit origin whitelist |
| Transport | HTTPS enforced by Railway |
| Scoring logic | Backend-only, not exposed to clients |

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE_BACKEND.md) | System boundaries and data flows |
| [README_AI_OUTPUT_CONTRACT.md](./README_AI_OUTPUT_CONTRACT.md) | AI output contract specification |
| [CHANGELOG.md](./CHANGELOG_AI_OUTPUT.md) | Version history |
| [TECHNICAL_ROADMAP.md](./TECHNICAL_ROADMAP.md) | Technical roadmap |

---

## License

Proprietary — TenderMatch © 2025
