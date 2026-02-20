import { getCoinMarketData, researchAllocationsWithAI } from "./crypto-data";

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

const emissionsCache = new Map<string, { data: EmissionsData; timestamp: number }>();
const EMISSIONS_CACHE_TTL = 30 * 60 * 1000;

export async function getTokenEmissions(coingeckoId: string): Promise<EmissionsData | null> {
  const cached = emissionsCache.get(coingeckoId);
  if (cached && Date.now() - cached.timestamp < EMISSIONS_CACHE_TTL) {
    return cached.data;
  }

  const marketData = await getCoinMarketData(coingeckoId);
  if (!marketData) return null;

  const totalSupply = marketData.max_supply || marketData.total_supply || 0;
  const circulatingSupply = marketData.circulating_supply || 0;
  const tokenName = marketData.name;
  const tokenSymbol = (marketData.symbol || "").toUpperCase();

  const aiResult = await researchAllocationsWithAI(tokenName, tokenSymbol, totalSupply);

  if (!aiResult || !aiResult.allocations || aiResult.allocations.length === 0) {
    return null;
  }

  const MONTHS = 60;
  const now = new Date();
  const tgeGuess = new Date(marketData.ath_date || now);
  tgeGuess.setDate(1);
  if (tgeGuess > now) tgeGuess.setFullYear(now.getFullYear() - 2);

  const timeSeriesMonths: string[] = [];
  for (let m = 0; m < MONTHS; m++) {
    const d = new Date(tgeGuess);
    d.setMonth(d.getMonth() + m);
    timeSeriesMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const allocations: EmissionAllocation[] = aiResult.allocations.map((a) => {
    const pct = a.percentage || 0;
    const tokens = totalSupply ? Math.round(totalSupply * pct / 100) : 0;
    const cliffM = a.cliffMonths || 0;
    const vestM = a.vestingMonths || 0;
    const tgePct = a.tgePercent || 0;
    const vType = a.vestingType || "linear";

    const tgeTokens = Math.round(tokens * tgePct / 100);
    const remainingTokens = tokens - tgeTokens;

    const monthlyValues: number[] = [];

    for (let m = 0; m < MONTHS; m++) {
      if (m === 0) {
        monthlyValues.push(tgeTokens);
      } else if (vType === "immediate" || vestM === 0) {
        monthlyValues.push(tokens);
      } else if (vType === "cliff") {
        if (m < cliffM) {
          monthlyValues.push(tgeTokens);
        } else {
          monthlyValues.push(tokens);
        }
      } else {
        if (m < cliffM) {
          monthlyValues.push(tgeTokens);
        } else {
          const vestingElapsed = m - cliffM;
          const effectiveVestMonths = Math.max(vestM - cliffM, 1);
          const vestedFraction = Math.min(vestingElapsed / effectiveVestMonths, 1);
          monthlyValues.push(Math.round(tgeTokens + remainingTokens * vestedFraction));
        }
      }
    }

    if (vType === "immediate" || vestM === 0) {
      for (let m = 0; m < MONTHS; m++) {
        monthlyValues[m] = tokens;
      }
    }

    return {
      category: a.category,
      standardGroup: a.standardGroup || "community",
      percentage: pct,
      totalTokens: tokens,
      vestingType: vType,
      cliffMonths: cliffM,
      vestingMonths: vestM,
      tgePercent: tgePct,
      monthlyValues,
    };
  });

  const totalTimeSeries: number[] = [];
  for (let m = 0; m < MONTHS; m++) {
    totalTimeSeries.push(allocations.reduce((sum, a) => sum + a.monthlyValues[m], 0));
  }

  const inflationRate: number[] = [];
  for (let m = 0; m < MONTHS; m++) {
    if (m === 0 || totalTimeSeries[m - 1] === 0) {
      inflationRate.push(0);
    } else {
      const newTokens = totalTimeSeries[m] - totalTimeSeries[m - 1];
      inflationRate.push((newTokens / totalTimeSeries[m - 1]) * 100);
    }
  }

  const cliffEvents: { month: string; label: string; amount: number }[] = [];
  for (const a of allocations) {
    if (a.cliffMonths > 0 && a.cliffMonths < MONTHS) {
      const prevVal = a.monthlyValues[a.cliffMonths - 1] || 0;
      const postVal = a.monthlyValues[a.cliffMonths] || 0;
      const unlocked = postVal - prevVal;
      if (unlocked > 0) {
        cliffEvents.push({
          month: timeSeriesMonths[a.cliffMonths] || "",
          label: `${a.category} Cliff Unlock`,
          amount: unlocked,
        });
      }
    }
  }

  const result: EmissionsData = {
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
    totalSupplyTimeSeries: totalTimeSeries,
    inflationRate,
    cliffEvents,
    confidence: aiResult.confidence,
    notes: aiResult.notes,
  };

  emissionsCache.set(coingeckoId, { data: result, timestamp: Date.now() });
  return result;
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
  const cached = emissionsCache.get(coingeckoId);
  if (cached && Date.now() - cached.timestamp < EMISSIONS_CACHE_TTL) {
    return cached.data;
  }
  return null;
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
