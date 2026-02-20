import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Briefcase, Coins, Shield, ShieldOff, Loader2, Crown, CreditCard } from "lucide-react";

interface AdminStats {
  users: number;
  models: number;
  positions: number;
  cryptoProjects: number;
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  modelCount: number;
  positionCount: number;
  cryptoProjectCount: number;
  indexCount: number;
  macroCount: number;
  plan: string;
  billingCycle: string | null;
  aiCallsUsed: number;
  pdfParsesUsed: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { isAdmin });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/plan`, { plan });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Plan updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats?.users ?? 0, icon: Users },
    { label: "Financial Models", value: stats?.models ?? 0, icon: BarChart3 },
    { label: "Portfolio Positions", value: stats?.positions ?? 0, icon: Briefcase },
    { label: "Crypto Projects", value: stats?.cryptoProjects ?? 0, icon: Coins },
  ];

  const planCounts = {
    free: allUsers?.filter((u) => u.plan === "free").length ?? 0,
    pro: allUsers?.filter((u) => u.plan === "pro").length ?? 0,
    enterprise: allUsers?.filter((u) => u.plan === "enterprise").length ?? 0,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="admin-page">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">System overview, user management, and tier control</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-2xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
                  {s.value}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["free", "pro", "enterprise"] as const).map((tier) => (
          <Card key={tier}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{tier} Users</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold" data-testid={`stat-${tier}-users`}>{planCounts[tier]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Management</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Models</TableHead>
                    <TableHead className="text-center">Crypto</TableHead>
                    <TableHead className="text-center">Positions</TableHead>
                    <TableHead className="text-center">Indices</TableHead>
                    <TableHead className="text-center">Macro</TableHead>
                    <TableHead className="text-center">AI Calls</TableHead>
                    <TableHead className="text-center">PDF Parses</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers?.map((u) => {
                    const initials = [u.firstName, u.lastName]
                      .filter(Boolean)
                      .map((n) => n?.[0])
                      .join("")
                      .toUpperCase() || "U";
                    const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
                    const isSelf = u.id === user?.id;

                    return (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.profileImageUrl || undefined} alt={displayName} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium truncate">{displayName}</span>
                                {u.isAdmin && <Badge variant="default" className="text-[10px] px-1 py-0" data-testid={`badge-admin-${u.id}`}>Admin</Badge>}
                                {isSelf && <Badge variant="secondary" className="text-[10px] px-1 py-0" data-testid="badge-self">You</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{u.email || u.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.plan}
                            onValueChange={(newPlan) => changePlanMutation.mutate({ id: u.id, plan: newPlan })}
                            disabled={changePlanMutation.isPending}
                          >
                            <SelectTrigger className="w-[120px]" data-testid={`select-plan-${u.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free" data-testid={`option-plan-free-${u.id}`}>Free</SelectItem>
                              <SelectItem value="pro" data-testid={`option-plan-pro-${u.id}`}>Pro</SelectItem>
                              <SelectItem value="enterprise" data-testid={`option-plan-enterprise-${u.id}`}>Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-models-${u.id}`}>{u.modelCount}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-crypto-${u.id}`}>{u.cryptoProjectCount}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-positions-${u.id}`}>{u.positionCount}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-indices-${u.id}`}>{u.indexCount}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-macro-${u.id}`}>{u.macroCount}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-ai-${u.id}`}>{u.aiCallsUsed}</TableCell>
                        <TableCell className="text-center text-sm" data-testid={`count-pdf-${u.id}`}>{u.pdfParsesUsed}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground min-w-[100px]">
                            {u.billingCycle && <div className="capitalize">{u.billingCycle}</div>}
                            {u.currentPeriodEnd && (
                              <div>Renews {new Date(u.currentPeriodEnd).toLocaleDateString()}</div>
                            )}
                            {u.cancelAtPeriodEnd && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-red-500 border-red-500/30" data-testid={`badge-canceling-${u.id}`}>Canceling</Badge>
                            )}
                            {u.stripeCustomerId && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <CreditCard className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">Stripe</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isSelf && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAdminMutation.mutate({ id: u.id, isAdmin: !u.isAdmin })}
                              disabled={toggleAdminMutation.isPending}
                              data-testid={`button-toggle-admin-${u.id}`}
                            >
                              {u.isAdmin ? (
                                <>
                                  <ShieldOff className="h-3 w-3 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <Shield className="h-3 w-3 mr-1" />
                                  Grant
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
