// tendermatch-backend/src/server.ts

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import tenderReadyRouter from "./routes/tenderReady";
import aiComplianceRouter from "./routes/aiCompliance";

// Carica le variabili d'ambiente (.env)
dotenv.config();

// Inizializza Express
const app = express();

// Porta di ascolto (Railway userà process.env.PORT)
const PORT = process.env.PORT || 3000;

/**
 * CORS – configurazione PERMANENTE per:
 * - il progetto Lovable attuale
 * - tutti i sottodomini *.lovableproject.com
 * - il futuro dominio tendermatch.it
 */
app.use(
  cors({
    origin: [
      "https://f22ecf68-1ba3-484b-820f-d1e2a44e9548.lovableproject.com",
      "https://tendermatch.it",
      /\.lovableproject\.com$/, // qualunque sottodominio Lovable
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // nessun cookie/sessione da condividere
  })
);

// Parser JSON per le richieste in ingresso
app.use(express.json({ limit: "10mb" }));

// Endpoint di healthcheck (per Railway e test veloci)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tendermatch-backend",
    timestamp: new Date().toISOString(),
  });
});

// 🔗 Montiamo le route API vere e proprie
// /api/tender-ready  → router di analisi bando
app.use("/api/tender-ready", tenderReadyRouter);

// /api/ai-compliance-check → router di AI Compliance
app.use("/api/ai-compliance-check", aiComplianceRouter);

// 404 JSON per tutte le altre route non esistenti
app.use((req, res) => {
  console.warn(`404 su ${req.method} ${req.path}`);
  res.status(404).json({
    ok: false,
    error: "Endpoint non trovato",
  });
});

// Avvia il server (utile in locale; su Railway viene usato PORT)
app.listen(PORT, () => {
  console.log(`TenderMatch backend in ascolto sulla porta ${PORT}`);
});

export default app;
