import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  financialModels, revenueLineItems, revenuePeriods,
  incomeStatementLines, balanceSheetLines, cashFlowLines,
  dcfValuations, valuationComparisons, portfolioPositions,
  macroIndicators, marketIndices, portfolioRedFlags,
  scenarios, assumptions, actuals, reports,
  type FinancialModel, type InsertFinancialModel,
  type RevenueLineItem, type InsertRevenueLineItem,
  type RevenuePeriod, type InsertRevenuePeriod,
  type IncomeStatementLine, type InsertIncomeStatementLine,
  type BalanceSheetLine, type InsertBalanceSheetLine,
  type CashFlowLine, type InsertCashFlowLine,
  type DcfValuation, type InsertDcfValuation,
  type ValuationComparison, type InsertValuationComparison,
  type PortfolioPosition, type InsertPortfolioPosition,
  type MacroIndicator, type InsertMacroIndicator,
  type MarketIndex, type InsertMarketIndex,
  type PortfolioRedFlag, type InsertPortfolioRedFlag,
  type Scenario, type InsertScenario,
  type Assumptions, type InsertAssumptions,
  type Actual, type InsertActual,
  type Report, type InsertReport,
} from "@shared/schema";

export interface IStorage {
  getModels(): Promise<FinancialModel[]>;
  getModel(id: string): Promise<FinancialModel | undefined>;
  createModel(data: InsertFinancialModel): Promise<FinancialModel>;
  updateModel(id: string, data: Partial<InsertFinancialModel>): Promise<FinancialModel>;
  deleteModel(id: string): Promise<void>;

  getRevenueLineItems(modelId: string): Promise<RevenueLineItem[]>;
  createRevenueLineItem(data: InsertRevenueLineItem): Promise<RevenueLineItem>;
  updateRevenueLineItem(id: string, data: Partial<InsertRevenueLineItem>): Promise<RevenueLineItem>;
  deleteRevenueLineItem(id: string): Promise<void>;

  getRevenuePeriods(modelId: string): Promise<RevenuePeriod[]>;
  createRevenuePeriod(data: InsertRevenuePeriod): Promise<RevenuePeriod>;
  updateRevenuePeriod(id: string, data: Partial<InsertRevenuePeriod>): Promise<RevenuePeriod>;
  upsertRevenuePeriods(data: InsertRevenuePeriod[]): Promise<RevenuePeriod[]>;

  getIncomeStatementLines(modelId: string): Promise<IncomeStatementLine[]>;
  upsertIncomeStatementLine(data: InsertIncomeStatementLine): Promise<IncomeStatementLine>;
  deleteIncomeStatementLines(modelId: string): Promise<void>;

  getBalanceSheetLines(modelId: string): Promise<BalanceSheetLine[]>;
  upsertBalanceSheetLine(data: InsertBalanceSheetLine): Promise<BalanceSheetLine>;
  deleteBalanceSheetLines(modelId: string): Promise<void>;

  getCashFlowLines(modelId: string): Promise<CashFlowLine[]>;
  upsertCashFlowLine(data: InsertCashFlowLine): Promise<CashFlowLine>;
  deleteCashFlowLines(modelId: string): Promise<void>;

  getDcfValuation(modelId: string): Promise<DcfValuation | undefined>;
  upsertDcfValuation(data: InsertDcfValuation): Promise<DcfValuation>;

  getValuationComparison(modelId: string): Promise<ValuationComparison | undefined>;
  upsertValuationComparison(data: InsertValuationComparison): Promise<ValuationComparison>;

  getPortfolioPositions(): Promise<PortfolioPosition[]>;
  createPortfolioPosition(data: InsertPortfolioPosition): Promise<PortfolioPosition>;
  updatePortfolioPosition(id: string, data: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition>;
  deletePortfolioPosition(id: string): Promise<void>;

  getMacroIndicators(): Promise<MacroIndicator[]>;
  upsertMacroIndicator(data: InsertMacroIndicator): Promise<MacroIndicator>;

  getMarketIndices(): Promise<MarketIndex[]>;
  upsertMarketIndex(data: InsertMarketIndex): Promise<MarketIndex>;

  getPortfolioRedFlags(): Promise<PortfolioRedFlag[]>;
  upsertPortfolioRedFlag(data: InsertPortfolioRedFlag): Promise<PortfolioRedFlag>;

  getScenarios(modelId: string): Promise<Scenario[]>;
  createScenario(data: InsertScenario): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;

  getAssumptions(modelId: string): Promise<Assumptions[]>;
  createAssumptions(data: InsertAssumptions): Promise<Assumptions>;
  updateAssumptions(id: string, data: Partial<InsertAssumptions>): Promise<Assumptions>;

  getActuals(modelId: string): Promise<Actual[]>;
  createActual(data: InsertActual): Promise<Actual>;
  deleteActual(id: string): Promise<void>;

  getReports(modelId: string): Promise<Report[]>;
  createReport(data: InsertReport): Promise<Report>;
  deleteReport(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getModels() {
    return db.select().from(financialModels);
  }

  async getModel(id: string) {
    const [model] = await db.select().from(financialModels).where(eq(financialModels.id, id));
    return model;
  }

  async createModel(data: InsertFinancialModel) {
    const [model] = await db.insert(financialModels).values(data).returning();
    return model;
  }

  async updateModel(id: string, data: Partial<InsertFinancialModel>) {
    const [model] = await db.update(financialModels).set(data).where(eq(financialModels.id, id)).returning();
    return model;
  }

  async deleteModel(id: string) {
    await db.delete(financialModels).where(eq(financialModels.id, id));
  }

  async getRevenueLineItems(modelId: string) {
    return db.select().from(revenueLineItems).where(eq(revenueLineItems.modelId, modelId));
  }

  async createRevenueLineItem(data: InsertRevenueLineItem) {
    const [item] = await db.insert(revenueLineItems).values(data).returning();
    return item;
  }

  async updateRevenueLineItem(id: string, data: Partial<InsertRevenueLineItem>) {
    const [item] = await db.update(revenueLineItems).set(data).where(eq(revenueLineItems.id, id)).returning();
    return item;
  }

  async deleteRevenueLineItem(id: string) {
    await db.delete(revenueLineItems).where(eq(revenueLineItems.id, id));
  }

  async getRevenuePeriods(modelId: string) {
    return db.select().from(revenuePeriods).where(eq(revenuePeriods.modelId, modelId));
  }

  async createRevenuePeriod(data: InsertRevenuePeriod) {
    const [period] = await db.insert(revenuePeriods).values(data).returning();
    return period;
  }

  async updateRevenuePeriod(id: string, data: Partial<InsertRevenuePeriod>) {
    const [period] = await db.update(revenuePeriods).set(data).where(eq(revenuePeriods.id, id)).returning();
    return period;
  }

  async upsertRevenuePeriods(data: InsertRevenuePeriod[]) {
    const results: RevenuePeriod[] = [];
    for (const d of data) {
      const existing = await db.select().from(revenuePeriods).where(
        eq(revenuePeriods.lineItemId, d.lineItemId)
      );
      const match = existing.find(e => e.year === d.year && e.quarter === d.quarter);
      if (match) {
        const [updated] = await db.update(revenuePeriods)
          .set({ amount: d.amount, isActual: d.isActual })
          .where(eq(revenuePeriods.id, match.id))
          .returning();
        results.push(updated);
      } else {
        const [period] = await db.insert(revenuePeriods).values(d).returning();
        results.push(period);
      }
    }
    return results;
  }

  async getIncomeStatementLines(modelId: string) {
    return db.select().from(incomeStatementLines).where(eq(incomeStatementLines.modelId, modelId));
  }

  async upsertIncomeStatementLine(data: InsertIncomeStatementLine) {
    const [line] = await db.insert(incomeStatementLines).values(data).returning();
    return line;
  }

  async deleteIncomeStatementLines(modelId: string) {
    await db.delete(incomeStatementLines).where(eq(incomeStatementLines.modelId, modelId));
  }

  async getBalanceSheetLines(modelId: string) {
    return db.select().from(balanceSheetLines).where(eq(balanceSheetLines.modelId, modelId));
  }

  async upsertBalanceSheetLine(data: InsertBalanceSheetLine) {
    const [line] = await db.insert(balanceSheetLines).values(data).returning();
    return line;
  }

  async deleteBalanceSheetLines(modelId: string) {
    await db.delete(balanceSheetLines).where(eq(balanceSheetLines.modelId, modelId));
  }

  async getCashFlowLines(modelId: string) {
    return db.select().from(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));
  }

  async upsertCashFlowLine(data: InsertCashFlowLine) {
    const [line] = await db.insert(cashFlowLines).values(data).returning();
    return line;
  }

  async deleteCashFlowLines(modelId: string) {
    await db.delete(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));
  }

  async getDcfValuation(modelId: string) {
    const [val] = await db.select().from(dcfValuations).where(eq(dcfValuations.modelId, modelId));
    return val;
  }

  async upsertDcfValuation(data: InsertDcfValuation) {
    const existing = await this.getDcfValuation(data.modelId);
    if (existing) {
      const [val] = await db.update(dcfValuations).set(data).where(eq(dcfValuations.modelId, data.modelId)).returning();
      return val;
    }
    const [val] = await db.insert(dcfValuations).values(data).returning();
    return val;
  }

  async getValuationComparison(modelId: string) {
    const [val] = await db.select().from(valuationComparisons).where(eq(valuationComparisons.modelId, modelId));
    return val;
  }

  async upsertValuationComparison(data: InsertValuationComparison) {
    const existing = await this.getValuationComparison(data.modelId);
    if (existing) {
      const [val] = await db.update(valuationComparisons).set(data).where(eq(valuationComparisons.modelId, data.modelId)).returning();
      return val;
    }
    const [val] = await db.insert(valuationComparisons).values(data).returning();
    return val;
  }

  async getPortfolioPositions() {
    return db.select().from(portfolioPositions);
  }

  async createPortfolioPosition(data: InsertPortfolioPosition) {
    const [pos] = await db.insert(portfolioPositions).values(data).returning();
    return pos;
  }

  async updatePortfolioPosition(id: string, data: Partial<InsertPortfolioPosition>) {
    const [pos] = await db.update(portfolioPositions).set(data).where(eq(portfolioPositions.id, id)).returning();
    return pos;
  }

  async deletePortfolioPosition(id: string) {
    await db.delete(portfolioPositions).where(eq(portfolioPositions.id, id));
  }

  async getMacroIndicators() {
    return db.select().from(macroIndicators);
  }

  async upsertMacroIndicator(data: InsertMacroIndicator) {
    const [ind] = await db.insert(macroIndicators).values(data).returning();
    return ind;
  }

  async getMarketIndices() {
    return db.select().from(marketIndices);
  }

  async upsertMarketIndex(data: InsertMarketIndex) {
    const [idx] = await db.insert(marketIndices).values(data).returning();
    return idx;
  }

  async getPortfolioRedFlags() {
    return db.select().from(portfolioRedFlags);
  }

  async upsertPortfolioRedFlag(data: InsertPortfolioRedFlag) {
    const [flag] = await db.insert(portfolioRedFlags).values(data).returning();
    return flag;
  }

  async getScenarios(modelId: string) {
    return db.select().from(scenarios).where(eq(scenarios.modelId, modelId));
  }

  async createScenario(data: InsertScenario) {
    const [s] = await db.insert(scenarios).values(data).returning();
    return s;
  }

  async deleteScenario(id: string) {
    await db.delete(scenarios).where(eq(scenarios.id, id));
  }

  async getAssumptions(modelId: string) {
    return db.select().from(assumptions).where(eq(assumptions.modelId, modelId));
  }

  async createAssumptions(data: InsertAssumptions) {
    const [a] = await db.insert(assumptions).values(data).returning();
    return a;
  }

  async updateAssumptions(id: string, data: Partial<InsertAssumptions>) {
    const [a] = await db.update(assumptions).set(data).where(eq(assumptions.id, id)).returning();
    return a;
  }

  async getActuals(modelId: string) {
    return db.select().from(actuals).where(eq(actuals.modelId, modelId));
  }

  async createActual(data: InsertActual) {
    const [a] = await db.insert(actuals).values(data).returning();
    return a;
  }

  async deleteActual(id: string) {
    await db.delete(actuals).where(eq(actuals.id, id));
  }

  async getReports(modelId: string) {
    return db.select().from(reports).where(eq(reports.modelId, modelId));
  }

  async createReport(data: InsertReport) {
    const [r] = await db.insert(reports).values(data).returning();
    return r;
  }

  async deleteReport(id: string) {
    await db.delete(reports).where(eq(reports.id, id));
  }
}

export const storage = new DatabaseStorage();
