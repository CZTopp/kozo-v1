# Foresight - Wall Street-Grade Financial Modeling & Valuation Platform

## Overview
Comprehensive financial modeling and valuation application covering 10 core modules: revenue forecasting, income statement (P&L), balance sheet, cash flow statement, DCF valuation with WACC, multi-method valuation comparison, portfolio management dashboard with 15+ stocks and technical indicators, macro data, and global market indices. Market indices pull live data from Yahoo Finance; macro indicators pull live data from FRED API.

## Recent Changes
- 2026-02-10: Editable Balance Sheet & Cash Flow pages - inline editing for actual years, actual/projected year toggle badges, "Paste Data" bulk import modal (TSV/CSV from SEC EDGAR/Excel), server-side BS total recomputation on PATCH
- 2026-02-10: PATCH API endpoints: /api/models/:id/balance-sheet/:year, /api/models/:id/cash-flow/:year, /api/models/:id/income-statement/:year - update individual year data with auto-computed totals
- 2026-02-10: PasteDataModal component (client/src/components/paste-data-modal.tsx) - reusable modal for pasting TSV/CSV financial data with field matching and preview
- 2026-02-10: Recalculation engine preserves actual year data (isActual flag) - partitions years into actual vs projected, only recomputes projected years
- 2026-02-10: Company ticker field on financial_models - each company can have a ticker symbol; Company Chart auto-loads the selected company's ticker (falls back to AAPL); users can save a new ticker from the chart page; create company dialog includes ticker field
- 2026-02-10: Company Chart page (/chart) - embedded TradingView interactive chart with ticker search, quick-access buttons, theme-aware widget, pre-loaded MA50/MA200
- 2026-02-10: Analysis Guide updated - table of contents with jump navigation (desktop sidebar + mobile badges), Company Chart section added to page breakdown, walkthrough expanded to 11 steps with chart step
- 2026-02-10: Live portfolio price refresh - POST /api/refresh-portfolio-prices fetches live Yahoo Finance quotes for all portfolio positions (price, P/E, beta, MA50/200, 52W range, volume, market cap, EPS, dividend yield), recalculates P&L and golden cross signals
- 2026-02-10: Editable market data - users can add/remove market indices (any Yahoo Finance symbol) and FRED macro indicators (any series ID) via Add/Remove buttons on Market Data page
- 2026-02-10: New API endpoints: POST /api/market-indices/add-custom, DELETE /api/market-indices/:id, POST /api/macro-indicators/add-custom, DELETE /api/macro-indicators/:id
- 2026-02-10: fetchPortfolioQuotes, fetchSingleIndexQuote, fetchSingleFredSeries functions added to server/live-data.ts
- 2026-02-10: Live market data integration - Yahoo Finance for 12 global indices (real-time prices, YTD/MTD returns, daily change %), FRED API for 15 macro indicators (rates, inflation, GDP, labor, sentiment, volatility) with prior values for change tracking
- 2026-02-10: POST /api/refresh-market-data endpoint - bulk fetches and updates all indices + macro indicators, returns counts and errors
- 2026-02-10: Market Data page "Refresh Live Data" button with loading state and toast feedback
- 2026-02-10: New DB columns: dailyChangePercent on market_indices, priorValue on macro_indicators
- 2026-02-10: server/live-data.ts - Yahoo Finance (yahoo-finance2) and FRED API integration module
- 2026-02-10: Data validation warnings across all pages - Model Readiness checklist on Dashboard, inline warnings on DCF/Valuation/Revenue/Income Statement pages when data is missing or at defaults, Required Inputs reference section in Analysis Guide
- 2026-02-10: Added 10-step analyst walkthrough to Analysis Guide using hypothetical "CloudSync Corp (CSYN)" - covers company creation, revenue modeling, P&L, balance sheet, cash flow review, full DCF/WACC build, valuation comparison, portfolio addition, macro cross-check, iterative refinement
- 2026-02-10: Added Analysis Guide page (/guide) with page-by-page breakdown, recommended workflow, cascade explanation
- 2026-02-10: InfoTooltip component (client/src/components/info-tooltip.tsx) - reusable hover tooltip for financial terms
- 2026-02-10: Added detailed tooltips to all 9 pages - KPI cards, chart titles, projection settings, risk metrics, macro categories
- 2026-02-10: Default projection settings reverted to match original behavior: decay=0, multipliers=1.2/1.0/0.8
- 2026-02-10: Advanced projection features - growth decay rate, target margin convergence, bull/base/bear scenario multipliers
- 2026-02-10: Projection Settings UI panel on Revenue Forecast page (collapsible card with editable parameters)
- 2026-02-10: Growth decay formula: baseGrowthRate * (1 - decayRate)^yearsFromLastData applied in forecastForward()
- 2026-02-10: Target margin convergence in recalculate engine - cost % adjusts across years to approach target net margin
- 2026-02-10: Scenario multipliers wire into DCF bull/base/bear targets and scenario revenue table on Valuation Comparison page
- 2026-02-10: 5 new columns on financial_models: growthDecayRate, targetNetMargin, scenarioBullMultiplier, scenarioBaseMultiplier, scenarioBearMultiplier
- 2026-02-10: PATCH /api/models/:id now validates numeric projection fields
- 2026-02-10: Forecast Forward feature - auto-projects revenue into empty future years based on historical growth rates, cascades through all financial statements
- 2026-02-10: New API endpoint: POST /api/models/:id/forecast-forward
- 2026-02-10: Multi-company support - ModelContext provider tracks selected company, sidebar company selector dropdown, create/delete companies, all pages use context instead of hardcoded first model
- 2026-02-10: New companies start blank (no seeded data) - analyst builds their own analysis
- 2026-02-09: Added cascading recalculation engine (server/recalculate.ts) - Revenue → IS → BS → CF → DCF → Valuation
- 2026-02-09: Added editable pages: Revenue (quarterly amounts), Income Statement (cost %), Balance Sheet (working capital %), DCF (WACC params)
- 2026-02-09: Cash Flow and Valuation Comparison are auto-derived read-only pages with cascade indicators
- 2026-02-09: New API endpoints: PATCH /api/revenue-periods/:id, PATCH /api/models/:id/assumptions, PATCH /api/models/:id/dcf-params, POST /api/models/:id/recalculate
- 2026-02-09: Complete rebuild - 12 database tables, full API layer, 9 frontend pages, comprehensive seed data, DCF/WACC/valuation calculation engine

## Architecture

### Stack
- **Backend**: Express.js with TypeScript
- **Frontend**: React + Vite with Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Charts**: Recharts
- **Routing**: wouter (frontend)

### Database Schema (12 tables)
- `financial_models` - Core model with name, years, currency, shares outstanding
- `revenue_line_items` - Revenue streams (Subscription, Services, Marketplace, Usage)
- `revenue_periods` - Quarterly revenue data per line item
- `income_statement_lines` - Annual P&L with all cost lines and margins
- `balance_sheet_lines` - Assets, liabilities, equity with % of revenue
- `cash_flow_lines` - Operating/investing/financing flows and FCF
- `dcf_valuations` - WACC inputs, NPV, terminal value, target price
- `valuation_comparisons` - P/R, P/E PEG, DCF bull/base/bear targets
- `portfolio_positions` - 15 stock positions with 40+ fields each
- `macro_indicators` - 16 economic indicators (rates, inflation, growth, labor)
- `market_indices` - 12 global indices (US, Europe, Asia) with returns
- `portfolio_red_flags` - Risk checklist items
- `scenarios` - Bull/bear case scenario variants
- `assumptions` - Model assumptions (growth, margins, costs)

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validators + TypeScript types
- `client/src/lib/calculations.ts` - DCF/WACC, valuation multiples, portfolio metrics, sensitivity analysis
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - DatabaseStorage class (IStorage interface)
- `server/recalculate.ts` - Cascading recalculation engine (Revenue → IS → BS → CF → DCF → Valuation)
- `server/seed.ts` - Comprehensive demo data seeder (5 years financial data, 15 stocks, 16 macro, 12 indices)
- `client/src/App.tsx` - Main app with sidebar layout, 10 routes, ModelProvider wrapping
- `client/src/lib/model-context.tsx` - ModelContext provider for multi-company support (selected model ID, localStorage persistence)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with company selector dropdown, create/delete company dialogs

### Frontend Pages (10 total)
- `dashboard.tsx` - Financial overview, portfolio KPIs, sector allocation, macro data, top movers
- `revenue-forecast.tsx` - Revenue streams table, quarterly breakdown, growth rates, charts
- `income-statement.tsx` - Full P&L table with margins, YoY growth, margin analysis chart
- `balance-sheet.tsx` - Assets/liabilities/equity with balance validation, stacked bar chart
- `cash-flow.tsx` - Operating/investing/financing flows, FCF trend chart
- `dcf-valuation.tsx` - WACC calculation panel, DCF results, 5x5 sensitivity table
- `valuation-comparison.tsx` - P/R, P/E, DCF methods with bull/base/bear scenarios
- `company-chart.tsx` - Embedded TradingView interactive chart with ticker search, quick symbols, theme-aware
- `portfolio.tsx` - 15 positions table, analytics, risk/red flags, macro/indices tabs
- `market-data.tsx` - Global indices tables, macro indicators by category, YTD performance chart

### API Routes
- `GET/POST/DELETE /api/models` - Financial models CRUD
- `GET/POST /api/models/:id/revenue-line-items` - Revenue streams
- `GET/POST /api/models/:id/revenue-periods` - Quarterly revenue data
- `GET/POST /api/models/:id/income-statement` - Income statement lines
- `GET/POST /api/models/:id/balance-sheet` - Balance sheet lines
- `GET/POST /api/models/:id/cash-flow` - Cash flow lines
- `GET/POST /api/models/:id/dcf` - DCF valuation data
- `GET/POST /api/models/:id/valuation-comparison` - Multi-method valuation
- `GET/POST/DELETE /api/portfolio` - Portfolio positions
- `GET/POST /api/portfolio-red-flags` - Risk flags
- `GET/POST /api/macro-indicators` - Macro economic data
- `GET/POST /api/market-indices` - Global market indices

### Design Decisions
- Dark mode default with theme toggle
- Calculation logic runs client-side for responsiveness
- Seed data provides immediate Wall Street-grade demo experience
- All data is simulated (no external API dependency)
- Portfolio tracks 40+ fields per position (price, volume, moving averages, beta, P/E, etc.)
- Technical indicators: MA50, MA200, golden cross detection
- Risk analysis: stop-loss tracking, concentration risk, red flags checklist
- Schema uses real (float) columns for financial data

## User Preferences
- Dark mode preferred
- Clean, professional UI with proper spacing
- Comprehensive chart visualizations
- Wall Street-grade data density
