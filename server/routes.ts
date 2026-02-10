import type { Express, Request, Response } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { recalculateModel, forecastForward } from "./recalculate";
import { fetchLiveIndices, fetchFredIndicators } from "./live-data";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { revenuePeriods } from "@shared/schema";
import {
  insertFinancialModelSchema, insertRevenueLineItemSchema,
  insertRevenuePeriodSchema, insertIncomeStatementLineSchema,
  insertBalanceSheetLineSchema, insertCashFlowLineSchema,
  insertDcfValuationSchema, insertValuationComparisonSchema,
  insertPortfolioPositionSchema, insertMacroIndicatorSchema,
  insertMarketIndexSchema, insertPortfolioRedFlagSchema,
  insertScenarioSchema, insertAssumptionsSchema,
  insertActualsSchema, insertReportSchema,
} from "@shared/schema";

export async function registerRoutes(server: Server, app: Express) {
  app.get("/api/models", async (_req: Request, res: Response) => {
    const models = await storage.getModels();
    res.json(models);
  });

  app.get("/api/models/:id", async (req: Request, res: Response) => {
    const model = await storage.getModel(req.params.id);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  });

  app.post("/api/models", async (req: Request, res: Response) => {
    const parsed = insertFinancialModelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const model = await storage.createModel(parsed.data);
    res.json(model);
  });

  app.patch("/api/models/:id", async (req: Request, res: Response) => {
    const body = req.body;
    const numericFields = [
      "growthDecayRate", "targetNetMargin",
      "scenarioBullMultiplier", "scenarioBaseMultiplier", "scenarioBearMultiplier",
    ] as const;
    for (const field of numericFields) {
      if (field in body) {
        const val = Number(body[field]);
        if (isNaN(val)) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        body[field] = val;
      }
    }
    const model = await storage.updateModel(req.params.id, body);
    res.json(model);
  });

  app.patch("/api/models/:id/update-years", async (req: Request, res: Response) => {
    const { yearMapping, startYear, endYear } = req.body;
    if (!yearMapping || typeof yearMapping !== "object") {
      return res.status(400).json({ message: "yearMapping is required" });
    }
    if (!startYear || !endYear) {
      return res.status(400).json({ message: "startYear and endYear are required" });
    }

    const allPeriods = await storage.getRevenuePeriods(req.params.id);
    for (const [oldYear, newYear] of Object.entries(yearMapping)) {
      const oldYearNum = parseInt(oldYear);
      const newYearNum = newYear as number;
      if (oldYearNum !== newYearNum) {
        const periodsToUpdate = allPeriods.filter(p => p.year === oldYearNum);
        for (const p of periodsToUpdate) {
          await db.update(revenuePeriods)
            .set({ year: newYearNum })
            .where(eq(revenuePeriods.id, p.id));
        }
      }
    }

    const model = await storage.updateModel(req.params.id, { startYear, endYear });
    res.json(model);
  });

  app.delete("/api/models/:id", async (req: Request, res: Response) => {
    await storage.deleteModel(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/revenue-line-items", async (req: Request, res: Response) => {
    const items = await storage.getRevenueLineItems(req.params.modelId);
    res.json(items);
  });

  app.post("/api/revenue-line-items", async (req: Request, res: Response) => {
    const parsed = insertRevenueLineItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createRevenueLineItem(parsed.data);
    res.json(item);
  });

  app.patch("/api/revenue-line-items/:id", async (req: Request, res: Response) => {
    const { name, sortOrder } = req.body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return res.status(400).json({ message: "Name must be a non-empty string" });
    }
    const item = await storage.updateRevenueLineItem(req.params.id, req.body);
    res.json(item);
  });

  app.delete("/api/revenue-line-items/:id", async (req: Request, res: Response) => {
    await storage.deleteRevenueLineItem(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/models/:modelId/revenue-line-items-with-periods", async (req: Request, res: Response) => {
    const { name, sortOrder } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }
    const modelId = req.params.modelId;
    const model = await storage.getModel(modelId);
    if (!model) {
      return res.status(404).json({ message: "Model not found" });
    }
    const lineItem = await storage.createRevenueLineItem({ modelId, name: name.trim(), sortOrder: sortOrder || 0 });
    const periodsToCreate = [];
    for (let year = model.startYear; year <= model.endYear; year++) {
      for (let q = 1; q <= 4; q++) {
        periodsToCreate.push({ lineItemId: lineItem.id, modelId, year, quarter: q, amount: 0, isActual: false });
      }
    }
    if (periodsToCreate.length > 0) {
      await storage.upsertRevenuePeriods(periodsToCreate);
    }
    res.json(lineItem);
  });

  app.get("/api/models/:modelId/revenue-periods", async (req: Request, res: Response) => {
    const periods = await storage.getRevenuePeriods(req.params.modelId);
    res.json(periods);
  });

  app.post("/api/revenue-periods", async (req: Request, res: Response) => {
    const parsed = insertRevenuePeriodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const period = await storage.createRevenuePeriod(parsed.data);
    res.json(period);
  });

  app.post("/api/revenue-periods/bulk", async (req: Request, res: Response) => {
    const periods = await storage.upsertRevenuePeriods(req.body);
    res.json(periods);
  });

  app.patch("/api/revenue-periods/:id", async (req: Request, res: Response) => {
    const period = await storage.updateRevenuePeriod(req.params.id, req.body);
    res.json(period);
  });

  app.get("/api/models/:modelId/income-statement", async (req: Request, res: Response) => {
    const lines = await storage.getIncomeStatementLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/income-statement", async (req: Request, res: Response) => {
    const line = await storage.upsertIncomeStatementLine(req.body);
    res.json(line);
  });

  app.post("/api/income-statement/bulk", async (req: Request, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertIncomeStatementLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.delete("/api/models/:modelId/income-statement", async (req: Request, res: Response) => {
    await storage.deleteIncomeStatementLines(req.params.modelId);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/balance-sheet", async (req: Request, res: Response) => {
    const lines = await storage.getBalanceSheetLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/balance-sheet", async (req: Request, res: Response) => {
    const line = await storage.upsertBalanceSheetLine(req.body);
    res.json(line);
  });

  app.post("/api/balance-sheet/bulk", async (req: Request, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertBalanceSheetLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.get("/api/models/:modelId/cash-flow", async (req: Request, res: Response) => {
    const lines = await storage.getCashFlowLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/cash-flow", async (req: Request, res: Response) => {
    const line = await storage.upsertCashFlowLine(req.body);
    res.json(line);
  });

  app.post("/api/cash-flow/bulk", async (req: Request, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertCashFlowLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.get("/api/models/:modelId/dcf", async (req: Request, res: Response) => {
    const val = await storage.getDcfValuation(req.params.modelId);
    res.json(val || null);
  });

  app.post("/api/dcf", async (req: Request, res: Response) => {
    const val = await storage.upsertDcfValuation(req.body);
    res.json(val);
  });

  app.get("/api/models/:modelId/valuation-comparison", async (req: Request, res: Response) => {
    const val = await storage.getValuationComparison(req.params.modelId);
    res.json(val || null);
  });

  app.post("/api/valuation-comparison", async (req: Request, res: Response) => {
    const val = await storage.upsertValuationComparison(req.body);
    res.json(val);
  });

  app.get("/api/portfolio", async (_req: Request, res: Response) => {
    const positions = await storage.getPortfolioPositions();
    res.json(positions);
  });

  app.post("/api/portfolio", async (req: Request, res: Response) => {
    const parsed = insertPortfolioPositionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pos = await storage.createPortfolioPosition(parsed.data);
    res.json(pos);
  });

  app.patch("/api/portfolio/:id", async (req: Request, res: Response) => {
    const pos = await storage.updatePortfolioPosition(req.params.id, req.body);
    res.json(pos);
  });

  app.delete("/api/portfolio/:id", async (req: Request, res: Response) => {
    await storage.deletePortfolioPosition(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/macro-indicators", async (_req: Request, res: Response) => {
    const indicators = await storage.getMacroIndicators();
    res.json(indicators);
  });

  app.post("/api/macro-indicators", async (req: Request, res: Response) => {
    const ind = await storage.upsertMacroIndicator(req.body);
    res.json(ind);
  });

  app.get("/api/market-indices", async (_req: Request, res: Response) => {
    const indices = await storage.getMarketIndices();
    res.json(indices);
  });

  app.post("/api/market-indices", async (req: Request, res: Response) => {
    const idx = await storage.upsertMarketIndex(req.body);
    res.json(idx);
  });

  app.post("/api/refresh-market-data", async (_req: Request, res: Response) => {
    try {
      const results: { indices: number; macro: number; errors: string[] } = { indices: 0, macro: 0, errors: [] };

      try {
        const liveIndices = await fetchLiveIndices();
        if (liveIndices.length > 0) {
          await storage.replaceAllMarketIndices(liveIndices);
          results.indices = liveIndices.length;
        }
      } catch (err: any) {
        results.errors.push(`Indices: ${err.message}`);
      }

      const fredApiKey = process.env.FRED_API_KEY;
      if (fredApiKey) {
        try {
          const liveIndicators = await fetchFredIndicators(fredApiKey);
          if (liveIndicators.length > 0) {
            await storage.replaceAllMacroIndicators(liveIndicators);
            results.macro = liveIndicators.length;
          }
        } catch (err: any) {
          results.errors.push(`Macro: ${err.message}`);
        }
      } else {
        results.errors.push("FRED_API_KEY not set -- macro indicators not updated. Get a free key at fred.stlouisfed.org.");
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portfolio-red-flags", async (_req: Request, res: Response) => {
    const flags = await storage.getPortfolioRedFlags();
    res.json(flags);
  });

  app.post("/api/portfolio-red-flags", async (req: Request, res: Response) => {
    const flag = await storage.upsertPortfolioRedFlag(req.body);
    res.json(flag);
  });

  app.get("/api/models/:modelId/scenarios", async (req: Request, res: Response) => {
    const s = await storage.getScenarios(req.params.modelId);
    res.json(s);
  });

  app.post("/api/scenarios", async (req: Request, res: Response) => {
    const parsed = insertScenarioSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const s = await storage.createScenario(parsed.data);
    res.json(s);
  });

  app.delete("/api/scenarios/:id", async (req: Request, res: Response) => {
    await storage.deleteScenario(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/assumptions", async (req: Request, res: Response) => {
    const a = await storage.getAssumptions(req.params.modelId);
    res.json(a);
  });

  app.post("/api/assumptions", async (req: Request, res: Response) => {
    const parsed = insertAssumptionsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const a = await storage.createAssumptions(parsed.data);
    res.json(a);
  });

  app.patch("/api/assumptions/:id", async (req: Request, res: Response) => {
    const a = await storage.updateAssumptions(req.params.id, req.body);
    res.json(a);
  });

  app.get("/api/models/:modelId/actuals", async (req: Request, res: Response) => {
    const a = await storage.getActuals(req.params.modelId);
    res.json(a);
  });

  app.post("/api/actuals", async (req: Request, res: Response) => {
    const parsed = insertActualsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const a = await storage.createActual(parsed.data);
    res.json(a);
  });

  app.delete("/api/actuals/:id", async (req: Request, res: Response) => {
    await storage.deleteActual(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/reports", async (req: Request, res: Response) => {
    const r = await storage.getReports(req.params.modelId);
    res.json(r);
  });

  app.post("/api/reports", async (req: Request, res: Response) => {
    const parsed = insertReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const r = await storage.createReport(parsed.data);
    res.json(r);
  });

  app.delete("/api/reports/:id", async (req: Request, res: Response) => {
    await storage.deleteReport(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/revenue-periods/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateRevenuePeriod(req.params.id, req.body);
    res.json(updated);
  });

  app.patch("/api/models/:modelId/dcf-params", async (req: Request, res: Response) => {
    const existing = await storage.getDcfValuation(req.params.modelId);
    if (existing) {
      const updated = { ...existing, ...req.body };
      const result = await storage.upsertDcfValuation(updated);
      res.json(result);
    } else {
      res.status(404).json({ message: "No DCF data found" });
    }
  });

  app.post("/api/models/:modelId/recalculate", async (req: Request, res: Response) => {
    try {
      const result = await recalculateModel(req.params.modelId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Recalculation failed" });
    }
  });

  app.post("/api/models/:modelId/forecast-forward", async (req: Request, res: Response) => {
    try {
      const result = await forecastForward(req.params.modelId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Forecast failed" });
    }
  });

  app.patch("/api/models/:modelId/assumptions", async (req: Request, res: Response) => {
    const allAssumptions = await storage.getAssumptions(req.params.modelId);
    const base = allAssumptions.find(a => !a.scenarioId);
    if (base) {
      const updated = await storage.updateAssumptions(base.id, req.body);
      res.json(updated);
    } else {
      const created = await storage.createAssumptions({ modelId: req.params.modelId, ...req.body });
      res.json(created);
    }
  });
}
