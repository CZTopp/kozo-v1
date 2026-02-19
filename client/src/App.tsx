import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CopilotPanel, CopilotTrigger, CopilotProvider } from "@/components/copilot-panel";
import { ModelProvider } from "@/lib/model-context";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
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
import CryptoRevenueForecast from "@/pages/crypto-revenue-forecast";
import CryptoTokenFlows from "@/pages/crypto-token-flows";
import CryptoSettings from "@/pages/crypto-settings";
import AdminPage from "@/pages/admin";
import Landing from "@/pages/landing";

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
      <Route path="/crypto/revenue/:id" component={CryptoRevenueForecast} />
      <Route path="/crypto/token-flows/:id" component={CryptoTokenFlows} />
      <Route path="/crypto/settings/:id" component={CryptoSettings} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
    "--copilot-width": "22rem",
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n?.[0])
    .join("")
    .toUpperCase() || "U";

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User";

  return (
    <ModelProvider>
      <CopilotProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <CopilotTrigger />
                  <ThemeToggle />
                  <div className="flex items-center gap-2 pl-2 border-l">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground hidden sm:inline" data-testid="text-user-name">
                      {displayName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      aria-label="Log out"
                      data-testid="button-logout"
                    >
                      <a href="/api/logout" title="Log out">
                        <LogOut className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
            <CopilotPanel />
          </div>
        </SidebarProvider>
      </CopilotProvider>
    </ModelProvider>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
