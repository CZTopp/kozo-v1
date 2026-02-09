import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatNumber, generateForecast, generateAnnualSummary } from "@/lib/calculations";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import type { FinancialModel, Assumptions, Scenario, Actual } from "@shared/schema";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

const chartColors = {
  revenue: "hsl(var(--chart-1))",
  netIncome: "hsl(var(--chart-2))",
  cashBalance: "hsl(var(--chart-3))",
  customers: "hsl(var(--chart-4))",
  forecast: "hsl(var(--chart-1))",
  actual: "hsl(var(--chart-5))",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" && entry.name !== "Customers"
            ? formatCurrency(entry.value, true)
            : formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: models, isLoading: modelsLoading } = useQuery<FinancialModel[]>({
    queryKey: ["/api/models"],
  });

  const { data: allAssumptions, isLoading: assumpLoading } = useQuery<Assumptions[]>({
    queryKey: ["/api/assumptions"],
  });

  const { data: allScenarios } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios"],
  });

  const { data: allActuals } = useQuery<Actual[]>({
    queryKey: ["/api/actuals"],
  });

  const isLoading = modelsLoading || assumpLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your financial models and forecasts</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const activeModel = models?.[0];
  const modelAssumptions = allAssumptions?.filter(a => a.modelId === activeModel?.id && !a.scenarioId);
  const baseAssumption = modelAssumptions?.[0];

  let forecast: ReturnType<typeof generateForecast> = [];
  let annualSummary: ReturnType<typeof generateAnnualSummary> = [];

  if (activeModel && baseAssumption) {
    forecast = generateForecast(baseAssumption, activeModel.startYear, activeModel.endYear);
    annualSummary = generateAnnualSummary(forecast);
  }

  const currentMonth = forecast[forecast.length - 1];
  const firstMonth = forecast[0];
  const scenarios = allScenarios?.filter(s => s.modelId === activeModel?.id) || [];
  const actualsForModel = allActuals?.filter(a => a.modelId === activeModel?.id) || [];

  const totalRevenue = annualSummary.reduce((s, y) => s + y.revenue, 0);
  const endCash = currentMonth?.cashBalance || 0;
  const endCustomers = currentMonth?.customers || 0;
  const runwayMonths = currentMonth?.runway;

  const revenueChartData = annualSummary.map(y => ({
    name: String(y.year),
    Revenue: y.revenue,
    "Net Income": y.netIncome,
  }));

  const cashChartData = forecast.filter((_, i) => i % 3 === 0).map(r => ({
    name: r.period,
    "Cash Balance": r.cashBalance,
    Customers: r.customers,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeModel ? `Viewing: ${activeModel.name}` : "Create a model to get started"}
        </p>
      </div>

      {!activeModel ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Models Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Create your first financial model to see projections, scenarios, and performance metrics here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Projected Revenue"
              value={formatCurrency(totalRevenue, true)}
              subtitle={`${activeModel.startYear}-${activeModel.endYear}`}
              icon={DollarSign}
            />
            <MetricCard
              title="End Cash Balance"
              value={formatCurrency(endCash, true)}
              subtitle="At forecast end"
              icon={TrendingUp}
              trend={firstMonth && endCash > Number(baseAssumption?.initialCash || 0) ? ((endCash - Number(baseAssumption?.initialCash || 0)) / Number(baseAssumption?.initialCash || 1)) * 100 : undefined}
            />
            <MetricCard
              title="Customers"
              value={formatNumber(endCustomers)}
              subtitle="Projected at end"
              icon={Users}
            />
            <MetricCard
              title="Runway"
              value={runwayMonths !== null && runwayMonths !== undefined ? `${runwayMonths} mo` : "Profitable"}
              subtitle={runwayMonths !== null && runwayMonths !== undefined ? "Months of cash left" : "Cash flow positive"}
              icon={Clock}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base font-semibold">Revenue & Net Income</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: chartColors.revenue }} />
                    Revenue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: chartColors.netIncome }} />
                    Net Income
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="chart-revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v, true)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Revenue" fill={chartColors.revenue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Net Income" fill={chartColors.netIncome} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base font-semibold">Cash Balance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="chart-cash">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v, true)} />
                      <Tooltip content={<CustomTooltip />} />
                      <defs>
                        <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.cashBalance} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={chartColors.cashBalance} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="Cash Balance" stroke={chartColors.cashBalance} fill="url(#cashGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Key Assumptions</CardTitle>
              </CardHeader>
              <CardContent>
                {baseAssumption && (
                  <div className="space-y-3">
                    {[
                      { label: "Revenue Growth", value: `${(Number(baseAssumption.revenueGrowthRate) * 100).toFixed(0)}%` },
                      { label: "Churn Rate", value: `${(Number(baseAssumption.churnRate) * 100).toFixed(1)}%` },
                      { label: "ARPU", value: formatCurrency(Number(baseAssumption.avgRevenuePerUnit)) },
                      { label: "Gross Margin", value: `${((1 - Number(baseAssumption.cogsPercent)) * 100).toFixed(0)}%` },
                      { label: "Initial Cash", value: formatCurrency(Number(baseAssumption.initialCash), true) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-medium" data-testid={`text-assumption-${item.label.toLowerCase().replace(/\s/g, "-")}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Scenarios</CardTitle>
              </CardHeader>
              <CardContent>
                {scenarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No scenarios created yet</p>
                ) : (
                  <div className="space-y-3">
                    {scenarios.map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground capitalize">{s.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Actuals Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                {actualsForModel.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No actuals entered yet</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Periods tracked</span>
                      <span className="text-sm font-medium">{actualsForModel.length}</span>
                    </div>
                    {actualsForModel.slice(-3).map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{a.period}</span>
                        <span className="font-medium">{a.revenue ? formatCurrency(Number(a.revenue), true) : "---"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
