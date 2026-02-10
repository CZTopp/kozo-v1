import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CashFlowLine } from "@shared/schema";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ArrowDown, Save, RefreshCw, ClipboardPaste, Pencil } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { PasteDataModal } from "@/components/paste-data-modal";

const editableFields: Array<{ key: keyof CashFlowLine; label: string }> = [
  { key: "netIncome", label: "Net Income" },
  { key: "depreciationAdd", label: "Depreciation" },
  { key: "arChange", label: "A/R Change" },
  { key: "inventoryChange", label: "Inventory Change" },
  { key: "apChange", label: "A/P Change" },
  { key: "operatingCashFlow", label: "Operating Cash Flow" },
  { key: "capex", label: "CapEx" },
  { key: "investingCashFlow", label: "Investing Cash Flow" },
  { key: "shortTermDebtChange", label: "ST Debt Change" },
  { key: "longTermDebtChange", label: "LT Debt Change" },
  { key: "commonSharesChange", label: "Common Shares Change" },
  { key: "financingCashFlow", label: "Financing Cash Flow" },
  { key: "netCashChange", label: "Net Cash Change" },
  { key: "beginningCash", label: "Beginning Cash" },
  { key: "endingCash", label: "Ending Cash" },
  { key: "freeCashFlow", label: "Free Cash Flow" },
];

const editableKeySet = new Set(editableFields.map(f => f.key));

export default function CashFlow() {
  const { toast } = useToast();
  const { selectedModel: model, isLoading } = useModel();
  const [editMode, setEditMode] = useState(false);
  const [editedCells, setEditedCells] = useState<Record<string, Record<string, number>>>({});
  const [showPasteModal, setShowPasteModal] = useState(false);

  const { data: cfData } = useQuery<CashFlowLine[]>({
    queryKey: ["/api/models", model?.id, "cash-flow"],
    enabled: !!model,
  });

  const invalidateAll = useCallback(() => {
    if (!model) return;
    queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "income-statement"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "balance-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "cash-flow"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "dcf"] });
    queryClient.invalidateQueries({ queryKey: ["/api/models", model.id, "valuation-comparison"] });
  }, [model]);

  const saveCellsMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = [];
      for (const [yearStr, fields] of Object.entries(editedCells)) {
        const year = parseInt(yearStr);
        promises.push(
          apiRequest("PATCH", `/api/models/${model!.id}/cash-flow/${year}`, {
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
      setEditMode(false);
      toast({ title: "Actual data saved", description: "Cash flow actuals saved. Projected years recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActualMutation = useMutation({
    mutationFn: async ({ year, isActual }: { year: number; isActual: boolean }) => {
      await apiRequest("PATCH", `/api/models/${model!.id}/cash-flow/${year}`, { isActual });
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
      bulkPromises.push(
        apiRequest("PATCH", `/api/models/${model!.id}/cash-flow/${year}`, {
          ...fields,
          isActual: true,
        })
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

  const annualData = cfData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const operatingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "OPERATING ACTIVITIES", key: "operatingCashFlow", isSection: true },
    { label: "Net Income", key: "netIncome" },
    { label: "+ Depreciation", key: "depreciationAdd" },
    { label: "- A/R Change", key: "arChange" },
    { label: "- Inventory Change", key: "inventoryChange" },
    { label: "+ A/P Change", key: "apChange" },
    { label: "Operating Cash Flow", key: "operatingCashFlow", isBold: true, isSubtotal: true },
  ];

  const investingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "INVESTING ACTIVITIES", key: "investingCashFlow", isSection: true },
    { label: "CapEx", key: "capex" },
    { label: "Investing Cash Flow", key: "investingCashFlow", isBold: true, isSubtotal: true },
  ];

  const financingRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isSection?: boolean }> = [
    { label: "FINANCING ACTIVITIES", key: "financingCashFlow", isSection: true },
    { label: "ST Debt Change", key: "shortTermDebtChange" },
    { label: "LT Debt Change", key: "longTermDebtChange" },
    { label: "Common Shares Change", key: "commonSharesChange" },
    { label: "Financing Cash Flow", key: "financingCashFlow", isBold: true, isSubtotal: true },
  ];

  const summaryRows: Array<{ label: string; key: keyof CashFlowLine; isBold?: boolean; isSubtotal?: boolean; isHighlight?: boolean }> = [
    { label: "Net Cash Change", key: "netCashChange", isBold: true, isSubtotal: true },
    { label: "Beginning Cash", key: "beginningCash" },
    { label: "Ending Cash", key: "endingCash", isBold: true },
    { label: "Free Cash Flow", key: "freeCashFlow", isBold: true, isHighlight: true },
  ];

  const allRows = [...operatingRows, ...investingRows, ...financingRows, ...summaryRows];
  const latestData = annualData[annualData.length - 1];

  const fcfChartData = annualData.map(d => ({
    year: d.year,
    "Operating CF": (d.operatingCashFlow || 0) / 1e6,
    "Investing CF": (d.investingCashFlow || 0) / 1e6,
    "Financing CF": (d.financingCashFlow || 0) / 1e6,
    "Free Cash Flow": (d.freeCashFlow || 0) / 1e6,
  }));

  const getCellValue = (year: number, key: string): number | undefined => {
    return editedCells[year]?.[key];
  };

  const setCellValue = (year: number, key: string, value: number) => {
    setEditedCells(prev => ({
      ...prev,
      [year]: { ...prev[year], [key]: value },
    }));
  };

  const hasEdits = Object.keys(editedCells).length > 0;
  const allYears = annualData.map(d => d.year);
  const pasteFieldDefs = editableFields.map(f => ({ key: f.key as string, label: f.label }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Cash Flow Statement</h1>
          <p className="text-sm text-muted-foreground">
            Operating, investing, and financing activities
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Auto-derived from Income Statement & Balance Sheet
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); setEditedCells({}); }} data-testid="button-cancel">Cancel</Button>
              <Button variant="outline" onClick={() => setShowPasteModal(true)} data-testid="button-paste-data">
                <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Data
              </Button>
              <Button
                onClick={() => saveCellsMutation.mutate()}
                disabled={!hasEdits || saveCellsMutation.isPending}
                data-testid="button-save-recalculate"
              >
                {saveCellsMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-actuals">
              <Pencil className="h-4 w-4 mr-1" /> Edit / Enter Actuals
            </Button>
          )}
        </div>
      </div>

      {!editMode && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDown className="h-4 w-4 flex-shrink-0" />
              <span>Projected years are auto-calculated from Income Statement & Balance Sheet. Click "Edit / Enter Actuals" to enter historical data from SEC filings.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card data-testid="card-operating-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Operating CF <InfoTooltip content="Cash generated from core business operations. Starts with Net Income and adjusts for non-cash items and working capital changes." /></CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.operatingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-investing-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Investing CF <InfoTooltip content="Cash used for capital expenditures and investments. Typically negative as the company invests in growth." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.investingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-financing-cf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Financing CF <InfoTooltip content="Cash from debt issuance/repayment and equity transactions." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestData ? formatCurrency(latestData.financingCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-fcf">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Free Cash Flow <InfoTooltip content="Operating Cash Flow minus CapEx. Key input for DCF valuation." /></CardTitle>
            {latestData && (latestData.freeCashFlow || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fcf">{latestData ? formatCurrency(latestData.freeCashFlow || 0) : "--"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" data-testid="tabs-cash-flow">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="chart" data-testid="tab-chart">FCF Trend</TabsTrigger>
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table data-testid="table-cash-flow">
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
                    if ("isSection" in row && row.isSection) {
                      return (
                        <TableRow key={`section-${row.label}-${idx}`} className="bg-muted/50">
                          <TableCell colSpan={annualData.length + 1} className="font-bold text-sm">{row.label}</TableCell>
                        </TableRow>
                      );
                    }
                    const isHighlight = "isHighlight" in row && row.isHighlight;
                    const canEdit = editableKeySet.has(row.key);

                    return (
                      <TableRow key={`${row.key}-${idx}`} className={`${row.isSubtotal ? "border-t-2" : ""} ${isHighlight ? "bg-muted/30" : ""}`} data-testid={`row-${row.key}`}>
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
                            <TableCell key={d.year} className={`text-right ${row.isBold ? "font-bold" : ""} ${isHighlight ? "text-green-600 dark:text-green-400 font-bold" : ""} ${isActual ? "bg-muted/20" : ""}`}>
                              {formatCurrency(displayVal)}
                            </TableCell>
                          );
                        })}
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
            <CardHeader><CardTitle className="text-sm font-medium">Free Cash Flow Trend ($M)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fcfChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                    <Legend />
                    <Line type="monotone" dataKey="Free Cash Flow" stroke="hsl(var(--chart-1))" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Cash Flow Breakdown ($M)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fcfChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                    <Legend />
                    <Bar dataKey="Operating CF" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Investing CF" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Financing CF" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
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
        title="Paste Cash Flow Data"
        description="Import actual cash flow data from SEC EDGAR filings, Excel, or Google Sheets. Matched years will be marked as Actual."
      />
    </div>
  );
}
