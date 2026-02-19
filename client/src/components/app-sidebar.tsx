import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  DollarSign,
  FileSpreadsheet,
  BarChart3,
  Wallet,
  Calculator,
  Scale,
  Briefcase,
  TrendingUp,
  Plus,
  Trash2,
  ChevronDown,
  Building2,
  Check,
  BookOpen,
  LineChart,
  Pencil,
  Globe,
  RefreshCw,
  Coins,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModel } from "@/lib/model-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const modelingItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Revenue Forecast", url: "/revenue", icon: DollarSign },
  { title: "Income Statement", url: "/income-statement", icon: FileSpreadsheet },
  { title: "Balance Sheet", url: "/balance-sheet", icon: BarChart3 },
  { title: "Cash Flow", url: "/cash-flow", icon: Wallet },
  { title: "DCF Valuation", url: "/dcf", icon: Calculator },
  { title: "Valuation Compare", url: "/valuation", icon: Scale },
  { title: "Company Chart", url: "/chart", icon: LineChart },
];

const cryptoItems = [
  { title: "Crypto Dashboard", url: "/crypto", icon: Coins },
];

const portfolioItems = [
  { title: "Portfolio", url: "/portfolio", icon: Briefcase },
  { title: "Market Data", url: "/market-data", icon: TrendingUp },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { models, selectedModel, setSelectedModelId } = useModel();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState({
    name: "",
    ticker: "",
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 4,
    currency: "USD",
    sharesOutstanding: 10000000,
  });
  const [editCompany, setEditCompany] = useState({
    name: "",
    ticker: "",
    description: "",
    startYear: 2025,
    endYear: 2029,
    currency: "USD",
    sharesOutstanding: 10000000,
    displayUnit: "ones",
  });

  useEffect(() => {
    if (selectedModel && editOpen) {
      setEditCompany({
        name: selectedModel.name,
        ticker: selectedModel.ticker || "",
        description: selectedModel.description || "",
        startYear: selectedModel.startYear,
        endYear: selectedModel.endYear,
        currency: selectedModel.currency,
        sharesOutstanding: selectedModel.sharesOutstanding || 10000000,
        displayUnit: (selectedModel as any).displayUnit || "ones",
      });
    }
  }, [selectedModel, editOpen]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/models", {
        name: newCompany.name,
        ticker: newCompany.ticker || null,
        startYear: newCompany.startYear,
        endYear: newCompany.endYear,
        currency: newCompany.currency,
        sharesOutstanding: newCompany.sharesOutstanding,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setSelectedModelId(data.id);
      setCreateOpen(false);
      setNewCompany({
        name: "",
        ticker: "",
        startYear: new Date().getFullYear(),
        endYear: new Date().getFullYear() + 4,
        currency: "USD",
        sharesOutstanding: 10000000,
      });
      toast({ title: "Company created", description: `${data.name} is ready for analysis.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [syncingYahoo, setSyncingYahoo] = useState(false);

  const handleSyncYahoo = async () => {
    if (!selectedModel || !editCompany.ticker) return;
    setSyncingYahoo(true);
    try {
      const tempModel = { ...selectedModel };
      if (editCompany.ticker !== selectedModel.ticker) {
        await apiRequest("PATCH", `/api/models/${selectedModel.id}`, { ticker: editCompany.ticker });
      }
      const res = await apiRequest("POST", `/api/models/${selectedModel.id}/sync-yahoo`);
      const result = await res.json();
      if (result.data) {
        if (result.data.sharesOutstanding > 0) {
          setEditCompany(prev => ({ ...prev, sharesOutstanding: result.data.sharesOutstanding }));
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Yahoo data synced", description: `Shares outstanding, price, and beta updated from Yahoo Finance.` });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message || "Could not fetch data from Yahoo Finance.", variant: "destructive" });
    } finally {
      setSyncingYahoo(false);
    }
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedModel) return;
      const res = await apiRequest("PATCH", `/api/models/${selectedModel.id}`, {
        name: editCompany.name,
        ticker: editCompany.ticker || null,
        description: editCompany.description || null,
        startYear: editCompany.startYear,
        endYear: editCompany.endYear,
        currency: editCompany.currency,
        sharesOutstanding: editCompany.sharesOutstanding,
        displayUnit: editCompany.displayUnit,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setEditOpen(false);
      toast({ title: "Company updated", description: "Company details have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      if (deleteTarget === selectedModel?.id) {
        const remaining = models.filter((m) => m.id !== deleteTarget);
        setSelectedModelId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast({ title: "Company deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTargetModel = models.find((m) => m.id === deleteTarget);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-app-name">Kozo</span>
            <span className="text-xs text-muted-foreground">Financial Modeling</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Company</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 pb-2 space-y-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal"
                    data-testid="button-company-selector"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate text-xs">
                        {selectedModel?.name || "Select company"}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {models.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      data-testid={`menu-item-company-${m.id}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-xs">{m.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.id === selectedModel?.id && (
                          <Check className="h-3 w-3 text-primary" />
                        )}
                        {models.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            aria-label="Delete model"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(m.id);
                              setDeleteOpen(true);
                            }}
                            data-testid={`button-delete-company-${m.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setEditOpen(true)}
                    disabled={!selectedModel}
                    data-testid="button-edit-company"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    <span className="text-xs">Edit Company</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCreateOpen(true)}
                    data-testid="button-new-company"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="text-xs">New Company</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Financial Model</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modelingItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/guide"}>
                  <Link href="/guide" data-testid="link-nav-analysis-guide">
                    <BookOpen className="h-4 w-4" />
                    <span>Analysis Guide</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Crypto Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cryptoItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio & Markets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portfolioItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" data-testid="link-nav-admin">
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-new-company">
          <DialogHeader>
            <DialogTitle>New Company Analysis</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                placeholder="e.g. Apple Inc."
                data-testid="input-company-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-ticker">Ticker Symbol</Label>
              <Input
                id="company-ticker"
                value={newCompany.ticker}
                onChange={(e) => setNewCompany({ ...newCompany, ticker: e.target.value.toUpperCase() })}
                placeholder="e.g. AAPL"
                data-testid="input-company-ticker"
              />
              <p className="text-xs text-muted-foreground">Used for the Company Chart. You can change this later.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-year">Start Year</Label>
                <Input
                  id="start-year"
                  type="number"
                  value={newCompany.startYear}
                  onChange={(e) => setNewCompany({ ...newCompany, startYear: parseInt(e.target.value) || 2024 })}
                  data-testid="input-start-year"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-year">End Year</Label>
                <Input
                  id="end-year"
                  type="number"
                  value={newCompany.endYear}
                  onChange={(e) => setNewCompany({ ...newCompany, endYear: parseInt(e.target.value) || 2028 })}
                  data-testid="input-end-year"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={newCompany.currency}
                  onChange={(e) => setNewCompany({ ...newCompany, currency: e.target.value })}
                  data-testid="input-currency"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shares">Shares Outstanding</Label>
                <Input
                  id="shares"
                  type="number"
                  value={newCompany.sharesOutstanding}
                  onChange={(e) => setNewCompany({ ...newCompany, sharesOutstanding: parseInt(e.target.value) || 0 })}
                  data-testid="input-shares"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newCompany.name.trim() || createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="dialog-edit-company">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Company Name</Label>
              <Input
                id="edit-name"
                value={editCompany.name}
                onChange={(e) => setEditCompany({ ...editCompany, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-ticker">Ticker Symbol</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-ticker"
                    value={editCompany.ticker}
                    onChange={(e) => setEditCompany({ ...editCompany, ticker: e.target.value.toUpperCase() })}
                    data-testid="input-edit-ticker"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSyncYahoo}
                    disabled={!editCompany.ticker || syncingYahoo}
                    title="Sync shares outstanding from Yahoo Finance"
                    aria-label="Sync from Yahoo Finance"
                    data-testid="button-sync-yahoo-sidebar"
                  >
                    {syncingYahoo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Click the globe to auto-fill shares outstanding from Yahoo Finance</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <Input
                  id="edit-currency"
                  value={editCompany.currency}
                  onChange={(e) => setEditCompany({ ...editCompany, currency: e.target.value })}
                  data-testid="input-edit-currency"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editCompany.description}
                onChange={(e) => setEditCompany({ ...editCompany, description: e.target.value })}
                placeholder="Brief description of the company"
                data-testid="input-edit-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start-year">Start Year</Label>
                <Input
                  id="edit-start-year"
                  type="number"
                  value={editCompany.startYear}
                  onChange={(e) => setEditCompany({ ...editCompany, startYear: parseInt(e.target.value) || 2024 })}
                  data-testid="input-edit-start-year"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end-year">End Year</Label>
                <Input
                  id="edit-end-year"
                  type="number"
                  value={editCompany.endYear}
                  onChange={(e) => setEditCompany({ ...editCompany, endYear: parseInt(e.target.value) || 2028 })}
                  data-testid="input-edit-end-year"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-shares">Shares Outstanding</Label>
                <Input
                  id="edit-shares"
                  type="number"
                  value={editCompany.sharesOutstanding}
                  onChange={(e) => setEditCompany({ ...editCompany, sharesOutstanding: parseFloat(e.target.value) || 0 })}
                  data-testid="input-edit-shares"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-display-unit">Display Unit</Label>
                <Select
                  value={editCompany.displayUnit}
                  onValueChange={(v) => setEditCompany({ ...editCompany, displayUnit: v })}
                >
                  <SelectTrigger data-testid="select-edit-display-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ones">Ones ($)</SelectItem>
                    <SelectItem value="thousands">Thousands ($K)</SelectItem>
                    <SelectItem value="millions">Millions ($M)</SelectItem>
                    <SelectItem value="billions">Billions ($B)</SelectItem>
                    <SelectItem value="trillions">Trillions ($T)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Controls how values are entered and displayed in tables</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} data-testid="button-cancel-edit-company">
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={!editCompany.name.trim() || editMutation.isPending}
              data-testid="button-confirm-edit-company"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-testid="dialog-delete-company">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTargetModel?.name}"? This will remove all financial data for this company. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
