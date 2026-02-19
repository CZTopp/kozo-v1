import type { Express, Request, Response } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { recalculateModel, forecastForward } from "./recalculate";
import { fetchLiveIndices, fetchFredIndicators, fetchPortfolioQuotes, fetchSingleIndexQuote, fetchSingleFredSeries, fetchCompanyFundamentals } from "./live-data";
import { fetchAndParseEdgar } from "./edgar-parser";
import { searchCompanyByTicker, getCompanyFilings, fetchAndParseAllStatements } from "./sec-search";
import { streamCopilotToResponse } from "./copilot";
import { db } from "./db";
import { eq, and, sql, count } from "drizzle-orm";
import { revenuePeriods, users, financialModels, portfolioPositions, cryptoProjects } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  insertFinancialModelSchema, insertRevenueLineItemSchema,
  insertRevenuePeriodSchema, insertIncomeStatementLineSchema,
  insertBalanceSheetLineSchema, insertCashFlowLineSchema,
  insertDcfValuationSchema, insertValuationComparisonSchema,
  insertPortfolioPositionSchema, insertPortfolioLotSchema, insertMacroIndicatorSchema,
  insertMarketIndexSchema, insertPortfolioRedFlagSchema,
  insertScenarioSchema, insertAssumptionsSchema,
  insertActualsSchema, insertReportSchema,
  insertCryptoProjectSchema, insertTokenSupplyScheduleSchema,
  insertTokenIncentiveSchema,
} from "@shared/schema";
import {
  searchCoins, searchCoinByContract, looksLikeContractAddress, getCoinMarketData, getMultipleCoinMarketData, mapCoinGeckoToProject,
  searchDefiLlamaProtocols, getProtocolTVLHistory, getProtocolFees, getProtocolRevenue,
  INCENTIVE_TEMPLATES, getCoinContractAddress, estimateBurnFromSupply,
} from "./crypto-data";
import { getOnChainTokenData } from "./thirdweb-data";

type Params = Record<string, string>;

function formatNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

export async function registerRoutes(server: Server, app: Express) {
  const publicPaths = ["/api/login", "/api/logout", "/api/callback", "/api/auth/user"];
  app.use("/api", (req, res, next) => {
    if (publicPaths.some(p => req.path === p || req.originalUrl === p)) return next();
    isAuthenticated(req, res, next);
  });

  app.get("/api/models", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const models = await storage.getModels(userId);
    res.json(models);
  });

  app.get("/api/models/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const model = await storage.getModel(req.params.id, userId);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  });

  app.post("/api/models", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const parsed = insertFinancialModelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const model = await storage.createModel({ ...parsed.data, userId });
    res.json(model);
  });

  app.patch("/api/models/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
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
    if (body.modelMode && !["ipo", "invest"].includes(body.modelMode)) {
      return res.status(400).json({ message: "modelMode must be 'ipo' or 'invest'" });
    }
    const model = await storage.updateModel(req.params.id, userId, body);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  });

  app.patch("/api/models/:id/update-years", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
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

    const model = await storage.updateModel(req.params.id, userId, { startYear, endYear });
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  });

  app.delete("/api/models/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteModel(req.params.id, userId);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/revenue-line-items", async (req: Request<Params>, res: Response) => {
    const items = await storage.getRevenueLineItems(req.params.modelId);
    res.json(items);
  });

  app.post("/api/revenue-line-items", async (req: Request<Params>, res: Response) => {
    const parsed = insertRevenueLineItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createRevenueLineItem(parsed.data);
    res.json(item);
  });

  app.patch("/api/revenue-line-items/:id", async (req: Request<Params>, res: Response) => {
    const { name, sortOrder } = req.body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return res.status(400).json({ message: "Name must be a non-empty string" });
    }
    const item = await storage.updateRevenueLineItem(req.params.id, req.body);
    res.json(item);
  });

  app.delete("/api/revenue-line-items/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteRevenueLineItem(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/models/:modelId/revenue-line-items-with-periods", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { name, sortOrder } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }
    const modelId = req.params.modelId;
    const model = await storage.getModel(modelId, userId);
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

  app.get("/api/models/:modelId/revenue-periods", async (req: Request<Params>, res: Response) => {
    const periods = await storage.getRevenuePeriods(req.params.modelId);
    res.json(periods);
  });

  app.post("/api/revenue-periods", async (req: Request<Params>, res: Response) => {
    const parsed = insertRevenuePeriodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const period = await storage.createRevenuePeriod(parsed.data);
    res.json(period);
  });

  app.post("/api/revenue-periods/bulk", async (req: Request<Params>, res: Response) => {
    const periods = await storage.upsertRevenuePeriods(req.body);
    res.json(periods);
  });

  app.patch("/api/revenue-periods/:id", async (req: Request<Params>, res: Response) => {
    const period = await storage.updateRevenuePeriod(req.params.id, req.body);
    res.json(period);
  });

  app.get("/api/models/:modelId/income-statement", async (req: Request<Params>, res: Response) => {
    const lines = await storage.getIncomeStatementLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/income-statement", async (req: Request<Params>, res: Response) => {
    const line = await storage.upsertIncomeStatementLine(req.body);
    res.json(line);
  });

  app.post("/api/income-statement/bulk", async (req: Request<Params>, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertIncomeStatementLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.delete("/api/models/:modelId/income-statement", async (req: Request<Params>, res: Response) => {
    await storage.deleteIncomeStatementLines(req.params.modelId);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/balance-sheet", async (req: Request<Params>, res: Response) => {
    const lines = await storage.getBalanceSheetLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/balance-sheet", async (req: Request<Params>, res: Response) => {
    const line = await storage.upsertBalanceSheetLine(req.body);
    res.json(line);
  });

  app.post("/api/balance-sheet/bulk", async (req: Request<Params>, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertBalanceSheetLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.patch("/api/models/:modelId/balance-sheet/:year", async (req: Request<Params>, res: Response) => {
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

  app.get("/api/models/:modelId/cash-flow", async (req: Request<Params>, res: Response) => {
    const lines = await storage.getCashFlowLines(req.params.modelId);
    res.json(lines);
  });

  app.post("/api/cash-flow", async (req: Request<Params>, res: Response) => {
    const line = await storage.upsertCashFlowLine(req.body);
    res.json(line);
  });

  app.post("/api/cash-flow/bulk", async (req: Request<Params>, res: Response) => {
    const results = [];
    for (const item of req.body) {
      const line = await storage.upsertCashFlowLine(item);
      results.push(line);
    }
    res.json(results);
  });

  app.patch("/api/models/:modelId/cash-flow/:year", async (req: Request<Params>, res: Response) => {
    const { modelId, year } = req.params;
    const line = await storage.updateCashFlowLineByYear(modelId, parseInt(year), req.body);
    res.json(line);
  });

  app.patch("/api/models/:modelId/income-statement/:year", async (req: Request<Params>, res: Response) => {
    const { modelId, year } = req.params;
    const line = await storage.updateIncomeStatementLineByYear(modelId, parseInt(year), req.body);
    res.json(line);
  });

  app.get("/api/models/:modelId/dcf", async (req: Request<Params>, res: Response) => {
    const val = await storage.getDcfValuation(req.params.modelId);
    res.json(val || null);
  });

  app.post("/api/dcf", async (req: Request<Params>, res: Response) => {
    const val = await storage.upsertDcfValuation(req.body);
    res.json(val);
  });

  app.get("/api/models/:modelId/valuation-comparison", async (req: Request<Params>, res: Response) => {
    const val = await storage.getValuationComparison(req.params.modelId);
    res.json(val || null);
  });

  app.post("/api/valuation-comparison", async (req: Request<Params>, res: Response) => {
    const val = await storage.upsertValuationComparison(req.body);
    res.json(val);
  });

  app.get("/api/portfolio", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const positions = await storage.getPortfolioPositions(userId);
    res.json(positions);
  });

  app.post("/api/portfolio", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const parsed = insertPortfolioPositionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pos = await storage.createPortfolioPosition({ ...parsed.data, userId });
    await storage.createPortfolioLot({
      positionId: pos.id,
      sharesHeld: pos.sharesHeld || 0,
      purchasePrice: pos.purchasePrice || 0,
      purchaseDate: null,
      notes: null,
    });
    res.json(pos);
  });

  app.patch("/api/portfolio/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const pos = await storage.updatePortfolioPosition(req.params.id, userId, req.body);
    if (!pos) return res.status(404).json({ message: "Position not found" });
    res.json(pos);
  });

  app.delete("/api/portfolio/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deletePortfolioPosition(req.params.id, userId);
    res.json({ success: true });
  });

  app.get("/api/portfolio/lots", async (_req: Request, res: Response) => {
    const lots = await storage.getAllPortfolioLots();
    res.json(lots);
  });

  app.get("/api/portfolio/:positionId/lots", async (req: Request<Params>, res: Response) => {
    const lots = await storage.getPortfolioLots(req.params.positionId as string);
    res.json(lots);
  });

  app.post("/api/portfolio/:positionId/lots", async (req: Request<Params>, res: Response) => {
    const parsed = insertPortfolioLotSchema.safeParse({
      ...req.body,
      positionId: req.params.positionId,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const lot = await storage.createPortfolioLot(parsed.data);
    const position = await storage.recomputePositionFromLots(req.params.positionId as string);
    res.json({ lot, position });
  });

  app.patch("/api/portfolio/lots/:lotId", async (req: Request<Params>, res: Response) => {
    const lot = await storage.updatePortfolioLot(req.params.lotId as string, req.body);
    const position = await storage.recomputePositionFromLots(lot.positionId);
    res.json({ lot, position });
  });

  app.delete("/api/portfolio/lots/:lotId", async (req: Request<Params>, res: Response) => {
    const allLots = await storage.getAllPortfolioLots();
    const targetLot = allLots.find(l => l.id === req.params.lotId);
    if (!targetLot) return res.status(404).json({ message: "Lot not found" });
    const positionId = targetLot.positionId;
    await storage.deletePortfolioLot(req.params.lotId as string);
    const position = await storage.recomputePositionFromLots(positionId);
    res.json({ success: true, position });
  });

  app.get("/api/macro-indicators", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const indicators = await storage.getMacroIndicators(userId);
    res.json(indicators);
  });

  app.post("/api/macro-indicators", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const ind = await storage.upsertMacroIndicator({ ...req.body, userId });
    res.json(ind);
  });

  app.get("/api/market-indices", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const indices = await storage.getMarketIndices(userId);
    res.json(indices);
  });

  app.post("/api/market-indices", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const idx = await storage.upsertMarketIndex({ ...req.body, userId });
    res.json(idx);
  });

  app.post("/api/refresh-market-data", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const results: { indices: number; macro: number; errors: string[] } = { indices: 0, macro: 0, errors: [] };

      try {
        const liveIndices = await fetchLiveIndices();
        if (liveIndices.length > 0) {
          await storage.replaceAllMarketIndices(liveIndices, userId);
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
            await storage.replaceAllMacroIndicators(liveIndicators, userId);
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

  app.post("/api/refresh-portfolio-prices", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const positions = await storage.getPortfolioPositions(userId);
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

          await storage.updatePortfolioPosition(position.id, userId, updateData);
          updated++;
        }
      }

      res.json({ updated, errors });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/market-indices/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteMarketIndex(req.params.id, userId);
    res.json({ success: true });
  });

  app.post("/api/market-indices/add-custom", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
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
        userId,
      });
      res.json(idx);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/macro-indicators/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteMacroIndicator(req.params.id, userId);
    res.json({ success: true });
  });

  app.post("/api/macro-indicators/add-custom", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
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
        userId,
      });
      res.json(ind);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portfolio-red-flags", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const flags = await storage.getPortfolioRedFlags(userId);
    res.json(flags);
  });

  app.post("/api/portfolio-red-flags", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const flag = await storage.upsertPortfolioRedFlag({ ...req.body, userId });
    res.json(flag);
  });

  app.get("/api/models/:modelId/scenarios", async (req: Request<Params>, res: Response) => {
    const s = await storage.getScenarios(req.params.modelId);
    res.json(s);
  });

  app.post("/api/scenarios", async (req: Request<Params>, res: Response) => {
    const parsed = insertScenarioSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const s = await storage.createScenario(parsed.data);
    res.json(s);
  });

  app.delete("/api/scenarios/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteScenario(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/assumptions", async (req: Request<Params>, res: Response) => {
    const a = await storage.getAssumptions(req.params.modelId);
    res.json(a);
  });

  app.post("/api/assumptions", async (req: Request<Params>, res: Response) => {
    const parsed = insertAssumptionsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const a = await storage.createAssumptions(parsed.data);
    res.json(a);
  });

  app.patch("/api/assumptions/:id", async (req: Request<Params>, res: Response) => {
    const a = await storage.updateAssumptions(req.params.id, req.body);
    res.json(a);
  });

  app.get("/api/models/:modelId/actuals", async (req: Request<Params>, res: Response) => {
    const a = await storage.getActuals(req.params.modelId);
    res.json(a);
  });

  app.post("/api/actuals", async (req: Request<Params>, res: Response) => {
    const parsed = insertActualsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const a = await storage.createActual(parsed.data);
    res.json(a);
  });

  app.delete("/api/actuals/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteActual(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/models/:modelId/reports", async (req: Request<Params>, res: Response) => {
    const r = await storage.getReports(req.params.modelId);
    res.json(r);
  });

  app.post("/api/reports", async (req: Request<Params>, res: Response) => {
    const parsed = insertReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const r = await storage.createReport(parsed.data);
    res.json(r);
  });

  app.delete("/api/reports/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteReport(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/revenue-periods/:id", async (req: Request<Params>, res: Response) => {
    const updated = await storage.updateRevenuePeriod(req.params.id, req.body);
    res.json(updated);
  });

  app.patch("/api/models/:modelId/dcf-params", async (req: Request<Params>, res: Response) => {
    const existing = await storage.getDcfValuation(req.params.modelId);
    if (existing) {
      const updated = { ...existing, ...req.body };
      const result = await storage.upsertDcfValuation(updated);
      res.json(result);
    } else {
      res.status(404).json({ message: "No DCF data found" });
    }
  });

  app.post("/api/models/:modelId/recalculate", async (req: Request<Params>, res: Response) => {
    try {
      const result = await recalculateModel(req.params.modelId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Recalculation failed" });
    }
  });

  app.post("/api/models/:modelId/forecast-forward", async (req: Request<Params>, res: Response) => {
    try {
      const result = await forecastForward(req.params.modelId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Forecast failed" });
    }
  });

  app.patch("/api/models/:modelId/assumptions", async (req: Request<Params>, res: Response) => {
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

  app.get("/api/models/:modelId/yahoo-fundamentals", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const model = await storage.getModel(req.params.modelId, userId);
      if (!model) return res.status(404).json({ message: "Model not found" });
      if (!model.ticker) return res.status(400).json({ message: "No ticker set for this company. Set a ticker in Edit Company first." });

      const data = await fetchCompanyFundamentals(model.ticker);
      if (!data) return res.status(404).json({ message: `Could not fetch data for ticker ${model.ticker}` });

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch Yahoo data" });
    }
  });

  app.post("/api/models/:modelId/sync-yahoo", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const model = await storage.getModel(req.params.modelId, userId);
      if (!model) return res.status(404).json({ message: "Model not found" });
      if (!model.ticker) return res.status(400).json({ message: "No ticker set for this company." });

      const data = await fetchCompanyFundamentals(model.ticker);
      if (!data) return res.status(404).json({ message: `Could not fetch data for ticker ${model.ticker}` });

      const updates: Record<string, any> = {};
      if (data.sharesOutstanding > 0) updates.sharesOutstanding = data.sharesOutstanding;

      if (Object.keys(updates).length > 0) {
        await storage.updateModel(model.id, userId, updates);
      }

      const dcf = await storage.getDcfValuation(req.params.modelId);
      if (dcf) {
        const dcfUpdates: Record<string, any> = {};
        if (data.currentPrice > 0) dcfUpdates.currentSharePrice = data.currentPrice;
        if (data.beta > 0) dcfUpdates.beta = data.beta;
        if (Object.keys(dcfUpdates).length > 0) {
          await storage.upsertDcfValuation({ ...dcf, ...dcfUpdates } as any);
        }
      }

      const valComp = await storage.getValuationComparison(req.params.modelId);
      if (valComp && data.currentPrice > 0) {
        await storage.upsertValuationComparison({ ...valComp, currentSharePrice: data.currentPrice } as any);
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

  app.post("/api/parse-edgar", async (req: Request<Params>, res: Response) => {
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

  app.get("/api/sec/search/:ticker", async (req: Request<Params>, res: Response) => {
    try {
      const result = await searchCompanyByTicker(req.params.ticker);
      if (!result) return res.status(404).json({ message: `Ticker "${req.params.ticker}" not found on SEC EDGAR` });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "SEC search failed" });
    }
  });

  app.get("/api/sec/filings/:cik", async (req: Request<Params>, res: Response) => {
    try {
      const filings = await getCompanyFilings(req.params.cik);
      res.json(filings);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch filings" });
    }
  });

  app.post("/api/sec/parse-all-statements", async (req: Request<Params>, res: Response) => {
    try {
      const { filingUrl } = req.body;
      if (!filingUrl || typeof filingUrl !== "string") {
        return res.status(400).json({ message: "filingUrl is required" });
      }
      const result = await fetchAndParseAllStatements(filingUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to parse SEC filing" });
    }
  });

  app.post("/api/models/:modelId/import-sec", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const modelId = req.params.modelId;
      const model = await storage.getModel(modelId, userId);
      if (!model) return res.status(404).json({ message: "Model not found" });

      const { filingUrl, years: selectedYears } = req.body;
      if (!filingUrl) return res.status(400).json({ message: "filingUrl is required" });

      const allData = await fetchAndParseAllStatements(filingUrl);
      
      const importedYears = selectedYears || Array.from(new Set([
        ...allData.incomeStatement.years,
        ...allData.balanceSheet.years,
        ...allData.cashFlow.years,
      ])).sort();

      let newStartYear = model.startYear;
      let newEndYear = model.endYear;
      const minImportYear = Math.min(...importedYears);
      const maxImportYear = Math.max(...importedYears);
      if (minImportYear < newStartYear) newStartYear = minImportYear;
      if (maxImportYear > newEndYear) newEndYear = maxImportYear;

      if (newStartYear !== model.startYear || newEndYear !== model.endYear) {
        await storage.updateModel(modelId, userId, { startYear: newStartYear, endYear: newEndYear });
      }

      const existingLineItems = await storage.getRevenueLineItems(modelId);
      let totalRevLineItem = existingLineItems.find(li => li.name === "Total Revenue");
      if (!totalRevLineItem) {
        totalRevLineItem = await storage.createRevenueLineItem({
          modelId,
          name: "Total Revenue",
          sortOrder: 0,
        });
      }
      
      for (const year of importedYears) {
        const isData = allData.incomeStatement.data[year];
        const totalRevenue = isData?.totalRevenue || isData?.revenue || 0;
        if (totalRevenue > 0) {
          const perQuarter = totalRevenue / 4;
          const periodsToUpsert = [];
          for (let q = 1; q <= 4; q++) {
            periodsToUpsert.push({
              lineItemId: totalRevLineItem.id,
              modelId,
              year,
              quarter: q,
              amount: perQuarter,
              isActual: true,
            });
          }
          await storage.upsertRevenuePeriods(periodsToUpsert);
        }
      }

      for (const year of importedYears) {
        const isData = allData.incomeStatement.data[year];
        if (isData) {
          const totalRevenue = isData.totalRevenue || isData.revenue || 0;
          const cogs = Math.abs(isData.cogs || 0);
          const grossProfit = isData.grossProfit || (totalRevenue - cogs);
          const sgaExpense = Math.abs(isData.sgaExpense || 0);
          const rdExpense = Math.abs(isData.rdExpense || 0);
          const depreciation = Math.abs(isData.depreciation || 0);
          const totalExpenses = cogs + sgaExpense + rdExpense + depreciation;
          const operatingIncome = grossProfit - sgaExpense - rdExpense - depreciation;
          const ebitda = operatingIncome + depreciation;
          const otherIncome = isData.otherIncome || 0;
          const interestExpense = Math.abs(isData.interestExpense || 0);
          const preTaxIncome = operatingIncome + otherIncome - interestExpense;
          const taxExpense = Math.abs(isData.taxExpense || 0);
          const netIncome = isData.netIncome || (preTaxIncome - taxExpense);

          await storage.upsertIncomeStatementLine({
            modelId,
            year,
            isActual: true,
            revenue: totalRevenue,
            cogs,
            grossProfit,
            salesMarketing: sgaExpense,
            researchDevelopment: rdExpense,
            generalAdmin: 0,
            depreciation,
            totalExpenses,
            operatingIncome,
            ebitda,
            otherIncome,
            preTaxIncome,
            incomeTax: taxExpense,
            netIncome,
            grossMargin: totalRevenue > 0 ? grossProfit / totalRevenue : 0,
            operatingMargin: totalRevenue > 0 ? operatingIncome / totalRevenue : 0,
            netMargin: totalRevenue > 0 ? netIncome / totalRevenue : 0,
            effectiveTaxRate: preTaxIncome > 0 ? taxExpense / preTaxIncome : 0,
            interestExpense,
          } as any);
        }
      }

      for (const year of importedYears) {
        const bsData = allData.balanceSheet.data[year];
        if (bsData) {
          await storage.upsertBalanceSheetLine({
            modelId,
            year,
            isActual: true,
            cash: bsData.cashAndEquivalents || 0,
            shortTermInvestments: bsData.shortTermInvestments || 0,
            accountsReceivable: bsData.accountsReceivable || 0,
            inventory: bsData.inventory || 0,
            totalCurrentAssets: bsData.totalCurrentAssets || 0,
            equipment: bsData.propertyPlantEquipment || 0,
            depreciationAccum: 0,
            capex: 0,
            totalLongTermAssets: (bsData.totalAssets || 0) - (bsData.totalCurrentAssets || 0),
            totalAssets: bsData.totalAssets || 0,
            accountsPayable: bsData.accountsPayable || 0,
            shortTermDebt: bsData.shortTermDebt || 0,
            totalCurrentLiabilities: bsData.totalCurrentLiabilities || 0,
            longTermDebt: bsData.longTermDebt || 0,
            totalLongTermLiabilities: (bsData.totalLiabilities || 0) - (bsData.totalCurrentLiabilities || 0),
            totalLiabilities: bsData.totalLiabilities || 0,
            retainedEarnings: bsData.retainedEarnings || 0,
            commonShares: (bsData.commonStock || 0) + (bsData.additionalPaidInCapital || 0),
            totalEquity: bsData.totalEquity || 0,
            totalLiabilitiesAndEquity: bsData.totalLiabilitiesAndEquity || bsData.totalAssets || 0,
          });
        }
      }

      for (const year of importedYears) {
        const cfData = allData.cashFlow.data[year];
        if (cfData) {
          await storage.upsertCashFlowLine({
            modelId,
            year,
            isActual: true,
            netIncome: cfData.netIncome || 0,
            depreciationAdd: Math.abs(cfData.depreciationAdd || 0),
            arChange: cfData.arChange || 0,
            inventoryChange: cfData.inventoryChange || 0,
            apChange: cfData.apChange || 0,
            operatingCashFlow: cfData.operatingCashFlow || 0,
            capex: Math.abs(cfData.capex || 0),
            investingCashFlow: cfData.investingCashFlow || 0,
            shortTermDebtChange: 0,
            longTermDebtChange: cfData.longTermDebtChange || 0,
            commonSharesChange: cfData.commonSharesChange || 0,
            financingCashFlow: cfData.financingCashFlow || 0,
            netCashChange: cfData.netCashChange || 0,
            freeCashFlow: (cfData.operatingCashFlow || 0) - Math.abs(cfData.capex || 0),
          });
        }
      }

      await recalculateModel(modelId);

      res.json({
        message: "SEC data imported successfully",
        importedYears,
        yearRangeExpanded: newStartYear !== model.startYear || newEndYear !== model.endYear,
        newStartYear,
        newEndYear,
        statements: {
          incomeStatement: allData.incomeStatement.matchedFields.length,
          balanceSheet: allData.balanceSheet.matchedFields.length,
          cashFlow: allData.cashFlow.matchedFields.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "SEC import failed" });
    }
  });

  app.get("/api/crypto/search", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) return res.json([]);

      if (looksLikeContractAddress(q)) {
        const coin = await searchCoinByContract(q);
        if (coin) {
          return res.json([coin]);
        }
        const fallback = await searchCoins(q);
        return res.json(fallback);
      }

      const results = await searchCoins(q);
      res.json(results);
    } catch (err: any) {
      if (err.message === "RATE_LIMITED") {
        return res.status(429).json({ message: "CoinGecko rate limit reached. Please wait a moment and try again." });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const projects = await storage.getCryptoProjects(userId);
    res.json(projects);
  });

  app.get("/api/crypto/dashboard-summary", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const schedules = await storage.getAllSupplySchedulesForUser(userId);

      const now = new Date();
      const upcoming = schedules
        .filter(s => s.date && new Date(s.date) > now)
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

      const upcomingByProject: Record<string, { projectId: string; projectName: string; date: string; amount: number; label: string; eventType: string }> = {};
      for (const s of upcoming) {
        if (!upcomingByProject[s.projectId]) {
          upcomingByProject[s.projectId] = {
            projectId: s.projectId,
            projectName: s.projectName || "",
            date: s.date!,
            amount: s.amount,
            label: s.label,
            eventType: s.eventType,
          };
        }
      }

      res.json({
        upcomingUnlocks: Object.values(upcomingByProject).slice(0, 5),
        totalScheduleEvents: schedules.length,
        allSchedules: schedules.map(s => ({
          projectId: s.projectId,
          projectName: s.projectName,
          eventType: s.eventType,
          label: s.label,
          date: s.date,
          amount: s.amount,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.post("/api/crypto/projects", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { coingeckoId } = req.body;
      if (!coingeckoId) return res.status(400).json({ message: "coingeckoId is required" });
      let coinData;
      try {
        coinData = await getCoinMarketData(coingeckoId);
      } catch (fetchErr: any) {
        if (fetchErr.message === "RATE_LIMITED") {
          return res.status(429).json({ message: "CoinGecko rate limit reached. Please wait a few seconds and try again." });
        }
        return res.status(502).json({ message: `Could not reach CoinGecko API. Please try again shortly.` });
      }
      if (!coinData) return res.status(400).json({ message: `Could not find data for "${coingeckoId}"` });
      const projectData = mapCoinGeckoToProject(coinData);
      const project = await storage.createCryptoProject({ ...projectData, userId });

      const templateKey = coingeckoId.toLowerCase();
      if (INCENTIVE_TEMPLATES[templateKey]) {
        for (let i = 0; i < INCENTIVE_TEMPLATES[templateKey].length; i++) {
          const t = INCENTIVE_TEMPLATES[templateKey][i];
          await storage.createTokenIncentive({
            projectId: project.id,
            ...t,
            sortOrder: i,
          });
        }
      }

      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/crypto/projects/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const allowedFields = [
        "name", "symbol", "coingeckoId", "defiLlamaId", "category",
        "currentPrice", "marketCap", "fullyDilutedValuation", "volume24h",
        "priceChange24h", "priceChange7d", "circulatingSupply", "totalSupply",
        "maxSupply", "ath", "athDate", "sparklineData", "image",
        "governanceType", "votingMechanism", "treasurySize", "treasuryCurrency",
        "governanceNotes", "whitepaper", "discountRate", "feeGrowthRate", "terminalGrowthRate",
        "projectionYears", "chainId", "contractAddress", "stakingContract", "notes", "dataSources"
      ];
      const numericFields = ["currentPrice", "marketCap", "fullyDilutedValuation", "volume24h",
        "priceChange24h", "priceChange7d", "circulatingSupply", "totalSupply", "maxSupply", "ath",
        "treasurySize", "discountRate", "feeGrowthRate", "terminalGrowthRate"];
      const filtered: Record<string, any> = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) {
          const val = req.body[key];
          if (numericFields.includes(key)) {
            filtered[key] = val != null ? Number(val) : null;
          } else if (key === "projectionYears") {
            filtered[key] = val != null ? Math.max(1, Math.min(20, Number(val) || 5)) : 5;
          } else if (key === "whitepaper") {
            filtered[key] = typeof val === "string" && val.length > 0 ? val.slice(0, 200000) : val;
          } else {
            filtered[key] = val;
          }
        }
      }
      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const project = await storage.updateCryptoProject(req.params.id, userId, filtered);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/crypto/projects/:id", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteCryptoProject(req.params.id, userId);
    res.json({ success: true });
  });

  app.post("/api/crypto/projects/:id/parse-pdf", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { pdfBase64 } = req.body;
      if (!pdfBase64) return res.status(400).json({ message: "pdfBase64 is required" });

      const buffer = Buffer.from(pdfBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "File too large (max 10MB)" });
      }

      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const parsed = await pdfParse(buffer);
      const text = parsed.text?.trim() || "";

      if (!text) {
        return res.status(400).json({ message: "Could not extract text from PDF" });
      }

      const truncated = text.slice(0, 200000);
      await storage.updateCryptoProject(req.params.id, userId, { whitepaper: truncated });

      res.json({ text: truncated, length: truncated.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to parse PDF" });
    }
  });

  app.post("/api/crypto/projects/refresh", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const projects = await storage.getCryptoProjects(userId);
      if (projects.length === 0) return res.json({ updated: 0 });
      const ids = projects.map(p => p.coingeckoId);
      let marketData;
      try {
        marketData = await getMultipleCoinMarketData(ids);
      } catch (fetchErr: any) {
        if (fetchErr.message === "RATE_LIMITED") {
          return res.status(429).json({ message: "CoinGecko rate limit reached. Please wait a moment and try again." });
        }
        return res.status(502).json({ message: "Could not reach CoinGecko API. Please try again shortly." });
      }
      let updated = 0;
      for (const coin of marketData) {
        const project = projects.find(p => p.coingeckoId === coin.id);
        if (project) {
          const mapped = mapCoinGeckoToProject(coin);
          await storage.updateCryptoProject(project.id, userId, mapped);
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects/:id/supply-schedules", async (req: Request<Params>, res: Response) => {
    const schedules = await storage.getTokenSupplySchedules(req.params.id);
    res.json(schedules);
  });

  app.post("/api/crypto/supply-schedules", async (req: Request<Params>, res: Response) => {
    const parsed = insertTokenSupplyScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const schedule = await storage.createTokenSupplySchedule(parsed.data);
    res.json(schedule);
  });

  app.patch("/api/crypto/supply-schedules/:id", async (req: Request<Params>, res: Response) => {
    const schedule = await storage.updateTokenSupplySchedule(req.params.id, req.body);
    res.json(schedule);
  });

  app.delete("/api/crypto/supply-schedules/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteTokenSupplySchedule(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/crypto/projects/:id/incentives", async (req: Request<Params>, res: Response) => {
    const incentives = await storage.getTokenIncentives(req.params.id);
    res.json(incentives);
  });

  app.post("/api/crypto/incentives", async (req: Request<Params>, res: Response) => {
    const parsed = insertTokenIncentiveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const incentive = await storage.createTokenIncentive(parsed.data);
    res.json(incentive);
  });

  app.patch("/api/crypto/incentives/:id", async (req: Request<Params>, res: Response) => {
    const incentive = await storage.updateTokenIncentive(req.params.id, req.body);
    res.json(incentive);
  });

  app.delete("/api/crypto/incentives/:id", async (req: Request<Params>, res: Response) => {
    await storage.deleteTokenIncentive(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/crypto/incentive-templates/:key", async (req: Request<Params>, res: Response) => {
    const key = req.params.key.toLowerCase();
    const template = INCENTIVE_TEMPLATES[key];
    res.json(template || []);
  });

  app.get("/api/crypto/projects/:id/protocol-metrics", async (req: Request<Params>, res: Response) => {
    const metrics = await storage.getProtocolMetrics(req.params.id);
    res.json(metrics);
  });

  app.post("/api/crypto/projects/:id/fetch-defi-data", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const slug = project.defiLlamaId || project.name.toLowerCase().replace(/\s+/g, "-");

      const [tvlHistory, feesData, revenueData] = await Promise.all([
        getProtocolTVLHistory(slug),
        getProtocolFees(slug),
        getProtocolRevenue(slug),
      ]);

      const metricsMap: Record<string, any> = {};
      for (const t of tvlHistory) {
        metricsMap[t.date] = { date: t.date, tvl: t.tvl, dailyFees: 0, dailyRevenue: 0, dailyVolume: 0 };
      }
      for (const f of feesData) {
        if (!metricsMap[f.date]) metricsMap[f.date] = { date: f.date, tvl: 0, dailyFees: 0, dailyRevenue: 0, dailyVolume: 0 };
        metricsMap[f.date].dailyFees = f.dailyFees;
      }
      for (const r of revenueData) {
        if (!metricsMap[r.date]) metricsMap[r.date] = { date: r.date, tvl: 0, dailyFees: 0, dailyRevenue: 0, dailyVolume: 0 };
        metricsMap[r.date].dailyRevenue = r.dailyRevenue;
      }

      const metrics = Object.values(metricsMap).map((m: any) => ({
        projectId: project.id,
        ...m,
      }));

      await storage.deleteProtocolMetrics(project.id);
      if (metrics.length > 0) {
        await storage.upsertProtocolMetrics(metrics);
      }

      const latestMetrics = metrics.slice(-30);
      const defiSummary = {
        totalMetrics: metrics.length,
        latestTvl: latestMetrics.length > 0 ? latestMetrics[latestMetrics.length - 1].tvl : 0,
        latestFees: latestMetrics.length > 0 ? latestMetrics[latestMetrics.length - 1].dailyFees : 0,
        latestRevenue: latestMetrics.length > 0 ? latestMetrics[latestMetrics.length - 1].dailyRevenue : 0,
      };

      await storage.updateCryptoProject(project.id, userId, {
        defiLlamaId: slug,
        cachedDefiData: defiSummary,
        defiDataFetchedAt: new Date(),
      });

      res.json({ imported: metrics.length, slug });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/defillama/search", async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const results = await searchDefiLlamaProtocols(q);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects/:id/contract-address", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const info = await getCoinContractAddress(project.coingeckoId);
      if (!info) return res.json({ found: false });
      res.json({ found: true, ...info });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects/:id/cached-data", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const now = Date.now();
      const STALE_MS = 24 * 60 * 60 * 1000;
      const onchainAge = project.onchainDataFetchedAt ? now - new Date(project.onchainDataFetchedAt).getTime() : null;
      const defiAge = project.defiDataFetchedAt ? now - new Date(project.defiDataFetchedAt).getTime() : null;

      res.json({
        onchain: project.cachedOnchainData || null,
        onchainFetchedAt: project.onchainDataFetchedAt || null,
        onchainStale: onchainAge !== null ? onchainAge > STALE_MS : null,
        defi: project.cachedDefiData || null,
        defiFetchedAt: project.defiDataFetchedAt || null,
        defiStale: defiAge !== null ? defiAge > STALE_MS : null,
        chainId: project.chainId || null,
        contractAddress: project.contractAddress || null,
        stakingContract: project.stakingContract || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/crypto/projects/:id/onchain-data", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { tokenAddress, chainId, stakingContract } = req.body;
      if (!tokenAddress) return res.status(400).json({ message: "tokenAddress is required" });

      const isEvmChain = typeof chainId === "number" && chainId > 0;

      if (isEvmChain) {
        const data = await getOnChainTokenData(
          tokenAddress,
          chainId,
          stakingContract,
          project.circulatingSupply || undefined,
          project.totalSupply || undefined
        );
        const burnEstimate = estimateBurnFromSupply(project.totalSupply, project.maxSupply, project.circulatingSupply);
        if (data.burns.totalBurned === 0 && burnEstimate.hasBurnProgram) {
          data.burns.totalBurned = burnEstimate.totalBurned;
        }
        const result = { ...data, burnEstimate, chainType: "evm" };
        await storage.updateCryptoProject(project.id, userId, {
          cachedOnchainData: result,
          onchainDataFetchedAt: new Date(),
          chainId: String(chainId),
          contractAddress: tokenAddress,
          stakingContract: stakingContract || null,
        });
        res.json(result);
      } else {
        const burnEstimate = estimateBurnFromSupply(project.totalSupply, project.maxSupply, project.circulatingSupply);
        const chainLabel = chainId === "solana" ? "Solana" : String(chainId);
        const noteLines = [`On-chain queries not available for ${chainLabel}.`];
        if (burnEstimate.source === "max_supply_delta") {
          noteLines.push(`Burn data derived from CoinGecko: maxSupply (${formatNum(project.maxSupply)}) vs totalSupply (${formatNum(project.totalSupply)}).`);
        } else if (burnEstimate.source === "supply_gap") {
          noteLines.push(`Supply gap detected (${formatNum((project.totalSupply || 0) - (project.circulatingSupply || 0))} tokens locked/vesting). No confirmed burn program from supply data — use manual entry for known burns/buybacks.`);
        } else {
          noteLines.push("No burn signal from supply data. Use manual entry if this token has a burn/buyback program.");
        }
        const result = {
          burns: {
            totalBurned: burnEstimate.totalBurned,
            recentBurnRate: 0,
            burnEvents: 0,
          },
          staking: { stakedBalance: 0, stakingRatio: 0 },
          concentration: { top10Percent: 0, top50Percent: 0, holderCount: 0 },
          hasThirdwebData: false,
          burnEstimate,
          chainType: "non-evm",
          chainName: chainLabel,
          note: noteLines.join(" "),
        };
        await storage.updateCryptoProject(project.id, userId, {
          cachedOnchainData: result,
          onchainDataFetchedAt: new Date(),
          chainId: String(chainId),
          contractAddress: tokenAddress,
          stakingContract: stakingContract || null,
        });
        res.json(result);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crypto/projects/:id/revenue-forecasts", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const scenario = req.query.scenario as string | undefined;
    const forecasts = await storage.getRevenueForecasts(project.id, scenario);
    res.json(forecasts);
  });

  app.post("/api/crypto/projects/:id/revenue-forecasts", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const scenario = req.body.scenario || "base";
      await storage.deleteRevenueForecasts(project.id, scenario);
      const rows = (req.body.forecasts || []).map((f: any) => ({
        ...f,
        projectId: project.id,
        scenario,
      }));
      const result = await storage.upsertRevenueForecasts(rows);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/crypto/projects/:id/revenue-forecasts/seed", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const metrics = await storage.getProtocolMetrics(project.id);
      const incentives = await storage.getTokenIncentives(project.id);

      const yearlyFees: Record<number, number> = {};
      const yearlyRevenue: Record<number, number> = {};
      for (const m of metrics) {
        const year = parseInt(m.date.substring(0, 4));
        if (!isNaN(year)) {
          yearlyFees[year] = (yearlyFees[year] || 0) + (m.dailyFees || 0);
          yearlyRevenue[year] = (yearlyRevenue[year] || 0) + (m.dailyRevenue || 0);
        }
      }

      const years = Object.keys(yearlyFees).map(Number).sort();
      const lastYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear();
      const lastFees = yearlyFees[lastYear] || 0;
      const lastRevenue = yearlyRevenue[lastYear] || 0;
      const takeRate = lastFees > 0 ? lastRevenue / lastFees : 0.5;

      const totalEmissionPercent = incentives.reduce((sum, inc) => sum + (inc.allocationPercent || 0), 0);

      const baseGrowth = 0.15;
      const projYears = project.projectionYears || 5;
      const currentYear = new Date().getFullYear();

      const forecasts: any[] = [];
      for (const yr of years) {
        forecasts.push({
          projectId: project.id,
          year: yr,
          projectedFees: yearlyFees[yr] || 0,
          projectedRevenue: yearlyRevenue[yr] || 0,
          growthRate: 0,
          takeRate,
          emissionCost: 0,
          netValueAccrual: yearlyRevenue[yr] || 0,
          scenario: "base",
        });
      }

      for (let i = 1; i <= projYears; i++) {
        const yr = (lastYear < currentYear ? currentYear : lastYear) + i;
        const decay = Math.pow(0.85, i - 1);
        const growth = baseGrowth * decay;
        const prevFees = i === 1 ? lastFees : (forecasts[forecasts.length - 1]?.projectedFees || lastFees);
        const fees = prevFees * (1 + growth);
        const revenue = fees * takeRate;
        const emission = revenue * (totalEmissionPercent / 100) * Math.pow(0.8, i - 1);
        forecasts.push({
          projectId: project.id,
          year: yr,
          projectedFees: Math.round(fees),
          projectedRevenue: Math.round(revenue),
          growthRate: growth,
          takeRate,
          emissionCost: Math.round(emission),
          netValueAccrual: Math.round(revenue - emission),
          scenario: "base",
        });
      }

      await storage.deleteRevenueForecasts(project.id, "base");
      const result = await storage.upsertRevenueForecasts(forecasts);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/crypto/projects/:id/revenue-forecasts", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const scenario = req.query.scenario as string | undefined;
    await storage.deleteRevenueForecasts(project.id, scenario);
    res.json({ success: true });
  });

  app.get("/api/crypto/projects/:id/token-flows", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const entries = await storage.getTokenFlowEntries(project.id);
    res.json(entries);
  });

  app.post("/api/crypto/projects/:id/token-flows", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      await storage.deleteTokenFlowEntries(project.id);
      const rows = (req.body.entries || []).map((e: any) => ({
        ...e,
        projectId: project.id,
      }));
      const result = await storage.upsertTokenFlowEntries(rows);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/crypto/projects/:id/token-flows/seed", async (req: Request<Params>, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const project = await storage.getCryptoProject(req.params.id, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const schedules = await storage.getTokenSupplySchedules(project.id);
      const currentSupply = project.circulatingSupply || 0;
      const totalSupply = project.totalSupply || currentSupply;
      const maxSupply = project.maxSupply || totalSupply;

      const burnEstimate = estimateBurnFromSupply(project.totalSupply, project.maxSupply, project.circulatingSupply);

      const periods = 12;
      const entries: any[] = [];
      let cumSupply = currentSupply;

      const totalScheduleTokens = schedules.reduce((sum, s) => sum + (s.amount || 0), 0);
      const avgUnlockPerPeriod = totalScheduleTokens > 0 ? totalScheduleTokens / periods : 0;

      let estimatedBurnPerQuarter = currentSupply * 0.001;
      let estimatedBuybackPerQuarter = 0;

      const estimatedStaking = currentSupply * 0.02;

      for (let i = 0; i < periods; i++) {
        const unlocks = avgUnlockPerPeriod * Math.pow(0.9, i);
        const minting = i < 6 ? (maxSupply - totalSupply) * 0.01 * Math.pow(0.85, i) : 0;
        const burns = estimatedBurnPerQuarter;
        const buybacks = estimatedBuybackPerQuarter;
        const staking = estimatedStaking * Math.pow(0.95, i);
        const netFlow = minting + unlocks - burns - buybacks - staking;
        cumSupply += netFlow;

        entries.push({
          projectId: project.id,
          period: i + 1,
          periodLabel: `Q${(i % 4) + 1} ${new Date().getFullYear() + Math.floor(i / 4)}`,
          minting: Math.round(minting),
          unlocks: Math.round(unlocks),
          burns: Math.round(burns),
          buybacks: Math.round(buybacks),
          stakingLockups: Math.round(staking),
          netFlow: Math.round(netFlow),
          cumulativeSupply: Math.round(cumSupply),
        });
      }

      await storage.deleteTokenFlowEntries(project.id);
      const result = await storage.upsertTokenFlowEntries(entries);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/crypto/projects/:id/token-flows", async (req: Request<Params>, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    await storage.deleteTokenFlowEntries(project.id);
    res.json({ success: true });
  });

  app.get("/api/crypto/projects/:id/allocations", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const allocations = await storage.getTokenAllocations(project.id);
    res.json(allocations);
  });

  app.post("/api/crypto/projects/:id/allocations", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const allocation = await storage.createTokenAllocation({ ...req.body, projectId: project.id });
    res.json(allocation);
  });

  app.post("/api/crypto/projects/:id/allocations/seed", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const existing = await storage.getTokenAllocations(project.id);
    if (existing.length > 0) return res.status(400).json({ message: "Allocations already exist. Clear them first to re-seed." });

    const { lookupCuratedAllocations, mapCuratedToAllocations, researchAllocationsWithAI, mapAIToAllocations } = await import("./crypto-data");
    let allocationsToCreate: Record<string, unknown>[] = [];
    let source = "fallback";

    // Priority 1: Curated verified data
    const slugsToTry = [project.symbol, project.coingeckoId, project.name].filter(Boolean) as string[];
    for (const s of slugsToTry) {
      const curatedData = lookupCuratedAllocations(s);
      if (curatedData) {
        allocationsToCreate = mapCuratedToAllocations(curatedData, project.id);
        source = "curated";
        break;
      }
    }

    // Priority 2: AI-powered research
    if (allocationsToCreate.length === 0) {
      try {
        const tokenName = project.name || "";
        const tokenSymbol = project.symbol || "";
        const totalSupply = project.totalSupply || project.maxSupply || null;
        const aiResult = await researchAllocationsWithAI(tokenName, tokenSymbol, totalSupply, (project as any).dataSources);
        if (aiResult && aiResult.allocations.length > 0) {
          allocationsToCreate = mapAIToAllocations(aiResult, project.id, totalSupply);
          source = `ai-researched:${aiResult.confidence}`;
        }
      } catch (err) {
        console.error("AI allocation research failed, falling back to template:", err);
      }
    }

    // Priority 3: Generic industry-average template
    if (allocationsToCreate.length === 0) {
      const totalSupply = project.totalSupply || project.maxSupply || 0;
      allocationsToCreate = [
        { projectId: project.id, category: "Founder & Team", standardGroup: "team", percentage: 20, amount: totalSupply ? totalSupply * 0.20 : null, vestingMonths: 48, cliffMonths: 12, tgePercent: 0, vestingType: "linear", dataSource: "Industry Average", description: "Core contributors, advisors, partners", notes: null, sortOrder: 0 },
        { projectId: project.id, category: "Private Investors", standardGroup: "investors", percentage: 16, amount: totalSupply ? totalSupply * 0.16 : null, vestingMonths: 36, cliffMonths: 6, tgePercent: 0, vestingType: "linear", dataSource: "Industry Average", description: "Seed, Series A/B, strategic rounds", notes: null, sortOrder: 1 },
        { projectId: project.id, category: "Public Sale", standardGroup: "public", percentage: 5, amount: totalSupply ? totalSupply * 0.05 : null, vestingMonths: 0, cliffMonths: 0, tgePercent: 100, vestingType: "immediate", dataSource: "Industry Average", description: "ICO, IEO, IDO, public sale", notes: null, sortOrder: 2 },
        { projectId: project.id, category: "Treasury & Reserve", standardGroup: "treasury", percentage: 27, amount: totalSupply ? totalSupply * 0.27 : null, vestingMonths: 30, cliffMonths: 0, tgePercent: 10, vestingType: "linear", dataSource: "Industry Average", description: "Foundation funds, ecosystem, future initiatives", notes: null, sortOrder: 3 },
        { projectId: project.id, category: "Community & Ecosystem", standardGroup: "community", percentage: 32, amount: totalSupply ? totalSupply * 0.32 : null, vestingMonths: 30, cliffMonths: 0, tgePercent: 5, vestingType: "linear", dataSource: "Industry Average", description: "Airdrops, staking rewards, liquidity mining, grants", notes: null, sortOrder: 4 },
      ];
    }

    const results = [];
    for (const alloc of allocationsToCreate) {
      const created = await storage.createTokenAllocation(alloc as any);
      results.push(created);
    }
    res.json({ source, allocations: results });
  });

  app.delete("/api/crypto/projects/:id/allocations/clear", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    await storage.deleteAllTokenAllocations(project.id);
    res.json({ success: true });
  });

  app.patch("/api/crypto/allocations/:id", async (req: Request, res: Response) => {
    const allocation = await storage.updateTokenAllocation(req.params.id as string, req.body);
    res.json(allocation);
  });

  app.delete("/api/crypto/allocations/:id", async (req: Request, res: Response) => {
    await storage.deleteTokenAllocation(req.params.id as string);
    res.json({ success: true });
  });

  app.get("/api/crypto/projects/:id/fundraising", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const rounds = await storage.getFundraisingRounds(project.id);
    res.json(rounds);
  });

  app.post("/api/crypto/projects/:id/fundraising", async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const project = await storage.getCryptoProject(req.params.id as string, userId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const round = await storage.createFundraisingRound({ ...req.body, projectId: project.id });
    res.json(round);
  });

  app.patch("/api/crypto/fundraising/:id", async (req: Request, res: Response) => {
    const round = await storage.updateFundraisingRound(req.params.id as string, req.body);
    res.json(round);
  });

  app.delete("/api/crypto/fundraising/:id", async (req: Request, res: Response) => {
    await storage.deleteFundraisingRound(req.params.id as string);
    res.json({ success: true });
  });

  app.post("/api/copilot", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { modelId, cryptoProjectId, message, history, context: contextType } = req.body;
      if (!message) {
        return res.status(400).json({ message: "message is required" });
      }
      if (!modelId && !cryptoProjectId && contextType !== "crypto-dashboard" && contextType !== "general") {
        return res.status(400).json({ message: "modelId, cryptoProjectId, or context type is required" });
      }
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();

      let clientDisconnected = false;
      res.on("close", () => {
        clientDisconnected = true;
      });

      try {
        await streamCopilotToResponse(
          { modelId, cryptoProjectId, contextType },
          userId,
          message,
          history || [],
          res,
          () => clientDisconnected
        );
      } catch (streamErr: any) {
        console.error("Copilot stream error:", streamErr);
        res.write(`data: ${JSON.stringify({ error: streamErr.message || "Stream error" })}\n\n`);
      }
      if (!clientDisconnected) {
        res.write(`data: [DONE]\n\n`);
      }
      res.end();
    } catch (err: any) {
      console.error("Copilot error:", err.message || err);
      if (!res.headersSent) {
        res.status(500).json({ message: err.message || "Copilot error" });
      } else {
        res.end();
      }
    }
  });

  const isAdmin = async (req: Request, res: Response, next: Function) => {
    const userId = (req as any).user?.claims?.sub as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
    next();
  };

  app.get("/api/admin/stats", isAdmin as any, async (_req: Request, res: Response) => {
    const [userCount] = await db.select({ value: count() }).from(users);
    const [modelCount] = await db.select({ value: count() }).from(financialModels);
    const [positionCount] = await db.select({ value: count() }).from(portfolioPositions);
    const [cryptoCount] = await db.select({ value: count() }).from(cryptoProjects);
    res.json({
      users: userCount.value,
      models: modelCount.value,
      positions: positionCount.value,
      cryptoProjects: cryptoCount.value,
    });
  });

  app.get("/api/admin/users", isAdmin as any, async (_req: Request, res: Response) => {
    const allUsers = await db.select().from(users);
    const modelsPerUser = await db
      .select({ userId: financialModels.userId, value: count() })
      .from(financialModels)
      .groupBy(financialModels.userId);
    const positionsPerUser = await db
      .select({ userId: portfolioPositions.userId, value: count() })
      .from(portfolioPositions)
      .groupBy(portfolioPositions.userId);

    const enriched = allUsers.map((u) => ({
      ...u,
      modelCount: modelsPerUser.find((m) => m.userId === u.id)?.value ?? 0,
      positionCount: positionsPerUser.find((p) => p.userId === u.id)?.value ?? 0,
    }));
    res.json(enriched);
  });

  app.patch("/api/admin/users/:id", isAdmin as any, async (req: Request<Params>, res: Response) => {
    const currentUserId = (req as any).user?.claims?.sub as string;
    const { isAdmin: makeAdmin } = req.body;
    if (typeof makeAdmin !== "boolean") return res.status(400).json({ message: "isAdmin must be boolean" });
    if (req.params.id === currentUserId) return res.status(400).json({ message: "Cannot modify your own admin status" });
    const [updated] = await db.update(users).set({ isAdmin: makeAdmin }).where(eq(users.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  });

}
