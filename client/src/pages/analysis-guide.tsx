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
    optional: [],
    downstream: "CapEx flows into Cash Flow Statement. Working capital changes affect Operating Cash Flow.",
  },
  {
    page: "Cash Flow",
    path: "/cash-flow",
    critical: [],
    optional: [],
    downstream: "Fully auto-derived. No inputs needed. Free Cash Flow (FCF) is the key output used by DCF.",
  },
  {
    page: "DCF Valuation",
    path: "/dcf",
    critical: ["Current Share Price", "Risk-Free Rate", "Beta", "Market Return"],
    optional: ["Cost of Debt", "Equity/Debt Weights", "Long-Term Growth Rate", "Total Debt"],
    downstream: "Produces the DCF target price. Without a current share price, upside/downside cannot be calculated.",
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
    title: "Configure Balance Sheet Assumptions",
    page: "Balance Sheet",
    icon: BarChart3,
    scenario: "CloudSync collects from enterprise customers in ~45 days (A/R ~12% of revenue), pays suppliers in ~30 days (A/P ~8%), and invests ~5% of revenue in CapEx (servers, office buildouts).",
    actions: [
      "Navigate to the Balance Sheet page. Income Statement data has already cascaded in.",
      "Click \"Edit Assumptions\" to set working capital ratios:",
      "  -- Accounts Receivable: 12% of revenue (enterprise collection cycles)",
      "  -- Accounts Payable: 8% of revenue (standard vendor payment terms)",
      "  -- CapEx: 5% of revenue (cloud infrastructure, office leases)",
      "Click \"Save & Recalculate.\"",
    ],
    result: "The balance sheet builds out with Total Assets, Total Liabilities, and Total Equity. The \"Balanced\" badge should appear, confirming the accounting identity holds. A/R grows with revenue, reflecting the capital tied up in receivables.",
    whatToLookFor: "Verify the balance sheet shows \"Balanced.\" If it shows \"Imbalanced,\" revisit your assumptions. Check that CapEx at 5% is reasonable -- too high means the company is capital-intensive (unusual for SaaS); too low may understate investment needs.",
  },
  {
    step: 5,
    title: "Review Auto-Generated Cash Flows",
    page: "Cash Flow Statement",
    icon: Wallet,
    scenario: "This page is fully auto-derived. You don't enter anything here -- you just review the output.",
    actions: [
      "Navigate to the Cash Flow page.",
      "Review Operating Cash Flow: starts with Net Income, adds back Depreciation (non-cash), and adjusts for working capital changes (increase in A/R reduces cash; increase in A/P adds cash).",
      "Review Investing Cash Flow: primarily the CapEx you set at 5% of revenue.",
      "Review Free Cash Flow (FCF): Operating Cash Flow minus CapEx. This is the single most important number for valuation.",
      "Check the FCF Trend tab to visualize the trajectory. Growing FCF is the goal.",
      "Check the Breakdown tab to see how operating, investing, and financing activities compare as a stacked chart.",
    ],
    result: "CloudSync should show positive and growing FCF, driven by strong operating margins and modest CapEx. By 2029, FCF should be meaningfully higher than 2025 -- reflecting revenue growth and improving profitability.",
    whatToLookFor: "If FCF is negative in early years, this may be acceptable if the company is investing heavily. But by the projection end, FCF should be positive for a healthy SaaS business. If not, revisit your cost or CapEx assumptions.",
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
    step: 8,
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
    step: 9,
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
    step: 10,
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
      "Check your portfolio position -- if CSYN has appreciated to $50, update the current price in your portfolio to see updated P&L and portfolio metrics.",
      "Periodically review the Sensitivity Analysis table on the DCF page to understand your margin of safety at the current price.",
    ],
    result: "Your model stays current and your investment thesis is continuously validated. The cascading engine ensures that a single data point update (like a revenue beat) flows through every financial statement, cash flow projection, and valuation method automatically.",
    whatToLookFor: "Track how your target price evolves over time as you incorporate new data. If the target keeps rising with each quarterly update, your thesis is strengthening. If it's declining, it may be time to re-evaluate the position.",
  },
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

      <Card data-testid="card-walkthrough">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Complete Walkthrough: Analyzing CloudSync Corp (CSYN)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Follow this step-by-step example to model a hypothetical B2B SaaS company from scratch -- creating the company, building the revenue forecast, generating financial statements, running a full DCF valuation, and adding it to your portfolio.
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
