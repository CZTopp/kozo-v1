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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { CryptoProject, TokenSupplySchedule, TokenIncentive, TokenAllocation, FundraisingRound } from "@shared/schema";
import { ArrowLeft, Plus, Trash2, Shield, AlertTriangle, Download, Loader2, Users, Lock, Coins, Edit2, Landmark, Vote, Wallet, Info, FileText, Upload, X, Sparkles } from "lucide-react";
import { CryptoProjectNav } from "@/components/crypto-project-nav";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f97316", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6"];

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

const emptySupplyForm = { label: "", amount: 0, percentOfTotal: 0, unlockDate: "", vestingMonths: 0 };
const emptyIncentiveForm = { role: "", contribution: "", rewardType: "", rewardSource: "", allocationPercent: 0, estimatedApy: 0, vestingMonths: 0, isSustainable: true, sustainabilityNotes: "" };
const emptyAllocationForm = { category: "", standardGroup: "", percentage: 0, amount: 0, vestingMonths: 0, cliffMonths: 0, tgePercent: 0, vestingType: "linear", dataSource: "", releasedPercent: 0, assumption: "", references: "", description: "", notes: "" };
const emptyFundraisingForm = { roundType: "", amount: 0, valuation: 0, date: "", leadInvestors: "", tokenPrice: 0, notes: "" };

const STANDARD_GROUPS = [
  { value: "team", label: "Founder & Team", categories: ["Founder & Team", "Core Team", "Advisors", "Partners"] },
  { value: "investors", label: "Private Investors", categories: ["Private Investors", "Seed Round", "Strategic Round", "Series A/B"] },
  { value: "public", label: "Public Sale", categories: ["Public Sale", "ICO", "IEO", "IDO", "Launchpad"] },
  { value: "treasury", label: "Treasury & Reserve", categories: ["Treasury & Reserve", "Foundation", "DAO Treasury", "Reserve", "Ecosystem Fund"] },
  { value: "community", label: "Community & Ecosystem", categories: ["Community & Ecosystem", "Airdrops", "Staking Rewards", "Liquidity Mining", "Grants", "Marketing"] },
];
const ALLOCATION_CATEGORIES = ["Founder & Team", "Private Investors", "Public Sale", "Treasury & Reserve", "Community & Ecosystem", "Advisors", "DAO Treasury", "Ecosystem Fund", "Staking Rewards", "Liquidity", "Marketing", "Airdrop", "Foundation", "Partners"];
const VESTING_TYPES = ["linear", "cliff", "immediate", "custom"];
const INDUSTRY_BENCHMARKS = { team: 20, investors: 16, public: 4.6, treasury: 27, community: 37 };
const ROUND_TYPES = ["Pre-Seed", "Seed", "Private", "Strategic", "Public/IDO", "Series A", "Series B", "OTC", "Treasury Sale"];
const GOVERNANCE_TYPES = ["DAO", "Multi-sig", "Foundation", "Council", "Hybrid", "None"];

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
  const [governanceEditing, setGovernanceEditing] = useState(false);
  const [govForm, setGovForm] = useState({ governanceType: "", votingMechanism: "", treasurySize: 0, treasuryCurrency: "USD", governanceNotes: "" });
  const [whitepaperText, setWhitepaperText] = useState("");
  const [whitepaperMode, setWhitepaperMode] = useState<"view" | "paste">("view");
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<CryptoProject>({ queryKey: ["/api/crypto/projects", projectId], enabled: !!projectId });
  const { data: schedules, isLoading: schedulesLoading } = useQuery<TokenSupplySchedule[]>({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"], enabled: !!projectId });
  const { data: incentives, isLoading: incentivesLoading } = useQuery<TokenIncentive[]>({ queryKey: ["/api/crypto/projects", projectId, "incentives"], enabled: !!projectId });
  const { data: allocations, isLoading: allocationsLoading } = useQuery<TokenAllocation[]>({ queryKey: ["/api/crypto/projects", projectId, "allocations"], enabled: !!projectId });
  const { data: fundraisingRounds, isLoading: fundraisingLoading } = useQuery<FundraisingRound[]>({ queryKey: ["/api/crypto/projects", projectId, "fundraising"], enabled: !!projectId });

  const projectedSupply2035 = (() => {
    if (!project) return 0;
    return project.maxSupply || project.totalSupply || 0;
  })();

  const createScheduleMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await apiRequest("POST", "/api/crypto/supply-schedules", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] }); setSupplyFormOpen(false); setSupplyForm({ ...emptySupplyForm }); toast({ title: "Supply schedule entry added" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crypto/supply-schedules/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] }); toast({ title: "Entry deleted" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const createIncentiveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await apiRequest("POST", "/api/crypto/incentives", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] }); setIncentiveFormOpen(false); setEditingIncentiveId(null); setIncentiveForm({ ...emptyIncentiveForm }); toast({ title: editingIncentiveId ? "Incentive updated" : "Incentive added" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const updateIncentiveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => { const res = await apiRequest("PATCH", `/api/crypto/incentives/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] }); setIncentiveFormOpen(false); setEditingIncentiveId(null); setIncentiveForm({ ...emptyIncentiveForm }); toast({ title: "Incentive updated" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const deleteIncentiveMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crypto/incentives/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] }); toast({ title: "Incentive deleted" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const loadTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!project?.coingeckoId) throw new Error("No CoinGecko ID");
      const res = await fetch(`/api/crypto/incentive-templates/${project.coingeckoId}`);
      if (!res.ok) throw new Error("Failed to load template");
      return res.json();
    },
    onSuccess: async (templateItems: Array<Record<string, unknown>>) => {
      if (!templateItems.length) { toast({ title: "No template found", variant: "destructive" }); return; }
      for (const item of templateItems) {
        await apiRequest("POST", "/api/crypto/incentives", { projectId, role: item.role || "", contribution: item.contribution || "", rewardType: item.rewardType || "", rewardSource: item.rewardSource || "", allocationPercent: item.allocationPercent || 0, estimatedApy: item.estimatedApy || null, vestingMonths: item.vestingMonths || null, isSustainable: item.isSustainable ?? true, sustainabilityNotes: item.sustainabilityNotes || null, sortOrder: item.sortOrder || 0 });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "incentives"] });
      toast({ title: "Template loaded", description: `${templateItems.length} entries added.` });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const seedAllocationsMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/allocations/seed`); return res.json(); },
    onSuccess: (data: { source: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "allocations"] });
      if (data.source === "curated") toast({ title: "Verified allocation data loaded", description: "Data sourced from project documentation and on-chain records" });
      else if (data.source.startsWith("ai-researched")) toast({ title: "AI-researched allocation data loaded", description: "Data researched from public sources. Review for accuracy." });
      else toast({ title: "Template allocations seeded", description: "Industry-average estimates. Edit to match actual data." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const clearAndReseedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crypto/projects/${projectId}/allocations/clear`);
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/allocations/seed`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "allocations"] });
      if (data.source?.startsWith("curated")) toast({ title: "Verified allocation data re-seeded" });
      else if (data.source?.startsWith("ai-researched")) toast({ title: "AI-researched allocation data re-seeded", description: "Data researched from public sources. Review for accuracy." });
      else toast({ title: "Template allocations re-seeded", description: "Industry-average estimates. Edit to match actual data." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const createAllocationMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/allocations`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "allocations"] }); setAllocationFormOpen(false); setEditingAllocationId(null); setAllocationForm({ ...emptyAllocationForm }); toast({ title: "Allocation added" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const updateAllocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => { const res = await apiRequest("PATCH", `/api/crypto/allocations/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "allocations"] }); setAllocationFormOpen(false); setEditingAllocationId(null); setAllocationForm({ ...emptyAllocationForm }); toast({ title: "Allocation updated" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const deleteAllocationMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crypto/allocations/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "allocations"] }); toast({ title: "Allocation deleted" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const createFundraisingMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/fundraising`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "fundraising"] }); setFundraisingFormOpen(false); setEditingFundraisingId(null); setFundraisingForm({ ...emptyFundraisingForm }); toast({ title: "Round added" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const updateFundraisingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => { const res = await apiRequest("PATCH", `/api/crypto/fundraising/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "fundraising"] }); setFundraisingFormOpen(false); setEditingFundraisingId(null); setFundraisingForm({ ...emptyFundraisingForm }); toast({ title: "Round updated" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });
  const deleteFundraisingMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crypto/fundraising/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "fundraising"] }); toast({ title: "Round deleted" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const seedFundraisingMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/fundraising/seed`); return res.json(); },
    onSuccess: (data: { source: string; notes?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "fundraising"] });
      if (data.source === "none") toast({ title: "No fundraising data found", description: data.notes || "This token may not have traditional fundraising rounds." });
      else toast({ title: "AI-researched fundraising data loaded", description: "Data researched from public sources. Review for accuracy." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const clearAndReseedFundraisingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crypto/projects/${projectId}/fundraising/clear`);
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/fundraising/seed`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "fundraising"] });
      if (data.source === "none") toast({ title: "No fundraising data found", description: data.notes || "This token may not have traditional fundraising rounds." });
      else toast({ title: "Fundraising data re-seeded", description: "AI-researched data refreshed from public sources." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const seedSupplyScheduleMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/supply-schedule/seed`); return res.json(); },
    onSuccess: (data: { source: string; notes?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] });
      if (data.source === "none") toast({ title: "No supply schedule data found", description: data.notes || "Could not find vesting/unlock schedule for this token." });
      else toast({ title: "AI-researched supply schedule loaded", description: "Vesting and unlock data researched from public sources. Review for accuracy." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const clearAndReseedSupplyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crypto/projects/${projectId}/supply-schedule/clear`);
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/supply-schedule/seed`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId, "supply-schedules"] });
      if (data.source === "none") toast({ title: "No supply schedule data found", description: data.notes || "Could not find vesting/unlock schedule for this token." });
      else toast({ title: "Supply schedule re-seeded", description: "AI-researched vesting/unlock data refreshed." });
    },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  const updateGovernanceMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await apiRequest("PATCH", `/api/crypto/projects/${projectId}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] }); setGovernanceEditing(false); toast({ title: "Governance info updated" }); },
    onError: () => { toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }); },
  });

  function handleSaveSupply() {
    if (!supplyForm.label.trim()) { toast({ title: "Label is required", variant: "destructive" }); return; }
    createScheduleMutation.mutate({ projectId, eventType: "allocation", label: supplyForm.label.trim(), amount: Number(supplyForm.amount) || 0, date: supplyForm.unlockDate || null, recurringIntervalMonths: Number(supplyForm.vestingMonths) || null, notes: supplyForm.percentOfTotal ? `${supplyForm.percentOfTotal}% of total` : null, sortOrder: (schedules?.length || 0) });
  }

  function handleSaveIncentive() {
    if (!incentiveForm.role.trim() || !incentiveForm.contribution.trim()) { toast({ title: "Role and Contribution are required", variant: "destructive" }); return; }
    const payload = { projectId, role: incentiveForm.role.trim(), contribution: incentiveForm.contribution.trim(), rewardType: incentiveForm.rewardType.trim(), rewardSource: incentiveForm.rewardSource.trim(), allocationPercent: Number(incentiveForm.allocationPercent) || 0, estimatedApy: Number(incentiveForm.estimatedApy) || null, vestingMonths: Number(incentiveForm.vestingMonths) || null, isSustainable: incentiveForm.isSustainable, sustainabilityNotes: incentiveForm.sustainabilityNotes.trim() || null, sortOrder: (incentives?.length || 0) };
    if (editingIncentiveId) { updateIncentiveMutation.mutate({ id: editingIncentiveId, data: payload }); } else { createIncentiveMutation.mutate(payload); }
  }

  function handleSaveAllocation() {
    if (!allocationForm.category.trim()) { toast({ title: "Category is required", variant: "destructive" }); return; }
    const pct = Number(allocationForm.percentage) || 0;
    const computedAmount = allocationForm.amount > 0 ? allocationForm.amount : (projectedSupply2035 > 0 ? projectedSupply2035 * (pct / 100) : 0);
    const group = allocationForm.standardGroup || STANDARD_GROUPS.find(g => g.categories.includes(allocationForm.category.trim()))?.value || null;
    const payload = { projectId, category: allocationForm.category.trim(), standardGroup: group, percentage: pct, amount: computedAmount, vestingMonths: Number(allocationForm.vestingMonths) || null, cliffMonths: Number(allocationForm.cliffMonths) || null, tgePercent: Number(allocationForm.tgePercent) || null, vestingType: allocationForm.vestingType || null, dataSource: allocationForm.dataSource.trim() || null, releasedPercent: Number(allocationForm.releasedPercent) || null, assumption: allocationForm.assumption.trim() || null, references: allocationForm.references.trim() || null, description: allocationForm.description.trim() || null, notes: allocationForm.notes.trim() || null, sortOrder: (allocations?.length || 0) };
    if (editingAllocationId) { updateAllocationMutation.mutate({ id: editingAllocationId, data: payload }); } else { createAllocationMutation.mutate(payload); }
  }

  function handleSaveFundraising() {
    if (!fundraisingForm.roundType.trim()) { toast({ title: "Round type is required", variant: "destructive" }); return; }
    const payload = { projectId, roundType: fundraisingForm.roundType.trim(), amount: Number(fundraisingForm.amount) || null, valuation: Number(fundraisingForm.valuation) || null, date: fundraisingForm.date || null, leadInvestors: fundraisingForm.leadInvestors.trim() || null, tokenPrice: Number(fundraisingForm.tokenPrice) || null, notes: fundraisingForm.notes.trim() || null, sortOrder: (fundraisingRounds?.length || 0) };
    if (editingFundraisingId) { updateFundraisingMutation.mutate({ id: editingFundraisingId, data: payload }); } else { createFundraisingMutation.mutate(payload); }
  }

  function openEditIncentive(inc: TokenIncentive) {
    setEditingIncentiveId(inc.id);
    setIncentiveForm({ role: inc.role || "", contribution: inc.contribution || "", rewardType: inc.rewardType || "", rewardSource: inc.rewardSource || "", allocationPercent: inc.allocationPercent || 0, estimatedApy: inc.estimatedApy || 0, vestingMonths: inc.vestingMonths || 0, isSustainable: inc.isSustainable ?? true, sustainabilityNotes: inc.sustainabilityNotes || "" });
    setIncentiveFormOpen(true);
  }

  function openEditAllocation(alloc: TokenAllocation) {
    setEditingAllocationId(alloc.id);
    const autoGroup = alloc.standardGroup || STANDARD_GROUPS.find(g => g.categories.includes(alloc.category))?.value || "";
    setAllocationForm({ category: alloc.category, standardGroup: autoGroup, percentage: alloc.percentage || 0, amount: alloc.amount || 0, vestingMonths: alloc.vestingMonths || 0, cliffMonths: alloc.cliffMonths || 0, tgePercent: alloc.tgePercent || 0, vestingType: alloc.vestingType || "linear", dataSource: alloc.dataSource || "", releasedPercent: alloc.releasedPercent || 0, assumption: alloc.assumption || "", references: alloc.references || "", description: alloc.description || "", notes: alloc.notes || "" });
    setAllocationFormOpen(true);
  }

  function openEditFundraising(round: FundraisingRound) {
    setEditingFundraisingId(round.id);
    setFundraisingForm({ roundType: round.roundType, amount: round.amount || 0, valuation: round.valuation || 0, date: round.date || "", leadInvestors: round.leadInvestors || "", tokenPrice: round.tokenPrice || 0, notes: round.notes || "" });
    setFundraisingFormOpen(true);
  }

  function openEditGovernance() {
    setGovForm({ governanceType: project?.governanceType || "", votingMechanism: project?.votingMechanism || "", treasurySize: project?.treasurySize || 0, treasuryCurrency: project?.treasuryCurrency || "USD", governanceNotes: project?.governanceNotes || "" });
    setGovernanceEditing(true);
  }

  function handleSaveGovernance() {
    updateGovernanceMutation.mutate({ governanceType: govForm.governanceType || null, votingMechanism: govForm.votingMechanism || null, treasurySize: Number(govForm.treasurySize) || null, treasuryCurrency: govForm.treasuryCurrency || null, governanceNotes: govForm.governanceNotes || null });
  }

  const saveWhitepaperMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("PATCH", `/api/crypto/projects/${projectId}`, { whitepaper: text || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] });
      setWhitepaperMode("view");
      toast({ title: "Whitepaper saved" });
    },
    onError: () => { toast({ title: "Could not save whitepaper", description: "Please try again.", variant: "destructive" }); },
  });

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Only PDF files are supported", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large (max 10MB)", variant: "destructive" });
      return;
    }
    setUploadingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const res = await apiRequest("POST", `/api/crypto/projects/${projectId}/parse-pdf`, { pdfBase64: base64 });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to parse PDF");
      }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/projects", projectId] });
      toast({ title: "Whitepaper uploaded", description: `Extracted ${(data.length || 0).toLocaleString()} characters` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: "Please try again with a different file.", variant: "destructive" });
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  const circulatingRatio = project?.circulatingSupply && project?.totalSupply ? (project.circulatingSupply / project.totalSupply) * 100 : 0;
  const fdvMcapRatio = project?.fullyDilutedValuation && project?.marketCap && project.marketCap > 0 ? project.fullyDilutedValuation / project.marketCap : 0;
  const inflationEstimate = project?.maxSupply && project?.circulatingSupply && project.circulatingSupply > 0 ? ((project.maxSupply - project.circulatingSupply) / project.circulatingSupply) * 100 : null;

  const supplyPieData = (schedules || []).filter(s => s.amount > 0).map(s => ({ name: s.label, value: s.amount }));
  const totalSupplyAllocation = supplyPieData.reduce((sum, d) => sum + d.value, 0);

  const totalAllocPct = (allocations || []).reduce((s, a) => s + (a.percentage || 0), 0);
  const untrackedPct = Math.max(0, 100 - totalAllocPct);
  const allocationPieData = (allocations || []).filter(a => a.percentage > 0).map(a => ({ name: a.category, value: a.percentage }));
  if (untrackedPct > 0.5 && allocationPieData.length > 0) {
    allocationPieData.push({ name: "Untracked", value: untrackedPct });
  }

  const groupedAllocPct: Record<string, number> = {};
  (allocations || []).forEach(a => {
    const g = a.standardGroup || STANDARD_GROUPS.find(sg => sg.categories.includes(a.category))?.value || "community";
    groupedAllocPct[g] = (groupedAllocPct[g] || 0) + (a.percentage || 0);
  });

  const vestingTimelineData = (allocations || []).filter(a => a.percentage > 0 && (a.vestingMonths || a.cliffMonths || a.tgePercent)).map(a => ({
    category: a.category,
    tgePercent: a.tgePercent || 0,
    cliffMonths: a.cliffMonths || 0,
    vestingMonths: a.vestingMonths || 0,
    vestingType: a.vestingType || "linear",
    percentage: a.percentage,
  }));

  const totalRaised = (fundraisingRounds || []).reduce((s, r) => s + (r.amount || 0), 0);

  const supplyTimelineData = (() => {
    if (!schedules || schedules.length === 0) return [];
    const sorted = [...schedules].filter(s => s.date).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let cumulative = 0;
    return sorted.map(s => { cumulative += s.amount; return { date: s.date, amount: s.amount, cumulative, label: s.label }; });
  })();

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
        <Link href="/crypto"><Button variant="outline" className="mt-2" data-testid="link-back-crypto"><ArrowLeft className="h-4 w-4 mr-1" />Back to Crypto</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" data-testid="page-crypto-tokenomics">
      <CryptoProjectNav projectId={projectId} projectName={project.name} projectImage={project.image} projectSymbol={project.symbol} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="card-price">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Price</CardTitle><Coins className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-lg font-bold" data-testid="text-price">{formatPrice(project.currentPrice)}</div></CardContent>
        </Card>
        <Card data-testid="card-market-cap">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Market Cap</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold" data-testid="text-market-cap">{formatCompact(project.marketCap)}</div></CardContent>
        </Card>
        <Card data-testid="card-circulating-supply">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Circulating Supply</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold" data-testid="text-circulating-supply">{formatSupply(project.circulatingSupply)}</div></CardContent>
        </Card>
        <Card data-testid="card-total-supply">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Total Supply</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold" data-testid="text-total-supply">{formatSupply(project.totalSupply)}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-circulating-ratio">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Circulating / Total Ratio</CardTitle><Lock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-bold" data-testid="text-circulating-ratio">{circulatingRatio.toFixed(1)}%</div>
            <Progress value={circulatingRatio} className="h-2" data-testid="progress-circulating-ratio" />
          </CardContent>
        </Card>
        <Card data-testid="card-inflation">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">Inflation Estimate</CardTitle><AlertTriangle className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-inflation">{inflationEstimate != null ? `${inflationEstimate.toFixed(1)}%` : "N/A"}</div>
            <p className="text-xs text-muted-foreground">{project.maxSupply ? `Max Supply: ${formatSupply(project.maxSupply)}` : "No max supply defined"}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-fdv-mcap">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"><CardTitle className="text-xs font-medium">FDV / Market Cap</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-fdv-mcap">{fdvMcapRatio > 0 ? `${fdvMcapRatio.toFixed(2)}x` : "--"}</div>
            <p className="text-xs text-muted-foreground">FDV: {formatCompact(project.fullyDilutedValuation)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Governance / DAO Section */}
      <Card data-testid="card-governance">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5"><Landmark className="h-4 w-4 text-muted-foreground" />Governance & DAO</CardTitle>
          <Button variant="outline" size="sm" onClick={openEditGovernance} data-testid="button-edit-governance"><Edit2 className="h-3 w-3 mr-1" />Edit</Button>
        </CardHeader>
        <CardContent>
          {project?.governanceType || project?.votingMechanism || project?.treasurySize ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Governance Type</span>
                <p className="font-medium" data-testid="text-governance-type">{project.governanceType || "--"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Voting Mechanism</span>
                <p className="font-medium" data-testid="text-voting-mechanism">{project.votingMechanism || "--"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Treasury Size</span>
                <p className="font-medium" data-testid="text-treasury-size">{project.treasurySize ? formatCompact(project.treasurySize) : "--"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Treasury Currency</span>
                <p className="font-medium" data-testid="text-treasury-currency">{project.treasuryCurrency || "--"}</p>
              </div>
              {project.governanceNotes && (
                <div className="col-span-full">
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <p className="text-sm text-muted-foreground italic" data-testid="text-governance-notes">{project.governanceNotes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-governance">No governance info set. Click Edit to add DAO type, voting mechanism, and treasury details.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="allocations" data-testid="tabs-tokenomics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="allocations" data-testid="tab-allocations">Allocations</TabsTrigger>
          <TabsTrigger value="supply" data-testid="tab-supply">Supply Schedule</TabsTrigger>
          <TabsTrigger value="fundraising" data-testid="tab-fundraising">Fundraising</TabsTrigger>
          <TabsTrigger value="incentives" data-testid="tab-incentives">Incentives</TabsTrigger>
          <TabsTrigger value="whitepaper" data-testid="tab-whitepaper">Whitepaper</TabsTrigger>
        </TabsList>

        {/* =================== ALLOCATIONS TAB =================== */}
        <TabsContent value="allocations" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-allocations-title">Token Allocation & Vesting</h2>
              {projectedSupply2035 > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-projected-supply">
                  <Info className="h-3 w-3" />
                  Total Supply: {formatSupply(projectedSupply2035)} · Tracked: {totalAllocPct.toFixed(1)}%{untrackedPct > 0.5 ? ` · Untracked: ${untrackedPct.toFixed(1)}%` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(!allocations || allocations.length === 0) ? (
                <Button variant="outline" onClick={() => seedAllocationsMutation.mutate()} disabled={seedAllocationsMutation.isPending} data-testid="button-seed-allocations">
                  {seedAllocationsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1 text-yellow-400" /><Download className="h-4 w-4 mr-1" /></>}
                  {seedAllocationsMutation.isPending ? "Researching..." : "Seed Allocations"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => clearAndReseedMutation.mutate()} disabled={clearAndReseedMutation.isPending} data-testid="button-clear-allocations">
                  {clearAndReseedMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  {clearAndReseedMutation.isPending ? "Re-seeding..." : "Clear & Re-seed"}
                </Button>
              )}
              <Button onClick={() => { setEditingAllocationId(null); setAllocationForm({ ...emptyAllocationForm }); setAllocationFormOpen(true); }} data-testid="button-add-allocation">
                <Plus className="h-4 w-4 mr-1" />Add Allocation
              </Button>
            </div>
          </div>

          {allocations && allocations.length > 0 && allocations.some((a: any) => a.dataSource?.includes("AI-Researched") || a.assumption?.includes("AI-Researched")) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/5 text-xs" data-testid="banner-ai-disclaimer">
              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
              <span className="font-medium text-yellow-500">AI-Researched</span>
              <span className="text-muted-foreground">— Generated from public sources. Review and edit as needed.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table data-testid="table-allocations">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Category</TableHead>
                          <TableHead className="text-right font-semibold">%</TableHead>
                          <TableHead className="text-right font-semibold">Tokens</TableHead>
                          <TableHead className="text-right font-semibold">Released</TableHead>
                          <TableHead className="font-semibold">Vesting</TableHead>
                          <TableHead className="font-semibold">Source</TableHead>
                          <TableHead className="text-center font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocationsLoading && (
                          <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                        )}
                        {!allocationsLoading && (!allocations || allocations.length === 0) && (
                          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="text-no-allocations"><div className="space-y-1"><p>No allocations defined yet.</p><p className="text-xs">Click <span className="font-medium text-yellow-400">Seed Allocations</span> to auto-populate from AI research, or manually add allocations.</p></div></TableCell></TableRow>
                        )}
                        {(allocations || []).map((a) => {
                          const computedTokens = a.amount || (projectedSupply2035 > 0 ? projectedSupply2035 * ((a.percentage || 0) / 100) : 0);
                          const vestingLabel = a.vestingType === "immediate" ? "Immediate" : a.vestingMonths ? `${a.cliffMonths ? a.cliffMonths + "mo cliff + " : ""}${a.vestingMonths}mo ${a.vestingType || "linear"}` : (a.description ? a.description.substring(0, 60) : "--");
                          const releasedLabel = a.releasedPercent != null ? `${a.releasedPercent.toFixed(1)}%` : "--";
                          return (
                            <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                              <TableCell data-testid={`text-alloc-category-${a.id}`}>
                                <div className="font-medium">{a.category}</div>
                                {a.description && <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">{a.description}</div>}
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-alloc-pct-${a.id}`}>{(a.percentage || 0).toFixed(2)}%</TableCell>
                              <TableCell className="text-right" data-testid={`text-alloc-tokens-${a.id}`}>{formatSupply(computedTokens)}</TableCell>
                              <TableCell className="text-right text-xs" data-testid={`text-alloc-released-${a.id}`}>{releasedLabel}</TableCell>
                              <TableCell className="text-xs max-w-[160px] truncate">{vestingLabel}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {a.references ? (
                                  <div className="truncate max-w-[140px]">
                                    {a.references.split(", ").map((ref, i) => {
                                      try {
                                        const domain = new URL(ref).hostname.replace("www.", "");
                                        return <span key={i}>{i > 0 && ", "}<a href={ref} target="_blank" rel="noopener noreferrer" className="underline text-blue-500 hover:text-blue-400">{domain}</a></span>;
                                      } catch { return <span key={i}>{i > 0 && ", "}{ref}</span>; }
                                    })}
                                  </div>
                                ) : a.dataSource || "--"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <Button size="icon" variant="ghost" aria-label="Edit allocation" onClick={() => openEditAllocation(a)} data-testid={`button-edit-alloc-${a.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" aria-label="Delete allocation" onClick={() => deleteAllocationMutation.mutate(a.id)} disabled={deleteAllocationMutation.isPending} data-testid={`button-delete-alloc-${a.id}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(allocations || []).length > 0 && (
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">Total Tracked</TableCell>
                            <TableCell className="text-right font-bold" data-testid="text-alloc-total-pct">{totalAllocPct.toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-bold">{formatSupply(projectedSupply2035 * (totalAllocPct / 100))}</TableCell>
                            <TableCell colSpan={4} />
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {(allocations || []).length > 0 && (
                <Card data-testid="card-benchmark-comparison">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">vs. Industry Benchmarks (2023 Avg)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {STANDARD_GROUPS.map(sg => {
                      const projectPct = groupedAllocPct[sg.value] || 0;
                      const benchPct = INDUSTRY_BENCHMARKS[sg.value as keyof typeof INDUSTRY_BENCHMARKS] || 0;
                      const diff = projectPct - benchPct;
                      return (
                        <div key={sg.value} className="space-y-1" data-testid={`benchmark-${sg.value}`}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium">{sg.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Avg: {benchPct}%</span>
                              <span className={`font-medium ${Math.abs(diff) < 3 ? "text-muted-foreground" : diff > 0 ? "text-amber-500" : "text-blue-500"}`}>
                                {projectPct.toFixed(1)}% ({diff > 0 ? "+" : ""}{diff.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 items-center">
                            <div className="flex-1 h-2 rounded-md bg-muted overflow-hidden relative">
                              <div className="absolute h-full rounded-md bg-muted-foreground/30" style={{ width: `${Math.min(benchPct, 100)}%` }} />
                              <div className="absolute h-full rounded-md" style={{ width: `${Math.min(projectPct, 100)}%`, backgroundColor: COLORS[STANDARD_GROUPS.indexOf(sg) % COLORS.length] }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-muted-foreground pt-1">Source: TokenUnlocks Standard Allocation Framework (72 limited-supply tokens, 2023)</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {allocationPieData.length > 0 && (
                <Card data-testid="card-allocation-pie">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Allocation Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allocationPieData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" nameKey="name" paddingAngle={1} stroke="none">
                            {allocationPieData.map((_, i) => (
                              <Cell key={i} fill={i === allocationPieData.length - 1 && allocationPieData[i].name === "Untracked" ? "hsl(var(--muted))" : COLORS[i % COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {allocationPieData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.name === "Untracked" ? "hsl(var(--muted))" : COLORS[i % COLORS.length] }} />
                            <span className="truncate">{d.name}</span>
                          </div>
                          <span className="text-muted-foreground">{d.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {vestingTimelineData.length > 0 && (
                <Card data-testid="card-vesting-timeline">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vesting Timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-2.5">
                    {vestingTimelineData.map((v, i) => {
                      const maxMonths = Math.max(...vestingTimelineData.map(d => (d.cliffMonths || 0) + (d.vestingMonths || 0)), 1);
                      const totalDuration = (v.cliffMonths || 0) + (v.vestingMonths || 0);
                      const cliffWidth = maxMonths > 0 ? ((v.cliffMonths || 0) / maxMonths) * 100 : 0;
                      const vestWidth = maxMonths > 0 ? ((v.vestingMonths || 0) / maxMonths) * 100 : 0;
                      return (
                        <div key={i} className="space-y-0.5" data-testid={`vesting-bar-${i}`}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium truncate">{v.category}</span>
                            <span className="text-muted-foreground shrink-0">
                              {v.vestingType === "immediate" ? "Immediate" : `${totalDuration}mo`}
                              {v.tgePercent > 0 ? ` · ${v.tgePercent}% TGE` : ""}
                            </span>
                          </div>
                          <div className="flex h-3 rounded-md overflow-hidden bg-muted">
                            {v.tgePercent > 0 && (
                              <div className="h-full" style={{ width: `${Math.max((v.tgePercent / 100) * (vestWidth + cliffWidth), 2)}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 1 }} title={`TGE: ${v.tgePercent}%`} />
                            )}
                            {v.cliffMonths > 0 && (
                              <div className="h-full bg-muted-foreground/20" style={{ width: `${cliffWidth}%` }} title={`Cliff: ${v.cliffMonths}mo`} />
                            )}
                            {v.vestingMonths > 0 && (
                              <div className="h-full" style={{ width: `${vestWidth}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.6 }} title={`Vesting: ${v.vestingMonths}mo ${v.vestingType}`} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm" style={{ backgroundColor: COLORS[0] }} />TGE</div>
                      <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-muted-foreground/20" />Cliff</div>
                      <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm" style={{ backgroundColor: COLORS[0], opacity: 0.6 }} />Linear Vest</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* =================== SUPPLY SCHEDULE TAB =================== */}
        <TabsContent value="supply" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="text-supply-title">Supply Schedule</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {(!schedules || schedules.length === 0) ? (
                <Button variant="outline" onClick={() => seedSupplyScheduleMutation.mutate()} disabled={seedSupplyScheduleMutation.isPending} data-testid="button-seed-supply">
                  {seedSupplyScheduleMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1 text-yellow-400" /><Download className="h-4 w-4 mr-1" /></>}
                  {seedSupplyScheduleMutation.isPending ? "Researching..." : "Seed Schedule"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => clearAndReseedSupplyMutation.mutate()} disabled={clearAndReseedSupplyMutation.isPending} data-testid="button-clear-supply">
                  {clearAndReseedSupplyMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  {clearAndReseedSupplyMutation.isPending ? "Re-seeding..." : "Clear & Re-seed"}
                </Button>
              )}
              <Button onClick={() => { setSupplyForm({ ...emptySupplyForm }); setSupplyFormOpen(true); }} data-testid="button-add-supply"><Plus className="h-4 w-4 mr-1" />Add Entry</Button>
            </div>
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
                    {schedulesLoading && (<TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>)}
                    {!schedulesLoading && (!schedules || schedules.length === 0) && (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="text-no-schedules"><div className="space-y-1"><p>No supply schedule entries yet.</p><p className="text-xs">Click <span className="font-medium text-yellow-400">Seed Schedule</span> to auto-populate from AI research, or manually add entries.</p></div></TableCell></TableRow>)}
                    {(schedules || []).map((s) => {
                      const pct = totalSupplyAllocation > 0 ? ((s.amount / totalSupplyAllocation) * 100) : 0;
                      return (
                        <TableRow key={s.id} data-testid={`row-supply-${s.id}`}>
                          <TableCell className="font-medium" data-testid={`text-supply-label-${s.id}`}>{s.label}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-amount-${s.id}`}>{formatSupply(s.amount)}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-pct-${s.id}`}>{pct.toFixed(1)}%</TableCell>
                          <TableCell data-testid={`text-supply-date-${s.id}`}>{s.date || "--"}</TableCell>
                          <TableCell className="text-right" data-testid={`text-supply-vesting-${s.id}`}>{s.recurringIntervalMonths || "--"}</TableCell>
                          <TableCell className="text-center"><Button size="icon" variant="ghost" aria-label="Delete supply entry" onClick={() => deleteScheduleMutation.mutate(s.id)} disabled={deleteScheduleMutation.isPending} data-testid={`button-delete-supply-${s.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {supplyPieData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-supply-pie">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Supply Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={supplyPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${(name as string).length > 12 ? (name as string).slice(0, 12) + "…" : name} ${(percent * 100).toFixed(0)}%`}>
                          {supplyPieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatSupply(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {supplyTimelineData.length > 1 && (
                <Card data-testid="card-supply-timeline-chart">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cumulative Unlock Timeline</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={supplyTimelineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tickFormatter={(v: number) => formatSupply(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip formatter={(value: number) => formatSupply(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", color: "hsl(var(--card-foreground))" }} itemStyle={{ color: "hsl(var(--card-foreground))" }} labelStyle={{ color: "hsl(var(--card-foreground))" }} />
                          <Area type="stepAfter" dataKey="cumulative" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} name="Cumulative Supply" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {supplyTimelineData.length <= 1 && (
                <Card data-testid="card-timeline">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Allocation Timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {supplyPieData.map((d, i) => {
                      const pct = totalSupplyAllocation > 0 ? (d.value / totalSupplyAllocation) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1" data-testid={`timeline-segment-${i}`}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium truncate">{d.name}</span>
                            <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-3 rounded-md overflow-hidden bg-muted"><div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} /></div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* =================== FUNDRAISING TAB =================== */}
        <TabsContent value="fundraising" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-fundraising-title">Fundraising Rounds</h2>
              {totalRaised > 0 && <p className="text-xs text-muted-foreground">Total Raised: {formatCompact(totalRaised)}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(!fundraisingRounds || fundraisingRounds.length === 0) ? (
                <Button variant="outline" onClick={() => seedFundraisingMutation.mutate()} disabled={seedFundraisingMutation.isPending} data-testid="button-seed-fundraising">
                  {seedFundraisingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1 text-yellow-400" /><Download className="h-4 w-4 mr-1" /></>}
                  {seedFundraisingMutation.isPending ? "Researching..." : "Seed Rounds"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => clearAndReseedFundraisingMutation.mutate()} disabled={clearAndReseedFundraisingMutation.isPending} data-testid="button-clear-fundraising">
                  {clearAndReseedFundraisingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  {clearAndReseedFundraisingMutation.isPending ? "Re-seeding..." : "Clear & Re-seed"}
                </Button>
              )}
              <Button onClick={() => { setEditingFundraisingId(null); setFundraisingForm({ ...emptyFundraisingForm }); setFundraisingFormOpen(true); }} data-testid="button-add-fundraising">
                <Plus className="h-4 w-4 mr-1" />Add Round
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table data-testid="table-fundraising">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Round</TableHead>
                      <TableHead className="text-right font-semibold">Amount Raised</TableHead>
                      <TableHead className="text-right font-semibold">Valuation</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="text-right font-semibold">Token Price</TableHead>
                      <TableHead className="font-semibold">Lead Investors</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fundraisingLoading && (<TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>)}
                    {!fundraisingLoading && (!fundraisingRounds || fundraisingRounds.length === 0) && (<TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="text-no-fundraising"><div className="space-y-1"><p>No fundraising rounds recorded yet.</p><p className="text-xs">Click <span className="font-medium text-yellow-400">Seed Rounds</span> to auto-populate from AI research, or manually add rounds.</p></div></TableCell></TableRow>)}
                    {(fundraisingRounds || []).map((r) => (
                      <TableRow key={r.id} data-testid={`row-fundraising-${r.id}`}>
                        <TableCell className="font-medium">
                          <Badge variant="outline" data-testid={`badge-round-type-${r.id}`}>{r.roundType}</Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-round-amount-${r.id}`}>{r.amount ? formatCompact(r.amount) : "--"}</TableCell>
                        <TableCell className="text-right" data-testid={`text-round-valuation-${r.id}`}>{r.valuation ? formatCompact(r.valuation) : "--"}</TableCell>
                        <TableCell data-testid={`text-round-date-${r.id}`}>{r.date || "--"}</TableCell>
                        <TableCell className="text-right" data-testid={`text-round-token-price-${r.id}`}>{r.tokenPrice ? formatPrice(r.tokenPrice) : "--"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" data-testid={`text-round-investors-${r.id}`}>{r.leadInvestors || "--"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button size="icon" variant="ghost" aria-label="Edit round" onClick={() => openEditFundraising(r)} data-testid={`button-edit-round-${r.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Delete round" onClick={() => deleteFundraisingMutation.mutate(r.id)} disabled={deleteFundraisingMutation.isPending} data-testid={`button-delete-round-${r.id}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(fundraisingRounds || []).length > 0 && (
                      <TableRow className="border-t-2">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold" data-testid="text-total-raised">{formatCompact(totalRaised)}</TableCell>
                        <TableCell colSpan={5} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== INCENTIVES TAB =================== */}
        <TabsContent value="incentives" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="text-incentives-title">Incentive Mapping</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => loadTemplateMutation.mutate()} disabled={loadTemplateMutation.isPending} data-testid="button-load-template">
                {loadTemplateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Load Template
              </Button>
              <Button onClick={() => { setEditingIncentiveId(null); setIncentiveForm({ ...emptyIncentiveForm }); setIncentiveFormOpen(true); }} data-testid="button-add-incentive"><Plus className="h-4 w-4 mr-1" />Add Incentive</Button>
            </div>
          </div>

          {incentivesLoading && (<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>)}
          {!incentivesLoading && (!incentives || incentives.length === 0) && (<Card><CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-incentives"><div className="space-y-1"><p>No incentives defined yet.</p><p className="text-xs">Click <span className="font-medium">Load Template</span> to auto-populate from industry templates, or manually add incentive mappings.</p></div></CardContent></Card>)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(incentives || []).map((inc) => (
              <Card key={inc.id} data-testid={`card-incentive-${inc.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /><span data-testid={`text-incentive-role-${inc.id}`}>{inc.role}</span></CardTitle>
                    <div className="flex items-center gap-1">
                      {inc.isSustainable ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30" data-testid={`badge-sustainable-${inc.id}`}><Shield className="h-3 w-3 mr-0.5" />Sustainable</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-500/30" data-testid={`badge-unsustainable-${inc.id}`}><AlertTriangle className="h-3 w-3 mr-0.5" />Unsustainable</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-xs text-muted-foreground">Contribution</span><p className="font-medium" data-testid={`text-incentive-contribution-${inc.id}`}>{inc.contribution}</p></div>
                    <div><span className="text-xs text-muted-foreground">Reward Type</span><p className="font-medium" data-testid={`text-incentive-rewardType-${inc.id}`}>{inc.rewardType}</p></div>
                    <div><span className="text-xs text-muted-foreground">Reward Source</span><p className="font-medium" data-testid={`text-incentive-rewardSource-${inc.id}`}>{inc.rewardSource}</p></div>
                    <div><span className="text-xs text-muted-foreground">Allocation %</span><p className="font-medium" data-testid={`text-incentive-allocation-${inc.id}`}>{inc.allocationPercent || 0}%</p></div>
                    <div><span className="text-xs text-muted-foreground">Est. APY</span><p className="font-medium" data-testid={`text-incentive-apy-${inc.id}`}>{inc.estimatedApy != null ? `${inc.estimatedApy}%` : "--"}</p></div>
                    <div><span className="text-xs text-muted-foreground">Vesting (Months)</span><p className="font-medium" data-testid={`text-incentive-vesting-${inc.id}`}>{inc.vestingMonths ?? "--"}</p></div>
                  </div>
                  {inc.sustainabilityNotes && <p className="text-xs text-muted-foreground italic" data-testid={`text-incentive-notes-${inc.id}`}>{inc.sustainabilityNotes}</p>}
                  <div className="flex items-center gap-1 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openEditIncentive(inc)} data-testid={`button-edit-incentive-${inc.id}`}>Edit</Button>
                    <Button variant="ghost" size="icon" aria-label="Delete incentive" onClick={() => deleteIncentiveMutation.mutate(inc.id)} disabled={deleteIncentiveMutation.isPending} data-testid={`button-delete-incentive-${inc.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* =================== WHITEPAPER TAB =================== */}
        <TabsContent value="whitepaper" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-whitepaper-title">Whitepaper</h2>
              <p className="text-xs text-muted-foreground">Upload or paste the project whitepaper to use with Copilot for analysis</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {project?.whitepaper ? (
                <>
                  {whitepaperMode === "view" ? (
                    <Button variant="outline" size="sm" onClick={() => { setWhitepaperText(project.whitepaper || ""); setWhitepaperMode("paste"); }} data-testid="button-edit-whitepaper">
                      <Edit2 className="h-4 w-4 mr-1" />Edit
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setWhitepaperMode("view")} data-testid="button-cancel-whitepaper">Cancel</Button>
                      <Button size="sm" onClick={() => saveWhitepaperMutation.mutate(whitepaperText)} disabled={saveWhitepaperMutation.isPending} data-testid="button-save-whitepaper">
                        {saveWhitepaperMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove whitepaper?")) saveWhitepaperMutation.mutate(""); }} data-testid="button-remove-whitepaper">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {project?.whitepaper && whitepaperMode === "view" ? (
            <Card data-testid="card-whitepaper-content">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Document ({(project.whitepaper.length).toLocaleString()} characters)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap font-mono max-h-96 overflow-y-auto text-muted-foreground leading-relaxed" data-testid="text-whitepaper-preview">
                  {project.whitepaper.slice(0, 5000)}
                  {project.whitepaper.length > 5000 && "\n\n... (truncated for display — full content available to Copilot)"}
                </pre>
              </CardContent>
            </Card>
          ) : project?.whitepaper && whitepaperMode === "paste" ? (
            <Card>
              <CardContent className="pt-4">
                <Textarea
                  value={whitepaperText}
                  onChange={(e) => setWhitepaperText(e.target.value)}
                  className="min-h-[300px] font-mono text-xs resize-y"
                  placeholder="Paste whitepaper text here..."
                  data-testid="textarea-whitepaper-edit"
                />
              </CardContent>
            </Card>
          ) : !project?.whitepaper && whitepaperMode === "view" ? (
            <Card data-testid="card-whitepaper-empty">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">No whitepaper added</h3>
                    <p className="text-sm text-muted-foreground max-w-md">Upload a PDF or paste the whitepaper text. The Copilot will be able to reference it when analyzing this project.</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label>
                      <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} data-testid="input-pdf-upload" />
                      <Button variant="outline" asChild disabled={uploadingPdf}>
                        <span>
                          {uploadingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Upload PDF
                        </span>
                      </Button>
                    </label>
                    <Button variant="outline" onClick={() => { setWhitepaperText(""); setWhitepaperMode("paste"); }} data-testid="button-paste-whitepaper">
                      <FileText className="h-4 w-4 mr-1" />Paste Text
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!project?.whitepaper && whitepaperMode === "paste" && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Textarea
                  value={whitepaperText}
                  onChange={(e) => setWhitepaperText(e.target.value)}
                  className="min-h-[300px] font-mono text-xs resize-y"
                  placeholder="Paste whitepaper text here..."
                  data-testid="textarea-whitepaper-paste"
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWhitepaperMode("view")} data-testid="button-cancel-paste">Cancel</Button>
                  <Button size="sm" onClick={() => saveWhitepaperMutation.mutate(whitepaperText)} disabled={saveWhitepaperMutation.isPending || !whitepaperText.trim()} data-testid="button-save-pasted">
                    {saveWhitepaperMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save Whitepaper
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {project?.whitepaper && whitepaperMode === "view" && (
            <div className="flex items-center gap-3 flex-wrap">
              <label>
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} data-testid="input-pdf-replace" />
                <Button variant="outline" size="sm" asChild disabled={uploadingPdf}>
                  <span>
                    {uploadingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Replace with PDF
                  </span>
                </Button>
              </label>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* =================== DIALOGS =================== */}

      {/* Supply Schedule Dialog */}
      <Dialog open={supplyFormOpen} onOpenChange={setSupplyFormOpen}>
        <DialogContent data-testid="dialog-supply-form">
          <DialogHeader><DialogTitle>Add Supply Schedule Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="supply-label">Label</Label><Input id="supply-label" value={supplyForm.label} onChange={(e) => setSupplyForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Team, Investors, Community" data-testid="input-supply-label" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="supply-amount">Amount</Label><Input id="supply-amount" type="number" value={supplyForm.amount || ""} onChange={(e) => setSupplyForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-supply-amount" /></div>
              <div className="space-y-1"><Label htmlFor="supply-pct">% of Total</Label><Input id="supply-pct" type="number" value={supplyForm.percentOfTotal || ""} onChange={(e) => setSupplyForm(f => ({ ...f, percentOfTotal: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-supply-percentOfTotal" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="supply-unlock">Unlock Date</Label><Input id="supply-unlock" value={supplyForm.unlockDate} onChange={(e) => setSupplyForm(f => ({ ...f, unlockDate: e.target.value }))} placeholder="e.g. 2025-Q2" data-testid="input-supply-unlockDate" /></div>
              <div className="space-y-1"><Label htmlFor="supply-vesting">Vesting (Months)</Label><Input id="supply-vesting" type="number" value={supplyForm.vestingMonths || ""} onChange={(e) => setSupplyForm(f => ({ ...f, vestingMonths: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-supply-vestingMonths" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplyFormOpen(false)} data-testid="button-cancel-supply">Cancel</Button>
            <Button onClick={handleSaveSupply} disabled={createScheduleMutation.isPending} data-testid="button-save-supply">{createScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incentive Dialog */}
      <Dialog open={incentiveFormOpen} onOpenChange={(open) => { setIncentiveFormOpen(open); if (!open) setEditingIncentiveId(null); }}>
        <DialogContent data-testid="dialog-incentive-form">
          <DialogHeader><DialogTitle>{editingIncentiveId ? "Edit Incentive" : "Add Incentive"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Role</Label><Input value={incentiveForm.role} onChange={(e) => setIncentiveForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Liquidity Provider" data-testid="input-incentive-role" /></div>
              <div className="space-y-1"><Label>Contribution</Label><Input value={incentiveForm.contribution} onChange={(e) => setIncentiveForm(f => ({ ...f, contribution: e.target.value }))} placeholder="e.g. Provide liquidity" data-testid="input-incentive-contribution" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Reward Type</Label><Input value={incentiveForm.rewardType} onChange={(e) => setIncentiveForm(f => ({ ...f, rewardType: e.target.value }))} placeholder="e.g. Token emission" data-testid="input-incentive-rewardType" /></div>
              <div className="space-y-1"><Label>Reward Source</Label><Input value={incentiveForm.rewardSource} onChange={(e) => setIncentiveForm(f => ({ ...f, rewardSource: e.target.value }))} placeholder="e.g. Protocol treasury" data-testid="input-incentive-rewardSource" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Allocation %</Label><Input type="number" value={incentiveForm.allocationPercent || ""} onChange={(e) => setIncentiveForm(f => ({ ...f, allocationPercent: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-incentive-allocationPercent" /></div>
              <div className="space-y-1"><Label>Est. APY %</Label><Input type="number" value={incentiveForm.estimatedApy || ""} onChange={(e) => setIncentiveForm(f => ({ ...f, estimatedApy: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-incentive-estimatedApy" /></div>
              <div className="space-y-1"><Label>Vesting (Mo)</Label><Input type="number" value={incentiveForm.vestingMonths || ""} onChange={(e) => setIncentiveForm(f => ({ ...f, vestingMonths: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-incentive-vestingMonths" /></div>
            </div>
            <div className="space-y-1"><Label>Sustainability Notes</Label><Input value={incentiveForm.sustainabilityNotes} onChange={(e) => setIncentiveForm(f => ({ ...f, sustainabilityNotes: e.target.value }))} placeholder="Notes on sustainability..." data-testid="input-incentive-sustainabilityNotes" /></div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Sustainable</Label>
              <Button variant={incentiveForm.isSustainable ? "default" : "outline"} size="sm" onClick={() => setIncentiveForm(f => ({ ...f, isSustainable: !f.isSustainable }))} data-testid="button-toggle-sustainable">{incentiveForm.isSustainable ? "Yes" : "No"}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIncentiveFormOpen(false); setEditingIncentiveId(null); }} data-testid="button-cancel-incentive">Cancel</Button>
            <Button onClick={handleSaveIncentive} disabled={createIncentiveMutation.isPending || updateIncentiveMutation.isPending} data-testid="button-save-incentive">{(createIncentiveMutation.isPending || updateIncentiveMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editingIncentiveId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog open={allocationFormOpen} onOpenChange={(open) => { setAllocationFormOpen(open); if (!open) setEditingAllocationId(null); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-allocation-form">
          <DialogHeader><DialogTitle>{editingAllocationId ? "Edit Allocation" : "Add Allocation"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={allocationForm.category} onValueChange={(v) => {
                  const autoGroup = STANDARD_GROUPS.find(g => g.categories.includes(v))?.value || "";
                  setAllocationForm(f => ({ ...f, category: v, standardGroup: autoGroup }));
                }}>
                  <SelectTrigger data-testid="select-alloc-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {ALLOCATION_CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Standard Group</Label>
                <Select value={allocationForm.standardGroup} onValueChange={(v) => setAllocationForm(f => ({ ...f, standardGroup: v }))}>
                  <SelectTrigger data-testid="select-alloc-group"><SelectValue placeholder="Auto-detected" /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_GROUPS.map(g => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Percentage (%)</Label>
                <Input type="number" value={allocationForm.percentage || ""} onChange={(e) => setAllocationForm(f => ({ ...f, percentage: Number(e.target.value) || 0 }))} placeholder="e.g. 15" data-testid="input-alloc-percentage" />
              </div>
              <div className="space-y-1">
                <Label>Token Amount (optional)</Label>
                <Input type="number" value={allocationForm.amount || ""} onChange={(e) => setAllocationForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} placeholder="Auto-calculated if blank" data-testid="input-alloc-amount" />
                {projectedSupply2035 > 0 && allocationForm.percentage > 0 && !allocationForm.amount && (
                  <p className="text-xs text-muted-foreground">{formatSupply(projectedSupply2035 * (allocationForm.percentage / 100))} tokens (auto)</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Vesting Type</Label>
                <Select value={allocationForm.vestingType} onValueChange={(v) => setAllocationForm(f => ({ ...f, vestingType: v }))}>
                  <SelectTrigger data-testid="select-alloc-vesting-type"><SelectValue placeholder="Linear" /></SelectTrigger>
                  <SelectContent>
                    {VESTING_TYPES.map(t => (<SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Vesting (Mo)</Label><Input type="number" value={allocationForm.vestingMonths || ""} onChange={(e) => setAllocationForm(f => ({ ...f, vestingMonths: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-alloc-vesting" /></div>
              <div className="space-y-1"><Label>Cliff (Mo)</Label><Input type="number" value={allocationForm.cliffMonths || ""} onChange={(e) => setAllocationForm(f => ({ ...f, cliffMonths: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-alloc-cliff" /></div>
              <div className="space-y-1"><Label>TGE %</Label><Input type="number" value={allocationForm.tgePercent || ""} onChange={(e) => setAllocationForm(f => ({ ...f, tgePercent: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-alloc-tge" /></div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={allocationForm.description} onChange={(e) => setAllocationForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 48-month linear vesting with 12-month cliff" data-testid="input-alloc-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Released %</Label>
                <Input type="number" value={allocationForm.releasedPercent || ""} onChange={(e) => setAllocationForm(f => ({ ...f, releasedPercent: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-alloc-released-pct" />
              </div>
              <div className="space-y-1">
                <Label>Assumption</Label>
                <Input value={allocationForm.assumption} onChange={(e) => setAllocationForm(f => ({ ...f, assumption: e.target.value }))} placeholder="e.g. Inferred On-chain, Vesting Contract" data-testid="input-alloc-assumption" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data Source</Label>
              <Input value={allocationForm.dataSource} onChange={(e) => setAllocationForm(f => ({ ...f, dataSource: e.target.value }))} placeholder="e.g. Whitepaper, Messari, On-chain" data-testid="input-alloc-datasource" />
            </div>
            <div className="space-y-1">
              <Label>References (URLs)</Label>
              <Input value={allocationForm.references} onChange={(e) => setAllocationForm(f => ({ ...f, references: e.target.value }))} placeholder="e.g. https://etherscan.io/..., https://docs.project.io/..." data-testid="input-alloc-references" />
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={allocationForm.notes} onChange={(e) => setAllocationForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." data-testid="input-alloc-notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAllocationFormOpen(false); setEditingAllocationId(null); }} data-testid="button-cancel-allocation">Cancel</Button>
            <Button onClick={handleSaveAllocation} disabled={createAllocationMutation.isPending || updateAllocationMutation.isPending} data-testid="button-save-allocation">{(createAllocationMutation.isPending || updateAllocationMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editingAllocationId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fundraising Dialog */}
      <Dialog open={fundraisingFormOpen} onOpenChange={(open) => { setFundraisingFormOpen(open); if (!open) setEditingFundraisingId(null); }}>
        <DialogContent data-testid="dialog-fundraising-form">
          <DialogHeader><DialogTitle>{editingFundraisingId ? "Edit Round" : "Add Fundraising Round"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Round Type</Label>
              <Select value={fundraisingForm.roundType} onValueChange={(v) => setFundraisingForm(f => ({ ...f, roundType: v }))}>
                <SelectTrigger data-testid="select-round-type"><SelectValue placeholder="Select round type" /></SelectTrigger>
                <SelectContent>
                  {ROUND_TYPES.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount Raised ($)</Label><Input type="number" value={fundraisingForm.amount || ""} onChange={(e) => setFundraisingForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-round-amount" /></div>
              <div className="space-y-1"><Label>Valuation ($)</Label><Input type="number" value={fundraisingForm.valuation || ""} onChange={(e) => setFundraisingForm(f => ({ ...f, valuation: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-round-valuation" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input value={fundraisingForm.date} onChange={(e) => setFundraisingForm(f => ({ ...f, date: e.target.value }))} placeholder="e.g. 2023-06" data-testid="input-round-date" /></div>
              <div className="space-y-1"><Label>Token Price ($)</Label><Input type="number" value={fundraisingForm.tokenPrice || ""} onChange={(e) => setFundraisingForm(f => ({ ...f, tokenPrice: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-round-token-price" /></div>
            </div>
            <div className="space-y-1"><Label>Lead Investors</Label><Input value={fundraisingForm.leadInvestors} onChange={(e) => setFundraisingForm(f => ({ ...f, leadInvestors: e.target.value }))} placeholder="e.g. a16z, Paradigm" data-testid="input-round-investors" /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={fundraisingForm.notes} onChange={(e) => setFundraisingForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." data-testid="input-round-notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFundraisingFormOpen(false); setEditingFundraisingId(null); }} data-testid="button-cancel-fundraising">Cancel</Button>
            <Button onClick={handleSaveFundraising} disabled={createFundraisingMutation.isPending || updateFundraisingMutation.isPending} data-testid="button-save-fundraising">{(createFundraisingMutation.isPending || updateFundraisingMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editingFundraisingId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Governance Dialog */}
      <Dialog open={governanceEditing} onOpenChange={setGovernanceEditing}>
        <DialogContent data-testid="dialog-governance-form">
          <DialogHeader><DialogTitle>Edit Governance & DAO Info</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Governance Type</Label>
              <Select value={govForm.governanceType} onValueChange={(v) => setGovForm(f => ({ ...f, governanceType: v }))}>
                <SelectTrigger data-testid="select-governance-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {GOVERNANCE_TYPES.map(g => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Voting Mechanism</Label><Input value={govForm.votingMechanism} onChange={(e) => setGovForm(f => ({ ...f, votingMechanism: e.target.value }))} placeholder="e.g. Token-weighted, Quadratic" data-testid="input-governance-voting" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Treasury Size ($)</Label><Input type="number" value={govForm.treasurySize || ""} onChange={(e) => setGovForm(f => ({ ...f, treasurySize: Number(e.target.value) || 0 }))} placeholder="0" data-testid="input-governance-treasury" /></div>
              <div className="space-y-1"><Label>Treasury Currency</Label><Input value={govForm.treasuryCurrency} onChange={(e) => setGovForm(f => ({ ...f, treasuryCurrency: e.target.value }))} placeholder="USD" data-testid="input-governance-currency" /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={govForm.governanceNotes} onChange={(e) => setGovForm(f => ({ ...f, governanceNotes: e.target.value }))} placeholder="Additional governance details..." className="resize-none" data-testid="input-governance-notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGovernanceEditing(false)} data-testid="button-cancel-governance">Cancel</Button>
            <Button onClick={handleSaveGovernance} disabled={updateGovernanceMutation.isPending} data-testid="button-save-governance">{updateGovernanceMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
