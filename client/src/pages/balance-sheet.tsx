import { useState, useCallback } from "react";
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
import { CheckCircle, AlertCircle, Save, RefreshCw, ArrowDown, ArrowRight, ClipboardPaste, Pencil } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { PasteDataModal } from "@/components/paste-data-modal";

const editableFields: Array<{ key: keyof BalanceSheetLine; label: string; isEditable?: boolean }> = [
  { key: "cash", label: "Cash", isEditable: true },
  { key: "shortTermInvestments", label: "Short-Term Investments", isEditable: true },
  { key: "accountsReceivable", label: "Accounts Receivable", isEditable: true },
  { key: "inventory", label: "Inventory", isEditable: true },
  { key: "equipment", label: "Equipment", isEditable: true },
  { key: "depreciationAccum", label: "Accumulated Depreciation", isEditable: true },
  { key: "capex", label: "CapEx", isEditable: true },
  { key: "accountsPayable", label: "Accounts Payable", isEditable: true },
  { key: "shortTermDebt", label: "Short-Term Debt", isEditable: true },
  { key: "longTermDebt", label: "Long-Term Debt", isEditable: true },
  { key: "retainedEarnings", label: "Retained Earnings", isEditable: true },
  { key: "commonShares", label: "Common Shares", isEditable: true },
];

export default function BalanceSheet() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedAssumptions, setEditedAssumptions] = useState<Record<string, string>>({});
  const [editedCells, setEditedCells] = useState<Record<string, Record<string, number>>>({});
  const [showPasteModal, setShowPasteModal] = useState(false);

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

  const invalidateAll = useCallback(() => {
    if (!model) return;
    queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "income-statement"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "balance-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "cash-flow"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "dcf"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "valuation-comparison"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "assumptions"] });
  }, [model]);

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedAssumptions).length > 0) {
        await apiRequest("PATCH", `/api/models/${model!.id}/assumptions`, editedAssumptions);
      }
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      invalidateAll();
      setEditMode(false);
      setEditedAssumptions({});
      toast({ title: "Model recalculated", description: "Balance sheet assumptions updated. Cash Flow, DCF, and Valuation recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveCellsMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedAssumptions).length > 0) {
        await apiRequest("PATCH", `/api/models/${model!.id}/assumptions`, editedAssumptions);
      }
      const promises: Promise<any>[] = [];
      for (const [yearStr, fields] of Object.entries(editedCells)) {
        const year = parseInt(yearStr);
        promises.push(
          apiRequest("PATCH", `/api/models/${model!.id}/balance-sheet/${year}`, {
            ...fields,
            isActual: true,
          })
        );
      }
      await Promise.all(promises);
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      invalidateAll();
      setEditedCells({});
      setEditedAssumptions({});
      setEditMode(false);
      toast({ title: "Actual data saved", description: "Balance sheet actuals saved. Projected years recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActualMutation = useMutation({
    mutationFn: async ({ year, isActual }: { year: number; isActual: boolean }) => {
      await apiRequest("PATCH", `/api/models/${model!.id}/balance-sheet/${year}`, { isActual });
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Year updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePasteImport = useCallback((data: Record<number, Record<string, number>>) => {
    const bulkPromises: Promise<any>[] = [];
    for (const [yearStr, fields] of Object.entries(data)) {
      const year = parseInt(yearStr);
      const payload: Record<string, any> = { ...fields, isActual: true };
      const ar = fields.accountsReceivable ?? 0;
      const inv = fields.inventory ?? 0;
      const stInv = fields.shortTermInvestments ?? 0;
      const cash = fields.cash ?? 0;
      const totalCA = cash + stInv + ar + inv;
      payload.totalCurrentAssets = totalCA;
      const equip = fields.equipment ?? 0;
      const depAccum = fields.depreciationAccum ?? 0;
      const capex = fields.capex ?? 0;
      const totalLTA = equip - depAccum + capex;
      payload.totalLongTermAssets = totalLTA;
      payload.totalAssets = totalCA + totalLTA;
      const ap = fields.accountsPayable ?? 0;
      const stDebt = fields.shortTermDebt ?? 0;
      const totalCL = ap + stDebt;
      payload.totalCurrentLiabilities = totalCL;
      const ltDebt = fields.longTermDebt ?? 0;
      payload.totalLongTermLiabilities = ltDebt;
      payload.totalLiabilities = totalCL + ltDebt;
      const re = fields.retainedEarnings ?? 0;
      const cs = fields.commonShares ?? 0;
      payload.totalEquity = re + cs;
      payload.totalLiabilitiesAndEquity = payload.totalLiabilities + payload.totalEquity;

      bulkPromises.push(
        apiRequest("PATCH", `/api/models/${model!.id}/balance-sheet/${year}`, payload)
      );
    }

    Promise.all(bulkPromises)
      .then(() => apiRequest("POST", `/api/models/${model!.id}/recalculate`))
      .then(() => {
        invalidateAll();
        toast({ title: "Data imported", description: `Imported actual data for ${Object.keys(data).length} year(s). Model recalculated.` });
      })
      .catch((err: Error) => {
        toast({ title: "Import error", description: err.message, variant: "destructive" });
      });
  }, [model, invalidateAll, toast]);

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

  const getCellValue = (year: number, key: string): number | undefined => {
    return editedCells[year]?.[key];
  };

  const setCellValue = (year: number, key: string, value: number) => {
    setEditedCells(prev => ({
      ...prev,
      [year]: { ...prev[year], [key]: value },
    }));
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
  const isFieldEditable = (key: string) => editableFields.some(f => f.key === key);

  const chartData = annualData.map(d => ({
    year: d.year,
    "Current Assets": (d.totalCurrentAssets || 0) / 1e6,
    "Long-Term Assets": (d.totalLongTermAssets || 0) / 1e6,
    "Current Liabilities": (d.totalCurrentLiabilities || 0) / 1e6,
    "Long-Term Liabilities": (d.totalLongTermLiabilities || 0) / 1e6,
    "Equity": (d.totalEquity || 0) / 1e6,
  }));

  const hasEdits = Object.keys(editedCells).length > 0 || Object.keys(editedAssumptions).length > 0;

  const pasteFieldDefs = editableFields.map(f => ({ key: f.key as string, label: f.label }));
  const allYears = annualData.map(d => d.year);

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
              <Button variant="outline" onClick={() => { setEditMode(false); setEditedAssumptions({}); setEditedCells({}); }} data-testid="button-cancel">Cancel</Button>
              <Button variant="outline" onClick={() => setShowPasteModal(true)} data-testid="button-paste-data">
                <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Data
              </Button>
              <Button
                onClick={() => {
                  if (Object.keys(editedCells).length > 0) {
                    saveCellsMutation.mutate();
                  } else {
                    recalcMutation.mutate();
                  }
                }}
                disabled={!hasEdits || saveCellsMutation.isPending || recalcMutation.isPending}
                data-testid="button-save-recalculate"
              >
                {(saveCellsMutation.isPending || recalcMutation.isPending) ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-assumptions">
              <Pencil className="h-4 w-4 mr-1" /> Edit / Enter Actuals
            </Button>
          )}
        </div>
      </div>

      {editMode && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <ArrowRight className="h-4 w-4" /> Working Capital & CapEx Assumptions (for projected years)
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
                    data-testid={`input-assumption-${f.key}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These assumptions drive projected years. Actual year data (marked below) is preserved as-is during recalculation.
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
            <CardContent className="pt-6 overflow-x-auto">
              <Table data-testid="table-balance-sheet">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Line Item</TableHead>
                    {annualData.map(d => (
                      <TableHead key={d.year} className="text-right min-w-[120px]">
                        <div className="flex flex-col items-end gap-1">
                          <span>{d.year}</span>
                          {editMode ? (
                            <Badge
                              variant={d.isActual ? "default" : "outline"}
                              className="text-[10px] cursor-pointer"
                              onClick={() => toggleActualMutation.mutate({ year: d.year, isActual: !d.isActual })}
                              data-testid={`badge-actual-${d.year}`}
                            >
                              {d.isActual ? "Actual" : "Projected"}
                            </Badge>
                          ) : (
                            d.isActual && <Badge variant="default" className="text-[10px]">Actual</Badge>
                          )}
                        </div>
                      </TableHead>
                    ))}
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
                    const canEdit = isFieldEditable(row.key);
                    return (
                      <TableRow key={`${row.key}-${idx}`} className={row.isSubtotal ? "border-t-2" : ""} data-testid={`row-${row.key}`}>
                        <TableCell className={row.isBold ? "font-bold" : "pl-8"}>{row.label}</TableCell>
                        {annualData.map(d => {
                          const isActual = d.isActual;
                          const canEditCell = editMode && canEdit && isActual;
                          const editedVal = getCellValue(d.year, row.key);
                          const dbVal = (d[row.key] as number) || 0;
                          const displayVal = editedVal !== undefined ? editedVal : dbVal;

                          if (canEditCell) {
                            return (
                              <TableCell key={d.year} className="text-right p-1">
                                <Input
                                  type="number"
                                  value={editedVal !== undefined ? editedVal : dbVal}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v)) setCellValue(d.year, row.key, v);
                                  }}
                                  className="text-right font-mono text-sm w-full"
                                  data-testid={`input-${row.key}-${d.year}`}
                                />
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""} ${isActual ? "bg-muted/20" : ""}`}>
                              {formatCurrency(displayVal)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 bg-muted/30">
                    <TableCell className="font-bold">Total L+E</TableCell>
                    {annualData.map(d => (
                      <TableCell key={d.year} className="text-right font-bold">
                        {formatCurrency(d.totalLiabilitiesAndEquity || 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-bold">Balance Check (A - L&E)</TableCell>
                    {annualData.map(d => {
                      const diff = (d.totalAssets || 0) - (d.totalLiabilitiesAndEquity || 0);
                      const ok = Math.abs(diff) < 100;
                      return (
                        <TableCell key={d.year} className={`text-right font-bold ${ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(diff)} {ok ? "\u2713" : "\u2717"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
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

      <PasteDataModal
        open={showPasteModal}
        onOpenChange={setShowPasteModal}
        fieldDefs={pasteFieldDefs}
        years={allYears}
        onImport={handlePasteImport}
        title="Paste Balance Sheet Data"
        description="Import actual balance sheet data from SEC EDGAR filings, Excel, or Google Sheets. Matched years will be marked as Actual."
      />
    </div>
  );
}
