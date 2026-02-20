import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useSubscription,
  useCreateCheckout,
  useCreatePortal,
  useCancelSubscription,
} from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Crown,
  Zap,
  Check,
  Lock,
  X,
  CreditCard,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface StripePrice {
  price_id: string;
  unit_amount: number;
  recurring: { interval: string };
  product_name: string;
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const search = useSearch();
  const { data: sub, isLoading } = useSubscription();
  const checkout = useCreateCheckout();
  const portal = useCreatePortal();
  const cancel = useCancelSubscription();

  const { data: pricesData } = useQuery<{ data: StripePrice[] }>({
    queryKey: ["/api/stripe/prices"],
    retry: 1,
    staleTime: 60 * 1000,
  });

  const proMonthlyPrice = pricesData?.data?.find(
    (p) => p.product_name === "Kozo Pro" && p.recurring?.interval === "month"
  );

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("success") === "true") {
      toast({
        title: "Subscription activated",
        description: "Welcome to Kozo Pro! Your subscription is now active.",
      });
    }
  }, [search, toast]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" data-testid="skeleton-title" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!sub) return null;

  const plan = sub.plan;
  const usage = sub.usage;
  const limits = sub.limits;

  const usageMeters = [
    {
      label: "Financial Models",
      current: usage.financialModels,
      limit: limits.financialModels,
    },
    {
      label: "Crypto Projects",
      current: usage.cryptoProjects,
      limit: limits.cryptoProjects,
    },
    {
      label: "AI Calls Used",
      current: usage.aiCallsUsed,
      limit: limits.aiCallsPerMonth,
    },
    {
      label: "Portfolio Positions",
      current: usage.portfolioPositions,
      limit: limits.portfolioPositions,
    },
  ];

  const booleanFeatures = [
    { label: "SEC EDGAR Import", enabled: limits.secEdgarImport },
    { label: "AI Copilot", enabled: limits.copilotAccess },
    { label: "CSV Export", enabled: limits.csvExport },
    { label: "Valuation Comparison", enabled: limits.valuationComparison },
    { label: "Sensitivity Tables", enabled: limits.sensitivityTables },
    { label: "Unlimited PDF Parsing", enabled: limits.unlimitedPdfParsing },
  ];

  const planBadgeVariant = plan === "pro" ? "default" : plan === "enterprise" ? "default" : "secondary";

  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    if (proMonthlyPrice?.price_id) {
      checkout.mutate(proMonthlyPrice.price_id);
    } else {
      setLocation("/pricing");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-subscription-title">
          Subscription
        </h1>
        <p className="text-muted-foreground">
          Manage your plan and billing
        </p>
      </div>

      {sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-cancel-warning">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Subscription ending</p>
              <p className="text-sm text-muted-foreground">
                Your Pro subscription will end on{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                . You will lose access to Pro features after this date.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-current-plan">
          <CardHeader>
            <CardDescription>Current Plan</CardDescription>
            <div className="flex items-center gap-2">
              {plan === "pro" && <Crown className="h-5 w-5 text-primary" />}
              {plan === "enterprise" && <Crown className="h-5 w-5 text-primary" />}
              {plan === "free" && <Zap className="h-5 w-5 text-muted-foreground" />}
              <CardTitle className="capitalize" data-testid="text-current-plan">
                {plan}
              </CardTitle>
              <Badge variant={planBadgeVariant} data-testid="badge-plan">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {plan === "free" && (
              <Button
                onClick={handleUpgrade}
                disabled={checkout.isPending}
                className="w-full"
                data-testid="button-upgrade-pro"
              >
                {checkout.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upgrade to Pro
              </Button>
            )}
            {plan === "pro" && (
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                  className="w-full"
                  data-testid="button-manage-billing"
                >
                  {portal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Billing
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full text-destructive"
                      data-testid="button-cancel-subscription"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your subscription will remain active until the end of your current billing
                        period. After that, you will be downgraded to the Free plan and lose access
                        to Pro features.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-dialog-dismiss">
                        Keep Subscription
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancel.mutate()}
                        className="bg-destructive text-destructive-foreground"
                        data-testid="button-cancel-confirm"
                      >
                        {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Yes, Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            {plan === "enterprise" && (
              <p className="text-sm text-muted-foreground">
                Contact your account manager for billing changes.
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-features">
          <CardHeader>
            <CardTitle className="text-base">Feature Access</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {booleanFeatures.map((feature) => (
                <li
                  key={feature.label}
                  className="flex items-center justify-between text-sm"
                  data-testid={`feature-${feature.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span>{feature.label}</span>
                  {feature.enabled ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-usage">
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
          <CardDescription>Your current resource usage this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {usageMeters.map((meter) => {
              const isUnlimited = meter.limit === -1 || meter.limit >= 999999;
              const percentage = isUnlimited
                ? Math.min((meter.current / 100) * 100, 100)
                : Math.min((meter.current / meter.limit) * 100, 100);

              return (
                <div
                  key={meter.label}
                  className="space-y-2"
                  data-testid={`usage-${meter.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{meter.label}</span>
                    <span className="text-muted-foreground">
                      {meter.current} / {isUnlimited ? "Unlimited" : meter.limit}
                    </span>
                  </div>
                  <Progress value={isUnlimited ? Math.min(meter.current, 10) : percentage} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
