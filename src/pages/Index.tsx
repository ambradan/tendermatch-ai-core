import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ShieldCheck } from "lucide-react";
import TenderReadyForm from "@/components/TenderReadyForm";
import ComplianceCheckForm from "@/components/ComplianceCheckForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">
            TenderMatch
          </h1>
          <p className="mt-2 text-muted-foreground">
            Analisi AI per bandi di gara e verifica compliance documentale
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="tender-ready" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto mb-8">
            <TabsTrigger value="tender-ready" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tender Ready
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Compliance Check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tender-ready">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold">Analisi Allineamento Bando</h2>
                <p className="mt-2 text-muted-foreground">
                  Verifica quanto la tua azienda è allineata ai requisiti di un bando di gara
                </p>
              </div>
              <TenderReadyForm />
            </div>
          </TabsContent>

          <TabsContent value="compliance">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold">Verifica Compliance Documentale</h2>
                <p className="mt-2 text-muted-foreground">
                  Controlla se i tuoi documenti soddisfano i requisiti del bando
                </p>
              </div>
              <ComplianceCheckForm />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          TenderMatch — Backend AI su Railway • Privacy by Design
        </div>
      </footer>
    </div>
  );
};

export default Index;
