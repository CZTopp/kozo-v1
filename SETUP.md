# Kozo - Local Setup Guide

## Prerequisites

- **Node.js** 20+ (with npm)
- **PostgreSQL** 14+ (running locally or via Docker)
- **Git**

## 1. Clone the Repository

```bash
git clone <your-repo-url> kozo
cd kozo
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Set Up PostgreSQL

### Option A: Local PostgreSQL

```bash
# Create the database
createdb kozo

# Verify connection
psql -d kozo -c "SELECT 1"
```

### Option B: Docker

```bash
docker run -d \
  --name kozo-postgres \
  -e POSTGRES_USER=kozo \
  -e POSTGRES_PASSWORD=kozo \
  -e POSTGRES_DB=kozo \
  -p 5432:5432 \
  postgres:16

# Connection string: postgresql://kozo:kozo@localhost:5432/kozo
```

### Option C: Replit

The database is automatically provisioned. The `DATABASE_URL` environment variable is pre-configured.

## 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Cookie signing key (generate: `openssl rand -hex 32`) |
| `OPENAI_API_KEY` | Yes* | AI token research, copilot (*app works without, but AI features disabled) |
| `FRED_API_KEY` | Yes* | Macro economic data from FRED (*macro tab won't load without it) |
| `THIRDWEB_CLIENT_ID` | No | On-chain data (burn events, staking, holders) |
| `OPENAI_CHATKIT_WORKFLOW_ID` | No | ChatKit copilot agent workflow |
| `OPENAI_CHATKIT_DOMAIN_PK` | No | ChatKit domain public key |
| `ISSUER_URL` | No* | OIDC issuer URL (*auto-set on Replit, set for local OIDC provider) |
| `REPL_ID` | No* | Replit app ID (*auto-set on Replit, set for local auth) |

## 5. Push the Database Schema

Kozo uses Drizzle ORM to manage the database schema. Push the schema to your database:

```bash
npm run db:push
```

This creates all required tables: companies, revenue data, financial statements, portfolio positions, crypto projects, emissions cache, and more.

To verify tables were created:

```bash
psql $DATABASE_URL -c "\dt"
```

## 6. Seed Demo Data (Optional)

The application automatically seeds demo data (a sample "CloudSync Corp" company model) on first startup if no data exists. Simply start the server and the seed runs automatically.

## 7. Start the Development Server

```bash
npm run dev
```

This starts both the Express backend and Vite frontend dev server on **port 5000**.

Open [http://localhost:5000](http://localhost:5000) in your browser.

## 8. Authentication (Local Development)

Kozo uses Replit Auth (OpenID Connect). On Replit, this works automatically.

For local development outside Replit, you have two options:

1. **Set `ISSUER_URL`** to point to a local OIDC provider (e.g., [Dex](https://dexidp.io/) or [Keycloak](https://www.keycloak.org/))
2. **Bypass auth** by modifying `server/replit_integrations/auth/replitAuth.ts` to auto-assign a test user in development mode

## Production Build

```bash
# Build the production bundle
npm run build

# Start the production server
npm start
```

The production build outputs to `dist/` and serves the frontend as static files.

---

## Database Commands Reference

### Schema Management

```bash
# Push schema changes to the database (non-destructive)
npm run db:push

# Force push if there are conflicts (use carefully)
npm run db:push --force

# Type-check the project
npm run check
```

### Dump Production Data

```bash
# Full database dump (schema + data)
pg_dump "$DATABASE_URL" > dump.sql

# Data only (no schema)
pg_dump --data-only "$DATABASE_URL" > data_dump.sql

# Specific table (e.g., emissions cache)
pg_dump --data-only -t emissions_cache "$DATABASE_URL" > emissions_data.sql

# Custom format (compressed, supports selective restore)
pg_dump -Fc "$DATABASE_URL" > kozo.dump
```

### Restore Data

```bash
# Restore from SQL dump
psql "$DATABASE_URL" < dump.sql

# Restore from custom format
pg_restore -d "$DATABASE_URL" kozo.dump

# Restore a specific table from custom format
pg_restore -d "$DATABASE_URL" -t emissions_cache kozo.dump
```

### Migrate Data Between Environments

```bash
# Export production data
pg_dump --data-only "$PROD_DATABASE_URL" > prod_data.sql

# Import into local database
psql "$DATABASE_URL" < prod_data.sql
```

### Inspect Database

```bash
# List all tables
psql "$DATABASE_URL" -c "\dt"

# Describe a specific table
psql "$DATABASE_URL" -c "\d emissions_cache"

# Count rows in a table
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM emissions_cache"

# View cached emissions tokens
psql "$DATABASE_URL" -c "SELECT coingecko_id, category, updated_at FROM emissions_cache ORDER BY updated_at DESC"
```

---

## Project Structure

```
kozo/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities (API client, query config)
│   └── index.html
├── server/                  # Express backend
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Database CRUD interface
│   ├── db.ts                # Drizzle database connection
│   ├── seed.ts              # Demo data seeder
│   ├── crypto-data.ts       # CoinGecko / AI research logic
│   ├── emissions-service.ts # Token emissions analysis engine
│   ├── copilot.ts           # AI copilot streaming endpoint
│   └── replit_integrations/ # Auth (OIDC) integration
├── shared/
│   └── schema.ts            # Drizzle schema + Zod types (shared between client/server)
├── drizzle.config.ts        # Drizzle Kit configuration
├── .env.example             # Environment variable template
├── SETUP.md                 # This file
└── package.json
```

---

## Troubleshooting

### "DATABASE_URL, ensure the database is provisioned"
The `DATABASE_URL` environment variable is not set. Check your `.env` file.

### Tables not found / relation does not exist
Run `npm run db:push` to create the database schema.

### CoinGecko rate limiting (429 errors)
The free CoinGecko API allows ~10-30 requests/minute. The batch emissions endpoint uses a single bulk call to minimize this. If you see 429 errors, wait 1-2 minutes and retry.

### FRED API returns empty data
Verify your `FRED_API_KEY` is valid at https://fred.stlouisfed.org/docs/api/api_key.html

### AI research returns no data
Verify your `OPENAI_API_KEY` is valid and has available credits.
