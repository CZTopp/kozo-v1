import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModelProvider } from "@/lib/model-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import RevenueForecast from "@/pages/revenue-forecast";
import IncomeStatement from "@/pages/income-statement";
import BalanceSheet from "@/pages/balance-sheet";
import CashFlow from "@/pages/cash-flow";
import DCFValuation from "@/pages/dcf-valuation";
import ValuationComparison from "@/pages/valuation-comparison";
import Portfolio from "@/pages/portfolio";
import MarketDataPage from "@/pages/market-data";
import AnalysisGuide from "@/pages/analysis-guide";
import CompanyChart from "@/pages/company-chart";
import CryptoDashboard from "@/pages/crypto-dashboard";
import CryptoTokenomics from "@/pages/crypto-tokenomics";
import CryptoFinancials from "@/pages/crypto-financials";
import CryptoValuation from "@/pages/crypto-valuation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/revenue" component={RevenueForecast} />
      <Route path="/income-statement" component={IncomeStatement} />
      <Route path="/balance-sheet" component={BalanceSheet} />
      <Route path="/cash-flow" component={CashFlow} />
      <Route path="/dcf" component={DCFValuation} />
      <Route path="/valuation" component={ValuationComparison} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/market-data" component={MarketDataPage} />
      <Route path="/chart" component={CompanyChart} />
      <Route path="/guide" component={AnalysisGuide} />
      <Route path="/crypto" component={CryptoDashboard} />
      <Route path="/crypto/tokenomics/:id" component={CryptoTokenomics} />
      <Route path="/crypto/financials/:id" component={CryptoFinancials} />
      <Route path="/crypto/valuation/:id" component={CryptoValuation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ModelProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 min-w-0">
                  <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <ThemeToggle />
                  </header>
                  <main className="flex-1 overflow-auto">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </ModelProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
