import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";

const router = Router();

interface DocumentSummary {
  name: string;
  type: string;
  summary: string;
}

interface ComplianceCheckRequest {
  tenderId: string;
  documents: DocumentSummary[];
  language?: string;
}

router.post("/ai-compliance-check", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { tenderId } = req.body as ComplianceCheckRequest;
  
  console.log(`[${new Date().toISOString()}] POST /api/ai-compliance-check - TenderId: ${tenderId || "non specificato"}`);

  try {
    const { documents, language = "italiano" } = req.body as ComplianceCheckRequest;

    if (!tenderId || !documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Campi obbligatori mancanti: tenderId e documents (array non vuoto) sono richiesti",
      });
    }

    const documentsFormatted = documents
      .map(
        (doc, index) =>
          `### Documento ${index + 1}: ${doc.name}
Tipo: ${doc.type}
Contenuto riassunto: ${doc.summary}`
      )
      .join("\n\n");

    const systemPrompt = `Sei il modulo "AI Compliance Check" di TenderMatch, specializzato nell'analisi della conformità documentale per gare d'appalto.

Il tuo compito è verificare se i documenti forniti dall'azienda soddisfano i requisiti di compliance tipici dei bandi di gara italiani.

Rispondi sempre in ${language}.

FORMATO OUTPUT RICHIESTO:

## 1. PANORAMICA DOCUMENTI ANALIZZATI
[Elenco dei documenti ricevuti con valutazione rapida dello stato]

## 2. REQUISITI DI COMPLIANCE COPERTI
[Lista dei requisiti normativi/amministrativi che risultano soddisfatti dalla documentazione presente]
- ✅ [Requisito] - Coperto da: [Nome documento]

## 3. REQUISITI MANCANTI O CRITICI
[Lista dei requisiti non coperti o parzialmente coperti]
- ❌ [Requisito mancante] - Criticità: [Alta/Media/Bassa]
- ⚠️ [Requisito parziale] - Problema: [descrizione]

## 4. AZIONI CORRETTIVE PROPOSTE
[Lista numerata di azioni da intraprendere per raggiungere la compliance completa, ordinate per priorità]

## 5. PUNTEGGIO DI COMPLIANCE
[Punteggio da 0 a 100 con giustificazione]

---
Basa l'analisi esclusivamente sui documenti forniti. Segnala chiaramente dove mancano informazioni.`;

    const userPrompt = `RIFERIMENTO BANDO/TENDER: ${tenderId}

DOCUMENTI DA ANALIZZARE:
${documentsFormatted}

---

Esegui l'analisi di compliance e fornisci l'output nel formato richiesto.`;

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

    const textContent = response.content.find((block) => block.type === "text");
    const analysisText = textContent?.type === "text" ? textContent.text : "";

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] POST /api/ai-compliance-check - TenderId: ${tenderId} - Completato in ${duration}ms`);

    return res.json({
      ok: true,
      data: analysisText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - TenderId: ${tenderId || "N/A"} - Errore dopo ${duration}ms:`,
      error instanceof Error ? error.message : "Errore sconosciuto"
    );

    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Errore durante l'analisi di compliance",
    });
  }
});

export default router;
