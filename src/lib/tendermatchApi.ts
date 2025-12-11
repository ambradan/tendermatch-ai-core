/**
 * TenderMatch API Client
 * Centralized HTTP client for Railway-hosted backend
 * Backend URL: https://tendermatch-ai-core-production.up.railway.app
 */

const TM_API_BASE_URL = "https://tendermatch-ai-core-production.up.railway.app";

// ==================== TYPES ====================

export type TenderReadyRequest = {
  companyProfile: string;
  tenderText: string;
  language?: string;
};

export type TenderReadyResponse = {
  ok: boolean;
  data?: string;
  error?: string;
};

export type ComplianceDocument = {
  name: string;
  type: string;
  summary: string;
};

export type AiComplianceRequest = {
  tenderId: string;
  documents: ComplianceDocument[];
  language?: string;
};

export type AiComplianceResponse = {
  ok: boolean;
  data?: string;
  error?: string;
};

// ==================== API FUNCTIONS ====================

/**
 * Calls the /api/tender-ready endpoint to analyze alignment between
 * a company profile and a tender text.
 */
export async function callTenderReady(
  payload: TenderReadyRequest
): Promise<TenderReadyResponse> {
  try {
    const response = await fetch(`${TM_API_BASE_URL}/api/tender-ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TenderMatch API] Errore HTTP ${response.status} su /api/tender-ready:`,
        errorText
      );
      return {
        ok: false,
        error: `Errore HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      ok: data.ok ?? true,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error("[TenderMatch API] Errore di rete su /api/tender-ready:", error);
    return {
      ok: false,
      error: "Errore di connessione al server. Verifica la tua connessione.",
    };
  }
}

/**
 * Calls the /api/ai-compliance-check endpoint to verify document compliance
 * against a tender.
 */
export async function callAiComplianceCheck(
  payload: AiComplianceRequest
): Promise<AiComplianceResponse> {
  try {
    const response = await fetch(`${TM_API_BASE_URL}/api/ai-compliance-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TenderMatch API] Errore HTTP ${response.status} su /api/ai-compliance-check:`,
        errorText
      );
      return {
        ok: false,
        error: `Errore HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      ok: data.ok ?? true,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error("[TenderMatch API] Errore di rete su /api/ai-compliance-check:", error);
    return {
      ok: false,
      error: "Errore di connessione al server. Verifica la tua connessione.",
    };
  }
}
