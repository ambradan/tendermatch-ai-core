# TenderMatch Frontend — Architecture

## Purpose

This document describes the frontend architecture of TenderMatch.
It focuses on UI responsibilities, client-side processing, and system boundaries.
It does not describe AI inference or scoring logic.

---

## Frontend Overview

TenderMatch frontend is a presentation and orchestration layer built to provide
a clear, controlled interface to backend AI capabilities.
```text
+---------------------------+
|         Browser           |
|                           |
|  - UI rendering           |
|  - PDF text extraction    |
|  - Input validation       |
|  - Result visualization   |
+-----------+---------------+
            |
            | HTTPS / JSON
            v
+---------------------------+
|       Backend API         |
|  (External Dependency)    |
+---------------------------+
```

---

## Responsibilities

### Frontend Layer

**Primary Responsibilities**

- User interaction and workflow management
- Client-side document parsing and text extraction
- Validation of file formats and sizes
- Secure transmission of extracted text
- Visualization of compliance results
- Client-side PDF report generation

**Explicitly Out of Scope**

- AI inference
- Compliance scoring
- Prompt management
- Business-rule enforcement
- Audit or persistence logic

---

## Data Handling

- Raw documents are processed client-side for text extraction
- Only extracted text and metadata are sent to the backend
- No AI API keys are stored or exposed in the frontend
- No scoring logic is executed client-side

---

## Security Considerations

| Area | Approach |
|------|----------|
| AI credentials | Never present in frontend |
| Document content | Processed locally before transmission |
| API communication | HTTPS with backend validation |
| Sensitive logic | Fully delegated to backend |

---

## Dependency Boundaries

| Dependency | Role |
|------------|------|
| Backend API | Compliance evaluation and scoring |
| Browser runtime | PDF parsing and UI rendering |
| Authentication provider | User identity and session |

---

## Scalability Considerations

- Stateless frontend deployment
- Horizontal scaling via CDN / hosting provider
- Backend-driven feature evolution without frontend redeploy
- Clear separation enables UI iteration without affecting scoring integrity

---

## Design Principles

- Frontend is a controlled presentation layer
- No domain-level business logic
- No derived or inferred scores
- Clear trust boundary with backend systems
