import { getCoinMarketData, getMultipleCoinMarketData, researchAllocationsWithAI } from "./crypto-data";
import { db } from "./db";
import { emissionsCache as emissionsCacheTable, aiResearchCache } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  toAllocationInput,
  aggregateProjectEmissions,
  type AllocationInput,
} from "./emissions-engine";

export interface EmissionAllocation {
  category: string;
  standardGroup: string;
  percentage: number;
  totalTokens: number;
  vestingType: string;
  cliffMonths: number;
  vestingMonths: number;
  tgePercent: number;
  monthlyValues: number[];
}

export interface EmissionToken {
  name: string;
  symbol: string;
  coingeckoId: string;
  totalSupply: number;
  circulatingSupply: number;
  maxSupply: number | null;
  currentPrice: number;
  marketCap: number;
  image: string;
  category?: string;
}

export interface EmissionsData {
  token: EmissionToken;
  months: string[];
  allocations: EmissionAllocation[];
  totalSupplyTimeSeries: number[];
  inflationRate: number[];
  cliffEvents: { month: string; label: string; amount: number }[];
  confidence: string;
  notes: string;
}

export interface MarketEmissionsRow {
  month: string;
  totalValueUnlock: number;
  cliffValueUnlock: number;
  linearValueUnlock: number;
}

export interface CompareEmissionRow {
  project: string;
  symbol: string;
  image: string;
  coingeckoId: string;
  totalUnlockPct: number;
  cliffUnlockPct: number;
  linearUnlockPct: number;
  circulatingPct: number;
  lockedPct: number;
  unlockValue: number;
  marketCap: number;
  currentPrice: number;
  totalSupply: number;
  circulatingSupply: number;
}

export interface InflationPeriodMetrics {
  coingeckoId: string;
  symbol: string;
  name: string;
  image: string;
  year1Inflation: number;
  year2Inflation: number;
  year3Inflation: number;
  currentInflation: number;
}

const memCache = new Map<string, { data: EmissionsData; timestamp: number }>();
const MEM_CACHE_TTL = 10 * 60 * 1000;

async function upsertAiResearch(coingeckoId: string, researchType: string, aiResult: any): Promise<void> {
  const [existing] = await db.select().from(aiResearchCache)
    .where(and(eq(aiResearchCache.coingeckoId, coingeckoId), eq(aiResearchCache.researchType, researchType)))
    .limit(1);
  if (existing) {
    await db.update(aiResearchCache)
      .set({ data: aiResult, confidence: aiResult.confidence, notes: aiResult.notes, researchedAt: new Date() })
      .where(eq(aiResearchCache.id, existing.id));
  } else {
    await db.insert(aiResearchCache).values({
      coingeckoId, researchType,
      data: aiResult, confidence: aiResult.confidence, notes: aiResult.notes,
    });
  }
}

async function refreshMarketData(data: EmissionsData): Promise<EmissionsData> {
  try {
    const marketData = await getCoinMarketData(data.token.coingeckoId);
    if (marketData) {
      data.token.currentPrice = marketData.current_price;
      data.token.marketCap = marketData.market_cap;
      data.token.circulatingSupply = marketData.circulating_supply || data.token.circulatingSupply;
      data.token.image = marketData.image || data.token.image;
    }
  } catch (e) {
  }
  return data;
}

export async function getTokenEmissions(coingeckoId: string): Promise<EmissionsData | null> {
  const mem = memCache.get(coingeckoId);
  if (mem && Date.now() - mem.timestamp < MEM_CACHE_TTL) {
    return mem.data;
  }

  try {
    const [dbRow] = await db.select().from(emissionsCacheTable).where(eq(emissionsCacheTable.coingeckoId, coingeckoId)).limit(1);
    if (dbRow) {
      const data = await refreshMarketData(dbRow.data as EmissionsData);
      memCache.set(coingeckoId, { data, timestamp: Date.now() });
      return data;
    }
  } catch (e) {
  }

  const marketData = await getCoinMarketData(coingeckoId);
  if (!marketData) return null;

  const totalSupply = marketData.max_supply || marketData.total_supply || 0;
  const circulatingSupply = marketData.circulating_supply || 0;
  const tokenName = marketData.name;
  const tokenSymbol = (marketData.symbol || "").toUpperCase();

  let aiResult: any = null;
  try {
    const [cachedResearch] = await db.select().from(aiResearchCache)
      .where(and(eq(aiResearchCache.coingeckoId, coingeckoId), eq(aiResearchCache.researchType, "allocations")))
      .limit(1);
    if (cachedResearch) {
      aiResult = cachedResearch.data;
    }
  } catch (e) {}

  if (!aiResult) {
    aiResult = await researchAllocationsWithAI(tokenName, tokenSymbol, totalSupply);
    if (aiResult && aiResult.allocations && aiResult.allocations.length > 0) {
      try {
        await upsertAiResearch(coingeckoId, "allocations", aiResult);
      } catch (e) {}
    }
  }

  if (!aiResult || !aiResult.allocations || aiResult.allocations.length === 0) {
    return null;
  }

  const result = buildEmissionsResult(
    coingeckoId, tokenName, tokenSymbol, totalSupply, circulatingSupply,
    marketData, aiResult
  );

  memCache.set(coingeckoId, { data: result, timestamp: Date.now() });

  try {
    await db.insert(emissionsCacheTable)
      .values({
        coingeckoId,
        category: getTokenCategory(coingeckoId) || null,
        data: result,
      })
      .onConflictDoUpdate({
        target: emissionsCacheTable.coingeckoId,
        set: {
          category: getTokenCategory(coingeckoId) || null,
          data: result,
          updatedAt: new Date(),
        },
      });
  } catch (e) {
  }

  return result;
}

function calibrateBySupply(
  totalCumulativeSupply: number[],
  circulatingSupply: number,
): number {
  if (circulatingSupply <= 0 || totalCumulativeSupply.length === 0) return -1;

  if (circulatingSupply <= totalCumulativeSupply[0]) return -1;

  const lastVal = totalCumulativeSupply[totalCumulativeSupply.length - 1];
  if (circulatingSupply >= lastVal) return totalCumulativeSupply.length - 1;

  for (let i = 0; i < totalCumulativeSupply.length - 1; i++) {
    const cur = totalCumulativeSupply[i];
    const next = totalCumulativeSupply[i + 1];
    if (circulatingSupply >= cur && circulatingSupply <= next) {
      if (next === cur) return i;
      const frac = (circulatingSupply - cur) / (next - cur);
      return frac >= 0.5 ? i + 1 : i;
    }
  }

  return -1;
}

function calibrateByDate(marketData: any, aiResult: any): { tgeDate: Date; monthsElapsed: number } | null {
  let tgeDate: Date | null = null;

  if (aiResult.tgeDate) {
    const parsed = new Date(aiResult.tgeDate);
    if (!isNaN(parsed.getTime())) {
      tgeDate = parsed;
    }
  }

  if (!tgeDate) {
    const athDate = marketData.ath_date ? new Date(marketData.ath_date) : null;
    if (athDate && !isNaN(athDate.getTime())) {
      tgeDate = athDate;
    }
  }

  if (!tgeDate) return null;

  const now = new Date();
  tgeDate.setDate(1);
  if (tgeDate > now) return null;

  const monthsElapsed = (now.getFullYear() - tgeDate.getFullYear()) * 12 + (now.getMonth() - tgeDate.getMonth());
  return { tgeDate, monthsElapsed: Math.max(0, monthsElapsed) };
}

function buildEmissionsResult(
  coingeckoId: string,
  tokenName: string,
  tokenSymbol: string,
  totalSupply: number,
  circulatingSupply: number,
  marketData: any,
  aiResult: any
): EmissionsData {
  const SCHEDULE_MONTHS = 120;
  const OUTPUT_MONTHS = 60;
  const now = new Date();

  const inputs: AllocationInput[] = aiResult.allocations.map((a: any) =>
    toAllocationInput(a, totalSupply)
  );

  const project = aggregateProjectEmissions(inputs, SCHEDULE_MONTHS);

  let scheduleNowIdx = calibrateBySupply(project.totalCumulativeSupply, circulatingSupply);

  let anchorMonth: Date;

  if (scheduleNowIdx >= 0) {
    anchorMonth = new Date(now.getFullYear(), now.getMonth() - scheduleNowIdx, 1);
  } else {
    const dateCalibration = calibrateByDate(marketData, aiResult);
    if (dateCalibration && dateCalibration.monthsElapsed > 0) {
      scheduleNowIdx = Math.min(dateCalibration.monthsElapsed, SCHEDULE_MONTHS - 1);
      anchorMonth = new Date(dateCalibration.tgeDate);
    } else {
      scheduleNowIdx = 0;
      anchorMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  const endIdx = Math.min(scheduleNowIdx + OUTPUT_MONTHS, SCHEDULE_MONTHS);
  const startIdx = Math.max(0, endIdx - OUTPUT_MONTHS);
  const sliceLen = endIdx - startIdx;

  const timeSeriesMonths: string[] = [];
  for (let m = 0; m < sliceLen; m++) {
    const d = new Date(anchorMonth);
    d.setMonth(d.getMonth() + startIdx + m);
    timeSeriesMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const allocations: EmissionAllocation[] = project.allocations.map((s) => ({
    category: s.category,
    standardGroup: s.standardGroup,
    percentage: s.percentage,
    totalTokens: s.totalTokens,
    vestingType: s.vestingType,
    cliffMonths: s.cliffMonths,
    vestingMonths: s.vestingMonths,
    tgePercent: s.tgePercent,
    monthlyValues: s.cumulativeSupply.slice(startIdx, endIdx),
  }));

  const cliffEvents = project.cliffEvents
    .filter((e) => e.monthIndex >= startIdx && e.monthIndex < endIdx)
    .map((e) => ({
      month: timeSeriesMonths[e.monthIndex - startIdx] || "",
      label: e.label,
      amount: e.amount,
    }));

  const totalSupplySlice = project.totalCumulativeSupply.slice(startIdx, endIdx);
  const inflationSlice = project.monthlyInflationRate.slice(startIdx, endIdx);

  return {
    token: {
      name: tokenName,
      symbol: tokenSymbol,
      coingeckoId,
      totalSupply,
      circulatingSupply,
      maxSupply: marketData.max_supply,
      currentPrice: marketData.current_price,
      marketCap: marketData.market_cap,
      image: marketData.image,
      category: getTokenCategory(coingeckoId) || undefined,
    },
    months: timeSeriesMonths,
    allocations,
    totalSupplyTimeSeries: totalSupplySlice,
    inflationRate: inflationSlice,
    cliffEvents,
    confidence: aiResult.confidence,
    notes: aiResult.notes,
  };
}

export function computeCompareMetrics(emissions: EmissionsData[]): CompareEmissionRow[] {
  return emissions.map((d) => {
    const totalSupply = d.token.totalSupply || 1;
    const circSupply = d.token.circulatingSupply || 0;
    const circulatingPct = (circSupply / totalSupply) * 100;
    const lockedPct = 100 - circulatingPct;

    let totalCliffUnlock = 0;
    let totalLinearUnlock = 0;
    for (const a of d.allocations) {
      const tokens = a.totalTokens;
      const tgeTokens = Math.round(tokens * (a.tgePercent || 0) / 100);
      const remaining = tokens - tgeTokens;
      if (a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear")) {
        totalCliffUnlock += remaining;
      } else if (a.vestingType === "linear" || a.vestingMonths > 0) {
        totalLinearUnlock += remaining;
      }
    }

    const cliffUnlockPct = (totalCliffUnlock / totalSupply) * 100;
    const linearUnlockPct = (totalLinearUnlock / totalSupply) * 100;
    const totalUnlockPct = cliffUnlockPct + linearUnlockPct;
    const unlockValue = (totalCliffUnlock + totalLinearUnlock) * d.token.currentPrice;

    return {
      project: d.token.name,
      symbol: d.token.symbol,
      image: d.token.image,
      coingeckoId: d.token.coingeckoId,
      totalUnlockPct,
      cliffUnlockPct,
      linearUnlockPct,
      circulatingPct,
      lockedPct,
      unlockValue,
      marketCap: d.token.marketCap,
      currentPrice: d.token.currentPrice,
      totalSupply: d.token.totalSupply,
      circulatingSupply: d.token.circulatingSupply,
    };
  });
}

export function computeMarketEmissions(emissions: EmissionsData[]): MarketEmissionsRow[] {
  if (emissions.length === 0) return [];

  const maxMonths = Math.max(...emissions.map((d) => d.months.length));
  const refData = emissions.reduce((best, d) => d.months.length > best.months.length ? d : best, emissions[0]);

  return refData.months.map((month, i) => {
    let totalVal = 0;
    let cliffVal = 0;
    let linearVal = 0;

    for (const d of emissions) {
      const price = d.token.currentPrice || 0;
      for (const a of d.allocations) {
        if (i >= a.monthlyValues.length) continue;
        const prev = i > 0 ? a.monthlyValues[i - 1] : 0;
        const curr = a.monthlyValues[i];
        const delta = Math.max(curr - prev, 0);
        const val = delta * price;
        totalVal += val;

        if (a.vestingType === "cliff" || (a.cliffMonths > 0 && a.vestingType !== "linear")) {
          cliffVal += val;
        } else if (a.vestingType === "linear" || a.vestingMonths > 0) {
          linearVal += val;
        }
      }
    }

    return { month, totalValueUnlock: totalVal, cliffValueUnlock: cliffVal, linearValueUnlock: linearVal };
  });
}

export function computeInflationPeriods(emissions: EmissionsData[]): InflationPeriodMetrics[] {
  return emissions.map((d) => {
    const rates = d.inflationRate;
    const year1Rates = rates.slice(0, 12);
    const year2Rates = rates.slice(12, 24);
    const year3Rates = rates.slice(24, 36);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const annualize = (monthlyAvg: number) => {
      return ((1 + monthlyAvg / 100) ** 12 - 1) * 100;
    };

    return {
      coingeckoId: d.token.coingeckoId,
      symbol: d.token.symbol,
      name: d.token.name,
      image: d.token.image,
      year1Inflation: annualize(avg(year1Rates)),
      year2Inflation: annualize(avg(year2Rates)),
      year3Inflation: annualize(avg(year3Rates)),
      currentInflation: rates.length > 0 ? annualize(rates[rates.length - 1]) : 0,
    };
  });
}

export function getCachedEmissions(coingeckoId: string): EmissionsData | null {
  const cached = memCache.get(coingeckoId);
  if (cached && Date.now() - cached.timestamp < MEM_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export async function getBatchTokenEmissions(
  coingeckoIds: string[],
  onProgress?: (id: string, data: EmissionsData | null) => void,
): Promise<Map<string, EmissionsData>> {
  const result = new Map<string, EmissionsData>();
  const needsDbLookup: string[] = [];
  const needsFreshFetch: string[] = [];

  for (const id of coingeckoIds) {
    const mem = memCache.get(id);
    if (mem && Date.now() - mem.timestamp < MEM_CACHE_TTL) {
      result.set(id, mem.data);
    } else {
      needsDbLookup.push(id);
    }
  }

  if (needsDbLookup.length > 0) {
    try {
      const dbRows = await db.select().from(emissionsCacheTable)
        .where(inArray(emissionsCacheTable.coingeckoId, needsDbLookup));
      for (const row of dbRows) {
        const data = row.data as EmissionsData;
        result.set(row.coingeckoId, data);
        memCache.set(row.coingeckoId, { data, timestamp: Date.now() });
      }
    } catch (e) {
    }
    for (const id of needsDbLookup) {
      if (!result.has(id)) needsFreshFetch.push(id);
    }
  }

  const allIdsNeedingMarketRefresh = [...needsDbLookup.filter(id => result.has(id)), ...needsFreshFetch];
  if (allIdsNeedingMarketRefresh.length > 0 || result.size > 0) {
    try {
      const allIdsForPrices = coingeckoIds.filter(id => result.has(id) || needsFreshFetch.includes(id));
      if (allIdsForPrices.length > 0) {
        const marketDataArr = await getMultipleCoinMarketData(allIdsForPrices);
        const marketMap = new Map(marketDataArr.map(m => [m.id, m]));

        for (const id of Array.from(result.keys())) {
          const data = result.get(id)!;
          const md = marketMap.get(id);
          if (md) {
            data.token.currentPrice = md.current_price;
            data.token.marketCap = md.market_cap;
            data.token.circulatingSupply = md.circulating_supply || data.token.circulatingSupply;
            data.token.image = md.image || data.token.image;
          }
        }

        for (const id of needsFreshFetch) {
          const md = marketMap.get(id);
          if (md) {
            try {
              const emissions = await buildEmissionsFromMarketData(id, md);
              if (emissions) {
                result.set(id, emissions);
                memCache.set(id, { data: emissions, timestamp: Date.now() });
                onProgress?.(id, emissions);
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (e) {
    }
  }

  return result;
}

async function buildEmissionsFromMarketData(coingeckoId: string, marketData: any): Promise<EmissionsData | null> {
  const totalSupply = marketData.max_supply || marketData.total_supply || 0;
  const circulatingSupply = marketData.circulating_supply || 0;
  const tokenName = marketData.name;
  const tokenSymbol = (marketData.symbol || "").toUpperCase();

  let aiResult: any = null;
  try {
    const [cachedResearch] = await db.select().from(aiResearchCache)
      .where(and(eq(aiResearchCache.coingeckoId, coingeckoId), eq(aiResearchCache.researchType, "allocations")))
      .limit(1);
    if (cachedResearch) {
      aiResult = cachedResearch.data;
    }
  } catch (e) {}

  if (!aiResult) {
    aiResult = await researchAllocationsWithAI(tokenName, tokenSymbol, totalSupply);
    if (aiResult && aiResult.allocations && aiResult.allocations.length > 0) {
      try {
        await upsertAiResearch(coingeckoId, "allocations", aiResult);
      } catch (e) {}
    }
  }

  if (!aiResult || !aiResult.allocations || aiResult.allocations.length === 0) {
    return null;
  }

  const emissionsResult = buildEmissionsResult(
    coingeckoId, tokenName, tokenSymbol, totalSupply, circulatingSupply,
    marketData, aiResult
  );

  try {
    await db.insert(emissionsCacheTable)
      .values({
        coingeckoId,
        category: getTokenCategory(coingeckoId) || null,
        data: emissionsResult,
      })
      .onConflictDoUpdate({
        target: emissionsCacheTable.coingeckoId,
        set: {
          category: getTokenCategory(coingeckoId) || null,
          data: emissionsResult,
          updatedAt: new Date(),
        },
      });
  } catch (e) {
  }

  return emissionsResult;
}

export const TOKEN_CATEGORIES: Record<string, string[]> = {
  "Layer 1": ["bitcoin", "ethereum", "solana", "cardano", "avalanche-2", "aptos", "sui", "celestia", "near", "polkadot"],
  "Layer 2": ["arbitrum", "optimism", "starknet", "polygon-ecosystem-token", "mantle", "base-protocol", "zksync", "scroll"],
  "DeFi": ["uniswap", "aave", "lido-dao", "maker", "curve-dao-token", "compound-governance-token", "gmx", "pendle", "jupiter-exchange-solana"],
  "Perpetuals": ["gmx", "dydx-chain", "gains-network", "hyperliquid", "vertex-protocol"],
  "RWA": ["ondo-finance", "centrifuge", "maple-finance", "goldfinch", "clearpool"],
  "Gaming": ["immutable-x", "the-sandbox", "axie-infinity", "gala", "ronin", "beam-2"],
  "AI": ["render-token", "fetch-ai", "singularitynet", "ocean-protocol", "bittensor", "worldcoin-wld"],
  "Meme": ["dogecoin", "shiba-inu", "pepe", "floki", "bonk", "dogwifcoin"],
};

export function getTokenCategory(coingeckoId: string): string | null {
  for (const [category, ids] of Object.entries(TOKEN_CATEGORIES)) {
    if (ids.includes(coingeckoId)) return category;
  }
  return null;
}
