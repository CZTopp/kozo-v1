import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, GitBranch, Trash2 } from "lucide-react";
import { generateForecast, generateAnnualSummary, formatCurrency } from "@/lib/calculations";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { FinancialModel, Scenario, Assumptions } from "@shared/schema";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, true)}
        </p>
      ))}
    </div>
  );
}

function CreateScenarioDialog({
  open,
  onOpenChange,
  models,
  baseAssumptions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  models: FinancialModel[];
  baseAssumptions: Assumptions[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    modelId: models[0]?.id || "",
    name: "",
    type: "base",
    color: "#3b82f6",
    revenueGrowthRate: "0.15",
    churnRate: "0.05",
    avgRevenuePerUnit: "100",
    initialCustomers: "100",
    cogsPercent: "0.30",
    salesMarketingPercent: "0.20",
    rdPercent: "0.15",
    gaPercent: "0.10",
    taxRate: "0.25",
    initialCash: "100000",
  });

  const scenarioColors: Record<string, string> = {
    base: "#3b82f6",
    optimistic: "#22c55e",
    pessimistic: "#ef4444",
  };

  const handleTypeChange = (type: string) => {
    const base = baseAssumptions.find((a) => a.modelId === form.modelId && !a.scenarioId);
    if (!base) return;

    const multiplier = type === "optimistic" ? 1.3 : type === "pessimistic" ? 0.7 : 1;
    const churnMult = type === "optimistic" ? 0.6 : type === "pessimistic" ? 1.5 : 1;

    setForm({
      ...form,
      type,
      color: scenarioColors[type] || "#3b82f6",
      revenueGrowthRate: String((Number(base.revenueGrowthRate) * multiplier).toFixed(4)),
      churnRate: String((Number(base.churnRate) * churnMult).toFixed(4)),
      avgRevenuePerUnit: base.avgRevenuePerUnit?.toString() || "100",
      initialCustomers: String(base.initialCustomers),
      cogsPercent: base.cogsPercent?.toString() || "0.30",
      salesMarketingPercent: base.salesMarketingPercent?.toString() || "0.20",
      rdPercent: base.rdPercent?.toString() || "0.15",
      gaPercent: base.gaPercent?.toString() || "0.10",
      taxRate: base.taxRate?.toString() || "0.25",
      initialCash: base.initialCash?.toString() || "100000",
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scenarios", {
        modelId: form.modelId,
        name: form.name,
        type: form.type,
        color: form.color,
        assumptions: {
          revenueGrowthRate: form.revenueGrowthRate,
          churnRate: form.churnRate,
          avgRevenuePerUnit: form.avgRevenuePerUnit,
          initialCustomers: parseInt(form.initialCustomers),
          cogsPercent: form.cogsPercent,
          salesMarketingPercent: form.salesMarketingPercent,
          rdPercent: form.rdPercent,
          gaPercent: form.gaPercent,
          taxRate: form.taxRate,
          initialCash: form.initialCash,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assumptions"] });
      onOpenChange(false);
      toast({ title: "Scenario created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scenario</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Model</Label>
              <Select value={form.modelId} onValueChange={(v) => setForm({ ...form, modelId: v })}>
                <SelectTrigger data-testid="select-scenario-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scenario Name</Label>
              <Input data-testid="input-scenario-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bull Case" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => { setForm({ ...form, type: v }); handleTypeChange(v); }}>
                <SelectTrigger data-testid="select-scenario-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base Case</SelectItem>
                  <SelectItem value="optimistic">Optimistic</SelectItem>
                  <SelectItem value="pessimistic">Pessimistic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Scenario Assumptions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "revenueGrowthRate", label: "Revenue Growth" },
                { key: "churnRate", label: "Churn Rate" },
                { key: "avgRevenuePerUnit", label: "ARPU" },
                { key: "initialCustomers", label: "Initial Customers" },
                { key: "cogsPercent", label: "COGS %" },
                { key: "salesMarketingPercent", label: "S&M %" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" step="any" data-testid={`input-scenario-${key}`} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="button-create-scenario" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Scenario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ScenariosPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: models, isLoading: ml } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const { data: scenarios, isLoading: sl } = useQuery<Scenario[]>({ queryKey: ["/api/scenarios"] });
  const { data: allAssumptions, isLoading: al } = useQuery<Assumptions[]>({ queryKey: ["/api/assumptions"] });

  const isLoading = ml || sl || al;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/scenarios/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assumptions"] });
      toast({ title: "Scenario deleted" });
    },
  });

  const activeModel = models?.[0];
  const modelScenarios = scenarios?.filter((s) => s.modelId === activeModel?.id) || [];

  const scenarioForecasts = modelScenarios.map((scenario) => {
    const scAssumption = allAssumptions?.find((a) => a.scenarioId === scenario.id);
    if (!scAssumption || !activeModel) return { scenario, annual: [] as any[], forecast: [] as any[] };
    const fc = generateForecast(scAssumption, activeModel.startYear, activeModel.endYear);
    return { scenario, annual: generateAnnualSummary(fc), forecast: fc };
  });

  const baseAssumption = allAssumptions?.find((a) => a.modelId === activeModel?.id && !a.scenarioId);
  const baseForecast = activeModel && baseAssumption ? generateForecast(baseAssumption, activeModel.startYear, activeModel.endYear) : [];
  const baseAnnual = generateAnnualSummary(baseForecast);

  const comparisonYears = baseAnnual.map((y) => y.year);
  const comparisonData = comparisonYears.map((year) => {
    const row: any = { year: String(year) };
    row["Base Case"] = baseAnnual.find((y) => y.year === year)?.revenue || 0;
    scenarioForecasts.forEach(({ scenario, annual }) => {
      row[scenario.name] = annual.find((y: any) => y.year === year)?.revenue || 0;
    });
    return row;
  });

  const cashComparisonData = comparisonYears.map((year) => {
    const row: any = { year: String(year) };
    row["Base Case"] = baseAnnual.find((y) => y.year === year)?.cashBalance || 0;
    scenarioForecasts.forEach(({ scenario, annual }) => {
      row[scenario.name] = annual.find((y: any) => y.year === year)?.cashBalance || 0;
    });
    return row;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Scenario Planning</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare best, base, and worst case projections</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!models?.length} data-testid="button-new-scenario">
          <Plus className="h-4 w-4 mr-2" />
          New Scenario
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !activeModel ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create a Model First</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              You need at least one financial model before creating scenarios.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {modelScenarios.length > 0 && comparisonData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Revenue Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64" data-testid="chart-scenario-revenue">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="Base Case" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        {modelScenarios.map((s) => (
                          <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Cash Balance Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64" data-testid="chart-scenario-cash">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cashComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="Base Case" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        {modelScenarios.map((s) => (
                          <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {modelScenarios.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Scenario Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Scenario</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="text-right font-semibold">Growth Rate</TableHead>
                        <TableHead className="text-right font-semibold">Churn</TableHead>
                        <TableHead className="text-right font-semibold">End Revenue</TableHead>
                        <TableHead className="text-right font-semibold">End Cash</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scenarioForecasts.map(({ scenario, annual }) => {
                        const scA = allAssumptions?.find((a) => a.scenarioId === scenario.id);
                        const lastYear = annual[annual.length - 1];
                        return (
                          <TableRow key={scenario.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: scenario.color }} />
                                <span className="font-medium">{scenario.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">{scenario.type}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{scA ? `${(Number(scA.revenueGrowthRate) * 100).toFixed(0)}%` : "---"}</TableCell>
                            <TableCell className="text-right">{scA ? `${(Number(scA.churnRate) * 100).toFixed(1)}%` : "---"}</TableCell>
                            <TableCell className="text-right">{lastYear ? formatCurrency(lastYear.revenue, true) : "---"}</TableCell>
                            <TableCell className="text-right">{lastYear ? formatCurrency(lastYear.cashBalance, true) : "---"}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(scenario.id)} data-testid={`button-delete-scenario-${scenario.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {modelScenarios.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Scenarios Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Create optimistic and pessimistic scenarios to compare against your base case.
                </p>
                <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-scenario">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Scenario
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {models && models.length > 0 && allAssumptions && (
        <CreateScenarioDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          models={models}
          baseAssumptions={allAssumptions}
        />
      )}
    </div>
  );
}
