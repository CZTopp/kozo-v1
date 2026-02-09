export function formatCurrency(val: number, decimals = 0): string {
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(decimals > 0 ? decimals : 1)}K`;
  return `$${val.toFixed(decimals)}`;
}

export function formatPercent(val: number, decimals = 1): string {
  return `${(val * 100).toFixed(decimals)}%`;
}

export function formatNumber(val: number, decimals = 0): string {
  return val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatLargeCurrency(val: number): string {
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

export function calcYoYGrowth(current: number, prior: number): number | null {
  if (!prior || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

export function calcQoQGrowth(current: number, prior: number): number | null {
  if (!prior || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

export function calcCostOfEquity(riskFreeRate: number, beta: number, marketReturn: number): number {
  return riskFreeRate + beta * (marketReturn - riskFreeRate);
}

export function calcWACC(
  costOfEquity: number, equityWeight: number,
  costOfDebt: number, debtWeight: number, taxRate: number
): number {
  return costOfEquity * equityWeight + costOfDebt * (1 - taxRate) * debtWeight;
}

export function calcDCFTargetPrice(
  fcfProjections: number[], wacc: number, longTermGrowth: number,
  totalDebt: number, sharesOutstanding: number
): {
  npv: number; terminalValue: number; terminalValueDiscounted: number;
  targetEquityValue: number; targetPricePerShare: number;
} {
  let npv = 0;
  for (let i = 0; i < fcfProjections.length; i++) {
    npv += fcfProjections[i] / Math.pow(1 + wacc, i + 1);
  }

  const lastFCF = fcfProjections[fcfProjections.length - 1] || 0;
  const terminalValue = (lastFCF * (1 + longTermGrowth)) / (wacc - longTermGrowth);
  const terminalValueDiscounted = terminalValue / Math.pow(1 + wacc, fcfProjections.length);
  const targetEquityValue = npv + terminalValueDiscounted - totalDebt;
  const targetPricePerShare = sharesOutstanding > 0 ? targetEquityValue / sharesOutstanding : 0;

  return { npv, terminalValue, terminalValueDiscounted, targetEquityValue, targetPricePerShare };
}

export function calcSensitivityTable(
  fcfProjections: number[], baseLTG: number, baseWACC: number,
  totalDebt: number, sharesOutstanding: number
): { waccRange: number[]; ltgRange: number[]; values: number[][] } {
  const waccDeltas = [-0.02, -0.01, 0, 0.01, 0.02];
  const ltgDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const waccRange = waccDeltas.map(d => baseWACC + d);
  const ltgRange = ltgDeltas.map(d => baseLTG + d);

  const values = waccRange.map(w =>
    ltgRange.map(g => {
      if (w <= g) return 0;
      const result = calcDCFTargetPrice(fcfProjections, w, g, totalDebt, sharesOutstanding);
      return result.targetPricePerShare;
    })
  );

  return { waccRange, ltgRange, values };
}

export function calcPRValuation(
  revenue: number, sharesOutstanding: number,
  bullMultiple: number, baseMultiple: number, bearMultiple: number
): { bull: number; base: number; bear: number } {
  const rps = sharesOutstanding > 0 ? revenue / sharesOutstanding : 0;
  return {
    bull: rps * bullMultiple,
    base: rps * baseMultiple,
    bear: rps * bearMultiple,
  };
}

export function calcPEValuation(
  eps: number, earningsGrowth: number,
  bullPEG: number, basePEG: number, bearPEG: number
): { bull: number; base: number; bear: number } {
  const growthPct = earningsGrowth * 100;
  return {
    bull: eps * growthPct * bullPEG,
    base: eps * growthPct * basePEG,
    bear: eps * growthPct * bearPEG,
  };
}

export function calcGoldenCross(ma50: number, ma200: number): boolean {
  return ma50 > ma200;
}

export function calcGainLoss(currentPrice: number, purchasePrice: number, shares: number): {
  gainLossPercent: number; gainLossDollar: number; positionValue: number;
} {
  const gainLossPercent = purchasePrice > 0 ? (currentPrice - purchasePrice) / purchasePrice : 0;
  const gainLossDollar = (currentPrice - purchasePrice) * shares;
  const positionValue = currentPrice * shares;
  return { gainLossPercent, gainLossDollar, positionValue };
}

export function calcPortfolioMetrics(positions: Array<{
  currentPrice: number; purchasePrice: number; sharesHeld: number;
  beta: number; sector: string; dailyChangePercent: number;
}>) {
  let totalValue = 0;
  let totalCost = 0;
  let weightedBeta = 0;
  const sectorMap: Record<string, number> = {};

  for (const p of positions) {
    const pv = p.currentPrice * p.sharesHeld;
    totalValue += pv;
    totalCost += p.purchasePrice * p.sharesHeld;
  }

  for (const p of positions) {
    const pv = p.currentPrice * p.sharesHeld;
    const weight = totalValue > 0 ? pv / totalValue : 0;
    weightedBeta += p.beta * weight;
    const sector = p.sector || "Other";
    sectorMap[sector] = (sectorMap[sector] || 0) + pv;
  }

  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? totalGainLoss / totalCost : 0;

  const sectorAllocation = Object.entries(sectorMap).map(([sector, value]) => ({
    sector,
    value,
    percent: totalValue > 0 ? value / totalValue : 0,
  })).sort((a, b) => b.value - a.value);

  const topConcentration = sectorAllocation.length > 0 ? sectorAllocation[0].percent : 0;
  const concentrationRisk = topConcentration > 0.25 ? "High" : topConcentration > 0.15 ? "Medium" : "Low";

  return {
    totalValue, totalCost, totalGainLoss, totalGainLossPercent,
    weightedBeta, sectorAllocation, concentrationRisk,
    positionCount: positions.length,
  };
}
