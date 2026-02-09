import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FinancialModel, RevenueLineItem, RevenuePeriod } from "@shared/schema";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, DollarSign, Save, RefreshCw, ArrowRight } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function RevenueForecast() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<Record<string, number>>({});

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedPeriods).map(([id, amount]) =>
        apiRequest("PATCH", `/api/revenue-periods/${id}`, { amount })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models", model?.id, "revenue-periods"] });
      setEditedPeriods({});
      toast({ title: "Revenue saved", description: "Revenue periods updated successfully." });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      await apiRequest("POST", `/api/models/${model!.id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "revenue-line-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "dcf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "valuation-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", model!.id, "assumptions"] });
      setEditMode(false);
      toast({ title: "Model recalculated", description: "All financial statements have been updated from your revenue changes." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (modelsLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!model) return <div className="p-4 text-muted-foreground">No financial model found.</div>;

  const years = Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i);

  const getPeriod = (lineItemId: string, year: number, quarter: number): RevenuePeriod | undefined => {
    return periods?.find(p => p.lineItemId === lineItemId && p.year === year && p.quarter === quarter);
  };

  const getEditedAmount = (periodId: string, original: number): number => {
    return editedPeriods[periodId] !== undefined ? editedPeriods[periodId] : original;
  };

  const getQuarterlyAmount = (lineItemId: string, year: number, quarter: number) => {
    const p = getPeriod(lineItemId, year, quarter);
    if (!p) return 0;
    return getEditedAmount(p.id, p.amount || 0);
  };

  const getAnnualTotal = (lineItemId: string, year: number) => {
    let total = 0;
    for (let q = 1; q <= 4; q++) {
      total += getQuarterlyAmount(lineItemId, year, q);
    }
    return total;
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

  const handleEdit = (periodId: string, value: string) => {
    const num = parseFloat(value.replace(/,/g, "")) || 0;
    setEditedPeriods(prev => ({ ...prev, [periodId]: num }));
  };

  const hasEdits = Object.keys(editedPeriods).length > 0;

  const annualChartData = years.map(year => {
    const entry: Record<string, number | string> = { year };
    lineItems?.forEach(li => { entry[li.name] = getAnnualTotal(li.id, year); });
    return entry;
  });

  const quarterlyChartData: Array<Record<string, number | string>> = [];
  years.forEach(year => {
    for (let q = 1; q <= 4; q++) {
      const entry: Record<string, number | string> = { period: `${year} Q${q}` };
      lineItems?.forEach(li => { entry[li.name] = getQuarterlyAmount(li.id, year, q); });
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-model-name">{model.name}</Badge>
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => { setEditMode(false); setEditedPeriods({}); }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => recalcMutation.mutate()}
                disabled={!hasEdits || recalcMutation.isPending}
                data-testid="button-save-recalculate"
              >
                {recalcMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Recalculating...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save & Recalculate</>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-revenue">
              Edit Revenue
            </Button>
          )}
        </div>
      </div>

      {editMode && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              <span>Edit quarterly revenue values below. Changes will cascade through Income Statement, Balance Sheet, Cash Flow, DCF, and Valuation.</span>
            </div>
          </CardContent>
        </Card>
      )}

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

      <Tabs defaultValue="quarterly" data-testid="tabs-revenue">
        <TabsList>
          <TabsTrigger value="quarterly" data-testid="tab-quarterly">Quarterly Detail</TabsTrigger>
          <TabsTrigger value="table" data-testid="tab-table">Annual Summary</TabsTrigger>
          <TabsTrigger value="annual-chart" data-testid="tab-annual-chart">Annual Chart</TabsTrigger>
          <TabsTrigger value="quarterly-chart" data-testid="tab-quarterly-chart">Quarterly Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly">
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table data-testid="table-quarterly-revenue">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Revenue Stream</TableHead>
                      {years.map(year => (
                        [1, 2, 3, 4].map(q => (
                          <TableHead key={`${year}-Q${q}`} className="text-right text-xs min-w-[90px]">
                            {year} Q{q}
                          </TableHead>
                        ))
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems?.map(li => (
                      <TableRow key={li.id} data-testid={`row-revenue-${li.id}`}>
                        <TableCell className="font-medium text-sm">{li.name}</TableCell>
                        {years.map(year =>
                          [1, 2, 3, 4].map(q => {
                            const period = getPeriod(li.id, year, q);
                            const amt = period ? getEditedAmount(period.id, period.amount || 0) : 0;
                            const isEdited = period && editedPeriods[period.id] !== undefined;
                            return (
                              <TableCell key={`${year}-Q${q}`} className="text-right p-1">
                                {editMode && period ? (
                                  <Input
                                    type="text"
                                    value={Math.round(amt).toLocaleString()}
                                    onChange={(e) => handleEdit(period.id, e.target.value)}
                                    className={`h-7 text-xs text-right ${isEdited ? "border-blue-500" : ""}`}
                                    data-testid={`input-revenue-${li.id}-${year}-Q${q}`}
                                  />
                                ) : (
                                  <span className="text-xs">{formatCurrency(amt)}</span>
                                )}
                              </TableCell>
                            );
                          })
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      {years.map(year =>
                        [1, 2, 3, 4].map(q => {
                          let total = 0;
                          lineItems?.forEach(li => { total += getQuarterlyAmount(li.id, year, q); });
                          return (
                            <TableCell key={`total-${year}-Q${q}`} className="text-right text-xs">
                              {formatCurrency(total)}
                            </TableCell>
                          );
                        })
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <TableRow key={li.id}>
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
