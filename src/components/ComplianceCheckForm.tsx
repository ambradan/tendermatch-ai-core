import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileCheck, Plus, Trash2, ShieldCheck } from "lucide-react";
import { callAiComplianceCheck, type ComplianceDocument } from "@/lib/tendermatchApi";

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
  summary: string;
}

const ComplianceCheckForm = () => {
  const [tenderId, setTenderId] = useState("");
  const [documents, setDocuments] = useState<DocumentEntry[]>([
    { id: crypto.randomUUID(), name: "", type: "", summary: "" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complianceResult, setComplianceResult] = useState<string | null>(null);

  const addDocument = () => {
    setDocuments([
      ...documents,
      { id: crypto.randomUUID(), name: "", type: "", summary: "" },
    ]);
  };

  const removeDocument = (id: string) => {
    if (documents.length > 1) {
      setDocuments(documents.filter((doc) => doc.id !== id));
    }
  };

  const updateDocument = (id: string, field: keyof DocumentEntry, value: string) => {
    setDocuments(
      documents.map((doc) =>
        doc.id === id ? { ...doc, [field]: value } : doc
      )
    );
  };

  const handleComplianceCheck = async () => {
    // Validate inputs
    const validDocuments = documents.filter(
      (doc) => doc.name.trim() && doc.summary.trim()
    );

    if (validDocuments.length === 0) {
      setError("Inserisci almeno un documento con nome e sommario.");
      return;
    }

    const effectiveTenderId = tenderId.trim() || "BANDO-GENERICO";

    setError(null);
    setComplianceResult(null);
    setIsLoading(true);

    try {
      const payload: { tenderId: string; documents: ComplianceDocument[]; language: string } = {
        tenderId: effectiveTenderId,
        documents: validDocuments.map((doc) => ({
          name: doc.name,
          type: doc.type || "documento",
          summary: doc.summary,
        })),
        language: "italiano",
      };

      const response = await callAiComplianceCheck(payload);

      if (!response.ok) {
        setError(response.error || "Si è verificato un errore durante la verifica. Riprova.");
      } else if (response.data) {
        setComplianceResult(response.data);
      }
    } catch (err) {
      console.error("[ComplianceCheck] Errore inatteso:", err);
      setError("Si è verificato un errore inatteso. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tender ID */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Identificativo Bando
          </CardTitle>
          <CardDescription>
            Inserisci un codice o identificativo del bando (opzionale)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Es: GARA-2024-001, CIG: 123456789"
            value={tenderId}
            onChange={(e) => setTenderId(e.target.value)}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Documenti da Verificare
          </CardTitle>
          <CardDescription>
            Aggiungi i documenti aziendali da verificare per la compliance al bando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.map((doc, index) => (
            <div
              key={doc.id}
              className="rounded-lg border bg-muted/30 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Documento {index + 1}
                </span>
                {documents.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Nome documento (es: Certificazione ISO 9001)"
                  value={doc.name}
                  onChange={(e) => updateDocument(doc.id, "name", e.target.value)}
                  disabled={isLoading}
                />
                <Input
                  placeholder="Tipo (es: certificazione, bilancio, contratto)"
                  value={doc.type}
                  onChange={(e) => updateDocument(doc.id, "type", e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Textarea
                placeholder="Sommario del contenuto del documento..."
                value={doc.summary}
                onChange={(e) => updateDocument(doc.id, "summary", e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isLoading}
              />
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addDocument}
            disabled={isLoading}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Documento
          </Button>
        </CardContent>
      </Card>

      {/* Check Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleComplianceCheck}
          disabled={isLoading || documents.every((d) => !d.name.trim() || !d.summary.trim())}
          size="lg"
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifica in corso...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verifica Compliance
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

      {/* Compliance Result */}
      {complianceResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Risultato Verifica Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {complianceResult}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComplianceCheckForm;
