import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";

const router = Router();

interface ComplianceCheckRequest {
  tenderId: string;
  documents: Array<{
    name: string;
    type: string;
    summary: string;
  }>;
  language?: string;
}

// QUI il percorso è "/" perché Express lo monta su "/api/ai-compliance-check"
router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/ai-compliance-check - Inizio`
  );

  try {
    const { tenderId, documents, language = "italiano" } =
      req.body as ComplianceCheckRequest;

    if (!tenderId || !documents) {
      return res.status(400).json({
        ok: false,
        error: "Campi obbligatori mancanti: tenderId e documents richiesti",
      });
    }

    const docSummary = documents
      .map((d) => `- ${d.name} (${d.type}): ${d.summary}`)
      .join("\n");

    const systemPrompt = `Sei TenderMatch AI Compliance Engine. 
Verifichi in modo rigoroso la conformità documentale ai requisiti di gara.
Rispondi in ${language}.`;

    const userPrompt = `BANDO: ${tenderId}

DOCUMENTI PRESENTATI:
${docSummary}

Genera:
1. Elenco requisiti minimi
2. Verifica documento per documento
3. Gap analysis
4. Azioni richieste
5. Punteggio finale (0–100)`;

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
    const analysis = textContent?.type === "text" ? textContent.text : "";

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - OK in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: analysis,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/ai-compliance-check - Errore in ${duration}ms`,
      error instanceof Error ? error.message : error
    );

    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore interno durante AI Compliance",
    });
  }
});

export default router;
