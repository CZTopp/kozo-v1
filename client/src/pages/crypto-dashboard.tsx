import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject } from "@shared/schema";
import { useLocation } from "wouter";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search, RefreshCw, Trash2, ArrowUpRight, ArrowDownRight, Loader2,
  TrendingUp, Activity, Coins, DollarSign, GitBranch, MoreHorizontal,
  Calendar, Clock, BarChart3, ChevronUp, ChevronDown, Unlock, GripVertical,
  AlertTriangle,
} from "lucide-react";
import { UpgradeGate } from "@/components/upgrade-gate";
import { useSubscription } from "@/hooks/use-subscription";
import { Link } from "wouter";

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

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}w`;
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)}mo`;
  return `${(diffDays / 365).toFixed(1)}y`;
}

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">--</span>;
  const isPositive = value >= 0;
  return (
    <span className={`font-medium inline-flex items-center gap-0.5 ${isPositive ? "text-green-500" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(2)}%
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

interface UpcomingUnlock {
  projectId: string;
  projectName: string;
  date: string;
  amount: number;
  label: string;
  eventType: string;
}

interface DashboardSummary {
  upcomingUnlocks: UpcomingUnlock[];
  totalScheduleEvents: number;
  allSchedules: {
    projectId: string;
    projectName: string;
    eventType: string;
    label: string;
    date: string | null;
    amount: number;
  }[];
}

type SortKey = "custom" | "name" | "currentPrice" | "priceChange24h" | "priceChange7d" | "marketCap" | "circulatingSupply";
type SortDir = "asc" | "desc";

interface SortableRowProps {
  project: CryptoProject;
  navigate: (to: string) => void;
  deleteMutation: ReturnType<typeof useMutation<void, Error, string>>;
  isCustomSort: boolean;
}

function SortableRow({ project, navigate, deleteMutation, isCustomSort }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !isCustomSort });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? "relative" as const : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  const sparkData = Array.isArray(project.sparklineData)
    ? (project.sparklineData as number[]).map((v) => ({ v }))
    : null;

  const unlockedPct = project.circulatingSupply && project.totalSupply && project.totalSupply > 0
    ? Math.min((project.circulatingSupply / project.totalSupply) * 100, 100)
    : null;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b last:border-b-0 cursor-pointer hover-elevate"
      onClick={() => navigate(`/crypto/valuation/${project.id}`)}
      data-testid={`row-project-${project.id}`}
    >
      {isCustomSort && (
        <td className="px-2 py-3 w-8">
          <button
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground p-1"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${project.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {project.image && (
            <img
              src={project.image}
              alt={project.name}
              className="h-7 w-7 rounded-full flex-shrink-0"
              data-testid={`img-project-${project.id}`}
            />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate" data-testid={`text-name-${project.id}`}>{project.name}</div>
            <div className="text-xs text-muted-foreground uppercase" data-testid={`badge-symbol-${project.id}`}>{project.symbol}</div>
          </div>
        </div>
      </td>
      <td className="text-right px-4 py-3">
        <span className="font-semibold" data-testid={`text-price-${project.id}`}>{formatPrice(project.currentPrice)}</span>
      </td>
      <td className="text-right px-4 py-3">
        <ChangeCell value={project.priceChange24h} />
      </td>
      <td className="text-right px-4 py-3 hidden sm:table-cell">
        <ChangeCell value={project.priceChange7d} />
      </td>
      <td className="text-right px-4 py-3 hidden md:table-cell" data-testid={`text-mcap-${project.id}`}>
        <div className="font-medium">{formatCompact(project.marketCap)}</div>
        <div className="text-[10px] text-muted-foreground">Vol: {formatCompact(project.volume24h)}</div>
      </td>
      <td className="text-right px-4 py-3 hidden lg:table-cell">
        <div className="font-medium">{formatSupply(project.circulatingSupply)}</div>
        {unlockedPct != null && (
          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            <Progress value={unlockedPct} className="h-1 w-12" />
            <span className="text-[10px] text-muted-foreground">{unlockedPct.toFixed(0)}%</span>
          </div>
        )}
      </td>
      <td className="text-right px-4 py-3 hidden xl:table-cell" data-testid={`chart-sparkline-${project.id}`}>
        {sparkData && sparkData.length > 0 ? (
          <div className="w-24 ml-auto">
            <ResponsiveContainer width="100%" height={32}>
              <AreaChart data={sparkData}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={(project.priceChange7d || 0) >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                  fill={(project.priceChange7d || 0) >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <span className="text-muted-foreground">--</span>
        )}
      </td>
      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Project actions"
              data-testid={`button-menu-${project.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigate(`/crypto/tokenomics/${project.id}`)}
              data-testid={`link-tokenomics-${project.id}`}
            >
              <Coins className="h-4 w-4 mr-2" />
              Tokenomics
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/crypto/financials/${project.id}`)}
              data-testid={`link-financials-${project.id}`}
            >
              <Activity className="h-4 w-4 mr-2" />
              Financials
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/crypto/valuation/${project.id}`)}
              data-testid={`link-valuation-${project.id}`}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Valuation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/crypto/revenue/${project.id}`)}
              data-testid={`link-revenue-forecast-${project.id}`}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Revenue Forecast
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/crypto/token-flows/${project.id}`)}
              data-testid={`link-token-flows-${project.id}`}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Token Flows
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteMutation.mutate(project.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${project.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

export default function CryptoDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: subscription } = useSubscription();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("custom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: projects, isLoading: projectsLoading } = useQuery<CryptoProject[]>({
    queryKey: ["/api/crypto/projects"],
  });

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/crypto/dashboard-summary"],
    enabled: !!projects && projects.length > 0,
  });

  useEffect(() => {
    if (projects && projects.length > 0) {
      setLocalOrder(prev => {
        if (prev.length === 0) return projects.map(p => p.id);
        const projectIds = new Set(projects.map(p => p.id));
        const existing = prev.filter(id => projectIds.has(id));
        const newIds = projects.filter(p => !prev.includes(p.id)).map(p => p.id);
        return [...existing, ...newIds];
      });
    }
  }, [projects]);

  const nextUnlockByProject = useMemo(() => {
    if (!summary?.allSchedules) return {};
    const now = new Date();
    const map: Record<string, { date: string; amount: number; label: string; eventType: string }> = {};
    const sorted = [...summary.allSchedules]
      .filter(s => s.date && new Date(s.date) > now)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    for (const s of sorted) {
      if (!map[s.projectId]) {
        map[s.projectId] = { date: s.date!, amount: s.amount, label: s.label, eventType: s.eventType };
      }
    }
    return map;
  }, [summary]);

  const marketOverview = useMemo(() => {
    if (!projects || projects.length === 0) return null;
    const totalMcap = projects.reduce((sum, p) => sum + (p.marketCap || 0), 0);
    const totalVol = projects.reduce((sum, p) => sum + (p.volume24h || 0), 0);
    const avgChange = projects.reduce((sum, p) => sum + (p.priceChange24h || 0), 0) / projects.length;
    const gainers = projects.filter(p => (p.priceChange24h || 0) > 0).length;
    const losers = projects.filter(p => (p.priceChange24h || 0) < 0).length;
    return { totalMcap, totalVol, avgChange, gainers, losers };
  }, [projects]);

  const recentlyAdded = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    return [...projects]
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 4);
  }, [projects]);

  const displayProjects = useMemo(() => {
    if (!projects) return [];
    if (sortKey === "custom") {
      const projectMap = new Map(projects.map(p => [p.id, p]));
      return localOrder.map(id => projectMap.get(id)).filter(Boolean) as CryptoProject[];
    }
    return [...projects].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortKey) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          return sortDir === "asc" ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
        case "currentPrice":
          aVal = a.currentPrice || 0;
          bVal = b.currentPrice || 0;
          break;
        case "priceChange24h":
          aVal = a.priceChange24h || 0;
          bVal = b.priceChange24h || 0;
          break;
        case "priceChange7d":
          aVal = a.priceChange7d || 0;
          bVal = b.priceChange7d || 0;
          break;
        case "marketCap":
          aVal = a.marketCap || 0;
          bVal = b.marketCap || 0;
          break;
        case "circulatingSupply":
          aVal = a.circulatingSupply || 0;
          bVal = b.circulatingSupply || 0;
          break;
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [projects, sortKey, sortDir, localOrder]);

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("POST", "/api/crypto/projects/reorder", { orderedIds });
    },
    onError: () => {
      toast({ title: "Failed to save order", variant: "destructive" });
    },
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const updated = arrayMove(prev, oldIdx, newIdx);
      reorderMutation.mutate(updated);
      return updated;
    });
  }, [reorderMutation]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchDone(false);
      try {
        const res = await fetch(`/api/crypto/search?q=${encodeURIComponent(searchTerm.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.coins || data || []);
        } else if (res.status === 429) {
          toast({
            title: "Rate limit reached",
            description: "CoinGecko's free API has request limits. Please wait a moment before searching again.",
            variant: "destructive",
          });
          setSearchResults([]);
        }
      } catch {
      } finally {
        setIsSearching(false);
        setSearchDone(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const t = setInterval(() => setRefreshCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [refreshCooldown]);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crypto/projects/refresh");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      toast({ title: "Prices refreshed" });
      setRefreshCooldown(15);
    },
    onError: (err: Error) => {
      const isRateLimit = err.message.toLowerCase().includes("rate limit");
      toast({
        title: isRateLimit ? "Rate limit reached" : "Refresh failed",
        description: isRateLimit
          ? "CoinGecko's free API has request limits. Please wait a moment before trying again."
          : err.message,
        variant: "destructive",
      });
      if (isRateLimit) setRefreshCooldown(30);
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: async (coingeckoId: string) => {
      setAddingId(coingeckoId);
      const res = await apiRequest("POST", "/api/crypto/projects", { coingeckoId });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/dashboard-summary"] });
      setSearchTerm("");
      setSearchResults([]);
      setAddingId(null);
      toast({ title: "Project added" });
    },
    onError: (err: Error) => {
      setAddingId(null);
      const isRateLimit = err.message.toLowerCase().includes("rate limit");
      toast({
        title: isRateLimit ? "Rate limit reached" : "Error adding project",
        description: isRateLimit
          ? "CoinGecko's free API has request limits. Please wait a moment before adding another project."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crypto/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/dashboard-summary"] });
      toast({ title: "Project removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasProjects = projects && projects.length > 0;
  const isCustomSort = sortKey === "custom";

  function handleSort(key: SortKey) {
    if (key === "custom") {
      setSortKey("custom");
      setSortDir("asc");
      return;
    }
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ columnKey }: { columnKey: SortKey }) {
    if (sortKey !== columnKey) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Crypto Analysis</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            {projects?.length || 0} projects tracked
            {subscription && subscription.limits.cryptoProjects !== -1 && (projects?.length || 0) >= subscription.limits.cryptoProjects && (
              <Link href="/pricing" data-testid="link-crypto-limit-upgrade" title={`Limit reached (${subscription.limits.cryptoProjects}/${subscription.limits.cryptoProjects}). Upgrade for more.`}>
                <AlertTriangle className="h-4 w-4 text-amber-500 cursor-pointer" />
              </Link>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name, symbol, or contract..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-60"
              data-testid="input-search-crypto"
            />
            {(isSearching || searchResults.length > 0 || (searchDone && searchResults.length === 0 && searchTerm.trim())) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-60 overflow-y-auto" data-testid="list-search-results">
                {isSearching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}
                {!isSearching && searchDone && searchResults.length === 0 && searchTerm.trim() && (
                  <div className="text-sm text-muted-foreground p-3">
                    No results found
                  </div>
                )}
                <UpgradeGate resource="crypto_project">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover-elevate disabled:opacity-50"
                    onClick={() => addProjectMutation.mutate(result.id)}
                    disabled={addProjectMutation.isPending || addingId !== null}
                    data-testid={`button-add-project-${result.id}`}
                  >
                    {addingId === result.id ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : result.thumb ? (
                      <img src={result.thumb} alt="Token icon" className="h-5 w-5 rounded-full" />
                    ) : null}
                    <span className="font-medium">{result.name}</span>
                    <Badge variant="secondary" className="text-xs uppercase">{result.symbol}</Badge>
                    {result.market_cap_rank && (
                      <span className="text-xs text-muted-foreground ml-auto">#{result.market_cap_rank}</span>
                    )}
                  </button>
                ))}
                </UpgradeGate>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || !hasProjects || refreshCooldown > 0}
            data-testid="button-refresh-prices"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {refreshCooldown > 0 ? `Wait ${refreshCooldown}s` : "Refresh"}
          </Button>
        </div>
      </div>

      {hasProjects && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="summary-cards">
          <Card data-testid="card-market-overview">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Watchlist Overview</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold" data-testid="text-total-mcap">{projects?.length || 0} Projects</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="text-green-500">{marketOverview?.gainers || 0} up</span>
                <span className="text-red-500">{marketOverview?.losers || 0} down</span>
                <span>Avg: {marketOverview?.avgChange != null ? `${marketOverview.avgChange >= 0 ? "+" : ""}${marketOverview.avgChange.toFixed(1)}%` : "--"}</span>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-upcoming-unlocks">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Upcoming Unlocks</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              {summary?.upcomingUnlocks && summary.upcomingUnlocks.length > 0 ? (
                <div className="space-y-1">
                  {summary.upcomingUnlocks.slice(0, 3).map((u, i) => (
                    <div key={i} className="flex items-center justify-between gap-1 text-xs">
                      <span className="font-medium truncate">{u.projectName}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">{formatRelativeDate(u.date)}</Badge>
                        <span className="text-muted-foreground">{formatSupply(u.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No upcoming unlocks scheduled</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recently-updated">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Recently Updated</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {recentlyAdded.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-1 min-w-0">
                      {p.image && <img src={p.image} alt="Token icon" className="h-4 w-4 rounded-full flex-shrink-0" />}
                      <span className="font-medium truncate">{p.symbol?.toUpperCase()}</span>
                    </div>
                    <ChangeCell value={p.priceChange24h} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-supply-overview">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Supply Insights</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold">{summary?.totalScheduleEvents || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Supply events tracked across {projects?.length || 0} projects
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {projectsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!projectsLoading && !hasProjects && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No crypto projects tracked yet. Use the search bar above to add one.</p>
          </CardContent>
        </Card>
      )}

      {hasProjects && (
        <Card>
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
            <div className="flex items-center gap-1">
              <Button
                variant={isCustomSort ? "default" : "ghost"}
                size="sm"
                onClick={() => handleSort("custom")}
                data-testid="sort-custom"
              >
                <GripVertical className="h-3.5 w-3.5 mr-1" />
                Custom
              </Button>
            </div>
            {isCustomSort && (
              <span className="text-xs text-muted-foreground">Drag rows to reorder</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm" data-testid="table-watchlist">
                <thead>
                  <tr className="border-b">
                    {isCustomSort && <th className="w-8"></th>}
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("name")} data-testid="sort-name">
                        Token <SortIcon columnKey="name" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => handleSort("currentPrice")} data-testid="sort-price">
                        Price <SortIcon columnKey="currentPrice" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => handleSort("priceChange24h")} data-testid="sort-24h">
                        24h % <SortIcon columnKey="priceChange24h" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                      <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => handleSort("priceChange7d")} data-testid="sort-7d">
                        7d % <SortIcon columnKey="priceChange7d" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                      <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => handleSort("marketCap")} data-testid="sort-mcap">
                        Market Cap <SortIcon columnKey="marketCap" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                      <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => handleSort("circulatingSupply")} data-testid="sort-supply">
                        Supply <SortIcon columnKey="circulatingSupply" />
                      </button>
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">
                      7d Chart
                    </th>
                    <th className="px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <SortableContext items={displayProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {displayProjects.map((project) => (
                      <SortableRow
                        key={project.id}
                        project={project}
                        navigate={navigate}
                        deleteMutation={deleteMutation}
                        isCustomSort={isCustomSort}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        </Card>
      )}
    </div>
  );
}
