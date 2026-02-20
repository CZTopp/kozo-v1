import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Search, Loader2, TrendingUp, X, Plus, AlertTriangle,
  Lock, Unlock, Clock, BarChart3, ArrowUpDown,
} from "lucide-react";

const TOKEN_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#f43f5e",
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
  };
  months: string[];
  allocations: EmissionAllocation[];
  totalSupplyTimeSeries: number[];
  inflationRate: number[];
  cliffEvents: { month: string; label: string; amount: number }[];
  confidence: string;
  notes: string;
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
        placeholder="Search tokens to add (e.g. Bitcoin, Ethereum, Solana)..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="pl-10"
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
                  className="w-full flex items-center gap-3 p-3 text-left hover-elevate"
                  onClick={() => {
                    onSelect(result);
                    setQuery("");
                    setOpen(false);
                  }}
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


function SelectedTokenChips({
  tokens,
  loadingIds,
  onRemove,
}: {
  tokens: { id: string; name: string; symbol: string; thumb: string }[];
  loadingIds: string[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((t, i) => (
        <Badge key={t.id} variant="outline" className="flex items-center gap-1.5 py-1 px-2">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TOKEN_COLORS[i % TOKEN_COLORS.length] }} />
          {t.thumb && <img src={t.thumb} alt="" className="h-4 w-4 rounded-full" />}
          <span className="text-xs">{t.symbol.toUpperCase()}</span>
          {loadingIds.includes(t.id) && <Loader2 className="h-3 w-3 animate-spin" />}
          <button onClick={() => onRemove(t.id)} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function CompareEmissionTab({ tokenIds, emissionsMap }: { tokenIds: string[]; emissionsMap: Map<string, EmissionsData> }) {
  const chartData = useMemo(() => {
    const allData = tokenIds.map((id) => emissionsMap.get(id)).filter(Boolean) as EmissionsData[];
    if (allData.length === 0) return [];

    const maxMonths = Math.max(...allData.map((d) => d.months.length));
    const refData = allData.reduce((best, d) => d.months.length > best.months.length ? d : best, allData[0]);

    return refData.months.map((month, i) => {
      const row: Record<string, any> = { month };
      for (const d of allData) {
        const total = d.totalSupplyTimeSeries[i] || 0;
        const supply = d.token.totalSupply || 1;
        row[`${d.token.symbol}_pct`] = (total / supply) * 100;
        row[`${d.token.symbol}_abs`] = total;
      }
      return row;
    });
  }, [tokenIds, emissionsMap]);

  const allData = tokenIds.map((id) => emissionsMap.get(id)).filter(Boolean) as EmissionsData[];

  if (allData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Add tokens above to compare their emission schedules</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Emission Schedule Comparison (% of Total Supply Unlocked)</CardTitle>
          <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />60-month</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]" data-testid="chart-compare-emission">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => { const [y, m] = v.split("-"); return m === "01" || m === "07" ? `${y}-${m}` : ""; }}
                />
                <YAxis
                  tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name.replace("_pct", "")]}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend formatter={(v) => v.replace("_pct", "")} />
                {allData.map((d, i) => (
                  <Line
                    key={d.token.coingeckoId}
                    type="monotone"
                    dataKey={`${d.token.symbol}_pct`}
                    stroke={TOKEN_COLORS[i % TOKEN_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={`${d.token.symbol}_pct`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Allocation Breakdown Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {allData.map((d, i) => (
              <div key={d.token.coingeckoId}>
                <div className="flex items-center gap-2 mb-3">
                  {d.token.image && <img src={d.token.image} alt="" className="h-5 w-5 rounded-full" />}
                  <span className="font-medium text-sm">{d.token.name} ({d.token.symbol})</span>
                  <Badge variant={d.confidence === "high" ? "default" : "secondary"} className="text-xs">{d.confidence}</Badge>
                </div>
                <div className="space-y-1.5">
                  {d.allocations.map((a) => (
                    <div key={a.category} className="flex items-center gap-2 text-sm">
                      <div className="w-24 truncate text-muted-foreground">{a.category}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.percentage}%`, backgroundColor: TOKEN_COLORS[i % TOKEN_COLORS.length] }} />
                      </div>
                      <div className="w-12 text-right font-medium">{a.percentage.toFixed(1)}%</div>
                      <Badge variant="outline" className="text-xs">{a.vestingType}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareInflationTab({ tokenIds, emissionsMap }: { tokenIds: string[]; emissionsMap: Map<string, EmissionsData> }) {
  const chartData = useMemo(() => {
    const allData = tokenIds.map((id) => emissionsMap.get(id)).filter(Boolean) as EmissionsData[];
    if (allData.length === 0) return [];

    const refData = allData.reduce((best, d) => d.months.length > best.months.length ? d : best, allData[0]);
    return refData.months.map((month, i) => {
      const row: Record<string, any> = { month };
      for (const d of allData) {
        row[d.token.symbol] = d.inflationRate[i] || 0;
      }
      return row;
    });
  }, [tokenIds, emissionsMap]);

  const allData = tokenIds.map((id) => emissionsMap.get(id)).filter(Boolean) as EmissionsData[];

  if (allData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Add tokens above to compare their inflation rates</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Monthly Inflation Rate Comparison</CardTitle>
        <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />60-month</Badge>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]" data-testid="chart-compare-inflation">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => { const [y, m] = v.split("-"); return m === "01" || m === "07" ? `${y}-${m}` : ""; }}
              />
              <YAxis
                tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              {allData.map((d, i) => (
                <Line
                  key={d.token.coingeckoId}
                  type="monotone"
                  dataKey={d.token.symbol}
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
  );
}

type ScreenerChartMode = "total" | "cliff" | "linear";
type SortField = "name" | "circulationPct" | "totalUnlock" | "cliffUnlock" | "linearUnlock" | "marketCap";
type SortDir = "asc" | "desc";

function EmissionScreenerTab({ tokenIds, emissionsMap }: { tokenIds: string[]; emissionsMap: Map<string, EmissionsData> }) {
  const [chartMode, setChartMode] = useState<ScreenerChartMode>("total");
  const [sortField, setSortField] = useState<SortField>("circulationPct");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allData = tokenIds.map((id) => emissionsMap.get(id)).filter(Boolean) as EmissionsData[];

  const tokenMetrics = useMemo(() => {
    return allData.map((d) => {
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

      return {
        ...d,
        circulationPct,
        lockedPct,
        totalCliffUnlock,
        totalLinearUnlock,
        cliffUnlockPct,
        linearUnlockPct,
        totalUnlockPct,
      };
    });
  }, [allData]);

  const sortedMetrics = useMemo(() => {
    return [...tokenMetrics].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortField) {
        case "name": va = a.token.name; vb = b.token.name; break;
        case "circulationPct": va = a.circulationPct; vb = b.circulationPct; break;
        case "totalUnlock": va = a.totalUnlockPct; vb = b.totalUnlockPct; break;
        case "cliffUnlock": va = a.cliffUnlockPct; vb = b.cliffUnlockPct; break;
        case "linearUnlock": va = a.linearUnlockPct; vb = b.linearUnlockPct; break;
        case "marketCap": va = a.token.marketCap; vb = b.token.marketCap; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [tokenMetrics, sortField, sortDir]);

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
      name: m.token.symbol,
      total: m.totalUnlockPct,
      cliff: m.cliffUnlockPct,
      linear: m.linearUnlockPct,
      circulating: m.circulationPct,
    }));
  }, [sortedMetrics]);

  if (allData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Add tokens above to screen their emission profiles</p>
        </CardContent>
      </Card>
    );
  }

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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Value Unlock Overview</CardTitle>
            <div className="flex gap-1">
              {(["total", "cliff", "linear"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={chartMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartMode(mode)}
                  data-testid={`button-chart-mode-${mode}`}
                >
                  {mode === "total" ? "Total Unlock" : mode === "cliff" ? "Cliff Unlock" : "Linear Unlock"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]" data-testid="chart-screener">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={[0, 100]}
                />
                <YAxis
                  type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                  width={60}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                />
                <Legend />
                {chartMode === "total" && (
                  <>
                    <Bar dataKey="circulating" stackId="a" fill="#22c55e" name="Circulating" />
                    <Bar dataKey="cliff" stackId="a" fill="#ef4444" name="Cliff Unlock" />
                    <Bar dataKey="linear" stackId="a" fill="#3b82f6" name="Linear Unlock" />
                  </>
                )}
                {chartMode === "cliff" && (
                  <Bar dataKey="cliff" fill="#ef4444" name="Cliff Unlock %" />
                )}
                {chartMode === "linear" && (
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
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.map((m, i) => (
                  <TableRow key={m.token.coingeckoId} data-testid={`row-screener-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.token.image && <img src={m.token.image} alt="" className="h-5 w-5 rounded-full" />}
                        <div>
                          <div className="font-medium text-sm">{m.token.name}</div>
                          <div className="text-xs text-muted-foreground">{m.token.symbol}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCompact(m.token.marketCap)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(m.circulationPct, 100)}%` }} />
                        </div>
                        <span className="font-medium">{m.circulationPct.toFixed(1)}%</span>
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
                    <TableCell>
                      <Badge variant={m.confidence === "high" ? "default" : m.confidence === "medium" ? "secondary" : "outline"} className="text-xs">
                        {m.confidence}
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
  const [activeTab, setActiveTab] = useState("emission");
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

  const tokenQueries = useQueries({
    queries: selectedTokens.map((t) => ({
      queryKey: ["/api/crypto/emissions", t.id],
      enabled: true,
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  });

  const emissionsMap = useMemo(() => {
    const map = new Map<string, EmissionsData>();
    selectedTokens.forEach((t, i) => {
      const q = tokenQueries[i];
      if (q?.data) map.set(t.id, q.data as EmissionsData);
    });
    return map;
  }, [selectedTokens, tokenQueries]);

  const loadingIds = useMemo(() => {
    return selectedTokens.filter((_, i) => tokenQueries[i]?.isLoading).map((t) => t.id);
  }, [selectedTokens, tokenQueries]);

  const handleAddToken = (result: SearchResult) => {
    if (selectedTokens.find((t) => t.id === result.id)) return;
    setSelectedTokens((prev) => [...prev, { id: result.id, name: result.name, symbol: result.symbol, thumb: result.thumb }]);
  };

  const handleRemoveToken = (id: string) => {
    setSelectedTokens((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-emissions-title">Crypto Market Emissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare token emission schedules, inflation rates, and screen for unlock pressure across projects
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <TokenSearch onSelect={handleAddToken} excludeIds={selectedTokens.map((t) => t.id)} />
          {selectedTokens.length > 0 && (
            <SelectedTokenChips tokens={selectedTokens} loadingIds={loadingIds} onRemove={handleRemoveToken} />
          )}
          {loadingIds.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing emissions for {loadingIds.length} token{loadingIds.length > 1 ? "s" : ""}...
              <span className="text-xs">(fetching supply data and researching allocations)</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-emissions">
          <TabsTrigger value="emission" data-testid="tab-compare-emission">Compare Emission</TabsTrigger>
          <TabsTrigger value="inflation" data-testid="tab-compare-inflation">Compare Inflation</TabsTrigger>
          <TabsTrigger value="screener" data-testid="tab-screener">Emission Screener</TabsTrigger>
        </TabsList>

        <TabsContent value="emission" className="mt-4">
          <CompareEmissionTab tokenIds={selectedTokens.map((t) => t.id)} emissionsMap={emissionsMap} />
        </TabsContent>

        <TabsContent value="inflation" className="mt-4">
          <CompareInflationTab tokenIds={selectedTokens.map((t) => t.id)} emissionsMap={emissionsMap} />
        </TabsContent>

        <TabsContent value="screener" className="mt-4">
          <EmissionScreenerTab tokenIds={selectedTokens.map((t) => t.id)} emissionsMap={emissionsMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
