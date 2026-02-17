import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
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
  BookOpen,
  Building2,
  CheckCircle2,
  LineChart,
  List,
  AlertTriangle,
  Wrench,
  Layers,
  Clipboard,
  ToggleLeft,
  Table2,
} from "lucide-react";

const sections = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
    purpose: "Your command center. Provides a high-level snapshot of your financial model, portfolio performance, and macroeconomic context in one place.",
    keyMetrics: ["Total Revenue (Latest Year)", "Portfolio Value & Total Return", "Portfolio Beta", "S&P 500 YTD", "Model Readiness"],
    howToUse: [
      "Start here to assess overall health before diving into individual pages.",
      "Check the Model Readiness card to see which steps are complete and which still need attention. Each item links directly to the relevant page so you can fill in missing data.",
      "Compare your portfolio return against the S&P 500 YTD to evaluate relative performance.",
      "Check the Revenue & Profitability chart for trend direction -- are revenue, EBITDA, and net income moving in the same direction?",
      "Review sector allocation to ensure you are not over-concentrated in any one sector.",
      "Monitor top daily movers for positions that may need immediate attention.",
    ],
    tips: "If portfolio beta is above 1.2, your portfolio is significantly more volatile than the market. Consider rebalancing if this doesn't align with your risk tolerance.",
    cascadeInfo: null,
  },
  {
    id: "revenue-forecast",
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
    id: "income-statement",
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
    id: "balance-sheet",
    title: "Balance Sheet",
    icon: BarChart3,
    path: "/balance-sheet",
    purpose: "Tracks assets, liabilities, and equity. Supports two workflows: assumption-driven projections (working capital ratios) and manual entry of actual historical data from SEC filings or financial statements.",
    keyMetrics: ["Total Assets", "Total Liabilities", "Total Equity", "Balance Status (Balanced/Imbalanced)", "Actual vs. Projected Year Badges"],
    howToUse: [
      "Click 'Edit / Enter Actuals' to enter edit mode. This lets you both modify working capital assumptions and enter actual historical data.",
      "Toggle year badges between 'Actual' and 'Projected': Actual years use your manually entered data and are preserved during recalculation. Projected years are auto-calculated from assumptions.",
      "For actual years, edit individual cells inline (Cash, A/R, Inventory, Equipment, A/P, Debt, Equity, etc.). Totals are auto-computed server-side when you save.",
      "Use the 'Paste Data' button to bulk-import balance sheet data from SEC EDGAR, Excel, or any spreadsheet. Paste tab-separated or comma-separated values, and the system matches fields automatically with a preview before importing.",
      "Modify working capital ratios (A/R %, A/P %, CapEx % of Revenue) to control how projected years are generated.",
      "The 'Balanced' badge confirms Assets = Liabilities + Equity. If 'Imbalanced' appears, see the troubleshooting steps below.",
      "Review the chart tab for a visual breakdown of current vs. long-term assets, liabilities, and equity over time.",
      "Click 'Save & Recalculate' to persist all changes. The system saves actual cell edits and assumptions together, then recalculates all projected years and downstream statements.",
    ],
    troubleshooting: {
      title: "Troubleshooting: Balance Sheet Imbalance",
      what: "An 'Imbalanced' badge means the fundamental accounting equation (Assets = Liabilities + Equity) is not holding. The gap between the two sides tells you something in the model needs attention.",
      howToDiagnose: [
        "Compare Total Assets to Total Liabilities + Total Equity at the bottom of each year's column. The side that looks too high (or too low) narrows down where the issue is.",
        "Check which years are imbalanced. If only projected years are off but historical years are fine, the issue is likely in your growth or working capital assumptions.",
        "Look at Retained Earnings under Equity. If it's zero or looks wrong, the Income Statement hasn't cascaded properly -- recalculate first.",
        "Check whether A/R or Inventory are growing faster than Revenue. If A/R % is set very high, assets will outpace liabilities.",
      ],
      commonCauses: [
        "Income Statement not completed yet -- Retained Earnings (which sits in Equity) comes from cumulative Net Income. Without a complete P&L, Equity will be understated.",
        "Missing or zero Revenue -- Working capital items are calculated as a % of Revenue. If Revenue is empty, assets and liabilities will be zero but other items may not be.",
        "Inconsistent working capital ratios -- Very high A/R % (assets side) with very low A/P % (liabilities side) creates a structural gap.",
        "CapEx growing assets without corresponding debt or equity financing -- If CapEx % is high but there's no debt to fund it, assets grow faster than the other side.",
      ],
      fixSteps: [
        "Complete the Income Statement first (set COGS %, SG&A %, R&D %, G&A %, Tax Rate) so Net Income and Retained Earnings flow correctly.",
        "Run 'Save & Recalculate' to cascade the latest numbers from Revenue through Income Statement into the Balance Sheet.",
        "Review your working capital ratios for reasonableness: A/R 8-15%, A/P 5-10%, CapEx 3-8% are typical for most companies.",
        "If the imbalance persists, try zeroing out all assumptions, recalculating, then re-entering them one at a time to isolate which input causes the gap.",
      ],
    },
    tips: "High A/R % with low A/P % means the company is extending credit to customers but paying suppliers quickly -- this strains cash flow. Consider if the business model supports this.",
    cascadeInfo: "Derived from Revenue & Income Statement. Changes cascade to Cash Flow, DCF, and Valuation.",
  },
  {
    id: "cash-flow",
    title: "Cash Flow Statement",
    icon: Wallet,
    path: "/cash-flow",
    purpose: "Shows how cash moves through the business across operating, investing, and financing activities. Projected years are auto-derived, but you can enter actual historical cash flow data from SEC filings.",
    keyMetrics: ["Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow", "Free Cash Flow (FCF)", "Actual vs. Projected Year Badges"],
    howToUse: [
      "Projected years are automatically calculated from the Income Statement and Balance Sheet. Actual years can be entered manually.",
      "Click 'Edit / Enter Actuals' to enter edit mode. Toggle year badges to 'Actual' to enter historical cash flow data from financial statements.",
      "For actual years, edit individual cells inline (Net Income, Depreciation, Working Capital Changes, CapEx, Debt Issuance, etc.).",
      "Use the 'Paste Data' button to bulk-import cash flow data from SEC EDGAR or spreadsheets. The system matches fields automatically with a preview before importing.",
      "Operating CF starts with Net Income and adjusts for non-cash items (depreciation) and working capital changes (A/R, inventory, A/P).",
      "Investing CF is primarily driven by CapEx from balance sheet assumptions.",
      "Free Cash Flow (Operating CF minus CapEx) is the most important metric here -- it feeds directly into the DCF valuation.",
      "Use the FCF Trend tab to visualize free cash flow trajectory over your model period.",
      "Use the Breakdown tab to see how operating, investing, and financing activities compare.",
      "Click 'Save & Recalculate' to persist actual data. The system preserves your actual year entries and only recalculates projected years.",
    ],
    tips: "If FCF is negative, the company is burning cash. Check whether this is due to heavy investment (potentially good) or deteriorating operations (concerning). A growing FCF trend is the strongest signal of financial health. Entering actual historical cash flows improves DCF accuracy by grounding your model in real data.",
    cascadeInfo: "Auto-derived from Income Statement & Balance Sheet for projected years. Actual years are preserved. FCF feeds directly into DCF Valuation.",
  },
  {
    id: "dcf-valuation",
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
    id: "valuation-comparison",
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
    id: "company-chart",
    title: "Company Chart",
    icon: LineChart,
    path: "/chart",
    purpose: "Interactive TradingView chart for any publicly traded stock. Provides price context for your valuation analysis with professional-grade charting tools, technical indicators, and multiple timeframes.",
    keyMetrics: ["Price History", "Moving Averages (50 & 200 day)", "Volume", "Technical Indicators (RSI, MACD, Bollinger Bands)"],
    howToUse: [
      "Enter any ticker symbol in the search bar and press Enter or click 'Load Chart' to display the interactive chart.",
      "Use the quick-access buttons to jump directly to major indices (S&P 500, Nasdaq) or popular stocks (AAPL, MSFT, GOOGL, etc.).",
      "The chart comes pre-loaded with 50-day and 200-day moving averages -- the same MA signals tracked in your Portfolio page.",
      "Use TradingView's built-in toolbar to add technical indicators like RSI, MACD, Bollinger Bands, and volume profiles.",
      "Draw trendlines, support/resistance levels, and Fibonacci retracements directly on the chart.",
      "Switch between timeframes (1D, 1W, 1M, etc.) using the interval selector in the TradingView toolbar.",
      "Compare the stock's current trading range against your DCF target price to assess the margin of safety.",
    ],
    tips: "Use the chart to gut-check your valuation. If your DCF target is $60 but the stock has never traded above $45, investigate what catalyst would drive that re-rating. Check for golden cross (50-day MA crossing above 200-day MA) as a bullish entry signal, or death cross as a warning sign.",
    cascadeInfo: null,
  },
  {
    id: "portfolio-dashboard",
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
      "Click 'Refresh Prices' to fetch live stock quotes from Yahoo Finance for all positions -- updates prices, P/E, beta, moving averages, 52-week range, and recalculates P&L.",
      "Look for Golden Cross signals (MA50 > MA200) as bullish indicators and Death Cross as bearish.",
      "Monitor positions approaching stop-loss levels for potential exit decisions.",
    ],
    tips: "Keep concentration risk below 30% in any single sector. If weighted beta exceeds 1.3, your portfolio is taking on significant market risk. Use the red flag checklist regularly to maintain portfolio discipline.",
    cascadeInfo: null,
  },
  {
    id: "market-data",
    title: "Market Data & Macro",
    icon: TrendingUp,
    path: "/market-data",
    purpose: "Comprehensive view of global market indices and macroeconomic indicators. Provides context for your financial model and portfolio decisions.",
    keyMetrics: ["US & International Index Values", "Daily/MTD/YTD Returns", "Interest Rates", "Inflation", "GDP Growth", "Labor Data", "Commodities"],
    howToUse: [
      "Global Indices tab: Compare US indices (S&P 500, Dow, Nasdaq, Russell) and international benchmarks (FTSE, DAX, Nikkei, etc.).",
      "Macro Indicators tab: Five categories of economic data -- Interest Rates, Inflation, Growth, Labor Market, and Commodities.",
      "Index Performance tab: Visual bar chart ranking all indices by YTD return for quick relative comparison.",
      "Click 'Refresh Live Data' to pull the latest quotes from Yahoo Finance and FRED API.",
      "Use 'Add Index' to track any custom Yahoo Finance symbol (e.g., BTC-USD for Bitcoin).",
      "Use 'Add Indicator' to track any FRED series ID (e.g., UNRATE for unemployment rate).",
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
  { step: 7, title: "Check the Chart", page: "Company Chart", description: "Pull up the company's stock chart on TradingView to visually compare your target price against historical trading range and technical signals." },
];

const requiredInputs = [
  {
    page: "Revenue Forecast",
    path: "/revenue",
    critical: ["At least one revenue stream with quarterly amounts for at least one year"],
    optional: ["Growth Decay Rate", "Scenario Multipliers (Bull/Base/Bear)", "Additional revenue streams"],
    downstream: "All downstream calculations depend on revenue data. Without it, the entire model produces zeros.",
  },
  {
    page: "Income Statement",
    path: "/income-statement",
    critical: ["Cost assumptions: COGS %, S&M %, R&D %, G&A %, Depreciation %, Tax Rate"],
    optional: ["Target Net Margin (for margin convergence over projection period)"],
    downstream: "Drives Gross Profit, Operating Income, Net Income, and EPS. EPS feeds into PEG valuation.",
  },
  {
    page: "Balance Sheet",
    path: "/balance-sheet",
    critical: ["Working capital ratios: Accounts Receivable %, Accounts Payable %, CapEx %"],
    optional: ["Actual historical data for past years (from SEC EDGAR 10-K/10-Q filings)", "Bulk paste from spreadsheets via Paste Data modal"],
    downstream: "CapEx flows into Cash Flow Statement. Working capital changes affect Operating Cash Flow. Actual year data is preserved during recalculation. If the 'Imbalanced' badge appears, ensure the Income Statement is complete (so Retained Earnings populate Equity) and that working capital ratios are reasonable (A/R 8-15%, A/P 5-10%, CapEx 3-8%). See the Balance Sheet section in Page-by-Page Breakdown for full troubleshooting steps.",
  },
  {
    page: "Cash Flow",
    path: "/cash-flow",
    critical: [],
    optional: ["Actual historical cash flow data for past years (from SEC EDGAR filings)", "Bulk paste from spreadsheets via Paste Data modal"],
    downstream: "Projected years are auto-derived from Income Statement and Balance Sheet. Actual years can be entered manually and are preserved during recalculation. Free Cash Flow (FCF) is the key output used by DCF.",
  },
  {
    page: "DCF Valuation",
    path: "/dcf",
    critical: ["Current Share Price", "Risk-Free Rate", "Beta", "Market Return"],
    optional: ["Cost of Debt", "Equity/Debt Weights", "Long-Term Growth Rate", "Total Debt"],
    downstream: "Produces the DCF target price. Without a current share price, upside/downside cannot be calculated.",
  },
  {
    page: "Company Chart",
    path: "/chart",
    critical: [],
    optional: ["Ticker symbol of the company being analyzed"],
    downstream: "No inputs needed for the model. This is a visual reference tool for price context and technical analysis.",
  },
  {
    page: "Valuation Comparison",
    path: "/valuation",
    critical: [],
    optional: [],
    downstream: "Fully auto-derived. Combines P/R, PEG, and DCF methods. If upstream data is missing, targets show $0.",
  },
];

const walkthroughSteps = [
  {
    step: 1,
    title: "Create a New Company",
    page: "Sidebar",
    icon: Building2,
    scenario: "You want to analyze \"CloudSync Corp\" (ticker: CSYN), a mid-cap B2B SaaS company with $80M in annual recurring revenue, growing at 25% YoY.",
    actions: [
      "Open the company selector dropdown at the top of the sidebar.",
      "Click \"New Company\" and enter \"CloudSync Corp 2025-2029\" as the model name.",
      "The app creates a blank model with no data -- you are starting from scratch, just like opening a new Excel workbook.",
    ],
    result: "A blank financial model is created. All pages will show empty tables waiting for your inputs.",
    whatToLookFor: null,
  },
  {
    step: 2,
    title: "Build the Revenue Model",
    page: "Revenue Forecast",
    icon: DollarSign,
    scenario: "CloudSync has four revenue streams: Subscription ($60M), Professional Services ($10M), Marketplace Add-ons ($6M), and Usage-Based ($4M). You have 2 quarters of actuals for 2025 and need to project through 2029.",
    actions: [
      "Navigate to the Revenue Forecast page.",
      "Click \"Edit\" to enter quarterly revenue for each stream. For Q1 2025 Subscription Revenue, enter $14,000,000 (the quarterly run-rate for $60M ARR growing 25%).",
      "Fill in Q1 and Q2 actuals for all four streams based on your research: Subscription ($14M, $15.2M), Services ($2.3M, $2.6M), Marketplace ($1.4M, $1.5M), Usage ($0.9M, $1.0M).",
      "Click \"Forecast Forward\" to auto-project the remaining quarters and future years based on the historical growth rate implied by your actuals.",
      "Open \"Projection Settings\" to fine-tune the forecast:",
      "  -- Set Growth Decay Rate to 0.10 (10%) because a 25% growth rate will naturally decelerate as CloudSync scales.",
      "  -- Set Scenario Multipliers: Bull = 1.3, Base = 1.0, Bear = 0.7 to model upside/downside revenue scenarios.",
      "Click \"Save & Recalculate\" to lock in your revenue model.",
    ],
    result: "The Revenue Forecast page now shows quarterly revenue across all streams from 2025 to 2029, with growth naturally decaying from ~25% to ~16% by 2029. Annual totals and YoY growth rates are calculated.",
    whatToLookFor: "Check that YoY growth rates make sense. If CloudSync's TAM is $2B, does the model have revenue exceeding the realistic market share by 2029? If growth decay seems too aggressive or too mild, adjust the rate.",
  },
  {
    step: 3,
    title: "Set Cost Assumptions to Build the P&L",
    page: "Income Statement",
    icon: FileSpreadsheet,
    scenario: "CloudSync is a typical SaaS company: 75% gross margins, heavy R&D spending, and improving operating leverage. You estimate COGS at 25%, S&M at 30%, R&D at 20%, G&A at 10%, Depreciation at 3%, and a 25% tax rate.",
    actions: [
      "Navigate to the Income Statement page. You'll see the revenue figures you just entered already populated at the top.",
      "Click \"Edit Assumptions\" to configure cost percentages:",
      "  -- COGS: 25% (hosting, infrastructure, support labor)",
      "  -- Sales & Marketing: 30% (SDRs, AEs, marketing campaigns, events)",
      "  -- Research & Development: 20% (engineering team, product development)",
      "  -- General & Administrative: 10% (finance, legal, HR, office)",
      "  -- Depreciation & Amortization: 3% (capitalized software, equipment)",
      "  -- Tax Rate: 25%",
      "Optionally, set Target Net Margin to 15% under Projection Settings. This tells the model to gradually converge cost assumptions so that by the final projection year, the net margin approaches 15% -- reflecting operating leverage as CloudSync scales.",
      "Click \"Save & Recalculate.\"",
    ],
    result: "The full P&L is generated: Revenue, COGS, Gross Profit (75% margin), Operating Expenses, Operating Income, Net Income, and EPS. If Target Net Margin is set, you'll see margins improving from ~12% in 2025 toward 15% by 2029.",
    whatToLookFor: "Check the Margin Analysis tab. Are gross margins stable at ~75%? Is operating margin expanding year over year? Compare Revenue Growth vs. Net Income Growth in the Growth Rates tab -- faster net income growth confirms operating leverage.",
  },
  {
    step: 4,
    title: "Configure Balance Sheet (Assumptions + Actuals)",
    page: "Balance Sheet",
    icon: BarChart3,
    scenario: "CloudSync collects from enterprise customers in ~45 days (A/R ~12% of revenue), pays suppliers in ~30 days (A/P ~8%), and invests ~5% of revenue in CapEx (servers, office buildouts). You also have 2024 actual balance sheet data from their 10-K filing.",
    actions: [
      "Navigate to the Balance Sheet page. Income Statement data has already cascaded in.",
      "Click \"Edit / Enter Actuals\" to enter edit mode.",
      "Set working capital ratios in the assumptions panel:",
      "  -- Accounts Receivable: 12% of revenue (enterprise collection cycles)",
      "  -- Accounts Payable: 8% of revenue (standard vendor payment terms)",
      "  -- CapEx: 5% of revenue (cloud infrastructure, office leases)",
      "To enter historical data: click the 'Projected' badge on 2024 to toggle it to 'Actual'. The 2024 column cells become editable.",
      "Enter actual balance sheet values from CloudSync's 10-K: Cash, Short-Term Investments, Accounts Receivable, Inventory, Equipment, Accounts Payable, Debt, Retained Earnings, etc.",
      "Alternatively, use the 'Paste Data' button to bulk-import the 10-K balance sheet. Copy the data from SEC EDGAR or Excel, paste it into the modal, and the system matches fields automatically.",
      "Click \"Save & Recalculate.\" Actual years are preserved; only projected years (2025-2029) are recalculated from assumptions.",
    ],
    result: "The balance sheet shows actual 2024 data alongside projected 2025-2029. The 2024 column has an 'Actual' badge and uses your real data. Projected years are derived from working capital ratios. The \"Balanced\" badge confirms the accounting identity holds.",
    whatToLookFor: "Verify the balance sheet shows \"Balanced.\" If it shows \"Imbalanced,\" here's how to diagnose: (1) Compare Total Assets vs. Total Liabilities + Total Equity for each year -- the side that's too high tells you where the gap is. (2) Check Retained Earnings under Equity -- if it's zero, your Income Statement hasn't cascaded yet; go back and recalculate. (3) Review whether A/R % is set much higher than A/P % -- this inflates assets relative to liabilities. (4) Check that CapEx at 5% is reasonable -- too high means the company is capital-intensive (unusual for SaaS); too low may understate investment needs. If you can't find the cause, try zeroing out all assumptions, recalculating, then re-entering them one at a time.",
  },
  {
    step: 5,
    title: "Review Cash Flows (and Enter Actuals)",
    page: "Cash Flow Statement",
    icon: Wallet,
    scenario: "Projected cash flows are auto-derived from the Income Statement and Balance Sheet. You can also enter actual historical cash flow data from SEC filings to ground your model in real numbers.",
    actions: [
      "Navigate to the Cash Flow page.",
      "Review Operating Cash Flow: starts with Net Income, adds back Depreciation (non-cash), and adjusts for working capital changes (increase in A/R reduces cash; increase in A/P adds cash).",
      "Review Investing Cash Flow: primarily the CapEx you set at 5% of revenue.",
      "Review Free Cash Flow (FCF): Operating Cash Flow minus CapEx. This is the single most important number for valuation.",
      "To enter historical data: click 'Edit / Enter Actuals', toggle the 2024 badge to 'Actual', and enter cash flow values from CloudSync's 10-K filing.",
      "You can also use 'Paste Data' to bulk-import cash flow data from SEC EDGAR or spreadsheets.",
      "Check the FCF Trend tab to visualize the trajectory. Growing FCF is the goal.",
      "Check the Breakdown tab to see how operating, investing, and financing activities compare as a stacked chart.",
    ],
    result: "CloudSync should show positive and growing FCF, driven by strong operating margins and modest CapEx. If you entered 2024 actuals, those values are preserved and only 2025-2029 are projected. By 2029, FCF should be meaningfully higher than 2025.",
    whatToLookFor: "If FCF is negative in early years, this may be acceptable if the company is investing heavily. But by the projection end, FCF should be positive for a healthy SaaS business. If not, revisit your cost or CapEx assumptions. Comparing actual 2024 FCF against projected 2025 gives you a reality check on your model's trajectory.",
  },
  {
    step: 6,
    title: "Run the DCF Valuation",
    page: "DCF Valuation",
    icon: Calculator,
    scenario: "Now you discount CloudSync's projected free cash flows back to present value to determine what the company is worth per share. This follows the standard DCF methodology.",
    actions: [
      "Navigate to the DCF Valuation page. FCF projections from the Cash Flow page are already loaded.",
      "Click \"Edit WACC Params\" to configure the discount rate. Here is the step-by-step WACC build:",
      "  -- [Cost of Equity - CAPM]: Risk-Free Rate: 4.25% (10-yr Treasury), Beta: 1.15, Market Return: 9.0%. Result: 4.25% + 1.15 x (9.0% - 4.25%) = 9.71%",
      "  -- [Cost of Debt - After-Tax]: Pre-Tax Cost of Debt: 6.0%, Tax Rate: 25%. Result: 6.0% x (1 - 0.25) = 4.5%",
      "  -- [WACC]: Equity Weight: 80%, Debt Weight: 20%. WACC = 9.71% x 0.80 + 4.5% x 0.20 = 8.67%",
      "  -- [Terminal Value]: Long-Term Growth Rate: 2.5% (near GDP growth). Formula: Last Year FCF x (1 + 2.5%) / (WACC - 2.5%)",
      "  -- [Target Price]: NPV of FCFs = Sum of FCF / (1 + WACC)^year. TV Discounted = Terminal Value / (1 + WACC)^n. Target Equity Value = NPV + Discounted TV - Total Debt. Target Price = Equity Value / Shares Outstanding",
      "Also set Total Debt (e.g., $50M) and Current Share Price (e.g., $42.00) so the model can calculate upside/downside.",
      "Click \"Save & Recalculate.\"",
    ],
    result: "The DCF page now shows: WACC (~8.67%), NPV of projected FCFs, Terminal Value and its discounted present value, Target Equity Value, and a Target Price Per Share. An upside/downside percentage compares the target price to the current $42 share price.",
    whatToLookFor: "Review the 5x5 Sensitivity Analysis table. It shows target prices across a range of WACC (6.67% to 10.67%) and Long-Term Growth (1.5% to 3.5%) assumptions. A 1% change in WACC can move the target price by 20%+. Ensure your base case sits in a reasonable range and that the bear-case scenarios still produce a target above $0.",
  },
  {
    step: 7,
    title: "Check the Price Chart",
    page: "Company Chart",
    icon: LineChart,
    scenario: "Before finalizing your valuation, pull up CloudSync's stock chart to see where the market is pricing it relative to your model.",
    actions: [
      "Navigate to the Company Chart page.",
      "Type \"CSYN\" in the ticker search bar and press Enter (for a real company, enter its actual ticker).",
      "Examine the price history. Has the stock been trending up, down, or sideways? This tells you about market sentiment.",
      "Check the 50-day and 200-day moving averages (pre-loaded on the chart). A golden cross (50 above 200) is bullish; a death cross is bearish.",
      "Your DCF target is approximately $51. Look at the chart's price range -- has the stock ever traded near $51? If so, the market has valued it there before, increasing conviction. If not, identify what catalyst would drive re-rating.",
      "Add additional indicators using TradingView's toolbar -- RSI can show if the stock is overbought/oversold, MACD confirms momentum direction.",
      "Draw support and resistance lines to identify key entry and exit price levels.",
    ],
    result: "You now have visual context for your valuation. You can see whether the stock is trading at a discount to your target (potential buy), near your target (hold), or above it (potential sell). Technical indicators help time the entry.",
    whatToLookFor: "Compare the stock's 52-week range against your bull/base/bear target prices. If your bear case ($35) is below the 52-week low, your downside scenario may be too aggressive. If your bull case ($66) significantly exceeds the all-time high, consider what fundamental change justifies that premium.",
  },
  {
    step: 8,
    title: "Compare All Valuation Methods",
    page: "Valuation Comparison",
    icon: Scale,
    scenario: "The final output page. Three independent valuation methods are compared side-by-side, each with bull/base/bear scenarios.",
    actions: [
      "Navigate to the Valuation Comparison page. All data is auto-derived from upstream.",
      "Review the three methods:",
      "  -- Price/Revenue (P/S): Applies revenue multiples to annual revenue per share. Uses the scenario multipliers you set (Bull 1.3x, Base 1.0x, Bear 0.7x) applied to the P/S ratio.",
      "  -- Price/Earnings (PEG): Uses EPS from the Income Statement and earnings growth rate. Applies PEG ratio variants for bull/base/bear.",
      "  -- DCF: Uses the target price from Step 6, adjusted by scenario multipliers for bull/base/bear.",
      "Review the Average Target Price: the mean of all three base-case targets.",
      "Compare against the current share price of $42.00. If all three methods show targets above $42, you have higher conviction in an upside thesis.",
      "Check the Scenario Revenue Projections table to see how bull and bear revenue paths diverge from the base case.",
    ],
    result: "You now have a complete, multi-method valuation for CloudSync Corp with a range of target prices. For example: P/R target of $55, PEG target of $50, DCF target of $48 -- Average Target of ~$51, representing ~21% upside from the current $42.",
    whatToLookFor: "If the three methods produce wildly different targets, it signals model uncertainty. Large divergence usually means one assumption (revenue multiple, growth rate, or WACC) is significantly different from the others. Revisit the outlier method's assumptions.",
  },
  {
    step: 9,
    title: "Add to Your Portfolio & Monitor",
    page: "Portfolio Dashboard",
    icon: Briefcase,
    scenario: "Based on your analysis, you decide CloudSync Corp has ~21% upside. You want to add it to your portfolio and set risk parameters.",
    actions: [
      "Navigate to the Portfolio Dashboard page.",
      "Click \"Add Position\" to open the position form.",
      "Enter the key details:",
      "  -- Ticker: CSYN",
      "  -- Company: CloudSync Corp",
      "  -- Sector: Technology",
      "  -- Shares: 500 (your intended position size)",
      "  -- Purchase Price: $42.00",
      "  -- Current Price: $42.00",
      "  -- Beta: 1.15 (from your DCF model)",
      "  -- P/E Ratio: 35 (from market data)",
      "  -- MA50: $40.50, MA200: $38.00 (from technical analysis)",
      "  -- Stop Loss: $35.00 (defining your maximum acceptable loss at ~17%)",
      "Click \"Add Position\" to save.",
      "Monitor the position alongside your other holdings. Check the Risk & Flags tab for concentration warnings and technical signals.",
    ],
    result: "CloudSync is now tracked in your portfolio with a $21,000 position. The app calculates P&L, monitors golden/death cross signals, tracks proximity to your stop loss, and factors CSYN into your portfolio-level weighted beta and sector allocation.",
    whatToLookFor: "After adding, check that portfolio concentration risk hasn't spiked. If Technology already represents 40%+ of your portfolio, adding CSYN increases sector-specific risk. Also verify your weighted portfolio beta hasn't exceeded your risk tolerance.",
  },
  {
    step: 10,
    title: "Cross-Check with Market Context",
    page: "Market Data & Macro",
    icon: TrendingUp,
    scenario: "Before finalizing your investment thesis, validate your assumptions against the current macro environment.",
    actions: [
      "Navigate to the Market Data & Macro page.",
      "Check the 10-Year Treasury yield. You used 4.25% as your risk-free rate -- does the current yield match?",
      "Review inflation trends. If inflation is rising, your 2.5% long-term growth rate may be too conservative in nominal terms but overly aggressive in real terms.",
      "Check GDP growth data. Your revenue model assumes 25% growth decaying to 16% -- this is a company-specific rate, but it should be directionally supported by a growing economy.",
      "Review the S&P 500 and Nasdaq YTD returns. If the broad market is down 10%, your 9% expected market return in WACC may need adjustment.",
      "Compare international indices if CloudSync has global revenue exposure.",
    ],
    result: "Your model assumptions are validated (or adjusted) against real-time macro data. The risk-free rate, market return, and growth assumptions in your DCF are grounded in current economic reality.",
    whatToLookFor: "If rates have risen significantly since you last updated your model, go back to the DCF page and adjust your risk-free rate. A 50bp increase in the risk-free rate raises WACC and can reduce your target price by 10-15%.",
  },
  {
    step: 11,
    title: "Iterate and Refine",
    page: "All Pages",
    icon: CheckCircle2,
    scenario: "Financial modeling is iterative. As new data comes in (quarterly earnings, macro changes, competitive developments), you revisit and update.",
    actions: [
      "When CloudSync reports Q3 2025 earnings, go to Revenue Forecast and update Q3 actuals. Did they beat, meet, or miss your estimates?",
      "If they beat estimates, consider reducing your Growth Decay Rate (the company is sustaining growth better than expected).",
      "If margins improved, update your cost assumptions on the Income Statement page.",
      "After every update, click \"Save & Recalculate\" to cascade changes through the entire model.",
      "Review the DCF target price -- has it moved materially? If the target dropped below $42, your investment thesis may be weakening.",
      "Check the Company Chart page to see how the market reacted to earnings -- did the price move toward or away from your target?",
      "Check your portfolio position -- if CSYN has appreciated to $50, update the current price in your portfolio to see updated P&L and portfolio metrics.",
      "Periodically review the Sensitivity Analysis table on the DCF page to understand your margin of safety at the current price.",
    ],
    result: "Your model stays current and your investment thesis is continuously validated. The cascading engine ensures that a single data point update (like a revenue beat) flows through every financial statement, cash flow projection, and valuation method automatically.",
    whatToLookFor: "Track how your target price evolves over time as you incorporate new data. If the target keeps rising with each quarterly update, your thesis is strengthening. If it's declining, it may be time to re-evaluate the position.",
  },
];

const featureGuides = [
  {
    id: "company-management",
    title: "Company Management",
    icon: Building2,
    features: [
      {
        name: "Create a New Company",
        steps: [
          "Open the company selector dropdown at the top of the sidebar.",
          "Click the \"New Company\" button.",
          "Enter the company name, ticker symbol, currency, start/end year range, shares outstanding, and display unit (ones, thousands, millions, billions, or trillions).",
          "Click \"Create\" to generate a blank financial model.",
        ],
        notes: "New companies start with no data. You build the entire analysis from scratch. The display unit controls how numbers are entered and shown across all pages (e.g., in Millions means you type 11.5 to represent $11,500,000).",
      },
      {
        name: "Edit Company Settings",
        steps: [
          "Click the pencil icon next to the company name in the sidebar.",
          "Modify any field: name, ticker, description, currency, shares outstanding, year range, or display unit.",
          "Click \"Save\" to apply changes.",
        ],
        notes: "Changing the display unit affects how all values are entered and displayed. Changing shares outstanding affects EPS calculations. Changing the year range may add or remove forecast years.",
      },
      {
        name: "Switch Between Companies",
        steps: [
          "Use the company selector dropdown at the top of the sidebar.",
          "Click any company name to switch to it.",
          "All pages update to show that company's data.",
        ],
        notes: "Each company has completely isolated data. Switching companies does not affect any other company's model.",
      },
      {
        name: "Delete a Company",
        steps: [
          "Click the trash icon next to the company name in the sidebar.",
          "Confirm the deletion in the dialog.",
        ],
        notes: "This permanently deletes the company and all its financial data. This cannot be undone.",
      },
    ],
  },
  {
    id: "revenue-editing",
    title: "Revenue Data Entry",
    icon: DollarSign,
    features: [
      {
        name: "Quarterly Detail Editing",
        steps: [
          "Navigate to Revenue Forecast and click \"Edit\".",
          "On the Quarterly Detail tab, click any cell to type a value directly.",
          "Values are entered in the display unit you set when creating the company (e.g., if display unit is Millions, type 11.5 for $11,500,000).",
          "YoY % inputs appear below each cell -- type a percentage to auto-calculate the value based on the same quarter last year.",
          "Click \"Save & Recalculate\" when done.",
        ],
        notes: "Quarterly Detail gives you the most granular control. Each quarter of each revenue stream can be edited independently.",
      },
      {
        name: "Annual Summary Editing",
        steps: [
          "Switch to the Annual Summary tab while in edit mode.",
          "Type an annual total for any revenue stream in any year.",
          "The system automatically distributes the annual amount across four quarters:",
          "  -- If the revenue stream already has quarterly data with different amounts per quarter (seasonal pattern), the system uses proportional scaling to preserve that pattern.",
          "  -- If the quarterly amounts are equal or the stream has no prior data, the system splits the annual amount evenly across four quarters.",
          "You can also type a YoY % growth rate to calculate the annual total from the prior year.",
          "Click \"Save & Recalculate\" to persist.",
        ],
        notes: "Annual Summary is the fastest way to enter data for a new company. You can type annual totals for each stream and the system creates the quarterly breakdown automatically. For existing companies with seasonal patterns, editing the annual total preserves the quarterly seasonality ratios.",
      },
      {
        name: "Add / Remove Revenue Streams",
        steps: [
          "While in edit mode, click \"Add Revenue Stream\" at the bottom of the revenue table.",
          "Type a name for the new stream in the first column.",
          "Enter quarterly or annual amounts for the new stream.",
          "To delete a stream, click the trash icon at the end of its row.",
          "Click \"Save & Recalculate\" to persist changes.",
        ],
        notes: "Deleted streams are permanently removed along with all their historical data.",
      },
      {
        name: "Rename Revenue Streams",
        steps: [
          "While in edit mode, click the name of any revenue stream in the first column.",
          "Type the new name.",
          "Click \"Save & Recalculate\" to persist.",
        ],
        notes: "Renaming does not affect any data values -- only the label changes.",
      },
      {
        name: "Forecast Forward (Auto-Projection)",
        steps: [
          "Enter at least one year of revenue data first.",
          "Click the \"Forecast Forward\" button (available when there are empty future years).",
          "The system calculates the average historical growth rate from your entered data and projects revenue into all empty future years.",
          "Review the projected values and adjust as needed.",
          "Click \"Save & Recalculate\" to persist.",
        ],
        notes: "Forecast Forward only fills empty years -- it never overwrites data you have already entered. Growth rates are calculated per revenue stream, so each stream grows at its own historical pace. If Projection Settings include a Growth Decay Rate, the growth rate will naturally slow down over time.",
      },
    ],
  },
  {
    id: "projection-settings",
    title: "Projection Settings",
    icon: Settings2,
    features: [
      {
        name: "Growth Decay Rate",
        steps: [
          "On the Revenue Forecast page, open the Projection Settings panel.",
          "Set the Growth Decay Rate (0 to 1). For example, 0.10 means the growth rate decays by 10% each year.",
          "Formula: Effective Growth = Base Growth x (1 - Decay Rate) ^ Years From Last Data.",
          "Click \"Save & Recalculate\" to apply.",
        ],
        notes: "A rate of 0 means no decay (constant growth). A rate of 0.15 models realistic deceleration as companies mature. Growth Decay only affects projected (future) years, not your entered actuals.",
      },
      {
        name: "Target Net Margin Convergence",
        steps: [
          "Set a Target Net Margin percentage in Projection Settings.",
          "The recalculation engine gradually adjusts cost assumptions across projected years so that net margin converges toward your target by the final year.",
        ],
        notes: "This models operating leverage -- as a company scales, margins typically improve. Set to 0 or leave blank to disable convergence.",
      },
      {
        name: "Scenario Multipliers (Bull/Base/Bear)",
        steps: [
          "Set three multipliers: Bull (e.g., 1.3), Base (1.0), and Bear (e.g., 0.7).",
          "These multiply revenue and DCF targets to create optimistic, realistic, and pessimistic scenarios.",
          "Results appear on the Valuation Comparison page under each valuation method.",
        ],
        notes: "Base should typically be 1.0. Bull above 1.0 models upside. Bear below 1.0 models downside. The multipliers also appear in the scenario revenue table on the Valuation Comparison page.",
      },
    ],
  },
  {
    id: "bulk-data-import",
    title: "Bulk Data Import (Paste Data)",
    icon: Clipboard,
    features: [
      {
        name: "Paste Balance Sheet Data",
        steps: [
          "Navigate to the Balance Sheet page and click \"Edit / Enter Actuals\".",
          "Click the \"Paste Data\" button to open the import modal.",
          "Copy data from SEC EDGAR, Excel, Google Sheets, or any spreadsheet. The data should be tab-separated (TSV) or comma-separated (CSV).",
          "Paste the data into the text area in the modal.",
          "The system automatically detects and matches column headers to balance sheet fields (Cash, Accounts Receivable, Inventory, Equipment, etc.).",
          "Review the preview table to verify the field matching is correct.",
          "Click \"Import\" to populate the balance sheet with the pasted data.",
          "Toggle the year badge to \"Actual\" for years with real data.",
          "Click \"Save & Recalculate\" to persist.",
        ],
        notes: "The paste modal supports common formats from SEC EDGAR (HTML tables), Excel (copy-paste produces TSV), and Google Sheets. Field matching is fuzzy -- it handles variations like \"Accounts Receivable\" vs \"A/R\" vs \"AR\". You can correct any mismatched fields in the preview before importing.",
      },
      {
        name: "Paste Cash Flow Data",
        steps: [
          "Navigate to the Cash Flow page and click \"Edit / Enter Actuals\".",
          "Click \"Paste Data\" and follow the same workflow as Balance Sheet paste above.",
          "Fields are matched to cash flow line items: Net Income, Depreciation, Working Capital Changes, CapEx, Debt Changes, etc.",
        ],
        notes: "Cash flow paste is particularly useful for importing data from 10-K or 10-Q filings. The system handles the sign conventions automatically.",
      },
    ],
  },
  {
    id: "actual-vs-projected",
    title: "Actual vs. Projected Data",
    icon: ToggleLeft,
    features: [
      {
        name: "Toggle Year Type (Balance Sheet & Cash Flow)",
        steps: [
          "Enter edit mode on the Balance Sheet or Cash Flow page.",
          "Click the badge above any year column -- it toggles between \"Actual\" and \"Projected\".",
          "Actual years: cells become editable for manual data entry. These values are preserved during recalculation and never overwritten by the engine.",
          "Projected years: values are auto-calculated from assumptions and upstream data. The engine recalculates these whenever you click Save & Recalculate.",
        ],
        notes: "Use Actual for years where you have real financial data (from SEC filings, annual reports, etc.). Use Projected for future years that the model should calculate. The recalculation engine respects this boundary -- it only rewrites Projected years.",
      },
      {
        name: "Enter Historical Data Inline",
        steps: [
          "After toggling a year to \"Actual\", click any cell in that column to edit it.",
          "Type the value directly. Totals (Total Assets, Total Equity, etc.) are auto-computed server-side when you save.",
          "Click \"Save & Recalculate\" to persist. The server recomputes row totals for actual years and fully recalculates all projected years.",
        ],
        notes: "For Balance Sheet, the server automatically computes Total Current Assets, Total Assets, Total Liabilities, and Total Equity from the individual line items you enter. You do not need to enter totals manually.",
      },
    ],
  },
  {
    id: "portfolio-features",
    title: "Portfolio Features",
    icon: Briefcase,
    features: [
      {
        name: "Add a Stock Position",
        steps: [
          "Navigate to Portfolio and click \"Add Position\".",
          "Fill in the form: Ticker, Company Name, Sector, Shares, Purchase Price, Current Price, and optionally Beta, P/E, Moving Averages, Stop Loss, etc.",
          "Click \"Add Position\" to save.",
        ],
        notes: "Most fields are optional on creation. You can fill in just ticker, company, shares, and purchase price, then use \"Refresh Prices\" to auto-populate the rest from Yahoo Finance.",
      },
      {
        name: "Add a Cryptocurrency Position",
        steps: [
          "Click \"Add Position\" and check the \"Crypto\" checkbox.",
          "Enter the crypto ticker (e.g., BTC, ETH, SOL). The system automatically formats it for Yahoo Finance (adds -USD suffix).",
          "Fill in shares (amount held) and purchase price.",
          "Stock-specific fields (P/E, EPS, Dividend Yield) are automatically zeroed for crypto.",
        ],
        notes: "Crypto positions display a \"Crypto\" badge in the portfolio table. When refreshing prices, the system queries Yahoo Finance using the -USD format (e.g., BTC-USD).",
      },
      {
        name: "Tax Lot Tracking",
        steps: [
          "In the portfolio table, click the expand arrow on any position row to reveal tax lots.",
          "Click \"Add Lot\" to record a new purchase: enter shares, price per share, purchase date, and optional notes.",
          "Each lot tracks its own P&L based on the current price vs. the lot's purchase price.",
          "The position's overall average cost and total shares are auto-aggregated from all lots.",
          "Edit or delete individual lots using the icons in each lot row.",
        ],
        notes: "Tax lots let you track multiple purchases of the same stock at different prices and dates. This is essential for tax-loss harvesting and understanding your cost basis. The position-level weighted average cost updates automatically as you add or remove lots.",
      },
      {
        name: "Refresh Live Prices",
        steps: [
          "Click \"Refresh Prices\" on the Portfolio page.",
          "The system fetches live quotes from Yahoo Finance for every position in your portfolio.",
          "Updated fields: Current Price, P/E Ratio, Beta, MA50, MA200, 52-Week High/Low, Volume, Market Cap, EPS, Dividend Yield.",
          "P&L, golden/death cross signals, and stop-loss proximity are recalculated automatically.",
        ],
        notes: "Crypto positions are queried using their -USD ticker format. The refresh updates all positions in parallel. If any position fails to fetch (delisted, invalid ticker), the rest still update successfully.",
      },
      {
        name: "Portfolio Analytics Tabs",
        steps: [
          "All Positions: Full table with every position's details, expandable for tax lots.",
          "Analytics: Sector allocation pie chart, position-level P&L bar chart, top gainers, worst performers.",
          "Risk & Flags: Red flag checklist, golden/death cross signals, positions near stop-loss, beta exposure chart.",
          "Macro & Indices: US and international market indices, macroeconomic indicators by category.",
        ],
        notes: "The Signal Definitions card on the Analytics tab explains what Golden Cross, Death Cross, Near Stop Loss, MA50/MA200, Beta, and 52-Week Range mean.",
      },
    ],
  },
  {
    id: "market-data-features",
    title: "Market Data Customization",
    icon: TrendingUp,
    features: [
      {
        name: "Add a Custom Market Index",
        steps: [
          "Navigate to the Market Data page.",
          "Click \"Add Index\" on the Global Indices tab.",
          "Enter a Yahoo Finance symbol (e.g., ^GSPC for S&P 500, ^IXIC for Nasdaq, BTC-USD for Bitcoin, TSLA for Tesla).",
          "The system fetches the latest quote and adds it to your tracked indices.",
        ],
        notes: "You can track any symbol available on Yahoo Finance -- stock tickers, crypto pairs, ETFs, commodities, and international indices. Use the ^ prefix for major indices (e.g., ^DJI for Dow Jones).",
      },
      {
        name: "Remove a Market Index",
        steps: [
          "On the Global Indices tab, click the remove button next to any index.",
          "The index is permanently removed from your tracked list.",
        ],
        notes: "Removing an index only removes it from your display. It does not affect any portfolio positions or model data.",
      },
      {
        name: "Add a Custom FRED Macro Indicator",
        steps: [
          "On the Macro Indicators tab, click \"Add Indicator\".",
          "Enter a FRED series ID (e.g., UNRATE for unemployment rate, CPIAUCSL for CPI, GDP for GDP, DFF for Fed Funds Rate).",
          "The system fetches the latest value from the FRED API and adds it to your indicator dashboard.",
        ],
        notes: "FRED series IDs can be found at fred.stlouisfed.org. Common IDs: UNRATE (unemployment), CPIAUCSL (CPI), GDP (GDP), DFF (Fed Funds), T10Y2Y (yield curve), VIXCLS (VIX).",
      },
      {
        name: "Remove a Macro Indicator",
        steps: [
          "Click the remove button next to any macro indicator.",
          "The indicator is permanently removed from your display.",
        ],
        notes: "Default indicators can be re-added by entering their FRED series ID again.",
      },
      {
        name: "Refresh All Live Data",
        steps: [
          "Click \"Refresh Live Data\" on the Market Data page.",
          "The system fetches the latest prices for all tracked indices from Yahoo Finance and the latest values for all tracked macro indicators from the FRED API.",
          "Daily change %, MTD, and YTD returns are recalculated for indices. Prior values are tracked for change indicators on macro data.",
        ],
        notes: "The FRED API requires an API key (configured as FRED_API_KEY). Yahoo Finance data is fetched without an API key. If either service is temporarily unavailable, partial results are still saved.",
      },
    ],
  },
  {
    id: "income-statement-editing",
    title: "Income Statement Editing",
    icon: FileSpreadsheet,
    features: [
      {
        name: "Edit Cost Assumptions",
        steps: [
          "Navigate to the Income Statement page and click \"Edit Assumptions\".",
          "Modify cost percentages: COGS %, Sales & Marketing %, R&D %, G&A %, Depreciation %, and Tax Rate.",
          "Each cost line is calculated as a percentage of revenue. When revenue changes, costs scale proportionally.",
          "Click \"Save & Recalculate\" to cascade changes through the entire model.",
        ],
        notes: "Cost percentages apply uniformly across all projected years unless Target Net Margin convergence is enabled (see Projection Settings).",
      },
      {
        name: "Edit Individual Year Data",
        steps: [
          "While in edit mode, click any cell in the Income Statement table to modify it.",
          "Toggle year badges between Actual and Projected.",
          "Actual years preserve your entered values during recalculation.",
        ],
        notes: "Actual year data is locked during recalculation. Only projected year values are recomputed when you save.",
      },
    ],
  },
  {
    id: "dcf-editing",
    title: "DCF & WACC Configuration",
    icon: Calculator,
    features: [
      {
        name: "Configure WACC Parameters",
        steps: [
          "Navigate to DCF Valuation and click \"Edit WACC Params\".",
          "Set Cost of Equity inputs: Risk-Free Rate, Beta, Expected Market Return.",
          "Set Cost of Debt inputs: Pre-Tax Cost of Debt, Tax Rate.",
          "Set Capital Structure: Equity Weight, Debt Weight.",
          "Set Terminal Value inputs: Long-Term Growth Rate.",
          "Set Current Share Price and Total Debt for upside/downside calculation.",
          "Click \"Save & Recalculate\".",
        ],
        notes: "WACC = (Cost of Equity x Equity Weight) + (After-Tax Cost of Debt x Debt Weight). The sensitivity analysis table automatically shows target prices across a range of WACC and growth assumptions.",
      },
    ],
  },
  {
    id: "display-units",
    title: "Display Units & Number Formatting",
    icon: Table2,
    features: [
      {
        name: "Change Display Unit",
        steps: [
          "Click the pencil icon next to the company name in the sidebar to open Edit Company.",
          "Change the Display Unit dropdown to: Ones, Thousands, Millions, Billions, or Trillions.",
          "Click \"Save\".",
          "All pages now show and accept values in the selected unit.",
        ],
        notes: "When display unit is Millions, you type 11.5 to represent $11,500,000. The system handles all conversions internally. This applies to Revenue, Income Statement, Balance Sheet, Cash Flow, and DCF pages. Decimal input is supported (e.g., 11.5M = $11,500,000).",
      },
    ],
  },
];

const tocItems = [
  { id: "toc-cascade", label: "How the Cascade Works" },
  { id: "toc-workflow", label: "Recommended Workflow" },
  { id: "toc-features", label: "Feature Reference" },
  ...featureGuides.map((f) => ({ id: `toc-feature-${f.id}`, label: `  ${f.title}` })),
  { id: "toc-required-inputs", label: "Required Inputs Reference" },
  { id: "toc-walkthrough", label: "Walkthrough: CloudSync Corp" },
  { id: "toc-pages", label: "Page-by-Page Breakdown" },
  ...sections.map((s) => ({ id: `toc-page-${s.id}`, label: `  ${s.title}` })),
];

export default function AnalysisGuide() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = tocItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    headings.forEach((h) => observerRef.current?.observe(h));
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex gap-6">
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-16">
            <Card data-testid="card-table-of-contents">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  Contents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <nav className="space-y-0.5">
                  {tocItems.map((item) => {
                    const isSubItem = item.label.startsWith("  ");
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => scrollTo(item.id)}
                        className={`block w-full text-left py-1 px-2 rounded-md text-xs transition-colors ${
                          isSubItem ? "pl-4" : "font-medium"
                        } ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover-elevate"
                        }`}
                        data-testid={`toc-link-${item.id}`}
                      >
                        {item.label.trim()}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Analysis Guide</h1>
            <p className="text-sm text-muted-foreground">Learn how to use each page to build and analyze your financial model</p>
          </div>

          <div className="lg:hidden">
            <Card data-testid="card-toc-mobile">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  Jump to Section
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="flex flex-wrap gap-1">
                  {tocItems.filter((t) => !t.label.startsWith("  ")).map((item) => (
                    <Badge
                      key={item.id}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => scrollTo(item.id)}
                      data-testid={`toc-badge-${item.id}`}
                    >
                      {item.label.trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div id="toc-cascade">
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
          </div>

          <div id="toc-workflow">
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
          </div>

          <div id="toc-features">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Feature Reference
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Step-by-step instructions for every interactive feature in the application. Use this as a quick reference when you need to perform a specific action.
            </p>

            <div className="space-y-4">
              {featureGuides.map((guide) => (
                <div key={guide.id} id={`toc-feature-${guide.id}`}>
                  <Card data-testid={`card-feature-${guide.id}`}>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <guide.icon className="h-4 w-4" />
                        {guide.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {guide.features.map((feature, fi) => (
                        <div key={fi} className="space-y-2" data-testid={`feature-${guide.id}-${fi}`}>
                          <h4 className="text-sm font-medium flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                            {feature.name}
                          </h4>
                          <ol className="space-y-1 ml-5">
                            {feature.steps.map((step, si) => (
                              <li key={si} className={`text-sm text-muted-foreground ${step.startsWith("  --") ? "ml-4 list-none" : ""}`}>
                                {step.startsWith("  --") ? step : `${si + 1}. ${step}`}
                              </li>
                            ))}
                          </ol>
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">{feature.notes}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          <div id="toc-required-inputs">
            <Card data-testid="section-required-inputs">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Required Inputs Reference
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quick reference for what each page needs as input and how it affects downstream calculations.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {requiredInputs.map((item) => {
                  const slug = item.page.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                  return (
                    <Card key={item.page} data-testid={`card-required-${slug}`}>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">
                          <Link href={item.path} className="underline" data-testid={`link-required-${slug}`}>
                            {item.page}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {item.critical.length === 0 && item.optional.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No inputs needed -- this page is fully auto-derived</p>
                        ) : (
                          <>
                            {item.critical.length > 0 && (
                              <div className="space-y-1">
                                <Badge variant="destructive">Required</Badge>
                                <ul className="ml-4 space-y-0.5">
                                  {item.critical.map((c, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {item.optional.length > 0 && (
                              <div className="space-y-1">
                                <Badge variant="secondary">Optional</Badge>
                                <ul className="ml-4 space-y-0.5">
                                  {item.optional.map((o, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">{o}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                        <p className="text-sm text-muted-foreground">{item.downstream}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div id="toc-walkthrough">
            <Card data-testid="card-walkthrough">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Complete Walkthrough: Analyzing CloudSync Corp (CSYN)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Follow this step-by-step example to model a hypothetical B2B SaaS company from scratch -- creating the company, building the revenue forecast, generating financial statements, running a full DCF valuation, checking the price chart, and adding it to your portfolio.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {walkthroughSteps.map((ws) => (
                  <div key={ws.step} className="space-y-2" data-testid={`walkthrough-step-${ws.step}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {ws.step}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{ws.title}</span>
                          <Badge variant="outline" className="text-xs">{ws.page}</Badge>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs text-muted-foreground"><span className="font-medium">Scenario:</span> {ws.scenario}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">What to Do</h4>
                          <ul className="space-y-0.5">
                            {ws.actions.map((action, i) => (
                              <li key={i} className={`text-sm text-muted-foreground ${action.startsWith("  --") ? "ml-4" : action === "" ? "h-1" : ""}`}>
                                {action.startsWith("  --") ? action : action === "" ? null : `${i + 1}. ${action}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs"><span className="font-medium">Result:</span> <span className="text-muted-foreground">{ws.result}</span></p>
                        </div>
                        {ws.whatToLookFor && (
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs"><span className="font-medium">What to Look For:</span> <span className="text-muted-foreground">{ws.whatToLookFor}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                    {ws.step < walkthroughSteps.length && (
                      <div className="flex justify-center">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div id="toc-pages">
            <h2 className="text-lg font-semibold mb-4">Page-by-Page Breakdown</h2>

            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} id={`toc-page-${section.id}`}>
                  <Card data-testid={`card-guide-${section.id}`}>
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

                      {"troubleshooting" in section && section.troubleshooting && (
                        <div className="space-y-3 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5" data-testid="section-bs-troubleshooting">
                          <h4 className="text-sm font-medium flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                            {(section.troubleshooting as any).title}
                          </h4>
                          <p className="text-sm text-muted-foreground">{(section.troubleshooting as any).what}</p>

                          <div>
                            <h5 className="text-xs font-medium mb-1">How to Identify the Cause</h5>
                            <ol className="space-y-1 ml-4">
                              {((section.troubleshooting as any).howToDiagnose as string[]).map((item: string, i: number) => (
                                <li key={i} className="text-sm text-muted-foreground">{i + 1}. {item}</li>
                              ))}
                            </ol>
                          </div>

                          <div>
                            <h5 className="text-xs font-medium mb-1">Common Causes</h5>
                            <ul className="space-y-1 ml-4">
                              {((section.troubleshooting as any).commonCauses as string[]).map((item: string, i: number) => (
                                <li key={i} className="text-sm text-muted-foreground">{item}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className="text-xs font-medium mb-1">Steps to Fix</h5>
                            <ol className="space-y-1 ml-4">
                              {((section.troubleshooting as any).fixSteps as string[]).map((item: string, i: number) => (
                                <li key={i} className="text-sm text-muted-foreground">{i + 1}. {item}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}

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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
