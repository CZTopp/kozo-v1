import { db } from "./db";
import {
  financialModels, revenueLineItems, revenuePeriods,
  incomeStatementLines, balanceSheetLines, cashFlowLines,
  dcfValuations, valuationComparisons, portfolioPositions,
  macroIndicators, marketIndices, portfolioRedFlags,
  scenarios, assumptions,
} from "@shared/schema";

export async function seedDatabase() {
  const existingModels = await db.select().from(financialModels);
  if (existingModels.length > 0) return;

  const [model] = await db.insert(financialModels).values({
    name: "TechCo SaaS Model 2024-2028",
    description: "5-year SaaS financial model with full financial statements, DCF and multiples valuation",
    currency: "USD",
    startYear: 2024,
    endYear: 2028,
    sharesOutstanding: 50000000,
  }).returning();

  const revenueStreams = [
    { name: "Subscription Revenue", sortOrder: 0 },
    { name: "Professional Services", sortOrder: 1 },
    { name: "Marketplace/Add-ons", sortOrder: 2 },
    { name: "Usage-Based Revenue", sortOrder: 3 },
  ];

  const lineItems = [];
  for (const rs of revenueStreams) {
    const [li] = await db.insert(revenueLineItems).values({ modelId: model.id, ...rs }).returning();
    lineItems.push(li);
  }

  const baseRevenue = [80000000, 15000000, 5000000, 3000000];
  const growthRates = [0.30, 0.20, 0.50, 0.60];
  const seasonality = [0.22, 0.24, 0.26, 0.28];

  const periodData = [];
  for (let liIdx = 0; liIdx < lineItems.length; liIdx++) {
    for (let yr = 2024; yr <= 2028; yr++) {
      const yearIdx = yr - 2024;
      const annualRev = baseRevenue[liIdx] * Math.pow(1 + growthRates[liIdx], yearIdx);
      for (let q = 1; q <= 4; q++) {
        periodData.push({
          lineItemId: lineItems[liIdx].id,
          modelId: model.id,
          year: yr,
          quarter: q,
          amount: Math.round(annualRev * seasonality[q - 1]),
          isActual: yr === 2024 && q <= 2,
        });
      }
    }
  }
  await db.insert(revenuePeriods).values(periodData);

  const isData = [];
  for (let yr = 2024; yr <= 2028; yr++) {
    const yearIdx = yr - 2024;
    const totalRev = baseRevenue.reduce((s, b, i) => s + b * Math.pow(1 + growthRates[i], yearIdx), 0);
    const cogs = totalRev * (0.28 - yearIdx * 0.01);
    const gp = totalRev - cogs;
    const sm = totalRev * (0.22 - yearIdx * 0.005);
    const rd = totalRev * (0.18 - yearIdx * 0.005);
    const ga = totalRev * (0.08 - yearIdx * 0.002);
    const dep = totalRev * 0.015;
    const totalExp = sm + rd + ga + dep;
    const opIncome = gp - totalExp;
    const ebitda = opIncome + dep;
    const otherInc = totalRev * 0.002;
    const preTax = opIncome + otherInc;
    const tax = preTax > 0 ? preTax * 0.25 : 0;
    const netInc = preTax - tax;
    const shares = 50000000;
    const eps = netInc / shares;

    isData.push({
      modelId: model.id, year: yr, isActual: yr === 2024,
      revenue: Math.round(totalRev),
      cogs: Math.round(cogs),
      grossProfit: Math.round(gp),
      salesMarketing: Math.round(sm),
      researchDevelopment: Math.round(rd),
      generalAdmin: Math.round(ga),
      depreciation: Math.round(dep),
      totalExpenses: Math.round(totalExp),
      operatingIncome: Math.round(opIncome),
      ebitda: Math.round(ebitda),
      otherIncome: Math.round(otherInc),
      preTaxIncome: Math.round(preTax),
      incomeTax: Math.round(tax),
      netIncome: Math.round(netInc),
      sharesOutstanding: shares,
      eps: Math.round(eps * 100) / 100,
      nonGaapEps: Math.round((eps * 1.15) * 100) / 100,
      cogsPercent: 0.28 - yearIdx * 0.01,
      smPercent: 0.22 - yearIdx * 0.005,
      rdPercent: 0.18 - yearIdx * 0.005,
      gaPercent: 0.08 - yearIdx * 0.002,
      depreciationPercent: 0.015,
      taxRate: 0.25,
    });
  }
  await db.insert(incomeStatementLines).values(isData);

  const bsData = [];
  let retainedEarnings = 20000000;
  for (let yr = 2024; yr <= 2028; yr++) {
    const yearIdx = yr - 2024;
    const totalRev = baseRevenue.reduce((s, b, i) => s + b * Math.pow(1 + growthRates[i], yearIdx), 0);
    const netInc = isData[yearIdx].netIncome || 0;
    retainedEarnings += netInc;

    const cash = 50000000 + yearIdx * 25000000;
    const stInv = 10000000 + yearIdx * 5000000;
    const ar = totalRev * 0.12;
    const inv = totalRev * 0.03;
    const totalCA = cash + stInv + ar + inv;
    const equip = 15000000 + yearIdx * 5000000;
    const depAccum = yearIdx * 3000000;
    const capex = totalRev * 0.04;
    const totalLTA = equip - depAccum + capex;
    const totalAssets = totalCA + totalLTA;
    const ap = totalRev * 0.08;
    const stDebt = 5000000;
    const totalCL = ap + stDebt;
    const ltDebt = 30000000 - yearIdx * 3000000;
    const totalLTL = ltDebt;
    const totalLiab = totalCL + totalLTL;
    const commonShares = 100000000;
    const totalEquity = commonShares + retainedEarnings;
    const totalLE = totalLiab + totalEquity;

    bsData.push({
      modelId: model.id, year: yr, isActual: yr === 2024,
      cash: Math.round(cash),
      shortTermInvestments: Math.round(stInv),
      accountsReceivable: Math.round(ar),
      inventory: Math.round(inv),
      totalCurrentAssets: Math.round(totalCA),
      equipment: Math.round(equip),
      depreciationAccum: Math.round(depAccum),
      capex: Math.round(capex),
      totalLongTermAssets: Math.round(totalLTA),
      totalAssets: Math.round(totalAssets),
      accountsPayable: Math.round(ap),
      shortTermDebt: stDebt,
      totalCurrentLiabilities: Math.round(totalCL),
      longTermDebt: ltDebt,
      totalLongTermLiabilities: totalLTL,
      totalLiabilities: Math.round(totalLiab),
      retainedEarnings: Math.round(retainedEarnings),
      commonShares: commonShares,
      totalEquity: Math.round(totalEquity),
      totalLiabilitiesAndEquity: Math.round(totalLE),
      arPercent: 0.12,
      inventoryPercent: 0.03,
      apPercent: 0.08,
      capexPercent: 0.04,
    });
  }
  await db.insert(balanceSheetLines).values(bsData);

  const cfData = [];
  for (let yr = 2024; yr <= 2028; yr++) {
    const yearIdx = yr - 2024;
    const is = isData[yearIdx];
    const bs = bsData[yearIdx];
    const netInc = is.netIncome || 0;
    const depAdd = is.depreciation || 0;
    const arChg = yearIdx > 0 ? (bsData[yearIdx].accountsReceivable || 0) - (bsData[yearIdx - 1].accountsReceivable || 0) : 0;
    const invChg = yearIdx > 0 ? (bsData[yearIdx].inventory || 0) - (bsData[yearIdx - 1].inventory || 0) : 0;
    const apChg = yearIdx > 0 ? (bsData[yearIdx].accountsPayable || 0) - (bsData[yearIdx - 1].accountsPayable || 0) : 0;
    const opCF = netInc + depAdd - arChg - invChg + apChg;
    const capexVal = -(bs.capex || 0);
    const invCF = capexVal;
    const stDebtChg = 0;
    const ltDebtChg = yearIdx > 0 ? (bsData[yearIdx].longTermDebt || 0) - (bsData[yearIdx - 1].longTermDebt || 0) : 0;
    const shareChg = 0;
    const finCF = stDebtChg + ltDebtChg + shareChg;
    const netCashChg = opCF + invCF + finCF;
    const beginCash = yearIdx > 0 ? (bsData[yearIdx - 1].cash || 0) : 50000000;
    const endCash = beginCash + netCashChg;
    const fcf = opCF + capexVal;

    cfData.push({
      modelId: model.id, year: yr, isActual: yr === 2024,
      netIncome: Math.round(netInc),
      depreciationAdd: Math.round(depAdd),
      arChange: Math.round(arChg),
      inventoryChange: Math.round(invChg),
      apChange: Math.round(apChg),
      operatingCashFlow: Math.round(opCF),
      capex: Math.round(capexVal),
      investingCashFlow: Math.round(invCF),
      shortTermDebtChange: stDebtChg,
      longTermDebtChange: ltDebtChg,
      commonSharesChange: shareChg,
      financingCashFlow: Math.round(finCF),
      netCashChange: Math.round(netCashChg),
      beginningCash: Math.round(beginCash),
      endingCash: Math.round(endCash),
      freeCashFlow: Math.round(fcf),
    });
  }
  await db.insert(cashFlowLines).values(cfData);

  const fcfProjections = cfData.map(c => c.freeCashFlow);
  const riskFreeRate = 0.043;
  const beta = 1.25;
  const marketReturn = 0.10;
  const costOfEquity = riskFreeRate + beta * (marketReturn - riskFreeRate);
  const costOfDebt = 0.055;
  const taxRate = 0.25;
  const equityWeight = 0.70;
  const debtWeight = 0.30;
  const wacc = costOfEquity * equityWeight + costOfDebt * (1 - taxRate) * debtWeight;
  const longTermGrowth = 0.025;
  const totalDebt = 35000000;
  const sharesOut = 50000000;

  let npv = 0;
  for (let i = 0; i < fcfProjections.length; i++) {
    npv += fcfProjections[i] / Math.pow(1 + wacc, i + 1);
  }
  const lastFCF = fcfProjections[fcfProjections.length - 1];
  const tv = (lastFCF * (1 + longTermGrowth)) / (wacc - longTermGrowth);
  const tvDisc = tv / Math.pow(1 + wacc, fcfProjections.length);
  const targetEV = npv + tvDisc - totalDebt;
  const targetPrice = targetEV / sharesOut;

  await db.insert(dcfValuations).values({
    modelId: model.id,
    riskFreeRate, beta, marketReturn, costOfDebt, taxRate,
    equityWeight, debtWeight, longTermGrowth,
    currentSharePrice: 45,
    totalDebt, sharesOutstanding: sharesOut,
    costOfEquity: Math.round(costOfEquity * 10000) / 10000,
    wacc: Math.round(wacc * 10000) / 10000,
    npv: Math.round(npv),
    terminalValue: Math.round(tv),
    terminalValueDiscounted: Math.round(tvDisc),
    targetEquityValue: Math.round(targetEV),
    targetValue: Math.round(npv + tvDisc),
    targetPricePerShare: Math.round(targetPrice * 100) / 100,
  });

  await db.insert(valuationComparisons).values({
    modelId: model.id,
    currentSharePrice: 45,
    prBullMultiple: 10, prBaseMultiple: 7.5, prBearMultiple: 5,
    peBullPeg: 2, peBasePeg: 1.5, peBearPeg: 1,
    prBullTarget: 62, prBaseTarget: 48, prBearTarget: 32,
    peBullTarget: 72, peBaseTarget: 54, peBearTarget: 36,
    dcfBullTarget: Math.round(targetPrice * 1.2 * 100) / 100,
    dcfBaseTarget: Math.round(targetPrice * 100) / 100,
    dcfBearTarget: Math.round(targetPrice * 0.8 * 100) / 100,
    averageTarget: 52,
    percentToTarget: 0.156,
  });

  await db.insert(assumptions).values({
    modelId: model.id,
    revenueGrowthRate: "0.30",
    churnRate: "0.04",
    avgRevenuePerUnit: "2400",
    initialCustomers: 5000,
    cogsPercent: "0.28",
    salesMarketingPercent: "0.22",
    rdPercent: "0.18",
    gaPercent: "0.08",
    depreciationPercent: "0.015",
    taxRate: "0.25",
    capexPercent: "0.04",
    arPercent: "0.12",
    apPercent: "0.08",
    initialCash: "50000000",
  });

  const [optimistic] = await db.insert(scenarios).values({
    modelId: model.id, name: "Bull Case", type: "optimistic", color: "#22c55e",
  }).returning();

  await db.insert(assumptions).values({
    modelId: model.id, scenarioId: optimistic.id,
    revenueGrowthRate: "0.40", churnRate: "0.025", avgRevenuePerUnit: "2800",
    initialCustomers: 5000, cogsPercent: "0.25", salesMarketingPercent: "0.25",
    rdPercent: "0.18", gaPercent: "0.08", depreciationPercent: "0.015",
    taxRate: "0.25", capexPercent: "0.04", arPercent: "0.10", apPercent: "0.08",
    initialCash: "50000000",
  });

  const [pessimistic] = await db.insert(scenarios).values({
    modelId: model.id, name: "Bear Case", type: "pessimistic", color: "#ef4444",
  }).returning();

  await db.insert(assumptions).values({
    modelId: model.id, scenarioId: pessimistic.id,
    revenueGrowthRate: "0.15", churnRate: "0.08", avgRevenuePerUnit: "2000",
    initialCustomers: 5000, cogsPercent: "0.32", salesMarketingPercent: "0.18",
    rdPercent: "0.15", gaPercent: "0.10", depreciationPercent: "0.015",
    taxRate: "0.25", capexPercent: "0.03", arPercent: "0.15", apPercent: "0.08",
    initialCash: "50000000",
  });

  const portfolioData = [
    { ticker: "AAPL", companyName: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", sharesHeld: 500, purchasePrice: 142.50, currentPrice: 189.84, marketCap: 2950000000000, dailyChangePercent: 0.82, dailyChange: 1.54, dayHigh: 191.20, dayLow: 188.10, openPrice: 188.50, previousClose: 188.30, volume: 52000000, avgVolume: 58000000, week52Low: 124.17, week52High: 199.62, ma50: 185.20, ma200: 172.40, peRatio: 31.2, pbRatio: 45.8, eps: 6.08, dividendYield: 0.0053, dividendPerShare: 0.96, beta: 1.28, shortRatio: 1.2, bookValue: 4.15, ebitda: 130000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 45 },
    { ticker: "MSFT", companyName: "Microsoft Corp.", sector: "Technology", industry: "Software", sharesHeld: 300, purchasePrice: 285.00, currentPrice: 378.91, marketCap: 2820000000000, dailyChangePercent: 1.15, dailyChange: 4.31, dayHigh: 380.50, dayLow: 375.20, openPrice: 375.60, previousClose: 374.60, volume: 22000000, avgVolume: 25000000, week52Low: 245.61, week52High: 384.30, ma50: 370.10, ma200: 345.80, peRatio: 36.5, pbRatio: 12.8, eps: 10.38, dividendYield: 0.0078, dividendPerShare: 2.72, beta: 0.92, shortRatio: 1.5, bookValue: 29.60, ebitda: 110000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 62 },
    { ticker: "GOOGL", companyName: "Alphabet Inc.", sector: "Technology", industry: "Internet Services", sharesHeld: 400, purchasePrice: 108.00, currentPrice: 141.80, marketCap: 1780000000000, dailyChangePercent: -0.45, dailyChange: -0.64, dayHigh: 143.20, dayLow: 141.10, openPrice: 142.80, previousClose: 142.44, volume: 25000000, avgVolume: 28000000, week52Low: 83.45, week52High: 153.78, ma50: 138.90, ma200: 128.60, peRatio: 25.8, pbRatio: 6.2, eps: 5.50, dividendYield: 0, dividendPerShare: 0, beta: 1.06, shortRatio: 1.8, bookValue: 22.90, ebitda: 95000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 30 },
    { ticker: "AMZN", companyName: "Amazon.com Inc.", sector: "Technology", industry: "E-Commerce", sharesHeld: 350, purchasePrice: 125.00, currentPrice: 178.25, marketCap: 1850000000000, dailyChangePercent: 2.10, dailyChange: 3.67, dayHigh: 179.50, dayLow: 175.40, openPrice: 175.80, previousClose: 174.58, volume: 48000000, avgVolume: 55000000, week52Low: 88.12, week52High: 185.10, ma50: 168.40, ma200: 148.90, peRatio: 62.5, pbRatio: 8.9, eps: 2.85, dividendYield: 0, dividendPerShare: 0, beta: 1.16, shortRatio: 0.9, bookValue: 20.02, ebitda: 85000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 55 },
    { ticker: "NVDA", companyName: "NVIDIA Corp.", sector: "Technology", industry: "Semiconductors", sharesHeld: 200, purchasePrice: 420.00, currentPrice: 875.28, marketCap: 2160000000000, dailyChangePercent: 3.45, dailyChange: 29.18, dayHigh: 882.00, dayLow: 850.10, openPrice: 851.20, previousClose: 846.10, volume: 42000000, avgVolume: 48000000, week52Low: 204.21, week52High: 974.00, ma50: 780.50, ma200: 560.20, peRatio: 68.4, pbRatio: 52.1, eps: 12.79, dividendYield: 0.0002, dividendPerShare: 0.16, beta: 1.72, shortRatio: 1.1, bookValue: 16.80, ebitda: 32000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 120 },
    { ticker: "META", companyName: "Meta Platforms", sector: "Technology", industry: "Social Media", sharesHeld: 250, purchasePrice: 175.00, currentPrice: 505.68, marketCap: 1290000000000, dailyChangePercent: 1.88, dailyChange: 9.35, dayHigh: 508.20, dayLow: 498.40, openPrice: 499.10, previousClose: 496.33, volume: 18000000, avgVolume: 22000000, week52Low: 120.34, week52High: 542.81, ma50: 490.20, ma200: 420.40, peRatio: 33.8, pbRatio: 8.5, eps: 14.96, dividendYield: 0.004, dividendPerShare: 2.00, beta: 1.35, shortRatio: 1.3, bookValue: 59.50, ebitda: 62000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 85 },
    { ticker: "TSLA", companyName: "Tesla Inc.", sector: "Consumer Discretionary", industry: "Auto Manufacturers", sharesHeld: 150, purchasePrice: 180.00, currentPrice: 248.42, marketCap: 790000000000, dailyChangePercent: -1.25, dailyChange: -3.14, dayHigh: 254.80, dayLow: 246.90, openPrice: 253.10, previousClose: 251.56, volume: 95000000, avgVolume: 110000000, week52Low: 138.80, week52High: 299.29, ma50: 242.80, ma200: 228.50, peRatio: 72.5, pbRatio: 15.2, eps: 3.43, dividendYield: 0, dividendPerShare: 0, beta: 2.08, shortRatio: 2.5, bookValue: 16.34, ebitda: 13000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 20 },
    { ticker: "JPM", companyName: "JPMorgan Chase", sector: "Financials", industry: "Banking", sharesHeld: 200, purchasePrice: 135.00, currentPrice: 195.42, marketCap: 565000000000, dailyChangePercent: 0.65, dailyChange: 1.26, dayHigh: 196.80, dayLow: 194.20, openPrice: 194.50, previousClose: 194.16, volume: 12000000, avgVolume: 14000000, week52Low: 128.72, week52High: 200.94, ma50: 190.30, ma200: 175.80, peRatio: 11.8, pbRatio: 1.8, eps: 16.56, dividendYield: 0.0238, dividendPerShare: 4.60, beta: 1.12, shortRatio: 1.0, bookValue: 108.57, ebitda: 0, positionType: "long", goldenCross: true, daysSinceGoldenCross: 40 },
    { ticker: "V", companyName: "Visa Inc.", sector: "Financials", industry: "Financial Services", sharesHeld: 300, purchasePrice: 205.00, currentPrice: 280.15, marketCap: 575000000000, dailyChangePercent: 0.42, dailyChange: 1.17, dayHigh: 281.50, dayLow: 278.90, openPrice: 279.20, previousClose: 278.98, volume: 8000000, avgVolume: 9500000, week52Low: 206.09, week52High: 290.96, ma50: 275.40, ma200: 258.90, peRatio: 32.4, pbRatio: 14.2, eps: 8.64, dividendYield: 0.0076, dividendPerShare: 2.08, beta: 0.96, shortRatio: 1.4, bookValue: 19.73, ebitda: 22000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 50 },
    { ticker: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", industry: "Pharmaceuticals", sharesHeld: 250, purchasePrice: 162.00, currentPrice: 158.72, marketCap: 382000000000, dailyChangePercent: -0.18, dailyChange: -0.29, dayHigh: 159.80, dayLow: 158.10, openPrice: 159.30, previousClose: 159.01, volume: 7500000, avgVolume: 8200000, week52Low: 144.95, week52High: 175.97, ma50: 160.20, ma200: 162.50, peRatio: 18.2, pbRatio: 5.8, eps: 8.72, dividendYield: 0.0302, dividendPerShare: 4.76, beta: 0.56, shortRatio: 1.6, bookValue: 27.37, ebitda: 28000000000, positionType: "long", goldenCross: false, daysSinceGoldenCross: 0 },
    { ticker: "UNH", companyName: "UnitedHealth Group", sector: "Healthcare", industry: "Health Insurance", sharesHeld: 100, purchasePrice: 480.00, currentPrice: 528.45, marketCap: 490000000000, dailyChangePercent: 0.92, dailyChange: 4.82, dayHigh: 530.20, dayLow: 524.80, openPrice: 525.10, previousClose: 523.63, volume: 3500000, avgVolume: 4000000, week52Low: 436.38, week52High: 558.10, ma50: 520.80, ma200: 505.20, peRatio: 22.5, pbRatio: 5.9, eps: 23.49, dividendYield: 0.0132, dividendPerShare: 6.60, beta: 0.72, shortRatio: 1.1, bookValue: 89.57, ebitda: 35000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 35 },
    { ticker: "PG", companyName: "Procter & Gamble", sector: "Consumer Staples", industry: "Household Products", sharesHeld: 200, purchasePrice: 145.00, currentPrice: 152.34, marketCap: 360000000000, dailyChangePercent: 0.15, dailyChange: 0.23, dayHigh: 153.10, dayLow: 151.80, openPrice: 152.00, previousClose: 152.11, volume: 6000000, avgVolume: 7000000, week52Low: 138.71, week52High: 165.35, ma50: 150.80, ma200: 152.60, peRatio: 24.8, pbRatio: 7.6, eps: 6.14, dividendYield: 0.0248, dividendPerShare: 3.76, beta: 0.42, shortRatio: 0.8, bookValue: 20.04, ebitda: 22000000000, positionType: "long", goldenCross: false, daysSinceGoldenCross: 0 },
    { ticker: "XOM", companyName: "Exxon Mobil", sector: "Energy", industry: "Oil & Gas", sharesHeld: 400, purchasePrice: 88.00, currentPrice: 104.82, marketCap: 430000000000, dailyChangePercent: -0.55, dailyChange: -0.58, dayHigh: 106.20, dayLow: 104.50, openPrice: 105.80, previousClose: 105.40, volume: 16000000, avgVolume: 18000000, week52Low: 83.89, week52High: 120.70, ma50: 106.40, ma200: 105.20, peRatio: 12.4, pbRatio: 2.1, eps: 8.45, dividendYield: 0.0356, dividendPerShare: 3.64, beta: 0.85, shortRatio: 1.2, bookValue: 49.92, ebitda: 65000000000, positionType: "long", goldenCross: false, daysSinceGoldenCross: 0 },
    { ticker: "COST", companyName: "Costco Wholesale", sector: "Consumer Staples", industry: "Retail", sharesHeld: 100, purchasePrice: 520.00, currentPrice: 698.42, marketCap: 310000000000, dailyChangePercent: 0.78, dailyChange: 5.40, dayHigh: 700.80, dayLow: 694.20, openPrice: 694.50, previousClose: 693.02, volume: 2500000, avgVolume: 3000000, week52Low: 472.30, week52High: 712.00, ma50: 680.20, ma200: 620.80, peRatio: 50.2, pbRatio: 13.5, eps: 13.91, dividendYield: 0.0058, dividendPerShare: 4.08, beta: 0.78, shortRatio: 1.0, bookValue: 51.74, ebitda: 12000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 60 },
    { ticker: "HD", companyName: "Home Depot", sector: "Consumer Discretionary", industry: "Home Improvement", sharesHeld: 150, purchasePrice: 295.00, currentPrice: 345.18, marketCap: 345000000000, dailyChangePercent: 0.35, dailyChange: 1.20, dayHigh: 347.50, dayLow: 343.80, openPrice: 344.20, previousClose: 343.98, volume: 4500000, avgVolume: 5000000, week52Low: 274.26, week52High: 383.09, ma50: 340.60, ma200: 325.40, peRatio: 22.8, pbRatio: 0, eps: 15.14, dividendYield: 0.0248, dividendPerShare: 8.36, beta: 1.04, shortRatio: 1.3, bookValue: -1.73, ebitda: 28000000000, positionType: "long", goldenCross: true, daysSinceGoldenCross: 28 },
  ];

  for (const p of portfolioData) {
    const gl = (p.currentPrice - p.purchasePrice) / p.purchasePrice;
    const gld = (p.currentPrice - p.purchasePrice) * p.sharesHeld;
    const pv = p.currentPrice * p.sharesHeld;
    await db.insert(portfolioPositions).values({
      ...p,
      changeFromMa50: (p.currentPrice - p.ma50) / p.ma50,
      changeFromMa200: (p.currentPrice - p.ma200) / p.ma200,
      gainLossPercent: gl,
      gainLossDollar: gld,
      positionValue: pv,
      stopLoss: p.purchasePrice * 0.85,
    });
  }

  const macroData = [
    { name: "Fed Funds Rate", category: "Interest Rates", value: 0.0525, displayFormat: "percent" },
    { name: "10-Year Treasury", category: "Interest Rates", value: 0.0432, displayFormat: "percent" },
    { name: "2-Year Treasury", category: "Interest Rates", value: 0.0478, displayFormat: "percent" },
    { name: "30-Year Mortgage", category: "Interest Rates", value: 0.0695, displayFormat: "percent" },
    { name: "CPI YoY", category: "Inflation", value: 0.032, displayFormat: "percent" },
    { name: "Core CPI YoY", category: "Inflation", value: 0.038, displayFormat: "percent" },
    { name: "PCE Index YoY", category: "Inflation", value: 0.028, displayFormat: "percent" },
    { name: "PPI YoY", category: "Inflation", value: 0.018, displayFormat: "percent" },
    { name: "GDP Growth QoQ", category: "Economic Growth", value: 0.033, displayFormat: "percent" },
    { name: "Unemployment Rate", category: "Labor Market", value: 0.037, displayFormat: "percent" },
    { name: "Non-Farm Payrolls", category: "Labor Market", value: 216000, displayFormat: "number" },
    { name: "VIX", category: "Volatility", value: 14.2, displayFormat: "number" },
    { name: "DXY (Dollar Index)", category: "Currency", value: 103.8, displayFormat: "number" },
    { name: "Consumer Confidence", category: "Sentiment", value: 110.7, displayFormat: "number" },
    { name: "ISM Manufacturing", category: "Economic Activity", value: 49.2, displayFormat: "number" },
    { name: "ISM Services", category: "Economic Activity", value: 52.7, displayFormat: "number" },
  ];
  await db.insert(macroIndicators).values(macroData);

  const indicesData = [
    { name: "S&P 500", ticker: "SPX", region: "US", ytdReturn: 0.245, mtdReturn: 0.032, currentValue: 5021.84 },
    { name: "NASDAQ 100", ticker: "NDX", region: "US", ytdReturn: 0.312, mtdReturn: 0.041, currentValue: 17856.45 },
    { name: "Dow Jones", ticker: "DJI", region: "US", ytdReturn: 0.138, mtdReturn: 0.022, currentValue: 38654.42 },
    { name: "Russell 2000", ticker: "RUT", region: "US", ytdReturn: 0.082, mtdReturn: 0.015, currentValue: 2018.55 },
    { name: "FTSE 100", ticker: "UKX", region: "Europe", ytdReturn: 0.045, mtdReturn: 0.012, currentValue: 7682.30 },
    { name: "DAX", ticker: "DAX", region: "Europe", ytdReturn: 0.128, mtdReturn: 0.025, currentValue: 16921.40 },
    { name: "CAC 40", ticker: "CAC", region: "Europe", ytdReturn: 0.098, mtdReturn: 0.018, currentValue: 7580.25 },
    { name: "Nikkei 225", ticker: "NI225", region: "Asia", ytdReturn: 0.285, mtdReturn: 0.048, currentValue: 36226.00 },
    { name: "Hang Seng", ticker: "HSI", region: "Asia", ytdReturn: -0.125, mtdReturn: -0.032, currentValue: 16188.50 },
    { name: "Shanghai Composite", ticker: "SSEC", region: "Asia", ytdReturn: -0.038, mtdReturn: -0.015, currentValue: 2882.70 },
    { name: "BSE Sensex", ticker: "SENSEX", region: "Asia", ytdReturn: 0.152, mtdReturn: 0.028, currentValue: 72085.30 },
    { name: "ASX 200", ticker: "AXJO", region: "Asia-Pacific", ytdReturn: 0.065, mtdReturn: 0.012, currentValue: 7642.10 },
  ];
  await db.insert(marketIndices).values(indicesData);

  const redFlagsData = [
    { question: "Is your largest position >15% of portfolio?", answer: "Yes", category: "concentration" },
    { question: "Do you have >5 correlated positions in same sector?", answer: "Yes", category: "concentration" },
    { question: "Is your portfolio beta >1.5?", answer: "No", category: "risk" },
    { question: "Are any positions below stop-loss?", answer: "No", category: "risk" },
    { question: "Do you have earnings risk in next 7 days?", answer: "No", category: "events" },
    { question: "Is VIX above 25 (elevated fear)?", answer: "No", category: "market" },
    { question: "Are >50% of positions in death cross?", answer: "No", category: "technical" },
    { question: "Is portfolio P/E ratio >40?", answer: "Yes", category: "valuation" },
    { question: "Are >3 positions at 52-week high?", answer: "No", category: "technical" },
    { question: "Is sector concentration >30%?", answer: "Yes", category: "concentration" },
  ];
  await db.insert(portfolioRedFlags).values(redFlagsData);

  console.log("Comprehensive seed data inserted successfully");
}
