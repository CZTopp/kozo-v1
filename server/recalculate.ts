import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  financialModels, revenueLineItems, revenuePeriods,
  incomeStatementLines, balanceSheetLines, cashFlowLines,
  dcfValuations, valuationComparisons, assumptions,
} from "@shared/schema";

export async function recalculateModel(modelId: string) {
  const [model] = await db.select().from(financialModels).where(eq(financialModels.id, modelId));
  if (!model) throw new Error("Model not found");

  const lineItems = await db.select().from(revenueLineItems).where(eq(revenueLineItems.modelId, modelId));
  const periods = await db.select().from(revenuePeriods).where(eq(revenuePeriods.modelId, modelId));
  const assumptionsList = await db.select().from(assumptions).where(eq(assumptions.modelId, modelId));
  const baseAssumptions = assumptionsList.find(a => !a.scenarioId) || assumptionsList[0];

  const existingIS = await db.select().from(incomeStatementLines).where(eq(incomeStatementLines.modelId, modelId));
  const existingBS = await db.select().from(balanceSheetLines).where(eq(balanceSheetLines.modelId, modelId));
  const existingCF = await db.select().from(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));

  const actualISYears = new Set(existingIS.filter(r => r.isActual).map(r => r.year));
  const actualBSYears = new Set(existingBS.filter(r => r.isActual).map(r => r.year));
  const actualCFYears = new Set(existingCF.filter(r => r.isActual).map(r => r.year));

  const years = Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i);
  const sharesOut = model.sharesOutstanding || 50000000;

  const baseCogs = baseAssumptions ? parseFloat(baseAssumptions.cogsPercent) : 0.28;
  const baseSm = baseAssumptions ? parseFloat(baseAssumptions.salesMarketingPercent) : 0.22;
  const baseRd = baseAssumptions ? parseFloat(baseAssumptions.rdPercent) : 0.18;
  const baseGa = baseAssumptions ? parseFloat(baseAssumptions.gaPercent) : 0.08;
  const baseDep = baseAssumptions ? parseFloat(baseAssumptions.depreciationPercent) : 0.015;
  const taxRate = baseAssumptions ? parseFloat(baseAssumptions.taxRate) : 0.25;
  const arPercent = baseAssumptions ? parseFloat(baseAssumptions.arPercent) : 0.12;
  const invPercent = 0.03;
  const apPercent = baseAssumptions ? parseFloat(baseAssumptions.apPercent) : 0.08;
  const capexPercent = baseAssumptions ? parseFloat(baseAssumptions.capexPercent) : 0.04;
  const initialCash = baseAssumptions ? parseFloat(baseAssumptions.initialCash) : 50000000;

  const targetNetMargin = model.targetNetMargin;
  const totalYears = years.length;

  const currentNetMarginFromAssumptions = (() => {
    const totalCostPct = baseCogs + baseSm + baseRd + baseGa + baseDep;
    const preTaxMargin = 1 - totalCostPct + 0.002;
    return preTaxMargin * (1 - taxRate);
  })();

  const getCostPercentsForYear = (yearIdx: number) => {
    if (targetNetMargin === null || targetNetMargin === undefined || totalYears <= 1) {
      return { cogsPercent: baseCogs, smPercent: baseSm, rdPercent: baseRd, gaPercent: baseGa, depPercent: baseDep };
    }

    const progress = yearIdx / (totalYears - 1);
    const currentMargin = currentNetMarginFromAssumptions;
    const marginGap = targetNetMargin - currentMargin;

    if (Math.abs(marginGap) < 0.001) {
      return { cogsPercent: baseCogs, smPercent: baseSm, rdPercent: baseRd, gaPercent: baseGa, depPercent: baseDep };
    }

    const adjustableCosts = [
      { key: "cogsPercent", base: baseCogs, weight: 0.3 },
      { key: "smPercent", base: baseSm, weight: 0.35 },
      { key: "rdPercent", base: baseRd, weight: 0.2 },
      { key: "gaPercent", base: baseGa, weight: 0.15 },
    ];

    const totalCostReductionNeeded = -marginGap / (1 - taxRate);
    const result: Record<string, number> = {};

    for (const cost of adjustableCosts) {
      const adjustment = totalCostReductionNeeded * cost.weight * progress;
      result[cost.key] = Math.max(0.01, cost.base + adjustment);
    }

    return {
      cogsPercent: result.cogsPercent,
      smPercent: result.smPercent,
      rdPercent: result.rdPercent,
      gaPercent: result.gaPercent,
      depPercent: baseDep,
    };
  };

  const getAnnualRevenue = (year: number): number => {
    let total = 0;
    for (const li of lineItems) {
      const quarterlyPeriods = periods.filter(p => p.lineItemId === li.id && p.year === year && p.quarter);
      if (quarterlyPeriods.length > 0) {
        total += quarterlyPeriods.reduce((s, p) => s + (p.amount || 0), 0);
      } else {
        const annualPeriod = periods.find(p => p.lineItemId === li.id && p.year === year && !p.quarter);
        total += annualPeriod?.amount || 0;
      }
    }
    return total;
  };

  const annualRevenues: Record<number, number> = {};
  for (const yr of years) {
    annualRevenues[yr] = getAnnualRevenue(yr);
  }

  const projectedISYears = years.filter(yr => !actualISYears.has(yr));
  if (projectedISYears.length > 0) {
    for (const yr of projectedISYears) {
      const existing = existingIS.find(r => r.year === yr);
      if (existing) {
        await db.delete(incomeStatementLines).where(and(eq(incomeStatementLines.modelId, modelId), eq(incomeStatementLines.year, yr)));
      }
    }
  }

  type ISRow = {
    modelId: string; year: number; isActual: boolean;
    revenue: number; cogs: number; grossProfit: number;
    salesMarketing: number; researchDevelopment: number; generalAdmin: number;
    depreciation: number; totalExpenses: number; operatingIncome: number;
    ebitda: number; otherIncome: number; preTaxIncome: number;
    incomeTax: number; netIncome: number; sharesOutstanding: number;
    eps: number; nonGaapEps: number;
    cogsPercent: number; smPercent: number; rdPercent: number;
    gaPercent: number; depreciationPercent: number; taxRate: number;
  };

  const isData: ISRow[] = [];
  const newISRows: ISRow[] = [];

  for (const yr of years) {
    const yearIdx = yr - model.startYear;

    if (actualISYears.has(yr)) {
      const actual = existingIS.find(r => r.year === yr)!;
      isData.push({
        modelId, year: yr, isActual: true,
        revenue: actual.revenue || 0,
        cogs: actual.cogs || 0,
        grossProfit: actual.grossProfit || 0,
        salesMarketing: actual.salesMarketing || 0,
        researchDevelopment: actual.researchDevelopment || 0,
        generalAdmin: actual.generalAdmin || 0,
        depreciation: actual.depreciation || 0,
        totalExpenses: actual.totalExpenses || 0,
        operatingIncome: actual.operatingIncome || 0,
        ebitda: actual.ebitda || 0,
        otherIncome: actual.otherIncome || 0,
        preTaxIncome: actual.preTaxIncome || 0,
        incomeTax: actual.incomeTax || 0,
        netIncome: actual.netIncome || 0,
        sharesOutstanding: actual.sharesOutstanding || sharesOut,
        eps: actual.eps || 0,
        nonGaapEps: actual.nonGaapEps || 0,
        cogsPercent: actual.cogsPercent || 0,
        smPercent: actual.smPercent || 0,
        rdPercent: actual.rdPercent || 0,
        gaPercent: actual.gaPercent || 0,
        depreciationPercent: actual.depreciationPercent || 0,
        taxRate: actual.taxRate || 0,
      });
      continue;
    }

    const totalRev = annualRevenues[yr];
    const { cogsPercent, smPercent, rdPercent, gaPercent, depPercent } = getCostPercentsForYear(yearIdx);
    const cogs = totalRev * cogsPercent;
    const gp = totalRev - cogs;
    const sm = totalRev * smPercent;
    const rd = totalRev * rdPercent;
    const ga = totalRev * gaPercent;
    const dep = totalRev * depPercent;
    const totalExp = sm + rd + ga + dep;
    const opIncome = gp - totalExp;
    const ebitda = opIncome + dep;
    const otherInc = totalRev * 0.002;
    const preTax = opIncome + otherInc;
    const tax = preTax > 0 ? preTax * taxRate : 0;
    const netInc = preTax - tax;
    const eps = sharesOut > 0 ? netInc / sharesOut : 0;

    const row: ISRow = {
      modelId, year: yr, isActual: false,
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
      sharesOutstanding: sharesOut,
      eps: Math.round(eps * 100) / 100,
      nonGaapEps: Math.round(eps * 1.15 * 100) / 100,
      cogsPercent, smPercent, rdPercent, gaPercent,
      depreciationPercent: depPercent, taxRate,
    };
    isData.push(row);
    newISRows.push(row);
  }

  if (newISRows.length > 0) {
    await db.insert(incomeStatementLines).values(newISRows);
  }

  const projectedBSYears = years.filter(yr => !actualBSYears.has(yr));
  for (const yr of projectedBSYears) {
    const existing = existingBS.find(r => r.year === yr);
    if (existing) {
      await db.delete(balanceSheetLines).where(and(eq(balanceSheetLines.modelId, modelId), eq(balanceSheetLines.year, yr)));
    }
  }

  const bsData: Array<Record<string, any>> = [];
  const newBSRows: Array<Record<string, any>> = [];
  let retainedEarnings = 20000000;

  for (const yr of years) {
    const yearIdx = yr - model.startYear;
    const netInc = isData[yearIdx]?.netIncome || 0;
    retainedEarnings += netInc;

    if (actualBSYears.has(yr)) {
      const actual = existingBS.find(r => r.year === yr)!;
      bsData.push({
        modelId, year: yr, isActual: true,
        cash: actual.cash || 0,
        shortTermInvestments: actual.shortTermInvestments || 0,
        accountsReceivable: actual.accountsReceivable || 0,
        inventory: actual.inventory || 0,
        totalCurrentAssets: actual.totalCurrentAssets || 0,
        equipment: actual.equipment || 0,
        depreciationAccum: actual.depreciationAccum || 0,
        capex: actual.capex || 0,
        totalLongTermAssets: actual.totalLongTermAssets || 0,
        totalAssets: actual.totalAssets || 0,
        accountsPayable: actual.accountsPayable || 0,
        shortTermDebt: actual.shortTermDebt || 0,
        totalCurrentLiabilities: actual.totalCurrentLiabilities || 0,
        longTermDebt: actual.longTermDebt || 0,
        totalLongTermLiabilities: actual.totalLongTermLiabilities || 0,
        totalLiabilities: actual.totalLiabilities || 0,
        retainedEarnings: actual.retainedEarnings || 0,
        commonShares: actual.commonShares || 0,
        totalEquity: actual.totalEquity || 0,
        totalLiabilitiesAndEquity: actual.totalLiabilitiesAndEquity || 0,
        arPercent: actual.arPercent, inventoryPercent: actual.inventoryPercent,
        apPercent: actual.apPercent, capexPercent: actual.capexPercent,
      });
      continue;
    }

    const totalRev = annualRevenues[yr];
    const ar = totalRev * arPercent;
    const inv = totalRev * invPercent;
    const stInv = 10000000 + yearIdx * 5000000;
    const equip = 15000000 + yearIdx * 5000000;
    const depAccum = yearIdx * 3000000;
    const capex = totalRev * capexPercent;
    const totalLTA = equip - depAccum + capex;

    const ap = totalRev * apPercent;
    const stDebt = 5000000;
    const totalCL = ap + stDebt;
    const ltDebt = 30000000 - yearIdx * 3000000;
    const totalLTL = ltDebt;
    const totalLiab = totalCL + totalLTL;
    const commonShares = 100000000;
    const totalEquity = commonShares + retainedEarnings;
    const totalLE = totalLiab + totalEquity;

    const nonCashCurrentAssets = stInv + ar + inv;
    const cash = totalLE - nonCashCurrentAssets - totalLTA;

    const totalCA = cash + nonCashCurrentAssets;
    const totalAssets = totalCA + totalLTA;

    const row = {
      modelId, year: yr, isActual: false,
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
      commonShares,
      totalEquity: Math.round(totalEquity),
      totalLiabilitiesAndEquity: Math.round(totalLE),
      arPercent, inventoryPercent: invPercent, apPercent, capexPercent,
    };
    bsData.push(row);
    newBSRows.push(row);
  }

  if (newBSRows.length > 0) {
    await db.insert(balanceSheetLines).values(newBSRows);
  }

  const projectedCFYears = years.filter(yr => !actualCFYears.has(yr));
  for (const yr of projectedCFYears) {
    const existing = existingCF.find(r => r.year === yr);
    if (existing) {
      await db.delete(cashFlowLines).where(and(eq(cashFlowLines.modelId, modelId), eq(cashFlowLines.year, yr)));
    }
  }

  const cfData: Array<Record<string, any>> = [];
  const newCFRows: Array<Record<string, any>> = [];
  for (const yr of years) {
    const yearIdx = yr - model.startYear;

    if (actualCFYears.has(yr)) {
      const actual = existingCF.find(r => r.year === yr)!;
      cfData.push({
        modelId, year: yr, isActual: true,
        netIncome: actual.netIncome || 0,
        depreciationAdd: actual.depreciationAdd || 0,
        arChange: actual.arChange || 0,
        inventoryChange: actual.inventoryChange || 0,
        apChange: actual.apChange || 0,
        operatingCashFlow: actual.operatingCashFlow || 0,
        capex: actual.capex || 0,
        investingCashFlow: actual.investingCashFlow || 0,
        shortTermDebtChange: actual.shortTermDebtChange || 0,
        longTermDebtChange: actual.longTermDebtChange || 0,
        commonSharesChange: actual.commonSharesChange || 0,
        financingCashFlow: actual.financingCashFlow || 0,
        netCashChange: actual.netCashChange || 0,
        beginningCash: actual.beginningCash || 0,
        endingCash: actual.endingCash || 0,
        freeCashFlow: actual.freeCashFlow || 0,
      });
      continue;
    }

    const is = isData[yearIdx];
    const bs = bsData[yearIdx];
    const netInc = is?.netIncome || 0;
    const depAdd = is?.depreciation || 0;
    const arChg = yearIdx > 0 ? (bsData[yearIdx].accountsReceivable || 0) - (bsData[yearIdx - 1].accountsReceivable || 0) : 0;
    const invChg = yearIdx > 0 ? (bsData[yearIdx].inventory || 0) - (bsData[yearIdx - 1].inventory || 0) : 0;
    const apChg = yearIdx > 0 ? (bsData[yearIdx].accountsPayable || 0) - (bsData[yearIdx - 1].accountsPayable || 0) : 0;
    const opCF = netInc + depAdd - arChg - invChg + apChg;
    const capexVal = -(bs?.capex || 0);
    const invCF = capexVal;
    const stDebtChg = 0;
    const ltDebtChg = yearIdx > 0 ? (bsData[yearIdx].longTermDebt || 0) - (bsData[yearIdx - 1].longTermDebt || 0) : 0;
    const shareChg = 0;
    const finCF = stDebtChg + ltDebtChg + shareChg;
    const netCashChg = opCF + invCF + finCF;
    const beginCash = yearIdx > 0 ? (bsData[yearIdx - 1].cash || 0) : initialCash;
    const endCash = beginCash + netCashChg;
    const fcf = opCF + capexVal;

    const row = {
      modelId, year: yr, isActual: false,
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
    };
    cfData.push(row);
    newCFRows.push(row);
  }

  if (newCFRows.length > 0) {
    await db.insert(cashFlowLines).values(newCFRows);
  }

  const fcfProjections = cfData.map(c => c.freeCashFlow as number);
  const [existingDcf] = await db.select().from(dcfValuations).where(eq(dcfValuations.modelId, modelId));

  const riskFreeRate = existingDcf?.riskFreeRate ?? 0.043;
  const beta = existingDcf?.beta ?? 1.25;
  const marketReturn = existingDcf?.marketReturn ?? 0.10;
  const costOfEquity = riskFreeRate + beta * (marketReturn - riskFreeRate);
  const costOfDebt = existingDcf?.costOfDebt ?? 0.055;
  const dcfTaxRate = existingDcf?.taxRate ?? 0.25;
  const equityWeight = existingDcf?.equityWeight ?? 0.70;
  const debtWeight = existingDcf?.debtWeight ?? 0.30;
  const wacc = costOfEquity * equityWeight + costOfDebt * (1 - dcfTaxRate) * debtWeight;
  const longTermGrowth = existingDcf?.longTermGrowth ?? 0.025;
  const totalDebt = existingDcf?.totalDebt ?? 35000000;
  const currentSharePrice = existingDcf?.currentSharePrice ?? 45;

  let npv = 0;
  for (let i = 0; i < fcfProjections.length; i++) {
    npv += fcfProjections[i] / Math.pow(1 + wacc, i + 1);
  }
  const lastFCF = fcfProjections[fcfProjections.length - 1] || 0;
  const tv = wacc > longTermGrowth ? (lastFCF * (1 + longTermGrowth)) / (wacc - longTermGrowth) : 0;
  const tvDisc = tv / Math.pow(1 + wacc, fcfProjections.length);
  const targetEV = npv + tvDisc - totalDebt;
  const targetPrice = sharesOut > 0 ? targetEV / sharesOut : 0;

  const dcfPayload = {
    modelId,
    riskFreeRate, beta, marketReturn, costOfDebt,
    taxRate: dcfTaxRate, equityWeight, debtWeight, longTermGrowth,
    currentSharePrice, totalDebt, sharesOutstanding: sharesOut,
    costOfEquity: Math.round(costOfEquity * 10000) / 10000,
    wacc: Math.round(wacc * 10000) / 10000,
    npv: Math.round(npv),
    terminalValue: Math.round(tv),
    terminalValueDiscounted: Math.round(tvDisc),
    targetEquityValue: Math.round(targetEV),
    targetValue: Math.round(npv + tvDisc),
    targetPricePerShare: Math.round(targetPrice * 100) / 100,
  };

  if (existingDcf) {
    await db.update(dcfValuations).set(dcfPayload).where(eq(dcfValuations.modelId, modelId));
  } else {
    await db.insert(dcfValuations).values(dcfPayload);
  }

  const [existingVal] = await db.select().from(valuationComparisons).where(eq(valuationComparisons.modelId, modelId));
  const lastRevenue = annualRevenues[years[years.length - 1]] || 0;

  const nonZeroEpsData = isData.filter(d => d.eps !== 0);
  const lastEPS = nonZeroEpsData.length > 0 ? nonZeroEpsData[nonZeroEpsData.length - 1].eps : (isData[isData.length - 1]?.eps || 0);

  let earningsGrowth = 0.25;
  if (nonZeroEpsData.length >= 2) {
    const prev = nonZeroEpsData[nonZeroEpsData.length - 2].eps;
    const curr = nonZeroEpsData[nonZeroEpsData.length - 1].eps;
    if (Math.abs(prev) > 0.001) {
      earningsGrowth = (curr - prev) / Math.abs(prev);
    }
  } else if (isData.length >= 2) {
    const prev = isData[isData.length - 2]?.eps;
    if (prev && Math.abs(prev) > 0.001) {
      earningsGrowth = (lastEPS - prev) / Math.abs(prev);
    }
  }

  const prBullMult = existingVal?.prBullMultiple ?? 10;
  const prBaseMult = existingVal?.prBaseMultiple ?? 7.5;
  const prBearMult = existingVal?.prBearMultiple ?? 5;
  const peBullPeg = existingVal?.peBullPeg ?? 2;
  const peBasePeg = existingVal?.peBasePeg ?? 1.5;
  const peBearPeg = existingVal?.peBearPeg ?? 1;

  const rps = sharesOut > 0 ? lastRevenue / sharesOut : 0;
  const growthPct = Math.max(earningsGrowth * 100, 1);

  const peTargetPrice = (eps: number, growth: number, peg: number) => {
    if (Math.abs(eps) < 0.001) return 0;
    return Math.round(eps * growth * peg * 100) / 100;
  };

  const bullMult = model.scenarioBullMultiplier ?? 1.2;
  const baseMult = model.scenarioBaseMultiplier ?? 1.0;
  const bearMult = model.scenarioBearMultiplier ?? 0.8;

  const scenarioRevenues: Record<string, Record<number, number>> = { bull: {}, base: {}, bear: {} };
  for (let i = 1; i < years.length; i++) {
    const yr = years[i];
    const prevRev = annualRevenues[years[i - 1]] || 0;
    const curRev = annualRevenues[yr] || 0;
    if (prevRev > 0 && curRev > 0) {
      const yoyGrowth = (curRev - prevRev) / prevRev;
      scenarioRevenues.bull[yr] = Math.round(prevRev * (1 + yoyGrowth * bullMult));
      scenarioRevenues.base[yr] = Math.round(curRev);
      scenarioRevenues.bear[yr] = Math.round(prevRev * (1 + yoyGrowth * bearMult));
    }
  }

  const valPayload = {
    modelId,
    currentSharePrice,
    prBullMultiple: prBullMult, prBaseMultiple: prBaseMult, prBearMultiple: prBearMult,
    peBullPeg, peBasePeg, peBearPeg,
    prBullTarget: Math.round(rps * prBullMult * 100) / 100,
    prBaseTarget: Math.round(rps * prBaseMult * 100) / 100,
    prBearTarget: Math.round(rps * prBearMult * 100) / 100,
    peBullTarget: peTargetPrice(lastEPS, growthPct, peBullPeg),
    peBaseTarget: peTargetPrice(lastEPS, growthPct, peBasePeg),
    peBearTarget: peTargetPrice(lastEPS, growthPct, peBearPeg),
    dcfBullTarget: Math.round(targetPrice * bullMult * 100) / 100,
    dcfBaseTarget: Math.round(targetPrice * baseMult * 100) / 100,
    dcfBearTarget: Math.round(targetPrice * bearMult * 100) / 100,
    averageTarget: 0,
    percentToTarget: 0,
  };

  const allTargets = [
    valPayload.prBullTarget, valPayload.prBaseTarget, valPayload.prBearTarget,
    valPayload.peBullTarget, valPayload.peBaseTarget, valPayload.peBearTarget,
    valPayload.dcfBullTarget, valPayload.dcfBaseTarget, valPayload.dcfBearTarget,
  ];
  valPayload.averageTarget = Math.round(allTargets.reduce((s, v) => s + v, 0) / allTargets.length * 100) / 100;
  valPayload.percentToTarget = currentSharePrice > 0
    ? Math.round((valPayload.averageTarget - currentSharePrice) / currentSharePrice * 10000) / 10000
    : 0;

  const existingValData = (existingVal?.valuationData as Record<string, any>) || {};
  const fullValPayload = {
    ...valPayload,
    valuationData: { ...existingValData, scenarioRevenues },
  };

  if (existingVal) {
    await db.update(valuationComparisons).set(fullValPayload).where(eq(valuationComparisons.modelId, modelId));
  } else {
    await db.insert(valuationComparisons).values(fullValPayload);
  }

  return {
    revenue: annualRevenues,
    incomeStatement: isData,
    balanceSheet: bsData,
    cashFlow: cfData,
    dcf: dcfPayload,
    valuation: valPayload,
  };
}

export async function forecastForward(modelId: string) {
  const [model] = await db.select().from(financialModels).where(eq(financialModels.id, modelId));
  if (!model) throw new Error("Model not found");

  const lineItems = await db.select().from(revenueLineItems).where(eq(revenueLineItems.modelId, modelId));
  if (lineItems.length === 0) throw new Error("No revenue streams found. Add at least one revenue stream first.");

  const periods = await db.select().from(revenuePeriods).where(eq(revenuePeriods.modelId, modelId));
  const allYears = Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i);

  const hasAnyData = periods.some(p => (p.amount || 0) > 0);
  if (!hasAnyData) throw new Error("No existing revenue data to base projections on. Enter revenue for at least one year first.");

  const decayRate = model.growthDecayRate ?? 0;
  const bullMult = model.scenarioBullMultiplier ?? 1.2;
  const bearMult = model.scenarioBearMultiplier ?? 0.8;

  const getAmount = (liId: string, year: number, quarter: number): number => {
    const p = periods.find(p => p.lineItemId === liId && p.year === year && p.quarter === quarter);
    return p ? (p.amount || 0) : 0;
  };

  const emptySlots: Array<{ liId: string; year: number; quarter: number }> = [];
  for (const li of lineItems) {
    for (const yr of allYears) {
      for (let q = 1; q <= 4; q++) {
        if (getAmount(li.id, yr, q) === 0) {
          emptySlots.push({ liId: li.id, year: yr, quarter: q });
        }
      }
    }
  }

  const fillableSlots = emptySlots.filter(slot => {
    const streamHasDataElsewhere = periods.some(
      p => p.lineItemId === slot.liId && (p.amount || 0) > 0
    );
    return streamHasDataElsewhere;
  });

  if (fillableSlots.length === 0) throw new Error("All quarters already have revenue data. Nothing to forecast.");

  const newPeriods: Array<{
    lineItemId: string;
    modelId: string;
    year: number;
    quarter: number;
    amount: number;
    isActual: boolean;
  }> = [];

  const projectedAmounts = new Map<string, number>();
  const key = (liId: string, yr: number, q: number) => `${liId}:${yr}:${q}`;

  const scenarioRevenues: Record<string, Record<number, number>> = { bull: {}, base: {}, bear: {} };

  const lastYearWithData = Math.max(
    ...allYears.filter(yr => periods.some(p => p.year === yr && (p.amount || 0) > 0))
  );

  for (const li of lineItems) {
    const streamPeriods = periods.filter(p => p.lineItemId === li.id && (p.amount || 0) > 0);
    if (streamPeriods.length === 0) continue;

    for (let q = 1; q <= 4; q++) {
      const quarterValues: Array<{ year: number; amount: number }> = [];
      for (const yr of allYears) {
        const amt = getAmount(li.id, yr, q);
        if (amt > 0) {
          quarterValues.push({ year: yr, amount: amt });
        }
      }

      let baseGrowthRate = 0.05;
      if (quarterValues.length >= 2) {
        const sorted = [...quarterValues].sort((a, b) => a.year - b.year);
        const rates: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i - 1].amount > 0) {
            rates.push((sorted[i].amount - sorted[i - 1].amount) / sorted[i - 1].amount);
          }
        }
        if (rates.length > 0) {
          baseGrowthRate = rates.reduce((s, r) => s + r, 0) / rates.length;
          baseGrowthRate = Math.max(-0.5, Math.min(baseGrowthRate, 2.0));
        }
      }

      const emptyYearsForThisQuarter = allYears
        .filter(yr => getAmount(li.id, yr, q) === 0)
        .sort((a, b) => a - b);

      for (const emptyYear of emptyYearsForThisQuarter) {
        let projected = 0;

        const priorYearsWithData = quarterValues
          .filter(v => v.year < emptyYear)
          .sort((a, b) => b.year - a.year);
        const laterYearsWithData = quarterValues
          .filter(v => v.year > emptyYear)
          .sort((a, b) => a.year - b.year);

        const yearsFromLastData = emptyYear - lastYearWithData;
        const decayedGrowth = yearsFromLastData > 0
          ? baseGrowthRate * Math.pow(1 - decayRate, yearsFromLastData)
          : baseGrowthRate;

        if (priorYearsWithData.length > 0 && laterYearsWithData.length > 0) {
          const before = priorYearsWithData[0];
          const after = laterYearsWithData[0];
          const span = after.year - before.year;
          const position = emptyYear - before.year;
          const fraction = position / span;
          projected = Math.round(before.amount + (after.amount - before.amount) * fraction);
        } else if (priorYearsWithData.length > 0) {
          const alreadyProjected = projectedAmounts.get(key(li.id, emptyYear - 1, q));
          const baseAmount = alreadyProjected !== undefined
            ? alreadyProjected
            : priorYearsWithData[0].amount;
          projected = Math.round(baseAmount * (1 + decayedGrowth));
        } else if (laterYearsWithData.length > 0) {
          const nearest = laterYearsWithData[0];
          const yearsBehind = nearest.year - emptyYear;
          projected = Math.round(nearest.amount / Math.pow(1 + baseGrowthRate, yearsBehind));
        }

        projected = Math.max(0, projected);
        projectedAmounts.set(key(li.id, emptyYear, q), projected);

        if (yearsFromLastData > 0 && projected > 0) {
          const bullProjected = Math.round(projected * (1 + (decayedGrowth * bullMult - decayedGrowth)));
          const bearProjected = Math.round(projected * (1 + (decayedGrowth * bearMult - decayedGrowth)));
          scenarioRevenues.bull[emptyYear] = (scenarioRevenues.bull[emptyYear] || 0) + Math.max(0, bullProjected);
          scenarioRevenues.base[emptyYear] = (scenarioRevenues.base[emptyYear] || 0) + projected;
          scenarioRevenues.bear[emptyYear] = (scenarioRevenues.bear[emptyYear] || 0) + Math.max(0, bearProjected);
        }

        if (projected > 0) {
          newPeriods.push({
            lineItemId: li.id,
            modelId,
            year: emptyYear,
            quarter: q,
            amount: projected,
            isActual: false,
          });
        }
      }
    }
  }

  if (newPeriods.length === 0) throw new Error("Could not generate any projections. Ensure at least one revenue stream has data.");

  for (const np of newPeriods) {
    const existing = periods.find(p =>
      p.lineItemId === np.lineItemId && p.year === np.year && p.quarter === np.quarter
    );
    if (existing) {
      await db.update(revenuePeriods)
        .set({ amount: np.amount, isActual: false })
        .where(eq(revenuePeriods.id, existing.id));
    } else {
      await db.insert(revenuePeriods).values(np);
    }
  }

  const recalcResult = await recalculateModel(modelId);

  const [existingVal] = await db.select().from(valuationComparisons).where(eq(valuationComparisons.modelId, modelId));
  if (existingVal) {
    const existingData = (existingVal.valuationData as Record<string, any>) || {};
    await db.update(valuationComparisons)
      .set({ valuationData: { ...existingData, scenarioRevenues } })
      .where(eq(valuationComparisons.modelId, modelId));
  }

  const filledYears = [...new Set(newPeriods.map(p => p.year))].sort();
  return {
    forecastedYears: filledYears,
    periodsCreated: newPeriods.length,
    growthApplied: true,
    growthDecayRate: decayRate,
    scenarioRevenues,
    ...recalcResult,
  };
}
