import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject, ProtocolMetric } from "@shared/schema";
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, TrendingDown,
  DollarSign, Activity, AlertTriangle, Search,
} from "lucide-react";

function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface DefiLlamaSearchResult {
  name: string;
  slug: string;
  tvl?: number;
  logo?: string;
}

export default function CryptoFinancials() {
  const [, params] = useRoute("/crypto/financials/:id");
  const projectId = params?.id;
  const { toast } = useToast();

  const [defiSearch, setDefiSearch] = useState("");
  const [defiResults, setDefiResults] = useState<DefiLlamaSearchResult[]>([]);
  const [isSearchingDefi, setIsSearchingDefi] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<ProtocolMetric[]>({
    queryKey: ["/api/crypto/projects", projectId, "protocol-metrics"],
    enabled: !!projectId,
  });

  const fetchDefiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/fetch-defi-data`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "protocol-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] });
      toast({ title: "DeFi data fetched successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to fetch DeFi data", description: err.message, variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/crypto/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] });
      setDefiSearch("");
      setDefiResults([]);
      toast({ title: "DefiLlama ID updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!defiSearch.trim()) {
      setDefiResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDefi(true);
      try {
        const res = await fetch(`/api/crypto/defillama/search?q=${encodeURIComponent(defiSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setDefiResults(Array.isArray(data) ? data : data.protocols || []);
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingDefi(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [defiSearch]);

  if (!projectId) {
    return (
      <div className="p-4" data-testid="text-no-project">
        <p className="text-muted-foreground">No project selected.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-project">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4" data-testid="text-project-not-found">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  const sortedMetrics = [...(metrics || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const last30 = sortedMetrics.slice(-30);
  const prior30 = sortedMetrics.slice(-60, -30);

  const latestTvl = sortedMetrics.length > 0 ? sortedMetrics[sortedMetrics.length - 1].tvl : null;

  const avg30Fees = last30.length > 0
    ? last30.reduce((s, m) => s + (m.dailyFees || 0), 0) / last30.length
    : null;
  const avg30Revenue = last30.length > 0
    ? last30.reduce((s, m) => s + (m.dailyRevenue || 0), 0) / last30.length
    : null;
  const annualizedRevenue = avg30Revenue != null ? avg30Revenue * 365 : null;

  const hasRevenueData = sortedMetrics.some(m => (m.dailyRevenue || 0) > 0);

  const avgPrior30Revenue = prior30.length > 0
    ? prior30.reduce((s, m) => s + (m.dailyRevenue || 0), 0) / prior30.length
    : null;

  const revenueTrend = avg30Revenue != null && avgPrior30Revenue != null && avgPrior30Revenue > 0
    ? ((avg30Revenue - avgPrior30Revenue) / avgPrior30Revenue) * 100
    : null;

  const psRatio = annualizedRevenue && annualizedRevenue > 0 && project.marketCap
    ? (project.marketCap || 0) / annualizedRevenue
    : null;

  const chartData = sortedMetrics.map(m => ({
    date: m.date,
    tvl: m.tvl || 0,
    dailyFees: m.dailyFees || 0,
    dailyRevenue: m.dailyRevenue || 0,
  }));

  const formatYAxis = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const tooltipFormatter = (value: number) => formatCompact(value);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/crypto">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {project.image && (
              <img
                src={project.image}
                alt={project.name}
                className="h-8 w-8 rounded-full"
                data-testid="img-project"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-project-name">
                {project.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" data-testid="badge-symbol">
                  {project.symbol?.toUpperCase()}
                </Badge>
                {project.defiLlamaId && (
                  <span className="text-xs text-muted-foreground" data-testid="text-defillama-id">
                    DefiLlama: {project.defiLlamaId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button
          onClick={() => fetchDefiMutation.mutate()}
          disabled={fetchDefiMutation.isPending || !project.defiLlamaId}
          data-testid="button-fetch-defi"
        >
          {fetchDefiMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          {fetchDefiMutation.isPending ? "Fetching..." : "Fetch DeFi Data"}
        </Button>
      </div>

      {!project.defiLlamaId && (
        <Card data-testid="card-defillama-config">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Configure DefiLlama Protocol ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Search for this protocol on DefiLlama to link financial data.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search DefiLlama protocols..."
                value={defiSearch}
                onChange={(e) => setDefiSearch(e.target.value)}
                className="pl-9"
                data-testid="input-defillama-search"
              />
            </div>
            {isSearchingDefi && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching...
              </div>
            )}
            {defiResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="list-defillama-results">
                {defiResults.map((r) => (
                  <button
                    key={r.slug}
                    className="w-full text-left p-2 rounded-md hover-elevate flex items-center justify-between gap-2"
                    onClick={() => updateProjectMutation.mutate({ defiLlamaId: r.slug })}
                    data-testid={`button-select-protocol-${r.slug}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.logo && <img src={r.logo} alt="" className="h-5 w-5 rounded-full flex-shrink-0" />}
                      <span className="text-sm font-medium truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground">{r.slug}</span>
                    </div>
                    {r.tvl != null && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        TVL: {formatCompact(r.tvl)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-tvl">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Value Locked</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-tvl-value">
              {formatCompact(latestTvl)}
            </div>
            <p className="text-xs text-muted-foreground">Latest TVL</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-fees">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">30d Avg Daily Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-avg-fees-value">
              {formatCompact(avg30Fees)}
            </div>
            <p className="text-xs text-muted-foreground">Average over 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">30d Avg Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-avg-revenue-value">
              {formatCompact(avg30Revenue)}
            </div>
            <p className="text-xs text-muted-foreground">Average over 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-annualized-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Annualized Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-annualized-revenue-value">
              {formatCompact(annualizedRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">30d avg x 365</p>
          </CardContent>
        </Card>
      </div>

      {metricsLoading ? (
        <div className="flex items-center justify-center h-48" data-testid="loading-metrics">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : chartData.length > 0 ? (
        <Card data-testid="card-charts">
          <CardContent className="pt-4">
            <Tabs defaultValue="tvl" data-testid="tabs-charts">
              <TabsList>
                <TabsTrigger value="tvl" data-testid="tab-tvl">TVL</TabsTrigger>
                <TabsTrigger value="fees" data-testid="tab-fees">Fees</TabsTrigger>
                <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
                <TabsTrigger value="combined" data-testid="tab-combined">Combined</TabsTrigger>
              </TabsList>

              <TabsContent value="tvl" className="mt-4">
                <div className="h-80" data-testid="chart-tvl">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tvl"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.2}
                        name="TVL"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="fees" className="mt-4">
                <div className="h-80" data-testid="chart-fees">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar dataKey="dailyFees" fill="#f97316" name="Daily Fees" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="revenue" className="mt-4">
                <div className="h-80" data-testid="chart-revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="dailyRevenue"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        name="Daily Revenue"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="combined" className="mt-4">
                <div className="h-80" data-testid="chart-combined">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tvl"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.15}
                        yAxisId="left"
                        name="TVL"
                      />
                      <Bar
                        dataKey="dailyFees"
                        fill="#f97316"
                        yAxisId="right"
                        name="Daily Fees"
                        radius={[2, 2, 0, 0]}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-no-data">
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No protocol metrics available. {project.defiLlamaId ? 'Click "Fetch DeFi Data" to load metrics.' : "Configure a DefiLlama ID first."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-sustainability">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Revenue Sustainability Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasRevenueData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">P/S Ratio (Market Cap / Annualized Revenue)</p>
                  <div className="text-lg font-bold" data-testid="text-ps-ratio">
                    {psRatio != null ? psRatio.toFixed(1) + "x" : "--"}
                  </div>
                  {psRatio != null && (
                    <p className="text-xs text-muted-foreground">
                      {psRatio < 10 ? "Relatively low valuation" : psRatio < 50 ? "Moderate valuation" : "High valuation relative to revenue"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Revenue Trend (30d vs prior 30d)</p>
                  <div className="flex items-center gap-1" data-testid="text-revenue-trend">
                    {revenueTrend != null ? (
                      <>
                        {revenueTrend >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-lg font-bold ${revenueTrend >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {revenueTrend >= 0 ? "+" : ""}{revenueTrend.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {revenueTrend >= 0 ? "Increasing" : "Decreasing"}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold">--</span>
                    )}
                  </div>
                  {revenueTrend != null && (
                    <p className="text-xs text-muted-foreground">
                      Comparing last 30 days average vs prior 30 days
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 py-2" data-testid="text-no-revenue">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                This token does not generate protocol revenue. Its value is driven by speculation, utility, or store-of-value properties rather than cash flows.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
