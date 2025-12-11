import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import tenderReadyRouter from "./routes/tenderReady";
import aiComplianceRouter from "./routes/aiCompliance";

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione CORS
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permetti richieste senza origin (es. curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`[CORS] Origine bloccata: ${origin}`);
      return callback(new Error("Non autorizzato da CORS policy"), false);
    },
    credentials: true,
  })
);

// Parser JSON con limite 10MB per documenti corposi
app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tendermatch-backend",
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use("/api", tenderReadyRouter);
app.use("/api", aiComplianceRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint non trovato",
  });
});

// Error handler globale
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${new Date().toISOString()}] Errore non gestito:`, err.message);
  res.status(500).json({
    ok: false,
    error: "Errore interno del server",
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 TenderMatch Backend avviato                          ║
║                                                           ║
║   Porta: ${String(PORT).padEnd(47)}║
║   Ambiente: ${(process.env.NODE_ENV || "development").padEnd(44)}║
║   CORS Origins: ${allowedOrigins.length} configurati${" ".repeat(32)}║
║                                                           ║
║   Endpoints disponibili:                                  ║
║   • GET  /health                                          ║
║   • POST /api/tender-ready                                ║
║   • POST /api/ai-compliance-check                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
