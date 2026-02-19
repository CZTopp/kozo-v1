# Kozo - Wall Street-Grade Financial Modeling & Valuation Platform

## Overview
Kozo is a comprehensive financial modeling and valuation platform designed to provide Wall Street-grade analysis. It encompasses 10 core modules: revenue forecasting, income statement (P&L), balance sheet, cash flow statement, DCF valuation with WACC, multi-method valuation comparison, a portfolio management dashboard with 15+ stocks and technical indicators, macro data, and global market indices. The platform's key capabilities include live data integration for market indices (Yahoo Finance) and macro indicators (FRED API), along with advanced SEC EDGAR filing import functionalities for financial statements. The business vision is to empower financial analysts and investors with sophisticated tools for accurate forecasting, valuation, and portfolio management, enabling better investment decisions and deeper market insights.

## User Preferences
- Dark mode preferred
- Clean, professional UI with proper spacing
- Comprehensive chart visualizations
- Wall Street-grade data density

## System Architecture

### Stack
- **Backend**: Express.js with TypeScript
- **Frontend**: React + Vite with Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Charts**: Recharts
- **Routing**: wouter (frontend)

### Core Architectural Decisions
- **Cascading Recalculation Engine**: A central `recalculate.ts` engine ensures that changes in revenue automatically cascade through the Income Statement, Balance Sheet, Cash Flow, DCF, and Valuation modules, maintaining data consistency.
- **Multi-Company Support**: The platform supports the creation and management of multiple financial models (companies), allowing users to switch contexts seamlessly.
- **Data Import**: Advanced capabilities for importing SEC EDGAR 10-K filings (Income Statement, Balance Sheet, Cash Flow) directly into financial models, including ticker-based search and iXBRL parsing.
- **Real-time Data Integration**: Live market data for global indices and macro indicators are fetched and updated, providing up-to-date insights for portfolio and market analysis.
- **Financial Modeling Features**:
    - **Revenue Forecast**: Supports 10-year mixed-period forecasting (quarterly and annual), unit scaling, YoY/QoQ analysis, inline sparklines, and advanced projection settings (growth decay, target margin convergence, scenario multipliers).
    - **Editable Financial Statements**: Income Statement, Balance Sheet, and Cash Flow pages allow inline editing for actual years, with server-side recomputation for totals and balances.
    - **Valuation**: DCF with WACC calculations, 5x5 sensitivity tables, and multi-method valuation comparisons (P/R, P/E, PEG) with bull/base/bear scenarios.
- **Portfolio Management**: Tracks individual purchase entries (lots), aggregates weighted-average cost, calculates P&L, and includes technical indicators (MA50, MA200, Golden Cross) and risk analysis (stop-loss, concentration, red flags).
- **UI/UX**: Features a dark mode default, clean professional design, comprehensive chart visualizations, and detailed info tooltips for financial terms.
- **Design Decisions**:
    - Calculation logic primarily runs client-side for responsiveness.
    - Seed data provides a comprehensive demo experience.
    - Schema uses real (float) columns for precision in financial data.

### Feature Specifications
- **SEC EDGAR Integration**: Ticker-based search for CIK, retrieval of 10-K filings, parsing of all three financial statements (IS, BS, CF) from HTML, and unified import with year range expansion. Supports iXBRL parsing.
- **Yahoo Finance Fundamentals**: Fetches company fundamentals like margins, debt-to-equity, sector, and industry.
- **Dynamic Data Display**: `displayUnit` field on financial models controls value entry and display (ones/thousands/millions/billions/trillions).
- **Forecasting & Projections**: Implements `forecastForward` to auto-project revenue, and advanced projection settings with `growthDecayRate`, `targetNetMargin`, and `scenarioBull/Base/BearMultiplier`.
- **Company Management**: Allows creation, editing (name, ticker, description, currency, shares, year range, display unit), and deletion of financial models.
- **Interactive Charting**: Embedded TradingView interactive chart with ticker search and pre-loaded technical indicators.
- **Market Data Customization**: Users can add/remove custom market indices and FRED macro indicators.
- **Data Validation**: Model Readiness checklist on Dashboard and inline warnings on pages for missing data.

### Crypto Analysis Module
- **4 new DB tables**: crypto_projects, token_supply_schedules, token_incentives, protocol_metrics
- **Crypto Dashboard** (/crypto): Search and add coins via CoinGecko, project cards with market data and sparklines, refresh prices
- **Tokenomics Modeler** (/crypto/tokenomics/:id): Supply schedule management, vesting pie charts, incentive mapping with sustainability flags, pre-loaded templates for BTC/ETH/SOL/UNI/AAVE
- **Protocol Financials** (/crypto/financials/:id): TVL/fees/revenue charts from DefiLlama, DefiLlama protocol search, revenue sustainability analysis
- **Crypto Valuation** (/crypto/valuation/:id): Discounted Fee Revenue model for DeFi protocols, Comparable Analysis with classification (Revenue-Generating/Speculative/Meme), Scenario Analysis with bull/base/bear, honest "no fundamental basis" notices for speculative tokens, key risk cards
- **Backend**: CoinGecko integration (market data, free API), DefiLlama integration (protocol revenue/TVL, free API), incentive templates for 5 major protocols
- **Key files**: server/crypto-data.ts, client/src/pages/crypto-dashboard.tsx, crypto-tokenomics.tsx, crypto-financials.tsx, crypto-valuation.tsx

## External Dependencies
- **Yahoo Finance**: Used for live market data (global indices, stock prices, technical indicators, company fundamentals).
- **FRED API**: Used for live macro economic indicators (rates, inflation, GDP, labor, sentiment, volatility).
- **SEC EDGAR API**: Used for fetching and parsing 10-K financial filings. Ticker-based CIK lookup, filing list retrieval, unified multi-statement parsing (IS+BS+CF). No API key required.
- **TradingView**: Integrated for interactive charting widgets.
- **CoinGecko API**: Used for crypto market data (price, supply, volume, sparklines). Free API, no key required.
- **DefiLlama API**: Used for DeFi protocol financials (TVL, fees, revenue). Free API, no key required.

### Authentication & Multi-Tenancy
- **Replit Auth (OIDC)**: Uses Replit as OpenID Connect provider for authentication
- **Auth Routes**: `/api/login`, `/api/logout`, `/api/callback`, `/api/auth/user` (server-side redirects)
- **Middleware**: `isAuthenticated` middleware protects all `/api/*` routes (except auth routes)
- **Per-User Data Isolation**: `userId` column on `financial_models`, `portfolio_positions`, `macro_indicators`, `market_indices`, `portfolio_red_flags`, `crypto_projects` — all storage queries filter by authenticated user's `sub` claim
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`
- **Frontend Auth**: `useAuth()` hook from `@/hooks/use-auth.ts` provides `{ user, isLoading, isAuthenticated }`
- **Landing Page**: Unauthenticated users see `client/src/pages/landing.tsx` with hero, features, and login CTA
- **Key files**: `server/replit_integrations/auth/`, `shared/models/auth.ts`, `client/src/hooks/use-auth.ts`, `client/src/pages/landing.tsx`

### IPO/INVEST Mode Architecture
- `modelMode` field on financial_models: `'ipo'` (default) or `'invest'`
- **IPO Mode**: Bottom-up forecasting with custom revenue streams, quarterly detail, manual entry
- **INVEST Mode**: SEC-aligned structure with "Total Revenue" line item, Import SEC Filing button, unified 10-K import
- Mode toggle on Revenue Forecast page header persists to model via PATCH /api/models/:id
- Import flow: ticker search → CIK → filing list → parse all 3 statements → preview → import with year range expansion
- Import creates quarterly revenue periods (annual÷4), IS/BS/CF actuals, triggers cascade recalculation
- Key files: server/sec-search.ts, client/src/components/import-sec-modal.tsx, client/src/pages/revenue-forecast.tsx

### Protocol Revenue Forecasting & Token Flow Model
- **2 new DB tables**: `protocol_revenue_forecasts` (year, fees, revenue, growth, takeRate, emissionCost, netValueAccrual, scenario), `token_flow_entries` (period, periodLabel, minting, unlocks, burns, buybacks, stakingLockups, netFlow, cumulativeSupply)
- **Protocol Revenue Forecast** (`/crypto/revenue/:id`): Auto-seed from DefiLlama actuals, 3-5 year editable projection table, bull/base/bear scenarios, emission cost tracking, net value accrual calculation, revenue vs emissions chart
- **Token Flow Model** (`/crypto/token-flows/:id`): Period-by-period editable table, auto-seed from supply schedules, on-chain data via thirdweb Insight (burn events, staking balances, holder concentration), waterfall chart, cumulative supply projection
- **Cascade Integration**: Revenue forecast net accrual and token flow projected supply feed into crypto valuation DCF for improved implied token price
- **Thirdweb Insight** (`server/thirdweb-data.ts`): Optional integration for real on-chain data (burn rates, staking balances, holder concentration). Free tier 300K queries/month. Requires THIRDWEB_CLIENT_ID env var.
- **API Routes**: CRUD + seed for both tables, on-chain data endpoint
- Key files: server/thirdweb-data.ts, client/src/pages/crypto-revenue-forecast.tsx, crypto-token-flows.tsx, crypto-valuation.tsx (updated)

### Crypto Project Navigation & Settings
- **CryptoProjectNav** (`client/src/components/crypto-project-nav.tsx`): Reusable nav bar across all crypto analysis pages (Tokenomics, Financials, Valuation, Revenue, Token Flows, Settings) with active state highlighting
- **Project Settings** (`/crypto/settings/:id`): Centralized editing for project name, symbol, CoinGecko ID, chain/contract config, DefiLlama protocol (search+change+clear), valuation assumptions (discount/growth rates, projection years), governance info, and research notes
- **Data Caching**: On-chain and DeFi data are cached in `crypto_projects` table (`cachedOnchainData`, `cachedDefiData` as jsonb, plus `onchainDataFetchedAt`, `defiDataFetchedAt` timestamps). Pages load cached data on mount; stale indicator shows when data is >24h old
- **Cached Data API**: `GET /api/crypto/projects/:id/cached-data` returns cached on-chain/DeFi data with staleness flags
- **New schema columns**: `cachedOnchainData`, `onchainDataFetchedAt`, `cachedDefiData`, `defiDataFetchedAt`, `chainId`, `contractAddress`, `stakingContract`, `notes`

### Token Allocation Research Service
- **AI-Powered Allocation Research**: When seeding allocations for a project, the system uses a 3-tier priority chain:
  1. **Curated Data** (highest confidence): Verified allocation data for 13 major tokens (BTC, ETH, SOL, AVAX, UNI, AAVE, ARB, OP, LINK, MATIC, TRX, MNT, HASH)
  2. **AI Research** (OpenAI gpt-4o-mini): For any token not in the curated list, calls OpenAI with structured prompt to research allocation breakdowns from training data (whitepapers, docs, research reports). Returns categories, percentages, vesting schedules, and references with confidence level (high/medium/low)
  3. **Industry Template** (fallback): Generic industry-average allocations if both above fail
- **Clear & Re-seed**: Users can clear all allocations and re-seed to get fresh data
- **AI Disclaimer Banner**: Yellow warning banner shown when allocations are AI-researched, advising review
- **CoinGecko Supply Enrichment**: AI percentage results are multiplied by project's total/max supply to calculate token amounts
- **Source Attribution**: Each allocation entry shows its source (Curated/AI-Researched/Industry Average) in the table
- Key files: server/crypto-data.ts (curated data + AI research service), server/routes.ts (seed + clear endpoints), client/src/pages/crypto-tokenomics.tsx

### Admin Panel
- `isAdmin` boolean column on `users` table, default `false`
- Admin middleware: checks `users.isAdmin` before allowing access to `/api/admin/*` routes
- **Admin Routes**: `GET /api/admin/stats` (system counts), `GET /api/admin/users` (all users with model/position counts), `PATCH /api/admin/users/:id` (toggle admin)
- **Admin Page** (`/admin`): System stats cards, user list with admin grant/revoke, protected client-side via `user?.isAdmin`
- Admin nav link in sidebar only visible to admin users
- Key files: client/src/pages/admin.tsx, server/routes.ts (admin routes at bottom)