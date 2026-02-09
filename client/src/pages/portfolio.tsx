import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPercent, calcPortfolioMetrics } from "@/lib/calculations";
import type { PortfolioPosition, PortfolioRedFlag, MacroIndicator, MarketIndex } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Activity } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f97316", "#06b6d4", "#8b5cf6"];

export default function Portfolio() {
  const { data: positions } = useQuery<PortfolioPosition[]>({ queryKey: ["/api/portfolio"] });
  const { data: redFlags } = useQuery<PortfolioRedFlag[]>({ queryKey: ["/api/portfolio-red-flags"] });
  const { data: macro } = useQuery<MacroIndicator[]>({ queryKey: ["/api/macro-indicators"] });
  const { data: indices } = useQuery<MarketIndex[]>({ queryKey: ["/api/market-indices"] });

  const metrics = positions?.length ? calcPortfolioMetrics(
    positions.map(p => ({
      currentPrice: p.currentPrice || 0,
      purchasePrice: p.purchasePrice || 0,
      sharesHeld: p.sharesHeld || 0,
      beta: p.beta || 1,
      sector: p.sector || "Other",
      dailyChangePercent: p.dailyChangePercent || 0,
    }))
  ) : null;

  const yesFlags = redFlags?.filter(f => f.answer === "Yes") || [];
  const sortedPositions = [...(positions || [])].sort((a, b) => (b.positionValue || 0) - (a.positionValue || 0));

  const goldenCrossPositions = positions?.filter(p => p.goldenCross) || [];
  const deathCrossPositions = positions?.filter(p => !p.goldenCross) || [];

  const topGainers = [...(positions || [])].sort((a, b) => (b.gainLossPercent || 0) - (a.gainLossPercent || 0)).slice(0, 5);
  const topLosers = [...(positions || [])].sort((a, b) => (a.gainLossPercent || 0) - (b.gainLossPercent || 0)).slice(0, 5);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Portfolio Dashboard</h1>
        <p className="text-sm text-muted-foreground">{positions?.length || 0} positions tracked</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card data-testid="card-portfolio-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics ? formatCurrency(metrics.totalValue) : "--"}</div>
            <p className={`text-xs ${(metrics?.totalGainLossPercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
              {metrics ? `${formatPercent(metrics.totalGainLossPercent)} (${formatCurrency(metrics.totalGainLoss)})` : ""}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-portfolio-beta-val">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Weighted Beta</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics?.weightedBeta.toFixed(2) || "--"}</div>
            <p className="text-xs text-muted-foreground">{(metrics?.weightedBeta || 0) > 1.2 ? "Above market risk" : "Near market risk"}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-concentration">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Concentration Risk</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics?.concentrationRisk || "--"}</div>
            <p className="text-xs text-muted-foreground">{metrics?.sectorAllocation[0]?.sector} {metrics?.sectorAllocation[0] ? `${(metrics.sectorAllocation[0].percent * 100).toFixed(0)}%` : ""}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-golden-cross">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Golden Cross</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{goldenCrossPositions.length}/{positions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">MA50 above MA200</p>
          </CardContent>
        </Card>

        <Card data-testid="card-red-flags">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Red Flags</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{yesFlags.length}/{redFlags?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active warnings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" data-testid="tabs-portfolio">
        <TabsList>
          <TabsTrigger value="positions">All Positions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="risk">Risk & Flags</TabsTrigger>
          <TabsTrigger value="macro">Macro & Indices</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold sticky left-0 bg-background z-10">Ticker</TableHead>
                      <TableHead className="font-semibold">Company</TableHead>
                      <TableHead className="font-semibold">Sector</TableHead>
                      <TableHead className="text-right font-semibold">Price</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">Shares</TableHead>
                      <TableHead className="text-right font-semibold">Cost Basis</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">P&L $</TableHead>
                      <TableHead className="text-right font-semibold">P&L %</TableHead>
                      <TableHead className="text-right font-semibold">P/E</TableHead>
                      <TableHead className="text-right font-semibold">Beta</TableHead>
                      <TableHead className="text-right font-semibold">MA50</TableHead>
                      <TableHead className="text-right font-semibold">MA200</TableHead>
                      <TableHead className="text-center font-semibold">Signal</TableHead>
                      <TableHead className="text-right font-semibold">52W Low</TableHead>
                      <TableHead className="text-right font-semibold">52W High</TableHead>
                      <TableHead className="text-right font-semibold">Stop Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPositions.map(p => (
                      <TableRow key={p.id} data-testid={`row-position-${p.ticker}`}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">{p.ticker}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{p.companyName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.sector}</Badge></TableCell>
                        <TableCell className="text-right font-mono">${p.currentPrice?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-xs ${(p.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {((p.dailyChangePercent || 0) * 100).toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{p.sharesHeld}</TableCell>
                        <TableCell className="text-right font-mono">${p.purchasePrice?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(p.positionValue || 0)}</TableCell>
                        <TableCell className={`text-right font-mono ${(p.gainLossDollar || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatCurrency(p.gainLossDollar || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(p.gainLossPercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(p.gainLossPercent || 0)}
                        </TableCell>
                        <TableCell className="text-right">{p.peRatio?.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{p.beta?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.ma50?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.ma200?.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.goldenCross ? "default" : "destructive"} className="text-xs">
                            {p.goldenCross ? "Golden" : "Death"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">${p.week52Low?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.week52High?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.stopLoss?.toFixed(2) || "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {metrics && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.sectorAllocation} dataKey="value" nameKey="sector" cx="50%" cy="50%" outerRadius={80}
                          label={({ sector, percent }: { sector: string; percent: number }) => `${sector} ${(percent * 100).toFixed(0)}%`}>
                          {metrics.sectorAllocation.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Position P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedPositions.slice(0, 10).map(p => ({ name: p.ticker, "P&L": p.gainLossDollar || 0 }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="name" width={50} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="P&L" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Gainers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topGainers.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.ticker}</span>
                        <span className="text-xs text-muted-foreground">${p.currentPrice?.toFixed(2)}</span>
                      </div>
                      <Badge variant="default">{formatPercent(p.gainLossPercent || 0)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Worst Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topLosers.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.ticker}</span>
                        <span className="text-xs text-muted-foreground">${p.currentPrice?.toFixed(2)}</span>
                      </div>
                      <Badge variant={(p.gainLossPercent || 0) < 0 ? "destructive" : "default"}>
                        {formatPercent(p.gainLossPercent || 0)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Red Flag Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {redFlags?.map(f => (
                    <div key={f.id} className="flex items-start justify-between gap-2">
                      <span className="text-sm">{f.question}</span>
                      <Badge variant={f.answer === "Yes" ? "destructive" : "secondary"} className="shrink-0">
                        {f.answer}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Technical Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Golden Cross (Bullish)</h4>
                    <div className="flex flex-wrap gap-1">
                      {goldenCrossPositions.map(p => (
                        <Badge key={p.id} variant="default" className="text-xs">{p.ticker} ({p.daysSinceGoldenCross}d)</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Death Cross (Bearish)</h4>
                    <div className="flex flex-wrap gap-1">
                      {deathCrossPositions.map(p => (
                        <Badge key={p.id} variant="destructive" className="text-xs">{p.ticker}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Near Stop Loss</h4>
                    <div className="flex flex-wrap gap-1">
                      {positions?.filter(p => p.stopLoss && p.currentPrice && p.currentPrice < (p.stopLoss * 1.05)).map(p => (
                        <Badge key={p.id} variant="destructive" className="text-xs">
                          {p.ticker} (${p.currentPrice?.toFixed(0)} vs ${p.stopLoss?.toFixed(0)})
                        </Badge>
                      ))}
                      {!positions?.some(p => p.stopLoss && p.currentPrice && p.currentPrice < (p.stopLoss * 1.05)) && (
                        <span className="text-sm text-muted-foreground">No positions near stop loss</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Beta Exposure by Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedPositions.map(p => ({ name: p.ticker, Beta: p.beta || 1, Value: (p.positionValue || 0) / 1000 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="Beta" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="macro" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">US Indices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {indices?.filter(i => i.region === "US").map(idx => (
                    <div key={idx.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{idx.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{idx.currentValue?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          YTD {formatPercent(idx.ytdReturn || 0)}
                        </span>
                        <span className={`text-xs ${(idx.mtdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          MTD {formatPercent(idx.mtdReturn || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">International Indices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {indices?.filter(i => i.region !== "US").map(idx => (
                    <div key={idx.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{idx.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{idx.region}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          YTD {formatPercent(idx.ytdReturn || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Macro Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {macro?.map(m => (
                    <div key={m.id} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{m.name}</span>
                      <span className="text-sm font-medium">
                        {m.displayFormat === "percent" ? `${(m.value * 100).toFixed(2)}%` : m.value.toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs w-fit">{m.category}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
