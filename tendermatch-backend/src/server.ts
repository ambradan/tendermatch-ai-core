import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tenderReadyRouter from "./routes/tenderReady";
import aiComplianceRouter from "./routes/aiCompliance";

dotenv.config();

const app = express();

// Porta
const PORT = process.env.PORT || 3000;

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn(`Origin non autorizzata: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
} else {
  // Se non è configurato nulla, permetti tutto (utile per test)
  app.use(cors());
}

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
