import { fetchAndParseEdgar, type EdgarParsedData } from "./edgar-parser";

const SEC_USER_AGENT = "Foresight Financial App admin@foresight-app.com";

export interface CompanySearchResult {
  cik: string;
  companyName: string;
  ticker: string;
}

export interface FilingEntry {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
  form: string;
  reportDate: string;
  filingUrl: string;
}

export interface AllStatementsResult {
  incomeStatement: EdgarParsedData;
  balanceSheet: EdgarParsedData;
  cashFlow: EdgarParsedData;
}

export async function searchCompanyByTicker(ticker: string): Promise<CompanySearchResult | null> {
  const normalizedTicker = ticker.toUpperCase().trim();

  const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SEC company tickers: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, { cik_str: number; ticker: string; title: string }>;

  for (const entry of Object.values(data)) {
    if (entry.ticker.toUpperCase() === normalizedTicker) {
      return {
        cik: String(entry.cik_str),
        companyName: entry.title,
        ticker: entry.ticker.toUpperCase(),
      };
    }
  }

  return null;
}

export async function getCompanyFilings(cik: string, formTypes: string[] = ["10-K"]): Promise<FilingEntry[]> {
  const paddedCik = cik.padStart(10, "0");

  const response = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SEC filings for CIK ${cik}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    cik: string;
    entityType: string;
    name: string;
    recentFilings?: {
      accessionNumber: string[];
      filingDate: string[];
      primaryDocument: string[];
      form: string[];
      reportDate: string[];
    };
    filings?: {
      recent: {
        accessionNumber: string[];
        filingDate: string[];
        primaryDocument: string[];
        form: string[];
        reportDate: string[];
      };
    };
  };

  const recent = data.filings?.recent || data.recentFilings;
  if (!recent || !recent.accessionNumber) {
    return [];
  }

  const formTypeSet = new Set(formTypes.map(f => f.toUpperCase()));
  const entries: FilingEntry[] = [];

  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const form = recent.form[i];
    if (!formTypeSet.has(form.toUpperCase())) continue;

    const accessionNumber = recent.accessionNumber[i];
    const accessionNumberNoDashes = accessionNumber.replace(/-/g, "");
    const primaryDocument = recent.primaryDocument[i];

    entries.push({
      accessionNumber,
      filingDate: recent.filingDate[i],
      primaryDocument,
      form,
      reportDate: recent.reportDate[i] || "",
      filingUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumberNoDashes}/${primaryDocument}`,
    });
  }

  entries.sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return entries.slice(0, 5);
}

export async function fetchAndParseAllStatements(filingUrl: string): Promise<AllStatementsResult> {
  const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
    fetchAndParseEdgar(filingUrl, "income-statement"),
    fetchAndParseEdgar(filingUrl, "balance-sheet"),
    fetchAndParseEdgar(filingUrl, "cash-flow"),
  ]);

  return { incomeStatement, balanceSheet, cashFlow };
}

export type { EdgarParsedData };
