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
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CryptoProject, ProtocolMetric, TokenIncentive } from "@shared/schema";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Shield, DollarSign, Activity, Target, Scale, Users, Lock, Zap, Info } from "lucide-react";

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

function formatSupply(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
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

  const { data: incentives } = useQuery<TokenIncentive[]>({
    queryKey: ["/api/crypto/projects", projectId, "incentives"],
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
  const maxSupply = project.maxSupply || 0;
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

  const hasStakingIncentives = (incentives || []).some(i => (i.estimatedApy || 0) > 0);
  const stakingIncentives = (incentives || []).filter(i => (i.estimatedApy || 0) > 0);
  const hasIncentives = (incentives || []).length > 0;
  const sustainableCount = (incentives || []).filter(i => i.isSustainable).length;
  const unsustainableCount = (incentives || []).filter(i => !i.isSustainable).length;

  const athFromCurrent = project.ath && currentPrice > 0 ? ((currentPrice - project.ath) / project.ath) * 100 : null;

  const inflationEstimate = maxSupply > 0 && circulatingSupply > 0
    ? ((maxSupply - circulatingSupply) / circulatingSupply) * 100
    : totalSupply > 0 && circulatingSupply > 0 && totalSupply > circulatingSupply
      ? ((totalSupply - circulatingSupply) / circulatingSupply) * 100
      : null;

  const scenarios = [
    { name: "Bull", multiplier: bullMultiplier, color: "text-green-500", bgColor: "bg-green-500/5" },
    { name: "Base", multiplier: baseMultiplier, color: "text-muted-foreground", bgColor: "" },
    { name: "Bear", multiplier: bearMultiplier, color: "text-red-500", bgColor: "bg-red-500/5" },
  ];

  const scenarioData = scenarios.map((s) => {
    const impliedMcap = marketCap * s.multiplier;
    const impliedScenarioPrice = circulatingSupply > 0 ? impliedMcap / circulatingSupply : 0;
    const change = currentPrice > 0 ? ((impliedScenarioPrice - currentPrice) / currentPrice) * 100 : 0;
    const impliedFdv = totalSupply > 0 ? impliedScenarioPrice * totalSupply : impliedMcap;
    return { name: s.name, multiplier: s.multiplier, impliedPrice: impliedScenarioPrice, change, impliedFdv, impliedMcap, color: s.color, bgColor: s.bgColor };
  });

  const chartData = scenarioData.map((s) => ({ name: s.name, price: s.impliedPrice }));

  const unlockRisk = totalSupply > 0 && circulatingSupply > 0 && totalSupply / circulatingSupply > 1.5;
  const highFdvRisk = fdvMcapRatio > 3;
  const lowLiquidityRisk = volumeMcapRatio < 0.005;
  const highInflationRisk = inflationEstimate !== null && inflationEstimate > 50;

  const riskItems: { title: string; description: string; severity: "high" | "medium" | "low"; testId: string }[] = [];

  if (unlockRisk) {
    riskItems.push({
      title: "Token Unlock Dilution",
      description: `Only ${circulatingPercent.toFixed(1)}% of total supply is circulating (${formatSupply(circulatingSupply)} of ${formatSupply(totalSupply)}). Future unlocks could create significant selling pressure.`,
      severity: circulatingPercent < 30 ? "high" : "medium",
      testId: "risk-unlock",
    });
  }

  if (highFdvRisk) {
    riskItems.push({
      title: "High FDV/Market Cap Ratio",
      description: `FDV is ${fdvMcapRatio.toFixed(1)}x the current market cap. This indicates significant future dilution as more tokens enter circulation.`,
      severity: fdvMcapRatio > 5 ? "high" : "medium",
      testId: "risk-fdv",
    });
  }

  if (highInflationRisk) {
    riskItems.push({
      title: "High Remaining Inflation",
      description: `Estimated ${inflationEstimate?.toFixed(1)}% additional tokens yet to enter circulation relative to current supply. This creates long-term dilution pressure.`,
      severity: inflationEstimate! > 100 ? "high" : "medium",
      testId: "risk-inflation",
    });
  }

  if (lowLiquidityRisk) {
    riskItems.push({
      title: "Low Trading Liquidity",
      description: `24h volume is only ${(volumeMcapRatio * 100).toFixed(3)}% of market cap. Low liquidity means larger price impact on trades and difficulty exiting positions.`,
      severity: volumeMcapRatio < 0.001 ? "high" : "medium",
      testId: "risk-liquidity",
    });
  }

  if (unsustainableCount > 0) {
    riskItems.push({
      title: "Unsustainable Incentives",
      description: `${unsustainableCount} participant incentive${unsustainableCount > 1 ? "s" : ""} flagged as potentially unsustainable. These may rely on token emissions that dilute value over time.`,
      severity: "medium",
      testId: "risk-incentives",
    });
  }

  riskItems.push({
    title: "Regulatory Uncertainty",
    description: "Cryptocurrency regulations are evolving globally. Changes could impact token value, utility, and exchange listing status.",
    severity: "low",
    testId: "risk-regulatory",
  });

  if (athFromCurrent !== null && athFromCurrent < -80) {
    riskItems.push({
      title: "Significant ATH Drawdown",
      description: `Currently ${Math.abs(athFromCurrent).toFixed(1)}% below all-time high (${formatCompact(project.ath)}). Deep drawdowns may indicate structural issues or waning interest.`,
      severity: athFromCurrent < -95 ? "high" : "medium",
      testId: "risk-ath",
    });
  }

  const severityIcon = (sev: string) => {
    if (sev === "high") return <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />;
    if (sev === "medium") return <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />;
    return <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />;
  };

  const defaultTab = hasRevenue ? "dcf" : "overview";

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
            <img src={project.image} alt={project.name} className="h-8 w-8 rounded-full" data-testid="img-project" />
          )}
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-project-name">{project.name}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-project-symbol">{project.symbol?.toUpperCase()}</p>
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
            <div className="text-xl font-bold" data-testid="text-current-price">{formatCompact(currentPrice)}</div>
            <p className={`text-xs ${(project.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-price-change-24h">
              {(project.priceChange24h || 0) >= 0 ? <TrendingUp className="h-3 w-3 inline mr-1" /> : <TrendingDown className="h-3 w-3 inline mr-1" />}
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
            <div className="text-xl font-bold" data-testid="text-market-cap">{formatCompact(marketCap)}</div>
            <p className="text-xs text-muted-foreground">Volume/MCap: {(volumeMcapRatio * 100).toFixed(2)}%</p>
          </CardContent>
        </Card>

        <Card data-testid="card-fdv">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Fully Diluted Valuation</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-fdv">{formatCompact(fdv)}</div>
            <p className="text-xs text-muted-foreground">
              {fdvMcapRatio > 0 ? `${fdvMcapRatio.toFixed(2)}x market cap` : "--"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-supply-info">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Supply Distribution</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-circulating-pct">{circulatingPercent.toFixed(1)}%</div>
            <Progress value={circulatingPercent} className="h-1.5 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">{formatSupply(circulatingSupply)} circulating</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab} data-testid="tabs-valuation">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Investor Overview</TabsTrigger>
          {hasRevenue && <TabsTrigger value="dcf" data-testid="tab-dcf">Revenue Valuation</TabsTrigger>}
          <TabsTrigger value="scenario" data-testid="tab-scenario">Scenario Analysis</TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">
            Risk Assessment
            {riskItems.filter(r => r.severity === "high").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">{riskItems.filter(r => r.severity === "high").length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-market-metrics">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Market Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Market Cap</span>
                    <span className="font-medium">{formatCompact(marketCap)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Fully Diluted Valuation</span>
                    <span className="font-medium">{formatCompact(fdv)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">FDV / MCap Ratio</span>
                    <span className="font-medium">{fdvMcapRatio > 0 ? `${fdvMcapRatio.toFixed(2)}x` : "--"}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">24h Trading Volume</span>
                    <span className="font-medium">{formatCompact(volume24h)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Volume / MCap</span>
                    <span className="font-medium">{(volumeMcapRatio * 100).toFixed(2)}%</span>
                  </div>
                  {priceSalesRatio !== null && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Price / Revenue</span>
                      <span className="font-medium">{priceSalesRatio.toFixed(1)}x</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">All-Time High</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCompact(project.ath)}</span>
                      {athFromCurrent !== null && (
                        <span className={`text-xs ml-1 ${athFromCurrent >= 0 ? "text-green-500" : "text-red-500"}`}>
                          ({athFromCurrent.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-supply-metrics">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Supply & Dilution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Circulating Supply</span>
                    <span className="font-medium">{formatSupply(circulatingSupply)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Supply</span>
                    <span className="font-medium">{formatSupply(totalSupply)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Max Supply</span>
                    <span className="font-medium">{maxSupply > 0 ? formatSupply(maxSupply) : "Unlimited"}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Circulating %</span>
                    <span className="font-medium">{circulatingPercent.toFixed(1)}%</span>
                  </div>
                  {inflationEstimate !== null && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Remaining Inflation</span>
                      <span className={`font-medium ${inflationEstimate > 50 ? "text-yellow-500" : ""}`}>
                        {inflationEstimate.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Supply Progress</span>
                      <span>{circulatingPercent.toFixed(0)}%</span>
                    </div>
                    <Progress value={circulatingPercent} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {hasIncentives && (
            <Card data-testid="card-incentive-summary">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Ecosystem Incentive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="text-xs">{(incentives || []).length} participant roles</Badge>
                    {sustainableCount > 0 && (
                      <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                        {sustainableCount} sustainable
                      </Badge>
                    )}
                    {unsustainableCount > 0 && (
                      <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                        {unsustainableCount} needs review
                      </Badge>
                    )}
                  </div>

                  {hasStakingIncentives && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staking & Yield Opportunities</p>
                      {stakingIncentives.map((inc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm border rounded-md p-2" data-testid={`staking-incentive-${idx}`}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{inc.role}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green-500 font-semibold">~{inc.estimatedApy}% APY</span>
                            {inc.isSustainable ? (
                              <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">Sustainable</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">Emission-based</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Participants</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold text-xs">Role</TableHead>
                            <TableHead className="font-semibold text-xs">Contribution</TableHead>
                            <TableHead className="font-semibold text-xs">Reward</TableHead>
                            <TableHead className="text-center font-semibold text-xs">Sustainable</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(incentives || []).map((inc, idx) => (
                            <TableRow key={idx} data-testid={`row-incentive-${idx}`}>
                              <TableCell className="text-xs font-medium">{inc.role}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{inc.contribution}</TableCell>
                              <TableCell className="text-xs">{inc.rewardType}</TableCell>
                              <TableCell className="text-center">
                                {inc.isSustainable ? (
                                  <Shield className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mx-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    View detailed incentive analysis on the Tokenomics page.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!hasIncentives && (
            <Card data-testid="card-no-incentives">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">No Ecosystem Incentive Data</h3>
                    <p className="text-xs text-muted-foreground">
                      Visit the Tokenomics page to add participant incentive data (staking rewards, developer grants, liquidity mining, etc.) or load a pre-built template if available.
                    </p>
                    <Link href={`/crypto/tokenomics/${projectId}`}>
                      <Button variant="outline" size="sm" className="mt-2" data-testid="link-tokenomics-add">
                        <Users className="h-3.5 w-3.5 mr-1" />
                        Go to Tokenomics
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {hasRevenue && (
          <TabsContent value="dcf" className="mt-4 space-y-4">
            <Card data-testid="card-dcf-inputs">
              <CardHeader>
                <CardTitle className="text-sm">Discounted Fee Revenue Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="discount-rate" className="text-xs">Discount Rate (%)</Label>
                    <Input id="discount-rate" type="number" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} data-testid="input-discount-rate" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="growth-rate" className="text-xs">Growth Rate (%)</Label>
                    <Input id="growth-rate" type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} data-testid="input-growth-rate" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="terminal-growth" className="text-xs">Terminal Growth (%)</Label>
                    <Input id="terminal-growth" type="number" value={terminalGrowth} onChange={(e) => setTerminalGrowth(Number(e.target.value))} data-testid="input-terminal-growth" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="projection-years" className="text-xs">Projection Years</Label>
                    <Input id="projection-years" type="number" value={projectionYears} onChange={(e) => setProjectionYears(Number(e.target.value))} data-testid="input-projection-years" />
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
                    <p className="text-2xl font-bold" data-testid="text-implied-price">{formatCompact(impliedPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                    <p className="text-2xl font-bold">{formatCompact(currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Upside / Downside</p>
                    <p className={`text-2xl font-bold ${upsideDownside >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-upside-downside">
                      {formatPercent(upsideDownside)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

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
                      <span className="font-semibold" data-testid={`text-scenario-price-${s.name.toLowerCase()}`}>{formatCompact(s.impliedPrice)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Change</span>
                      <span className={`font-semibold ${s.change >= 0 ? "text-green-500" : "text-red-500"}`} data-testid={`text-scenario-change-${s.name.toLowerCase()}`}>
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

        <TabsContent value="risks" className="mt-4 space-y-4">
          <div className="space-y-3">
            {riskItems.sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return order[a.severity] - order[b.severity];
            }).map((risk, idx) => (
              <Card key={idx} data-testid={risk.testId}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {severityIcon(risk.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{risk.title}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            risk.severity === "high" ? "text-red-500 border-red-500/30" :
                            risk.severity === "medium" ? "text-yellow-500 border-yellow-500/30" :
                            "text-muted-foreground"
                          }`}
                        >
                          {risk.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{risk.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {riskItems.length === 1 && (
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-muted-foreground">No major quantitative risk flags detected based on current market data.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
