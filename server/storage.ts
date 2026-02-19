import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  financialModels, revenueLineItems, revenuePeriods,
  incomeStatementLines, balanceSheetLines, cashFlowLines,
  dcfValuations, valuationComparisons, portfolioPositions, portfolioLots,
  macroIndicators, marketIndices, portfolioRedFlags,
  scenarios, assumptions, actuals, reports,
  cryptoProjects, tokenSupplySchedules, tokenIncentives, protocolMetrics,
  protocolRevenueForecasts, tokenFlowEntries,
  type FinancialModel, type InsertFinancialModel,
  type RevenueLineItem, type InsertRevenueLineItem,
  type RevenuePeriod, type InsertRevenuePeriod,
  type IncomeStatementLine, type InsertIncomeStatementLine,
  type BalanceSheetLine, type InsertBalanceSheetLine,
  type CashFlowLine, type InsertCashFlowLine,
  type DcfValuation, type InsertDcfValuation,
  type ValuationComparison, type InsertValuationComparison,
  type PortfolioPosition, type InsertPortfolioPosition,
  type PortfolioLot, type InsertPortfolioLot,
  type MacroIndicator, type InsertMacroIndicator,
  type MarketIndex, type InsertMarketIndex,
  type PortfolioRedFlag, type InsertPortfolioRedFlag,
  type Scenario, type InsertScenario,
  type Assumptions, type InsertAssumptions,
  type Actual, type InsertActual,
  type Report, type InsertReport,
  type CryptoProject, type InsertCryptoProject,
  type TokenSupplySchedule, type InsertTokenSupplySchedule,
  type TokenIncentive, type InsertTokenIncentive,
  type ProtocolMetric, type InsertProtocolMetric,
  type ProtocolRevenueForecast, type InsertProtocolRevenueForecast,
  type TokenFlowEntry, type InsertTokenFlowEntry,
} from "@shared/schema";

export interface IStorage {
  getModels(userId: string): Promise<FinancialModel[]>;
  getModel(id: string, userId: string): Promise<FinancialModel | undefined>;
  createModel(data: InsertFinancialModel): Promise<FinancialModel>;
  updateModel(id: string, userId: string, data: Partial<InsertFinancialModel>): Promise<FinancialModel>;
  deleteModel(id: string, userId: string): Promise<void>;

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
  updateBalanceSheetLineByYear(modelId: string, year: number, data: Partial<InsertBalanceSheetLine>): Promise<BalanceSheetLine>;
  deleteBalanceSheetLines(modelId: string): Promise<void>;

  getCashFlowLines(modelId: string): Promise<CashFlowLine[]>;
  upsertCashFlowLine(data: InsertCashFlowLine): Promise<CashFlowLine>;
  updateCashFlowLineByYear(modelId: string, year: number, data: Partial<InsertCashFlowLine>): Promise<CashFlowLine>;
  deleteCashFlowLines(modelId: string): Promise<void>;

  updateIncomeStatementLineByYear(modelId: string, year: number, data: Partial<InsertIncomeStatementLine>): Promise<IncomeStatementLine>;

  getDcfValuation(modelId: string): Promise<DcfValuation | undefined>;
  upsertDcfValuation(data: InsertDcfValuation): Promise<DcfValuation>;

  getValuationComparison(modelId: string): Promise<ValuationComparison | undefined>;
  upsertValuationComparison(data: InsertValuationComparison): Promise<ValuationComparison>;

  getPortfolioPositions(userId: string): Promise<PortfolioPosition[]>;
  createPortfolioPosition(data: InsertPortfolioPosition): Promise<PortfolioPosition>;
  updatePortfolioPosition(id: string, userId: string, data: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition>;
  deletePortfolioPosition(id: string, userId: string): Promise<void>;

  getPortfolioLots(positionId: string): Promise<PortfolioLot[]>;
  getAllPortfolioLots(): Promise<PortfolioLot[]>;
  createPortfolioLot(data: InsertPortfolioLot): Promise<PortfolioLot>;
  updatePortfolioLot(id: string, data: Partial<InsertPortfolioLot>): Promise<PortfolioLot>;
  deletePortfolioLot(id: string): Promise<void>;
  recomputePositionFromLots(positionId: string): Promise<PortfolioPosition>;

  getMacroIndicators(userId: string): Promise<MacroIndicator[]>;
  upsertMacroIndicator(data: InsertMacroIndicator): Promise<MacroIndicator>;
  replaceAllMacroIndicators(data: InsertMacroIndicator[], userId: string): Promise<MacroIndicator[]>;
  deleteMacroIndicator(id: string, userId: string): Promise<void>;

  getMarketIndices(userId: string): Promise<MarketIndex[]>;
  upsertMarketIndex(data: InsertMarketIndex): Promise<MarketIndex>;
  replaceAllMarketIndices(data: InsertMarketIndex[], userId: string): Promise<MarketIndex[]>;
  deleteMarketIndex(id: string, userId: string): Promise<void>;

  getPortfolioRedFlags(userId: string): Promise<PortfolioRedFlag[]>;
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

  getCryptoProjects(userId: string): Promise<CryptoProject[]>;
  getCryptoProject(id: string, userId: string): Promise<CryptoProject | undefined>;
  createCryptoProject(data: InsertCryptoProject): Promise<CryptoProject>;
  updateCryptoProject(id: string, userId: string, data: Partial<InsertCryptoProject>): Promise<CryptoProject>;
  deleteCryptoProject(id: string, userId: string): Promise<void>;

  getTokenSupplySchedules(projectId: string): Promise<TokenSupplySchedule[]>;
  createTokenSupplySchedule(data: InsertTokenSupplySchedule): Promise<TokenSupplySchedule>;
  updateTokenSupplySchedule(id: string, data: Partial<InsertTokenSupplySchedule>): Promise<TokenSupplySchedule>;
  deleteTokenSupplySchedule(id: string): Promise<void>;

  getTokenIncentives(projectId: string): Promise<TokenIncentive[]>;
  createTokenIncentive(data: InsertTokenIncentive): Promise<TokenIncentive>;
  updateTokenIncentive(id: string, data: Partial<InsertTokenIncentive>): Promise<TokenIncentive>;
  deleteTokenIncentive(id: string): Promise<void>;

  getProtocolMetrics(projectId: string): Promise<ProtocolMetric[]>;
  upsertProtocolMetrics(data: InsertProtocolMetric[]): Promise<ProtocolMetric[]>;
  deleteProtocolMetrics(projectId: string): Promise<void>;

  getRevenueForecasts(projectId: string, scenario?: string): Promise<ProtocolRevenueForecast[]>;
  upsertRevenueForecasts(data: InsertProtocolRevenueForecast[]): Promise<ProtocolRevenueForecast[]>;
  deleteRevenueForecasts(projectId: string, scenario?: string): Promise<void>;

  getTokenFlowEntries(projectId: string): Promise<TokenFlowEntry[]>;
  upsertTokenFlowEntries(data: InsertTokenFlowEntry[]): Promise<TokenFlowEntry[]>;
  deleteTokenFlowEntries(projectId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getModels(userId: string) {
    return db.select().from(financialModels).where(eq(financialModels.userId, userId));
  }

  async getModel(id: string, userId: string) {
    const [model] = await db.select().from(financialModels).where(and(eq(financialModels.id, id), eq(financialModels.userId, userId)));
    return model;
  }

  async createModel(data: InsertFinancialModel) {
    const [model] = await db.insert(financialModels).values(data).returning();
    return model;
  }

  async updateModel(id: string, userId: string, data: Partial<InsertFinancialModel>) {
    const [model] = await db.update(financialModels).set(data).where(and(eq(financialModels.id, id), eq(financialModels.userId, userId))).returning();
    return model;
  }

  async deleteModel(id: string, userId: string) {
    await db.delete(financialModels).where(and(eq(financialModels.id, id), eq(financialModels.userId, userId)));
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
    const existing = await db.select().from(incomeStatementLines).where(
      and(eq(incomeStatementLines.modelId, data.modelId), eq(incomeStatementLines.year, data.year))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(incomeStatementLines)
        .set(data)
        .where(eq(incomeStatementLines.id, existing[0].id))
        .returning();
      return updated;
    }
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
    const existing = await db.select().from(balanceSheetLines).where(
      and(eq(balanceSheetLines.modelId, data.modelId), eq(balanceSheetLines.year, data.year))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(balanceSheetLines)
        .set(data)
        .where(eq(balanceSheetLines.id, existing[0].id))
        .returning();
      return updated;
    }
    const [line] = await db.insert(balanceSheetLines).values(data).returning();
    return line;
  }

  async updateBalanceSheetLineByYear(modelId: string, year: number, data: Partial<InsertBalanceSheetLine>) {
    const [line] = await db.update(balanceSheetLines).set(data)
      .where(and(eq(balanceSheetLines.modelId, modelId), eq(balanceSheetLines.year, year)))
      .returning();
    return line;
  }

  async deleteBalanceSheetLines(modelId: string) {
    await db.delete(balanceSheetLines).where(eq(balanceSheetLines.modelId, modelId));
  }

  async getCashFlowLines(modelId: string) {
    return db.select().from(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));
  }

  async upsertCashFlowLine(data: InsertCashFlowLine) {
    const existing = await db.select().from(cashFlowLines).where(
      and(eq(cashFlowLines.modelId, data.modelId), eq(cashFlowLines.year, data.year))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(cashFlowLines)
        .set(data)
        .where(eq(cashFlowLines.id, existing[0].id))
        .returning();
      return updated;
    }
    const [line] = await db.insert(cashFlowLines).values(data).returning();
    return line;
  }

  async updateCashFlowLineByYear(modelId: string, year: number, data: Partial<InsertCashFlowLine>) {
    const [line] = await db.update(cashFlowLines).set(data)
      .where(and(eq(cashFlowLines.modelId, modelId), eq(cashFlowLines.year, year)))
      .returning();
    return line;
  }

  async deleteCashFlowLines(modelId: string) {
    await db.delete(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));
  }

  async updateIncomeStatementLineByYear(modelId: string, year: number, data: Partial<InsertIncomeStatementLine>) {
    const [line] = await db.update(incomeStatementLines).set(data)
      .where(and(eq(incomeStatementLines.modelId, modelId), eq(incomeStatementLines.year, year)))
      .returning();
    return line;
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

  async getPortfolioPositions(userId: string) {
    return db.select().from(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  }

  async createPortfolioPosition(data: InsertPortfolioPosition) {
    const [pos] = await db.insert(portfolioPositions).values(data).returning();
    return pos;
  }

  async updatePortfolioPosition(id: string, userId: string, data: Partial<InsertPortfolioPosition>) {
    const [pos] = await db.update(portfolioPositions).set(data).where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId))).returning();
    return pos;
  }

  async deletePortfolioPosition(id: string, userId: string) {
    await db.delete(portfolioPositions).where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  }

  async getPortfolioLots(positionId: string) {
    return db.select().from(portfolioLots).where(eq(portfolioLots.positionId, positionId));
  }

  async getAllPortfolioLots() {
    return db.select().from(portfolioLots);
  }

  async createPortfolioLot(data: InsertPortfolioLot) {
    const [lot] = await db.insert(portfolioLots).values(data).returning();
    return lot;
  }

  async updatePortfolioLot(id: string, data: Partial<InsertPortfolioLot>) {
    const [lot] = await db.update(portfolioLots).set(data).where(eq(portfolioLots.id, id)).returning();
    return lot;
  }

  async deletePortfolioLot(id: string) {
    await db.delete(portfolioLots).where(eq(portfolioLots.id, id));
  }

  async recomputePositionFromLots(positionId: string) {
    const lots = await this.getPortfolioLots(positionId);
    const totalShares = lots.reduce((sum, l) => sum + (l.sharesHeld || 0), 0);
    const totalCost = lots.reduce((sum, l) => sum + (l.sharesHeld || 0) * (l.purchasePrice || 0), 0);
    const weightedAvgPrice = totalShares > 0 ? totalCost / totalShares : 0;

    const position = await db.select().from(portfolioPositions).where(eq(portfolioPositions.id, positionId)).then(r => r[0]);
    if (!position) throw new Error("Position not found");

    const currentPrice = position.currentPrice || 0;
    const positionValue = totalShares * currentPrice;
    const costBasis = totalShares * weightedAvgPrice;
    const gainLossDollar = positionValue - costBasis;
    const gainLossPercent = costBasis > 0 ? gainLossDollar / costBasis : 0;

    const [updated] = await db.update(portfolioPositions).set({
      sharesHeld: totalShares,
      purchasePrice: weightedAvgPrice,
      positionValue,
      gainLossDollar,
      gainLossPercent,
    }).where(eq(portfolioPositions.id, positionId)).returning();
    return updated;
  }

  async getMacroIndicators(userId: string) {
    return db.select().from(macroIndicators).where(eq(macroIndicators.userId, userId));
  }

  async upsertMacroIndicator(data: InsertMacroIndicator) {
    const [ind] = await db.insert(macroIndicators).values(data).returning();
    return ind;
  }

  async replaceAllMacroIndicators(data: InsertMacroIndicator[], userId: string) {
    await db.delete(macroIndicators).where(eq(macroIndicators.userId, userId));
    if (data.length === 0) return [];
    const result = await db.insert(macroIndicators).values(data.map(d => ({ ...d, userId }))).returning();
    return result;
  }

  async deleteMacroIndicator(id: string, userId: string) {
    await db.delete(macroIndicators).where(and(eq(macroIndicators.id, id), eq(macroIndicators.userId, userId)));
  }

  async getMarketIndices(userId: string) {
    return db.select().from(marketIndices).where(eq(marketIndices.userId, userId));
  }

  async upsertMarketIndex(data: InsertMarketIndex) {
    const [idx] = await db.insert(marketIndices).values(data).returning();
    return idx;
  }

  async replaceAllMarketIndices(data: InsertMarketIndex[], userId: string) {
    await db.delete(marketIndices).where(eq(marketIndices.userId, userId));
    if (data.length === 0) return [];
    const result = await db.insert(marketIndices).values(data.map(d => ({ ...d, userId }))).returning();
    return result;
  }

  async deleteMarketIndex(id: string, userId: string) {
    await db.delete(marketIndices).where(and(eq(marketIndices.id, id), eq(marketIndices.userId, userId)));
  }

  async getPortfolioRedFlags(userId: string) {
    return db.select().from(portfolioRedFlags).where(eq(portfolioRedFlags.userId, userId));
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

  async getCryptoProjects(userId: string) {
    return db.select().from(cryptoProjects).where(eq(cryptoProjects.userId, userId));
  }

  async getCryptoProject(id: string, userId: string) {
    const [project] = await db.select().from(cryptoProjects).where(and(eq(cryptoProjects.id, id), eq(cryptoProjects.userId, userId)));
    return project;
  }

  async createCryptoProject(data: InsertCryptoProject) {
    const [project] = await db.insert(cryptoProjects).values(data).returning();
    return project;
  }

  async updateCryptoProject(id: string, userId: string, data: Partial<InsertCryptoProject>) {
    const [project] = await db.update(cryptoProjects).set(data).where(and(eq(cryptoProjects.id, id), eq(cryptoProjects.userId, userId))).returning();
    return project;
  }

  async deleteCryptoProject(id: string, userId: string) {
    await db.delete(cryptoProjects).where(and(eq(cryptoProjects.id, id), eq(cryptoProjects.userId, userId)));
  }

  async getTokenSupplySchedules(projectId: string) {
    return db.select().from(tokenSupplySchedules).where(eq(tokenSupplySchedules.projectId, projectId));
  }

  async createTokenSupplySchedule(data: InsertTokenSupplySchedule) {
    const [schedule] = await db.insert(tokenSupplySchedules).values(data).returning();
    return schedule;
  }

  async updateTokenSupplySchedule(id: string, data: Partial<InsertTokenSupplySchedule>) {
    const [schedule] = await db.update(tokenSupplySchedules).set(data).where(eq(tokenSupplySchedules.id, id)).returning();
    return schedule;
  }

  async deleteTokenSupplySchedule(id: string) {
    await db.delete(tokenSupplySchedules).where(eq(tokenSupplySchedules.id, id));
  }

  async getTokenIncentives(projectId: string) {
    return db.select().from(tokenIncentives).where(eq(tokenIncentives.projectId, projectId));
  }

  async createTokenIncentive(data: InsertTokenIncentive) {
    const [incentive] = await db.insert(tokenIncentives).values(data).returning();
    return incentive;
  }

  async updateTokenIncentive(id: string, data: Partial<InsertTokenIncentive>) {
    const [incentive] = await db.update(tokenIncentives).set(data).where(eq(tokenIncentives.id, id)).returning();
    return incentive;
  }

  async deleteTokenIncentive(id: string) {
    await db.delete(tokenIncentives).where(eq(tokenIncentives.id, id));
  }

  async getProtocolMetrics(projectId: string) {
    return db.select().from(protocolMetrics).where(eq(protocolMetrics.projectId, projectId));
  }

  async upsertProtocolMetrics(data: InsertProtocolMetric[]) {
    if (data.length === 0) return [];
    const CHUNK_SIZE = 500;
    const results: ProtocolMetric[] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const inserted = await db.insert(protocolMetrics).values(chunk).returning();
      results.push(...inserted);
    }
    return results;
  }

  async deleteProtocolMetrics(projectId: string) {
    await db.delete(protocolMetrics).where(eq(protocolMetrics.projectId, projectId));
  }

  async getRevenueForecasts(projectId: string, scenario?: string) {
    if (scenario) {
      return db.select().from(protocolRevenueForecasts).where(
        and(eq(protocolRevenueForecasts.projectId, projectId), eq(protocolRevenueForecasts.scenario, scenario))
      );
    }
    return db.select().from(protocolRevenueForecasts).where(eq(protocolRevenueForecasts.projectId, projectId));
  }

  async upsertRevenueForecasts(data: InsertProtocolRevenueForecast[]) {
    if (data.length === 0) return [];
    const results: ProtocolRevenueForecast[] = [];
    for (const row of data) {
      const [inserted] = await db.insert(protocolRevenueForecasts).values(row).returning();
      results.push(inserted);
    }
    return results;
  }

  async deleteRevenueForecasts(projectId: string, scenario?: string) {
    if (scenario) {
      await db.delete(protocolRevenueForecasts).where(
        and(eq(protocolRevenueForecasts.projectId, projectId), eq(protocolRevenueForecasts.scenario, scenario))
      );
    } else {
      await db.delete(protocolRevenueForecasts).where(eq(protocolRevenueForecasts.projectId, projectId));
    }
  }

  async getTokenFlowEntries(projectId: string) {
    return db.select().from(tokenFlowEntries).where(eq(tokenFlowEntries.projectId, projectId));
  }

  async upsertTokenFlowEntries(data: InsertTokenFlowEntry[]) {
    if (data.length === 0) return [];
    const results: TokenFlowEntry[] = [];
    for (const row of data) {
      const [inserted] = await db.insert(tokenFlowEntries).values(row).returning();
      results.push(inserted);
    }
    return results;
  }

  async deleteTokenFlowEntries(projectId: string) {
    await db.delete(tokenFlowEntries).where(eq(tokenFlowEntries.projectId, projectId));
  }
}

export const storage = new DatabaseStorage();
