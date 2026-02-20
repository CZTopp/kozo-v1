import { eq, count } from "drizzle-orm";
import { db } from "./db";
import {
  subscriptions, financialModels, cryptoProjects,
  portfolioPositions, marketIndices, macroIndicators,
  type Subscription,
} from "@shared/schema";

export type PlanTier = "free" | "pro" | "enterprise";

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

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    financialModels: 2,
    cryptoProjects: 3,
    aiCallsPerMonth: 5,
    pdfParsesPerMonth: 1,
    portfolioPositions: 3,
    marketIndices: 3,
    macroIndicators: 3,
    emissionsTokens: 5,
    secEdgarImport: false,
    valuationComparison: false,
    sensitivityTables: false,
    copilotAccess: false,
    csvExport: false,
    unlimitedPdfParsing: false,
  },
  pro: {
    financialModels: 10,
    cryptoProjects: 20,
    aiCallsPerMonth: 50,
    pdfParsesPerMonth: -1,
    portfolioPositions: -1,
    marketIndices: -1,
    macroIndicators: -1,
    emissionsTokens: 30,
    secEdgarImport: true,
    valuationComparison: true,
    sensitivityTables: true,
    copilotAccess: true,
    csvExport: true,
    unlimitedPdfParsing: true,
  },
  enterprise: {
    financialModels: -1,
    cryptoProjects: -1,
    aiCallsPerMonth: 500,
    pdfParsesPerMonth: -1,
    portfolioPositions: -1,
    marketIndices: -1,
    macroIndicators: -1,
    emissionsTokens: 30,
    secEdgarImport: true,
    valuationComparison: true,
    sensitivityTables: true,
    copilotAccess: true,
    csvExport: true,
    unlimitedPdfParsing: true,
  },
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  requiredPlan?: PlanTier;
}

export async function getOrCreateSubscription(userId: string): Promise<Subscription> {
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (existing) {
    if (existing.currentPeriodEnd && new Date(existing.currentPeriodEnd) < new Date()) {
      const [reset] = await db.update(subscriptions).set({
        aiCallsUsed: 0,
        pdfParsesUsed: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, existing.id)).returning();
      return reset;
    }
    return existing;
  }
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [created] = await db.insert(subscriptions).values({
    userId,
    plan: "free",
    aiCallsUsed: 0,
    pdfParsesUsed: 0,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  }).returning();
  return created;
}

function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanTier] || PLAN_LIMITS.free;
}

export async function getUserPlanInfo(userId: string) {
  const sub = await getOrCreateSubscription(userId);
  const limits = getLimits(sub.plan);

  const [modelCount] = await db.select({ value: count() }).from(financialModels).where(eq(financialModels.userId, userId));
  const [cryptoCount] = await db.select({ value: count() }).from(cryptoProjects).where(eq(cryptoProjects.userId, userId));
  const [positionCount] = await db.select({ value: count() }).from(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  const [indexCount] = await db.select({ value: count() }).from(marketIndices).where(eq(marketIndices.userId, userId));
  const [macroCount] = await db.select({ value: count() }).from(macroIndicators).where(eq(macroIndicators.userId, userId));

  return {
    plan: sub.plan as PlanTier,
    billingCycle: sub.billingCycle,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
    limits,
    usage: {
      financialModels: modelCount.value,
      cryptoProjects: cryptoCount.value,
      portfolioPositions: positionCount.value,
      marketIndices: indexCount.value,
      macroIndicators: macroCount.value,
      aiCallsUsed: sub.aiCallsUsed,
      pdfParsesUsed: sub.pdfParsesUsed,
    },
  };
}

export async function checkLimit(userId: string, resource: string): Promise<LimitCheckResult> {
  const sub = await getOrCreateSubscription(userId);
  const limits = getLimits(sub.plan);

  switch (resource) {
    case "financial_model": {
      const [c] = await db.select({ value: count() }).from(financialModels).where(eq(financialModels.userId, userId));
      if (limits.financialModels !== -1 && c.value >= limits.financialModels) {
        return { allowed: false, reason: `Free plan allows ${limits.financialModels} financial models. Delete an existing model or upgrade to Pro.`, current: c.value, limit: limits.financialModels, requiredPlan: "pro" };
      }
      return { allowed: true, current: c.value, limit: limits.financialModels };
    }
    case "crypto_project": {
      const [c] = await db.select({ value: count() }).from(cryptoProjects).where(eq(cryptoProjects.userId, userId));
      if (limits.cryptoProjects !== -1 && c.value >= limits.cryptoProjects) {
        return { allowed: false, reason: `Free plan allows ${limits.cryptoProjects} crypto projects. Delete an existing project or upgrade to Pro.`, current: c.value, limit: limits.cryptoProjects, requiredPlan: "pro" };
      }
      return { allowed: true, current: c.value, limit: limits.cryptoProjects };
    }
    case "portfolio_position": {
      const [c] = await db.select({ value: count() }).from(portfolioPositions).where(eq(portfolioPositions.userId, userId));
      if (limits.portfolioPositions !== -1 && c.value >= limits.portfolioPositions) {
        return { allowed: false, reason: `Free plan allows ${limits.portfolioPositions} portfolio positions. Upgrade to Pro for unlimited positions.`, current: c.value, limit: limits.portfolioPositions, requiredPlan: "pro" };
      }
      return { allowed: true, current: c.value, limit: limits.portfolioPositions };
    }
    case "market_index": {
      const [c] = await db.select({ value: count() }).from(marketIndices).where(eq(marketIndices.userId, userId));
      if (limits.marketIndices !== -1 && c.value >= limits.marketIndices) {
        return { allowed: false, reason: `Free plan allows ${limits.marketIndices} market indices. Upgrade to Pro for unlimited.`, current: c.value, limit: limits.marketIndices, requiredPlan: "pro" };
      }
      return { allowed: true, current: c.value, limit: limits.marketIndices };
    }
    case "macro_indicator": {
      const [c] = await db.select({ value: count() }).from(macroIndicators).where(eq(macroIndicators.userId, userId));
      if (limits.macroIndicators !== -1 && c.value >= limits.macroIndicators) {
        return { allowed: false, reason: `Free plan allows ${limits.macroIndicators} macro indicators. Upgrade to Pro for unlimited.`, current: c.value, limit: limits.macroIndicators, requiredPlan: "pro" };
      }
      return { allowed: true, current: c.value, limit: limits.macroIndicators };
    }
    case "ai_call": {
      if (limits.aiCallsPerMonth !== -1 && sub.aiCallsUsed >= limits.aiCallsPerMonth) {
        return { allowed: false, reason: `You've used all ${limits.aiCallsPerMonth} AI research calls this month. Upgrade to Pro for ${PLAN_LIMITS.pro.aiCallsPerMonth} calls/month.`, current: sub.aiCallsUsed, limit: limits.aiCallsPerMonth, requiredPlan: "pro" };
      }
      return { allowed: true, current: sub.aiCallsUsed, limit: limits.aiCallsPerMonth };
    }
    case "pdf_parse": {
      if (limits.pdfParsesPerMonth !== -1 && sub.pdfParsesUsed >= limits.pdfParsesPerMonth) {
        return { allowed: false, reason: `Free plan allows ${limits.pdfParsesPerMonth} PDF parse per month. Upgrade to Pro for unlimited.`, current: sub.pdfParsesUsed, limit: limits.pdfParsesPerMonth, requiredPlan: "pro" };
      }
      return { allowed: true, current: sub.pdfParsesUsed, limit: limits.pdfParsesPerMonth };
    }
    case "sec_edgar": {
      if (!limits.secEdgarImport) {
        return { allowed: false, reason: "SEC EDGAR import is a Pro feature. Upgrade to access 10-K filing import.", requiredPlan: "pro" };
      }
      return { allowed: true };
    }
    case "valuation_comparison": {
      if (!limits.valuationComparison) {
        return { allowed: false, reason: "Multi-method valuation comparison is a Pro feature.", requiredPlan: "pro" };
      }
      return { allowed: true };
    }
    case "sensitivity_table": {
      if (!limits.sensitivityTables) {
        return { allowed: false, reason: "DCF sensitivity tables are a Pro feature.", requiredPlan: "pro" };
      }
      return { allowed: true };
    }
    case "copilot": {
      if (!limits.copilotAccess) {
        return { allowed: false, reason: "AI Copilot is a Pro feature. Upgrade to access the AI assistant.", requiredPlan: "pro" };
      }
      return { allowed: true };
    }
    case "csv_export": {
      if (!limits.csvExport) {
        return { allowed: false, reason: "CSV export is a Pro feature.", requiredPlan: "pro" };
      }
      return { allowed: true };
    }
    default:
      return { allowed: true };
  }
}

export async function incrementAiCalls(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  await db.update(subscriptions).set({
    aiCallsUsed: sub.aiCallsUsed + 1,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, sub.id));
}

export async function incrementPdfParses(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  await db.update(subscriptions).set({
    pdfParsesUsed: sub.pdfParsesUsed + 1,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, sub.id));
}

export async function updateSubscriptionPlan(
  userId: string,
  plan: PlanTier,
  stripeData?: { customerId?: string; subscriptionId?: string; billingCycle?: string; periodEnd?: Date }
): Promise<Subscription> {
  const sub = await getOrCreateSubscription(userId);
  const [updated] = await db.update(subscriptions).set({
    plan,
    billingCycle: stripeData?.billingCycle || sub.billingCycle,
    stripeCustomerId: stripeData?.customerId || sub.stripeCustomerId,
    stripeSubscriptionId: stripeData?.subscriptionId || sub.stripeSubscriptionId,
    currentPeriodEnd: stripeData?.periodEnd || sub.currentPeriodEnd,
    aiCallsUsed: 0,
    pdfParsesUsed: 0,
    cancelAtPeriodEnd: false,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, sub.id)).returning();
  return updated;
}

export async function cancelSubscription(userId: string): Promise<Subscription> {
  const sub = await getOrCreateSubscription(userId);
  const [updated] = await db.update(subscriptions).set({
    cancelAtPeriodEnd: true,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, sub.id)).returning();
  return updated;
}

export async function downgradeToFree(userId: string): Promise<Subscription> {
  const sub = await getOrCreateSubscription(userId);
  const [updated] = await db.update(subscriptions).set({
    plan: "free",
    billingCycle: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
    aiCallsUsed: 0,
    pdfParsesUsed: 0,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, sub.id)).returning();
  return updated;
}
