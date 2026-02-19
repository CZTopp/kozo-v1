# Kozo - Wall Street-Grade Financial Modeling & Valuation Platform

## Overview
Kozo is a comprehensive financial modeling and valuation platform designed to deliver Wall Street-grade analysis. It integrates 10 core modules covering revenue forecasting, financial statements (P&L, Balance Sheet, Cash Flow), DCF valuation with WACC, multi-method valuation comparisons, a portfolio management dashboard, macro data, and global market indices. The platform provides live data integration from sources like Yahoo Finance and FRED API, alongside advanced SEC EDGAR filing import capabilities. Kozo's vision is to empower financial analysts and investors with sophisticated tools for accurate forecasting, valuation, and portfolio management, ultimately enabling better investment decisions and deeper market insights.

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
- **Cascading Recalculation Engine**: A central engine ensures data consistency across all financial modules, where changes in one area (e.g., revenue) automatically update dependent modules (e.g., Income Statement, DCF).
- **Multi-Company Support**: Users can manage and switch between multiple financial models for different companies.
- **Data Import**: Advanced SEC EDGAR 10-K filing import, including ticker-based search and iXBRL parsing, directly populates financial statements.
- **Real-time Data Integration**: Live market data for global indices and macro indicators are fetched and updated to provide current insights.
- **Financial Modeling Features**:
    - **Revenue Forecast**: Supports 10-year mixed-period forecasting with advanced projection settings like growth decay and target margin convergence.
    - **Editable Financial Statements**: Income Statement, Balance Sheet, and Cash Flow allow inline editing for actual years with server-side recomputation.
    - **Valuation**: Includes DCF with WACC, sensitivity tables, and multi-method valuation comparisons across bull/base/bear scenarios.
- **Portfolio Management**: Tracks individual purchase entries, calculates P&L, incorporates technical indicators (MA50, MA200), and provides risk analysis.
- **UI/UX**: Features a dark mode, professional design, comprehensive charting, and detailed info tooltips.
- **Design Decisions**: Client-side calculation logic for responsiveness, seed data for demos, and real (float) columns for financial precision.
- **Authentication & Multi-Tenancy**: Uses Replit Auth (OIDC) with `isAuthenticated` middleware and per-user data isolation based on `userId`.
- **IPO/INVEST Mode**: Financial models can operate in 'ipo' mode for bottom-up forecasting or 'invest' mode for SEC-aligned structures with 10-K import.
- **Crypto Analysis Module**: Includes a dedicated dashboard, Tokenomics Modeler (supply schedules, vesting, incentives), Protocol Financials (TVL/fees/revenue), and Crypto Valuation (Discounted Fee Revenue, Comparable Analysis).
- **AI-Powered Research**: Integrates AI (OpenAI gpt-4o-mini) for researching token allocations, fundraising rounds, and supply schedules for crypto projects, with a priority chain including curated data and industry templates.
- **Admin Panel**: Provides system statistics, user management, and admin grant/revoke functionalities, accessible only to authenticated administrators.

## External Dependencies
- **Yahoo Finance**: Live market data, stock prices, technical indicators, company fundamentals.
- **FRED API**: Live macro economic indicators (rates, inflation, GDP).
- **SEC EDGAR API**: Fetching and parsing 10-K financial filings.
- **TradingView**: Interactive charting widgets.
- **CoinGecko API**: Crypto market data (price, supply, volume, sparklines).
- **DefiLlama API**: DeFi protocol financials (TVL, fees, revenue).
- **OpenAI API**: AI-powered research for crypto project data.
- **Replit Auth (OIDC)**: User authentication.
- **Thirdweb Insight**: Optional on-chain data for crypto projects (burn events, staking balances, holder concentration).