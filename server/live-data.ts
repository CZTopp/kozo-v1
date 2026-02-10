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
