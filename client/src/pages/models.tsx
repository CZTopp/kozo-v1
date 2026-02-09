import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileSpreadsheet, Settings, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { generateForecast, generateAnnualSummary, formatCurrency, formatPercent, formatNumber } from "@/lib/calculations";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { FinancialModel, Assumptions } from "@shared/schema";

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

function CreateModelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    description: "",
    currency: "USD",
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 4,
    revenueGrowthRate: "0.15",
    churnRate: "0.05",
    avgRevenuePerUnit: "100",
    initialCustomers: "100",
    cogsPercent: "0.30",
    salesMarketingPercent: "0.20",
    rdPercent: "0.15",
    gaPercent: "0.10",
    taxRate: "0.25",
    capexPercent: "0.05",
    initialCash: "100000",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/models", {
        name: form.name,
        description: form.description,
        currency: form.currency,
        startYear: form.startYear,
        endYear: form.endYear,
        assumptions: {
          revenueGrowthRate: form.revenueGrowthRate,
          churnRate: form.churnRate,
          avgRevenuePerUnit: form.avgRevenuePerUnit,
          initialCustomers: parseInt(form.initialCustomers),
          cogsPercent: form.cogsPercent,
          salesMarketingPercent: form.salesMarketingPercent,
          rdPercent: form.rdPercent,
          gaPercent: form.gaPercent,
          taxRate: form.taxRate,
          capexPercent: form.capexPercent,
          initialCash: form.initialCash,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assumptions"] });
      onOpenChange(false);
      toast({ title: "Model created", description: "Your financial model has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: "Validation Error", description: "Please enter a model name", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Financial Model</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Model Name</Label>
              <Input id="name" data-testid="input-model-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SaaS Growth Model 2026" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" data-testid="input-model-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this model..." className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Start Year</Label>
              <Input type="number" data-testid="input-start-year" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>End Year</Label>
              <Input type="number" data-testid="input-end-year" value={form.endYear} onChange={(e) => setForm({ ...form, endYear: parseInt(e.target.value) })} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Key Assumptions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: "revenueGrowthRate", label: "Annual Revenue Growth", suffix: "%" },
                { key: "churnRate", label: "Monthly Churn Rate", suffix: "%" },
                { key: "avgRevenuePerUnit", label: "Avg Revenue / Unit", suffix: "$" },
                { key: "initialCustomers", label: "Initial Customers", suffix: "#" },
                { key: "cogsPercent", label: "COGS % of Revenue", suffix: "%" },
                { key: "salesMarketingPercent", label: "Sales & Marketing %", suffix: "%" },
                { key: "rdPercent", label: "R&D %", suffix: "%" },
                { key: "gaPercent", label: "G&A %", suffix: "%" },
                { key: "taxRate", label: "Tax Rate", suffix: "%" },
                { key: "initialCash", label: "Initial Cash", suffix: "$" },
              ].map(({ key, label, suffix }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      data-testid={`input-assumption-${key}`}
                      value={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-testid="button-create-model" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Model"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModelDetail({ model, assumptions }: { model: FinancialModel; assumptions?: Assumptions }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("forecast");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/models/${model.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assumptions"] });
      toast({ title: "Model deleted" });
    },
  });

  let forecast = assumptions ? generateForecast(assumptions, model.startYear, model.endYear) : [];
  let annual = generateAnnualSummary(forecast);

  const revenueData = annual.map((y) => ({
    name: String(y.year),
    Revenue: y.revenue,
    COGS: y.cogs,
    "Gross Profit": y.grossProfit,
  }));

  const plData = annual.map((y) => ({
    name: String(y.year),
    EBITDA: y.ebitda,
    "Net Income": y.netIncome,
  }));

  return (
    <Card data-testid={`card-model-${model.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">{model.name}</CardTitle>
          {model.description && <CardDescription>{model.description}</CardDescription>}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge variant="secondary">{model.startYear} - {model.endYear}</Badge>
            <Badge variant="outline">{model.currency}</Badge>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate()} data-testid={`button-delete-model-${model.id}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="forecast" data-testid="tab-forecast">Forecast</TabsTrigger>
            <TabsTrigger value="income" data-testid="tab-income">Income Statement</TabsTrigger>
            <TabsTrigger value="cashflow" data-testid="tab-cashflow">Cash Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gross Profit" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="EBITDA" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Net Income" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Year</TableHead>
                    <TableHead className="text-right font-semibold">Revenue</TableHead>
                    <TableHead className="text-right font-semibold">Gross Profit</TableHead>
                    <TableHead className="text-right font-semibold">EBITDA</TableHead>
                    <TableHead className="text-right font-semibold">Net Income</TableHead>
                    <TableHead className="text-right font-semibold">Cash</TableHead>
                    <TableHead className="text-right font-semibold">Customers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annual.map((y) => (
                    <TableRow key={y.year}>
                      <TableCell className="font-medium">{y.year}</TableCell>
                      <TableCell className="text-right">{formatCurrency(y.revenue, true)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(y.grossProfit, true)}</TableCell>
                      <TableCell className="text-right">
                        <span className={y.ebitda < 0 ? "text-red-600 dark:text-red-400" : ""}>{formatCurrency(y.ebitda, true)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={y.netIncome < 0 ? "text-red-600 dark:text-red-400" : ""}>{formatCurrency(y.netIncome, true)}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(y.cashBalance, true)}</TableCell>
                      <TableCell className="text-right">{formatNumber(y.customers)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Year</TableHead>
                    <TableHead className="text-right font-semibold">Revenue</TableHead>
                    <TableHead className="text-right font-semibold">COGS</TableHead>
                    <TableHead className="text-right font-semibold">Gross Profit</TableHead>
                    <TableHead className="text-right font-semibold">S&M</TableHead>
                    <TableHead className="text-right font-semibold">R&D</TableHead>
                    <TableHead className="text-right font-semibold">G&A</TableHead>
                    <TableHead className="text-right font-semibold">Total Opex</TableHead>
                    <TableHead className="text-right font-semibold">Net Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annual.map((y) => {
                    const months = forecast.filter(f => f.year === y.year);
                    const sm = months.reduce((s, m) => s + m.salesMarketing, 0);
                    const rd = months.reduce((s, m) => s + m.rd, 0);
                    const ga = months.reduce((s, m) => s + m.ga, 0);
                    return (
                      <TableRow key={y.year}>
                        <TableCell className="font-medium">{y.year}</TableCell>
                        <TableCell className="text-right">{formatCurrency(y.revenue, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(y.cogs, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(y.grossProfit, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sm, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(rd, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ga, true)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(y.totalOpex, true)}</TableCell>
                        <TableCell className="text-right">
                          <span className={y.netIncome < 0 ? "text-red-600 dark:text-red-400" : ""}>{formatCurrency(y.netIncome, true)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cashflow" className="mt-4">
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.filter((_, i) => i % 3 === 0).map(r => ({ name: r.period, "Cash Balance": r.cashBalance }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v, true)} />
                  <Tooltip content={<CustomTooltip />} />
                  <defs>
                    <linearGradient id="cashGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="Cash Balance" stroke="hsl(var(--chart-3))" fill="url(#cashGrad2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Year</TableHead>
                    <TableHead className="text-right font-semibold">Net Cash Flow</TableHead>
                    <TableHead className="text-right font-semibold">End Cash</TableHead>
                    <TableHead className="text-right font-semibold">Runway</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annual.map((y) => (
                    <TableRow key={y.year}>
                      <TableCell className="font-medium">{y.year}</TableCell>
                      <TableCell className="text-right">
                        <span className={y.cashFlow < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {formatCurrency(y.cashFlow, true)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(y.cashBalance, true)}</TableCell>
                      <TableCell className="text-right">
                        {y.runway !== null && y.runway !== undefined ? `${y.runway} mo` : <Badge variant="secondary">Profitable</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function ModelsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: models, isLoading } = useQuery<FinancialModel[]>({
    queryKey: ["/api/models"],
  });

  const { data: allAssumptions } = useQuery<Assumptions[]>({
    queryKey: ["/api/assumptions"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Financial Models</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage your financial projections</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-model">
          <Plus className="h-4 w-4 mr-2" />
          New Model
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : models?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Models Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Create your first financial model with revenue projections, cost structure, and cash flow forecasts.
            </p>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-model">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Model
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {models?.map((model) => {
            const modelAssumptions = allAssumptions?.filter(a => a.modelId === model.id && !a.scenarioId);
            return (
              <ModelDetail
                key={model.id}
                model={model}
                assumptions={modelAssumptions?.[0]}
              />
            );
          })}
        </div>
      )}

      <CreateModelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
