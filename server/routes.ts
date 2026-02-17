import type { Express, Request, Response } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { recalculateModel, forecastForward } from "./recalculate";
import { fetchLiveIndices, fetchFredIndicators, fetchPortfolioQuotes, fetchSingleIndexQuote, fetchSingleFredSeries, fetchCompanyFundamentals } from "./live-data";
import { fetchAndParseEdgar } from "./edgar-parser";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { revenuePeriods } from "@shared/schema";
import {
  insertFinancialModelSchema, insertRevenueLineItemSchema,
  insertRevenuePeriodSchema, insertIncomeStatementLineSchema,
  insertBalanceSheetLineSchema, insertCashFlowLineSchema,
  insertDcfValuationSchema, insertValuationComparisonSchema,
  insertPortfolioPositionSchema, insertPortfolioLotSchema, insertMacroIndicatorSchema,
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
      "sharesOutstanding", "startYear", "endYear",
    ] as const;
    for (const field of numericFields) {
      if (field in body) {
        if (body[field] === null || body[field] === undefined) continue;
        const val = Number(body[field]);
        if (isNaN(val)) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        body[field] = val;
      }
    }
    if (body.displayUnit && !["ones", "thousands", "millions", "billions", "trillions"].includes(body.displayUnit)) {
      return res.status(400).json({ message: "displayUnit must be ones, thousands, millions, billions, or trillions" });
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

  app.patch("/api/models/:modelId/balance-sheet/:year", async (req: Request, res: Response) => {
    const { modelId, year } = req.params;
    const yearNum = parseInt(year);
    const data = { ...req.body };

    const existing = (await storage.getBalanceSheetLines(modelId)).find(l => l.year === yearNum);
    const merged: Record<string, number> = {};
    const numKeys = [
      "cash", "shortTermInvestments", "accountsReceivable", "inventory",
      "equipment", "depreciationAccum", "capex",
      "accountsPayable", "shortTermDebt", "longTermDebt",
      "retainedEarnings", "commonShares",
    ];
    for (const k of numKeys) {
      merged[k] = data[k] !== undefined ? Number(data[k]) : (existing as any)?.[k] || 0;
    }

    const totalCA = merged.cash + merged.shortTermInvestments + merged.accountsReceivable + merged.inventory;
    const totalLTA = merged.equipment - merged.depreciationAccum + merged.capex;
    const totalAssets = totalCA + totalLTA;
    const totalCL = merged.accountsPayable + merged.shortTermDebt;
    const totalLTL = merged.longTermDebt;
    const totalLiab = totalCL + totalLTL;
    const totalEquity = merged.retainedEarnings + merged.commonShares;
    const totalLE = totalLiab + totalEquity;

    data.totalCurrentAssets = Math.round(totalCA);
    data.totalLongTermAssets = Math.round(totalLTA);
    data.totalAssets = Math.round(totalAssets);
    data.totalCurrentLiabilities = Math.round(totalCL);
    data.totalLongTermLiabilities = Math.round(totalLTL);
    data.totalLiabilities = Math.round(totalLiab);
    data.totalEquity = Math.round(totalEquity);
    data.totalLiabilitiesAndEquity = Math.round(totalLE);

    const line = await storage.updateBalanceSheetLineByYear(modelId, yearNum, data);
    res.json(line);
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

  app.patch("/api/models/:modelId/cash-flow/:year", async (req: Request, res: Response) => {
    const { modelId, year } = req.params;
    const line = await storage.updateCashFlowLineByYear(modelId, parseInt(year), req.body);
    res.json(line);
  });

  app.patch("/api/models/:modelId/income-statement/:year", async (req: Request, res: Response) => {
    const { modelId, year } = req.params;
    const line = await storage.updateIncomeStatementLineByYear(modelId, parseInt(year), req.body);
    res.json(line);
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
    await storage.createPortfolioLot({
      positionId: pos.id,
      sharesHeld: pos.sharesHeld || 0,
      purchasePrice: pos.purchasePrice || 0,
      purchaseDate: null,
      notes: null,
    });
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

  app.get("/api/portfolio/lots", async (_req: Request, res: Response) => {
    const lots = await storage.getAllPortfolioLots();
    res.json(lots);
  });

  app.get("/api/portfolio/:positionId/lots", async (req: Request, res: Response) => {
    const lots = await storage.getPortfolioLots(req.params.positionId as string);
    res.json(lots);
  });

  app.post("/api/portfolio/:positionId/lots", async (req: Request, res: Response) => {
    const parsed = insertPortfolioLotSchema.safeParse({
      ...req.body,
      positionId: req.params.positionId,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const lot = await storage.createPortfolioLot(parsed.data);
    const position = await storage.recomputePositionFromLots(req.params.positionId as string);
    res.json({ lot, position });
  });

  app.patch("/api/portfolio/lots/:lotId", async (req: Request, res: Response) => {
    const lot = await storage.updatePortfolioLot(req.params.lotId as string, req.body);
    const position = await storage.recomputePositionFromLots(lot.positionId);
    res.json({ lot, position });
  });

  app.delete("/api/portfolio/lots/:lotId", async (req: Request, res: Response) => {
    const allLots = await storage.getAllPortfolioLots();
    const targetLot = allLots.find(l => l.id === req.params.lotId);
    if (!targetLot) return res.status(404).json({ message: "Lot not found" });
    const positionId = targetLot.positionId;
    await storage.deletePortfolioLot(req.params.lotId as string);
    const position = await storage.recomputePositionFromLots(positionId);
    res.json({ success: true, position });
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

  app.post("/api/refresh-portfolio-prices", async (_req: Request, res: Response) => {
    try {
      const positions = await storage.getPortfolioPositions();
      if (positions.length === 0) {
        return res.json({ updated: 0, errors: [] });
      }
      const tickerMap: Record<string, string> = {};
      for (const p of positions) {
        const yahooTicker = p.isCrypto ? `${p.ticker.toUpperCase()}-USD` : p.ticker;
        tickerMap[yahooTicker.toUpperCase()] = p.ticker.toUpperCase();
      }
      const tickers = Object.keys(tickerMap);
      const { results, errors } = await fetchPortfolioQuotes(tickers);

      let updated = 0;
      for (const quote of results) {
        const originalTicker = tickerMap[quote.ticker.toUpperCase()];
        const position = positions.find(p => p.ticker.toUpperCase() === originalTicker);
        if (position) {
          const ma50 = quote.ma50;
          const ma200 = quote.ma200;
          const goldenCross = ma50 > ma200 && ma50 > 0 && ma200 > 0;
          const changeFromMa50 = quote.currentPrice > 0 && ma50 > 0 ? (quote.currentPrice - ma50) / ma50 : 0;
          const changeFromMa200 = quote.currentPrice > 0 && ma200 > 0 ? (quote.currentPrice - ma200) / ma200 : 0;
          const positionValue = (position.sharesHeld || 0) * quote.currentPrice;
          const costBasis = (position.sharesHeld || 0) * (position.purchasePrice || 0);
          const gainLossDollar = positionValue - costBasis;
          const gainLossPercent = costBasis > 0 ? gainLossDollar / costBasis : 0;

          const updateData: Record<string, any> = {
            currentPrice: quote.currentPrice,
            dailyChangePercent: quote.dailyChangePercent,
            dailyChange: quote.dailyChange,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            openPrice: quote.openPrice,
            previousClose: quote.previousClose,
            volume: quote.volume,
            avgVolume: quote.avgVolume,
            marketCap: quote.marketCap,
            ma50,
            ma200,
            week52Low: quote.week52Low,
            week52High: quote.week52High,
            goldenCross,
            changeFromMa50,
            changeFromMa200,
            positionValue,
            gainLossDollar,
            gainLossPercent,
          };

          if (position.isCrypto) {
            updateData.peRatio = 0;
            updateData.eps = 0;
            updateData.dividendYield = 0;
            updateData.shortRatio = 0;
            updateData.bookValue = 0;
            updateData.beta = quote.beta;
          } else {
            updateData.peRatio = quote.peRatio;
            updateData.eps = quote.eps;
            updateData.dividendYield = quote.dividendYield;
            updateData.shortRatio = quote.shortRatio;
            updateData.bookValue = quote.bookValue;
            updateData.beta = quote.beta;
          }

          await storage.updatePortfolioPosition(position.id, updateData);
          updated++;
        }
      }

      res.json({ updated, errors });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/market-indices/:id", async (req: Request, res: Response) => {
    await storage.deleteMarketIndex(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/market-indices/add-custom", async (req: Request, res: Response) => {
    try {
      const { symbol, name, region } = req.body;
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ message: "Symbol is required" });
      }
      const quote = await fetchSingleIndexQuote(symbol.trim());
      if (!quote) {
        return res.status(400).json({ message: `Could not find data for symbol "${symbol}". Make sure it is a valid Yahoo Finance symbol (e.g., ^GSPC, ^FTSE).` });
      }
      const idx = await storage.upsertMarketIndex({
        name: name?.trim() || quote.name,
        ticker: quote.ticker,
        region: region?.trim() || quote.region,
        currentValue: quote.currentValue,
        ytdReturn: quote.ytdReturn,
        mtdReturn: quote.mtdReturn,
        dailyChangePercent: quote.dailyChangePercent,
      });
      res.json(idx);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/macro-indicators/:id", async (req: Request, res: Response) => {
    await storage.deleteMacroIndicator(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/macro-indicators/add-custom", async (req: Request, res: Response) => {
    try {
      const { seriesId, name, category, displayFormat } = req.body;
      if (!seriesId || typeof seriesId !== "string") {
        return res.status(400).json({ message: "FRED Series ID is required" });
      }
      const fredApiKey = process.env.FRED_API_KEY;
      if (!fredApiKey) {
        return res.status(400).json({ message: "FRED_API_KEY not set. Add a free key from fred.stlouisfed.org." });
      }
      const result = await fetchSingleFredSeries(seriesId.trim().toUpperCase(), fredApiKey);
      if (!result) {
        return res.status(400).json({ message: `Could not find data for FRED series "${seriesId}". Make sure it is a valid FRED series ID (e.g., DGS10, UNRATE).` });
      }
      const ind = await storage.upsertMacroIndicator({
        name: name?.trim() || result.name,
        category: category?.trim() || result.category,
        value: result.value,
        priorValue: result.priorValue,
        displayFormat: displayFormat?.trim() || result.displayFormat,
      });
      res.json(ind);
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

  app.get("/api/models/:modelId/yahoo-fundamentals", async (req: Request, res: Response) => {
    try {
      const model = await storage.getModel(req.params.modelId);
      if (!model) return res.status(404).json({ message: "Model not found" });
      if (!model.ticker) return res.status(400).json({ message: "No ticker set for this company. Set a ticker in Edit Company first." });

      const data = await fetchCompanyFundamentals(model.ticker);
      if (!data) return res.status(404).json({ message: `Could not fetch data for ticker ${model.ticker}` });

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch Yahoo data" });
    }
  });

  app.post("/api/models/:modelId/sync-yahoo", async (req: Request, res: Response) => {
    try {
      const model = await storage.getModel(req.params.modelId);
      if (!model) return res.status(404).json({ message: "Model not found" });
      if (!model.ticker) return res.status(400).json({ message: "No ticker set for this company." });

      const data = await fetchCompanyFundamentals(model.ticker);
      if (!data) return res.status(404).json({ message: `Could not fetch data for ticker ${model.ticker}` });

      const updates: Record<string, any> = {};
      if (data.sharesOutstanding > 0) updates.sharesOutstanding = data.sharesOutstanding;

      if (Object.keys(updates).length > 0) {
        await storage.updateModel(model.id, updates);
      }

      const dcf = await storage.getDcfValuation(req.params.modelId);
      if (dcf) {
        const dcfUpdates: Record<string, any> = {};
        if (data.currentPrice > 0) dcfUpdates.currentSharePrice = data.currentPrice;
        if (data.beta > 0) dcfUpdates.beta = data.beta;
        if (Object.keys(dcfUpdates).length > 0) {
          await storage.upsertDcfValuation({ ...dcf, ...dcfUpdates });
        }
      }

      res.json({
        message: "Synced successfully",
        data,
        applied: {
          sharesOutstanding: data.sharesOutstanding,
          currentPrice: data.currentPrice,
          beta: data.beta,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  app.post("/api/parse-edgar", async (req: Request, res: Response) => {
    try {
      const { url, statementType } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      const result = await fetchAndParseEdgar(url, statementType);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to parse SEC EDGAR filing" });
    }
  });
}
