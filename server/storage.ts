import {
  type FinancialModel, type InsertFinancialModel,
  type Assumptions, type InsertAssumptions,
  type Scenario, type InsertScenario,
  type Actual, type InsertActual,
  type Report, type InsertReport,
  type MarketData, type InsertMarketData,
  financialModels, assumptions, scenarios, actuals, reports, marketData,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getModels(): Promise<FinancialModel[]>;
  getModel(id: string): Promise<FinancialModel | undefined>;
  createModel(model: InsertFinancialModel): Promise<FinancialModel>;
  deleteModel(id: string): Promise<void>;

  getAssumptions(): Promise<Assumptions[]>;
  getAssumptionsByModel(modelId: string): Promise<Assumptions[]>;
  createAssumptions(data: InsertAssumptions): Promise<Assumptions>;
  updateAssumptions(id: string, data: Partial<InsertAssumptions>): Promise<Assumptions | undefined>;
  deleteAssumptionsByScenario(scenarioId: string): Promise<void>;

  getScenarios(): Promise<Scenario[]>;
  getScenariosByModel(modelId: string): Promise<Scenario[]>;
  createScenario(data: InsertScenario): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;

  getActuals(): Promise<Actual[]>;
  getActualsByModel(modelId: string): Promise<Actual[]>;
  createActual(data: InsertActual): Promise<Actual>;
  deleteActual(id: string): Promise<void>;

  getReports(): Promise<Report[]>;
  getReportsByModel(modelId: string): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  createReport(data: InsertReport): Promise<Report>;
  deleteReport(id: string): Promise<void>;

  getMarketData(): Promise<MarketData[]>;
  getMarketDataByModel(modelId: string): Promise<MarketData[]>;
  createMarketData(data: InsertMarketData): Promise<MarketData>;
  deleteMarketData(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getModels() { return db.select().from(financialModels); }
  async getModel(id: string) {
    const [model] = await db.select().from(financialModels).where(eq(financialModels.id, id));
    return model;
  }
  async createModel(data: InsertFinancialModel) {
    const [model] = await db.insert(financialModels).values(data).returning();
    return model;
  }
  async deleteModel(id: string) {
    await db.delete(financialModels).where(eq(financialModels.id, id));
  }

  async getAssumptions() { return db.select().from(assumptions); }
  async getAssumptionsByModel(modelId: string) {
    return db.select().from(assumptions).where(eq(assumptions.modelId, modelId));
  }
  async createAssumptions(data: InsertAssumptions) {
    const [result] = await db.insert(assumptions).values(data).returning();
    return result;
  }
  async updateAssumptions(id: string, data: Partial<InsertAssumptions>) {
    const [result] = await db.update(assumptions).set(data).where(eq(assumptions.id, id)).returning();
    return result;
  }
  async deleteAssumptionsByScenario(scenarioId: string) {
    await db.delete(assumptions).where(eq(assumptions.scenarioId, scenarioId));
  }

  async getScenarios() { return db.select().from(scenarios); }
  async getScenariosByModel(modelId: string) {
    return db.select().from(scenarios).where(eq(scenarios.modelId, modelId));
  }
  async createScenario(data: InsertScenario) {
    const [result] = await db.insert(scenarios).values(data).returning();
    return result;
  }
  async deleteScenario(id: string) {
    await db.delete(scenarios).where(eq(scenarios.id, id));
  }

  async getActuals() { return db.select().from(actuals); }
  async getActualsByModel(modelId: string) {
    return db.select().from(actuals).where(eq(actuals.modelId, modelId));
  }
  async createActual(data: InsertActual) {
    const [result] = await db.insert(actuals).values(data).returning();
    return result;
  }
  async deleteActual(id: string) {
    await db.delete(actuals).where(eq(actuals.id, id));
  }

  async getReports() { return db.select().from(reports); }
  async getReportsByModel(modelId: string) {
    return db.select().from(reports).where(eq(reports.modelId, modelId));
  }
  async getReport(id: string) {
    const [result] = await db.select().from(reports).where(eq(reports.id, id));
    return result;
  }
  async createReport(data: InsertReport) {
    const [result] = await db.insert(reports).values(data).returning();
    return result;
  }
  async deleteReport(id: string) {
    await db.delete(reports).where(eq(reports.id, id));
  }

  async getMarketData() { return db.select().from(marketData); }
  async getMarketDataByModel(modelId: string) {
    return db.select().from(marketData).where(eq(marketData.modelId, modelId));
  }
  async createMarketData(data: InsertMarketData) {
    const [result] = await db.insert(marketData).values(data).returning();
    return result;
  }
  async deleteMarketData(id: string) {
    await db.delete(marketData).where(eq(marketData.id, id));
  }
}

export const storage = new DatabaseStorage();
