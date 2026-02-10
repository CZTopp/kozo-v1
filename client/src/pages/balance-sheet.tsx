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
import type { BalanceSheetLine, Assumptions } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CheckCircle, AlertCircle, Save, RefreshCw, ArrowDown, ArrowRight } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";

export default function BalanceSheet() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedAssumptions, setEditedAssumptions] = useState<Record<string, string>>({});

  const { selectedModel: model, isLoading } = useModel();

  const { data: bsData } = useQuery<BalanceSheetLine[]>({
    queryKey: ["/api/models", model?.id, "balance-sheet"],
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
      toast({ title: "Model recalculated", description: "Balance sheet assumptions updated. Cash Flow, DCF, and Valuation recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const annualData = bsData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];
  const latestData = annualData[annualData.length - 1];
  const isBalanced = latestData
    ? Math.abs((latestData.totalAssets || 0) - (latestData.totalLiabilitiesAndEquity || 0)) < 100
    : false;

  const bsAssumptionFields = [
    { key: "arPercent", label: "A/R % of Revenue" },
    { key: "apPercent", label: "A/P % of Revenue" },
    { key: "capexPercent", label: "CapEx % of Revenue" },
  ];

  const getAssumptionValue = (key: string): string => {
    if (editedAssumptions[key] !== undefined) return editedAssumptions[key];
    if (baseAssumptions) return (baseAssumptions as any)[key] || "0";
    return "0";
  };

  const assetRows: Array<{ label: string; key: keyof BalanceSheetLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "ASSETS", key: "totalAssets", isSection: true },
    { label: "Cash", key: "cash" },
    { label: "Short-Term Investments", key: "shortTermInvestments" },
    { label: "Accounts Receivable", key: "accountsReceivable" },
    { label: "Inventory", key: "inventory" },
    { label: "Total Current Assets", key: "totalCurrentAssets", isBold: true, isSubtotal: true },
    { label: "Equipment", key: "equipment" },
    { label: "Accumulated Depreciation", key: "depreciationAccum" },
    { label: "CapEx", key: "capex" },
    { label: "Total Long-Term Assets", key: "totalLongTermAssets", isBold: true, isSubtotal: true },
    { label: "Total Assets", key: "totalAssets", isBold: true, isSubtotal: true },
  ];

  const liabilityRows: Array<{ label: string; key: keyof BalanceSheetLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "LIABILITIES", key: "totalLiabilities", isSection: true },
    { label: "Accounts Payable", key: "accountsPayable" },
    { label: "Short-Term Debt", key: "shortTermDebt" },
    { label: "Total Current Liabilities", key: "totalCurrentLiabilities", isBold: true, isSubtotal: true },
    { label: "Long-Term Debt", key: "longTermDebt" },
    { label: "Total Long-Term Liabilities", key: "totalLongTermLiabilities", isBold: true, isSubtotal: true },
    { label: "Total Liabilities", key: "totalLiabilities", isBold: true, isSubtotal: true },
  ];

  const equityRows: Array<{ label: string; key: keyof BalanceSheetLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "EQUITY", key: "totalEquity", isSection: true },
    { label: "Retained Earnings", key: "retainedEarnings" },
    { label: "Common Shares", key: "commonShares" },
    { label: "Total Equity", key: "totalEquity", isBold: true, isSubtotal: true },
  ];

  const allRows = [...assetRows, ...liabilityRows, ...equityRows];

  const chartData = annualData.map(d => ({
    year: d.year,
    "Current Assets": (d.totalCurrentAssets || 0) / 1e6,
    "Long-Term Assets": (d.totalLongTermAssets || 0) / 1e6,
    "Current Liabilities": (d.totalCurrentLiabilities || 0) / 1e6,
    "Long-Term Liabilities": (d.totalLongTermLiabilities || 0) / 1e6,
    "Equity": (d.totalEquity || 0) / 1e6,
  }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">
            Assets, Liabilities & Equity
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Derived from Revenue & Income Statement
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Badge variant={isBalanced ? "default" : "destructive"} data-testid="badge-balanced">
            {isBalanced ? (
              <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Balanced</span>
            ) : (
              <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Imbalanced</span>
            )}
          </Badge>
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

      {editMode && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <ArrowRight className="h-4 w-4" /> Working Capital & CapEx Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {bsAssumptionFields.map(f => (
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
              Changes cascade: A/R, A/P, and CapEx drive working capital and Cash Flow, which feeds DCF and Valuation.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-total-assets">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Total Assets <InfoTooltip content="Sum of all current and long-term assets. Includes cash, receivables, inventory, equipment, and investments." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-assets">{latestData ? formatCurrency(latestData.totalAssets || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-liabilities">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Total Liabilities <InfoTooltip content="Sum of all current and long-term obligations. Includes payables, short-term and long-term debt." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-liabilities">{latestData ? formatCurrency(latestData.totalLiabilities || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-equity">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Total Equity <InfoTooltip content="Assets minus Liabilities. Represents shareholder ownership value including retained earnings and common shares." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-equity">{latestData ? formatCurrency(latestData.totalEquity || 0) : "--"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" data-testid="tabs-balance-sheet">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="chart" data-testid="tab-chart">Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table data-testid="table-balance-sheet">
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item</TableHead>
                    {annualData.map(d => <TableHead key={d.year} className="text-right">{d.year}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.map((row, idx) => {
                    if (row.isSection) {
                      return (
                        <TableRow key={`section-${row.label}-${idx}`} className="bg-muted/50">
                          <TableCell colSpan={annualData.length + 1} className="font-bold text-sm">{row.label}</TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={`${row.key}-${idx}`} className={row.isSubtotal ? "border-t-2" : ""} data-testid={`row-${row.key}`}>
                        <TableCell className={row.isBold ? "font-bold" : "pl-8"}>{row.label}</TableCell>
                        {annualData.map(d => (
                          <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""}`}>
                            {formatCurrency((d[row.key] as number) || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="chart">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Assets vs Liabilities & Equity ($M)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                    <Legend />
                    <Bar dataKey="Current Assets" stackId="assets" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="Long-Term Assets" stackId="assets" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="Current Liabilities" stackId="liabilities" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="Long-Term Liabilities" stackId="liabilities" fill="hsl(var(--chart-4))" />
                    <Bar dataKey="Equity" stackId="liabilities" fill="hsl(var(--chart-5))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
