import { useQuery } from "@tanstack/react-query";
import { useModel } from "@/lib/model-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import type { ValuationComparison, FinancialModel } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Target, ArrowDown, AlertTriangle, Globe } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";

interface YahooFundamentals {
  currentPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  trailingPE: number;
  forwardPE: number;
  eps: number;
  beta: number;
  dividendYield: number;
  priceToBook: number;
  bookValue: number;
  week52Low: number;
  week52High: number;
  sector: string;
  industry: string;
}

export default function ValuationComparisonPage() {
  const { selectedModel: model, isLoading } = useModel();

  const { data: valData } = useQuery<ValuationComparison>({
    queryKey: ["/api/models", model?.id, "valuation-comparison"],
    enabled: !!model,
  });

  const { data: yahooData } = useQuery<YahooFundamentals>({
    queryKey: ["/api/models", model?.id, "yahoo-fundamentals"],
    enabled: !!model?.ticker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">Select a company from the sidebar to begin.</div>;

  const val = valData;
  const currentPrice = val?.currentSharePrice || 0;
  const averageTarget = val?.averageTarget || 0;
  const percentToTarget = val?.percentToTarget || (currentPrice > 0 ? (averageTarget - currentPrice) / currentPrice : 0);

  const methods = val ? [
    {
      name: "Price/Revenue",
      bullMultiple: `${val.prBullMultiple}x`,
      baseMultiple: `${val.prBaseMultiple}x`,
      bearMultiple: `${val.prBearMultiple}x`,
      bullTarget: val.prBullTarget || 0,
      baseTarget: val.prBaseTarget || 0,
      bearTarget: val.prBearTarget || 0,
    },
    {
      name: "Price/Earnings (PEG)",
      bullMultiple: `${val.peBullPeg}x`,
      baseMultiple: `${val.peBasePeg}x`,
      bearMultiple: `${val.peBearPeg}x`,
      bullTarget: val.peBullTarget || 0,
      baseTarget: val.peBaseTarget || 0,
      bearTarget: val.peBearTarget || 0,
    },
    {
      name: "DCF",
      bullMultiple: `${(model.scenarioBullMultiplier ?? 1.2).toFixed(1)}x`,
      baseMultiple: `${(model.scenarioBaseMultiplier ?? 1.0).toFixed(1)}x`,
      bearMultiple: `${(model.scenarioBearMultiplier ?? 0.8).toFixed(1)}x`,
      bullTarget: val.dcfBullTarget || 0,
      baseTarget: val.dcfBaseTarget || 0,
      bearTarget: val.dcfBearTarget || 0,
    },
  ] : [];

  const chartData = methods.map(m => ({
    method: m.name,
    Bull: m.bullTarget,
    Base: m.baseTarget,
    Bear: m.bearTarget,
  }));

  const hasPegZero = val && val.peBullTarget === 0 && val.peBaseTarget === 0 && val.peBearTarget === 0;
  const hasAllZeroTargets = val && methods.every(m => m.bullTarget === 0 && m.baseTarget === 0 && m.bearTarget === 0);
  const hasNoScenarioRevenues = !val?.valuationData || !(val.valuationData as any)?.scenarioRevenues || Object.keys((val.valuationData as any)?.scenarioRevenues?.base || {}).length === 0;
  const hasZeroPrice = currentPrice === 0;
  const hasIssues = hasPegZero || hasAllZeroTargets || hasNoScenarioRevenues || hasZeroPrice;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Valuation Comparison</h1>
          <p className="text-sm text-muted-foreground">
            Multi-method valuation analysis
            <span className="ml-2 text-xs">
              <ArrowDown className="h-3 w-3 inline" /> Auto-derived from Revenue, Earnings & DCF
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          <Badge variant={percentToTarget >= 0 ? "default" : "destructive"} data-testid="badge-percent-to-target">
            {percentToTarget >= 0 ? (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {formatPercent(percentToTarget)} to Target</span>
            ) : (
              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatPercent(Math.abs(percentToTarget))} Overvalued</span>
            )}
          </Badge>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowDown className="h-4 w-4 flex-shrink-0" />
            <span>This page is the final output of the cascading model. Price targets are computed from Revenue (P/R method), Earnings (PEG method), and DCF. Edit upstream inputs to see how valuations change.</span>
          </div>
        </CardContent>
      </Card>

      {hasIssues && (
        <Card className="border-dashed" data-testid="card-valuation-warnings">
          <CardContent className="pt-4 pb-3">
            <div className="space-y-3">
              {hasZeroPrice && (
                <div className="flex items-start gap-2" data-testid="warning-zero-price">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <span className="text-sm">Current share price is $0. Set it on the DCF Valuation page to calculate meaningful target comparisons.</span>
                </div>
              )}
              {hasAllZeroTargets && (
                <div className="flex items-start gap-2" data-testid="warning-all-zero">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <span className="text-sm">All valuation targets are $0. This usually means revenue data hasn't been entered yet. Start with the Revenue Forecast page.</span>
                </div>
              )}
              {hasPegZero && !hasAllZeroTargets && (
                <div className="flex items-start gap-2" data-testid="warning-peg-zero">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <span className="text-sm">PEG-based targets are $0. This can happen when earnings (EPS) data is zero across all years. Ensure the Income Statement has non-zero net income.</span>
                </div>
              )}
              {hasNoScenarioRevenues && (
                <div className="flex items-start gap-2" data-testid="warning-no-scenarios">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <span className="text-sm">Scenario revenue projections are empty. Run 'Recalculate' from the Income Statement or DCF page to generate bull/base/bear scenarios.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-current-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Current Price <InfoTooltip content="Current market share price used as the anchor for all valuation method comparisons." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-price">${currentPrice.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-average-target">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Average Target <InfoTooltip content="Average of all base-case target prices across Price/Revenue, PEG, and DCF methods. Provides a blended fair value estimate." /></CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-average-target">${averageTarget.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-upside">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">% to Target <InfoTooltip content="Percentage difference between the current price and the average target. Positive means potential upside; negative means the stock may be overvalued." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${percentToTarget >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-percent-to-target">
              {formatPercent(percentToTarget)}
            </div>
          </CardContent>
        </Card>
      </div>

      {yahooData && (
        <Card data-testid="card-yahoo-market-context">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Globe className="h-4 w-4" /> Market Benchmarks ({model.ticker})
              <InfoTooltip content="Live valuation metrics from Yahoo Finance. Compare your model's assumptions against what the market currently prices." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2">
              {[
                { label: "Market Price", value: `$${yahooData.currentPrice.toFixed(2)}` },
                { label: "Market Cap", value: yahooData.marketCap > 1e9 ? `$${(yahooData.marketCap / 1e9).toFixed(1)}B` : yahooData.marketCap > 1e6 ? `$${(yahooData.marketCap / 1e6).toFixed(1)}M` : formatCurrency(yahooData.marketCap) },
                { label: "Trailing P/E", value: yahooData.trailingPE > 0 ? yahooData.trailingPE.toFixed(1) : "--" },
                { label: "Forward P/E", value: yahooData.forwardPE > 0 ? yahooData.forwardPE.toFixed(1) : "--" },
                { label: "EPS (TTM)", value: yahooData.eps !== 0 ? `$${yahooData.eps.toFixed(2)}` : "--" },
                { label: "P/B Ratio", value: yahooData.priceToBook > 0 ? yahooData.priceToBook.toFixed(2) : "--" },
                { label: "Beta", value: yahooData.beta.toFixed(2) },
                { label: "Div Yield", value: yahooData.dividendYield > 0 ? formatPercent(yahooData.dividendYield) : "--" },
                { label: "52W Range", value: `$${yahooData.week52Low.toFixed(0)} - $${yahooData.week52High.toFixed(0)}` },
                { label: "Sector", value: yahooData.sector || "--" },
                { label: "Industry", value: yahooData.industry || "--" },
              ].map(item => (
                <div key={item.label} className="flex flex-col" data-testid={`yahoo-val-${item.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {methods.map(m => (
          <Card key={m.name} data-testid={`card-method-${m.name.toLowerCase().replace(/[^a-z]/g, "-")}`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Multiple</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid={`row-${m.name}-bull`}>
                    <TableCell><Badge variant="default">Bull</Badge></TableCell>
                    <TableCell className="text-right">{m.bullMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.bullTarget.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow data-testid={`row-${m.name}-base`}>
                    <TableCell><Badge variant="secondary">Base</Badge></TableCell>
                    <TableCell className="text-right">{m.baseMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.baseTarget.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow data-testid={`row-${m.name}-bear`}>
                    <TableCell><Badge variant="destructive">Bear</Badge></TableCell>
                    <TableCell className="text-right">{m.bearMultiple}</TableCell>
                    <TableCell className="text-right font-medium">${m.bearTarget.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {val?.valuationData && (val.valuationData as any)?.scenarioRevenues && (
        <Card data-testid="card-scenario-revenues">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Scenario Revenue Projections <InfoTooltip content="Revenue forecasts under bull, base, and bear scenarios. Scenario multipliers (set in Projection Settings) adjust the base growth rate." /></CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Bear</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Bull</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys((val.valuationData as any)?.scenarioRevenues?.base || {}).sort().map((year: string) => {
                  const scenarios = (val.valuationData as any).scenarioRevenues || {};
                  return (
                    <TableRow key={year} data-testid={`row-scenario-${year}`}>
                      <TableCell className="font-medium">{year}</TableCell>
                      <TableCell className="text-right text-red-500">{formatCurrency(scenarios.bear?.[year] || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(scenarios.base?.[year] || 0)}</TableCell>
                      <TableCell className="text-right text-green-500">{formatCurrency(scenarios.bull?.[year] || 0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-comparison-chart">
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-1">Valuation Methods Comparison <InfoTooltip content="Side-by-side comparison of bull, base, and bear target prices from each valuation method. The dashed line shows the current market price." /></CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="method" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Bull" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Base" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Bear" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                {currentPrice > 0 && (
                  <ReferenceLine y={currentPrice} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" label={{ value: `Current: $${currentPrice.toFixed(2)}`, fill: "hsl(var(--foreground))", fontSize: 12 }} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
