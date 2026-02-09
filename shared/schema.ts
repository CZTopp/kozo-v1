import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const financialModels = pgTable("financial_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("USD"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assumptions = pgTable("assumptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  scenarioId: varchar("scenario_id").references(() => scenarios.id, { onDelete: "cascade" }),
  revenueGrowthRate: numeric("revenue_growth_rate").notNull().default("0.10"),
  churnRate: numeric("churn_rate").notNull().default("0.05"),
  avgRevenuePerUnit: numeric("avg_revenue_per_unit").notNull().default("100"),
  initialCustomers: integer("initial_customers").notNull().default(100),
  cogsPercent: numeric("cogs_percent").notNull().default("0.30"),
  salesMarketingPercent: numeric("sales_marketing_percent").notNull().default("0.20"),
  rdPercent: numeric("rd_percent").notNull().default("0.15"),
  gaPercent: numeric("ga_percent").notNull().default("0.10"),
  taxRate: numeric("tax_rate").notNull().default("0.25"),
  capexPercent: numeric("capex_percent").notNull().default("0.05"),
  initialCash: numeric("initial_cash").notNull().default("100000"),
  monthlyBurnOverride: numeric("monthly_burn_override"),
});

export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("base"),
  color: text("color").notNull().default("#3b82f6"),
});

export const actuals = pgTable("actuals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  revenue: numeric("revenue"),
  cogs: numeric("cogs"),
  operatingExpenses: numeric("operating_expenses"),
  netIncome: numeric("net_income"),
  cashBalance: numeric("cash_balance"),
  customers: integer("customers"),
});

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  snapshotData: jsonb("snapshot_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  dataType: text("data_type").notNull(),
  data: jsonb("data"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const insertFinancialModelSchema = createInsertSchema(financialModels).omit({ id: true, createdAt: true });
export const insertAssumptionsSchema = createInsertSchema(assumptions).omit({ id: true });
export const insertScenarioSchema = createInsertSchema(scenarios).omit({ id: true });
export const insertActualsSchema = createInsertSchema(actuals).omit({ id: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });
export const insertMarketDataSchema = createInsertSchema(marketData).omit({ id: true, fetchedAt: true });

export type FinancialModel = typeof financialModels.$inferSelect;
export type InsertFinancialModel = z.infer<typeof insertFinancialModelSchema>;
export type Assumptions = typeof assumptions.$inferSelect;
export type InsertAssumptions = z.infer<typeof insertAssumptionsSchema>;
export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Actual = typeof actuals.$inferSelect;
export type InsertActual = z.infer<typeof insertActualsSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;

export interface ForecastRow {
  period: string;
  year: number;
  month: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  salesMarketing: number;
  rd: number;
  ga: number;
  totalOpex: number;
  ebitda: number;
  netIncome: number;
  cashFlow: number;
  cashBalance: number;
  customers: number;
  runway: number | null;
}

export interface VarianceRow {
  period: string;
  forecastRevenue: number;
  actualRevenue: number | null;
  revenueVariance: number | null;
  revenueVariancePercent: number | null;
  forecastNetIncome: number;
  actualNetIncome: number | null;
  netIncomeVariance: number | null;
  forecastCash: number;
  actualCash: number | null;
  cashVariance: number | null;
}
