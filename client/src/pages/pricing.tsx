import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useCreateCheckout } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Zap, Crown, Building2, Loader2 } from "lucide-react";

interface StripePrice {
  price_id: string;
  unit_amount: number;
  recurring: { interval: string };
  product_name: string;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const { toast } = useToast();
  const search = useSearch();
  const checkout = useCreateCheckout();

  const { data: pricesData } = useQuery<{ data: StripePrice[] }>({
    queryKey: ["/api/stripe/prices"],
    retry: 1,
    staleTime: 60 * 1000,
  });

  const proMonthlyPrice = pricesData?.data?.find(
    (p) => p.product_name === "Kozo Pro" && p.recurring?.interval === "month"
  );
  const proAnnualPrice = pricesData?.data?.find(
    (p) => p.product_name === "Kozo Pro" && p.recurring?.interval === "year"
  );

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("cancelled") === "true") {
      toast({
        title: "Checkout cancelled",
        description: "Your checkout was cancelled. You can try again anytime.",
        variant: "destructive",
      });
    }
  }, [search, toast]);

  const handleProCheckout = () => {
    const priceId = annual ? proAnnualPrice?.price_id : proMonthlyPrice?.price_id;
    if (priceId) {
      checkout.mutate(priceId);
    }
  };

  const freeFeatures = [
    "2 financial models",
    "3 crypto projects",
    "5 AI calls / month",
    "3 portfolio positions",
    "3 market indices",
    "3 macro indicators",
    "5 emissions tokens",
    "1 PDF parse / month",
  ];

  const proFeatures = [
    "10 financial models",
    "20 crypto projects",
    "50 AI calls / month",
    "Unlimited portfolio positions",
    "Unlimited market indices",
    "Unlimited macro indicators",
    "30 emissions tokens",
    "Unlimited PDF parsing",
    "SEC EDGAR import",
    "AI Copilot",
    "CSV export",
    "Valuation comparison",
    "Sensitivity tables",
  ];

  const enterpriseFeatures = [
    "Unlimited financial models",
    "Unlimited crypto projects",
    "500 AI calls / month",
    "Unlimited everything",
    "Custom integrations",
    "Priority support",
    "Dedicated account manager",
  ];

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Choose the plan that fits your financial analysis needs. Upgrade or downgrade anytime.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <Switch
              checked={annual}
              onCheckedChange={setAnnual}
              data-testid="switch-billing-toggle"
            />
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
              Annual
            </span>
            {annual && (
              <Badge variant="secondary" data-testid="badge-save">
                Save $58
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <Card className="relative" data-testid="card-plan-free">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Free</CardTitle>
              </div>
              <CardDescription>Get started with the basics</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground ml-1">/ month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                disabled
                data-testid="button-plan-free"
              >
                Current Plan
              </Button>
            </CardFooter>
          </Card>

          <Card
            className="relative border-primary/50 bg-gradient-to-b from-primary/5 to-transparent"
            data-testid="card-plan-pro"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge data-testid="badge-popular">Most Popular</Badge>
            </div>
            <CardHeader className="pt-8">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle>Pro</CardTitle>
              </div>
              <CardDescription>For serious financial analysts</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold" data-testid="text-pro-price">
                  {annual ? "$290" : "$29"}
                </span>
                <span className="text-muted-foreground ml-1">
                  / {annual ? "year" : "month"}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleProCheckout}
                disabled={checkout.isPending}
                data-testid="button-plan-pro"
              >
                {checkout.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Upgrade to Pro
              </Button>
            </CardFooter>
          </Card>

          <Card className="relative" data-testid="card-plan-enterprise">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Enterprise</CardTitle>
              </div>
              <CardDescription>For teams and organizations</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {enterpriseFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                asChild
                data-testid="button-plan-enterprise"
              >
                <a href="mailto:enterprise@kozo.finance">Schedule a Call</a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
