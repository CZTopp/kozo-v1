import { useSubscription, useCreateCheckout, type LimitCheckResult } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, Zap, Crown } from "lucide-react";
import { useLocation } from "wouter";

interface UpgradeGateProps {
  resource: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function UpgradeGate({ resource, children, fallback }: UpgradeGateProps) {
  const { data: sub } = useSubscription();
  if (!sub) return <>{children}</>;

  const plan = sub.plan;
  if (plan === "pro" || plan === "enterprise") return <>{children}</>;

  const limits = sub.limits;
  const usage = sub.usage;

  let blocked = false;
  switch (resource) {
    case "financial_model":
      blocked = usage.financialModels >= limits.financialModels;
      break;
    case "crypto_project":
      blocked = usage.cryptoProjects >= limits.cryptoProjects;
      break;
    case "portfolio_position":
      blocked = usage.portfolioPositions >= limits.portfolioPositions;
      break;
    case "market_index":
      blocked = usage.marketIndices >= limits.marketIndices;
      break;
    case "macro_indicator":
      blocked = usage.macroIndicators >= limits.macroIndicators;
      break;
    case "ai_call":
      blocked = usage.aiCallsUsed >= limits.aiCallsPerMonth;
      break;
    case "pdf_parse":
      blocked = usage.pdfParsesUsed >= limits.pdfParsesPerMonth;
      break;
    case "sec_edgar":
    case "csv_export":
    case "valuation_comparison":
    case "sensitivity_table":
      blocked = true;
      break;
  }

  if (!blocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return <UpgradePrompt resource={resource} />;
}

interface UpgradePromptProps {
  resource: string;
  inline?: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
  financial_model: "financial models",
  crypto_project: "crypto projects",
  portfolio_position: "portfolio positions",
  market_index: "market indices",
  macro_indicator: "macro indicators",
  ai_call: "AI research calls",
  pdf_parse: "PDF parsing",
  sec_edgar: "SEC EDGAR import",
  copilot: "AI Copilot",
  csv_export: "CSV export",
  valuation_comparison: "valuation comparison",
  sensitivity_table: "sensitivity tables",
};

export function UpgradePrompt({ resource, inline }: UpgradePromptProps) {
  const [, setLocation] = useLocation();
  const label = RESOURCE_LABELS[resource] || resource;

  if (inline) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLocation("/pricing")}
        className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
        data-testid={`button-upgrade-${resource}`}
      >
        <Lock className="h-3.5 w-3.5" />
        Upgrade to Pro
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 border border-dashed border-amber-500/30 rounded-lg bg-amber-500/5" data-testid={`upgrade-prompt-${resource}`}>
      <div className="flex items-center gap-2 text-amber-500">
        <Crown className="h-5 w-5" />
        <span className="font-medium">Pro Feature</span>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        You've reached the free plan limit for {label}. Upgrade to Pro to unlock more.
      </p>
      <Button
        onClick={() => setLocation("/pricing")}
        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
        data-testid={`button-upgrade-cta-${resource}`}
      >
        <Zap className="h-4 w-4" />
        Upgrade to Pro - $29/mo
      </Button>
    </div>
  );
}

export function UpgradeBadge() {
  const [, setLocation] = useLocation();
  const { data: sub } = useSubscription();

  if (!sub || sub.plan !== "free") return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLocation("/pricing")}
      className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 text-xs"
      data-testid="button-upgrade-badge"
    >
      <Zap className="h-3 w-3" />
      Upgrade
    </Button>
  );
}

export function ProCrown({ feature }: { feature: string }) {
  const [, setLocation] = useLocation();
  const { data: sub } = useSubscription();

  if (!sub || sub.plan !== "free") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocation("/subscription"); }}
            className="inline-flex items-center"
            data-testid={`crown-${feature}`}
          >
            <Crown className="h-3.5 w-3.5 text-amber-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Pro feature — click to upgrade</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
