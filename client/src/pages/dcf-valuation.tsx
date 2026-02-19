import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, calcCostOfEquity, calcWACC, calcDCFTargetPrice, calcSensitivityTable } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DcfValuation, CashFlowLine } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target, Save, RefreshCw, ArrowDown, ArrowRight, AlertTriangle, Download, Globe } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";

interface YahooFundamentals {
  currentPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  trailingPE: number;
  forwardPE: number;
  eps: number;
  beta: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  debtToEquity: number;
  trailingFCF: number;
  sector: string;
  industry: string;
  dividendYield: number;
  revenuePerShare: number;
  bookValue: number;
  priceToBook: number;
  week52Low: number;
  week52High: number;
}

export default function DcfValuationPage() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedDcf, setEditedDcf] = useState<Record<string, number>>({});

  const { selectedModel: model, isLoading } = useModel();

  const { data: dcfData } = useQuery<DcfValuation | null>({
    queryKey: ["/api/models", model?.id, "dcf"],
    enabled: !!model,
  });

  const { data: cfData } = useQuery<CashFlowLine[]>({
    queryKey: ["/api/models", model?.id, "cash-flow"],
    enabled: !!model,
  });

  const { data: yahooData, isLoading: yahooLoading } = useQuery<YahooFundamentals>({
    queryKey: ["/api/models", model?.id, "yahoo-fundamentals"],
    enabled: !!model?.ticker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/models/${model!.id}/sync-yahoo`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "yahoo-fundamentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      toast({
        title: "Live data synced",
        description: `Updated price ($${data.applied?.currentPrice?.toFixed(2) || "N/A"}), beta (${data.applied?.beta?.toFixed(2) || "N/A"}), and shares outstanding.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedDcf).length > 0 && dcfData) {
        await apiRequest("PATCH", `/api/models/${model!.id}/dcf-params`, editedDcf);
      }
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"], exact: true });
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
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const dcf = dcfData;
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

  const hasZeroPrice = currentPrice === 0 && !yahooData?.currentPrice;
  const hasDefaultWacc = getDcfVal("riskFreeRate") === 0 && getDcfVal("beta") === 0 && getDcfVal("marketReturn") === 0;
  const hasNoFCF = fcfProjections.length === 0 || fcfProjections.every(f => f === 0);
  const hasIssues = hasZeroPrice || hasDefaultWacc || hasNoFCF;

  const livePrice = yahooData?.currentPrice || 0;
  const displayPrice = currentPrice > 0 ? currentPrice : livePrice;
  const displayUpside = displayPrice > 0 ? (targetPrice - displayPrice) / displayPrice : 0;

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
          <Badge variant={displayUpside >= 0 ? "default" : "destructive"} data-testid="badge-upside">
            {displayUpside >= 0 ? (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {formatPercent(displayUpside)} Upside</span>
            ) : (
              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatPercent(Math.abs(displayUpside))} Downside</span>
            )}
          </Badge>
          {model.ticker && (
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-yahoo"
            >
              {syncMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Syncing...</> : <><Globe className="h-4 w-4 mr-1" /> Sync Live Data</>}
            </Button>
          )}
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
            <CardTitle className="text-sm font-medium flex items-center gap-1">Current Price <InfoTooltip content="The current market share price. Used as the baseline to determine upside or downside from the DCF target." /></CardTitle>
            {yahooData && currentPrice === 0 && livePrice > 0 && (
              <Badge variant="outline" className="text-[10px]">Live</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-price">${displayPrice.toFixed(2)}</div>
            {yahooData && currentPrice > 0 && livePrice > 0 && livePrice !== currentPrice && (
              <p className="text-xs text-muted-foreground mt-1">Live: ${livePrice.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-target-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">DCF Target Price <InfoTooltip content="Intrinsic value per share derived from discounted future free cash flows. If above current price, the stock may be undervalued." /></CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-target-price">${targetPrice.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-wacc">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">WACC <InfoTooltip content="Weighted Average Cost of Capital. The blended discount rate combining cost of equity (CAPM) and after-tax cost of debt, weighted by capital structure." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-wacc">{formatPercent(wacc)}</div>
          </CardContent>
        </Card>
      </div>

      {hasIssues && (
        <Card data-testid="card-dcf-warnings" className="border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {hasZeroPrice && (
                <div className="flex gap-2" data-testid="warning-zero-price">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-500">Current share price is $0. Click 'Edit WACC Params' and set the Current Share Price to see meaningful upside/downside calculations.</span>
                </div>
              )}
              {hasDefaultWacc && (
                <div className="flex gap-2" data-testid="warning-default-wacc">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-500">WACC inputs appear to be at defaults (Risk-Free Rate and Beta are both zero). Set realistic values to get an accurate discount rate.</span>
                </div>
              )}
              {hasNoFCF && (
                <div className="flex gap-2" data-testid="warning-no-fcf">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-500">No Free Cash Flow data found. Enter revenue on the Revenue Forecast page and run 'Forecast Forward' to generate FCF projections.</span>
                </div>
              )}
              {hasZeroPrice && model.ticker && (
                <div className="flex gap-2" data-testid="warning-sync-hint">
                  <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">Ticker "{model.ticker}" is set. Click "Sync Live Data" to auto-populate the current price and beta from Yahoo Finance.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {yahooData && (
        <Card data-testid="card-yahoo-context">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Globe className="h-4 w-4" /> Market Data ({model.ticker})
              <InfoTooltip content="Live market data from Yahoo Finance for reference. Use 'Sync Live Data' to apply current price and beta to your DCF model." />
            </CardTitle>
            {yahooLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2">
              {[
                { label: "Market Price", value: `$${yahooData.currentPrice.toFixed(2)}` },
                { label: "Market Cap", value: yahooData.marketCap > 1e9 ? `$${(yahooData.marketCap / 1e9).toFixed(1)}B` : yahooData.marketCap > 1e6 ? `$${(yahooData.marketCap / 1e6).toFixed(1)}M` : formatCurrency(yahooData.marketCap) },
                { label: "Trailing P/E", value: yahooData.trailingPE > 0 ? yahooData.trailingPE.toFixed(1) : "--" },
                { label: "Forward P/E", value: yahooData.forwardPE > 0 ? yahooData.forwardPE.toFixed(1) : "--" },
                { label: "EPS (TTM)", value: yahooData.eps !== 0 ? `$${yahooData.eps.toFixed(2)}` : "--" },
                { label: "Beta", value: yahooData.beta.toFixed(2) },
                { label: "Div Yield", value: yahooData.dividendYield > 0 ? formatPercent(yahooData.dividendYield) : "--" },
                { label: "P/B Ratio", value: yahooData.priceToBook > 0 ? yahooData.priceToBook.toFixed(2) : "--" },
                { label: "Book Value", value: yahooData.bookValue > 0 ? `$${yahooData.bookValue.toFixed(2)}` : "--" },
                { label: "52W Low", value: `$${yahooData.week52Low.toFixed(2)}` },
                { label: "52W High", value: `$${yahooData.week52High.toFixed(2)}` },
                { label: "Sector", value: yahooData.sector || "--" },
              ].map(item => (
                <div key={item.label} className="flex flex-col" data-testid={`yahoo-${item.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-wacc-panel">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              {editMode && <ArrowRight className="h-4 w-4" />}
              WACC Calculation <InfoTooltip content="CAPM-based cost of equity plus after-tax cost of debt. Edit these inputs to see how the discount rate and target price change." />
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
            <CardTitle className="text-sm font-medium flex items-center gap-1">DCF Results <InfoTooltip content="Shows NPV of projected free cash flows, terminal value (perpetuity growth method), and the resulting target equity value per share." /></CardTitle>
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
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-1">FCF Projections ($M) <InfoTooltip content="Historical free cash flow used as the basis for the DCF model. Future projections use the Forecast Forward feature with growth decay." /></CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fcfChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} formatter={(v: number) => `$${v.toFixed(1)}M`} />
                <Legend />
                <Bar dataKey="FCF" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {sensitivity && (
        <Card data-testid="card-sensitivity">
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-1">Sensitivity Analysis: WACC vs Long-Term Growth <InfoTooltip content="5x5 grid showing how the target price changes as WACC and long-term growth assumptions vary. The center cell reflects your current inputs." /></CardTitle></CardHeader>
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
