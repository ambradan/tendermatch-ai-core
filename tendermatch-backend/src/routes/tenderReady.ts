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

router.post("/tender-ready", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] POST /api/tender-ready - Inizio elaborazione`);

  try {
    const { companyProfile, tenderText, language = "italiano" } = req.body as TenderReadyRequest;

    if (!companyProfile || !tenderText) {
      return res.status(400).json({
        ok: false,
        error: "Campi obbligatori mancanti: companyProfile e tenderText sono richiesti",
      });
    }

    const systemPrompt = `Sei TenderMatch, un motore AI specializzato nell'aiutare le aziende italiane a valutare la propria idoneità rispetto ai bandi di gara pubblici e privati.

Il tuo compito è analizzare il profilo aziendale fornito e confrontarlo con i requisiti del bando, producendo un'analisi strutturata e actionable.

Rispondi sempre in ${language}.

FORMATO OUTPUT RICHIESTO:
Produci un'analisi strutturata con le seguenti sezioni:

## 1. SINTESI DEL BANDO
[Breve riassunto del bando: oggetto, ente appaltante, importo se indicato, scadenze chiave]

## 2. REQUISITI OBBLIGATORI
[Lista puntata dei requisiti minimi di partecipazione]

## 3. GAP ANALYSIS
[Confronto tra profilo aziendale e requisiti. Evidenzia:
- ✅ Requisiti soddisfatti
- ⚠️ Requisiti parzialmente soddisfatti
- ❌ Requisiti non soddisfatti o non verificabili]

## 4. AZIONI CONSIGLIATE
[Lista numerata di azioni operative concrete da intraprendere, ordinate per priorità]

## 5. PUNTEGGIO DI ALLINEAMENTO
[Punteggio da 0 a 100 con breve giustificazione]

---
Sii preciso, obiettivo e pratico. Non inventare informazioni non presenti nei dati forniti.`;

    const userPrompt = `PROFILO AZIENDA:
${companyProfile}

---

TESTO DEL BANDO:
${tenderText}

---

Analizza il bando e valuta l'allineamento dell'azienda. Fornisci l'output nel formato richiesto.`;

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
    console.log(`[${new Date().toISOString()}] POST /api/tender-ready - Completato in ${duration}ms`);

    return res.json({
      ok: true,
      data: analysisText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] POST /api/tender-ready - Errore dopo ${duration}ms:`, 
      error instanceof Error ? error.message : "Errore sconosciuto"
    );

    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Errore durante l'elaborazione della richiesta",
    });
  }
});

export default router;
