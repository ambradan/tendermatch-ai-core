import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Building2, Sparkles } from "lucide-react";
import { callTenderReady } from "@/lib/tendermatchApi";

const TenderReadyForm = () => {
  const [companyProfile, setCompanyProfile] = useState("");
  const [tenderText, setTenderText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!companyProfile.trim() || !tenderText.trim()) {
      setError("Inserisci sia il profilo aziendale che il testo del bando.");
      return;
    }

    setError(null);
    setAnalysisResult(null);
    setIsLoading(true);

    try {
      const response = await callTenderReady({
        companyProfile,
        tenderText,
        language: "italiano",
      });

      if (!response.ok) {
        setError(response.error || "Si è verificato un errore durante l'analisi. Riprova.");
      } else if (response.data) {
        setAnalysisResult(response.data);
      }
    } catch (err) {
      console.error("[TenderReady] Errore inatteso:", err);
      setError("Si è verificato un errore inatteso. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Profile Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Profilo Aziendale
            </CardTitle>
            <CardDescription>
              Descrivi la tua azienda: competenze, certificazioni, esperienze pregresse, fatturato, ecc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Es: Siamo una PMI specializzata in sviluppo software con certificazione ISO 9001. Fatturato medio 2M€/anno. Esperienza in progetti PA dal 2015..."
              value={companyProfile}
              onChange={(e) => setCompanyProfile(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        {/* Tender Text Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Testo del Bando
            </CardTitle>
            <CardDescription>
              Incolla il testo completo o un estratto significativo del bando di gara.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Es: Oggetto: Servizi di sviluppo e manutenzione software per il Comune di... Requisiti: fatturato minimo 500.000€, certificazione ISO 27001..."
              value={tenderText}
              onChange={(e) => setTenderText(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Analyze Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || !companyProfile.trim() || !tenderText.trim()}
          size="lg"
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisi in corso...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analizza Allineamento
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Risultato Analisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {analysisResult}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TenderReadyForm;
