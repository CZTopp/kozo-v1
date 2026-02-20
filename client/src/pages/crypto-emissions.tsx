import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import {
  Search, Loader2, TrendingUp, AlertTriangle, Info, Coins,
  Lock, Unlock, Clock, BarChart3,
} from "lucide-react";
import {
  Tooltip as UITooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

const ALLOC_COLORS: Record<string, string> = {
  team: "#ef4444",
  investors: "#f97316",
  public: "#22c55e",
  treasury: "#3b82f6",
  community: "#a855f7",
};

const CATEGORY_COLORS = [
  "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ef4444",
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

export default function CryptoEmissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useQuery<SearchResult[]>({
    queryKey: ["/api/crypto/search", searchQuery],
    enabled: searchQuery.length >= 2 && searchOpen,
  });

  const emissionsQuery = useQuery<EmissionsData>({
    queryKey: ["/api/crypto/emissions", selectedToken],
    enabled: !!selectedToken,
  });

  const chartData = useMemo(() => {
    if (!emissionsQuery.data) return [];
    const { months, allocations, totalSupplyTimeSeries, inflationRate } = emissionsQuery.data;
    return months.map((month, i) => {
      const row: Record<string, any> = { month, total: totalSupplyTimeSeries[i], inflationRate: inflationRate[i] };
      for (const alloc of allocations) {
        row[alloc.category] = alloc.monthlyValues[i];
      }
      return row;
    });
  }, [emissionsQuery.data]);

  const handleSelectToken = (result: SearchResult) => {
    setSelectedToken(result.id);
    setSelectedTokenInfo(result);
    setSearchQuery(result.name);
    setSearchOpen(false);
  };

  const data = emissionsQuery.data;
  const supplyUnlockPct = data ? ((data.token.circulatingSupply / data.token.totalSupply) * 100) : 0;
  const lockedPct = data ? (100 - supplyUnlockPct) : 0;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-emissions-title">Token Emission Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projected token supply and emission schedules with allocation breakdown
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a token (e.g. Bitcoin, Ethereum, Solana)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="pl-10"
              data-testid="input-emissions-search"
            />
            {searchOpen && searchQuery.length >= 2 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-64 overflow-auto">
                {searchResults.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                ) : searchResults.data && searchResults.data.length > 0 ? (
                  searchResults.data.map((result) => (
                    <button
                      key={result.id}
                      className="w-full flex items-center gap-3 p-3 text-left hover-elevate"
                      onClick={() => handleSelectToken(result)}
                      data-testid={`button-search-result-${result.id}`}
                    >
                      {result.thumb && (
                        <img src={result.thumb} alt="" className="h-6 w-6 rounded-full" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{result.name}</div>
                        <div className="text-xs text-muted-foreground">{result.symbol.toUpperCase()}</div>
                      </div>
                      {result.market_cap_rank && (
                        <Badge variant="secondary">#{result.market_cap_rank}</Badge>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">No results found</div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {emissionsQuery.isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <p className="font-medium">Analyzing token emissions...</p>
              <p className="text-sm text-muted-foreground mt-1">Fetching supply data and researching allocation schedules</p>
            </div>
          </CardContent>
        </Card>
      )}

      {emissionsQuery.error && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">Failed to load emission data</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(emissionsQuery.error as any)?.message || "Please try again"}
              </p>
            </div>
            <Button variant="outline" onClick={() => emissionsQuery.refetch()} className="ml-auto shrink-0" data-testid="button-retry">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {data.token.image && (
                    <img src={data.token.image} alt="" className="h-8 w-8 rounded-full" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Token</p>
                    <p className="text-lg font-bold truncate" data-testid="text-token-name">
                      {data.token.name} ({data.token.symbol})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Total / Max Supply</p>
                </div>
                <p className="text-lg font-bold mt-1" data-testid="text-total-supply">
                  {formatSupply(data.token.totalSupply)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Circulating: {formatSupply(data.token.circulatingSupply)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Supply Unlocked</p>
                </div>
                <p className="text-lg font-bold mt-1" data-testid="text-unlock-pct">
                  {supplyUnlockPct.toFixed(1)}%
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${Math.min(supplyUnlockPct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{lockedPct.toFixed(1)}% locked</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Market Cap</p>
                </div>
                <p className="text-lg font-bold mt-1" data-testid="text-market-cap">
                  {formatCompact(data.token.marketCap)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Price: ${data.token.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {data.confidence && (
            <div className="flex items-center gap-2">
              <Badge variant={data.confidence === "high" ? "default" : data.confidence === "medium" ? "secondary" : "outline"} data-testid="badge-confidence">
                {data.confidence} confidence
              </Badge>
              {data.notes && (
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{data.notes}</p>
                  </TooltipContent>
                </UITooltip>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Projected Token Supply by Allocation</CardTitle>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                60-month projection
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]" data-testid="chart-supply-area">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => {
                        const [y, m] = v.split("-");
                        return m === "01" || m === "07" ? `${y}-${m}` : "";
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => formatSupply(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [formatSupply(value), name]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />
                    {data.allocations.map((alloc, i) => (
                      <Area
                        key={alloc.category}
                        type="monotone"
                        dataKey={alloc.category}
                        stackId="1"
                        fill={ALLOC_COLORS[alloc.standardGroup] || CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                        stroke={ALLOC_COLORS[alloc.standardGroup] || CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                        fillOpacity={0.7}
                      />
                    ))}
                    {data.cliffEvents.map((evt, i) => (
                      <ReferenceLine
                        key={i}
                        x={evt.month}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{ value: "", position: "top" }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Inflation Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]" data-testid="chart-inflation">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => {
                        const [y, m] = v.split("-");
                        return m === "01" || m === "07" ? `${y}-${m}` : "";
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, "Inflation Rate"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="inflationRate"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      name="Monthly Inflation %"
                    />
                    {data.cliffEvents.map((evt, i) => (
                      <ReferenceLine
                        key={i}
                        x={evt.month}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {data.cliffEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Cliff Unlock Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.cliffEvents.map((evt, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50" data-testid={`cliff-event-${i}`}>
                      <Unlock className="h-4 w-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{evt.label}</p>
                        <p className="text-xs text-muted-foreground">Month: {evt.month}</p>
                      </div>
                      <Badge variant="outline">{formatSupply(evt.amount)} tokens</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Allocation Schedule Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Allocation %</TableHead>
                      <TableHead className="text-right">Total Tokens</TableHead>
                      <TableHead>Vesting Type</TableHead>
                      <TableHead className="text-right">Cliff</TableHead>
                      <TableHead className="text-right">Vesting</TableHead>
                      <TableHead className="text-right">TGE %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.allocations.map((alloc, i) => (
                      <TableRow key={alloc.category} data-testid={`row-allocation-${i}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: ALLOC_COLORS[alloc.standardGroup] || CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                            />
                            <span className="font-medium text-sm">{alloc.category}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{alloc.standardGroup}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{alloc.percentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{formatSupply(alloc.totalTokens)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{alloc.vestingType}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {alloc.cliffMonths > 0 ? `${alloc.cliffMonths}mo` : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {alloc.vestingMonths > 0 ? `${alloc.vestingMonths}mo` : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {alloc.tgePercent > 0 ? `${alloc.tgePercent}%` : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedToken && !emissionsQuery.isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">Search for a Token</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Enter a token name above to see its projected emission schedule, allocation breakdown with cliff and linear unlock timelines, and monthly inflation rate.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
