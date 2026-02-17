import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const YAHOO_INDEX_SYMBOLS: Record<string, { name: string; region: string }> = {
  "^GSPC": { name: "S&P 500", region: "US" },
  "^NDX": { name: "NASDAQ 100", region: "US" },
  "^DJI": { name: "Dow Jones", region: "US" },
  "^RUT": { name: "Russell 2000", region: "US" },
  "^FTSE": { name: "FTSE 100", region: "Europe" },
  "^GDAXI": { name: "DAX", region: "Europe" },
  "^FCHI": { name: "CAC 40", region: "Europe" },
  "^N225": { name: "Nikkei 225", region: "Asia" },
  "^HSI": { name: "Hang Seng", region: "Asia" },
  "000001.SS": { name: "Shanghai Composite", region: "Asia" },
  "^BSESN": { name: "BSE Sensex", region: "Asia" },
  "^AXJO": { name: "ASX 200", region: "Asia-Pacific" },
};

const TICKER_MAP: Record<string, string> = {
  "^GSPC": "SPX",
  "^NDX": "NDX",
  "^DJI": "DJI",
  "^RUT": "RUT",
  "^FTSE": "UKX",
  "^GDAXI": "DAX",
  "^FCHI": "CAC",
  "^N225": "NI225",
  "^HSI": "HSI",
  "000001.SS": "SSEC",
  "^BSESN": "SENSEX",
  "^AXJO": "AXJO",
};

const FRED_SERIES: Record<string, { name: string; category: string; displayFormat: string }> = {
  "DFF": { name: "Fed Funds Rate", category: "Interest Rates", displayFormat: "percent" },
  "DGS10": { name: "10-Year Treasury", category: "Interest Rates", displayFormat: "percent" },
  "DGS2": { name: "2-Year Treasury", category: "Interest Rates", displayFormat: "percent" },
  "MORTGAGE30US": { name: "30-Year Mortgage", category: "Interest Rates", displayFormat: "percent" },
  "CPIAUCSL": { name: "CPI YoY", category: "Inflation", displayFormat: "percent" },
  "CPILFESL": { name: "Core CPI YoY", category: "Inflation", displayFormat: "percent" },
  "PCEPI": { name: "PCE Index YoY", category: "Inflation", displayFormat: "percent" },
  "PPIACO": { name: "PPI YoY", category: "Inflation", displayFormat: "percent" },
  "A191RL1Q225SBEA": { name: "GDP Growth QoQ", category: "Economic Growth", displayFormat: "percent" },
  "UNRATE": { name: "Unemployment Rate", category: "Labor Market", displayFormat: "percent" },
  "PAYEMS": { name: "Non-Farm Payrolls", category: "Labor Market", displayFormat: "number" },
  "VIXCLS": { name: "VIX", category: "Volatility", displayFormat: "number" },
  "DTWEXBGS": { name: "DXY (Dollar Index)", category: "Currency", displayFormat: "number" },
  "UMCSENT": { name: "Consumer Confidence", category: "Sentiment", displayFormat: "number" },
  "MANEMP": { name: "ISM Manufacturing", category: "Economic Activity", displayFormat: "number" },
  "NAPMSI": { name: "ISM Services", category: "Economic Activity", displayFormat: "number" },
};

interface IndexResult {
  name: string;
  ticker: string;
  region: string;
  currentValue: number;
  ytdReturn: number;
  mtdReturn: number;
  dailyChangePercent: number;
}

interface MacroResult {
  name: string;
  category: string;
  value: number;
  priorValue: number | null;
  displayFormat: string;
}

export async function fetchLiveIndices(): Promise<IndexResult[]> {
  const results: IndexResult[] = [];
  const symbols = Object.keys(YAHOO_INDEX_SYMBOLS);

  for (const symbol of symbols) {
    try {
      const quote: any = await yahooFinance.quote(symbol);
      const info = YAHOO_INDEX_SYMBOLS[symbol];
      const ticker = TICKER_MAP[symbol];

      const currentPrice = quote.regularMarketPrice ?? 0;
      const dailyChangePercent = quote.regularMarketChangePercent ? (quote.regularMarketChangePercent / 100) : 0;

      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let ytdReturn = 0;
      let mtdReturn = 0;

      try {
        const historicalYtd: any[] = await yahooFinance.historical(symbol, {
          period1: startOfYear,
          period2: new Date(startOfYear.getTime() + 7 * 24 * 60 * 60 * 1000),
          interval: "1d",
        } as any);
        if (historicalYtd.length > 0 && historicalYtd[0].close) {
          ytdReturn = (currentPrice - historicalYtd[0].close) / historicalYtd[0].close;
        }
      } catch {
        ytdReturn = quote.ytdReturn ?? 0;
      }

      try {
        const historicalMtd: any[] = await yahooFinance.historical(symbol, {
          period1: startOfMonth,
          period2: new Date(startOfMonth.getTime() + 7 * 24 * 60 * 60 * 1000),
          interval: "1d",
        } as any);
        if (historicalMtd.length > 0 && historicalMtd[0].close) {
          mtdReturn = (currentPrice - historicalMtd[0].close) / historicalMtd[0].close;
        }
      } catch {
        mtdReturn = 0;
      }

      results.push({
        name: info.name,
        ticker,
        region: info.region,
        currentValue: currentPrice,
        ytdReturn,
        mtdReturn,
        dailyChangePercent,
      });
    } catch (err) {
      console.warn(`Failed to fetch index ${symbol}:`, err);
    }
  }

  return results;
}

export interface PortfolioQuoteResult {
  ticker: string;
  currentPrice: number;
  dailyChangePercent: number;
  dailyChange: number;
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  previousClose: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  peRatio: number;
  eps: number;
  beta: number;
  ma50: number;
  ma200: number;
  week52Low: number;
  week52High: number;
  dividendYield: number;
  shortRatio: number;
  bookValue: number;
}

export async function fetchPortfolioQuotes(tickers: string[]): Promise<{ results: PortfolioQuoteResult[]; errors: string[] }> {
  const results: PortfolioQuoteResult[] = [];
  const errors: string[] = [];

  for (const ticker of tickers) {
    try {
      const quote: any = await yahooFinance.quote(ticker);
      if (!quote || !quote.regularMarketPrice) {
        errors.push(`No data for ${ticker}`);
        continue;
      }

      const currentPrice = quote.regularMarketPrice ?? 0;
      const previousClose = quote.regularMarketPreviousClose ?? currentPrice;
      const dailyChange = currentPrice - previousClose;
      const dailyChangePercent = previousClose > 0 ? dailyChange / previousClose : 0;

      results.push({
        ticker: ticker.toUpperCase(),
        currentPrice,
        dailyChangePercent,
        dailyChange,
        dayHigh: quote.regularMarketDayHigh ?? currentPrice,
        dayLow: quote.regularMarketDayLow ?? currentPrice,
        openPrice: quote.regularMarketOpen ?? currentPrice,
        previousClose,
        volume: quote.regularMarketVolume ?? 0,
        avgVolume: quote.averageDailyVolume3Month ?? quote.averageDailyVolume10Day ?? 0,
        marketCap: quote.marketCap ?? 0,
        peRatio: quote.trailingPE ?? quote.forwardPE ?? 0,
        eps: quote.epsTrailingTwelveMonths ?? quote.epsForward ?? 0,
        beta: quote.beta ?? 1,
        ma50: quote.fiftyDayAverage ?? 0,
        ma200: quote.twoHundredDayAverage ?? 0,
        week52Low: quote.fiftyTwoWeekLow ?? 0,
        week52High: quote.fiftyTwoWeekHigh ?? 0,
        dividendYield: quote.dividendYield ? quote.dividendYield / 100 : 0,
        shortRatio: quote.shortRatio ?? 0,
        bookValue: quote.bookValue ?? 0,
      });
    } catch (err: any) {
      errors.push(`${ticker}: ${err.message || "Failed"}`);
    }
  }

  return { results, errors };
}

export interface CompanyFundamentals {
  currentPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  trailingPE: number;
  forwardPE: number;
  eps: number;
  beta: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  debtToEquity: number;
  trailingFCF: number;
  sector: string;
  industry: string;
  dividendYield: number;
  revenuePerShare: number;
  bookValue: number;
  priceToBook: number;
  week52Low: number;
  week52High: number;
}

export async function fetchCompanyFundamentals(ticker: string): Promise<CompanyFundamentals | null> {
  try {
    const quote: any = await yahooFinance.quote(ticker);
    if (!quote || !quote.regularMarketPrice) return null;

    let trailingFCF = 0;
    let grossMargin = 0;
    let operatingMargin = 0;
    let netMargin = 0;
    let debtToEquity = 0;
    let sector = quote.sector ?? "";
    let industry = quote.industry ?? "";
    try {
      const summary: any = await yahooFinance.quoteSummary(ticker, { modules: ["financialData", "defaultKeyStatistics", "assetProfile"] });
      trailingFCF = summary?.financialData?.freeCashflow ?? 0;
      grossMargin = summary?.financialData?.grossMargins ?? 0;
      operatingMargin = summary?.financialData?.operatingMargins ?? 0;
      netMargin = summary?.financialData?.profitMargins ?? 0;
      debtToEquity = summary?.financialData?.debtToEquity ?? 0;
      if (summary?.assetProfile?.sector) sector = summary.assetProfile.sector;
      if (summary?.assetProfile?.industry) industry = summary.assetProfile.industry;
    } catch {
      trailingFCF = 0;
    }

    return {
      currentPrice: quote.regularMarketPrice ?? 0,
      sharesOutstanding: quote.sharesOutstanding ?? 0,
      marketCap: quote.marketCap ?? 0,
      trailingPE: quote.trailingPE ?? 0,
      forwardPE: quote.forwardPE ?? 0,
      eps: quote.epsTrailingTwelveMonths ?? quote.epsForward ?? 0,
      beta: quote.beta ?? 1,
      grossMargin,
      operatingMargin,
      netMargin,
      debtToEquity,
      trailingFCF,
      sector,
      industry,
      dividendYield: quote.dividendYield ? quote.dividendYield / 100 : 0,
      revenuePerShare: quote.revenuePerShare ?? 0,
      bookValue: quote.bookValue ?? 0,
      priceToBook: quote.priceToBook ?? 0,
      week52Low: quote.fiftyTwoWeekLow ?? 0,
      week52High: quote.fiftyTwoWeekHigh ?? 0,
    };
  } catch (err: any) {
    console.warn(`Failed to fetch fundamentals for ${ticker}:`, err.message || err);
    return null;
  }
}

export async function fetchSingleIndexQuote(symbol: string): Promise<IndexResult | null> {
  try {
    const quote: any = await yahooFinance.quote(symbol);
    if (!quote || !quote.regularMarketPrice) return null;

    const currentPrice = quote.regularMarketPrice ?? 0;
    const dailyChangePercent = quote.regularMarketChangePercent ? (quote.regularMarketChangePercent / 100) : 0;
    const shortName = quote.shortName || quote.longName || symbol;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let ytdReturn = 0;
    let mtdReturn = 0;

    try {
      const historicalYtd: any[] = await yahooFinance.historical(symbol, {
        period1: startOfYear,
        period2: new Date(startOfYear.getTime() + 7 * 24 * 60 * 60 * 1000),
        interval: "1d",
      } as any);
      if (historicalYtd.length > 0 && historicalYtd[0].close) {
        ytdReturn = (currentPrice - historicalYtd[0].close) / historicalYtd[0].close;
      }
    } catch {
      ytdReturn = 0;
    }

    try {
      const historicalMtd: any[] = await yahooFinance.historical(symbol, {
        period1: startOfMonth,
        period2: new Date(startOfMonth.getTime() + 7 * 24 * 60 * 60 * 1000),
        interval: "1d",
      } as any);
      if (historicalMtd.length > 0 && historicalMtd[0].close) {
        mtdReturn = (currentPrice - historicalMtd[0].close) / historicalMtd[0].close;
      }
    } catch {
      mtdReturn = 0;
    }

    return {
      name: shortName,
      ticker: symbol.replace(/\^/g, ""),
      region: "Custom",
      currentValue: currentPrice,
      ytdReturn,
      mtdReturn,
      dailyChangePercent,
    };
  } catch {
    return null;
  }
}

export async function fetchSingleFredSeries(seriesId: string, apiKey: string): Promise<MacroResult | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=3`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as { observations?: Array<{ value: string; date: string }> };
    const observations = data.observations || [];
    if (observations.length === 0) return null;

    const latestRaw = parseFloat(observations[0].value);
    if (isNaN(latestRaw)) return null;

    let priorValue: number | null = null;
    if (observations.length >= 2) {
      const prevRaw = parseFloat(observations[1].value);
      if (!isNaN(prevRaw)) priorValue = prevRaw;
    }

    const seriesUrl = `https://api.stlouisfed.org/fred/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`;
    const seriesResponse = await fetch(seriesUrl);
    let seriesName = seriesId;
    if (seriesResponse.ok) {
      const seriesData = await seriesResponse.json() as { seriess?: Array<{ title: string }> };
      if (seriesData.seriess?.[0]?.title) {
        seriesName = seriesData.seriess[0].title;
      }
    }

    return {
      name: seriesName,
      category: "Custom",
      value: latestRaw,
      priorValue,
      displayFormat: "number",
    };
  } catch {
    return null;
  }
}

export async function fetchFredIndicators(apiKey: string): Promise<MacroResult[]> {
  const results: MacroResult[] = [];
  const seriesIds = Object.keys(FRED_SERIES);

  const yoySeries = ["CPIAUCSL", "CPILFESL", "PCEPI", "PPIACO"];

  for (const seriesId of seriesIds) {
    try {
      const limit = yoySeries.includes(seriesId) ? 14 : 3;
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`FRED API error for ${seriesId}: ${response.status}`);
        continue;
      }

      const data = await response.json() as { observations?: Array<{ value: string; date: string }> };
      const observations = data.observations || [];
      if (observations.length === 0) continue;

      const latestRaw = parseFloat(observations[0].value);
      if (isNaN(latestRaw)) continue;

      const info = FRED_SERIES[seriesId];
      let finalValue = latestRaw;
      let priorValue: number | null = null;

      if (info.displayFormat === "percent") {
        if (["DFF", "DGS10", "DGS2", "MORTGAGE30US", "UNRATE"].includes(seriesId)) {
          finalValue = latestRaw / 100;
          if (observations.length >= 2) {
            const prevRaw = parseFloat(observations[1].value);
            if (!isNaN(prevRaw)) priorValue = prevRaw / 100;
          }
        } else if (yoySeries.includes(seriesId)) {
          if (observations.length >= 13) {
            const yearAgo = parseFloat(observations[12].value);
            if (!isNaN(yearAgo) && yearAgo !== 0) {
              finalValue = (latestRaw - yearAgo) / yearAgo;
            }
            if (observations.length >= 14) {
              const prevMonth = parseFloat(observations[1].value);
              const prevYearAgo = parseFloat(observations[13].value);
              if (!isNaN(prevMonth) && !isNaN(prevYearAgo) && prevYearAgo !== 0) {
                priorValue = (prevMonth - prevYearAgo) / prevYearAgo;
              }
            }
          } else if (observations.length >= 2) {
            const prev = parseFloat(observations[1].value);
            if (!isNaN(prev) && prev !== 0) {
              finalValue = (latestRaw - prev) / prev;
            }
          }
        } else if (seriesId === "A191RL1Q225SBEA") {
          finalValue = latestRaw / 100;
          if (observations.length >= 2) {
            const prevRaw = parseFloat(observations[1].value);
            if (!isNaN(prevRaw)) priorValue = prevRaw / 100;
          }
        }
      } else {
        if (observations.length >= 2) {
          const prevRaw = parseFloat(observations[1].value);
          if (!isNaN(prevRaw)) priorValue = prevRaw;
        }
      }

      results.push({
        name: info.name,
        category: info.category,
        value: finalValue,
        priorValue,
        displayFormat: info.displayFormat,
      });
    } catch (err) {
      console.warn(`Failed to fetch FRED series ${seriesId}:`, err);
    }
  }

  return results;
}
