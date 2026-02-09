import { db } from "./db";
import { financialModels, assumptions, scenarios, actuals } from "@shared/schema";

export async function seedDatabase() {
  const existingModels = await db.select().from(financialModels);
  if (existingModels.length > 0) return;

  const [model] = await db.insert(financialModels).values({
    name: "SaaS Growth Model 2026",
    description: "5-year projection for B2B SaaS startup with subscription revenue model",
    currency: "USD",
    startYear: 2026,
    endYear: 2030,
  }).returning();

  await db.insert(assumptions).values({
    modelId: model.id,
    revenueGrowthRate: "0.25",
    churnRate: "0.04",
    avgRevenuePerUnit: "120",
    initialCustomers: 250,
    cogsPercent: "0.25",
    salesMarketingPercent: "0.22",
    rdPercent: "0.18",
    gaPercent: "0.08",
    taxRate: "0.21",
    capexPercent: "0.03",
    initialCash: "500000",
  });

  const [optimistic] = await db.insert(scenarios).values({
    modelId: model.id,
    name: "Bull Case",
    type: "optimistic",
    color: "#22c55e",
  }).returning();

  await db.insert(assumptions).values({
    modelId: model.id,
    scenarioId: optimistic.id,
    revenueGrowthRate: "0.40",
    churnRate: "0.025",
    avgRevenuePerUnit: "140",
    initialCustomers: 250,
    cogsPercent: "0.22",
    salesMarketingPercent: "0.25",
    rdPercent: "0.18",
    gaPercent: "0.08",
    taxRate: "0.21",
    capexPercent: "0.03",
    initialCash: "500000",
  });

  const [pessimistic] = await db.insert(scenarios).values({
    modelId: model.id,
    name: "Bear Case",
    type: "pessimistic",
    color: "#ef4444",
  }).returning();

  await db.insert(assumptions).values({
    modelId: model.id,
    scenarioId: pessimistic.id,
    revenueGrowthRate: "0.10",
    churnRate: "0.08",
    avgRevenuePerUnit: "95",
    initialCustomers: 250,
    cogsPercent: "0.30",
    salesMarketingPercent: "0.18",
    rdPercent: "0.15",
    gaPercent: "0.10",
    taxRate: "0.21",
    capexPercent: "0.03",
    initialCash: "500000",
  });

  await db.insert(actuals).values([
    { modelId: model.id, period: "2026-01", revenue: "2400", cogs: "600", netIncome: "320", cashBalance: "500320", customers: 252 },
    { modelId: model.id, period: "2026-02", revenue: "2650", cogs: "660", netIncome: "380", cashBalance: "500700", customers: 258 },
    { modelId: model.id, period: "2026-03", revenue: "2900", cogs: "720", netIncome: "450", cashBalance: "501150", customers: 265 },
  ]);

  console.log("Seed data inserted successfully");
}
