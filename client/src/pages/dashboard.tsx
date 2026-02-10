import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, calcPortfolioMetrics } from "@/lib/calculations";
import { useModel } from "@/lib/model-context";
import type { IncomeStatementLine, PortfolioPosition, MacroIndicator, MarketIndex } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Activity } from "lucide-react";

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
            <CardTitle className="text-sm font-medium">Total Revenue (Latest)</CardTitle>
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
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
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
            <CardTitle className="text-sm font-medium">Portfolio Beta</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioMetrics ? portfolioMetrics.weightedBeta.toFixed(2) : "--"}</div>
            <p className="text-xs text-muted-foreground">{portfolioMetrics?.positionCount || 0} positions</p>
          </CardContent>
        </Card>

        <Card data-testid="card-sp500">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">S&P 500 YTD</CardTitle>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-revenue-chart">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue & Profitability ($M)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
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
            <CardTitle className="text-sm font-medium">Sector Allocation</CardTitle>
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
                    <Tooltip formatter={(v: number) => formatPercent(v)} />
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
            <CardTitle className="text-sm font-medium">Interest Rates</CardTitle>
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
            <CardTitle className="text-sm font-medium">Inflation Metrics</CardTitle>
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
            <CardTitle className="text-sm font-medium">Global Indices YTD</CardTitle>
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
            <CardTitle className="text-sm font-medium">Top Daily Movers</CardTitle>
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
            <CardTitle className="text-sm font-medium">Top P&L Positions</CardTitle>
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
