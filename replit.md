# Foresight - Wall Street-Grade Financial Modeling & Valuation Platform

## Overview
Comprehensive financial modeling and valuation application covering 10 core modules: revenue forecasting, income statement (P&L), balance sheet, cash flow statement, DCF valuation with WACC, multi-method valuation comparison, portfolio management dashboard with 15+ stocks and technical indicators, macro data, and global market indices. All data is simulated demo data.

## Recent Changes
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
- `client/src/App.tsx` - Main app with sidebar layout, 9 routes, ModelProvider wrapping
- `client/src/lib/model-context.tsx` - ModelContext provider for multi-company support (selected model ID, localStorage persistence)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with company selector dropdown, create/delete company dialogs

### Frontend Pages (9 total)
- `dashboard.tsx` - Financial overview, portfolio KPIs, sector allocation, macro data, top movers
- `revenue-forecast.tsx` - Revenue streams table, quarterly breakdown, growth rates, charts
- `income-statement.tsx` - Full P&L table with margins, YoY growth, margin analysis chart
- `balance-sheet.tsx` - Assets/liabilities/equity with balance validation, stacked bar chart
- `cash-flow.tsx` - Operating/investing/financing flows, FCF trend chart
- `dcf-valuation.tsx` - WACC calculation panel, DCF results, 5x5 sensitivity table
- `valuation-comparison.tsx` - P/R, P/E, DCF methods with bull/base/bear scenarios
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
