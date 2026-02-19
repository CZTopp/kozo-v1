import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject } from "@shared/schema";
import { ArrowLeft, Save, Loader2, Search, X, Check, Clock } from "lucide-react";
import { CryptoProjectNav } from "@/components/crypto-project-nav";

interface DefiLlamaSearchResult {
  name: string;
  slug: string;
  tvl?: number;
  logo?: string;
}

const GOVERNANCE_TYPES = ["DAO", "Multi-sig", "Foundation", "Council", "Hybrid", "None"];

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CryptoSettings() {
  const [, params] = useRoute("/crypto/settings/:id");
  const projectId = params?.id || "";
  const { toast } = useToast();

  const { data: project, isLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: cachedData } = useQuery<any>({
    queryKey: ["/api/crypto/projects", projectId, "cached-data"],
    queryFn: () => fetch(`/api/crypto/projects/${projectId}/cached-data`).then(r => r.json()),
    enabled: !!projectId,
  });

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    coingeckoId: "",
    chainId: "",
    contractAddress: "",
    stakingContract: "",
    defiLlamaId: "",
    discountRate: 0.15,
    feeGrowthRate: 0.10,
    terminalGrowthRate: 0.02,
    projectionYears: 5,
    governanceType: "",
    votingMechanism: "",
    treasurySize: 0,
    treasuryCurrency: "",
    governanceNotes: "",
    notes: "",
  });

  const [defiSearch, setDefiSearch] = useState("");
  const [defiResults, setDefiResults] = useState<DefiLlamaSearchResult[]>([]);
  const [searchingDefi, setSearchingDefi] = useState(false);
  const [showDefiSearch, setShowDefiSearch] = useState(false);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        symbol: project.symbol || "",
        coingeckoId: project.coingeckoId || "",
        chainId: (project as any).chainId || "",
        contractAddress: (project as any).contractAddress || "",
        stakingContract: (project as any).stakingContract || "",
        defiLlamaId: project.defiLlamaId || "",
        discountRate: project.discountRate ?? 0.15,
        feeGrowthRate: project.feeGrowthRate ?? 0.10,
        terminalGrowthRate: project.terminalGrowthRate ?? 0.02,
        projectionYears: project.projectionYears ?? 5,
        governanceType: project.governanceType || "",
        votingMechanism: project.votingMechanism || "",
        treasurySize: project.treasurySize ?? 0,
        treasuryCurrency: project.treasuryCurrency || "",
        governanceNotes: project.governanceNotes || "",
        notes: (project as any).notes || "",
      });
    }
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/crypto/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name,
      symbol: form.symbol,
      coingeckoId: form.coingeckoId,
      chainId: form.chainId || null,
      contractAddress: form.contractAddress || null,
      stakingContract: form.stakingContract || null,
      defiLlamaId: form.defiLlamaId || null,
      discountRate: form.discountRate,
      feeGrowthRate: form.feeGrowthRate,
      terminalGrowthRate: form.terminalGrowthRate,
      projectionYears: form.projectionYears,
      governanceType: form.governanceType || null,
      votingMechanism: form.votingMechanism || null,
      treasurySize: form.treasurySize || null,
      treasuryCurrency: form.treasuryCurrency || null,
      governanceNotes: form.governanceNotes || null,
      notes: form.notes || null,
    });
  };

  const handleDefiSearch = async () => {
    if (!defiSearch.trim()) return;
    setSearchingDefi(true);
    try {
      const res = await fetch(`/api/crypto/defillama/search?q=${encodeURIComponent(defiSearch.trim())}`);
      const data = await res.json();
      setDefiResults(data);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    }
    setSearchingDefi(false);
  };

  const selectDefiProtocol = (slug: string) => {
    setForm(f => ({ ...f, defiLlamaId: slug }));
    setShowDefiSearch(false);
    setDefiResults([]);
    setDefiSearch("");
  };

  const clearDefiProtocol = () => {
    setForm(f => ({ ...f, defiLlamaId: "" }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" data-testid="page-crypto-settings">
      <CryptoProjectNav projectId={projectId} projectName={project.name} projectImage={project.image} projectSymbol={project.symbol} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-settings-title">Project Settings</h2>
        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-settings">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-general-info">
          <CardHeader>
            <CardTitle className="text-sm font-medium">General Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-project-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={form.symbol}
                  onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                  data-testid="input-symbol"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="coingeckoId">CoinGecko ID</Label>
                <Input
                  id="coingeckoId"
                  value={form.coingeckoId}
                  onChange={e => setForm(f => ({ ...f, coingeckoId: e.target.value }))}
                  data-testid="input-coingecko-id"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Research Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Your analysis notes on this project..."
                className="min-h-[80px]"
                data-testid="input-notes"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chain-config">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Chain & Contract Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="chainId">Chain</Label>
              <Select value={form.chainId} onValueChange={v => setForm(f => ({ ...f, chainId: v }))}>
                <SelectTrigger data-testid="select-chain">
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ethereum (1)</SelectItem>
                  <SelectItem value="137">Polygon (137)</SelectItem>
                  <SelectItem value="42161">Arbitrum (42161)</SelectItem>
                  <SelectItem value="10">Optimism (10)</SelectItem>
                  <SelectItem value="8453">Base (8453)</SelectItem>
                  <SelectItem value="56">BSC (56)</SelectItem>
                  <SelectItem value="43114">Avalanche (43114)</SelectItem>
                  <SelectItem value="solana">Solana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractAddress">Token Contract Address</Label>
              <Input
                id="contractAddress"
                value={form.contractAddress}
                onChange={e => setForm(f => ({ ...f, contractAddress: e.target.value }))}
                placeholder="0x..."
                className="font-mono text-xs"
                data-testid="input-contract-address"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stakingContract">Staking Contract (optional)</Label>
              <Input
                id="stakingContract"
                value={form.stakingContract}
                onChange={e => setForm(f => ({ ...f, stakingContract: e.target.value }))}
                placeholder="0x..."
                className="font-mono text-xs"
                data-testid="input-staking-contract"
              />
            </div>
            {cachedData && (
              <div className="pt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  On-chain data: {formatTimeAgo(cachedData.onchainFetchedAt)}
                  {cachedData.onchainStale && <Badge variant="outline" className="text-[10px] py-0">Stale</Badge>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  DeFi data: {formatTimeAgo(cachedData.defiFetchedAt)}
                  {cachedData.defiStale && <Badge variant="outline" className="text-[10px] py-0">Stale</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-defillama-config">
          <CardHeader>
            <CardTitle className="text-sm font-medium">DefiLlama Protocol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.defiLlamaId && !showDefiSearch ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" data-testid="badge-defillama-id">
                  <Check className="h-3 w-3 mr-1" />
                  {form.defiLlamaId}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setShowDefiSearch(true)} data-testid="button-change-protocol">
                  Change
                </Button>
                <Button variant="ghost" size="sm" onClick={clearDefiProtocol} data-testid="button-clear-protocol">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={defiSearch}
                    onChange={e => setDefiSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleDefiSearch()}
                    placeholder="Search DefiLlama protocols..."
                    data-testid="input-defillama-search"
                  />
                  <Button onClick={handleDefiSearch} disabled={searchingDefi} data-testid="button-search-defillama">
                    {searchingDefi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                  {showDefiSearch && form.defiLlamaId && (
                    <Button variant="ghost" size="sm" onClick={() => setShowDefiSearch(false)} data-testid="button-cancel-search">
                      Cancel
                    </Button>
                  )}
                </div>
                {defiResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {defiResults.map((r) => (
                      <button
                        key={r.slug}
                        onClick={() => selectDefiProtocol(r.slug)}
                        className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                        data-testid={`defillama-result-${r.slug}`}
                      >
                        {r.logo && <img src={r.logo} alt="" className="h-4 w-4 rounded-full" />}
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{r.slug}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="defiLlamaIdManual" className="text-xs text-muted-foreground">Or enter manually:</Label>
                  <Input
                    id="defiLlamaIdManual"
                    value={form.defiLlamaId}
                    onChange={e => setForm(f => ({ ...f, defiLlamaId: e.target.value }))}
                    placeholder="e.g., aave, uniswap"
                    className="text-sm"
                    data-testid="input-defillama-id-manual"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-valuation-assumptions">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Valuation Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="discountRate">Discount Rate</Label>
                <Input
                  id="discountRate"
                  type="number"
                  step="0.01"
                  value={form.discountRate}
                  onChange={e => setForm(f => ({ ...f, discountRate: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-discount-rate"
                />
                <span className="text-[10px] text-muted-foreground">{(form.discountRate * 100).toFixed(0)}%</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="feeGrowthRate">Fee Growth Rate</Label>
                <Input
                  id="feeGrowthRate"
                  type="number"
                  step="0.01"
                  value={form.feeGrowthRate}
                  onChange={e => setForm(f => ({ ...f, feeGrowthRate: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-fee-growth-rate"
                />
                <span className="text-[10px] text-muted-foreground">{(form.feeGrowthRate * 100).toFixed(0)}%</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="terminalGrowthRate">Terminal Growth Rate</Label>
                <Input
                  id="terminalGrowthRate"
                  type="number"
                  step="0.01"
                  value={form.terminalGrowthRate}
                  onChange={e => setForm(f => ({ ...f, terminalGrowthRate: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-terminal-growth-rate"
                />
                <span className="text-[10px] text-muted-foreground">{(form.terminalGrowthRate * 100).toFixed(0)}%</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="projectionYears">Projection Years</Label>
                <Input
                  id="projectionYears"
                  type="number"
                  min="1"
                  max="20"
                  value={form.projectionYears}
                  onChange={e => setForm(f => ({ ...f, projectionYears: parseInt(e.target.value) || 5 }))}
                  data-testid="input-projection-years"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="card-governance">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Governance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="governanceType">Type</Label>
                <Select value={form.governanceType} onValueChange={v => setForm(f => ({ ...f, governanceType: v }))}>
                  <SelectTrigger data-testid="select-governance-type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GOVERNANCE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="votingMechanism">Voting Mechanism</Label>
                <Input
                  id="votingMechanism"
                  value={form.votingMechanism}
                  onChange={e => setForm(f => ({ ...f, votingMechanism: e.target.value }))}
                  placeholder="e.g., Token-weighted"
                  data-testid="input-voting-mechanism"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="treasurySize">Treasury Size</Label>
                <Input
                  id="treasurySize"
                  type="number"
                  value={form.treasurySize}
                  onChange={e => setForm(f => ({ ...f, treasurySize: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-treasury-size"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="treasuryCurrency">Treasury Currency</Label>
                <Input
                  id="treasuryCurrency"
                  value={form.treasuryCurrency}
                  onChange={e => setForm(f => ({ ...f, treasuryCurrency: e.target.value }))}
                  placeholder="e.g., USD, ETH"
                  data-testid="input-treasury-currency"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="governanceNotes">Governance Notes</Label>
              <Textarea
                id="governanceNotes"
                value={form.governanceNotes}
                onChange={e => setForm(f => ({ ...f, governanceNotes: e.target.value }))}
                placeholder="Notes on governance structure, proposals, etc."
                className="min-h-[60px]"
                data-testid="input-governance-notes"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
