import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { IncomeStatementLine, Assumptions } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, Save, RefreshCw, ArrowRight, ArrowDown, AlertTriangle, Globe } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { ImportEdgarModal } from "@/components/import-edgar-modal";

export default function IncomeStatement() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedAssumptions, setEditedAssumptions] = useState<Record<string, string>>({});
  const [showEdgarModal, setShowEdgarModal] = useState(false);

  const { selectedModel: model, isLoading } = useModel();

  const { data: incomeData } = useQuery<IncomeStatementLine[]>({
    queryKey: ["/api/models", model?.id, "income-statement"],
    enabled: !!model,
  });

  const { data: assumptionsData } = useQuery<Assumptions[]>({
    queryKey: ["/api/models", model?.id, "assumptions"],
    enabled: !!model,
  });

  const baseAssumptions = assumptionsData?.find(a => !a.scenarioId);

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedAssumptions).length > 0) {
        await apiRequest("PATCH", `/api/models/${model!.id}/assumptions`, editedAssumptions);
      }
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "assumptions"] });
      setEditMode(false);
      setEditedAssumptions({});
      toast({ title: "Model recalculated", description: "Cost assumptions updated. All downstream statements recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const annualData = incomeData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const allYears = annualData.map(d => d.year);

  const edgarFieldDefs = [
    { key: "totalRevenue", label: "Total Revenue" },
    { key: "cogs", label: "COGS" },
    { key: "grossProfit", label: "Gross Profit" },
    { key: "sgaExpense", label: "SG&A Expense" },
    { key: "rdExpense", label: "R&D Expense" },
    { key: "operatingIncome", label: "Operating Income" },
    { key: "interestExpense", label: "Interest Expense" },
    { key: "otherIncome", label: "Other Income" },
    { key: "taxExpense", label: "Tax Expense" },
    { key: "netIncome", label: "Net Income" },
    { key: "depreciation", label: "Depreciation" },
  ];

  const handleEdgarImport = (data: Record<number, Record<string, number>>) => {
    const bulkPromises: Promise<any>[] = [];
    for (const [yearStr, fields] of Object.entries(data)) {
      const year = parseInt(yearStr);
      const mapped: Record<string, any> = { isActual: true };
      if (fields.totalRevenue !== undefined) mapped.revenue = fields.totalRevenue;
      if (fields.cogs !== undefined) mapped.cogs = Math.abs(fields.cogs);
      if (fields.grossProfit !== undefined) mapped.grossProfit = fields.grossProfit;
      if (fields.sgaExpense !== undefined) mapped.salesMarketing = Math.abs(fields.sgaExpense);
      if (fields.rdExpense !== undefined) mapped.rd = Math.abs(fields.rdExpense);
      if (fields.operatingIncome !== undefined) mapped.operatingIncome = fields.operatingIncome;
      if (fields.interestExpense !== undefined) mapped.interestExpense = Math.abs(fields.interestExpense);
      if (fields.otherIncome !== undefined) mapped.otherIncome = fields.otherIncome;
      if (fields.taxExpense !== undefined) mapped.taxExpense = Math.abs(fields.taxExpense);
      if (fields.netIncome !== undefined) mapped.netIncome = fields.netIncome;
      if (fields.depreciation !== undefined) mapped.depreciation = Math.abs(fields.depreciation);

      bulkPromises.push(
        apiRequest("PATCH", `/api/models/${model!.id}/income-statement/${year}`, mapped)
      );
    }

    Promise.all(bulkPromises)
      .then(() => apiRequest("POST", `/api/models/${model!.id}/recalculate`))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/models"] });
        queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "income-statement"] });
        queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "balance-sheet"] });
        queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "cash-flow"] });
        queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
        queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
        toast({ title: "SEC filing data imported", description: `Imported income statement data for ${Object.keys(data).length} year(s). Model recalculated.` });
      })
      .catch((err: Error) => {
        toast({ title: "Import error", description: err.message, variant: "destructive" });
      });
  };

  const hasNoRevenue = annualData.length === 0 || annualData.every(d => !d.revenue || d.revenue === 0);
  const hasDefaultAssumptions = !baseAssumptions || (
    parseFloat(String(baseAssumptions.cogsPercent || "0")) === 0 &&
    parseFloat(String(baseAssumptions.salesMarketingPercent || "0")) === 0 &&
    parseFloat(String(baseAssumptions.rdPercent || "0")) === 0 &&
    parseFloat(String(baseAssumptions.gaPercent || "0")) === 0 &&
    parseFloat(String(baseAssumptions.depreciationPercent || "0")) === 0 &&
    parseFloat(String(baseAssumptions.taxRate || "0")) === 0
  );
  const hasIncomeWarnings = hasNoRevenue || hasDefaultAssumptions;

  const assumptionFields = [
    { key: "cogsPercent", label: "COGS %", dbKey: "cogsPercent" },
    { key: "salesMarketingPercent", label: "Sales & Marketing %", dbKey: "salesMarketingPercent" },
    { key: "rdPercent", label: "R&D %", dbKey: "rdPercent" },
    { key: "gaPercent", label: "G&A %", dbKey: "gaPercent" },
    { key: "depreciationPercent", label: "Depreciation %", dbKey: "depreciationPercent" },
    { key: "taxRate", label: "Tax Rate", dbKey: "taxRate" },
  ];

  const getAssumptionValue = (key: string): string => {
    if (editedAssumptions[key] !== undefined) return editedAssumptions[key];
    if (baseAssumptions) return (baseAssumptions as any)[key] || "0";
    return "0";
  };

  const rows: Array<{
    label: string; key: keyof IncomeStatementLine;
    percentKey?: keyof IncomeStatementLine; isBold?: boolean; isSubtotal?: boolean;
  }> = [
    { label: "Revenue", key: "revenue", isBold: true },
    { label: "COGS", key: "cogs", percentKey: "cogsPercent" },
    { label: "Gross Profit", key: "grossProfit", isBold: true, isSubtotal: true },
    { label: "Sales & Marketing", key: "salesMarketing", percentKey: "smPercent" },
    { label: "Research & Development", key: "researchDevelopment", percentKey: "rdPercent" },
    { label: "General & Administrative", key: "generalAdmin", percentKey: "gaPercent" },
    { label: "Depreciation", key: "depreciation", percentKey: "depreciationPercent" },
    { label: "Total Expenses", key: "totalExpenses", isBold: true, isSubtotal: true },
    { label: "Operating Income", key: "operatingIncome", isBold: true },
    { label: "EBITDA", key: "ebitda", isBold: true },
    { label: "Other Income", key: "otherIncome" },
    { label: "Pre-Tax Income", key: "preTaxIncome", isBold: true },
    { label: "Income Tax", key: "incomeTax", percentKey: "taxRate" },
    { label: "Net Income", key: "netIncome", isBold: true, isSubtotal: true },
    { label: "EPS", key: "eps" },
    { label: "Non-GAAP EPS", key: "nonGaapEps" },
  ];

  const calcYoY = (data: IncomeStatementLine[], idx: number, key: keyof IncomeStatementLine) => {
    if (idx <= 0) return null;
    const current = (data[idx][key] as number) || 0;
    const prior = (data[idx - 1][key] as number) || 0;
    if (!prior) return null;
    return (current - prior) / Math.abs(prior);
  };

  const marginChartData = annualData.map(d => ({
    year: d.year,
    "Gross Margin": d.revenue ? ((d.grossProfit || 0) / d.revenue) * 100 : 0,
    "Operating Margin": d.revenue ? ((d.operatingIncome || 0) / d.revenue) * 100 : 0,
    "Net Margin": d.revenue ? ((d.netIncome || 0) / d.revenue) * 100 : 0,
    "EBITDA Margin": d.revenue ? ((d.ebitda || 0) / d.revenue) * 100 : 0,
  }));

  const revenueGrowthData = annualData.map((d, i) => ({
    year: d.year,
    "Revenue Growth": calcYoY(annualData, i, "revenue") ? (calcYoY(annualData, i, "revenue")! * 100) : 0,
    "Net Income Growth": calcYoY(annualData, i, "netIncome") ? (calcYoY(annualData, i, "netIncome")! * 100) : 0,
  }));

  const latestData = annualData[annualData.length - 1];
  const latestRevenueGrowth = annualData.length >= 2 ? calcYoY(annualData, annualData.length - 1, "revenue") : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Income Statement</h1>
          <p className="text-sm text-muted-foreground">
            Profit & Loss analysis
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Derived from Revenue
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Button variant="outline" onClick={() => setShowEdgarModal(true)} data-testid="button-import-edgar">
            <Globe className="h-4 w-4 mr-1" /> SEC Filing
          </Button>
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); setEditedAssumptions({}); }} data-testid="button-cancel">Cancel</Button>
              <Button onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} data-testid="button-save-recalculate">
                {recalcMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Recalculating...</> : <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-assumptions">Edit Assumptions</Button>
          )}
        </div>
      </div>

      {hasIncomeWarnings && !editMode && (
        <Card className="border-dashed" data-testid="card-income-warnings">
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              {hasNoRevenue && (
                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500" data-testid="warning-no-revenue">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>No revenue data found. Enter quarterly revenue on the Revenue Forecast page first. The Income Statement derives all values from revenue.</span>
                </div>
              )}
              {hasDefaultAssumptions && !hasNoRevenue && (
                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500" data-testid="warning-default-assumptions">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Cost assumptions appear to be at defaults (all zeros). Click "Edit Assumptions" to set COGS, S&M, R&D, G&A, and Tax Rate percentages so the P&L calculates correctly.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {editMode && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <ArrowRight className="h-4 w-4" /> Cost Assumptions (% of Revenue)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {assumptionFields.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <Input
                    type="text"
                    value={(parseFloat(getAssumptionValue(f.key)) * 100).toFixed(1)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) / 100;
                      if (!isNaN(v)) setEditedAssumptions(prev => ({ ...prev, [f.key]: v.toString() }));
                    }}
                    className="h-8 text-sm"
                    data-testid={`input-assumption-${f.key}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Changes cascade: Revenue x Assumptions = P&L, which feeds Balance Sheet, Cash Flow, DCF, and Valuation.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Revenue <InfoTooltip content="Total top-line revenue for the most recent year. The starting point for all P&L calculations." /></CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.revenue || 0) : "--"}</div>
            {latestRevenueGrowth !== null && <p className="text-xs text-muted-foreground">{formatPercent(latestRevenueGrowth)} YoY</p>}
          </CardContent>
        </Card>
        <Card data-testid="card-gross-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Gross Profit <InfoTooltip content="Revenue minus Cost of Goods Sold (COGS). Gross margin shows how efficiently the company produces goods/services." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.grossProfit || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">{latestData?.revenue ? formatPercent((latestData.grossProfit || 0) / latestData.revenue) : "--"} margin</p>
          </CardContent>
        </Card>
        <Card data-testid="card-operating-income">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Operating Income <InfoTooltip content="Profit after all operating expenses (COGS, S&M, R&D, G&A, Depreciation). Measures core business profitability." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.operatingIncome || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">{latestData?.revenue ? formatPercent((latestData.operatingIncome || 0) / latestData.revenue) : "--"} margin</p>
          </CardContent>
        </Card>
        <Card data-testid="card-net-income">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Net Income <InfoTooltip content="Bottom-line profit after taxes. This drives EPS and is a key input for the PEG valuation method." /></CardTitle>
            {latestData && (latestData.netIncome || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.netIncome || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">{latestData?.revenue ? formatPercent((latestData.netIncome || 0) / latestData.revenue) : "--"} margin</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" data-testid="tabs-income">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="margins" data-testid="tab-margins">Margin Analysis</TabsTrigger>
          <TabsTrigger value="growth" data-testid="tab-growth">Growth Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table data-testid="table-income-statement">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">Line Item</TableHead>
                    {annualData.map(d => <TableHead key={d.year} className="text-right">{d.year}</TableHead>)}
                    <TableHead className="text-right">% of Rev</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.label} className={row.isSubtotal ? "border-t-2" : ""} data-testid={`row-${row.key}`}>
                      <TableCell className={`sticky left-0 bg-card z-10 ${row.isBold ? "font-bold" : "pl-8"}`}>{row.label}</TableCell>
                      {annualData.map(d => (
                        <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""}`}>
                          {row.key === "eps" || row.key === "nonGaapEps"
                            ? `$${((d[row.key] as number) || 0).toFixed(2)}`
                            : formatCurrency((d[row.key] as number) || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground">
                        {row.percentKey && latestData
                          ? formatPercent((latestData[row.percentKey] as number) || 0)
                          : latestData?.revenue && row.key !== "eps" && row.key !== "nonGaapEps" && row.key !== "revenue"
                            ? formatPercent(((latestData[row.key] as number) || 0) / (latestData.revenue || 1))
                            : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margins">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Margin Analysis (%)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={marginChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="Gross Margin" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="EBITDA Margin" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Operating Margin" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Net Margin" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">YoY Growth Rates (%)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="Revenue Growth" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Net Income Growth" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImportEdgarModal
        open={showEdgarModal}
        onOpenChange={setShowEdgarModal}
        statementType="income-statement"
        fieldDefs={edgarFieldDefs}
        years={allYears}
        onImport={handleEdgarImport}
      />
    </div>
  );
}
