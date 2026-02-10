import { useLocation, Link } from "wouter";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModel } from "@/lib/model-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const modelingItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Revenue Forecast", url: "/revenue", icon: DollarSign },
  { title: "Income Statement", url: "/income-statement", icon: FileSpreadsheet },
  { title: "Balance Sheet", url: "/balance-sheet", icon: BarChart3 },
  { title: "Cash Flow", url: "/cash-flow", icon: Wallet },
  { title: "DCF Valuation", url: "/dcf", icon: Calculator },
  { title: "Valuation Compare", url: "/valuation", icon: Scale },
];

const portfolioItems = [
  { title: "Portfolio", url: "/portfolio", icon: Briefcase },
  { title: "Market Data", url: "/market-data", icon: TrendingUp },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { models, selectedModel, setSelectedModelId } = useModel();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState({
    name: "",
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 4,
    currency: "USD",
    sharesOutstanding: 10000000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/models", {
        name: newCompany.name,
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
            <span className="text-sm font-semibold" data-testid="text-app-name">Foresight</span>
            <span className="text-xs text-muted-foreground">Financial Modeling</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Company</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 pb-2">
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
