import { db } from "./db";
import { eq } from "drizzle-orm";
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

  const years = Array.from({ length: model.endYear - model.startYear + 1 }, (_, i) => model.startYear + i);
  const sharesOut = model.sharesOutstanding || 50000000;

  const cogsPercent = baseAssumptions ? parseFloat(baseAssumptions.cogsPercent) : 0.28;
  const smPercent = baseAssumptions ? parseFloat(baseAssumptions.salesMarketingPercent) : 0.22;
  const rdPercent = baseAssumptions ? parseFloat(baseAssumptions.rdPercent) : 0.18;
  const gaPercent = baseAssumptions ? parseFloat(baseAssumptions.gaPercent) : 0.08;
  const depPercent = baseAssumptions ? parseFloat(baseAssumptions.depreciationPercent) : 0.015;
  const taxRate = baseAssumptions ? parseFloat(baseAssumptions.taxRate) : 0.25;
  const arPercent = baseAssumptions ? parseFloat(baseAssumptions.arPercent) : 0.12;
  const invPercent = 0.03;
  const apPercent = baseAssumptions ? parseFloat(baseAssumptions.apPercent) : 0.08;
  const capexPercent = baseAssumptions ? parseFloat(baseAssumptions.capexPercent) : 0.04;
  const initialCash = baseAssumptions ? parseFloat(baseAssumptions.initialCash) : 50000000;

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

  await db.delete(incomeStatementLines).where(eq(incomeStatementLines.modelId, modelId));

  const isData: Array<{
    modelId: string; year: number; isActual: boolean;
    revenue: number; cogs: number; grossProfit: number;
    salesMarketing: number; researchDevelopment: number; generalAdmin: number;
    depreciation: number; totalExpenses: number; operatingIncome: number;
    ebitda: number; otherIncome: number; preTaxIncome: number;
    incomeTax: number; netIncome: number; sharesOutstanding: number;
    eps: number; nonGaapEps: number;
    cogsPercent: number; smPercent: number; rdPercent: number;
    gaPercent: number; depreciationPercent: number; taxRate: number;
  }> = [];

  for (const yr of years) {
    const yearIdx = yr - model.startYear;
    const totalRev = annualRevenues[yr];
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

    isData.push({
      modelId, year: yr, isActual: yearIdx === 0,
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
    });
  }

  if (isData.length > 0) {
    await db.insert(incomeStatementLines).values(isData);
  }

  await db.delete(balanceSheetLines).where(eq(balanceSheetLines.modelId, modelId));

  const bsData: Array<Record<string, any>> = [];
  let retainedEarnings = 20000000;

  for (const yr of years) {
    const yearIdx = yr - model.startYear;
    const totalRev = annualRevenues[yr];
    const netInc = isData[yearIdx]?.netIncome || 0;
    retainedEarnings += netInc;

    const cash = initialCash + yearIdx * 25000000;
    const stInv = 10000000 + yearIdx * 5000000;
    const ar = totalRev * arPercent;
    const inv = totalRev * invPercent;
    const totalCA = cash + stInv + ar + inv;
    const equip = 15000000 + yearIdx * 5000000;
    const depAccum = yearIdx * 3000000;
    const capex = totalRev * capexPercent;
    const totalLTA = equip - depAccum + capex;
    const totalAssets = totalCA + totalLTA;
    const ap = totalRev * apPercent;
    const stDebt = 5000000;
    const totalCL = ap + stDebt;
    const ltDebt = 30000000 - yearIdx * 3000000;
    const totalLTL = ltDebt;
    const totalLiab = totalCL + totalLTL;
    const commonShares = 100000000;
    const totalEquity = commonShares + retainedEarnings;
    const totalLE = totalLiab + totalEquity;

    bsData.push({
      modelId, year: yr, isActual: yearIdx === 0,
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
    });
  }

  if (bsData.length > 0) {
    await db.insert(balanceSheetLines).values(bsData);
  }

  await db.delete(cashFlowLines).where(eq(cashFlowLines.modelId, modelId));

  const cfData: Array<Record<string, any>> = [];
  for (const yr of years) {
    const yearIdx = yr - model.startYear;
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

    cfData.push({
      modelId, year: yr, isActual: yearIdx === 0,
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

  if (cfData.length > 0) {
    await db.insert(cashFlowLines).values(cfData);
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
  const lastEPS = isData[isData.length - 1]?.eps || 0;
  const earningsGrowth = isData.length >= 2 && isData[isData.length - 2]?.eps
    ? (lastEPS - isData[isData.length - 2].eps) / Math.abs(isData[isData.length - 2].eps)
    : 0.25;

  const prBullMult = existingVal?.prBullMultiple ?? 10;
  const prBaseMult = existingVal?.prBaseMultiple ?? 7.5;
  const prBearMult = existingVal?.prBearMultiple ?? 5;
  const peBullPeg = existingVal?.peBullPeg ?? 2;
  const peBasePeg = existingVal?.peBasePeg ?? 1.5;
  const peBearPeg = existingVal?.peBearPeg ?? 1;

  const rps = sharesOut > 0 ? lastRevenue / sharesOut : 0;
  const growthPct = earningsGrowth * 100;

  const valPayload = {
    modelId,
    currentSharePrice,
    prBullMultiple: prBullMult, prBaseMultiple: prBaseMult, prBearMultiple: prBearMult,
    peBullPeg, peBasePeg, peBearPeg,
    prBullTarget: Math.round(rps * prBullMult * 100) / 100,
    prBaseTarget: Math.round(rps * prBaseMult * 100) / 100,
    prBearTarget: Math.round(rps * prBearMult * 100) / 100,
    peBullTarget: Math.round(lastEPS * growthPct * peBullPeg * 100) / 100,
    peBaseTarget: Math.round(lastEPS * growthPct * peBasePeg * 100) / 100,
    peBearTarget: Math.round(lastEPS * growthPct * peBearPeg * 100) / 100,
    dcfBullTarget: Math.round(targetPrice * 1.2 * 100) / 100,
    dcfBaseTarget: Math.round(targetPrice * 100) / 100,
    dcfBearTarget: Math.round(targetPrice * 0.8 * 100) / 100,
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

  if (existingVal) {
    await db.update(valuationComparisons).set(valPayload).where(eq(valuationComparisons.modelId, modelId));
  } else {
    await db.insert(valuationComparisons).values(valPayload);
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
