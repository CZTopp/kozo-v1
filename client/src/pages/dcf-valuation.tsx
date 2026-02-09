import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, calcCostOfEquity, calcWACC, calcDCFTargetPrice, calcSensitivityTable } from "@/lib/calculations";
import type { FinancialModel, DcfValuation, CashFlowLine } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

export default function DcfValuationPage() {
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

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (!model) {
    return <div className="p-4 text-muted-foreground">No financial model found.</div>;
  }

  const dcf = dcfData?.[0];
  const annualCF = cfData?.filter(d => !d.quarter).sort((a, b) => a.year - b.year) || [];

  const costOfEquity = dcf ? calcCostOfEquity(dcf.riskFreeRate, dcf.beta, dcf.marketReturn) : 0;
  const wacc = dcf ? calcWACC(costOfEquity, dcf.equityWeight, dcf.costOfDebt, dcf.debtWeight, dcf.taxRate) : 0;

  const fcfProjections = annualCF.map(d => d.freeCashFlow || 0);
  const dcfResult = dcf && fcfProjections.length > 0
    ? calcDCFTargetPrice(fcfProjections, wacc, dcf.longTermGrowth, dcf.totalDebt || 0, dcf.sharesOutstanding || 0)
    : null;

  const sensitivity = dcf && fcfProjections.length > 0
    ? calcSensitivityTable(fcfProjections, dcf.longTermGrowth, wacc, dcf.totalDebt || 0, dcf.sharesOutstanding || 0)
    : null;

  const currentPrice = dcf?.currentSharePrice || 0;
  const targetPrice = dcfResult?.targetPricePerShare || dcf?.targetPricePerShare || 0;
  const upside = currentPrice > 0 ? (targetPrice - currentPrice) / currentPrice : 0;

  const fcfChartData = annualCF.map(d => ({
    year: d.year,
    "FCF": (d.freeCashFlow || 0) / 1e6,
  }));

  const waccParams = dcf ? [
    { label: "Risk-Free Rate", value: formatPercent(dcf.riskFreeRate) },
    { label: "Beta", value: dcf.beta.toFixed(2) },
    { label: "Market Return", value: formatPercent(dcf.marketReturn) },
    { label: "Cost of Equity (CAPM)", value: formatPercent(costOfEquity) },
    { label: "Cost of Debt", value: formatPercent(dcf.costOfDebt) },
    { label: "Tax Rate", value: formatPercent(dcf.taxRate) },
    { label: "Equity Weight", value: formatPercent(dcf.equityWeight) },
    { label: "Debt Weight", value: formatPercent(dcf.debtWeight) },
    { label: "WACC", value: formatPercent(wacc) },
  ] : [];

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
          <p className="text-sm text-muted-foreground">Discounted Cash Flow analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Badge
            variant={upside >= 0 ? "default" : "destructive"}
            data-testid="badge-upside"
          >
            {upside >= 0 ? (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {formatPercent(upside)} Upside</span>
            ) : (
              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatPercent(Math.abs(upside))} Downside</span>
            )}
          </Badge>
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
            <CardTitle className="text-sm font-medium">WACC Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {waccParams.map(p => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{p.label}</span>
                  <span className="text-sm font-medium" data-testid={`text-wacc-${p.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>{p.value}</span>
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
        <CardHeader>
          <CardTitle className="text-sm font-medium">FCF Projections ($M)</CardTitle>
        </CardHeader>
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sensitivity Analysis: WACC vs Long-Term Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-sensitivity">
              <TableHeader>
                <TableRow>
                  <TableHead>WACC \ LTG</TableHead>
                  {sensitivity.ltgRange.map(g => (
                    <TableHead key={g} className="text-right text-xs">{formatPercent(g)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensitivity.waccRange.map((w, wi) => (
                  <TableRow key={w} data-testid={`row-sensitivity-${wi}`}>
                    <TableCell className="font-medium text-xs">{formatPercent(w)}</TableCell>
                    {sensitivity.values[wi].map((val, gi) => {
                      const isBase = wi === 2 && gi === 2;
                      return (
                        <TableCell
                          key={gi}
                          className={`text-right text-xs ${isBase ? "font-bold bg-muted/50" : ""}`}
                        >
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
