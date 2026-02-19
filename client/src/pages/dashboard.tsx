import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, calcPortfolioMetrics } from "@/lib/calculations";
import { useModel } from "@/lib/model-context";
import type { IncomeStatementLine, PortfolioPosition, MacroIndicator, MarketIndex, RevenueLineItem, RevenuePeriod, BalanceSheetLine, DcfValuation, CashFlowLine } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { Link } from "wouter";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const { selectedModel: model } = useModel();
  const { data: portfolio } = useQuery<PortfolioPosition[]>({ queryKey: ["/api/portfolio"] });
  const { data: macro } = useQuery<MacroIndicator[]>({ queryKey: ["/api/macro-indicators"] });
  const { data: indices } = useQuery<MarketIndex[]>({ queryKey: ["/api/market-indices"] });
  const { data: incomeData } = useQuery<IncomeStatementLine[]>({
    queryKey: ["/api/models", model?.id, "income-statement"],
    enabled: !!model,
  });
  const { data: revenuePeriods } = useQuery<RevenuePeriod[]>({
    queryKey: ["/api/models", model?.id, "revenue-periods"],
    enabled: !!model,
  });
  const { data: balanceSheet } = useQuery<BalanceSheetLine[]>({
    queryKey: ["/api/models", model?.id, "balance-sheet"],
    enabled: !!model,
  });
  const { data: dcfData } = useQuery<DcfValuation | null>({
    queryKey: ["/api/models", model?.id, "dcf"],
    enabled: !!model,
  });
  const { data: cashFlow } = useQuery<CashFlowLine[]>({
    queryKey: ["/api/models", model?.id, "cash-flow"],
    enabled: !!model,
  });

  const portfolioMetrics = portfolio?.length ? calcPortfolioMetrics(
    portfolio.map(p => ({
      currentPrice: p.currentPrice || 0,
      purchasePrice: p.purchasePrice || 0,
      sharesHeld: p.sharesHeld || 0,
      beta: p.beta || 1,
      sector: p.sector || "Other",
      dailyChangePercent: p.dailyChangePercent || 0,
    }))
  ) : null;

  const revenueChartData = incomeData?.map(d => ({
    year: d.year,
    Revenue: (d.revenue || 0) / 1e6,
    "Net Income": (d.netIncome || 0) / 1e6,
    EBITDA: (d.ebitda || 0) / 1e6,
  })) || [];

  const interestRates = macro?.filter(m => m.category === "Interest Rates") || [];
  const inflation = macro?.filter(m => m.category === "Inflation") || [];

  const hasRevenueData = revenuePeriods && revenuePeriods.some(p => (p.amount || 0) > 0);
  const hasCostAssumptions = incomeData && incomeData.some(d => (d.cogs || 0) !== 0 || (d.salesMarketing || 0) !== 0 || (d.researchDevelopment || 0) !== 0);
  const hasBalanceSheet = balanceSheet && balanceSheet.length > 0;
  const hasCashFlow = cashFlow && cashFlow.some(cf => (cf.freeCashFlow || 0) !== 0);
  const hasDcfParameters = dcfData && (dcfData.currentSharePrice || 0) > 0 && ((dcfData.riskFreeRate || 0) > 0 || (dcfData.beta || 0) > 0);
  const isValuationComplete = hasRevenueData && hasCostAssumptions && hasBalanceSheet && hasCashFlow && hasDcfParameters;

  const readinessItems = [
    { name: "Revenue Data", complete: hasRevenueData, page: "Revenue Forecast", link: "/revenue" },
    { name: "Cost Assumptions", complete: hasCostAssumptions, page: "Income Statement", link: "/income-statement" },
    { name: "Balance Sheet", complete: hasBalanceSheet, page: "Balance Sheet", link: "/balance-sheet" },
    { name: "Cash Flow", complete: hasCashFlow, page: "Cash Flow", link: "/cash-flow" },
    { name: "DCF Parameters", complete: hasDcfParameters, page: "DCF Valuation", link: "/dcf" },
    { name: "Valuation", complete: isValuationComplete, page: "Valuation Comparison", link: "/valuation" },
  ];

  const completedCount = readinessItems.filter(item => item.complete).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Financial Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your financial model and portfolio</p>
        </div>
        {model && <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Total Revenue (Latest) <InfoTooltip content="Total top-line revenue from the most recent fiscal year in your model. YoY shows the year-over-year growth rate." /></CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incomeData?.length ? formatCurrency(incomeData[incomeData.length - 1].revenue || 0) : "--"}</div>
            {incomeData && incomeData.length >= 2 && (
              <p className="text-xs text-muted-foreground">
                {formatPercent(((incomeData[incomeData.length - 1].revenue || 0) - (incomeData[incomeData.length - 2].revenue || 0)) / Math.abs(incomeData[incomeData.length - 2].revenue || 1))} YoY
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-portfolio-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Portfolio Value <InfoTooltip content="Sum of all position market values (current price x shares held). Total return shows unrealized gain/loss across all holdings." /></CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioMetrics ? formatCurrency(portfolioMetrics.totalValue) : "--"}</div>
            {portfolioMetrics && (
              <p className={`text-xs ${portfolioMetrics.totalGainLossPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatPercent(portfolioMetrics.totalGainLossPercent)} total return
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-portfolio-beta">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">Portfolio Beta <InfoTooltip content="Value-weighted average beta across all positions. Beta > 1 means the portfolio is more volatile than the market; < 1 means less volatile." /></CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioMetrics ? portfolioMetrics.weightedBeta.toFixed(2) : "--"}</div>
            <p className="text-xs text-muted-foreground">{portfolioMetrics?.positionCount || 0} positions</p>
          </CardContent>
        </Card>

        <Card data-testid="card-sp500">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">S&P 500 YTD <InfoTooltip content="Year-to-date return of the S&P 500 index. Used as a broad market benchmark to compare portfolio performance." /></CardTitle>
            {indices?.[0]?.ytdReturn && indices[0].ytdReturn >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indices?.[0] ? formatPercent(indices[0].ytdReturn || 0) : "--"}</div>
            <p className="text-xs text-muted-foreground">{indices?.[0] ? `${indices[0].currentValue?.toLocaleString()}` : ""}</p>
          </CardContent>
        </Card>
      </div>

      {model && (
        <Card className="border-dashed" data-testid="card-model-readiness">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Model Readiness: {completedCount} of {readinessItems.length} steps complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readinessItems.map(item => (
                <div key={item.name} data-testid={`readiness-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`} className="flex items-center gap-2">
                  {item.complete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
                  <span className="text-sm">{item.name}</span>
                  <Link href={item.link} className="text-xs text-primary hover:underline ml-auto">
                    {item.page}
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-revenue-chart">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Revenue & Profitability ($M) <InfoTooltip content="Revenue, EBITDA, and Net Income plotted over time in millions. Shows the company's growth trajectory and profitability trend." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} />
                  <Bar dataKey="Revenue" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="EBITDA" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Net Income" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-sector-allocation">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Sector Allocation <InfoTooltip content="Portfolio value broken down by sector. High concentration in one sector increases unsystematic risk." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {portfolioMetrics && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioMetrics.sectorAllocation}
                      dataKey="percent"
                      nameKey="sector"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ sector, percent }: { sector: string; percent: number }) => `${sector} ${(percent * 100).toFixed(0)}%`}
                    >
                      {portfolioMetrics.sectorAllocation.map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} formatter={(v: number) => formatPercent(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card data-testid="card-macro-rates">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Interest Rates <InfoTooltip content="Key central bank rates including Fed Funds, 10Y Treasury, and others. Rising rates typically pressure equity valuations." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {interestRates.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.name}</span>
                  <span className="text-sm font-medium">{(r.value * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-macro-inflation">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Inflation Metrics <InfoTooltip content="CPI, PCE, and other inflation gauges. Persistent inflation erodes real returns and may trigger tighter monetary policy." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inflation.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.name}</span>
                  <span className="text-sm font-medium">{(r.value * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-global-indices">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Global Indices YTD <InfoTooltip content="Year-to-date performance of major global indices. Useful for assessing cross-market sentiment and relative performance." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {indices?.slice(0, 8).map(idx => (
                <div key={idx.id} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{idx.ticker}</span>
                  <span className={`text-sm font-medium ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatPercent(idx.ytdReturn || 0)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-top-movers">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Top Daily Movers <InfoTooltip content="Positions with the largest absolute daily price changes. Helps identify names requiring immediate attention." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {portfolio
                ?.sort((a, b) => Math.abs(b.dailyChangePercent || 0) - Math.abs(a.dailyChangePercent || 0))
                .slice(0, 6)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.ticker}</span>
                      <span className="text-xs text-muted-foreground">${p.currentPrice?.toFixed(2)}</span>
                    </div>
                    <Badge variant={(p.dailyChangePercent || 0) >= 0 ? "default" : "destructive"}>
                      {(p.dailyChangePercent || 0) >= 0 ? "+" : ""}{((p.dailyChangePercent || 0) * 100).toFixed(2)}%
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-top-gainers">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1">Top P&L Positions <InfoTooltip content="Positions ranked by absolute dollar gain/loss. Shows which holdings are driving overall portfolio performance." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {portfolio
                ?.sort((a, b) => (b.gainLossDollar || 0) - (a.gainLossDollar || 0))
                .slice(0, 6)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.ticker}</span>
                      <span className="text-xs text-muted-foreground">{p.sharesHeld} shares</span>
                    </div>
                    <span className={`text-sm font-medium ${(p.gainLossDollar || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatCurrency(p.gainLossDollar || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
