import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject, ProtocolRevenueForecast } from "@shared/schema";
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, DollarSign, Save,
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

interface ForecastRow {
  year: number;
  projectedFees: number;
  growthRate: number;
  takeRate: number;
  projectedRevenue: number;
  emissionCost: number;
  netValueAccrual: number;
}

export default function CryptoRevenueForecast() {
  const [, params] = useRoute("/crypto/revenue/:id");
  const projectId = params?.id;
  const { toast } = useToast();

  const [scenario, setScenario] = useState<string>("base");
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: forecasts, isLoading: forecastsLoading } = useQuery<ProtocolRevenueForecast[]>({
    queryKey: ["/api/crypto/projects", projectId, "revenue-forecasts", scenario],
    queryFn: async () => {
      const res = await fetch(
        `/api/crypto/projects/${projectId}/revenue-forecasts?scenario=${scenario}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (forecasts && forecasts.length > 0) {
      const sorted = [...forecasts].sort((a, b) => a.year - b.year);
      setRows(
        sorted.map((f) => ({
          year: f.year,
          projectedFees: f.projectedFees ?? 0,
          growthRate: f.growthRate ?? 0,
          takeRate: f.takeRate ?? 0,
          projectedRevenue: f.projectedRevenue ?? 0,
          emissionCost: f.emissionCost ?? 0,
          netValueAccrual: f.netValueAccrual ?? 0,
        })),
      );
      setDirty(false);
    }
  }, [forecasts]);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/revenue-forecasts/seed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "revenue-forecasts"] });
      toast({ title: "Forecast seeded from DefiLlama actuals" });
    },
    onError: (err: Error) => {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/revenue-forecasts`, {
        scenario,
        forecasts: rows,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "revenue-forecasts"] });
      setDirty(false);
      toast({ title: "Forecasts saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const updateRow = (index: number, field: keyof ForecastRow, value: number) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      row.projectedRevenue = row.projectedFees * (row.takeRate / 100);
      row.netValueAccrual = row.projectedRevenue - row.emissionCost;
      next[index] = row;
      return next;
    });
    setDirty(true);
  };

  const scenarioRows = useMemo(() => {
    if (scenario === "base") return rows;
    const multiplier = scenario === "bull" ? 1.5 : 0.6;
    return rows.map((r) => {
      const fees = r.projectedFees * multiplier;
      const revenue = fees * (r.takeRate / 100);
      const net = revenue - r.emissionCost;
      return { ...r, projectedFees: fees, projectedRevenue: revenue, netValueAccrual: net };
    });
  }, [rows, scenario]);

  const chartData = scenarioRows.map((r) => ({
    year: r.year,
    projectedRevenue: r.projectedRevenue,
    emissionCost: r.emissionCost,
    netValueAccrual: r.netValueAccrual,
  }));

  const cumulativeRevenue = scenarioRows.reduce((s, r) => s + r.projectedRevenue, 0);
  const avgGrowthRate =
    scenarioRows.length > 0
      ? scenarioRows.reduce((s, r) => s + r.growthRate, 0) / scenarioRows.length
      : 0;
  const terminalNetAccrual =
    scenarioRows.length > 0 ? scenarioRows[scenarioRows.length - 1].netValueAccrual : 0;

  const revenueCAGR = useMemo(() => {
    if (scenarioRows.length < 2) return 0;
    const first = scenarioRows[0].projectedRevenue;
    const last = scenarioRows[scenarioRows.length - 1].projectedRevenue;
    if (first <= 0 || last <= 0) return 0;
    const years = scenarioRows.length - 1;
    return (Math.pow(last / first, 1 / years) - 1) * 100;
  }, [scenarioRows]);

  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

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
                {project.name} - Revenue Forecast
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-project-symbol">
                {project.symbol?.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            variant="outline"
            data-testid="button-seed"
          >
            {seedMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {seedMutation.isPending ? "Seeding..." : "Auto-seed from DefiLlama"}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty}
            data-testid="button-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Tabs value={scenario} onValueChange={setScenario} data-testid="tabs-scenario">
        <TabsList>
          <TabsTrigger value="bull" data-testid="tab-bull">Bull</TabsTrigger>
          <TabsTrigger value="base" data-testid="tab-base">Base</TabsTrigger>
          <TabsTrigger value="bear" data-testid="tab-bear">Bear</TabsTrigger>
        </TabsList>

        {["bull", "base", "bear"].map((s) => (
          <TabsContent key={s} value={s} className="mt-4 space-y-4">
            {forecastsLoading ? (
              <div className="flex items-center justify-center h-48" data-testid="loading-forecasts">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : scenarioRows.length === 0 ? (
              <Card data-testid="card-no-data">
                <CardContent className="py-8 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No forecast data yet. Click "Auto-seed from DefiLlama" to generate projections.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card data-testid="card-forecast-table">
                  <CardContent className="pt-4 overflow-x-auto">
                    <Table data-testid="table-forecasts">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead>Projected Fees</TableHead>
                          <TableHead>Growth Rate %</TableHead>
                          <TableHead>Take Rate %</TableHead>
                          <TableHead>Projected Revenue</TableHead>
                          <TableHead>Emission Cost</TableHead>
                          <TableHead>Net Value Accrual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarioRows.map((row, idx) => (
                          <TableRow key={row.year} data-testid={`row-forecast-${row.year}`}>
                            <TableCell className="font-medium" data-testid={`text-year-${row.year}`}>
                              {row.year}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={scenario === "base" ? rows[idx]?.projectedFees ?? 0 : row.projectedFees}
                                onChange={(e) => updateRow(idx, "projectedFees", parseFloat(e.target.value) || 0)}
                                disabled={scenario !== "base"}
                                className="w-32"
                                data-testid={`input-fees-${row.year}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={rows[idx]?.growthRate ?? 0}
                                onChange={(e) => updateRow(idx, "growthRate", parseFloat(e.target.value) || 0)}
                                disabled={scenario !== "base"}
                                className="w-24"
                                data-testid={`input-growth-${row.year}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={rows[idx]?.takeRate ?? 0}
                                onChange={(e) => updateRow(idx, "takeRate", parseFloat(e.target.value) || 0)}
                                disabled={scenario !== "base"}
                                className="w-24"
                                data-testid={`input-takerate-${row.year}`}
                              />
                            </TableCell>
                            <TableCell data-testid={`text-revenue-${row.year}`}>
                              {formatCompact(row.projectedRevenue)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={rows[idx]?.emissionCost ?? 0}
                                onChange={(e) => updateRow(idx, "emissionCost", parseFloat(e.target.value) || 0)}
                                disabled={scenario !== "base"}
                                className="w-32"
                                data-testid={`input-emission-${row.year}`}
                              />
                            </TableCell>
                            <TableCell
                              className={row.netValueAccrual >= 0 ? "text-green-500" : "text-red-500"}
                              data-testid={`text-netaccrual-${row.year}`}
                            >
                              {formatCompact(row.netValueAccrual)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card data-testid="card-chart">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Revenue Forecast Chart</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80" data-testid="chart-forecast">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="year"
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            tickFormatter={formatYAxis}
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip
                            formatter={(value: number) => formatCompact(value)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              color: "hsl(var(--card-foreground))",
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="projectedRevenue"
                            fill="#3b82f6"
                            name="Projected Revenue"
                            radius={[2, 2, 0, 0]}
                          />
                          <Bar
                            dataKey="emissionCost"
                            fill="#ef4444"
                            name="Emission Cost"
                            radius={[2, 2, 0, 0]}
                          />
                          <Line
                            type="monotone"
                            dataKey="netValueAccrual"
                            stroke="#22c55e"
                            strokeWidth={2}
                            name="Net Value Accrual"
                            dot={{ r: 4 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card data-testid="card-cumulative-revenue">
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium">Cumulative Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold" data-testid="text-cumulative-revenue">
                        {formatCompact(cumulativeRevenue)}
                      </div>
                      <p className="text-xs text-muted-foreground">Total across all years</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-avg-growth">
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium">Avg Growth Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold" data-testid="text-avg-growth">
                        {avgGrowthRate.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Average across periods</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-terminal-accrual">
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium">Terminal Net Accrual</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-xl font-bold ${terminalNetAccrual >= 0 ? "text-green-500" : "text-red-500"}`}
                        data-testid="text-terminal-accrual"
                      >
                        {formatCompact(terminalNetAccrual)}
                      </div>
                      <p className="text-xs text-muted-foreground">Final year net value</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-revenue-cagr">
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium">Revenue CAGR</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold" data-testid="text-revenue-cagr">
                        {revenueCAGR.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Compound annual growth</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
