import { Router, Request, Response } from "express";
import {
  anthropicClient,
  MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
} from "../services/anthropicClient";

const router = Router();

interface TenderReadyRequest {
  companyProfile: string;
  tenderText: string;
  language?: string;
}

// NOTA: qui il path è "/" perché viene montato su "/api/tender-ready"
router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[${new Date().toISOString()}] POST /api/tender-ready - Inizio elaborazione`
  );

  try {
    const { companyProfile, tenderText, language = "italiano" } =
      req.body as TenderReadyRequest;

    if (!companyProfile || !tenderText) {
      return res.status(400).json({
        ok: false,
        error:
          "Campi obbligatori mancanti: companyProfile e tenderText sono richiesti",
      });
    }

    const systemPrompt = `Sei TenderMatch, un motore AI specializzato nell'aiutare le aziende italiane a valutare la propria idoneità rispetto ai bandi di gara pubblici e privati.

Il tuo compito è analizzare il profilo aziendale fornito e confrontarlo con i requisiti del bando, producendo un'analisi strutturata e actionable.

Rispondi sempre in ${language}.`;

    const userPrompt = `PROFILO AZIENDA:
${companyProfile}

---

TESTO DEL BANDO:
${tenderText}

---

Analizza il bando e valuta l'allineamento dell'azienda. Fornisci l'output in modo chiaro e strutturato.`;

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
      `[${new Date().toISOString()}] POST /api/tender-ready - Completato in ${duration}ms`
    );

    return res.json({
      ok: true,
      data: analysisText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] POST /api/tender-ready - Errore dopo ${duration}ms:`,
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
