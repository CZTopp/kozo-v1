import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPercent } from "@/lib/calculations";
import type { MacroIndicator, MarketIndex } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";

export default function MarketDataPage() {
  const { data: indices, isLoading: loadingIndices } = useQuery<MarketIndex[]>({ queryKey: ["/api/market-indices"] });
  const { data: macro, isLoading: loadingMacro } = useQuery<MacroIndicator[]>({ queryKey: ["/api/macro-indicators"] });

  const usIndices = indices?.filter(i => i.region === "US") || [];
  const intlIndices = indices?.filter(i => i.region !== "US") || [];

  const rateIndicators = macro?.filter(m => m.category === "Interest Rates") || [];
  const inflationIndicators = macro?.filter(m => m.category === "Inflation") || [];
  const growthIndicators = macro?.filter(m => m.category === "Growth") || [];
  const laborIndicators = macro?.filter(m => m.category === "Labor") || [];
  const commodityIndicators = macro?.filter(m => m.category === "Commodities") || [];

  const indicesChartData = indices?.map(idx => ({
    name: idx.ticker,
    YTD: (idx.ytdReturn || 0) * 100,
  })) || [];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Market Data & Macro</h1>
        <p className="text-sm text-muted-foreground">Global market indices and macroeconomic indicators</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {usIndices.slice(0, 6).map(idx => (
          <Card key={idx.id} data-testid={`card-index-${idx.ticker}`}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{idx.name}</span>
                <span className="text-sm font-medium">{idx.currentValue?.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  {(idx.ytdReturn || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatPercent(idx.ytdReturn || 0)} YTD
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="indices" data-testid="tabs-market-data">
        <TabsList>
          <TabsTrigger value="indices">Global Indices</TabsTrigger>
          <TabsTrigger value="macro">Macro Indicators</TabsTrigger>
          <TabsTrigger value="chart">Index Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">US Market Indices</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Index</TableHead>
                      <TableHead className="font-semibold">Ticker</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">MTD</TableHead>
                      <TableHead className="text-right font-semibold">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usIndices.map(idx => (
                      <TableRow key={idx.id} data-testid={`row-index-${idx.ticker}`}>
                        <TableCell className="font-medium">{idx.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{idx.ticker}</TableCell>
                        <TableCell className="text-right font-mono">{idx.currentValue?.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${(idx.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.dailyChangePercent || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.mtdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.mtdReturn || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.ytdReturn || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">International Indices</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Index</TableHead>
                      <TableHead className="font-semibold">Region</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intlIndices.map(idx => (
                      <TableRow key={idx.id} data-testid={`row-index-${idx.ticker}`}>
                        <TableCell className="font-medium">{idx.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{idx.region}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{idx.currentValue?.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${(idx.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.dailyChangePercent || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.ytdReturn || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="macro" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { title: "Interest Rates", data: rateIndicators },
              { title: "Inflation", data: inflationIndicators },
              { title: "Growth", data: growthIndicators },
              { title: "Labor Market", data: laborIndicators },
              { title: "Commodities", data: commodityIndicators },
            ].filter(g => g.data.length > 0).map(group => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{group.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Indicator</TableHead>
                        <TableHead className="text-right font-semibold">Value</TableHead>
                        <TableHead className="text-right font-semibold">Prior</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.data.map(m => (
                        <TableRow key={m.id} data-testid={`row-macro-${m.name}`}>
                          <TableCell className="text-sm">{m.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {m.displayFormat === "percent" ? `${(m.value * 100).toFixed(2)}%` : m.value.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {m.priorValue != null
                              ? m.displayFormat === "percent"
                                ? `${(m.priorValue * 100).toFixed(2)}%`
                                : m.priorValue.toLocaleString()
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Index YTD Performance (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicesChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                    />
                    <Bar dataKey="YTD" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
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
