import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, calcCostOfEquity, calcWACC, calcDCFTargetPrice, calcSensitivityTable } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FinancialModel, DcfValuation, CashFlowLine } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target, Save, RefreshCw, ArrowDown, ArrowRight } from "lucide-react";

export default function DcfValuationPage() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedDcf, setEditedDcf] = useState<Record<string, number>>({});

  const { data: models, isLoading } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const model = models?.[0];

  const { data: dcfData } = useQuery<DcfValuation[]>({
    queryKey: ["/api/models", model?.id, "dcf"],
    enabled: !!model,
  });

  const { data: cfData } = useQuery<CashFlowLine[]>({
    queryKey: ["/api/models", model?.id, "cash-flow"],
    enabled: !!model,
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedDcf).length > 0 && dcfData?.[0]) {
        await apiRequest("PATCH", `/api/models/${model!.id}/dcf-params`, editedDcf);
      }
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      setEditMode(false);
      setEditedDcf({});
      toast({ title: "DCF recalculated", description: "WACC parameters updated. Target price and valuation recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">No financial model found.</div>;

  const dcf = dcfData?.[0];
  const annualCF = cfData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const getDcfVal = (key: string): number => {
    if (editedDcf[key] !== undefined) return editedDcf[key];
    return (dcf as any)?.[key] ?? 0;
  };

  const costOfEquity = calcCostOfEquity(getDcfVal("riskFreeRate"), getDcfVal("beta"), getDcfVal("marketReturn"));
  const wacc = calcWACC(costOfEquity, getDcfVal("equityWeight"), getDcfVal("costOfDebt"), getDcfVal("debtWeight"), getDcfVal("taxRate"));

  const fcfProjections = annualCF.map(d => d.freeCashFlow || 0);
  const dcfResult = fcfProjections.length > 0
    ? calcDCFTargetPrice(fcfProjections, wacc, getDcfVal("longTermGrowth"), getDcfVal("totalDebt"), dcf?.sharesOutstanding || model.sharesOutstanding || 50000000)
    : null;

  const sensitivity = fcfProjections.length > 0
    ? calcSensitivityTable(fcfProjections, getDcfVal("longTermGrowth"), wacc, getDcfVal("totalDebt"), dcf?.sharesOutstanding || model.sharesOutstanding || 50000000)
    : null;

  const currentPrice = getDcfVal("currentSharePrice");
  const targetPrice = dcfResult?.targetPricePerShare || dcf?.targetPricePerShare || 0;
  const upside = currentPrice > 0 ? (targetPrice - currentPrice) / currentPrice : 0;

  const fcfChartData = annualCF.map(d => ({
    year: d.year,
    "FCF": (d.freeCashFlow || 0) / 1e6,
  }));

  const waccParams = [
    { label: "Risk-Free Rate", value: formatPercent(getDcfVal("riskFreeRate")), editKey: "riskFreeRate", isPercent: true },
    { label: "Beta", value: getDcfVal("beta").toFixed(2), editKey: "beta", isPercent: false },
    { label: "Market Return", value: formatPercent(getDcfVal("marketReturn")), editKey: "marketReturn", isPercent: true },
    { label: "Cost of Equity (CAPM)", value: formatPercent(costOfEquity), editKey: null, isPercent: true },
    { label: "Cost of Debt", value: formatPercent(getDcfVal("costOfDebt")), editKey: "costOfDebt", isPercent: true },
    { label: "Tax Rate", value: formatPercent(getDcfVal("taxRate")), editKey: "taxRate", isPercent: true },
    { label: "Equity Weight", value: formatPercent(getDcfVal("equityWeight")), editKey: "equityWeight", isPercent: true },
    { label: "Debt Weight", value: formatPercent(getDcfVal("debtWeight")), editKey: "debtWeight", isPercent: true },
    { label: "Long-Term Growth", value: formatPercent(getDcfVal("longTermGrowth")), editKey: "longTermGrowth", isPercent: true },
    { label: "WACC", value: formatPercent(wacc), editKey: null, isPercent: true },
  ];

  const dcfParams = dcfResult ? [
    { label: "NPV of FCFs", value: formatCurrency(dcfResult.npv) },
    { label: "Terminal Value", value: formatCurrency(dcfResult.terminalValue) },
    { label: "Discounted Terminal Value", value: formatCurrency(dcfResult.terminalValueDiscounted) },
    { label: "Target Equity Value", value: formatCurrency(dcfResult.targetEquityValue) },
    { label: "Target Price Per Share", value: `$${dcfResult.targetPricePerShare.toFixed(2)}` },
  ] : [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">DCF Valuation</h1>
          <p className="text-sm text-muted-foreground">
            Discounted Cash Flow analysis
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Uses FCF from Cash Flow Statement
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Badge variant={upside >= 0 ? "default" : "destructive"} data-testid="badge-upside">
            {upside >= 0 ? (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {formatPercent(upside)} Upside</span>
            ) : (
              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatPercent(Math.abs(upside))} Downside</span>
            )}
          </Badge>
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); setEditedDcf({}); }} data-testid="button-cancel">Cancel</Button>
              <Button onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} data-testid="button-save-recalculate">
                {recalcMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Recalculating...</> : <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-dcf">Edit WACC Params</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-current-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-price">${currentPrice.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-target-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DCF Target Price</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-target-price">${targetPrice.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-wacc">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WACC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-wacc">{formatPercent(wacc)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-wacc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              {editMode && <ArrowRight className="h-4 w-4" />}
              WACC Calculation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {waccParams.map(p => (
                <div key={p.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{p.label}</span>
                  {editMode && p.editKey ? (
                    <Input
                      type="text"
                      value={p.isPercent ? (getDcfVal(p.editKey) * 100).toFixed(2) : getDcfVal(p.editKey).toFixed(2)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setEditedDcf(prev => ({ ...prev, [p.editKey!]: p.isPercent ? v / 100 : v }));
                      }}
                      className="h-7 w-24 text-sm text-right"
                      data-testid={`input-dcf-${p.editKey}`}
                    />
                  ) : (
                    <span className="text-sm font-medium" data-testid={`text-wacc-${p.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>{p.value}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-dcf-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium">DCF Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dcfParams.map(p => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{p.label}</span>
                  <span className="text-sm font-medium" data-testid={`text-dcf-${p.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-fcf-chart">
        <CardHeader><CardTitle className="text-sm font-medium">FCF Projections ($M)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fcfChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                <Legend />
                <Bar dataKey="FCF" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {sensitivity && (
        <Card data-testid="card-sensitivity">
          <CardHeader><CardTitle className="text-sm font-medium">Sensitivity Analysis: WACC vs Long-Term Growth</CardTitle></CardHeader>
          <CardContent>
            <Table data-testid="table-sensitivity">
              <TableHeader>
                <TableRow>
                  <TableHead>WACC \ LTG</TableHead>
                  {sensitivity.ltgRange.map(g => <TableHead key={g} className="text-right text-xs">{formatPercent(g)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensitivity.waccRange.map((w, wi) => (
                  <TableRow key={w} data-testid={`row-sensitivity-${wi}`}>
                    <TableCell className="font-medium text-xs">{formatPercent(w)}</TableCell>
                    {sensitivity.values[wi].map((val, gi) => {
                      const isBase = wi === 2 && gi === 2;
                      return (
                        <TableCell key={gi} className={`text-right text-xs ${isBase ? "font-bold bg-muted/50" : ""}`}>
                          {val > 0 ? `$${val.toFixed(2)}` : "--"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
