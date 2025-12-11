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
app.use(cors({
  origin: [
    "https://f22ecf68-1ba3-484b-820f-d1e2a44e9548.lovableproject.com",  // il tuo frontend Lovable
    /\.lovableproject\.com$/,                                          // tutti i sottodomini Lovable
    "https://tendermatch.it"                                           // futuro dominio di produzione
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10mb" }));

// Healthcheck
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tendermatch-backend",
    timestamp: new Date().toISOString(),
  });
});

// 🔗 QUI montiamo le route API
app.use("/api", tenderReadyRouter);
app.use("/api", aiComplianceRouter);

// 404 JSON per endpoint inesistenti
app.use((req, res) => {
  console.warn(`404 su ${req.method} ${req.path}`);
  res.status(404).json({
    ok: false,
    error: "Endpoint non trovato",
  });
});

// Avvio server
app.listen(PORT, () => {
  console.log(
    `[TenderMatch backend] Server avviato su porta ${PORT} (${process.env.NODE_ENV || "development"})`
  );
});

export default app;
