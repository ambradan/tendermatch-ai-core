import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";

const router = Router();

interface ComplianceDocument {
  name: string;
  type: string; // es: "certification", "policy", "procedure", ecc.
  summary: string; // breve descrizione / testo rilevante
}

interface ComplianceCheckRequest {
  tenderId: string;
  documents: ComplianceDocument[];
  language?: string;
}

// NOTA: qui il path è "/" perché il router viene montato su "/api/ai-compliance-check"
router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/ai-compliance-check - Inizio elaborazione`
  );

  try {
    const {
      tenderId,
      documents,
      language = "italiano",
    } = req.body as ComplianceCheckRequest;

    if (!tenderId || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: tenderId e almeno un documento in 'documents' sono richiesti",
      });
    }

    const systemPrompt = `Sei TenderMatch AI Compliance, un motore AI specializzato nel verificare l'allineamento documentale delle aziende italiane rispetto ai requisiti di gara.

Il tuo compito è analizzare l'elenco dei documenti forniti (certificazioni, policy, procedure, ecc.) e produrre un'analisi strutturata della loro copertura rispetto ai requisiti tipici del bando.

Rispondi sempre in ${language}.

FORMATTAZIONE DELL'OUTPUT:

## 1. CONTESTO
- ID gara: {tenderId}
- Descrizione sintetica del perimetro di verifica (es. sicurezza, qualità, privacy, continuità operativa)

## 2. DOCUMENTI ANALIZZATI
[Elenco puntato con nome documento, tipo e ruolo nel perimetro di compliance]

## 3. COPERTURA REQUISITI
[Tabella o elenco strutturato con:
- Requisito / ambito (es. ISO 27001, ISO 9001, gestione incidenti, GDPR, business continuity)
- Documenti che lo coprono
- Livello di copertura:
    ✅ pienamente coperto
    ⚠️ parzialmente coperto / da integrare
    ❌ non coperto o non dimostrabile]

## 4. GAP E RACCOMANDAZIONI
[Lista numerata dei principali gap con suggerimenti pratici:
- che documento/procedura manca
- se serve aggiornare qualcosa
- cosa sarebbe opportuno produrre prima di partecipare alla gara]

## 5. VALUTAZIONE FINALE
- Punteggio di compliance (0–100)
- Breve commento conclusivo operativo

Non inventare documenti che non sono stati forniti. Se qualcosa non è dimostrabile in base ai dati, dillo esplicitamente.`;

    const docsAsText = documents
      .map(
        (doc, index) =>
          `# Documento ${index + 1}
Nome: ${doc.name}
Tipo: ${doc.type}
Contenuto / Riassunto:
${doc.summary}`
      )
      .join("\n\n");

    const userPrompt = `Stai analizzando la documentazione fornita per la gara con ID: ${tenderId}.

Di seguito trovi l'elenco strutturato dei documenti disponibili:

${docsAsText}

---

Sulla base di questi documenti, produci l'analisi di compliance nel formato richiesto.`;

    const response = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const textContent = response.content.find(
      (block) => block.type === "text"
    );
    const analysisText =
      textContent?.type === "text" ? textContent.text : "";

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: analysisText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Errore dopo ${duration}ms:`,
      error instanceof Error ? error.message : "Errore sconosciuto"
    );

    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore durante l'elaborazione della richiesta",
    });
  }
});

export default router;
