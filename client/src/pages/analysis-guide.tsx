import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  DollarSign,
  FileSpreadsheet,
  BarChart3,
  Wallet,
  Calculator,
  Scale,
  Briefcase,
  TrendingUp,
  ArrowRight,
  ArrowDown,
  Settings2,
  Zap,
} from "lucide-react";

const sections = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
    purpose: "Your command center. Provides a high-level snapshot of your financial model, portfolio performance, and macroeconomic context in one place.",
    keyMetrics: ["Total Revenue (Latest Year)", "Portfolio Value & Total Return", "Portfolio Beta", "S&P 500 YTD"],
    howToUse: [
      "Start here to assess overall health before diving into individual pages.",
      "Compare your portfolio return against the S&P 500 YTD to evaluate relative performance.",
      "Check the Revenue & Profitability chart for trend direction -- are revenue, EBITDA, and net income moving in the same direction?",
      "Review sector allocation to ensure you are not over-concentrated in any one sector.",
      "Monitor top daily movers for positions that may need immediate attention.",
    ],
    tips: "If portfolio beta is above 1.2, your portfolio is significantly more volatile than the market. Consider rebalancing if this doesn't align with your risk tolerance.",
    cascadeInfo: null,
  },
  {
    title: "Revenue Forecast",
    icon: DollarSign,
    path: "/revenue",
    purpose: "The starting point of your financial model. Enter quarterly revenue by stream and project future revenue using historical growth rates.",
    keyMetrics: ["Annual Revenue by Stream", "YoY Growth Rates", "Projection Settings"],
    howToUse: [
      "Click 'Edit' to modify individual quarterly revenue figures for each revenue stream (Subscription, Services, Marketplace, Usage-Based).",
      "Use 'Forecast Forward' to auto-project revenue into empty future years based on average historical growth rates.",
      "Open 'Projection Settings' to fine-tune how projections behave:",
      "  -- Growth Decay Rate: Set above 0 to make growth naturally slow down over time (e.g., 0.15 = 15% annual decay in the growth rate).",
      "  -- Target Net Margin: Set a target and cost assumptions will converge toward it over the projection period.",
      "  -- Scenario Multipliers: Adjust bull/base/bear multipliers to create optimistic and pessimistic revenue scenarios.",
      "After making changes, click 'Save & Recalculate' to cascade through all downstream statements.",
    ],
    tips: "Revenue is the foundation. Every change here ripples through Income Statement, Balance Sheet, Cash Flow, DCF, and Valuation. Start with realistic base-case assumptions and adjust scenarios from there.",
    cascadeInfo: "Revenue is the top of the cascade. Changes here flow downstream to all other financial statements.",
  },
  {
    title: "Income Statement (P&L)",
    icon: FileSpreadsheet,
    path: "/income-statement",
    purpose: "Shows how revenue translates into profit through various cost layers. Editable cost assumptions drive the entire P&L.",
    keyMetrics: ["Revenue", "Gross Profit & Margin", "Operating Income & Margin", "Net Income & Margin", "EPS"],
    howToUse: [
      "Click 'Edit Assumptions' to modify cost percentages (COGS, S&M, R&D, G&A, Depreciation, Tax Rate).",
      "Each cost line is expressed as a percentage of revenue -- when revenue changes, costs scale proportionally.",
      "Review the Margin Analysis tab to see how margins evolve over your model period. Expanding margins signal operating leverage.",
      "Check the Growth Rates tab to compare revenue growth vs. net income growth. Faster bottom-line growth indicates margin expansion.",
      "After changing assumptions, click 'Save & Recalculate' to update all downstream statements.",
    ],
    tips: "Watch the spread between gross margin and net margin. A narrowing spread means operating expenses are growing faster than revenue -- a potential red flag for profitability.",
    cascadeInfo: "Derived from Revenue. Changes cascade to Balance Sheet, Cash Flow, DCF, and Valuation.",
  },
  {
    title: "Balance Sheet",
    icon: BarChart3,
    path: "/balance-sheet",
    purpose: "Tracks assets, liabilities, and equity. Working capital and CapEx assumptions drive balance sheet items as a percentage of revenue.",
    keyMetrics: ["Total Assets", "Total Liabilities", "Total Equity", "Balance Status (Balanced/Imbalanced)"],
    howToUse: [
      "Click 'Edit Assumptions' to modify working capital ratios (A/R %, A/P %, CapEx % of Revenue).",
      "The 'Balanced' badge confirms Assets = Liabilities + Equity. If 'Imbalanced' appears, check your assumptions.",
      "Review the chart tab for a visual breakdown of current vs. long-term assets, liabilities, and equity over time.",
      "A/R % affects how much cash is tied up in receivables. A/P % affects supplier payment timing. CapEx % drives long-term asset growth.",
    ],
    tips: "High A/R % with low A/P % means the company is extending credit to customers but paying suppliers quickly -- this strains cash flow. Consider if the business model supports this.",
    cascadeInfo: "Derived from Revenue & Income Statement. Changes cascade to Cash Flow, DCF, and Valuation.",
  },
  {
    title: "Cash Flow Statement",
    icon: Wallet,
    path: "/cash-flow",
    purpose: "Shows how cash moves through the business across operating, investing, and financing activities. Fully auto-derived -- no direct editing needed.",
    keyMetrics: ["Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow", "Free Cash Flow (FCF)"],
    howToUse: [
      "This page is read-only. Cash flows are automatically calculated from the Income Statement and Balance Sheet.",
      "Operating CF starts with Net Income and adjusts for non-cash items (depreciation) and working capital changes (A/R, inventory, A/P).",
      "Investing CF is primarily driven by CapEx from balance sheet assumptions.",
      "Free Cash Flow (Operating CF minus CapEx) is the most important metric here -- it feeds directly into the DCF valuation.",
      "Use the FCF Trend tab to visualize free cash flow trajectory over your model period.",
      "Use the Breakdown tab to see how operating, investing, and financing activities compare.",
    ],
    tips: "If FCF is negative, the company is burning cash. Check whether this is due to heavy investment (potentially good) or deteriorating operations (concerning). A growing FCF trend is the strongest signal of financial health.",
    cascadeInfo: "Auto-derived from Income Statement & Balance Sheet. FCF feeds directly into DCF Valuation.",
  },
  {
    title: "DCF Valuation",
    icon: Calculator,
    path: "/dcf",
    purpose: "Discounted Cash Flow analysis. Uses projected free cash flows and WACC to determine the intrinsic value per share.",
    keyMetrics: ["Current Share Price", "DCF Target Price", "WACC", "NPV", "Terminal Value", "Upside/Downside"],
    howToUse: [
      "Click 'Edit WACC Params' to adjust the discount rate components:",
      "  -- Risk-Free Rate: Usually the 10-year Treasury yield.",
      "  -- Beta: Stock's sensitivity to market movements (from your portfolio data).",
      "  -- Market Return: Expected long-term market return (typically 8-10%).",
      "  -- Cost of Debt: Interest rate on the company's debt.",
      "  -- Capital Structure: Equity vs. debt weighting in the capital structure.",
      "  -- Long-Term Growth: Perpetuity growth rate for terminal value (typically 2-3%, near GDP growth).",
      "Review the Sensitivity Analysis table to see how target price changes across different WACC and growth assumptions.",
      "The FCF Projections chart shows the free cash flows being discounted.",
    ],
    tips: "The DCF is highly sensitive to two inputs: WACC and long-term growth rate. A 1% change in either can move the target price by 20%+ . Use the sensitivity table to understand the range of outcomes before making investment decisions.",
    cascadeInfo: "Uses FCF from Cash Flow Statement. Target price feeds into Valuation Comparison.",
  },
  {
    title: "Valuation Comparison",
    icon: Scale,
    path: "/valuation",
    purpose: "Compares target prices from three methods: Price/Revenue, Price/Earnings (PEG), and DCF. The final output of the cascading model.",
    keyMetrics: ["Current Price", "Average Target Price", "% to Target", "Bull/Base/Bear Scenarios by Method"],
    howToUse: [
      "This is a read-only summary page. All values are auto-derived from upstream data.",
      "Three valuation methods are compared side-by-side with bull, base, and bear scenarios:",
      "  -- Price/Revenue: Applies P/S multiples to revenue per share.",
      "  -- PEG: Applies PEG ratios to EPS and earnings growth.",
      "  -- DCF: Applies scenario multipliers to the DCF target price.",
      "The Average Target averages the base-case targets from all three methods.",
      "Review the Scenario Revenue Projections table to see how bull/base/bear revenue streams compare.",
      "Use the chart to visually compare method outputs and the current price reference line.",
    ],
    tips: "No single valuation method is perfect. If all three methods converge on a similar target price, you have higher conviction in the estimate. Large divergences signal model uncertainty -- revisit your upstream assumptions.",
    cascadeInfo: "This is the final output. It pulls from Revenue (P/R), Earnings (PEG), and DCF. Edit upstream inputs to see how valuations change.",
  },
  {
    title: "Portfolio Dashboard",
    icon: Briefcase,
    path: "/portfolio",
    purpose: "Tracks 15+ stock positions with comprehensive analytics including technical indicators, risk assessment, and sector analysis.",
    keyMetrics: ["Portfolio Value", "Weighted Beta", "Concentration Risk", "Golden Cross Count", "Red Flags"],
    howToUse: [
      "All Positions tab: Detailed table with price, daily change, P&L, P/E ratio, beta, moving averages, and technical signals for every position.",
      "Analytics tab: Sector allocation pie chart, position P&L bar chart, top gainers, and worst performers.",
      "Risk & Flags tab: Red flag checklist for risk assessment, golden/death cross signals, positions near stop-loss levels, and beta exposure chart.",
      "Macro & Indices tab: US and international market indices, and a comprehensive macro indicator dashboard.",
      "Look for Golden Cross signals (MA50 > MA200) as bullish indicators and Death Cross as bearish.",
      "Monitor positions approaching stop-loss levels for potential exit decisions.",
    ],
    tips: "Keep concentration risk below 30% in any single sector. If weighted beta exceeds 1.3, your portfolio is taking on significant market risk. Use the red flag checklist regularly to maintain portfolio discipline.",
    cascadeInfo: null,
  },
  {
    title: "Market Data & Macro",
    icon: TrendingUp,
    path: "/market-data",
    purpose: "Comprehensive view of global market indices and macroeconomic indicators. Provides context for your financial model and portfolio decisions.",
    keyMetrics: ["US & International Index Values", "Daily/MTD/YTD Returns", "Interest Rates", "Inflation", "GDP Growth", "Labor Data", "Commodities"],
    howToUse: [
      "Global Indices tab: Compare US indices (S&P 500, Dow, Nasdaq, Russell) and international benchmarks (FTSE, DAX, Nikkei, etc.).",
      "Macro Indicators tab: Five categories of economic data -- Interest Rates, Inflation, Growth, Labor Market, and Commodities.",
      "Index Performance tab: Visual bar chart ranking all indices by YTD return for quick relative comparison.",
      "Use interest rate data to validate your DCF discount rate assumptions.",
      "Monitor inflation trends to assess real vs. nominal return expectations.",
    ],
    tips: "Rising interest rates typically compress equity valuations (higher discount rates). If rates are trending up, consider whether your DCF WACC assumptions still make sense. Strong GDP growth generally supports earnings expansion.",
    cascadeInfo: null,
  },
];

const workflowSteps = [
  { step: 1, title: "Enter Revenue Data", page: "Revenue Forecast", description: "Input quarterly revenue figures for each revenue stream. Use Forecast Forward to project empty years." },
  { step: 2, title: "Set Cost Assumptions", page: "Income Statement", description: "Configure cost percentages (COGS, S&M, R&D, G&A, Tax Rate) to generate the full P&L." },
  { step: 3, title: "Configure Working Capital", page: "Balance Sheet", description: "Set A/R, A/P, and CapEx percentages to build the balance sheet from revenue." },
  { step: 4, title: "Review Cash Flows", page: "Cash Flow", description: "Verify auto-calculated operating, investing, and financing cash flows. Ensure FCF is reasonable." },
  { step: 5, title: "Run DCF Analysis", page: "DCF Valuation", description: "Set WACC parameters and review the discounted cash flow target price and sensitivity analysis." },
  { step: 6, title: "Compare Valuations", page: "Valuation Comparison", description: "Review the final output comparing P/R, PEG, and DCF target prices across bull/base/bear scenarios." },
];

export default function AnalysisGuide() {
  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Analysis Guide</h1>
        <p className="text-sm text-muted-foreground">Learn how to use each page to build and analyze your financial model</p>
      </div>

      <Card data-testid="card-cascade-overview">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            How the Cascading Model Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This application works like an Excel workbook with linked sheets. When you change an input on one page, all downstream pages automatically recalculate. The cascade flows in this order:
          </p>
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Badge>Revenue</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary">Income Statement</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary">Balance Sheet</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary">Cash Flow</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary">DCF</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline">Valuation</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Revenue is the foundation. Cost assumptions on the Income Statement page determine profitability. Working capital and CapEx assumptions on the Balance Sheet page drive cash flow generation. Free Cash Flow feeds the DCF valuation, and all methods combine in the final Valuation Comparison.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-recommended-workflow">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Recommended Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workflowSteps.map((ws) => (
              <div key={ws.step} className="flex items-start gap-3" data-testid={`workflow-step-${ws.step}`}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {ws.step}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{ws.title}</span>
                    <Badge variant="outline" className="text-xs">{ws.page}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{ws.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Page-by-Page Breakdown</h2>

        {sections.map((section) => (
          <Card key={section.title} data-testid={`card-guide-${section.title.toLowerCase().replace(/[^a-z]/g, "-")}`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <section.icon className="h-4 w-4" />
                {section.title}
                {section.cascadeInfo && (
                  <Badge variant="outline" className="text-xs">
                    <ArrowDown className="h-3 w-3 mr-1" /> Cascade
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{section.purpose}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Key Metrics</h4>
                <div className="flex flex-wrap gap-1">
                  {section.keyMetrics.map((m) => (
                    <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">How to Use</h4>
                <ul className="space-y-1">
                  {section.howToUse.map((item, i) => (
                    <li key={i} className={`text-sm text-muted-foreground ${item.startsWith("  --") ? "ml-4" : ""}`}>
                      {item.startsWith("  --") ? item : `${i + 1}. ${item}`}
                    </li>
                  ))}
                </ul>
              </div>

              {section.cascadeInfo && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <ArrowDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{section.cascadeInfo}</p>
                </div>
              )}

              <div className="p-2 rounded-md bg-muted/50">
                <p className="text-xs"><span className="font-medium">Tip:</span> <span className="text-muted-foreground">{section.tips}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
