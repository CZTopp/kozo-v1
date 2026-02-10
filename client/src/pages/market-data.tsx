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
import { formatPercent } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MacroIndicator, MarketIndex } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Loader2, Plus, Trash2 } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";

export default function MarketDataPage() {
  const { toast } = useToast();
  const { data: indices, isLoading: loadingIndices } = useQuery<MarketIndex[]>({ queryKey: ["/api/market-indices"] });
  const { data: macro, isLoading: loadingMacro } = useQuery<MacroIndicator[]>({ queryKey: ["/api/macro-indicators"] });

  const [addIndexOpen, setAddIndexOpen] = useState(false);
  const [addMacroOpen, setAddMacroOpen] = useState(false);
  const [indexSymbol, setIndexSymbol] = useState("");
  const [indexName, setIndexName] = useState("");
  const [indexRegion, setIndexRegion] = useState("");
  const [macroSeriesId, setMacroSeriesId] = useState("");
  const [macroName, setMacroName] = useState("");
  const [macroCategory, setMacroCategory] = useState("");
  const [deleteIndexId, setDeleteIndexId] = useState<string | null>(null);
  const [deleteMacroId, setDeleteMacroId] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/refresh-market-data");
      return res.json();
    },
    onSuccess: (data: { indices: number; macro: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-indices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/macro-indicators"] });
      const parts: string[] = [];
      if (data.indices > 0) parts.push(`${data.indices} indices`);
      if (data.macro > 0) parts.push(`${data.macro} macro indicators`);
      toast({
        title: "Market data refreshed",
        description: parts.length > 0
          ? `Updated ${parts.join(" and ")} with live data.${data.errors.length > 0 ? ` (${data.errors.length} warning${data.errors.length > 1 ? "s" : ""})` : ""}`
          : data.errors.join("; "),
      });
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  const addIndexMutation = useMutation({
    mutationFn: async (data: { symbol: string; name: string; region: string }) => {
      const res = await apiRequest("POST", "/api/market-indices/add-custom", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-indices"] });
      setAddIndexOpen(false);
      setIndexSymbol("");
      setIndexName("");
      setIndexRegion("");
      toast({ title: "Index added" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add index", description: err.message, variant: "destructive" });
    },
  });

  const deleteIndexMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/market-indices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-indices"] });
      setDeleteIndexId(null);
      toast({ title: "Index removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addMacroMutation = useMutation({
    mutationFn: async (data: { seriesId: string; name: string; category: string }) => {
      const res = await apiRequest("POST", "/api/macro-indicators/add-custom", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/macro-indicators"] });
      setAddMacroOpen(false);
      setMacroSeriesId("");
      setMacroName("");
      setMacroCategory("");
      toast({ title: "Macro indicator added" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add indicator", description: err.message, variant: "destructive" });
    },
  });

  const deleteMacroMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/macro-indicators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/macro-indicators"] });
      setDeleteMacroId(null);
      toast({ title: "Indicator removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const usIndices = indices?.filter(i => i.region === "US") || [];
  const intlIndices = indices?.filter(i => i.region !== "US") || [];

  const categories = Array.from(new Set(macro?.map(m => m.category) || []));
  const groupedMacro = categories.map(cat => ({
    title: cat,
    data: macro?.filter(m => m.category === cat) || [],
  }));

  const indicesChartData = indices?.map(idx => ({
    name: idx.ticker,
    YTD: (idx.ytdReturn || 0) * 100,
  })) || [];

  const macroTooltips: Record<string, string> = {
    "Interest Rates": "Central bank policy rates and treasury yields. Rising rates increase discount rates and typically compress equity valuations.",
    "Inflation": "Consumer and producer price indices measuring purchasing power erosion. Impacts real returns and monetary policy direction.",
    "Economic Growth": "GDP growth rates and leading economic indicators. Strong growth supports earnings expansion and higher equity valuations.",
    "Growth": "GDP growth rates and leading economic indicators. Strong growth supports earnings expansion and higher equity valuations.",
    "Labor Market": "Employment data including unemployment rate and job creation. Tight labor markets signal economic strength but may fuel inflation.",
    "Volatility": "Market volatility measures like the VIX. High volatility indicates uncertainty and elevated risk premiums.",
    "Currency": "Currency strength indicators including the US Dollar Index. Dollar strength affects multinational earnings and commodity prices.",
    "Sentiment": "Consumer and business confidence surveys. Leading indicators of spending and investment decisions.",
    "Economic Activity": "Manufacturing and services activity indices. Above 50 indicates expansion; below 50 indicates contraction.",
    "Commodities": "Key commodity prices including oil, gold, and others. Commodity moves affect input costs and sector rotation strategies.",
    "Custom": "User-added indicators from FRED. These may display raw values; adjust interpretation based on the specific series.",
  };

  const deleteIndexTarget = deleteIndexId ? indices?.find(i => i.id === deleteIndexId) : null;
  const deleteMacroTarget = deleteMacroId ? macro?.find(m => m.id === deleteMacroId) : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Market Data & Macro</h1>
          <p className="text-sm text-muted-foreground">Global market indices and macroeconomic indicators</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-market-data"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {refreshMutation.isPending ? "Refreshing..." : "Refresh Live Data"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {usIndices.slice(0, 6).map(idx => (
          <Card key={idx.id} data-testid={`card-index-${idx.ticker}`}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{idx.name}</span>
                <span className="text-sm font-medium">{idx.currentValue?.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  {(idx.ytdReturn || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatPercent(idx.ytdReturn || 0)} YTD
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="indices" data-testid="tabs-market-data">
        <TabsList>
          <TabsTrigger value="indices">Global Indices</TabsTrigger>
          <TabsTrigger value="macro">Macro Indicators</TabsTrigger>
          <TabsTrigger value="chart">Index Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAddIndexOpen(true)} data-testid="button-add-index">
              <Plus className="h-4 w-4 mr-1" />
              Add Index
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">US Market Indices <InfoTooltip content="Major US equity indices including S&P 500, Dow Jones, Nasdaq, and Russell. Shows daily, month-to-date, and year-to-date returns." /></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Index</TableHead>
                      <TableHead className="font-semibold">Ticker</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">MTD</TableHead>
                      <TableHead className="text-right font-semibold">YTD</TableHead>
                      <TableHead className="text-center font-semibold w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usIndices.map(idx => (
                      <TableRow key={idx.id} data-testid={`row-index-${idx.ticker}`}>
                        <TableCell className="font-medium">{idx.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{idx.ticker}</TableCell>
                        <TableCell className="text-right font-mono">{idx.currentValue?.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${(idx.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.dailyChangePercent || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.mtdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.mtdReturn || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.ytdReturn || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" onClick={() => setDeleteIndexId(idx.id)} data-testid={`button-delete-index-${idx.ticker}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-1">International Indices <InfoTooltip content="Key international equity benchmarks from Europe, Asia, and emerging markets. Useful for global diversification analysis." /></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Index</TableHead>
                      <TableHead className="font-semibold">Region</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">Daily</TableHead>
                      <TableHead className="text-right font-semibold">YTD</TableHead>
                      <TableHead className="text-center font-semibold w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intlIndices.map(idx => (
                      <TableRow key={idx.id} data-testid={`row-index-${idx.ticker}`}>
                        <TableCell className="font-medium">{idx.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{idx.region}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{idx.currentValue?.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${(idx.dailyChangePercent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.dailyChangePercent || 0)}
                        </TableCell>
                        <TableCell className={`text-right ${(idx.ytdReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(idx.ytdReturn || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" onClick={() => setDeleteIndexId(idx.id)} data-testid={`button-delete-index-${idx.ticker}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="macro" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAddMacroOpen(true)} data-testid="button-add-macro">
              <Plus className="h-4 w-4 mr-1" />
              Add Indicator
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groupedMacro.filter(g => g.data.length > 0).map(group => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-1">{group.title} <InfoTooltip content={macroTooltips[group.title] || ""} /></CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Indicator</TableHead>
                        <TableHead className="text-right font-semibold">Value</TableHead>
                        <TableHead className="text-right font-semibold">Prior</TableHead>
                        <TableHead className="text-center font-semibold w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.data.map(m => (
                        <TableRow key={m.id} data-testid={`row-macro-${m.name}`}>
                          <TableCell className="text-sm">{m.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {m.displayFormat === "percent" ? `${(m.value * 100).toFixed(2)}%` : m.value.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {m.priorValue != null
                              ? m.displayFormat === "percent"
                                ? `${(m.priorValue * 100).toFixed(2)}%`
                                : m.priorValue.toLocaleString()
                              : "--"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button size="icon" variant="ghost" onClick={() => setDeleteMacroId(m.id)} data-testid={`button-delete-macro-${m.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-1">Index YTD Performance (%) <InfoTooltip content="Visual comparison of year-to-date returns across all tracked global indices. Helps identify relative market strength by region." /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicesChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                    />
                    <Bar dataKey="YTD" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addIndexOpen} onOpenChange={setAddIndexOpen}>
        <DialogContent data-testid="dialog-add-index">
          <DialogHeader>
            <DialogTitle>Add Market Index</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="indexSymbol">Yahoo Finance Symbol *</Label>
              <Input
                id="indexSymbol"
                value={indexSymbol}
                onChange={e => setIndexSymbol(e.target.value)}
                placeholder="^GSPC, ^FTSE, BTC-USD, etc."
                data-testid="input-index-symbol"
              />
              <p className="text-xs text-muted-foreground">Use Yahoo Finance ticker format. Index symbols usually start with ^ (e.g., ^GSPC for S&P 500).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="indexName">Display Name (optional)</Label>
              <Input
                id="indexName"
                value={indexName}
                onChange={e => setIndexName(e.target.value)}
                placeholder="Auto-detected from Yahoo"
                data-testid="input-index-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="indexRegion">Region (optional)</Label>
              <Input
                id="indexRegion"
                value={indexRegion}
                onChange={e => setIndexRegion(e.target.value)}
                placeholder="US, Europe, Asia, etc."
                data-testid="input-index-region"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddIndexOpen(false)} data-testid="button-cancel-add-index">Cancel</Button>
            <Button
              onClick={() => addIndexMutation.mutate({ symbol: indexSymbol, name: indexName, region: indexRegion })}
              disabled={!indexSymbol.trim() || addIndexMutation.isPending}
              data-testid="button-confirm-add-index"
            >
              {addIndexMutation.isPending ? "Adding..." : "Add Index"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMacroOpen} onOpenChange={setAddMacroOpen}>
        <DialogContent data-testid="dialog-add-macro">
          <DialogHeader>
            <DialogTitle>Add FRED Macro Indicator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="macroSeriesId">FRED Series ID *</Label>
              <Input
                id="macroSeriesId"
                value={macroSeriesId}
                onChange={e => setMacroSeriesId(e.target.value)}
                placeholder="DGS10, UNRATE, GDP, etc."
                data-testid="input-macro-series"
              />
              <p className="text-xs text-muted-foreground">Find series IDs at fred.stlouisfed.org. Examples: DGS10 (10Y Treasury), UNRATE (Unemployment), GDP, CPIAUCSL (CPI).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="macroName">Display Name (optional)</Label>
              <Input
                id="macroName"
                value={macroName}
                onChange={e => setMacroName(e.target.value)}
                placeholder="Auto-detected from FRED"
                data-testid="input-macro-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="macroCategory">Category (optional)</Label>
              <Input
                id="macroCategory"
                value={macroCategory}
                onChange={e => setMacroCategory(e.target.value)}
                placeholder="Interest Rates, Inflation, etc."
                data-testid="input-macro-category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMacroOpen(false)} data-testid="button-cancel-add-macro">Cancel</Button>
            <Button
              onClick={() => addMacroMutation.mutate({ seriesId: macroSeriesId, name: macroName, category: macroCategory })}
              disabled={!macroSeriesId.trim() || addMacroMutation.isPending}
              data-testid="button-confirm-add-macro"
            >
              {addMacroMutation.isPending ? "Adding..." : "Add Indicator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteIndexId} onOpenChange={(open) => !open && setDeleteIndexId(null)}>
        <AlertDialogContent data-testid="dialog-delete-index">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Index</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteIndexTarget?.name} ({deleteIndexTarget?.ticker}) from your tracked indices? You can add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-index">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIndexId && deleteIndexMutation.mutate(deleteIndexId)}
              disabled={deleteIndexMutation.isPending}
              data-testid="button-confirm-delete-index"
            >
              {deleteIndexMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMacroId} onOpenChange={(open) => !open && setDeleteMacroId(null)}>
        <AlertDialogContent data-testid="dialog-delete-macro">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Indicator</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteMacroTarget?.name} from your tracked indicators? You can add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-macro">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMacroId && deleteMacroMutation.mutate(deleteMacroId)}
              disabled={deleteMacroMutation.isPending}
              data-testid="button-confirm-delete-macro"
            >
              {deleteMacroMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
