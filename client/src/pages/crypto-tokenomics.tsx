import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject, TokenSupplySchedule, TokenIncentive, TokenAllocation, FundraisingRound } from "@shared/schema";
import { ArrowLeft, Plus, Trash2, Shield, AlertTriangle, Download, Loader2, Users, Lock, Coins, Edit2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f97316", "#06b6d4", "#8b5cf6"];

function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatSupply(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  if (n >= 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
}

const emptySupplyForm = {
  label: "",
  amount: 0,
  percentOfTotal: 0,
  unlockDate: "",
  vestingMonths: 0,
};

const emptyIncentiveForm = {
  role: "",
  contribution: "",
  rewardType: "",
  rewardSource: "",
  allocationPercent: 0,
  estimatedApy: 0,
  vestingMonths: 0,
  isSustainable: true,
  sustainabilityNotes: "",
};

const emptyAllocationForm = {
  category: "",
  percentage: 0,
  amount: 0,
  vestingMonths: 0,
  cliffMonths: 0,
  tgePercent: 0,
  notes: "",
};

const emptyFundraisingForm = {
  roundType: "",
  amount: 0,
  valuation: 0,
  date: "",
  leadInvestors: "",
  tokenPrice: 0,
  notes: "",
};

const ALLOCATION_CATEGORIES = ["Team", "Investors", "Community", "Treasury", "Ecosystem", "Advisors", "Public Sale", "Liquidity", "Staking Rewards"];
const ROUND_TYPES = ["Pre-Seed", "Seed", "Private", "Strategic", "Public/IDO", "Series A", "Series B"];

export default function CryptoTokenomics() {
  const [, params] = useRoute("/crypto/tokenomics/:id");
  const projectId = params?.id || "";
  const { toast } = useToast();

  const [supplyFormOpen, setSupplyFormOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState({ ...emptySupplyForm });

  const [incentiveFormOpen, setIncentiveFormOpen] = useState(false);
  const [editingIncentiveId, setEditingIncentiveId] = useState<string | null>(null);
  const [incentiveForm, setIncentiveForm] = useState({ ...emptyIncentiveForm });

  const [allocationFormOpen, setAllocationFormOpen] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [allocationForm, setAllocationForm] = useState({ ...emptyAllocationForm });

  const [fundraisingFormOpen, setFundraisingFormOpen] = useState(false);
  const [editingFundraisingId, setEditingFundraisingId] = useState<string | null>(null);
  const [fundraisingForm, setFundraisingForm] = useState({ ...emptyFundraisingForm });

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({
    queryKey: ["/api/crypto/projects", projectId],
    enabled: !!projectId,
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery<TokenSupplySchedule[]>({
    queryKey: ["/api/crypto/projects", projectId, "supply-schedules"],
    enabled: !!projectId,
  });

  const { data: incentives, isLoading: incentivesLoading } = useQuery<TokenIncentive[]>({
    queryKey: ["/api/crypto/projects", projectId, "incentives"],
    enabled: !!projectId,
  });

  const { data: allocations, isLoading: allocationsLoading } = useQuery<TokenAllocation[]>({
    queryKey: ["/api/crypto/projects", projectId, "allocations"],
    enabled: !!projectId,
  });

  const { data: fundraisingRounds, isLoading: fundraisingLoading } = useQuery<FundraisingRound[]>({
    queryKey: ["/api/crypto/projects", projectId, "fundraising"],
    enabled: !!projectId,
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/crypto/supply-schedules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] });
      setSupplyFormOpen(false);
      setSupplyForm({ ...emptySupplyForm });
      toast({ title: "Supply schedule entry added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crypto/supply-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] });
      toast({ title: "Supply schedule entry deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createIncentiveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/crypto/incentives", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] });
      setIncentiveFormOpen(false);
      setEditingIncentiveId(null);
      setIncentiveForm({ ...emptyIncentiveForm });
      toast({ title: editingIncentiveId ? "Incentive updated" : "Incentive added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateIncentiveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/crypto/incentives/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] });
      setIncentiveFormOpen(false);
      setEditingIncentiveId(null);
      setIncentiveForm({ ...emptyIncentiveForm });
      toast({ title: "Incentive updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteIncentiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crypto/incentives/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] });
      toast({ title: "Incentive deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const loadTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!project?.coingeckoId) throw new Error("No CoinGecko ID");
      const res = await fetch(`/api/crypto/incentive-templates/${project.coingeckoId}`);
      if (!res.ok) throw new Error("Failed to load template");
      return res.json();
    },
    onSuccess: async (templateItems: Array<Record<string, unknown>>) => {
      if (!templateItems.length) {
        toast({ title: "No template found", description: "No pre-built incentive template available for this project.", variant: "destructive" });
        return;
      }
      for (const item of templateItems) {
        await apiRequest("POST", "/api/crypto/incentives", {
          projectId,
          role: item.role || "",
          contribution: item.contribution || "",
          rewardType: item.rewardType || "",
          rewardSource: item.rewardSource || "",
          allocationPercent: item.allocationPercent || 0,
          estimatedApy: item.estimatedApy || null,
          vestingMonths: item.vestingMonths || null,
          isSustainable: item.isSustainable ?? true,
          sustainabilityNotes: item.sustainabilityNotes || null,
          sortOrder: item.sortOrder || 0,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] });
      toast({ title: "Template loaded", description: `${templateItems.length} incentive entries added.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error loading template", description: err.message, variant: "destructive" });
    },
  });

  function handleSaveSupply() {
    if (!supplyForm.label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    createScheduleMutation.mutate({
      projectId,
      eventType: "allocation",
      label: supplyForm.label.trim(),
      amount: Number(supplyForm.amount) || 0,
      date: supplyForm.unlockDate || null,
      recurringIntervalMonths: Number(supplyForm.vestingMonths) || null,
      notes: supplyForm.percentOfTotal ? `${supplyForm.percentOfTotal}% of total` : null,
      sortOrder: (schedules?.length || 0),
    });
  }

  function handleSaveIncentive() {
    if (!incentiveForm.role.trim() || !incentiveForm.contribution.trim()) {
      toast({ title: "Role and Contribution are required", variant: "destructive" });
      return;
    }
    const payload = {
      projectId,
      role: incentiveForm.role.trim(),
      contribution: incentiveForm.contribution.trim(),
      rewardType: incentiveForm.rewardType.trim(),
      rewardSource: incentiveForm.rewardSource.trim(),
      allocationPercent: Number(incentiveForm.allocationPercent) || 0,
      estimatedApy: Number(incentiveForm.estimatedApy) || null,
      vestingMonths: Number(incentiveForm.vestingMonths) || null,
      isSustainable: incentiveForm.isSustainable,
      sustainabilityNotes: incentiveForm.sustainabilityNotes.trim() || null,
      sortOrder: (incentives?.length || 0),
    };
    if (editingIncentiveId) {
      updateIncentiveMutation.mutate({ id: editingIncentiveId, data: payload });
    } else {
      createIncentiveMutation.mutate(payload);
    }
  }

  function openEditIncentive(inc: TokenIncentive) {
    setEditingIncentiveId(inc.id);
    setIncentiveForm({
      role: inc.role || "",
      contribution: inc.contribution || "",
      rewardType: inc.rewardType || "",
      rewardSource: inc.rewardSource || "",
      allocationPercent: inc.allocationPercent || 0,
      estimatedApy: inc.estimatedApy || 0,
      vestingMonths: inc.vestingMonths || 0,
      isSustainable: inc.isSustainable ?? true,
      sustainabilityNotes: inc.sustainabilityNotes || "",
    });
    setIncentiveFormOpen(true);
  }

  function openAddIncentive() {
    setEditingIncentiveId(null);
    setIncentiveForm({ ...emptyIncentiveForm });
    setIncentiveFormOpen(true);
  }

  const circulatingRatio = project?.circulatingSupply && project?.totalSupply
    ? (project.circulatingSupply / project.totalSupply) * 100
    : 0;

  const fdvMcapRatio = project?.fullyDilutedValuation && project?.marketCap && project.marketCap > 0
    ? project.fullyDilutedValuation / project.marketCap
    : 0;

  const inflationEstimate = project?.maxSupply && project?.circulatingSupply && project.circulatingSupply > 0
    ? ((project.maxSupply - project.circulatingSupply) / project.circulatingSupply) * 100
    : null;

  const pieData = (schedules || [])
    .filter(s => s.amount > 0)
    .map(s => ({
      name: s.label,
      value: s.amount,
    }));

  const totalAllocation = pieData.reduce((sum, d) => sum + d.value, 0);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4" data-testid="project-not-found">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/crypto">
          <Button variant="outline" className="mt-2" data-testid="link-back-crypto">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Crypto
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" data-testid="page-crypto-tokenomics">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/crypto">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {project.image && (
            <img
              src={project.image}
              alt={project.name}
              className="h-8 w-8 rounded-full"
              data-testid="img-project"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-project-name">
              {project.name}
            </h1>
            <span className="text-sm text-muted-foreground uppercase" data-testid="text-project-symbol">
              {project.symbol}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="card-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Price</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-price">{formatPrice(project.currentPrice)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-market-cap">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Market Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-market-cap">{formatCompact(project.marketCap)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-circulating-supply">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Circulating Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-circulating-supply">{formatSupply(project.circulatingSupply)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-supply">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-total-supply">{formatSupply(project.totalSupply)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-circulating-ratio">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Circulating / Total Ratio</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-bold" data-testid="text-circulating-ratio">
              {circulatingRatio.toFixed(1)}%
            </div>
            <Progress value={circulatingRatio} className="h-2" data-testid="progress-circulating-ratio" />
          </CardContent>
        </Card>

        <Card data-testid="card-inflation">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Inflation Estimate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-inflation">
              {inflationEstimate != null ? `${inflationEstimate.toFixed(1)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.maxSupply ? `Max Supply: ${formatSupply(project.maxSupply)}` : "No max supply defined"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-fdv-mcap">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">FDV / Market Cap</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-fdv-mcap">
              {fdvMcapRatio > 0 ? `${fdvMcapRatio.toFixed(2)}x` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              FDV: {formatCompact(project.fullyDilutedValuation)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="supply" data-testid="tabs-tokenomics">
        <TabsList>
          <TabsTrigger value="supply" data-testid="tab-supply">Supply Schedule</TabsTrigger>
          <TabsTrigger value="incentives" data-testid="tab-incentives">Incentive Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="text-supply-title">Supply Schedule</h2>
            <Button onClick={() => { setSupplyForm({ ...emptySupplyForm }); setSupplyFormOpen(true); }} data-testid="button-add-supply">
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table data-testid="table-supply">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Label</TableHead>
                      <TableHead className="text-right font-semibold">Amount</TableHead>
                      <TableHead className="text-right font-semibold">% of Total</TableHead>
                      <TableHead className="font-semibold">Unlock Date</TableHead>
                      <TableHead className="text-right font-semibold">Vesting (Months)</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulesLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )}
                    {!schedulesLoading && (!schedules || schedules.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="text-no-schedules">
                          No supply schedule entries yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {(schedules || []).map((s) => {
                      const pct = totalAllocation > 0 ? ((s.amount / totalAllocation) * 100) : 0;
                      return (
                        <TableRow key={s.id} data-testid={`row-supply-${s.id}`}>
                          <TableCell className="font-medium" data-testid={`text-supply-label-${s.id}`}>{s.label}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-amount-${s.id}`}>{formatSupply(s.amount)}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-pct-${s.id}`}>{pct.toFixed(1)}%</TableCell>
                          <TableCell data-testid={`text-supply-date-${s.id}`}>{s.date || "--"}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-vesting-${s.id}`}>{s.recurringIntervalMonths || "--"}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteScheduleMutation.mutate(s.id)}
                              disabled={deleteScheduleMutation.isPending}
                              data-testid={`button-delete-supply-${s.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {pieData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-pie-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Allocation Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatSupply(value)}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            color: "hsl(var(--card-foreground))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Allocation Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pieData.map((d, i) => {
                    const pct = totalAllocation > 0 ? (d.value / totalAllocation) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1" data-testid={`timeline-segment-${i}`}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium truncate">{d.name}</span>
                          <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 rounded-md overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-md transition-all"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="incentives" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="text-incentives-title">Incentive Mapping</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => loadTemplateMutation.mutate()}
                disabled={loadTemplateMutation.isPending}
                data-testid="button-load-template"
              >
                {loadTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Load Template
              </Button>
              <Button onClick={openAddIncentive} data-testid="button-add-incentive">
                <Plus className="h-4 w-4 mr-1" />
                Add Incentive
              </Button>
            </div>
          </div>

          {incentivesLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!incentivesLoading && (!incentives || incentives.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-incentives">
                No incentives defined yet. Add one or load a template.
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(incentives || []).map((inc) => (
              <Card key={inc.id} data-testid={`card-incentive-${inc.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span data-testid={`text-incentive-role-${inc.id}`}>{inc.role}</span>
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {inc.isSustainable ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30" data-testid={`badge-sustainable-${inc.id}`}>
                          <Shield className="h-3 w-3 mr-0.5" />
                          Sustainable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-500/30" data-testid={`badge-unsustainable-${inc.id}`}>
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Unsustainable
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Contribution</span>
                      <p className="font-medium" data-testid={`text-incentive-contribution-${inc.id}`}>{inc.contribution}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Reward Type</span>
                      <p className="font-medium" data-testid={`text-incentive-rewardType-${inc.id}`}>{inc.rewardType}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Reward Source</span>
                      <p className="font-medium" data-testid={`text-incentive-rewardSource-${inc.id}`}>{inc.rewardSource}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Allocation %</span>
                      <p className="font-medium" data-testid={`text-incentive-allocation-${inc.id}`}>{inc.allocationPercent || 0}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Est. APY</span>
                      <p className="font-medium" data-testid={`text-incentive-apy-${inc.id}`}>{inc.estimatedApy != null ? `${inc.estimatedApy}%` : "--"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vesting (Months)</span>
                      <p className="font-medium" data-testid={`text-incentive-vesting-${inc.id}`}>{inc.vestingMonths ?? "--"}</p>
                    </div>
                  </div>
                  {inc.sustainabilityNotes && (
                    <p className="text-xs text-muted-foreground italic" data-testid={`text-incentive-notes-${inc.id}`}>
                      {inc.sustainabilityNotes}
                    </p>
                  )}
                  <div className="flex items-center gap-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditIncentive(inc)}
                      data-testid={`button-edit-incentive-${inc.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteIncentiveMutation.mutate(inc.id)}
                      disabled={deleteIncentiveMutation.isPending}
                      data-testid={`button-delete-incentive-${inc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={supplyFormOpen} onOpenChange={setSupplyFormOpen}>
        <DialogContent data-testid="dialog-supply-form">
          <DialogHeader>
            <DialogTitle>Add Supply Schedule Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supply-label">Label</Label>
              <Input
                id="supply-label"
                value={supplyForm.label}
                onChange={(e) => setSupplyForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Team, Investors, Community"
                data-testid="input-supply-label"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="supply-amount">Amount</Label>
                <Input
                  id="supply-amount"
                  type="number"
                  value={supplyForm.amount || ""}
                  onChange={(e) => setSupplyForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-supply-amount"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supply-pct">% of Total</Label>
                <Input
                  id="supply-pct"
                  type="number"
                  value={supplyForm.percentOfTotal || ""}
                  onChange={(e) => setSupplyForm(f => ({ ...f, percentOfTotal: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-supply-percentOfTotal"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="supply-unlock">Unlock Date</Label>
                <Input
                  id="supply-unlock"
                  value={supplyForm.unlockDate}
                  onChange={(e) => setSupplyForm(f => ({ ...f, unlockDate: e.target.value }))}
                  placeholder="e.g. 2025-Q2"
                  data-testid="input-supply-unlockDate"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supply-vesting">Vesting (Months)</Label>
                <Input
                  id="supply-vesting"
                  type="number"
                  value={supplyForm.vestingMonths || ""}
                  onChange={(e) => setSupplyForm(f => ({ ...f, vestingMonths: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-supply-vestingMonths"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplyFormOpen(false)} data-testid="button-cancel-supply">
              Cancel
            </Button>
            <Button
              onClick={handleSaveSupply}
              disabled={createScheduleMutation.isPending}
              data-testid="button-save-supply"
            >
              {createScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incentiveFormOpen} onOpenChange={(open) => { setIncentiveFormOpen(open); if (!open) setEditingIncentiveId(null); }}>
        <DialogContent data-testid="dialog-incentive-form">
          <DialogHeader>
            <DialogTitle>{editingIncentiveId ? "Edit Incentive" : "Add Incentive"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inc-role">Role</Label>
                <Input
                  id="inc-role"
                  value={incentiveForm.role}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Liquidity Provider"
                  data-testid="input-incentive-role"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inc-contribution">Contribution</Label>
                <Input
                  id="inc-contribution"
                  value={incentiveForm.contribution}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, contribution: e.target.value }))}
                  placeholder="e.g. Provide liquidity"
                  data-testid="input-incentive-contribution"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inc-rewardType">Reward Type</Label>
                <Input
                  id="inc-rewardType"
                  value={incentiveForm.rewardType}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, rewardType: e.target.value }))}
                  placeholder="e.g. Token emission"
                  data-testid="input-incentive-rewardType"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inc-rewardSource">Reward Source</Label>
                <Input
                  id="inc-rewardSource"
                  value={incentiveForm.rewardSource}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, rewardSource: e.target.value }))}
                  placeholder="e.g. Protocol treasury"
                  data-testid="input-incentive-rewardSource"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inc-allocation">Allocation %</Label>
                <Input
                  id="inc-allocation"
                  type="number"
                  value={incentiveForm.allocationPercent || ""}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, allocationPercent: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-incentive-allocationPercent"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inc-apy">Est. APY %</Label>
                <Input
                  id="inc-apy"
                  type="number"
                  value={incentiveForm.estimatedApy || ""}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, estimatedApy: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-incentive-estimatedApy"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inc-vesting">Vesting (Mo)</Label>
                <Input
                  id="inc-vesting"
                  type="number"
                  value={incentiveForm.vestingMonths || ""}
                  onChange={(e) => setIncentiveForm(f => ({ ...f, vestingMonths: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-incentive-vestingMonths"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-notes">Sustainability Notes</Label>
              <Input
                id="inc-notes"
                value={incentiveForm.sustainabilityNotes}
                onChange={(e) => setIncentiveForm(f => ({ ...f, sustainabilityNotes: e.target.value }))}
                placeholder="Notes on sustainability..."
                data-testid="input-incentive-sustainabilityNotes"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="inc-sustainable" className="text-sm">Sustainable</Label>
              <Button
                variant={incentiveForm.isSustainable ? "default" : "outline"}
                size="sm"
                onClick={() => setIncentiveForm(f => ({ ...f, isSustainable: !f.isSustainable }))}
                data-testid="button-toggle-sustainable"
              >
                {incentiveForm.isSustainable ? "Yes" : "No"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIncentiveFormOpen(false); setEditingIncentiveId(null); }} data-testid="button-cancel-incentive">
              Cancel
            </Button>
            <Button
              onClick={handleSaveIncentive}
              disabled={createIncentiveMutation.isPending || updateIncentiveMutation.isPending}
              data-testid="button-save-incentive"
            >
              {(createIncentiveMutation.isPending || updateIncentiveMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingIncentiveId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
