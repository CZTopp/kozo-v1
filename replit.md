# Foresight - Financial Modeling & Scenario Planning

## Overview
Financial modeling and scenario planning application for solo founders and analysts. Replaces spreadsheet workflows with interactive dashboards, assumption-based forecasting, variance analysis, and shareable reports.

## Recent Changes
- 2026-02-09: Full MVP implementation - schema, backend routes, frontend pages, seed data, calculation engine

## Architecture

### Stack
- **Backend**: Express.js with TypeScript
- **Frontend**: React + Vite with Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Charts**: Recharts
- **Routing**: wouter (frontend)

### Database Schema (6 tables)
- `financial_models` - Core model with name, years, currency
- `assumptions` - Revenue growth, churn, ARPU, cost structure (linked to model or scenario)
- `scenarios` - Base/optimistic/pessimistic variants
- `actuals` - Real performance data by period
- `reports` - Snapshot reports with JSON data
- `market_data` - Ticker data for benchmarks

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validators + TypeScript types
- `client/src/lib/calculations.ts` - Forecast engine, annual summaries, variance analysis
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - DatabaseStorage class (IStorage interface)
- `server/seed.ts` - Demo data seeder
- `client/src/App.tsx` - Main app with sidebar layout
- `client/src/pages/` - Dashboard, Models, Scenarios, Actuals, Reports, Market Data
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/metric-card.tsx` - Reusable metric display card

### API Routes
- `GET/POST/DELETE /api/models` - CRUD for financial models
- `GET/POST/PATCH /api/assumptions` - Manage assumptions
- `GET/POST/DELETE /api/scenarios` - Scenario management
- `GET/POST/DELETE /api/actuals` - Actual data tracking
- `GET/POST/DELETE /api/reports` - Report snapshots
- `GET/POST/DELETE /api/market-data` - Market data entries

### Design Decisions
- Dark mode default with theme toggle
- Calculation logic runs client-side for responsiveness
- Models auto-create base assumptions on creation
- Scenarios auto-create associated assumptions
- Seed data provides immediate demo experience
- Market data uses simulated data (no external API dependency for MVP)

## User Preferences
- Dark mode preferred
- Clean, professional UI with proper spacing
- Comprehensive chart visualizations
