import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import type { FinancialModel, RevenueLineItem, RevenuePeriod } from "@shared/schema";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, DollarSign } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function RevenueForecast() {
  const { data: models, isLoading: modelsLoading } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const model = models?.[0];

  const { data: lineItems } = useQuery<RevenueLineItem[]>({
    queryKey: ["/api/models", model?.id, "revenue-line-items"],
    enabled: !!model,
  });

  const { data: periods } = useQuery<RevenuePeriod[]>({
    queryKey: ["/api/models", model?.id, "revenue-periods"],
    enabled: !!model,
  });

  if (modelsLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (!model) {
    return <div className="p-4 text-muted-foreground">No financial model found.</div>;
  }

  const years = model ? Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i) : [];

  const getAmount = (lineItemId: string, year: number, quarter?: number) => {
    if (!periods) return 0;
    const match = periods.find(p =>
      p.lineItemId === lineItemId && p.year === year && (quarter ? p.quarter === quarter : !p.quarter)
    );
    return match?.amount || 0;
  };

  const getQuarterlyAmount = (lineItemId: string, year: number, quarter: number) => {
    return getAmount(lineItemId, year, quarter);
  };

  const getAnnualTotal = (lineItemId: string, year: number) => {
    let total = 0;
    for (let q = 1; q <= 4; q++) {
      total += getQuarterlyAmount(lineItemId, year, q);
    }
    const annualDirect = getAmount(lineItemId, year);
    return annualDirect > 0 ? annualDirect : total;
  };

  const getTotalRevenue = (year: number) => {
    if (!lineItems) return 0;
    return lineItems.reduce((sum, li) => sum + getAnnualTotal(li.id, year), 0);
  };

  const calcYoYGrowth = (year: number) => {
    const current = getTotalRevenue(year);
    const prior = getTotalRevenue(year - 1);
    if (!prior || prior === 0) return null;
    return (current - prior) / Math.abs(prior);
  };

  const annualChartData = years.map(year => {
    const entry: Record<string, number | string> = { year };
    lineItems?.forEach(li => {
      entry[li.name] = getAnnualTotal(li.id, year);
    });
    return entry;
  });

  const quarterlyChartData: Array<Record<string, number | string>> = [];
  years.forEach(year => {
    for (let q = 1; q <= 4; q++) {
      const entry: Record<string, number | string> = { period: `${year} Q${q}` };
      let total = 0;
      lineItems?.forEach(li => {
        const amt = getQuarterlyAmount(li.id, year, q);
        entry[li.name] = amt;
        total += amt;
      });
      entry["Total"] = total;
      quarterlyChartData.push(entry);
    }
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Revenue Forecast</h1>
          <p className="text-sm text-muted-foreground">Revenue streams with quarterly breakdown</p>
        </div>
        <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {years.slice(-3).map(year => (
          <Card key={year} data-testid={`card-revenue-${year}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{year} Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-revenue-${year}`}>{formatCurrency(getTotalRevenue(year))}</div>
              {calcYoYGrowth(year) !== null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span data-testid={`text-growth-${year}`}>{formatPercent(calcYoYGrowth(year)!)} YoY</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="table" data-testid="tabs-revenue">
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
          <TabsTrigger value="annual-chart" data-testid="tab-annual-chart">Annual Chart</TabsTrigger>
          <TabsTrigger value="quarterly-chart" data-testid="tab-quarterly-chart">Quarterly Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table data-testid="table-revenue">
                <TableHeader>
                  <TableRow>
                    <TableHead>Revenue Stream</TableHead>
                    {years.map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems?.map(li => (
                    <TableRow key={li.id} data-testid={`row-revenue-${li.id}`}>
                      <TableCell className="font-medium">{li.name}</TableCell>
                      {years.map(year => (
                        <TableCell key={year} className="text-right">
                          {formatCurrency(getAnnualTotal(li.id, year))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Revenue</TableCell>
                    {years.map(year => (
                      <TableCell key={year} className="text-right" data-testid={`text-total-${year}`}>
                        {formatCurrency(getTotalRevenue(year))}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">YoY Growth</TableCell>
                    {years.map(year => {
                      const growth = calcYoYGrowth(year);
                      return (
                        <TableCell key={year} className="text-right">
                          {growth !== null ? (
                            <Badge variant={growth >= 0 ? "default" : "destructive"}>
                              {formatPercent(growth)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual-chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Annual Revenue by Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {lineItems?.map((li, i) => (
                      <Bar key={li.id} dataKey={li.name} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly-chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quarterly Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={quarterlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" angle={-45} textAnchor="end" height={60} />
                    <YAxis className="text-xs" tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {lineItems?.map((li, i) => (
                      <Area key={li.id} type="monotone" dataKey={li.name} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
