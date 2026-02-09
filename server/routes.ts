import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertFinancialModelSchema, insertAssumptionsSchema, insertScenarioSchema, insertActualsSchema, insertReportSchema, insertMarketDataSchema } from "@shared/schema";

export function registerRoutes(server: Server, app: Express) {
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
    try {
      const { assumptions: assumptionData, ...modelData } = req.body;
      const parsed = insertFinancialModelSchema.parse(modelData);
      const model = await storage.createModel(parsed);

      if (assumptionData) {
        const assumptionParsed = insertAssumptionsSchema.parse({
          ...assumptionData,
          modelId: model.id,
        });
        await storage.createAssumptions(assumptionParsed);
      }

      res.status(201).json(model);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid model data" });
    }
  });

  app.delete("/api/models/:id", async (req: Request, res: Response) => {
    await storage.deleteModel(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/assumptions", async (_req: Request, res: Response) => {
    const all = await storage.getAssumptions();
    res.json(all);
  });

  app.get("/api/assumptions/model/:modelId", async (req: Request, res: Response) => {
    const all = await storage.getAssumptionsByModel(req.params.modelId);
    res.json(all);
  });

  app.post("/api/assumptions", async (req: Request, res: Response) => {
    try {
      const parsed = insertAssumptionsSchema.parse(req.body);
      const result = await storage.createAssumptions(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid assumptions data" });
    }
  });

  app.patch("/api/assumptions/:id", async (req: Request, res: Response) => {
    const result = await storage.updateAssumptions(req.params.id, req.body);
    if (!result) return res.status(404).json({ message: "Assumptions not found" });
    res.json(result);
  });

  app.get("/api/scenarios", async (_req: Request, res: Response) => {
    const all = await storage.getScenarios();
    res.json(all);
  });

  app.get("/api/scenarios/model/:modelId", async (req: Request, res: Response) => {
    const all = await storage.getScenariosByModel(req.params.modelId);
    res.json(all);
  });

  app.post("/api/scenarios", async (req: Request, res: Response) => {
    try {
      const { assumptions: assumptionData, ...scenarioData } = req.body;
      const parsed = insertScenarioSchema.parse(scenarioData);
      const scenario = await storage.createScenario(parsed);

      if (assumptionData) {
        const assumptionParsed = insertAssumptionsSchema.parse({
          ...assumptionData,
          modelId: scenario.modelId,
          scenarioId: scenario.id,
        });
        await storage.createAssumptions(assumptionParsed);
      }

      res.status(201).json(scenario);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid scenario data" });
    }
  });

  app.delete("/api/scenarios/:id", async (req: Request, res: Response) => {
    await storage.deleteAssumptionsByScenario(req.params.id);
    await storage.deleteScenario(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/actuals", async (_req: Request, res: Response) => {
    const all = await storage.getActuals();
    res.json(all);
  });

  app.get("/api/actuals/model/:modelId", async (req: Request, res: Response) => {
    const all = await storage.getActualsByModel(req.params.modelId);
    res.json(all);
  });

  app.post("/api/actuals", async (req: Request, res: Response) => {
    try {
      const parsed = insertActualsSchema.parse(req.body);
      const result = await storage.createActual(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid actuals data" });
    }
  });

  app.delete("/api/actuals/:id", async (req: Request, res: Response) => {
    await storage.deleteActual(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/reports", async (_req: Request, res: Response) => {
    const all = await storage.getReports();
    res.json(all);
  });

  app.get("/api/reports/:id", async (req: Request, res: Response) => {
    const report = await storage.getReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const parsed = insertReportSchema.parse(req.body);
      const result = await storage.createReport(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid report data" });
    }
  });

  app.delete("/api/reports/:id", async (req: Request, res: Response) => {
    await storage.deleteReport(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/market-data", async (_req: Request, res: Response) => {
    const all = await storage.getMarketData();
    res.json(all);
  });

  app.post("/api/market-data/fetch", async (req: Request, res: Response) => {
    try {
      const { modelId, ticker } = req.body;
      if (!modelId || !ticker) {
        return res.status(400).json({ message: "modelId and ticker are required" });
      }

      const mockMarketData: Record<string, any> = {
        "AAPL": { price: 237.45, changePercent: 1.23, volume: 54200000, marketCap: 3640000000000 },
        "MSFT": { price: 425.80, changePercent: 0.87, volume: 22100000, marketCap: 3160000000000 },
        "GOOGL": { price: 185.30, changePercent: -0.45, volume: 18700000, marketCap: 2280000000000 },
        "AMZN": { price: 219.15, changePercent: 2.10, volume: 42300000, marketCap: 2290000000000 },
        "TSLA": { price: 342.60, changePercent: -1.82, volume: 98500000, marketCap: 1100000000000 },
        "META": { price: 615.20, changePercent: 0.95, volume: 15400000, marketCap: 1560000000000 },
        "NVDA": { price: 138.50, changePercent: 3.21, volume: 312000000, marketCap: 3390000000000 },
      };

      const data = mockMarketData[ticker] || { price: (Math.random() * 200 + 50).toFixed(2), changePercent: (Math.random() * 6 - 3).toFixed(2), volume: Math.floor(Math.random() * 50000000) };

      const parsed = insertMarketDataSchema.parse({
        modelId,
        ticker,
        dataType: "price",
        data,
      });
      const result = await storage.createMarketData(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to fetch market data" });
    }
  });

  app.delete("/api/market-data/:id", async (req: Request, res: Response) => {
    await storage.deleteMarketData(req.params.id);
    res.json({ success: true });
  });
}
