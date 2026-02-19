import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject, TokenFlowEntry } from "@shared/schema";
import {
  ArrowLeft, RefreshCw, Loader2, Coins, ArrowUpRight, ArrowDownRight,
  Save, Link2, Database,
} from "lucide-react";
import { CryptoProjectNav } from "@/components/crypto-project-nav";

function formatSupply(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

interface OnChainData {
  burns: { totalBurned: number; recentBurnRate: number; burnEvents: number };
  staking: { stakedBalance: number; stakingRatio: number };
  concentration: { top10Percent: number; top50Percent: number; holderCount: number };
  hasThirdwebData: boolean;
  burnEstimate?: { totalBurned: number; burnPercent: number; hasBurnProgram: boolean; source: string };
  chainType?: string;
  chainName?: string;
  note?: string;
}

interface LocalEntry {
  id?: string;
  period: number;
  periodLabel: string;
  minting: number;
  unlocks: number;
  burns: number;
  buybacks: number;
  stakingLockups: number;
  netFlow: number;
  cumulativeSupply: number;
}

function recalcFlows(entries: LocalEntry[]): LocalEntry[] {
  let cumulative = 0;
  return entries.map((e, i) => {
    const netFlow = (e.minting || 0) + (e.unlocks || 0) - (e.burns || 0) - (e.buybacks || 0) - (e.stakingLockups || 0);
    cumulative = (i === 0 ? 0 : cumulative) + netFlow;
    return { ...e, netFlow, cumulativeSupply: cumulative };
  });
}

export default function CryptoTokenFlows() {
  const [, params] = useRoute("/crypto/token-flows/:id");
  const projectId = params?.id;
  const { toast } = useToast();

  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [onchainOpen, setOnchainOpen] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [chainId, setChainId] = useState("1");
  const [stakingAddress, setStakingAddress] = useState("");
  const [onchainData, setOnchainData] = useState<OnChainData | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: cachedData } = useQuery<any>({
    queryKey: ["/api/crypto/projects", projectId, "cached-data"],
    queryFn: () => fetch(`/api/crypto/projects/${projectId}/cached-data`).then(r => r.json()),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (cachedData?.onchain && !onchainData) {
      setOnchainData(cachedData.onchain);
      setOnchainOpen(true);
      if (cachedData.contractAddress) setTokenAddress(cachedData.contractAddress);
      if (cachedData.chainId) setChainId(cachedData.chainId);
    }
  }, [cachedData]);

  const { data: contractInfo } = useQuery<{ found: boolean; address?: string; chainId?: number | string; chainName?: string; isEvm?: boolean }>({
    queryKey: ["/api/crypto/projects", projectId, "contract-address"],
    enabled: !!projectId && !cachedData?.contractAddress,
  });

  useEffect(() => {
    if (contractInfo?.found && contractInfo.address && !tokenAddress) {
      setTokenAddress(contractInfo.address);
      if (contractInfo.chainId) setChainId(String(contractInfo.chainId));
    }
  }, [contractInfo]);

  const { data: flows, isLoading: flowsLoading } = useQuery<TokenFlowEntry[]>({
    queryKey: ["/api/crypto/projects", projectId, "token-flows"],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (flows && flows.length > 0) {
      setLocalEntries(
        flows.map((f) => ({
          id: f.id,
          period: f.period,
          periodLabel: f.periodLabel,
          minting: f.minting ?? 0,
          unlocks: f.unlocks ?? 0,
          burns: f.burns ?? 0,
          buybacks: f.buybacks ?? 0,
          stakingLockups: f.stakingLockups ?? 0,
          netFlow: f.netFlow ?? 0,
          cumulativeSupply: f.cumulativeSupply ?? 0,
        }))
      );
      setIsDirty(false);
    }
  }, [flows]);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/token-flows/seed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "token-flows"] });
      toast({ title: "Token flows seeded from supply schedules" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to seed token flows", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/token-flows`, {
        entries: localEntries.map((e) => ({
          projectId,
          period: e.period,
          periodLabel: e.periodLabel,
          minting: e.minting,
          unlocks: e.unlocks,
          burns: e.burns,
          buybacks: e.buybacks,
          stakingLockups: e.stakingLockups,
          netFlow: e.netFlow,
          cumulativeSupply: e.cumulativeSupply,
        })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "token-flows"] });
      setIsDirty(false);
      toast({ title: "Token flows saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const onchainMutation = useMutation({
    mutationFn: async () => {
      const parsedChainId = chainId === "solana" ? "solana" : parseInt(chainId);
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/onchain-data`, {
        tokenAddress,
        chainId: parsedChainId,
        ...(stakingAddress ? { stakingContract: stakingAddress } : {}),
      });
      return res.json();
    },
    onSuccess: (data: OnChainData) => {
      setOnchainData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "cached-data"] });
      toast({ title: "On-chain data fetched" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to fetch on-chain data", description: err.message, variant: "destructive" });
    },
  });

  const updateEntry = useCallback(
    (index: number, field: keyof Pick<LocalEntry, "minting" | "unlocks" | "burns" | "buybacks" | "stakingLockups">, value: number) => {
      setLocalEntries((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return recalcFlows(updated);
      });
      setIsDirty(true);
    },
    []
  );

  if (!projectId) {
    return (
      <div className="p-4" data-testid="text-no-project">
        <p className="text-muted-foreground">No project selected.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-project">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4" data-testid="text-project-not-found">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  const totalMinting = localEntries.reduce((s, e) => s + e.minting, 0);
  const totalUnlocks = localEntries.reduce((s, e) => s + e.unlocks, 0);
  const totalBurns = localEntries.reduce((s, e) => s + e.burns, 0);
  const totalBuybacks = localEntries.reduce((s, e) => s + e.buybacks, 0);
  const totalStaking = localEntries.reduce((s, e) => s + e.stakingLockups, 0);
  const totalNetIssuance = totalMinting + totalUnlocks - totalBurns - totalBuybacks - totalStaking;
  const finalSupply = localEntries.length > 0 ? localEntries[localEntries.length - 1].cumulativeSupply : 0;

  const waterfallData = localEntries.map((e) => ({
    period: e.periodLabel,
    Minting: e.minting,
    Unlocks: e.unlocks,
    Burns: -(e.burns),
    Buybacks: -(e.buybacks),
    "Staking Lockups": -(e.stakingLockups),
  }));

  const cumulativeData = localEntries.map((e) => ({
    period: e.periodLabel,
    supply: e.cumulativeSupply,
  }));

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    color: "hsl(var(--card-foreground))",
  };

  const formatYAxis = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <CryptoProjectNav projectId={projectId!} projectName={project.name} projectImage={project.image} projectSymbol={project.symbol} />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            data-testid="button-seed"
          >
            {seedMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Auto-seed
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty || localEntries.length === 0}
            data-testid="button-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Collapsible open={onchainOpen} onOpenChange={setOnchainOpen}>
        <Card data-testid="card-onchain">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              On-Chain Data
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-toggle-onchain">
                <Link2 className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Token Contract Address
                    {contractInfo?.found && (
                      <span className="text-xs text-green-500 ml-1">(auto-detected)</span>
                    )}
                  </label>
                  <Input
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    data-testid="input-token-address"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Chain</label>
                  <Select value={chainId} onValueChange={setChainId}>
                    <SelectTrigger data-testid="select-chain">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ethereum</SelectItem>
                      <SelectItem value="solana">Solana</SelectItem>
                      <SelectItem value="137">Polygon</SelectItem>
                      <SelectItem value="42161">Arbitrum</SelectItem>
                      <SelectItem value="8453">Base</SelectItem>
                      <SelectItem value="10">Optimism</SelectItem>
                      <SelectItem value="56">BSC</SelectItem>
                      <SelectItem value="43114">Avalanche</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Staking Contract (optional)</label>
                  <Input
                    placeholder="0x..."
                    value={stakingAddress}
                    onChange={(e) => setStakingAddress(e.target.value)}
                    data-testid="input-staking-address"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {cachedData?.onchainFetchedAt && (
                  <span className="text-xs text-muted-foreground" data-testid="text-onchain-fetched-at">
                    Last fetched: {new Date(cachedData.onchainFetchedAt).toLocaleDateString()}
                    {cachedData.onchainStale && <Badge variant="outline" className="ml-1 text-[10px] py-0">Stale</Badge>}
                  </span>
                )}
                <Button
                  onClick={() => onchainMutation.mutate()}
                  disabled={onchainMutation.isPending || !tokenAddress}
                  data-testid="button-fetch-onchain"
                >
                  {onchainMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-1" />
                  )}
                  {cachedData?.onchainStale ? "Refresh On-Chain Data" : "Fetch On-Chain Data"}
                </Button>
              </div>

              {onchainData && (
                <div className="space-y-3 mt-3">
                  {onchainData.note && (
                    <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2" data-testid="text-chain-note">
                      {onchainData.note}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="onchain-results">
                    <Card data-testid="card-burn-rate">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-muted-foreground">
                            {onchainData.burnEstimate?.hasBurnProgram ? "Burn Program" : "Burn Rate"}
                          </span>
                        </div>
                        {onchainData.burnEstimate?.hasBurnProgram ? (
                          <>
                            <div className="text-lg font-bold" data-testid="text-burn-rate">
                              {onchainData.burnEstimate.burnPercent.toFixed(2)}% burned
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Total burned: {formatSupply(onchainData.burnEstimate.totalBurned)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Source: {onchainData.burnEstimate.source === "max_supply_delta" ? "maxSupply vs totalSupply" : "supply data"}
                            </p>
                            {onchainData.burns.totalBurned > 0 && onchainData.chainType === "evm" && (
                              <p className="text-xs text-muted-foreground">
                                On-chain confirmed: {formatSupply(onchainData.burns.totalBurned)}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-bold" data-testid="text-burn-rate">
                              {onchainData.burns.recentBurnRate > 0
                                ? `${formatSupply(onchainData.burns.recentBurnRate)}/day`
                                : "No burns detected"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Total burned: {formatSupply(onchainData.burns.totalBurned)}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                    <Card data-testid="card-staking-ratio">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">Staking Ratio</span>
                        </div>
                        <div className="text-lg font-bold" data-testid="text-staking-ratio">
                          {onchainData.staking.stakingRatio > 0
                            ? `${(onchainData.staking.stakingRatio * 100).toFixed(1)}%`
                            : "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {onchainData.staking.stakedBalance > 0
                            ? `Staked: ${formatSupply(onchainData.staking.stakedBalance)}`
                            : onchainData.chainType === "non-evm" ? "Not available for this chain" : "No staking data"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-concentration">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Holder Concentration</span>
                        </div>
                        <div className="text-lg font-bold" data-testid="text-holder-count">
                          {onchainData.concentration.holderCount > 0
                            ? `${onchainData.concentration.holderCount.toLocaleString()} holders`
                            : "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {onchainData.concentration.holderCount > 0
                            ? `Top 10: ${(onchainData.concentration.top10Percent * 100).toFixed(1)}% | Top 50: ${(onchainData.concentration.top50Percent * 100).toFixed(1)}%`
                            : onchainData.chainType === "non-evm" ? "Not available for this chain" : "No holder data"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {flowsLoading ? (
        <div className="flex items-center justify-center h-48" data-testid="loading-flows">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : localEntries.length === 0 ? (
        <Card data-testid="card-no-data">
          <CardContent className="py-8 text-center">
            <Coins className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No token flow data yet. Click "Auto-seed" to generate from supply schedules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card data-testid="card-flow-table">
            <CardContent className="pt-4 overflow-x-auto">
              <Table data-testid="table-flows">
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Minting</TableHead>
                    <TableHead>Unlocks</TableHead>
                    <TableHead>Burns</TableHead>
                    <TableHead>Buybacks</TableHead>
                    <TableHead>Staking Lockups</TableHead>
                    <TableHead>Net Flow</TableHead>
                    <TableHead>Cumulative Supply</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localEntries.map((entry, idx) => (
                    <TableRow key={entry.period} data-testid={`row-flow-${idx}`}>
                      <TableCell className="font-medium" data-testid={`text-period-${idx}`}>
                        {entry.periodLabel}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.minting}
                          onChange={(e) => updateEntry(idx, "minting", parseFloat(e.target.value) || 0)}
                          className="w-28"
                          data-testid={`input-minting-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.unlocks}
                          onChange={(e) => updateEntry(idx, "unlocks", parseFloat(e.target.value) || 0)}
                          className="w-28"
                          data-testid={`input-unlocks-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.burns}
                          onChange={(e) => updateEntry(idx, "burns", parseFloat(e.target.value) || 0)}
                          className="w-28"
                          data-testid={`input-burns-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.buybacks}
                          onChange={(e) => updateEntry(idx, "buybacks", parseFloat(e.target.value) || 0)}
                          className="w-28"
                          data-testid={`input-buybacks-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.stakingLockups}
                          onChange={(e) => updateEntry(idx, "stakingLockups", parseFloat(e.target.value) || 0)}
                          className="w-28"
                          data-testid={`input-staking-${idx}`}
                        />
                      </TableCell>
                      <TableCell data-testid={`text-netflow-${idx}`}>
                        <span className={entry.netFlow >= 0 ? "text-green-500" : "text-red-500"}>
                          {entry.netFlow >= 0 ? <ArrowUpRight className="h-3 w-3 inline mr-0.5" /> : <ArrowDownRight className="h-3 w-3 inline mr-0.5" />}
                          {formatSupply(entry.netFlow)}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-cumulative-${idx}`}>
                        {formatSupply(entry.cumulativeSupply)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card data-testid="card-total-net-issuance">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total Net Issuance</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold" data-testid="text-total-net-issuance">
                  {formatSupply(totalNetIssuance)}
                </div>
                <p className="text-xs text-muted-foreground">Minting + Unlocks - Burns - Buybacks - Staking</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-burns">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total Burns</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold" data-testid="text-total-burns">
                  {formatSupply(totalBurns + totalBuybacks)}
                </div>
                <p className="text-xs text-muted-foreground">Burns: {formatSupply(totalBurns)} + Buybacks: {formatSupply(totalBuybacks)}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-staking">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total Staking Locked</CardTitle>
                <Coins className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold" data-testid="text-total-staking">
                  {formatSupply(totalStaking)}
                </div>
                <p className="text-xs text-muted-foreground">Locked in staking contracts</p>
              </CardContent>
            </Card>
            <Card data-testid="card-final-supply">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Final Projected Supply</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold" data-testid="text-final-supply">
                  {formatSupply(finalSupply)}
                </div>
                <p className="text-xs text-muted-foreground">End of projection period</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-waterfall-chart">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Token Flow Waterfall</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80" data-testid="chart-waterfall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData} stackOffset="sign">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatSupply(value)} />
                      <Legend />
                      <Bar dataKey="Minting" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Unlocks" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Burns" stackId="a" fill="#ef4444" />
                      <Bar dataKey="Buybacks" stackId="a" fill="#f97316" />
                      <Bar dataKey="Staking Lockups" stackId="a" fill="#8b5cf6" radius={[0, 0, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-cumulative-chart">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Cumulative Supply</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80" data-testid="chart-cumulative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatSupply(value)} />
                      <Area
                        type="monotone"
                        dataKey="supply"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.2}
                        name="Cumulative Supply"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
