import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject } from "@shared/schema";
import { Link } from "wouter";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Search, RefreshCw, Trash2, ArrowUpRight, ArrowDownRight, Plus, Loader2, TrendingUp, Activity, Coins, DollarSign, GitBranch } from "lucide-react";

function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  if (n >= 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
}

function formatSupply(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function ChangeDisplay({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return <span className="text-xs text-muted-foreground">{label}: --</span>;
  const isPositive = value >= 0;
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${isPositive ? "text-green-500" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {label}: {Math.abs(value).toFixed(2)}%
    </span>
  );
}

interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
  market_cap_rank?: number;
}

export default function CryptoDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useQuery<CryptoProject[]>({
    queryKey: ["/api/crypto/projects"],
  });

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/crypto/search?q=${encodeURIComponent(searchTerm.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.coins || data || []);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/projects/refresh");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      toast({ title: "Prices refreshed" });
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: async (coingeckoId: string) => {
      const res = await apiRequest("POST", "/api/crypto/projects", { coingeckoId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      setSearchTerm("");
      setSearchResults([]);
      toast({ title: "Project added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding project", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crypto/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      toast({ title: "Project removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Crypto Analysis</h1>
          <p className="text-sm text-muted-foreground">{projects?.length || 0} projects tracked</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending || !projects?.length}
          data-testid="button-refresh-prices"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          {refreshMutation.isPending ? "Refreshing..." : "Refresh Prices"}
        </Button>
      </div>

      <Card data-testid="card-search-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            <Plus className="h-4 w-4" />
            Add Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-crypto"
            />
          </div>
          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-60 overflow-y-auto" data-testid="list-search-results">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover-elevate"
                  onClick={() => addProjectMutation.mutate(result.id)}
                  disabled={addProjectMutation.isPending}
                  data-testid={`button-add-project-${result.id}`}
                >
                  {result.thumb && (
                    <img src={result.thumb} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  <span className="font-medium">{result.name}</span>
                  <Badge variant="secondary" className="text-xs uppercase">{result.symbol}</Badge>
                  {result.market_cap_rank && (
                    <span className="text-xs text-muted-foreground ml-auto">#{result.market_cap_rank}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {projectsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!projectsLoading && (!projects || projects.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No crypto projects tracked yet. Search and add one above.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects?.map((project) => {
          const sparkData = Array.isArray(project.sparklineData)
            ? (project.sparklineData as number[]).map((v) => ({ v }))
            : null;
          const athPercent =
            project.ath && project.currentPrice
              ? ((project.currentPrice - project.ath) / project.ath) * 100
              : null;

          return (
            <Card key={project.id} data-testid={`card-project-${project.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {project.image && (
                    <img
                      src={project.image}
                      alt={project.name}
                      className="h-6 w-6 rounded-full flex-shrink-0"
                      data-testid={`img-project-${project.id}`}
                    />
                  )}
                  <CardTitle className="text-base font-semibold truncate" data-testid={`text-name-${project.id}`}>
                    {project.name}
                  </CardTitle>
                  <Badge variant="secondary" className="uppercase text-xs" data-testid={`badge-symbol-${project.id}`}>
                    {project.symbol}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(project.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${project.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-2xl font-bold" data-testid={`text-price-${project.id}`}>
                    {formatPrice(project.currentPrice)}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mt-1">
                    <ChangeDisplay value={project.priceChange24h} label="24h" />
                    <ChangeDisplay value={project.priceChange7d} label="7d" />
                  </div>
                </div>

                {sparkData && sparkData.length > 0 && (
                  <div data-testid={`chart-sparkline-${project.id}`}>
                    <ResponsiveContainer width="100%" height={40}>
                      <AreaChart data={sparkData}>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="hsl(var(--chart-1))"
                          fill="hsl(var(--chart-1))"
                          fillOpacity={0.1}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Market Cap</span>
                    <div className="font-medium" data-testid={`text-mcap-${project.id}`}>
                      {formatCompact(project.marketCap)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FDV</span>
                    <div className="font-medium" data-testid={`text-fdv-${project.id}`}>
                      {formatCompact(project.fullyDilutedValuation)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">24h Vol</span>
                    <div className="font-medium" data-testid={`text-vol-${project.id}`}>
                      {formatCompact(project.volume24h)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Circulating</span>
                    <div className="font-medium" data-testid={`text-circ-${project.id}`}>
                      {formatSupply(project.circulatingSupply)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <div className="font-medium" data-testid={`text-total-supply-${project.id}`}>
                      {formatSupply(project.totalSupply)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max</span>
                    <div className="font-medium" data-testid={`text-max-supply-${project.id}`}>
                      {formatSupply(project.maxSupply)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground">ATH: </span>
                    <span className="font-medium" data-testid={`text-ath-${project.id}`}>
                      {formatPrice(project.ath)}
                    </span>
                  </div>
                  {athPercent != null && (
                    <span
                      className={`font-medium ${athPercent >= 0 ? "text-green-500" : "text-red-500"}`}
                      data-testid={`text-ath-pct-${project.id}`}
                    >
                      {athPercent.toFixed(1)}% from ATH
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Link href={`/crypto/tokenomics/${project.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-tokenomics-${project.id}`}>
                      <Coins className="h-3.5 w-3.5 mr-1" />
                      Tokenomics
                    </Button>
                  </Link>
                  <Link href={`/crypto/financials/${project.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-financials-${project.id}`}>
                      <Activity className="h-3.5 w-3.5 mr-1" />
                      Financials
                    </Button>
                  </Link>
                  <Link href={`/crypto/valuation/${project.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-valuation-${project.id}`}>
                      <TrendingUp className="h-3.5 w-3.5 mr-1" />
                      Valuation
                    </Button>
                  </Link>
                  <Link href={`/crypto/revenue/${project.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-revenue-forecast-${project.id}`}>
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                      Revenue
                    </Button>
                  </Link>
                  <Link href={`/crypto/token-flows/${project.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-token-flows-${project.id}`}>
                      <GitBranch className="h-3.5 w-3.5 mr-1" />
                      Token Flows
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
