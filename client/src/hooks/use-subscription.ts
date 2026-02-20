import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface PlanLimits {
  financialModels: number;
  cryptoProjects: number;
  aiCallsPerMonth: number;
  pdfParsesPerMonth: number;
  portfolioPositions: number;
  marketIndices: number;
  macroIndicators: number;
  emissionsTokens: number;
  secEdgarImport: boolean;
  valuationComparison: boolean;
  sensitivityTables: boolean;
  copilotAccess: boolean;
  csvExport: boolean;
  unlimitedPdfParsing: boolean;
}

export interface SubscriptionInfo {
  plan: "free" | "pro" | "enterprise";
  billingCycle: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  limits: PlanLimits;
  usage: {
    financialModels: number;
    cryptoProjects: number;
    portfolioPositions: number;
    marketIndices: number;
    macroIndicators: number;
    aiCallsUsed: number;
    pdfParsesUsed: number;
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  requiredPlan?: string;
}

export function useSubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCheckLimit() {
  return useMutation({
    mutationFn: async (resource: string): Promise<LimitCheckResult> => {
      const res = await apiRequest("POST", "/api/subscription/check", { resource });
      return await res.json();
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreatePortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal");
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCancelSubscription() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/cancel");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    },
  });
}

export function invalidateSubscription() {
  queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
}
