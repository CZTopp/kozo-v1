import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, jsonb, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const financialModels = pgTable("financial_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ticker: text("ticker"),
  description: text("description"),
  currency: text("currency").notNull().default("USD"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  sharesOutstanding: real("shares_outstanding").default(0),
  growthDecayRate: real("growth_decay_rate").default(0),
  targetNetMargin: real("target_net_margin"),
  scenarioBullMultiplier: real("scenario_bull_multiplier").default(1.2),
  scenarioBaseMultiplier: real("scenario_base_multiplier").default(1.0),
  scenarioBearMultiplier: real("scenario_bear_multiplier").default(0.8),
  displayUnit: text("display_unit").notNull().default("ones"),
  modelMode: text("model_mode").notNull().default("ipo"),
  userId: text("user_id"),
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
  isCrypto: boolean("is_crypto").default(false),
  catalyst: text("catalyst"),
  sectorDriver: text("sector_driver"),
  comments: text("comments"),
  userId: text("user_id"),
});

export const portfolioLots = pgTable("portfolio_lots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  positionId: varchar("position_id").notNull().references(() => portfolioPositions.id, { onDelete: "cascade" }),
  sharesHeld: real("shares_held").notNull().default(0),
  purchasePrice: real("purchase_price").notNull().default(0),
  purchaseDate: text("purchase_date"),
  notes: text("notes"),
});

export const macroIndicators = pgTable("macro_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: real("value").notNull().default(0),
  priorValue: real("prior_value"),
  displayFormat: text("display_format").default("percent"),
  userId: text("user_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketIndices = pgTable("market_indices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  region: text("region").notNull(),
  ytdReturn: real("ytd_return").default(0),
  mtdReturn: real("mtd_return").default(0),
  dailyChangePercent: real("daily_change_percent").default(0),
  currentValue: real("current_value").default(0),
  userId: text("user_id"),
});

export const portfolioRedFlags = pgTable("portfolio_red_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  answer: text("answer").notNull().default("No"),
  category: text("category").notNull().default("risk"),
  userId: text("user_id"),
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

export const cryptoProjects = pgTable("crypto_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coingeckoId: text("coingecko_id").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  category: text("category"),
  currentPrice: real("current_price").default(0),
  marketCap: real("market_cap").default(0),
  fullyDilutedValuation: real("fully_diluted_valuation").default(0),
  volume24h: real("volume_24h").default(0),
  priceChange24h: real("price_change_24h").default(0),
  priceChange7d: real("price_change_7d").default(0),
  circulatingSupply: real("circulating_supply").default(0),
  totalSupply: real("total_supply"),
  maxSupply: real("max_supply"),
  ath: real("ath").default(0),
  athDate: text("ath_date"),
  sparklineData: jsonb("sparkline_data"),
  image: text("image"),
  defiLlamaId: text("defi_llama_id"),
  userId: text("user_id"),
  discountRate: real("discount_rate").default(0.15),
  feeGrowthRate: real("fee_growth_rate").default(0.10),
  terminalGrowthRate: real("terminal_growth_rate").default(0.02),
  projectionYears: integer("projection_years").default(5),
  governanceType: text("governance_type"),
  votingMechanism: text("voting_mechanism"),
  treasurySize: real("treasury_size"),
  treasuryCurrency: text("treasury_currency"),
  governanceNotes: text("governance_notes"),
  whitepaper: text("whitepaper"),
  cachedOnchainData: jsonb("cached_onchain_data"),
  onchainDataFetchedAt: timestamp("onchain_data_fetched_at"),
  cachedDefiData: jsonb("cached_defi_data"),
  defiDataFetchedAt: timestamp("defi_data_fetched_at"),
  chainId: text("chain_id"),
  contractAddress: text("contract_address"),
  stakingContract: text("staking_contract"),
  notes: text("notes"),
  dataSources: text("data_sources").array(),
  sortOrder: integer("sort_order").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tokenSupplySchedules = pgTable("token_supply_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  label: text("label").notNull(),
  date: text("date"),
  amount: real("amount").notNull().default(0),
  isRecurring: boolean("is_recurring").default(false),
  recurringIntervalMonths: integer("recurring_interval_months"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
});

export const tokenIncentives = pgTable("token_incentives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  contribution: text("contribution").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardSource: text("reward_source").notNull(),
  allocationPercent: real("allocation_percent").default(0),
  estimatedApy: real("estimated_apy"),
  vestingMonths: integer("vesting_months"),
  isSustainable: boolean("is_sustainable").default(true),
  sustainabilityNotes: text("sustainability_notes"),
  sortOrder: integer("sort_order").default(0),
});

export const protocolMetrics = pgTable("protocol_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  tvl: real("tvl").default(0),
  dailyFees: real("daily_fees").default(0),
  dailyRevenue: real("daily_revenue").default(0),
  dailyVolume: real("daily_volume").default(0),
});

export const protocolRevenueForecasts = pgTable("protocol_revenue_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  projectedFees: real("projected_fees").default(0),
  projectedRevenue: real("projected_revenue").default(0),
  growthRate: real("growth_rate").default(0),
  takeRate: real("take_rate").default(0),
  emissionCost: real("emission_cost").default(0),
  netValueAccrual: real("net_value_accrual").default(0),
  scenario: text("scenario").notNull().default("base"),
});

export const tokenFlowEntries = pgTable("token_flow_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  period: integer("period").notNull(),
  periodLabel: text("period_label").notNull(),
  minting: real("minting").default(0),
  unlocks: real("unlocks").default(0),
  burns: real("burns").default(0),
  buybacks: real("buybacks").default(0),
  stakingLockups: real("staking_lockups").default(0),
  netFlow: real("net_flow").default(0),
  cumulativeSupply: real("cumulative_supply").default(0),
});

export const tokenAllocations = pgTable("token_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  standardGroup: text("standard_group"),
  percentage: real("percentage").notNull().default(0),
  amount: real("amount"),
  vestingMonths: integer("vesting_months"),
  cliffMonths: integer("cliff_months"),
  tgePercent: real("tge_percent"),
  vestingType: text("vesting_type"),
  dataSource: text("data_source"),
  releasedPercent: real("released_percent"),
  releasedAmount: real("released_amount"),
  precision: text("precision"),
  assumption: text("assumption"),
  references: text("references"),
  description: text("description"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
});

export const fundraisingRounds = pgTable("fundraising_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => cryptoProjects.id, { onDelete: "cascade" }),
  roundType: text("round_type").notNull(),
  amount: real("amount"),
  valuation: real("valuation"),
  date: text("date"),
  leadInvestors: text("lead_investors"),
  tokenPrice: real("token_price"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
});

export const insertFinancialModelSchema = createInsertSchema(financialModels, {
  sharesOutstanding: z.number().min(0).max(100000000000).optional(),
}).omit({ id: true, createdAt: true });
export const insertRevenueLineItemSchema = createInsertSchema(revenueLineItems).omit({ id: true });
export const insertRevenuePeriodSchema = createInsertSchema(revenuePeriods).omit({ id: true });
export const insertIncomeStatementLineSchema = createInsertSchema(incomeStatementLines).omit({ id: true });
export const insertBalanceSheetLineSchema = createInsertSchema(balanceSheetLines).omit({ id: true });
export const insertCashFlowLineSchema = createInsertSchema(cashFlowLines).omit({ id: true });
export const insertDcfValuationSchema = createInsertSchema(dcfValuations).omit({ id: true });
export const insertValuationComparisonSchema = createInsertSchema(valuationComparisons).omit({ id: true });
export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositions, {
  marketCap: z.number().optional(),
  volume: z.number().optional(),
  avgVolume: z.number().optional(),
  positionValue: z.number().optional(),
  gainLossDollar: z.number().optional(),
  ebitda: z.number().optional(),
}).omit({ id: true });
export const insertPortfolioLotSchema = createInsertSchema(portfolioLots).omit({ id: true });
export const insertMacroIndicatorSchema = createInsertSchema(macroIndicators).omit({ id: true, updatedAt: true });
export const insertMarketIndexSchema = createInsertSchema(marketIndices).omit({ id: true });
export const insertPortfolioRedFlagSchema = createInsertSchema(portfolioRedFlags).omit({ id: true });
export const insertAssumptionsSchema = createInsertSchema(assumptions).omit({ id: true });
export const insertScenarioSchema = createInsertSchema(scenarios).omit({ id: true });
export const insertActualsSchema = createInsertSchema(actuals).omit({ id: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });
export const insertCryptoProjectSchema = createInsertSchema(cryptoProjects).omit({ id: true, updatedAt: true });
export const insertTokenSupplyScheduleSchema = createInsertSchema(tokenSupplySchedules).omit({ id: true });
export const insertTokenIncentiveSchema = createInsertSchema(tokenIncentives).omit({ id: true });
export const insertProtocolMetricSchema = createInsertSchema(protocolMetrics).omit({ id: true });
export const insertProtocolRevenueForecastSchema = createInsertSchema(protocolRevenueForecasts).omit({ id: true });
export const insertTokenFlowEntrySchema = createInsertSchema(tokenFlowEntries).omit({ id: true });
export const insertTokenAllocationSchema = createInsertSchema(tokenAllocations).omit({ id: true });
export const insertFundraisingRoundSchema = createInsertSchema(fundraisingRounds).omit({ id: true });

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  billingCycle: text("billing_cycle"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  aiCallsUsed: integer("ai_calls_used").notNull().default(0),
  pdfParsesUsed: integer("pdf_parses_used").notNull().default(0),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });

export const emissionsCache = pgTable("emissions_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  coingeckoId: text("coingecko_id").notNull().unique(),
  category: text("category"),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmissionsCacheSchema = createInsertSchema(emissionsCache).omit({ id: true });

export const aiResearchCache = pgTable("ai_research_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  coingeckoId: text("coingecko_id").notNull(),
  researchType: text("research_type").notNull(),
  data: jsonb("data").notNull(),
  confidence: text("confidence"),
  notes: text("notes"),
  researchedAt: timestamp("researched_at").defaultNow().notNull(),
});

export const insertAiResearchCacheSchema = createInsertSchema(aiResearchCache).omit({ id: true, researchedAt: true });

export const defillamaCache = pgTable("defillama_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  protocolId: text("protocol_id").notNull(),
  metricType: text("metric_type").notNull(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("defillama_cache_protocol_metric_idx").on(table.protocolId, table.metricType),
]);

export const insertDefillamaCacheSchema = createInsertSchema(defillamaCache).omit({ id: true, fetchedAt: true });

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
export type PortfolioLot = typeof portfolioLots.$inferSelect;
export type InsertPortfolioLot = z.infer<typeof insertPortfolioLotSchema>;
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
export type CryptoProject = typeof cryptoProjects.$inferSelect;
export type InsertCryptoProject = z.infer<typeof insertCryptoProjectSchema>;
export type TokenSupplySchedule = typeof tokenSupplySchedules.$inferSelect;
export type InsertTokenSupplySchedule = z.infer<typeof insertTokenSupplyScheduleSchema>;
export type TokenIncentive = typeof tokenIncentives.$inferSelect;
export type InsertTokenIncentive = z.infer<typeof insertTokenIncentiveSchema>;
export type ProtocolMetric = typeof protocolMetrics.$inferSelect;
export type InsertProtocolMetric = z.infer<typeof insertProtocolMetricSchema>;
export type ProtocolRevenueForecast = typeof protocolRevenueForecasts.$inferSelect;
export type InsertProtocolRevenueForecast = z.infer<typeof insertProtocolRevenueForecastSchema>;
export type TokenFlowEntry = typeof tokenFlowEntries.$inferSelect;
export type InsertTokenFlowEntry = z.infer<typeof insertTokenFlowEntrySchema>;
export type TokenAllocation = typeof tokenAllocations.$inferSelect;
export type InsertTokenAllocation = z.infer<typeof insertTokenAllocationSchema>;
export type FundraisingRound = typeof fundraisingRounds.$inferSelect;
export type InsertFundraisingRound = z.infer<typeof insertFundraisingRoundSchema>;
export type EmissionsCache = typeof emissionsCache.$inferSelect;
export type InsertEmissionsCache = z.infer<typeof insertEmissionsCacheSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type AiResearchCache = typeof aiResearchCache.$inferSelect;
export type InsertAiResearchCache = z.infer<typeof insertAiResearchCacheSchema>;
export type DefillamaCache = typeof defillamaCache.$inferSelect;
export type InsertDefillamaCache = z.infer<typeof insertDefillamaCacheSchema>;
