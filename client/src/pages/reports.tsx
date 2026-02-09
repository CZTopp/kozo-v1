import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, Trash2, Download, Share2, Calendar } from "lucide-react";
import { generateForecast, generateAnnualSummary, formatCurrency, formatNumber } from "@/lib/calculations";
import type { FinancialModel, Assumptions, Scenario, Report } from "@shared/schema";

function CreateReportDialog({
  open,
  onOpenChange,
  model,
  assumptions,
  scenarios,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  model: FinancialModel;
  assumptions: Assumptions;
  scenarios: { scenario: Scenario; assumptions: Assumptions }[];
}) {
  const { toast } = useToast();
  const [name, setName] = useState(`${model.name} - Report ${new Date().toLocaleDateString()}`);

  const createMutation = useMutation({
    mutationFn: async () => {
      const forecast = generateForecast(assumptions, model.startYear, model.endYear);
      const annual = generateAnnualSummary(forecast);

      const scenarioSummaries = scenarios.map(({ scenario, assumptions: scA }) => {
        const fc = generateForecast(scA, model.startYear, model.endYear);
        const ann = generateAnnualSummary(fc);
        return {
          name: scenario.name,
          type: scenario.type,
          color: scenario.color,
          annualSummary: ann,
        };
      });

      const snapshotData = {
        model: { name: model.name, startYear: model.startYear, endYear: model.endYear },
        assumptions: {
          revenueGrowthRate: Number(assumptions.revenueGrowthRate),
          churnRate: Number(assumptions.churnRate),
          avgRevenuePerUnit: Number(assumptions.avgRevenuePerUnit),
          initialCustomers: assumptions.initialCustomers,
          grossMargin: 1 - Number(assumptions.cogsPercent),
          initialCash: Number(assumptions.initialCash),
        },
        annualSummary: annual,
        scenarios: scenarioSummaries,
        generatedAt: new Date().toISOString(),
      };

      const res = await apiRequest("POST", "/api/reports", {
        modelId: model.id,
        name,
        snapshotData,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      onOpenChange(false);
      toast({ title: "Report generated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Report Name</Label>
            <Input data-testid="input-report-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">
            This will capture a snapshot of your current model, assumptions, and scenarios for sharing.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="button-generate-report" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportCard({ report, onDelete }: { report: Report; onDelete: () => void }) {
  const snapshot = report.snapshotData as any;

  const handleExport = () => {
    const dataStr = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/reports/${report.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <Card data-testid={`card-report-${report.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{report.name}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              <Calendar className="h-3 w-3 mr-1" />
              {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "---"}
            </Badge>
            {snapshot?.model && (
              <Badge variant="outline">{snapshot.model.startYear}-{snapshot.model.endYear}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={handleExport} data-testid={`button-export-report-${report.id}`}>
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCopyLink} data-testid={`button-share-report-${report.id}`}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-report-${report.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {snapshot?.annualSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(() => {
              const lastYear = snapshot.annualSummary[snapshot.annualSummary.length - 1];
              const totalRevenue = snapshot.annualSummary.reduce((s: number, y: any) => s + y.revenue, 0);
              return [
                { label: "Total Revenue", value: formatCurrency(totalRevenue, true) },
                { label: "End Year Revenue", value: formatCurrency(lastYear?.revenue || 0, true) },
                { label: "End Cash", value: formatCurrency(lastYear?.cashBalance || 0, true) },
                { label: "Scenarios", value: String(snapshot.scenarios?.length || 0) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ));
            })()}
          </div>
        )}
        {snapshot?.assumptions && (
          <div className="mt-3 pt-3 border-t flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            <span>Growth: {(snapshot.assumptions.revenueGrowthRate * 100).toFixed(0)}%</span>
            <span>Churn: {(snapshot.assumptions.churnRate * 100).toFixed(1)}%</span>
            <span>Gross Margin: {(snapshot.assumptions.grossMargin * 100).toFixed(0)}%</span>
            <span>ARPU: {formatCurrency(snapshot.assumptions.avgRevenuePerUnit)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: models, isLoading: ml } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const { data: allAssumptions } = useQuery<Assumptions[]>({ queryKey: ["/api/assumptions"] });
  const { data: allScenarios } = useQuery<Scenario[]>({ queryKey: ["/api/scenarios"] });
  const { data: reports, isLoading: rl } = useQuery<Report[]>({ queryKey: ["/api/reports"] });

  const isLoading = ml || rl;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/reports/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report deleted" });
    },
  });

  const activeModel = models?.[0];
  const baseAssumption = allAssumptions?.find((a) => a.modelId === activeModel?.id && !a.scenarioId);
  const modelScenarios = allScenarios?.filter((s) => s.modelId === activeModel?.id) || [];
  const scenariosWithAssumptions = modelScenarios.map((s) => ({
    scenario: s,
    assumptions: allAssumptions?.find((a) => a.scenarioId === s.id)!,
  })).filter((s) => s.assumptions);

  const modelReports = reports?.filter((r) => r.modelId === activeModel?.id) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and share financial snapshots</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!activeModel || !baseAssumption} data-testid="button-new-report">
          <Plus className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !activeModel ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create a Model First</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Build a financial model, then generate shareable reports.
            </p>
          </CardContent>
        </Card>
      ) : modelReports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Generate a snapshot report to share with investors or advisors.
            </p>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-report">
              <Plus className="h-4 w-4 mr-2" />
              Generate First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modelReports.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((report) => (
            <ReportCard key={report.id} report={report} onDelete={() => deleteMutation.mutate(report.id)} />
          ))}
        </div>
      )}

      {activeModel && baseAssumption && (
        <CreateReportDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          model={activeModel}
          assumptions={baseAssumption}
          scenarios={scenariosWithAssumptions}
        />
      )}
    </div>
  );
}
