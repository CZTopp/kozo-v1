import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  Search, Loader2, TrendingUp, X, Plus, AlertTriangle,
  Lock, Unlock, Clock, BarChart3, ArrowUpDown, Filter,
} from "lucide-react";

const TOKEN_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#f43f5e",
  "#6366f1", "#84cc16", "#d946ef", "#0ea5e9", "#fb923c",
];

const CATEGORY_FILTERS = [
  "All", "Layer 1", "Layer 2", "DeFi", "Perpetuals", "RWA", "Gaming", "AI", "Meme",
];

function formatSupply(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  large: string;
}

interface EmissionAllocation {
  category: string;
  standardGroup: string;
  percentage: number;
  totalTokens: number;
  vestingType: string;
  cliffMonths: number;
  vestingMonths: number;
  tgePercent: number;
  monthlyValues: number[];
}

interface EmissionsData {
  token: {
    name: string;
    symbol: string;
    coingeckoId: string;
    totalSupply: number;
    circulatingSupply: number;
    maxSupply: number | null;
    currentPrice: number;
    marketCap: number;
    image: string;
    category?: string;
  };
  months: string[];
  allocations: EmissionAllocation[];
  totalSupplyTimeSeries: number[];
  inflationRate: number[];
  cliffEvents: { month: string; label: string; amount: number }[];
  confidence: string;
  notes: string;
}

type UnlockMode = "total" | "cliff" | "linear";
type SortField = "name" | "circulationPct" | "totalUnlock" | "cliffUnlock" | "linearUnlock" | "marketCap" | "unlockValue";
type SortDir = "asc" | "desc";
type TimeframeOption = "12m" | "24m" | "36m" | "60m";
type PercentOfOption = "circulating" | "total";
type AggregationPeriod = "week" | "month";

interface TokenMetrics {
  data: EmissionsData;
  circulationPct: number;
  lockedPct: number;
  totalCliffUnlock: number;
  totalLinearUnlock: number;
  cliffUnlockPct: number;
  linearUnlockPct: number;
  totalUnlockPct: number;
  unlockValue: number;
}

function computeTokenMetrics(d: EmissionsData): TokenMetrics {
  const totalSupply = d.token.totalSupply || 1;
  const circSupply = d.token.circulatingSupply || 0;
  const circulationPct = (circSupply / totalSupply) * 100;
  const lockedPct = 100 - circulationPct;

  let totalCliffUnlock = 0;
  let totalLinearUnlock = 0;
  for (const a of d.allocations) {
    const tokens = a.totalTokens;
    const tgeTokens = Math.round(tokens * (a.tgePercent || 0) / 100);
    const remaining = tokens - tgeTokens;
    if (a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear")) {
      totalCliffUnlock += remaining;
    } else if (a.vestingType === "linear" || a.vestingMonths > 0) {
      totalLinearUnlock += remaining;
    }
  }

  const cliffUnlockPct = (totalCliffUnlock / totalSupply) * 100;
  const linearUnlockPct = (totalLinearUnlock / totalSupply) * 100;
  const totalUnlockPct = cliffUnlockPct + linearUnlockPct;
  const unlockValue = (totalCliffUnlock + totalLinearUnlock) * d.token.currentPrice;

  return {
    data: d,
    circulationPct,
    lockedPct,
    totalCliffUnlock,
    totalLinearUnlock,
    cliffUnlockPct,
    linearUnlockPct,
    totalUnlockPct,
    unlockValue,
  };
}

function TokenSearch({ onSelect, excludeIds }: { onSelect: (r: SearchResult) => void; excludeIds: string[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const searchResults = useQuery<SearchResult[]>({
    queryKey: ["/api/crypto/search", query],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: query.length >= 2 && open,
  });

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setOpen(false), 200); }}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search tokens to add..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="pl-10 h-9 text-sm"
        data-testid="input-emissions-search"
      />
      {open && query.length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-64 overflow-auto">
          {searchResults.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : searchResults.data && searchResults.data.length > 0 ? (
            searchResults.data
              .filter((r) => !excludeIds.includes(r.id))
              .map((result) => (
                <button
                  key={result.id}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => { onSelect(result); setQuery(""); setOpen(false); }}
                  data-testid={`button-search-result-${result.id}`}
                >
                  {result.thumb && <img src={result.thumb} alt="" className="h-6 w-6 rounded-full" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.name}</div>
                    <div className="text-xs text-muted-foreground">{result.symbol.toUpperCase()}</div>
                  </div>
                  {result.market_cap_rank && <Badge variant="secondary">#{result.market_cap_rank}</Badge>}
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

function UnlockModeTabs({ mode, onChange }: { mode: UnlockMode; onChange: (m: UnlockMode) => void }) {
  return (
    <div className="flex border rounded-md overflow-hidden" data-testid="unlock-mode-tabs">
      {(["total", "cliff", "linear"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
          data-testid={`button-unlock-mode-${m}`}
        >
          {m === "total" ? "Total Value Unlock" : m === "cliff" ? "Cliff Value Unlock" : "Linear Value Unlock"}
        </button>
      ))}
    </div>
  );
}

function CategoryFilters({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-testid="category-filters">
      <Filter className="h-4 w-4 text-muted-foreground mr-1" />
      {CATEGORY_FILTERS.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${selected === cat ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <Icon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

type MarketTimeframe = "2m" | "6m";

function CryptoMarketEmissionsTab({
  allData,
  unlockMode,
  aggregation,
  onAggregationChange,
}: {
  allData: EmissionsData[];
  unlockMode: UnlockMode;
  aggregation: AggregationPeriod;
  onAggregationChange: (a: AggregationPeriod) => void;
}) {
  const [marketTimeframe, setMarketTimeframe] = useState<MarketTimeframe>("6m");
  const monthLimit = parseInt(marketTimeframe);

  const monthlyData = useMemo(() => {
    if (allData.length === 0) return [];

    const refData = allData.reduce((best, d) => d.months.length > best.months.length ? d : best, allData[0]);

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let startIdx = refData.months.indexOf(currentMonthStr);
    if (startIdx === -1) {
      startIdx = refData.months.findIndex((m) => m >= currentMonthStr);
      if (startIdx === -1) startIdx = Math.max(refData.months.length - monthLimit, 0);
    }

    const rows: { month: string; total: number; cliff: number; linear: number }[] = [];
    for (let i = startIdx; i < Math.min(startIdx + monthLimit, refData.months.length); i++) {
      let totalVal = 0;
      let cliffVal = 0;
      let linearVal = 0;

      for (const d of allData) {
        const price = d.token.currentPrice || 0;
        for (const a of d.allocations) {
          if (i >= a.monthlyValues.length) continue;
          const prev = i > 0 ? a.monthlyValues[i - 1] : 0;
          const curr = a.monthlyValues[i];
          const delta = Math.max(curr - prev, 0);
          const val = delta * price;
          totalVal += val;

          if (a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear")) {
            cliffVal += val;
          } else if (a.vestingType === "linear" || a.vestingMonths > 0) {
            linearVal += val;
          }
        }
      }

      rows.push({ month: refData.months[i], total: totalVal, cliff: cliffVal, linear: linearVal });
    }
    return rows;
  }, [allData, monthLimit]);

  const barData = useMemo(() => {
    if (monthlyData.length === 0) return [];
    if (aggregation === "month") return monthlyData;

    const weeklyRows: { period: string; total: number; cliff: number; linear: number }[] = [];
    for (const row of monthlyData) {
      const [y, m] = row.month.split("-").map(Number);
      const weeksInMonth = 4.345;
      for (let w = 0; w < 4; w++) {
        const weekStart = new Date(y, m - 1, 1 + w * 7);
        const wLabel = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        weeklyRows.push({
          period: wLabel,
          total: row.total / weeksInMonth,
          cliff: row.cliff / weeksInMonth,
          linear: row.linear / weeksInMonth,
        });
      }
    }
    return weeklyRows;
  }, [monthlyData, aggregation]);

  if (allData.length === 0) return <EmptyState icon={BarChart3} message="Add tokens above to view market-wide emission data" />;

  const dataKey = unlockMode === "total" ? "total" : unlockMode === "cliff" ? "cliff" : "linear";
  const color = unlockMode === "total" ? "#3b82f6" : unlockMode === "cliff" ? "#ef4444" : "#22c55e";
  const label = unlockMode === "total" ? "Total Value Unlock" : unlockMode === "cliff" ? "Cliff Value Unlock" : "Linear Value Unlock";
  const periodKey = aggregation === "month" ? "month" : "period";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label} — Aggregate Market View</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Range:</span>
              {(["2m", "6m"] as MarketTimeframe[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setMarketTimeframe(t)}
                  className={`px-2 py-1 text-xs rounded ${marketTimeframe === t ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                  data-testid={`button-market-timeframe-${t}`}
                >
                  {t === "2m" ? "2M" : "6M"}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              {(["week", "month"] as AggregationPeriod[]).map((a) => (
                <button
                  key={a}
                  onClick={() => onAggregationChange(a)}
                  className={`px-2 py-1 text-xs rounded ${aggregation === a ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                  data-testid={`button-aggregation-${a}`}
                >
                  {a === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[420px]" data-testid="chart-market-emissions">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="5%" barGap={0}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey={periodKey} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => { const parts = v.split("-"); return aggregation === "month" ? `${parts[0]}-${parts[1]}` : (parts[2] === "01" || parts[2] === "15" ? `${parts[1]}/${parts[2]}` : ""); }}
                interval={aggregation === "month" ? 0 : "preserveStartEnd"}
              />
              <YAxis
                tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => formatCompact(v).replace("$", "")}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number) => [formatCompact(value), label]}
                labelFormatter={(l) => `${aggregation === "week" ? "Week of" : "Month"}: ${l}`}
              />
              <Bar dataKey={dataKey} fill={color} name={label} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareEmissionTab({
  allData,
  unlockMode,
  timeframe,
  percentOf,
  onTimeframeChange,
  onPercentOfChange,
}: {
  allData: EmissionsData[];
  unlockMode: UnlockMode;
  timeframe: TimeframeOption;
  percentOf: PercentOfOption;
  onTimeframeChange: (t: TimeframeOption) => void;
  onPercentOfChange: (p: PercentOfOption) => void;
}) {
  const monthLimit = parseInt(timeframe);

  const metrics = useMemo(() => {
    return allData.map(computeTokenMetrics)
      .sort((a, b) => {
        if (unlockMode === "cliff") return b.cliffUnlockPct - a.cliffUnlockPct;
        if (unlockMode === "linear") return b.linearUnlockPct - a.linearUnlockPct;
        return b.totalUnlockPct - a.totalUnlockPct;
      });
  }, [allData, unlockMode]);

  const top7 = metrics.slice(0, 7);

  const chartData = useMemo(() => {
    if (top7.length === 0) return [];
    const refData = top7.reduce((best, m) => m.data.months.length > best.data.months.length ? m : best, top7[0]);
    const limit = Math.min(monthLimit, refData.data.months.length);

    return refData.data.months.slice(0, limit).map((month, i) => {
      const row: Record<string, any> = { month };
      for (const m of top7) {
        const d = m.data;
        const supply = percentOf === "circulating" ? (d.token.circulatingSupply || 1) : (d.token.totalSupply || 1);

        if (unlockMode === "total") {
          const total = d.totalSupplyTimeSeries[i] || 0;
          row[d.token.symbol] = (total / supply) * 100;
        } else {
          let sum = 0;
          for (const a of d.allocations) {
            if (i >= a.monthlyValues.length) continue;
            const isCliff = a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear");
            const isLinear = a.vestingType === "linear" || a.vestingMonths > 0;
            if ((unlockMode === "cliff" && isCliff) || (unlockMode === "linear" && isLinear)) {
              sum += a.monthlyValues[i] || 0;
            }
          }
          row[d.token.symbol] = (sum / supply) * 100;
        }
      }
      return row;
    });
  }, [top7, monthLimit, percentOf, unlockMode]);

  if (allData.length === 0) return <EmptyState icon={TrendingUp} message="Add tokens above to compare emission schedules" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Timeframe:</span>
          <div className="flex border rounded-md overflow-hidden">
            {(["12m", "24m", "36m", "60m"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTimeframeChange(t)}
                className={`px-2 py-1 text-xs ${timeframe === t ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                data-testid={`button-timeframe-${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>% of:</span>
          <div className="flex border rounded-md overflow-hidden">
            {(["circulating", "total"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPercentOfChange(p)}
                className={`px-2 py-1 text-xs capitalize ${percentOf === p ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                data-testid={`button-percentof-${p}`}
              >
                {p} Supply
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-[340px] shrink-0 space-y-1 max-h-[480px] overflow-auto pr-1">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
            {unlockMode === "total" ? "Total" : unlockMode === "cliff" ? "Cliff" : "Linear"} Unlock Ranking
          </div>
          {metrics.map((m, i) => {
            const pct = unlockMode === "cliff" ? m.cliffUnlockPct : unlockMode === "linear" ? m.linearUnlockPct : m.totalUnlockPct;
            return (
              <div
                key={m.data.token.coingeckoId}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors"
                data-testid={`list-compare-item-${i}`}
              >
                <div className="w-5 text-center text-xs text-muted-foreground font-mono">{i + 1}</div>
                {m.data.token.image && <img src={m.data.token.image} alt="" className="h-5 w-5 rounded-full shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.data.token.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: TOKEN_COLORS[i % TOKEN_COLORS.length] }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium">{formatCompact(m.unlockValue)}</div>
                  <div className="text-[10px] text-muted-foreground">{m.circulationPct.toFixed(0)}% circ</div>
                </div>
              </div>
            );
          })}
        </div>

        <Card className="flex-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {unlockMode === "total" ? "Total" : unlockMode === "cliff" ? "Cliff" : "Linear"} Supply Projection (% of {percentOf} supply)
              </CardTitle>
              <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{timeframe}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]" data-testid="chart-compare-emission">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => { const [y, m] = v.split("-"); return m === "01" || m === "07" ? `${y}-${m}` : ""; }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                    labelFormatter={(l) => `Month: ${l}`}
                  />
                  <Legend />
                  {top7.map((m, i) => (
                    <Line
                      key={m.data.token.coingeckoId}
                      type="monotone"
                      dataKey={m.data.token.symbol}
                      stroke={TOKEN_COLORS[i % TOKEN_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CompareInflationTab({
  allData,
}: {
  allData: EmissionsData[];
}) {
  const top7 = useMemo(() => {
    return allData
      .map((d) => {
        const rates = d.inflationRate;
        const avg12 = rates.slice(0, 12);
        const currentRate = avg12.length > 0 ? avg12.reduce((s, v) => s + v, 0) / avg12.length : 0;
        return { data: d, currentRate };
      })
      .sort((a, b) => b.currentRate - a.currentRate)
      .slice(0, 7);
  }, [allData]);

  const chartData = useMemo(() => {
    if (top7.length === 0) return [];
    const refData = top7.reduce((best, m) => m.data.months.length > best.data.months.length ? m : best, top7[0]);

    return refData.data.months.map((month, i) => {
      const row: Record<string, any> = { month };
      for (const m of top7) {
        row[m.data.token.symbol] = m.data.inflationRate[i] || 0;
      }
      return row;
    });
  }, [top7]);

  const periodMetrics = useMemo(() => {
    return allData.map((d) => {
      const rates = d.inflationRate;
      const avgSlice = (start: number, end: number) => {
        const slice = rates.slice(start, end);
        if (slice.length === 0) return 0;
        const monthlyAvg = slice.reduce((s, v) => s + v, 0) / slice.length;
        return ((1 + monthlyAvg / 100) ** 12 - 1) * 100;
      };

      return {
        coingeckoId: d.token.coingeckoId,
        symbol: d.token.symbol,
        name: d.token.name,
        image: d.token.image,
        year1: avgSlice(0, 12),
        year2: avgSlice(12, 24),
        year3: avgSlice(24, 36),
      };
    });
  }, [allData]);

  if (allData.length === 0) return <EmptyState icon={TrendingUp} message="Add tokens above to compare inflation rates" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-[280px] shrink-0 space-y-1 max-h-[480px] overflow-auto pr-1">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Inflation Rate Ranking</div>
          {top7.map((m, i) => (
            <div
              key={m.data.token.coingeckoId}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors"
              data-testid={`list-inflation-item-${i}`}
            >
              {m.data.token.image && <img src={m.data.token.image} alt="" className="h-5 w-5 rounded-full shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{m.data.token.name}</div>
                <div className="text-[10px] text-muted-foreground">{m.data.token.symbol}</div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-medium ${m.currentRate > 1 ? "text-destructive" : "text-green-500"}`}>
                  {m.currentRate.toFixed(2)}%/mo
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Inflation Rate Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]" data-testid="chart-compare-inflation">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => { const [y, m] = v.split("-"); return m === "01" || m === "07" ? `${y}-${m}` : ""; }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [`${value.toFixed(3)}%`, name]}
                    labelFormatter={(l) => `Month: ${l}`}
                  />
                  <Legend />
                  {top7.map((m, i) => (
                    <Line
                      key={m.data.token.coingeckoId}
                      type="monotone"
                      dataKey={m.data.token.symbol}
                      stroke={TOKEN_COLORS[i % TOKEN_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Annualized Inflation by Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Year 1</TableHead>
                  <TableHead className="text-center">Year 2</TableHead>
                  <TableHead className="text-center">Year 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodMetrics.map((m) => (
                  <TableRow key={m.coingeckoId} data-testid={`row-inflation-${m.coingeckoId}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.image && <img src={m.image} alt="" className="h-5 w-5 rounded-full" />}
                        <span className="text-sm font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.symbol}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${m.year1 > 20 ? "text-destructive" : m.year1 > 10 ? "text-yellow-500" : ""}`}>
                        {m.year1.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${m.year2 > 20 ? "text-destructive" : m.year2 > 10 ? "text-yellow-500" : ""}`}>
                        {m.year2.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${m.year3 > 20 ? "text-destructive" : m.year3 > 10 ? "text-yellow-500" : ""}`}>
                        {m.year3.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {periodMetrics.map((m, idx) => (
          <Card key={m.coingeckoId} data-testid={`card-inflation-${m.coingeckoId}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {m.image && <img src={m.image} alt="" className="h-5 w-5 rounded-full" />}
                <span className="font-medium text-sm truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.symbol}</span>
              </div>
              <div className="h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { period: "Y1", value: m.year1 },
                    { period: "Y2", value: m.year2 },
                    { period: "Y3", value: m.year3 },
                  ]}>
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "Inflation"]}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {[m.year1, m.year2, m.year3].map((val, j) => (
                        <Cell key={j} fill={val > 20 ? "#ef4444" : val > 10 ? "#eab308" : "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmissionScreenerTab({
  allData,
  unlockMode,
}: {
  allData: EmissionsData[];
  unlockMode: UnlockMode;
}) {
  const [sortField, setSortField] = useState<SortField>("totalUnlock");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const metrics = useMemo(() => allData.map(computeTokenMetrics), [allData]);

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortField) {
        case "name": va = a.data.token.name; vb = b.data.token.name; break;
        case "circulationPct": va = a.circulationPct; vb = b.circulationPct; break;
        case "totalUnlock": va = a.totalUnlockPct; vb = b.totalUnlockPct; break;
        case "cliffUnlock": va = a.cliffUnlockPct; vb = b.cliffUnlockPct; break;
        case "linearUnlock": va = a.linearUnlockPct; vb = b.linearUnlockPct; break;
        case "marketCap": va = a.data.token.marketCap; vb = b.data.token.marketCap; break;
        case "unlockValue": va = a.unlockValue; vb = b.unlockValue; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [metrics, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const barData = useMemo(() => {
    return sortedMetrics.map((m) => ({
      name: m.data.token.symbol,
      total: m.totalUnlockPct,
      cliff: m.cliffUnlockPct,
      linear: m.linearUnlockPct,
      circulating: m.circulationPct,
    }));
  }, [sortedMetrics]);

  if (allData.length === 0) return <EmptyState icon={BarChart3} message="Add tokens above to screen emission profiles" />;

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {unlockMode === "total" ? "Total" : unlockMode === "cliff" ? "Cliff" : "Linear"} Value Unlock Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]" data-testid="chart-screener">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]}
                />
                <YAxis
                  type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={55}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                />
                <Legend />
                {unlockMode === "total" && (
                  <>
                    <Bar dataKey="circulating" stackId="a" fill="#22c55e" name="Circulating" />
                    <Bar dataKey="cliff" stackId="a" fill="#ef4444" name="Cliff Unlock" />
                    <Bar dataKey="linear" stackId="a" fill="#3b82f6" name="Linear Unlock" />
                  </>
                )}
                {unlockMode === "cliff" && (
                  <Bar dataKey="cliff" fill="#ef4444" name="Cliff Unlock %" />
                )}
                {unlockMode === "linear" && (
                  <Bar dataKey="linear" fill="#3b82f6" name="Linear Unlock %" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Token Emission Screener</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="name" label="Project" />
                  <SortHeader field="marketCap" label="Market Cap" />
                  <SortHeader field="circulationPct" label="% Circulating" />
                  <TableHead className="text-right">Locked %</TableHead>
                  <SortHeader field="cliffUnlock" label="Cliff Unlock %" />
                  <SortHeader field="linearUnlock" label="Linear Unlock %" />
                  <SortHeader field="totalUnlock" label="Total Pending %" />
                  <SortHeader field="unlockValue" label="Unlock Value" />
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.map((m, i) => (
                  <TableRow key={m.data.token.coingeckoId} data-testid={`row-screener-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.data.token.image && <img src={m.data.token.image} alt="" className="h-5 w-5 rounded-full" />}
                        <div>
                          <div className="font-medium text-sm">{m.data.token.name}</div>
                          <div className="text-xs text-muted-foreground">{m.data.token.symbol}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCompact(m.data.token.marketCap)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(m.circulationPct, 100)}%` }} />
                        </div>
                        <span className="font-medium text-sm">{m.circulationPct.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={m.lockedPct > 50 ? "text-destructive font-medium" : ""}>{m.lockedPct.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.cliffUnlockPct > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <Lock className="h-3 w-3 text-destructive" />
                          <span className="font-medium">{m.cliffUnlockPct.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.linearUnlockPct > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <Unlock className="h-3 w-3 text-blue-500" />
                          <span className="font-medium">{m.linearUnlockPct.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={m.totalUnlockPct > 30 ? "text-destructive font-medium" : "font-medium"}>
                        {m.totalUnlockPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCompact(m.unlockValue)}</TableCell>
                    <TableCell>
                      <Badge variant={m.data.confidence === "high" ? "default" : m.data.confidence === "medium" ? "secondary" : "outline"} className="text-xs">
                        {m.data.confidence}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const DEFAULT_EMITTERS = [
  { id: "solana", name: "Solana", symbol: "SOL", thumb: "" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", thumb: "" },
  { id: "optimism", name: "Optimism", symbol: "OP", thumb: "" },
  { id: "aptos", name: "Aptos", symbol: "APT", thumb: "" },
  { id: "sui", name: "Sui", symbol: "SUI", thumb: "" },
  { id: "celestia", name: "Celestia", symbol: "TIA", thumb: "" },
  { id: "starknet", name: "Starknet", symbol: "STRK", thumb: "" },
  { id: "worldcoin-wld", name: "Worldcoin", symbol: "WLD", thumb: "" },
];

interface CryptoProject {
  id: string;
  coingeckoId: string;
  name: string;
  symbol: string;
  image: string | null;
}

export default function CryptoEmissions() {
  const [selectedTokens, setSelectedTokens] = useState<{ id: string; name: string; symbol: string; thumb: string }[]>([]);
  const [activeTab, setActiveTab] = useState("market");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [unlockMode, setUnlockMode] = useState<UnlockMode>("total");
  const [aggregation, setAggregation] = useState<AggregationPeriod>("week");
  const [timeframe, setTimeframe] = useState<TimeframeOption>("60m");
  const [percentOf, setPercentOf] = useState<PercentOfOption>("total");
  const [initialized, setInitialized] = useState(false);

  const watchlistQuery = useQuery<CryptoProject[]>({
    queryKey: ["/api/crypto/projects"],
  });

  useEffect(() => {
    if (initialized) return;
    if (watchlistQuery.data) {
      const watchlistTokens = watchlistQuery.data
        .filter((p) => p.coingeckoId)
        .map((p) => ({
          id: p.coingeckoId,
          name: p.name,
          symbol: p.symbol,
          thumb: p.image || "",
        }));

      const seenIds = new Set(watchlistTokens.map((t) => t.id));
      const defaults = DEFAULT_EMITTERS.filter((t) => !seenIds.has(t.id));
      setSelectedTokens([...watchlistTokens, ...defaults]);
      setInitialized(true);
    } else if (watchlistQuery.isError) {
      setSelectedTokens([...DEFAULT_EMITTERS]);
      setInitialized(true);
    }
  }, [initialized, watchlistQuery.data, watchlistQuery.isError]);

  const batchIdsKey = useMemo(() => {
    return selectedTokens.map(t => t.id).slice().sort().join(",");
  }, [selectedTokens]);

  const batchQuery = useQuery<{ data: Record<string, EmissionsData>; missingIds: string[] }>({
    queryKey: ["/api/crypto/emissions/batch", batchIdsKey],
    queryFn: async () => {
      const ids = selectedTokens.map(t => t.id);
      if (ids.length === 0) return { data: {}, missingIds: [] };
      const res = await apiRequest("POST", "/api/crypto/emissions/batch", { ids });
      return res.json();
    },
    enabled: selectedTokens.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  const emissionsMap = useMemo(() => {
    const map = new Map<string, EmissionsData>();
    if (batchQuery.data?.data) {
      for (const [id, emissions] of Object.entries(batchQuery.data.data)) {
        map.set(id, emissions);
      }
    }
    return map;
  }, [batchQuery.data]);

  const filteredData = useMemo(() => {
    const all = Array.from(emissionsMap.values());
    if (categoryFilter === "All") return all;
    return all.filter((d) => d.token.category === categoryFilter);
  }, [emissionsMap, categoryFilter]);

  const loadingIds = useMemo(() => {
    if (!batchQuery.isLoading) return [];
    return selectedTokens.filter(t => !emissionsMap.has(t.id)).map(t => t.id);
  }, [selectedTokens, emissionsMap, batchQuery.isLoading]);

  const handleAddToken = useCallback((result: SearchResult) => {
    if (selectedTokens.find((t) => t.id === result.id)) return;
    setSelectedTokens((prev) => [...prev, { id: result.id, name: result.name, symbol: result.symbol, thumb: result.thumb }]);
  }, [selectedTokens]);

  const handleRemoveToken = useCallback((id: string) => {
    setSelectedTokens((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showUnlockTabs = activeTab !== "inflation";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-3">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-emissions-title">Crypto Market Emissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analyze token emission schedules, inflation rates, and screen for unlock pressure across projects
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start" data-testid="tabs-emissions-main">
          <TabsTrigger value="market" data-testid="tab-market-emissions">Crypto Market Emissions</TabsTrigger>
          <TabsTrigger value="emission" data-testid="tab-compare-emission">Compare Emission</TabsTrigger>
          <TabsTrigger value="inflation" data-testid="tab-compare-inflation">Compare Inflation</TabsTrigger>
          <TabsTrigger value="screener" data-testid="tab-screener">Emission Screener</TabsTrigger>
        </TabsList>

        <div className="mt-3 space-y-2">
          <CategoryFilters selected={categoryFilter} onChange={setCategoryFilter} />

          <div className="flex items-center gap-3 flex-wrap">
            {showUnlockTabs && (
              <UnlockModeTabs mode={unlockMode} onChange={setUnlockMode} />
            )}
            <div className="flex-1 min-w-[200px]">
              <TokenSearch onSelect={handleAddToken} excludeIds={selectedTokens.map((t) => t.id)} />
            </div>
          </div>

          {selectedTokens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTokens.map((t, i) => (
                <Badge key={t.id} variant="outline" className="flex items-center gap-1 py-0.5 px-2 text-xs">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TOKEN_COLORS[i % TOKEN_COLORS.length] }} />
                  {t.thumb && <img src={t.thumb} alt="" className="h-3.5 w-3.5 rounded-full" />}
                  <span>{t.symbol.toUpperCase()}</span>
                  {loadingIds.includes(t.id) && <Loader2 className="h-3 w-3 animate-spin" />}
                  <button onClick={() => handleRemoveToken(t.id)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {batchQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing emissions for {selectedTokens.length} token{selectedTokens.length > 1 ? "s" : ""}...
            </div>
          )}
          {!batchQuery.isLoading && batchQuery.data?.missingIds && batchQuery.data.missingIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-500" data-testid="text-missing-tokens">
              <AlertTriangle className="h-3.5 w-3.5" />
              Could not load emission data for {batchQuery.data.missingIds.length} token{batchQuery.data.missingIds.length > 1 ? "s" : ""} (rate limited or no data available)
            </div>
          )}
        </div>

        <TabsContent value="market" className="mt-3">
          <CryptoMarketEmissionsTab allData={filteredData} unlockMode={unlockMode} aggregation={aggregation} onAggregationChange={setAggregation} />
        </TabsContent>

        <TabsContent value="emission" className="mt-3">
          <CompareEmissionTab
            allData={filteredData}
            unlockMode={unlockMode}
            timeframe={timeframe}
            percentOf={percentOf}
            onTimeframeChange={setTimeframe}
            onPercentOfChange={setPercentOf}
          />
        </TabsContent>

        <TabsContent value="inflation" className="mt-3">
          <CompareInflationTab allData={filteredData} />
        </TabsContent>

        <TabsContent value="screener" className="mt-3">
          <EmissionScreenerTab allData={filteredData} unlockMode={unlockMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
