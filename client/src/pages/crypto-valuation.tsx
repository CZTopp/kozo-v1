import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CryptoProject, ProtocolMetric } from "@shared/schema";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Shield, DollarSign, Activity, Target, Scale } from "lucide-react";

function formatCompact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(8)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function CryptoValuation() {
  const [, params] = useRoute("/crypto/valuation/:id");
  const projectId = params?.id;

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: metrics } = useQuery<ProtocolMetric[]>({
    queryKey: ["/api/crypto/projects", projectId, "protocol-metrics"],
    enabled: !!projectId,
  });

  const [discountRate, setDiscountRate] = useState(15);
  const [growthRate, setGrowthRate] = useState(10);
  const [terminalGrowth, setTerminalGrowth] = useState(2);
  const [projectionYears, setProjectionYears] = useState(5);

  const [bullMultiplier, setBullMultiplier] = useState(2);
  const [baseMultiplier, setBaseMultiplier] = useState(1);
  const [bearMultiplier, setBearMultiplier] = useState(0.5);

  if (projectLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]" data-testid="loading-state">
        <p className="text-muted-foreground">Loading project data...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 space-y-4" data-testid="not-found-state">
        <Link href="/crypto">
          <Button variant="ghost" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Crypto
          </Button>
        </Link>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const recentMetrics = (metrics || [])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const totalRevenue30d = recentMetrics.reduce((sum, m) => sum + (m.dailyRevenue || 0), 0);
  const annualizedRevenue = recentMetrics.length > 0
    ? (totalRevenue30d / recentMetrics.length) * 365
    : 0;
  const hasRevenue = annualizedRevenue > 0;

  const currentPrice = project.currentPrice || 0;
  const marketCap = project.marketCap || 0;
  const fdv = project.fullyDilutedValuation || 0;
  const fdvMcapRatio = marketCap > 0 ? fdv / marketCap : 0;
  const circulatingSupply = project.circulatingSupply || 0;
  const totalSupply = project.totalSupply || 0;
  const volume24h = project.volume24h || 0;

  const dcfProjections = [];
  let totalPV = 0;
  const dr = discountRate / 100;
  const gr = growthRate / 100;
  const tg = terminalGrowth / 100;

  for (let y = 1; y <= projectionYears; y++) {
    const revenue = annualizedRevenue * Math.pow(1 + gr, y);
    const discounted = revenue / Math.pow(1 + dr, y);
    totalPV += discounted;
    dcfProjections.push({ year: y, revenue, discounted });
  }

  const lastYearRevenue = annualizedRevenue * Math.pow(1 + gr, projectionYears);
  const terminalValue = dr > tg ? (lastYearRevenue * (1 + tg)) / (dr - tg) : 0;
  const terminalValueDiscounted = terminalValue / Math.pow(1 + dr, projectionYears);
  const totalValuation = totalPV + terminalValueDiscounted;
  const impliedPrice = circulatingSupply > 0 ? totalValuation / circulatingSupply : 0;
  const upsideDownside = currentPrice > 0 ? ((impliedPrice - currentPrice) / currentPrice) * 100 : 0;

  const circulatingPercent = totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 100;
  const volumeMcapRatio = marketCap > 0 ? volume24h / marketCap : 0;
  const priceSalesRatio = hasRevenue && annualizedRevenue > 0 ? marketCap / annualizedRevenue : null;

  const isRevenueGenerating = hasRevenue;
  const isMeme = !hasRevenue && (!project.category || project.category === "meme");
  const classificationLabel = isRevenueGenerating
    ? "Revenue-Generating Protocol"
    : isMeme
      ? "Meme / No Fundamentals"
      : "Speculative / Store of Value";
  const classificationColor = isRevenueGenerating
    ? "bg-green-500/10 text-green-500 border-green-500/20"
    : isMeme
      ? "bg-red-500/10 text-red-500 border-red-500/20"
      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

  const scenarios = [
    {
      name: "Bull",
      multiplier: bullMultiplier,
      color: "text-green-500",
      bgColor: "bg-green-500/5",
    },
    {
      name: "Base",
      multiplier: baseMultiplier,
      color: "text-muted-foreground",
      bgColor: "",
    },
    {
      name: "Bear",
      multiplier: bearMultiplier,
      color: "text-red-500",
      bgColor: "bg-red-500/5",
    },
  ];

  const scenarioData = scenarios.map((s) => {
    const impliedMcap = marketCap * s.multiplier;
    const impliedScenarioPrice = circulatingSupply > 0 ? impliedMcap / circulatingSupply : 0;
    const change = currentPrice > 0 ? ((impliedScenarioPrice - currentPrice) / currentPrice) * 100 : 0;
    const impliedFdv = totalSupply > 0 ? impliedScenarioPrice * totalSupply : impliedMcap;
    return {
      name: s.name,
      multiplier: s.multiplier,
      impliedPrice: impliedScenarioPrice,
      change,
      impliedFdv,
      impliedMcap,
      color: s.color,
      bgColor: s.bgColor,
    };
  });

  const chartData = scenarioData.map((s) => ({
    name: s.name,
    price: s.impliedPrice,
  }));

  const unlockRisk = totalSupply > 0 && circulatingSupply > 0 && totalSupply / circulatingSupply > 1.5;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/crypto">
          <Button variant="ghost" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {project.image && (
            <img
              src={project.image}
              alt={project.name}
              className="h-8 w-8 rounded-full"
              data-testid="img-project"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-project-name">{project.name}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-project-symbol">
              {project.symbol?.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-current-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Current Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-current-price">
              {formatCompact(currentPrice)}
            </div>
            <p
              className={`text-xs ${(project.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`}
              data-testid="text-price-change-24h"
            >
              {(project.priceChange24h || 0) >= 0 ? (
                <TrendingUp className="h-3 w-3 inline mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 inline mr-1" />
              )}
              {formatPercent(project.priceChange24h)} (24h)
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-market-cap">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Market Cap</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-market-cap">
              {formatCompact(marketCap)}
            </div>
            <p className="text-xs text-muted-foreground">
              Rank by market cap
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-fdv">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Fully Diluted Valuation</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-fdv">
              {formatCompact(fdv)}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on max/total supply
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-fdv-mcap-ratio">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">FDV/MCap Ratio</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-fdv-mcap-ratio">
              {fdvMcapRatio > 0 ? fdvMcapRatio.toFixed(2) + "x" : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {fdvMcapRatio > 2 ? "Significant dilution risk" : fdvMcapRatio > 1.2 ? "Moderate dilution" : "Low dilution"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dcf" data-testid="tabs-valuation">
        <TabsList>
          <TabsTrigger value="dcf" data-testid="tab-dcf">Discounted Fee Revenue</TabsTrigger>
          <TabsTrigger value="comparable" data-testid="tab-comparable">Comparable Analysis</TabsTrigger>
          <TabsTrigger value="scenario" data-testid="tab-scenario">Scenario Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="dcf" className="mt-4 space-y-4">
          {!hasRevenue ? (
            <Card data-testid="card-no-revenue">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">No Revenue Data Available</h3>
                    <p className="text-sm text-muted-foreground">
                      This token does not generate protocol revenue. The Discounted Fee Revenue model cannot be applied. Consider using Comparable Analysis instead.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card data-testid="card-dcf-inputs">
                <CardHeader>
                  <CardTitle className="text-sm">Model Inputs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="discount-rate" className="text-xs">Discount Rate (%)</Label>
                      <Input
                        id="discount-rate"
                        type="number"
                        value={discountRate}
                        onChange={(e) => setDiscountRate(Number(e.target.value))}
                        data-testid="input-discount-rate"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="growth-rate" className="text-xs">Growth Rate (%)</Label>
                      <Input
                        id="growth-rate"
                        type="number"
                        value={growthRate}
                        onChange={(e) => setGrowthRate(Number(e.target.value))}
                        data-testid="input-growth-rate"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="terminal-growth" className="text-xs">Terminal Growth (%)</Label>
                      <Input
                        id="terminal-growth"
                        type="number"
                        value={terminalGrowth}
                        onChange={(e) => setTerminalGrowth(Number(e.target.value))}
                        data-testid="input-terminal-growth"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="projection-years" className="text-xs">Projection Years</Label>
                      <Input
                        id="projection-years"
                        type="number"
                        value={projectionYears}
                        onChange={(e) => setProjectionYears(Number(e.target.value))}
                        data-testid="input-projection-years"
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Annualized Revenue (from last {recentMetrics.length} days): {formatCompact(annualizedRevenue)}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-dcf-results">
                <CardHeader>
                  <CardTitle className="text-sm">Projected Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Year</TableHead>
                          <TableHead className="text-right font-semibold">Revenue</TableHead>
                          <TableHead className="text-right font-semibold">Discounted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dcfProjections.map((row) => (
                          <TableRow key={row.year} data-testid={`row-dcf-year-${row.year}`}>
                            <TableCell>Year {row.year}</TableCell>
                            <TableCell className="text-right">{formatCompact(row.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCompact(row.discounted)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow data-testid="row-dcf-terminal">
                          <TableCell className="font-semibold">Terminal Value</TableCell>
                          <TableCell className="text-right">{formatCompact(terminalValue)}</TableCell>
                          <TableCell className="text-right">{formatCompact(terminalValueDiscounted)}</TableCell>
                        </TableRow>
                        <TableRow data-testid="row-dcf-total">
                          <TableCell className="font-bold">Total Present Value</TableCell>
                          <TableCell className="text-right" />
                          <TableCell className="text-right font-bold">{formatCompact(totalValuation)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-dcf-implied">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Implied Token Price</p>
                      <p className="text-2xl font-bold" data-testid="text-implied-price">
                        {formatCompact(impliedPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                      <p className="text-2xl font-bold">{formatCompact(currentPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Upside / Downside</p>
                      <p
                        className={`text-2xl font-bold ${upsideDownside >= 0 ? "text-green-500" : "text-red-500"}`}
                        data-testid="text-upside-downside"
                      >
                        {formatPercent(upsideDownside)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="comparable" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={classificationColor} data-testid="badge-classification">
              {classificationLabel}
            </Badge>
          </div>

          {!isRevenueGenerating && (
            <Card data-testid="card-honest-assessment">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">Honest Assessment</h3>
                    <p className="text-sm text-muted-foreground">
                      This token has no fundamental revenue basis. Its value is driven entirely by speculation, narrative, and market sentiment. Traditional valuation frameworks do not apply.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-comparable-table">
            <CardHeader>
              <CardTitle className="text-sm">Market Metrics Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Metric</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow data-testid="row-comp-mcap">
                      <TableCell>Market Cap</TableCell>
                      <TableCell className="text-right">{formatCompact(marketCap)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">Based on circulating supply</TableCell>
                    </TableRow>
                    <TableRow data-testid="row-comp-fdv">
                      <TableCell>FDV</TableCell>
                      <TableCell className="text-right">{formatCompact(fdv)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">Based on total/max supply</TableCell>
                    </TableRow>
                    <TableRow data-testid="row-comp-mcap-fdv">
                      <TableCell>MCap/FDV Ratio</TableCell>
                      <TableCell className="text-right">{fdv > 0 ? (marketCap / fdv * 100).toFixed(1) + "%" : "--"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {fdv > 0 && marketCap / fdv < 0.5 ? "High future dilution" : "Reasonable supply distribution"}
                      </TableCell>
                    </TableRow>
                    {priceSalesRatio !== null && (
                      <TableRow data-testid="row-comp-ps">
                        <TableCell>Price/Sales</TableCell>
                        <TableCell className="text-right">{priceSalesRatio.toFixed(1)}x</TableCell>
                        <TableCell className="text-muted-foreground text-xs">MCap / annualized protocol revenue</TableCell>
                      </TableRow>
                    )}
                    <TableRow data-testid="row-comp-circ">
                      <TableCell>Circulating Supply %</TableCell>
                      <TableCell className="text-right">{circulatingPercent.toFixed(1)}%</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatNumber(circulatingSupply)} / {formatNumber(totalSupply)}
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-comp-vol">
                      <TableCell>Volume/MCap Ratio</TableCell>
                      <TableCell className="text-right">{(volumeMcapRatio * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {volumeMcapRatio > 0.1 ? "High liquidity" : volumeMcapRatio > 0.01 ? "Normal liquidity" : "Low liquidity"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenario" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scenarioData.map((s) => (
              <Card key={s.name} className={s.bgColor} data-testid={`card-scenario-${s.name.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {s.name === "Bull" && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {s.name === "Bear" && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {s.name === "Base" && <Target className="h-4 w-4 text-muted-foreground" />}
                    {s.name} Case
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Market Cap Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={s.name === "Bull" ? bullMultiplier : s.name === "Base" ? baseMultiplier : bearMultiplier}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (s.name === "Bull") setBullMultiplier(val);
                        else if (s.name === "Base") setBaseMultiplier(val);
                        else setBearMultiplier(val);
                      }}
                      data-testid={`input-multiplier-${s.name.toLowerCase()}`}
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Implied Price</span>
                      <span className="font-semibold" data-testid={`text-scenario-price-${s.name.toLowerCase()}`}>
                        {formatCompact(s.impliedPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Change</span>
                      <span
                        className={`font-semibold ${s.change >= 0 ? "text-green-500" : "text-red-500"}`}
                        data-testid={`text-scenario-change-${s.name.toLowerCase()}`}
                      >
                        {formatPercent(s.change)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Implied FDV</span>
                      <span className="font-semibold">{formatCompact(s.impliedFdv)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Implied MCap</span>
                      <span className="font-semibold">{formatCompact(s.impliedMcap)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card data-testid="card-scenario-chart">
            <CardHeader>
              <CardTitle className="text-sm">Scenario Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => {
                        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                        if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                        if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                        return `$${v.toFixed(2)}`;
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCompact(value), "Price"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Bar dataKey="price" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card data-testid="card-risks">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Key Risks & Considerations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {unlockRisk && (
              <div className="flex items-start gap-2" data-testid="risk-unlock">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Token Unlock Risk</p>
                  <p className="text-xs text-muted-foreground">
                    Total supply ({formatNumber(totalSupply)}) is significantly higher than circulating supply ({formatNumber(circulatingSupply)}). Future token unlocks could create selling pressure and dilute value.
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2" data-testid="risk-concentration">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Concentration Risk</p>
                <p className="text-xs text-muted-foreground">
                  Token holdings may be concentrated among a small number of wallets. Large holders can significantly impact price through selling.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2" data-testid="risk-regulatory">
              <Shield className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Regulatory Risk</p>
                <p className="text-xs text-muted-foreground">
                  Cryptocurrency regulations are evolving globally. Changes in regulatory frameworks could significantly impact token value and utility.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2" data-testid="risk-smart-contract">
              <Shield className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Smart Contract Risk</p>
                <p className="text-xs text-muted-foreground">
                  Smart contracts may contain vulnerabilities. Exploits or bugs could result in loss of funds or protocol failure.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
