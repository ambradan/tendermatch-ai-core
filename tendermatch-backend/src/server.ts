import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tenderReadyRouter from "./routes/tenderReady";
import aiComplianceRouter from "./routes/aiCompliance";

dotenv.config();

const app = express();

// Porta
const PORT = process.env.PORT || 3000;

// CORS configurazione corretta per Lovable + domini futuri
app.use(
  cors({
    origin: [
      "https://f22ecf68-1ba3-484b-820f-d1e2a44e9548.lovableproject.com", // tuo progetto Lovable
      /\.lovableproject\.com$/,                                         // tutti i sottodomini Lovable
      "https://tendermatch.it",                                         // dominio produzione (futuro)
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Body parser JSON
app.use(express.json({ limit: "10mb" }));

// Healthcheck
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tendermatch-backend",
    timestamp: new Date().toISOString(),
  });
});

// QUI montiamo le route API
app.use("/api/tender-ready", tenderReadyRouter);
app.use("/api/ai-compliance-check", aiComplianceRouter);

// 404 JSON per endpoint inesistenti
app.use((req, res) => {
  console.warn(`404 su ${req.method} ${req.path}`);
  res.status(404).json({
    ok: false,
    error: "Endpoint non trovato",
  });
});

// Avvio server (utile in locale; su Railway viene ignorato ma non dà fastidio)
app.listen(PORT, () => {
  console.log(`TenderMatch backend in ascolto su porta ${PORT}`);
});

export default app;
