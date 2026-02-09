import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, BarChart3, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { generateForecast, calculateVariance, formatCurrency, formatPercent } from "@/lib/calculations";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { FinancialModel, Assumptions, Actual } from "@shared/schema";
import { cn } from "@/lib/utils";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value, true)}
        </p>
      ))}
    </div>
  );
}

function AddActualDialog({ open, onOpenChange, modelId }: { open: boolean; onOpenChange: (o: boolean) => void; modelId: string }) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [form, setForm] = useState({
    period: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
    revenue: "",
    cogs: "",
    operatingExpenses: "",
    netIncome: "",
    cashBalance: "",
    customers: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/actuals", {
        modelId,
        period: form.period,
        revenue: form.revenue || null,
        cogs: form.cogs || null,
        operatingExpenses: form.operatingExpenses || null,
        netIncome: form.netIncome || null,
        cashBalance: form.cashBalance || null,
        customers: form.customers ? parseInt(form.customers) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actuals"] });
      onOpenChange(false);
      toast({ title: "Actuals added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Actual Data</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Period (YYYY-MM)</Label>
            <Input data-testid="input-actual-period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-01" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "revenue", label: "Revenue" },
              { key: "cogs", label: "COGS" },
              { key: "operatingExpenses", label: "Operating Expenses" },
              { key: "netIncome", label: "Net Income" },
              { key: "cashBalance", label: "Cash Balance" },
              { key: "customers", label: "Customers" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input type="number" data-testid={`input-actual-${key}`} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder="0" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="button-add-actual" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Actual"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ActualsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  const { data: models, isLoading: ml } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const { data: allAssumptions, isLoading: al } = useQuery<Assumptions[]>({ queryKey: ["/api/assumptions"] });
  const { data: allActuals, isLoading: acl } = useQuery<Actual[]>({ queryKey: ["/api/actuals"] });

  const isLoading = ml || al || acl;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/actuals/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actuals"] });
      toast({ title: "Actual deleted" });
    },
  });

  const activeModel = models?.[0];
  const baseAssumption = allAssumptions?.find((a) => a.modelId === activeModel?.id && !a.scenarioId);
  const modelActuals = allActuals?.filter((a) => a.modelId === activeModel?.id) || [];

  let varianceData: ReturnType<typeof calculateVariance> = [];
  if (activeModel && baseAssumption && modelActuals.length > 0) {
    const forecast = generateForecast(baseAssumption, activeModel.startYear, activeModel.endYear);
    varianceData = calculateVariance(forecast, modelActuals).filter((v) => v.actualRevenue !== null);
  }

  const chartData = varianceData.map((v) => ({
    period: v.period,
    Forecast: v.forecastRevenue,
    Actual: v.actualRevenue || 0,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Actuals & Variance</h1>
          <p className="text-sm text-muted-foreground mt-1">Track performance against your forecasts</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!activeModel} data-testid="button-add-actual">
          <Plus className="h-4 w-4 mr-2" />
          Add Actuals
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !activeModel ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create a Model First</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              You need a financial model before tracking actuals against forecasts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Forecast vs Actual Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="chart-variance">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="Forecast" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} opacity={0.6} />
                      <Bar dataKey="Actual" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {varianceData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Variance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Period</TableHead>
                        <TableHead className="text-right font-semibold">Forecast Rev.</TableHead>
                        <TableHead className="text-right font-semibold">Actual Rev.</TableHead>
                        <TableHead className="text-right font-semibold">Variance</TableHead>
                        <TableHead className="text-right font-semibold">Variance %</TableHead>
                        <TableHead className="text-right font-semibold">Forecast Cash</TableHead>
                        <TableHead className="text-right font-semibold">Actual Cash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {varianceData.map((v) => (
                        <TableRow key={v.period}>
                          <TableCell className="font-medium">{v.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(v.forecastRevenue, true)}</TableCell>
                          <TableCell className="text-right">{v.actualRevenue !== null ? formatCurrency(v.actualRevenue, true) : "---"}</TableCell>
                          <TableCell className="text-right">
                            {v.revenueVariance !== null ? (
                              <span className={cn("flex items-center justify-end gap-1", v.revenueVariance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                {v.revenueVariance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatCurrency(Math.abs(v.revenueVariance), true)}
                              </span>
                            ) : "---"}
                          </TableCell>
                          <TableCell className="text-right">
                            {v.revenueVariancePercent !== null ? (
                              <Badge variant={v.revenueVariancePercent >= 0 ? "secondary" : "destructive"} className="text-xs">
                                {formatPercent(v.revenueVariancePercent)}
                              </Badge>
                            ) : "---"}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(v.forecastCash, true)}</TableCell>
                          <TableCell className="text-right">{v.actualCash !== null ? formatCurrency(v.actualCash, true) : "---"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Raw Actuals Data</CardTitle>
            </CardHeader>
            <CardContent>
              {modelActuals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No actuals entered yet for this model</p>
                  <Button onClick={() => setAddOpen(true)} variant="outline" data-testid="button-add-first-actual">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Actual
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Period</TableHead>
                        <TableHead className="text-right font-semibold">Revenue</TableHead>
                        <TableHead className="text-right font-semibold">COGS</TableHead>
                        <TableHead className="text-right font-semibold">Net Income</TableHead>
                        <TableHead className="text-right font-semibold">Cash</TableHead>
                        <TableHead className="text-right font-semibold">Customers</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelActuals.sort((a, b) => a.period.localeCompare(b.period)).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.period}</TableCell>
                          <TableCell className="text-right">{a.revenue ? formatCurrency(Number(a.revenue)) : "---"}</TableCell>
                          <TableCell className="text-right">{a.cogs ? formatCurrency(Number(a.cogs)) : "---"}</TableCell>
                          <TableCell className="text-right">{a.netIncome ? formatCurrency(Number(a.netIncome)) : "---"}</TableCell>
                          <TableCell className="text-right">{a.cashBalance ? formatCurrency(Number(a.cashBalance)) : "---"}</TableCell>
                          <TableCell className="text-right">{a.customers ?? "---"}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeModel && (
        <AddActualDialog open={addOpen} onOpenChange={setAddOpen} modelId={activeModel.id} />
      )}
    </div>
  );
}
