import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Briefcase, Coins, Shield, ShieldOff, Loader2 } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="admin-page">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">System overview and user management</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {allUsers?.map((u) => {
                const initials = [u.firstName, u.lastName]
                  .filter(Boolean)
                  .map((n) => n?.[0])
                  .join("")
                  .toUpperCase() || "U";
                const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
                const isSelf = u.id === user?.id;

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md border"
                    data-testid={`user-row-${u.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.profileImageUrl || undefined} alt={displayName} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{displayName}</span>
                          {u.isAdmin && <Badge variant="default">Admin</Badge>}
                          {isSelf && <Badge variant="secondary">You</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email || u.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <div>{u.modelCount} models</div>
                        <div>{u.positionCount} positions</div>
                      </div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
