import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModel } from "@/lib/model-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { LineChart, Search, Save, AlertTriangle } from "lucide-react";

declare global {
  interface Window {
    TradingView: any;
  }
}

let tvScriptLoaded = false;
function loadTradingViewScript(): Promise<void> {
  if (tvScriptLoaded && window.TradingView) return Promise.resolve();
  if (tvScriptLoaded) return new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.TradingView) { clearInterval(check); resolve(); }
    }, 100);
  });
  tvScriptLoaded = true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

const CONTAINER_ID = "tradingview_chart_container";

function TradingViewWidget({ symbol, theme }: { symbol: string; theme: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !symbol) return;
    let cancelled = false;

    loadTradingViewScript().then(() => {
      if (cancelled || !containerRef.current) return;

      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch (_) {}
        widgetRef.current = null;
      }
      containerRef.current.innerHTML = "";

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: "D",
        timezone: "Etc/UTC",
        theme: theme === "dark" ? "dark" : "light",
        style: "1",
        locale: "en",
        toolbar_bg: "transparent",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: CONTAINER_ID,
        hide_side_toolbar: false,
        studies: [
          { id: "MASimple@tv-basicstudies", inputs: { length: 50 } },
          { id: "MASimple@tv-basicstudies", inputs: { length: 200 } },
        ],
        overrides: {
          "mainSeriesProperties.candleStyle.upColor": "#22c55e",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch (_) {}
        widgetRef.current = null;
      }
    };
  }, [symbol, theme]);

  return (
    <div
      id={CONTAINER_ID}
      ref={containerRef}
      className="w-full"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
      data-testid="tradingview-widget-container"
    />
  );
}

export default function CompanyChart() {
  const { selectedModel } = useModel();
  const { toast } = useToast();

  const modelTicker = selectedModel?.ticker || "";
  const [ticker, setTicker] = useState(modelTicker || "AAPL");
  const [inputValue, setInputValue] = useState(modelTicker || "AAPL");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const t = modelTicker || "AAPL";
    setTicker(t);
    setInputValue(t);
  }, [modelTicker]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      setTheme(nowDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const saveTickerMutation = useMutation({
    mutationFn: async (newTicker: string) => {
      if (!selectedModel) return;
      await apiRequest("PATCH", `/api/models/${selectedModel.id}`, { ticker: newTicker });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Ticker saved", description: `Ticker updated to ${ticker} for ${selectedModel?.name}` });
    },
  });

  const handleSearch = () => {
    const cleaned = inputValue.trim().toUpperCase();
    if (cleaned) {
      setTicker(cleaned);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSaveTicker = () => {
    if (selectedModel && ticker) {
      saveTickerMutation.mutate(ticker);
    }
  };

  const quickSymbols = [
    { label: "S&P 500", symbol: "SPY" },
    { label: "Nasdaq", symbol: "QQQ" },
    { label: "AAPL", symbol: "AAPL" },
    { label: "MSFT", symbol: "MSFT" },
    { label: "GOOGL", symbol: "GOOGL" },
    { label: "AMZN", symbol: "AMZN" },
    { label: "TSLA", symbol: "TSLA" },
    { label: "NVDA", symbol: "NVDA" },
  ];

  const tickerDiffers = selectedModel && ticker !== (selectedModel.ticker || "");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Company Chart</h1>
          <p className="text-sm text-muted-foreground">
            Interactive price chart powered by TradingView
            {selectedModel && (
              <span> &mdash; {selectedModel.name}</span>
            )}
          </p>
        </div>
      </div>

      {selectedModel && !selectedModel.ticker && (
        <Card className="border-yellow-500/50" data-testid="card-no-ticker-warning">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm">
              No ticker is set for <span className="font-medium">{selectedModel.name}</span>. 
              Search for a symbol below and click "Save as Company Ticker" to link it.
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-chart-controls">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter ticker symbol (e.g. AAPL)"
                  className="pl-8"
                  data-testid="input-chart-ticker"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-load-chart">
                <LineChart className="h-4 w-4 mr-2" />
                Load Chart
              </Button>
              {ticker && (
                <Badge variant="outline" data-testid="badge-current-ticker">
                  {ticker}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Quick:</span>
              {quickSymbols.map((qs) => (
                <Badge
                  key={qs.symbol}
                  variant={ticker === qs.symbol ? "default" : "secondary"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setInputValue(qs.symbol);
                    setTicker(qs.symbol);
                  }}
                  data-testid={`badge-quick-${qs.symbol.toLowerCase()}`}
                >
                  {qs.label}
                </Badge>
              ))}
            </div>
            {selectedModel && tickerDiffers && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveTicker}
                  disabled={saveTickerMutation.isPending}
                  data-testid="button-save-ticker"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saveTickerMutation.isPending ? "Saving..." : `Save "${ticker}" as Company Ticker`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Currently saved: {selectedModel.ticker || "none"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-tradingview-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            {ticker} — Interactive Chart
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Use the toolbar to add indicators (RSI, MACD, Bollinger Bands), draw trendlines, and change timeframes. Moving averages (50 &amp; 200 day) are pre-loaded.
          </p>
        </CardHeader>
        <CardContent className="p-2">
          <TradingViewWidget symbol={ticker} theme={theme} />
        </CardContent>
      </Card>
    </div>
  );
}
