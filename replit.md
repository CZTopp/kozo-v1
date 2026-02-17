# Foresight - Wall Street-Grade Financial Modeling & Valuation Platform

## Overview
Foresight is a comprehensive financial modeling and valuation platform designed to provide Wall Street-grade analysis. It encompasses 10 core modules: revenue forecasting, income statement (P&L), balance sheet, cash flow statement, DCF valuation with WACC, multi-method valuation comparison, a portfolio management dashboard with 15+ stocks and technical indicators, macro data, and global market indices. The platform's key capabilities include live data integration for market indices (Yahoo Finance) and macro indicators (FRED API), along with advanced SEC EDGAR filing import functionalities for financial statements. The business vision is to empower financial analysts and investors with sophisticated tools for accurate forecasting, valuation, and portfolio management, enabling better investment decisions and deeper market insights.

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

## External Dependencies
- **Yahoo Finance**: Used for live market data (global indices, stock prices, technical indicators, company fundamentals).
- **FRED API**: Used for live macro economic indicators (rates, inflation, GDP, labor, sentiment, volatility).
- **SEC EDGAR API**: Used for fetching and parsing 10-K financial filings. Ticker-based CIK lookup, filing list retrieval, unified multi-statement parsing (IS+BS+CF). No API key required.
- **TradingView**: Integrated for interactive charting widgets.

### IPO/INVEST Mode Architecture
- `modelMode` field on financial_models: `'ipo'` (default) or `'invest'`
- **IPO Mode**: Bottom-up forecasting with custom revenue streams, quarterly detail, manual entry
- **INVEST Mode**: SEC-aligned structure with "Total Revenue" line item, Import SEC Filing button, unified 10-K import
- Mode toggle on Revenue Forecast page header persists to model via PATCH /api/models/:id
- Import flow: ticker search → CIK → filing list → parse all 3 statements → preview → import with year range expansion
- Import creates quarterly revenue periods (annual÷4), IS/BS/CF actuals, triggers cascade recalculation
- Key files: server/sec-search.ts, client/src/components/import-sec-modal.tsx, client/src/pages/revenue-forecast.tsx