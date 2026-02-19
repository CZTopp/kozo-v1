import * as cheerio from "cheerio";

const SEC_USER_AGENT = "Kozo Financial App admin@kozo-app.com";

interface ContextPeriod {
  startDate: string;
  endDate: string;
  instant?: string;
}

interface ParsedValue {
  name: string;
  value: number;
  contextRef: string;
  unitRef: string;
  decimals: string;
  scale: number;
}

export interface EdgarParsedData {
  years: number[];
  statementType: "income-statement" | "balance-sheet" | "cash-flow";
  data: Record<number, Record<string, number>>;
  companyName: string;
  filingDate: string;
  matchedFields: string[];
  unmatchedGaap: string[];
}

const INCOME_STATEMENT_MAP: Record<string, string> = {
  "Revenues": "totalRevenue",
  "RevenueFromContractWithCustomerExcludingAssessedTax": "totalRevenue",
  "SalesRevenueNet": "totalRevenue",
  "RevenueFromContractWithCustomerIncludingAssessedTax": "totalRevenue",
  "CostOfGoodsAndServicesSold": "cogs",
  "CostOfRevenue": "cogs",
  "CostOfGoodsSold": "cogs",
  "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization": "cogs",
  "GrossProfit": "grossProfit",
  "SellingGeneralAndAdministrativeExpense": "sgaExpense",
  "GeneralAndAdministrativeExpense": "sgaExpense",
  "ResearchAndDevelopmentExpense": "rdExpense",
  "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost": "rdExpense",
  "OperatingIncomeLoss": "operatingIncome",
  "InterestExpense": "interestExpense",
  "InterestExpenseDebt": "interestExpense",
  "InterestIncomeExpenseNet": "interestExpense",
  "OtherNonoperatingIncomeExpense": "otherIncome",
  "NonoperatingIncomeExpense": "otherIncome",
  "IncomeTaxExpenseBenefit": "taxExpense",
  "NetIncomeLoss": "netIncome",
  "NetIncomeLossAvailableToCommonStockholdersBasic": "netIncome",
  "EarningsPerShareBasic": "epsBasic",
  "EarningsPerShareDiluted": "epsDiluted",
  "DepreciationAndAmortization": "depreciation",
  "DepreciationDepletionAndAmortization": "depreciation",
  "RestructuringCharges": "restructuring",
};

const BALANCE_SHEET_MAP: Record<string, string> = {
  "CashAndCashEquivalentsAtCarryingValue": "cashAndEquivalents",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents": "cashAndEquivalents",
  "ShortTermInvestments": "shortTermInvestments",
  "AvailableForSaleSecuritiesDebtSecuritiesCurrent": "shortTermInvestments",
  "AccountsReceivableNetCurrent": "accountsReceivable",
  "AccountsReceivableNet": "accountsReceivable",
  "InventoryNet": "inventory",
  "InventoryFinishedGoods": "inventory",
  "AssetsCurrent": "totalCurrentAssets",
  "PropertyPlantAndEquipmentNet": "propertyPlantEquipment",
  "Goodwill": "goodwill",
  "IntangibleAssetsNetExcludingGoodwill": "intangibleAssets",
  "FiniteLivedIntangibleAssetsNet": "intangibleAssets",
  "Assets": "totalAssets",
  "AccountsPayableCurrent": "accountsPayable",
  "AccruedLiabilitiesCurrent": "accruedLiabilities",
  "ShortTermBorrowings": "shortTermDebt",
  "DebtCurrent": "shortTermDebt",
  "LongTermDebt": "longTermDebt",
  "LongTermDebtNoncurrent": "longTermDebt",
  "LiabilitiesCurrent": "totalCurrentLiabilities",
  "Liabilities": "totalLiabilities",
  "CommonStockValue": "commonStock",
  "AdditionalPaidInCapitalCommonStock": "additionalPaidInCapital",
  "RetainedEarningsAccumulatedDeficit": "retainedEarnings",
  "AccumulatedOtherComprehensiveIncomeLossNetOfTax": "aociAccumulated",
  "StockholdersEquity": "totalEquity",
  "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest": "totalEquity",
  "LiabilitiesAndStockholdersEquity": "totalLiabilitiesAndEquity",
  "TreasuryStockValue": "treasuryStock",
};

const CASH_FLOW_MAP: Record<string, string> = {
  "NetIncomeLoss": "netIncome",
  "DepreciationDepletionAndAmortization": "depreciationAdd",
  "Depreciation": "depreciationAdd",
  "DepreciationAndAmortization": "depreciationAdd",
  "AdjustmentForAmortization": "depreciationAdd",
  "IncreaseDecreaseInAccountsReceivable": "arChange",
  "IncreaseDecreaseInInventories": "inventoryChange",
  "IncreaseDecreaseInAccountsPayable": "apChange",
  "NetCashProvidedByUsedInOperatingActivities": "operatingCashFlow",
  "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations": "operatingCashFlow",
  "PaymentsToAcquirePropertyPlantAndEquipment": "capex",
  "PaymentsToAcquireProductiveAssets": "capex",
  "NetCashProvidedByUsedInInvestingActivities": "investingCashFlow",
  "NetCashProvidedByUsedInInvestingActivitiesContinuingOperations": "investingCashFlow",
  "ProceedsFromIssuanceOfLongTermDebt": "longTermDebtChange",
  "RepaymentsOfLongTermDebt": "longTermDebtChange",
  "ProceedsFromIssuanceOfCommonStock": "commonSharesChange",
  "PaymentsForRepurchaseOfCommonStock": "commonSharesChange",
  "NetCashProvidedByUsedInFinancingActivities": "financingCashFlow",
  "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations": "financingCashFlow",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect": "netCashChange",
  "CashAndCashEquivalentsPeriodIncreaseDecrease": "netCashChange",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents": "endingCash",
};

function getStatementMap(statementType: string): Record<string, string> {
  switch (statementType) {
    case "income-statement": return INCOME_STATEMENT_MAP;
    case "balance-sheet": return BALANCE_SHEET_MAP;
    case "cash-flow": return CASH_FLOW_MAP;
    default: return {};
  }
}

function detectStatementType(gaapNames: string[]): "income-statement" | "balance-sheet" | "cash-flow" {
  const nameSet = new Set(gaapNames);

  let isScore = 0, bsScore = 0, cfScore = 0;

  const isKeys = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "CostOfGoodsAndServicesSold", "GrossProfit", "OperatingIncomeLoss", "EarningsPerShareBasic"];
  const bsKeys = ["Assets", "AssetsCurrent", "Liabilities", "StockholdersEquity", "PropertyPlantAndEquipmentNet", "Goodwill"];
  const cfKeys = ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInInvestingActivities", "NetCashProvidedByUsedInFinancingActivities", "PaymentsToAcquirePropertyPlantAndEquipment"];

  for (const k of isKeys) if (nameSet.has(k)) isScore++;
  for (const k of bsKeys) if (nameSet.has(k)) bsScore++;
  for (const k of cfKeys) if (nameSet.has(k)) cfScore++;

  if (cfScore >= bsScore && cfScore >= isScore) return "cash-flow";
  if (bsScore >= isScore) return "balance-sheet";
  return "income-statement";
}

export async function fetchAndParseEdgar(url: string, requestedType?: string): Promise<EdgarParsedData> {
  if (!url.includes("sec.gov")) {
    throw new Error("URL must be from sec.gov (SEC EDGAR)");
  }

  const response = await fetch(url, {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SEC filing: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const contexts: Record<string, ContextPeriod> = {};
  const segmentContextIds = new Set<string>();
  $("xbrli\\:context, context").each((_i, el) => {
    const id = $(el).attr("id");
    if (!id) return;

    const hasSegment = $(el).find("xbrldi\\:explicitMember, xbrldi\\:explicitMember, explicitMember").length > 0;
    if (hasSegment) {
      segmentContextIds.add(id);
      return;
    }

    const startDate = $(el).find("xbrli\\:startDate, startDate").text();
    const endDate = $(el).find("xbrli\\:endDate, endDate").text();
    const instant = $(el).find("xbrli\\:instant, instant").text();

    if (startDate && endDate) {
      contexts[id] = { startDate, endDate };
    } else if (instant) {
      contexts[id] = { startDate: "", endDate: "", instant };
    }
  });

  const annualContexts: Record<string, number> = {};
  const instantContexts: Record<string, number> = {};

  for (const [ctxId, period] of Object.entries(contexts)) {
    if (period.instant) {
      const year = parseInt(period.instant.substring(0, 4));
      if (!isNaN(year)) {
        instantContexts[ctxId] = year;
      }
      continue;
    }

    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > 300 && diffDays < 400) {
      const year = end.getFullYear();
      annualContexts[ctxId] = year;
    }
  }

  const values: ParsedValue[] = [];
  $("ix\\:nonFraction, ix\\:nonfraction").each((_i, el) => {
    const name = $(el).attr("name") || "";
    const contextRef = $(el).attr("contextref") || $(el).attr("contextRef") || "";
    const unitRef = $(el).attr("unitref") || $(el).attr("unitRef") || "";
    const decimals = $(el).attr("decimals") || "0";
    const scaleStr = $(el).attr("scale") || "0";
    const scale = parseInt(scaleStr) || 0;
    const sign = $(el).attr("sign");

    const rawText = $(el).text().replace(/,/g, "").trim();
    let numVal = parseFloat(rawText);
    if (isNaN(numVal)) return;

    if (sign === "-" || sign === "negative") {
      numVal = -Math.abs(numVal);
    }

    numVal = numVal * Math.pow(10, scale);

    const shortName = name.replace(/^(us-gaap:|dei:|mrk:)/i, "");
    values.push({ name: shortName, value: numVal, contextRef, unitRef, decimals, scale });
  });

  const gaapNames = Array.from(new Set(values.map(v => v.name)));
  const statementType = requestedType as any || detectStatementType(gaapNames);
  const fieldMap = getStatementMap(statementType);

  const useInstant = statementType === "balance-sheet";
  const contextMap = useInstant
    ? { ...annualContexts, ...instantContexts }
    : annualContexts;

  const data: Record<number, Record<string, number>> = {};
  const matchedFieldsSet = new Set<string>();
  const unmatchedGaapSet = new Set<string>();

  for (const val of values) {
    const year = contextMap[val.contextRef];
    if (!year) continue;

    const appField = fieldMap[val.name];
    if (appField) {
      if (!data[year]) data[year] = {};
      if (data[year][appField] === undefined) {
        data[year][appField] = val.value;
      }
      matchedFieldsSet.add(appField);
    } else if (val.unitRef === "usd" || val.unitRef?.toLowerCase().includes("usd")) {
      unmatchedGaapSet.add(val.name);
    }
  }

  const years = Object.keys(data).map(Number).sort();

  let companyName = "";
  const entityName = $("dei\\:EntityRegistrantName, ix\\:nonFraction[name='dei:EntityRegistrantName'], ix\\:nonNumeric[name='dei:EntityRegistrantName']").first().text().trim();
  if (entityName) companyName = entityName;

  let filingDate = "";
  const periodEnd = $("dei\\:CurrentFiscalYearEndDate, ix\\:nonNumeric[name='dei:CurrentFiscalYearEndDate']").first().text().trim();
  if (periodEnd) filingDate = periodEnd;

  return {
    years,
    statementType,
    data,
    companyName,
    filingDate,
    matchedFields: Array.from(matchedFieldsSet),
    unmatchedGaap: Array.from(unmatchedGaapSet).slice(0, 30),
  };
}
