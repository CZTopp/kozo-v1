import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrendingUp, Search, Globe, Trash2, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import type { FinancialModel, MarketData } from "@shared/schema";

export default function MarketDataPage() {
  const { toast } = useToast();
  const [ticker, setTicker] = useState("");

  const { data: models } = useQuery<FinancialModel[]>({ queryKey: ["/api/models"] });
  const { data: marketEntries, isLoading } = useQuery<MarketData[]>({ queryKey: ["/api/market-data"] });

  const activeModel = models?.[0];
  const modelMarketData = marketEntries?.filter((m) => m.modelId === activeModel?.id) || [];

  const fetchMutation = useMutation({
    mutationFn: async () => {
      if (!activeModel || !ticker.trim()) return;
      const res = await apiRequest("POST", "/api/market-data/fetch", {
        modelId: activeModel.id,
        ticker: ticker.trim().toUpperCase(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-data"] });
      setTicker("");
      toast({ title: "Market data fetched", description: `Data for ${ticker.toUpperCase()} has been retrieved.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/market-data/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-data"] });
      toast({ title: "Entry deleted" });
    },
  });

  const stockIndices = [
    { name: "S&P 500", ticker: "^GSPC", change: 0.82 },
    { name: "NASDAQ", ticker: "^IXIC", change: 1.24 },
    { name: "Dow Jones", ticker: "^DJI", change: 0.45 },
    { name: "Russell 2000", ticker: "^RUT", change: -0.31 },
    { name: "FTSE 100", ticker: "^FTSE", change: 0.67 },
    { name: "DAX", ticker: "^GDAXI", change: 0.92 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Market Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Import and track market benchmarks to inform your models</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Look Up Ticker</CardTitle>
          <CardDescription>Search for stock prices, indices, or company data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Ticker Symbol</Label>
              <Input
                data-testid="input-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. AAPL, MSFT, ^GSPC"
                onKeyDown={(e) => e.key === "Enter" && fetchMutation.mutate()}
              />
            </div>
            <Button onClick={() => fetchMutation.mutate()} disabled={!activeModel || !ticker.trim() || fetchMutation.isPending} data-testid="button-fetch-ticker">
              {fetchMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Fetch
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Global Market Indices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stockIndices.map((idx) => (
              <div key={idx.ticker} className="flex flex-col gap-1 p-3 rounded-md bg-muted/50">
                <span className="text-xs text-muted-foreground">{idx.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{idx.ticker}</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${idx.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {idx.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPercent(idx.change)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Saved Market Data</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : modelMarketData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Globe className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No market data saved yet. Use the search above to fetch ticker data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Ticker</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="text-right font-semibold">Price</TableHead>
                    <TableHead className="text-right font-semibold">Change</TableHead>
                    <TableHead className="font-semibold">Fetched</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelMarketData.map((entry) => {
                    const d = entry.data as any;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium font-mono">{entry.ticker}</TableCell>
                        <TableCell><Badge variant="secondary">{entry.dataType}</Badge></TableCell>
                        <TableCell className="text-right">{d?.price ? formatCurrency(d.price) : "---"}</TableCell>
                        <TableCell className="text-right">
                          {d?.changePercent !== undefined ? (
                            <span className={d.changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                              {formatPercent(d.changePercent)}
                            </span>
                          ) : "---"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleString() : "---"}
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
