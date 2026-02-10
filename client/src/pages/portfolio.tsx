import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPercent, calcPortfolioMetrics } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PortfolioPosition, PortfolioRedFlag, MacroIndicator, MarketIndex } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Activity, Plus, Pencil, Trash2 } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f97316", "#06b6d4", "#8b5cf6"];

const SECTORS = [
  "Technology", "Healthcare", "Financials", "Consumer Discretionary", "Consumer Staples",
  "Energy", "Industrials", "Materials", "Real Estate", "Utilities", "Communication Services",
];

const emptyForm = {
  ticker: "",
  companyName: "",
  sector: "Technology",
  industry: "",
  sharesHeld: 100,
  purchasePrice: 0,
  currentPrice: 0,
  beta: 1,
  peRatio: 0,
  eps: 0,
  dividendYield: 0,
  ma50: 0,
  ma200: 0,
  week52Low: 0,
  week52High: 0,
  stopLoss: 0,
  positionType: "long",
  catalyst: "",
  comments: "",
};

type PositionForm = typeof emptyForm;

function computeDerived(form: PositionForm) {
  const shares = Number(form.sharesHeld) || 0;
  const current = Number(form.currentPrice) || 0;
  const purchase = Number(form.purchasePrice) || 0;
  const positionValue = shares * current;
  const costBasis = shares * purchase;
  const gainLossDollar = positionValue - costBasis;
  const gainLossPercent = costBasis > 0 ? gainLossDollar / costBasis : 0;
  const ma50 = Number(form.ma50) || 0;
  const ma200 = Number(form.ma200) || 0;
  const goldenCross = ma50 > ma200 && ma50 > 0 && ma200 > 0;

  return {
    positionValue,
    gainLossDollar,
    gainLossPercent,
    goldenCross,
    changeFromMa50: current > 0 && ma50 > 0 ? (current - ma50) / ma50 : 0,
    changeFromMa200: current > 0 && ma200 > 0 ? (current - ma200) / ma200 : 0,
    dailyChangePercent: 0,
    dailyChange: 0,
    dayHigh: current,
    dayLow: current,
    openPrice: current,
    previousClose: current,
    daysSinceGoldenCross: 0,
  };
}

function positionToForm(p: PortfolioPosition): PositionForm {
  return {
    ticker: p.ticker || "",
    companyName: p.companyName || "",
    sector: p.sector || "Technology",
    industry: p.industry || "",
    sharesHeld: p.sharesHeld || 100,
    purchasePrice: p.purchasePrice || 0,
    currentPrice: p.currentPrice || 0,
    beta: p.beta || 1,
    peRatio: p.peRatio || 0,
    eps: p.eps || 0,
    dividendYield: p.dividendYield || 0,
    ma50: p.ma50 || 0,
    ma200: p.ma200 || 0,
    week52Low: p.week52Low || 0,
    week52High: p.week52High || 0,
    stopLoss: p.stopLoss || 0,
    positionType: p.positionType || "long",
    catalyst: p.catalyst || "",
    comments: p.comments || "",
  };
}

export default function Portfolio() {
  const { data: positions } = useQuery<PortfolioPosition[]>({ queryKey: ["/api/portfolio"] });
  const { data: redFlags } = useQuery<PortfolioRedFlag[]>({ queryKey: ["/api/portfolio-red-flags"] });
  const { data: macro } = useQuery<MacroIndicator[]>({ queryKey: ["/api/macro-indicators"] });
  const { data: indices } = useQuery<MarketIndex[]>({ queryKey: ["/api/market-indices"] });
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<PositionForm>({ ...emptyForm });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/portfolio", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      setFormOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Position added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/portfolio/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      setFormOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      toast({ title: "Position updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      setDeleteId(null);
      toast({ title: "Position deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  }

  function openEdit(p: PortfolioPosition) {
    setEditingId(p.id);
    setForm(positionToForm(p));
    setFormOpen(true);
  }

  function handleSave() {
    if (!form.ticker.trim() || !form.companyName.trim()) {
      toast({ title: "Ticker and Company Name are required", variant: "destructive" });
      return;
    }
    const derived = computeDerived(form);
    const payload = {
      ticker: form.ticker.toUpperCase().trim(),
      companyName: form.companyName.trim(),
      sector: form.sector,
      industry: form.industry.trim() || null,
      sharesHeld: Number(form.sharesHeld) || 100,
      purchasePrice: Number(form.purchasePrice) || 0,
      currentPrice: Number(form.currentPrice) || 0,
      beta: Number(form.beta) || 1,
      peRatio: Number(form.peRatio) || 0,
      eps: Number(form.eps) || 0,
      dividendYield: Number(form.dividendYield) || 0,
      ma50: Number(form.ma50) || 0,
      ma200: Number(form.ma200) || 0,
      week52Low: Number(form.week52Low) || 0,
      week52High: Number(form.week52High) || 0,
      stopLoss: Number(form.stopLoss) || null,
      positionType: form.positionType,
      catalyst: form.catalyst.trim() || null,
      comments: form.comments.trim() || null,
      ...derived,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function setField(key: keyof PositionForm, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const metrics = positions?.length ? calcPortfolioMetrics(
    positions.map(p => ({
      currentPrice: p.currentPrice || 0,
      purchasePrice: p.purchasePrice || 0,
      sharesHeld: p.sharesHeld || 0,
      beta: p.beta || 1,
      sector: p.sector || "Other",
      dailyChangePercent: p.dailyChangePercent || 0,
    }))
  ) : null;

  const yesFlags = redFlags?.filter(f => f.answer === "Yes") || [];
  const sortedPositions = [...(positions || [])].sort((a, b) => (b.positionValue || 0) - (a.positionValue || 0));
  const goldenCrossPositions = positions?.filter(p => p.goldenCross) || [];
  const deathCrossPositions = positions?.filter(p => !p.goldenCross) || [];
  const topGainers = [...(positions || [])].sort((a, b) => (b.gainLossPercent || 0) - (a.gainLossPercent || 0)).slice(0, 5);
  const topLosers = [...(positions || [])].sort((a, b) => (a.gainLossPercent || 0) - (b.gainLossPercent || 0)).slice(0, 5);

  const deleteTarget = deleteId ? positions?.find(p => p.id === deleteId) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Portfolio Dashboard</h1>
          <p className="text-sm text-muted-foreground">{positions?.length || 0} positions tracked</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-position">
          <Plus className="h-4 w-4 mr-1" />
          Add Position
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card data-testid="card-portfolio-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">Portfolio Value <InfoTooltip content="Total market value of all positions (current price x shares). Shows unrealized gain/loss percentage and dollar amount." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics ? formatCurrency(metrics.totalValue) : "--"}</div>
            <p className={`text-xs ${(metrics?.totalGainLossPercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
              {metrics ? `${formatPercent(metrics.totalGainLossPercent)} (${formatCurrency(metrics.totalGainLoss)})` : ""}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-portfolio-beta-val">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">Weighted Beta <InfoTooltip content="Value-weighted average beta. Measures overall portfolio sensitivity to market movements. Beta > 1 means higher volatility than the market." /></CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics?.weightedBeta.toFixed(2) || "--"}</div>
            <p className="text-xs text-muted-foreground">{(metrics?.weightedBeta || 0) > 1.2 ? "Above market risk" : "Near market risk"}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-concentration">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">Concentration Risk <InfoTooltip content="Largest sector allocation as a percentage of portfolio. High concentration increases exposure to sector-specific risks." /></CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{metrics?.concentrationRisk || "--"}</div>
            <p className="text-xs text-muted-foreground">{metrics?.sectorAllocation[0]?.sector} {metrics?.sectorAllocation[0] ? `${(metrics.sectorAllocation[0].percent * 100).toFixed(0)}%` : ""}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-golden-cross">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">Golden Cross <InfoTooltip content="Count of positions where the 50-day moving average is above the 200-day moving average. A bullish technical signal." /></CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{goldenCrossPositions.length}/{positions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">MA50 above MA200</p>
          </CardContent>
        </Card>

        <Card data-testid="card-red-flags">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1">Red Flags <InfoTooltip content="Number of risk checklist items flagged as concerns. Review these in the Risk & Flags tab for portfolio health assessment." /></CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{yesFlags.length}/{redFlags?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active warnings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" data-testid="tabs-portfolio">
        <TabsList>
          <TabsTrigger value="positions">All Positions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="risk">Risk & Flags</TabsTrigger>
          <TabsTrigger value="macro">Macro & Indices</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold sticky left-0 bg-background z-10">Ticker</TableHead>
                      <TableHead className="font-semibold">Company</TableHead>
                      <TableHead className="font-semibold">Sector</TableHead>
                      <TableHead className="text-right font-semibold">Price</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">Shares</TableHead>
                      <TableHead className="text-right font-semibold">Cost Basis</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">P&L $</TableHead>
                      <TableHead className="text-right font-semibold">P&L %</TableHead>
                      <TableHead className="text-right font-semibold">P/E</TableHead>
                      <TableHead className="text-right font-semibold">Beta</TableHead>
                      <TableHead className="text-right font-semibold">MA50</TableHead>
                      <TableHead className="text-right font-semibold">MA200</TableHead>
                      <TableHead className="text-center font-semibold">Signal</TableHead>
                      <TableHead className="text-right font-semibold">52W Low</TableHead>
                      <TableHead className="text-right font-semibold">52W High</TableHead>
                      <TableHead className="text-right font-semibold">Stop Loss</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPositions.map(p => (
                      <TableRow key={p.id} data-testid={`row-position-${p.ticker}`}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">{p.ticker}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{p.companyName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.sector}</Badge></TableCell>
                        <TableCell className="text-right font-mono">${p.currentPrice?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-xs ${(p.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {((p.dailyChangePercent || 0) * 100).toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{p.sharesHeld}</TableCell>
                        <TableCell className="text-right font-mono">${p.purchasePrice?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(p.positionValue || 0)}</TableCell>
                        <TableCell className={`text-right font-mono ${(p.gainLossDollar || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatCurrency(p.gainLossDollar || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(p.gainLossPercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(p.gainLossPercent || 0)}
                        </TableCell>
                        <TableCell className="text-right">{p.peRatio?.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{p.beta?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.ma50?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.ma200?.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.goldenCross ? "default" : "destructive"} className="text-xs">
                            {p.goldenCross ? "Golden" : "Death"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">${p.week52Low?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.week52High?.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${p.stopLoss?.toFixed(2) || "--"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-${p.ticker}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)} data-testid={`button-delete-${p.ticker}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedPositions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={19} className="text-center py-8 text-muted-foreground">
                          No positions yet. Click "Add Position" to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">Sector Allocation <InfoTooltip content="Portfolio value distributed by sector. Helps identify concentration risk and diversification opportunities." /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {metrics && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.sectorAllocation} dataKey="value" nameKey="sector" cx="50%" cy="50%" outerRadius={80}
                          label={({ sector, percent }: { sector: string; percent: number }) => `${sector} ${(percent * 100).toFixed(0)}%`}>
                          {metrics.sectorAllocation.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">Position P&L <InfoTooltip content="Dollar profit or loss for each position, sorted by value. Quickly identifies your biggest winners and losers." /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedPositions.slice(0, 10).map(p => ({ name: p.ticker, "P&L": p.gainLossDollar || 0 }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="name" width={50} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="P&L" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Gainers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topGainers.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.ticker}</span>
                        <span className="text-xs text-muted-foreground">${p.currentPrice?.toFixed(2)}</span>
                      </div>
                      <Badge variant="default">{formatPercent(p.gainLossPercent || 0)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Worst Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topLosers.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.ticker}</span>
                        <span className="text-xs text-muted-foreground">${p.currentPrice?.toFixed(2)}</span>
                      </div>
                      <Badge variant={(p.gainLossPercent || 0) < 0 ? "destructive" : "default"}>
                        {formatPercent(p.gainLossPercent || 0)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">Red Flag Checklist <InfoTooltip content="Risk assessment questions covering stop-loss discipline, concentration, leverage, and other portfolio health factors." /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {redFlags?.map(f => (
                    <div key={f.id} className="flex items-start justify-between gap-2">
                      <span className="text-sm">{f.question}</span>
                      <Badge variant={f.answer === "Yes" ? "destructive" : "secondary"} className="shrink-0">
                        {f.answer}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">Technical Signals <InfoTooltip content="Positions classified by moving average crossover signals. Golden Cross (bullish) = MA50 above MA200. Death Cross (bearish) = MA50 below MA200." /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Golden Cross (Bullish)</h4>
                    <div className="flex flex-wrap gap-1">
                      {goldenCrossPositions.map(p => (
                        <Badge key={p.id} variant="default" className="text-xs">{p.ticker} ({p.daysSinceGoldenCross}d)</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Death Cross (Bearish)</h4>
                    <div className="flex flex-wrap gap-1">
                      {deathCrossPositions.map(p => (
                        <Badge key={p.id} variant="destructive" className="text-xs">{p.ticker}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Near Stop Loss</h4>
                    <div className="flex flex-wrap gap-1">
                      {positions?.filter(p => p.stopLoss && p.currentPrice && p.currentPrice < (p.stopLoss * 1.05)).map(p => (
                        <Badge key={p.id} variant="destructive" className="text-xs">
                          {p.ticker} (${p.currentPrice?.toFixed(0)} vs ${p.stopLoss?.toFixed(0)})
                        </Badge>
                      ))}
                      {!positions?.some(p => p.stopLoss && p.currentPrice && p.currentPrice < (p.stopLoss * 1.05)) && (
                        <span className="text-sm text-muted-foreground">No positions near stop loss</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">Beta Exposure by Position <InfoTooltip content="Beta values for each position. Higher beta means the position amplifies market movements. Useful for risk management." /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedPositions.map(p => ({ name: p.ticker, Beta: p.beta || 1, Value: (p.positionValue || 0) / 1000 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="Beta" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="macro" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">US Indices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {indices?.filter(i => i.region === "US").map(idx => (
                    <div key={idx.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{idx.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{idx.currentValue?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          YTD {formatPercent(idx.ytdReturn || 0)}
                        </span>
                        <span className={`text-xs ${(idx.mtdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          MTD {formatPercent(idx.mtdReturn || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">International Indices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {indices?.filter(i => i.region !== "US").map(idx => (
                    <div key={idx.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{idx.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{idx.region}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          YTD {formatPercent(idx.ytdReturn || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Macro Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {macro?.map(m => (
                    <div key={m.id} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{m.name}</span>
                      <span className="text-sm font-medium">
                        {m.displayFormat === "percent" ? `${(m.value * 100).toFixed(2)}%` : m.value.toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs w-fit">{m.category}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-position-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">{editingId ? "Edit Position" : "Add Position"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker *</Label>
              <Input id="ticker" value={form.ticker} onChange={e => setField("ticker", e.target.value)} placeholder="AAPL" data-testid="input-ticker" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input id="companyName" value={form.companyName} onChange={e => setField("companyName", e.target.value)} placeholder="Apple Inc." data-testid="input-company-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Select value={form.sector} onValueChange={v => setField("sector", v)}>
                <SelectTrigger data-testid="select-sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry} onChange={e => setField("industry", e.target.value)} placeholder="Consumer Electronics" data-testid="input-industry" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sharesHeld">Shares Held</Label>
              <Input id="sharesHeld" type="number" value={form.sharesHeld} onChange={e => setField("sharesHeld", e.target.value)} data-testid="input-shares" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input id="purchasePrice" type="number" step="0.01" value={form.purchasePrice} onChange={e => setField("purchasePrice", e.target.value)} data-testid="input-purchase-price" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Current Price ($)</Label>
              <Input id="currentPrice" type="number" step="0.01" value={form.currentPrice} onChange={e => setField("currentPrice", e.target.value)} data-testid="input-current-price" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionType">Position Type</Label>
              <Select value={form.positionType} onValueChange={v => setField("positionType", v)}>
                <SelectTrigger data-testid="select-position-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="beta">Beta</Label>
              <Input id="beta" type="number" step="0.01" value={form.beta} onChange={e => setField("beta", e.target.value)} data-testid="input-beta" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peRatio">P/E Ratio</Label>
              <Input id="peRatio" type="number" step="0.1" value={form.peRatio} onChange={e => setField("peRatio", e.target.value)} data-testid="input-pe-ratio" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eps">EPS ($)</Label>
              <Input id="eps" type="number" step="0.01" value={form.eps} onChange={e => setField("eps", e.target.value)} data-testid="input-eps" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dividendYield">Dividend Yield</Label>
              <Input id="dividendYield" type="number" step="0.001" value={form.dividendYield} onChange={e => setField("dividendYield", e.target.value)} data-testid="input-dividend-yield" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma50">MA50 ($)</Label>
              <Input id="ma50" type="number" step="0.01" value={form.ma50} onChange={e => setField("ma50", e.target.value)} data-testid="input-ma50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma200">MA200 ($)</Label>
              <Input id="ma200" type="number" step="0.01" value={form.ma200} onChange={e => setField("ma200", e.target.value)} data-testid="input-ma200" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week52Low">52-Week Low ($)</Label>
              <Input id="week52Low" type="number" step="0.01" value={form.week52Low} onChange={e => setField("week52Low", e.target.value)} data-testid="input-52w-low" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week52High">52-Week High ($)</Label>
              <Input id="week52High" type="number" step="0.01" value={form.week52High} onChange={e => setField("week52High", e.target.value)} data-testid="input-52w-high" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss ($)</Label>
              <Input id="stopLoss" type="number" step="0.01" value={form.stopLoss} onChange={e => setField("stopLoss", e.target.value)} data-testid="input-stop-loss" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalyst">Catalyst / Notes</Label>
              <Input id="catalyst" value={form.catalyst} onChange={e => setField("catalyst", e.target.value)} placeholder="Earnings beat, new product..." data-testid="input-catalyst" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="comments">Comments</Label>
              <Input id="comments" value={form.comments} onChange={e => setField("comments", e.target.value)} placeholder="Additional notes..." data-testid="input-comments" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-position">
              {isSaving ? "Saving..." : editingId ? "Update Position" : "Add Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.ticker} ({deleteTarget?.companyName})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
