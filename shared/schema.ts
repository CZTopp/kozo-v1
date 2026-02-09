import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const financialModels = pgTable("financial_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("USD"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  sharesOutstanding: real("shares_outstanding").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const revenueLineItems = pgTable("revenue_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const revenuePeriods = pgTable("revenue_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lineItemId: varchar("line_item_id").notNull().references(() => revenueLineItems.id, { onDelete: "cascade" }),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  amount: real("amount").notNull().default(0),
  isActual: boolean("is_actual").notNull().default(false),
});

export const incomeStatementLines = pgTable("income_statement_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  isActual: boolean("is_actual").notNull().default(false),
  revenue: real("revenue").default(0),
  cogs: real("cogs").default(0),
  grossProfit: real("gross_profit").default(0),
  salesMarketing: real("sales_marketing").default(0),
  researchDevelopment: real("research_development").default(0),
  generalAdmin: real("general_admin").default(0),
  depreciation: real("depreciation").default(0),
  totalExpenses: real("total_expenses").default(0),
  operatingIncome: real("operating_income").default(0),
  ebitda: real("ebitda").default(0),
  otherIncome: real("other_income").default(0),
  preTaxIncome: real("pre_tax_income").default(0),
  incomeTax: real("income_tax").default(0),
  netIncome: real("net_income").default(0),
  sharesOutstanding: real("shares_outstanding").default(0),
  eps: real("eps").default(0),
  nonGaapEps: real("non_gaap_eps").default(0),
  cogsPercent: real("cogs_percent").default(0),
  smPercent: real("sm_percent").default(0),
  rdPercent: real("rd_percent").default(0),
  gaPercent: real("ga_percent").default(0),
  depreciationPercent: real("depreciation_percent").default(0),
  taxRate: real("tax_rate").default(0),
});

export const balanceSheetLines = pgTable("balance_sheet_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  isActual: boolean("is_actual").notNull().default(false),
  cash: real("cash").default(0),
  shortTermInvestments: real("short_term_investments").default(0),
  accountsReceivable: real("accounts_receivable").default(0),
  inventory: real("inventory").default(0),
  totalCurrentAssets: real("total_current_assets").default(0),
  equipment: real("equipment").default(0),
  depreciationAccum: real("depreciation_accum").default(0),
  capex: real("capex").default(0),
  totalLongTermAssets: real("total_long_term_assets").default(0),
  totalAssets: real("total_assets").default(0),
  accountsPayable: real("accounts_payable").default(0),
  shortTermDebt: real("short_term_debt").default(0),
  totalCurrentLiabilities: real("total_current_liabilities").default(0),
  longTermDebt: real("long_term_debt").default(0),
  totalLongTermLiabilities: real("total_long_term_liabilities").default(0),
  totalLiabilities: real("total_liabilities").default(0),
  retainedEarnings: real("retained_earnings").default(0),
  commonShares: real("common_shares").default(0),
  totalEquity: real("total_equity").default(0),
  totalLiabilitiesAndEquity: real("total_liabilities_and_equity").default(0),
  arPercent: real("ar_percent").default(0),
  inventoryPercent: real("inventory_percent").default(0),
  apPercent: real("ap_percent").default(0),
  capexPercent: real("capex_percent").default(0),
});

export const cashFlowLines = pgTable("cash_flow_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  isActual: boolean("is_actual").notNull().default(false),
  netIncome: real("net_income").default(0),
  depreciationAdd: real("depreciation_add").default(0),
  arChange: real("ar_change").default(0),
  inventoryChange: real("inventory_change").default(0),
  apChange: real("ap_change").default(0),
  operatingCashFlow: real("operating_cash_flow").default(0),
  capex: real("capex").default(0),
  investingCashFlow: real("investing_cash_flow").default(0),
  shortTermDebtChange: real("short_term_debt_change").default(0),
  longTermDebtChange: real("long_term_debt_change").default(0),
  commonSharesChange: real("common_shares_change").default(0),
  financingCashFlow: real("financing_cash_flow").default(0),
  netCashChange: real("net_cash_change").default(0),
  beginningCash: real("beginning_cash").default(0),
  endingCash: real("ending_cash").default(0),
  freeCashFlow: real("free_cash_flow").default(0),
});

export const dcfValuations = pgTable("dcf_valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  riskFreeRate: real("risk_free_rate").notNull().default(0.025),
  beta: real("beta").notNull().default(1.0),
  marketReturn: real("market_return").notNull().default(0.085),
  costOfDebt: real("cost_of_debt").notNull().default(0.05),
  taxRate: real("tax_rate").notNull().default(0.30),
  equityWeight: real("equity_weight").notNull().default(0.5),
  debtWeight: real("debt_weight").notNull().default(0.5),
  longTermGrowth: real("long_term_growth").notNull().default(0.02),
  currentSharePrice: real("current_share_price").default(0),
  totalDebt: real("total_debt").default(0),
  sharesOutstanding: real("shares_outstanding").default(0),
  costOfEquity: real("cost_of_equity").default(0),
  wacc: real("wacc").default(0),
  npv: real("npv").default(0),
  terminalValue: real("terminal_value").default(0),
  terminalValueDiscounted: real("terminal_value_discounted").default(0),
  targetEquityValue: real("target_equity_value").default(0),
  targetValue: real("target_value").default(0),
  targetPricePerShare: real("target_price_per_share").default(0),
  sensitivityData: jsonb("sensitivity_data"),
});

export const valuationComparisons = pgTable("valuation_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  currentSharePrice: real("current_share_price").default(0),
  prBullMultiple: real("pr_bull_multiple").default(10),
  prBaseMultiple: real("pr_base_multiple").default(7.5),
  prBearMultiple: real("pr_bear_multiple").default(5),
  peBullPeg: real("pe_bull_peg").default(2),
  peBasePeg: real("pe_base_peg").default(1.5),
  peBearPeg: real("pe_bear_peg").default(1),
  prBullTarget: real("pr_bull_target").default(0),
  prBaseTarget: real("pr_base_target").default(0),
  prBearTarget: real("pr_bear_target").default(0),
  peBullTarget: real("pe_bull_target").default(0),
  peBaseTarget: real("pe_base_target").default(0),
  peBearTarget: real("pe_bear_target").default(0),
  dcfBullTarget: real("dcf_bull_target").default(0),
  dcfBaseTarget: real("dcf_base_target").default(0),
  dcfBearTarget: real("dcf_bear_target").default(0),
  averageTarget: real("average_target").default(0),
  percentToTarget: real("percent_to_target").default(0),
  valuationData: jsonb("valuation_data"),
});

export const portfolioPositions = pgTable("portfolio_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: text("ticker").notNull(),
  companyName: text("company_name").notNull(),
  sector: text("sector"),
  industry: text("industry"),
  sharesHeld: real("shares_held").notNull().default(100),
  purchasePrice: real("purchase_price").notNull().default(0),
  currentPrice: real("current_price").notNull().default(0),
  marketCap: real("market_cap").default(0),
  dailyChangePercent: real("daily_change_percent").default(0),
  dailyChange: real("daily_change").default(0),
  dayHigh: real("day_high").default(0),
  dayLow: real("day_low").default(0),
  openPrice: real("open_price").default(0),
  previousClose: real("previous_close").default(0),
  volume: real("volume").default(0),
  avgVolume: real("avg_volume").default(0),
  week52Low: real("week_52_low").default(0),
  week52High: real("week_52_high").default(0),
  ma50: real("ma_50").default(0),
  ma200: real("ma_200").default(0),
  changeFromMa50: real("change_from_ma_50").default(0),
  changeFromMa200: real("change_from_ma_200").default(0),
  peRatio: real("pe_ratio").default(0),
  pbRatio: real("pb_ratio").default(0),
  eps: real("eps").default(0),
  dividendYield: real("dividend_yield").default(0),
  dividendPerShare: real("dividend_per_share").default(0),
  beta: real("beta").default(1),
  shortRatio: real("short_ratio").default(0),
  bookValue: real("book_value").default(0),
  ebitda: real("ebitda_val").default(0),
  earningsDate: text("earnings_date"),
  stopLoss: real("stop_loss"),
  positionType: text("position_type").notNull().default("long"),
  goldenCross: boolean("golden_cross").default(false),
  daysSinceGoldenCross: integer("days_since_golden_cross").default(0),
  gainLossPercent: real("gain_loss_percent").default(0),
  gainLossDollar: real("gain_loss_dollar").default(0),
  positionValue: real("position_value").default(0),
  catalyst: text("catalyst"),
  sectorDriver: text("sector_driver"),
  comments: text("comments"),
});

export const macroIndicators = pgTable("macro_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: real("value").notNull().default(0),
  displayFormat: text("display_format").default("percent"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketIndices = pgTable("market_indices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  region: text("region").notNull(),
  ytdReturn: real("ytd_return").default(0),
  mtdReturn: real("mtd_return").default(0),
  currentValue: real("current_value").default(0),
});

export const portfolioRedFlags = pgTable("portfolio_red_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  answer: text("answer").notNull().default("No"),
  category: text("category").notNull().default("risk"),
});

export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => financialModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("base"),
  color: text("color").notNull().default("#3b82f6"),
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
  depreciationPercent: numeric("depreciation_percent").notNull().default("0.01"),
  taxRate: numeric("tax_rate").notNull().default("0.25"),
  capexPercent: numeric("capex_percent").notNull().default("0.05"),
  arPercent: numeric("ar_percent").notNull().default("0.15"),
  apPercent: numeric("ap_percent").notNull().default("0.15"),
  initialCash: numeric("initial_cash").notNull().default("100000"),
  monthlyBurnOverride: numeric("monthly_burn_override"),
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

export const insertFinancialModelSchema = createInsertSchema(financialModels).omit({ id: true, createdAt: true });
export const insertRevenueLineItemSchema = createInsertSchema(revenueLineItems).omit({ id: true });
export const insertRevenuePeriodSchema = createInsertSchema(revenuePeriods).omit({ id: true });
export const insertIncomeStatementLineSchema = createInsertSchema(incomeStatementLines).omit({ id: true });
export const insertBalanceSheetLineSchema = createInsertSchema(balanceSheetLines).omit({ id: true });
export const insertCashFlowLineSchema = createInsertSchema(cashFlowLines).omit({ id: true });
export const insertDcfValuationSchema = createInsertSchema(dcfValuations).omit({ id: true });
export const insertValuationComparisonSchema = createInsertSchema(valuationComparisons).omit({ id: true });
export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositions).omit({ id: true });
export const insertMacroIndicatorSchema = createInsertSchema(macroIndicators).omit({ id: true, updatedAt: true });
export const insertMarketIndexSchema = createInsertSchema(marketIndices).omit({ id: true });
export const insertPortfolioRedFlagSchema = createInsertSchema(portfolioRedFlags).omit({ id: true });
export const insertAssumptionsSchema = createInsertSchema(assumptions).omit({ id: true });
export const insertScenarioSchema = createInsertSchema(scenarios).omit({ id: true });
export const insertActualsSchema = createInsertSchema(actuals).omit({ id: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });

export type FinancialModel = typeof financialModels.$inferSelect;
export type InsertFinancialModel = z.infer<typeof insertFinancialModelSchema>;
export type RevenueLineItem = typeof revenueLineItems.$inferSelect;
export type InsertRevenueLineItem = z.infer<typeof insertRevenueLineItemSchema>;
export type RevenuePeriod = typeof revenuePeriods.$inferSelect;
export type InsertRevenuePeriod = z.infer<typeof insertRevenuePeriodSchema>;
export type IncomeStatementLine = typeof incomeStatementLines.$inferSelect;
export type InsertIncomeStatementLine = z.infer<typeof insertIncomeStatementLineSchema>;
export type BalanceSheetLine = typeof balanceSheetLines.$inferSelect;
export type InsertBalanceSheetLine = z.infer<typeof insertBalanceSheetLineSchema>;
export type CashFlowLine = typeof cashFlowLines.$inferSelect;
export type InsertCashFlowLine = z.infer<typeof insertCashFlowLineSchema>;
export type DcfValuation = typeof dcfValuations.$inferSelect;
export type InsertDcfValuation = z.infer<typeof insertDcfValuationSchema>;
export type ValuationComparison = typeof valuationComparisons.$inferSelect;
export type InsertValuationComparison = z.infer<typeof insertValuationComparisonSchema>;
export type PortfolioPosition = typeof portfolioPositions.$inferSelect;
export type InsertPortfolioPosition = z.infer<typeof insertPortfolioPositionSchema>;
export type MacroIndicator = typeof macroIndicators.$inferSelect;
export type InsertMacroIndicator = z.infer<typeof insertMacroIndicatorSchema>;
export type MarketIndex = typeof marketIndices.$inferSelect;
export type InsertMarketIndex = z.infer<typeof insertMarketIndexSchema>;
export type PortfolioRedFlag = typeof portfolioRedFlags.$inferSelect;
export type InsertPortfolioRedFlag = z.infer<typeof insertPortfolioRedFlagSchema>;
export type Assumptions = typeof assumptions.$inferSelect;
export type InsertAssumptions = z.infer<typeof insertAssumptionsSchema>;
export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Actual = typeof actuals.$inferSelect;
export type InsertActual = z.infer<typeof insertActualsSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
