# Kozo Data API — Dataset Specification

This document catalogs all persistent cached datasets stored in Kozo's PostgreSQL database. These datasets are designed for internal platform efficiency today, and as the foundation for a future public data API offering.

## Dataset Overview

| Dataset | Table | Key | TTL | Source | Records |
|---------|-------|-----|-----|--------|---------|
| CoinGecko Market Data | `coingecko_market_cache` | `coingecko_id` | 15 min | CoinGecko API | Per-token |
| DefiLlama Protocol Data | `defillama_cache` | `protocol_id` + `metric_type` | 1 hour | DefiLlama API | Per-protocol per-metric |
| AI Token Research | `ai_research_cache` | `coingecko_id` + `research_type` | Permanent | OpenAI gpt-4o-mini | Per-token per-type |
| Emissions Analysis | `emissions_cache` | `coingecko_id` | Permanent | Computed (AI + market data) | Per-token |

---

## 1. CoinGecko Market Data Cache

**Table**: `coingecko_market_cache`

**Purpose**: Stores live market data for crypto tokens, reducing CoinGecko API calls across all users. When any user looks up a token, subsequent requests within 15 minutes are served from cache.

**Schema**:
| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `coingecko_id` | text (unique) | CoinGecko token identifier (e.g., `bitcoin`, `ethereum`) |
| `data` | jsonb | Full market data object |
| `fetched_at` | timestamp | When data was last fetched from CoinGecko |

**Data Shape** (`data` column):
```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "image": "https://...",
  "current_price": 97500.00,
  "market_cap": 1930000000000,
  "fully_diluted_valuation": 2050000000000,
  "total_volume": 45000000000,
  "price_change_percentage_24h": 2.45,
  "price_change_percentage_7d_in_currency": -1.2,
  "circulating_supply": 19800000,
  "total_supply": 21000000,
  "max_supply": 21000000,
  "ath": 108000,
  "ath_date": "2025-01-20T...",
  "sparkline_in_7d": { "price": [96000, 97000, ...] }
}
```

**Refresh Policy**: 15-minute TTL. Stale entries are refreshed on next request.

**Future API Endpoint**:
```
GET /api/v1/market-data/:coingeckoId
GET /api/v1/market-data?ids=bitcoin,ethereum,solana
```

---

## 2. DefiLlama Protocol Data Cache

**Table**: `defillama_cache`

**Purpose**: Stores DeFi protocol metrics (TVL history, fee history, revenue history) to avoid redundant DefiLlama API calls. Once any user fetches protocol data, all users benefit from the cache for 1 hour.

**Schema**:
| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `protocol_id` | text | DefiLlama protocol slug (e.g., `aave`, `lido`) |
| `metric_type` | text | One of: `tvl`, `fees`, `revenue` |
| `data` | jsonb | Array of time-series data points |
| `fetched_at` | timestamp | When data was last fetched from DefiLlama |

**Data Shapes** (`data` column by `metric_type`):

**TVL** (`metric_type = "tvl"`):
```json
[
  { "date": "2025-01-01", "tvl": 12500000000 },
  { "date": "2025-01-02", "tvl": 12600000000 }
]
```

**Fees** (`metric_type = "fees"`):
```json
[
  { "date": "2025-01-01", "dailyFees": 2500000, "dailyRevenue": 750000 },
  { "date": "2025-01-02", "dailyFees": 2600000, "dailyRevenue": 780000 }
]
```

**Revenue** (`metric_type = "revenue"`):
```json
[
  { "date": "2025-01-01", "dailyRevenue": 750000 },
  { "date": "2025-01-02", "dailyRevenue": 780000 }
]
```

**Refresh Policy**: 1-hour TTL. Stale entries are refreshed on next request. Stores up to 365 days of history per protocol per metric.

**Future API Endpoints**:
```
GET /api/v1/defi/:protocolSlug/tvl
GET /api/v1/defi/:protocolSlug/fees
GET /api/v1/defi/:protocolSlug/revenue
```

---

## 3. AI Token Research Cache

**Table**: `ai_research_cache`

**Purpose**: Stores AI-researched token data globally so that once a token's allocations, fundraising rounds, or supply schedule has been researched, all subsequent users (and the emissions engine) get instant results without an AI call. This is the primary dataset-building mechanism.

**Schema**:
| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `coingecko_id` | text | CoinGecko token identifier |
| `research_type` | text | One of: `allocations`, `fundraising`, `supply_schedule` |
| `data` | jsonb | Structured research output |
| `confidence` | text | AI confidence level: `high`, `medium`, `low` |
| `notes` | text | AI research notes/caveats |
| `researched_at` | timestamp | When research was performed |

**Data Shapes** (`data` column by `research_type`):

**Allocations** (`research_type = "allocations"`):
```json
{
  "allocations": [
    {
      "category": "Team & Advisors",
      "standardGroup": "team",
      "percentage": 20,
      "vestingType": "linear",
      "cliffMonths": 12,
      "vestingMonths": 48,
      "tgePercent": 0
    },
    {
      "category": "Community & Ecosystem",
      "standardGroup": "community",
      "percentage": 40,
      "vestingType": "linear",
      "cliffMonths": 0,
      "vestingMonths": 60,
      "tgePercent": 10
    }
  ],
  "confidence": "high",
  "notes": "Based on official tokenomics documentation"
}
```

**Fundraising** (`research_type = "fundraising"`):
```json
{
  "rounds": [
    {
      "roundName": "Seed",
      "date": "2021-06",
      "amountRaised": 5000000,
      "valuation": 50000000,
      "leadInvestor": "a16z",
      "tokenPercent": 10,
      "pricePerToken": 0.50
    }
  ],
  "confidence": "medium",
  "notes": "Compiled from public announcements"
}
```

**Supply Schedule** (`research_type = "supply_schedule"`):
```json
{
  "events": [
    {
      "eventType": "tge",
      "label": "Token Generation Event",
      "date": "2024-01-15",
      "amount": 1000000000
    },
    {
      "eventType": "cliff_unlock",
      "label": "Team Cliff Unlock",
      "date": "2025-01-15",
      "amount": 200000000
    }
  ],
  "confidence": "high",
  "notes": "Based on official vesting schedule"
}
```

**Refresh Policy**: Permanent (no TTL). Research results persist indefinitely. Can be manually refreshed by admin.

**Data Integrity Rules**:
- Cache is keyed by `coingecko_id` — requires non-empty value to prevent key collisions
- Only stores platform-derived data (when `hasDataSources = false`) — user-provided data sources are never cached to prevent data leakage
- AI-sourced data is stored separately from user-entered data

**Cross-Module Usage**:
- **Tokenomics Modeler**: Checks cache before AI research for allocations, fundraising, supply schedules
- **Emissions Engine**: Checks cache before calling `researchAllocationsWithAI`, writes results back for tokenomics module to reuse

**Future API Endpoints**:
```
GET /api/v1/research/:coingeckoId/allocations
GET /api/v1/research/:coingeckoId/fundraising
GET /api/v1/research/:coingeckoId/supply-schedule
GET /api/v1/research/:coingeckoId (all research types)
```

---

## 4. Emissions Analysis Cache

**Table**: `emissions_cache`

**Purpose**: Stores fully computed token emission schedules, including 60-month time series of supply unlock projections, inflation rates, and cliff events. This is the most complex computed dataset, combining AI research data with market data.

**Schema**:
| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `coingecko_id` | text (unique) | CoinGecko token identifier |
| `category` | text | Token category (DeFi, L1, L2, etc.) |
| `data` | jsonb | Full emissions analysis object |
| `updated_at` | timestamp | When analysis was last computed |

**Data Shape** (`data` column):
```json
{
  "token": {
    "name": "Uniswap",
    "symbol": "UNI",
    "coingeckoId": "uniswap",
    "totalSupply": 1000000000,
    "circulatingSupply": 600000000,
    "maxSupply": 1000000000,
    "currentPrice": 6.50,
    "marketCap": 3900000000,
    "image": "https://..."
  },
  "months": ["2022-09", "2022-10", ...],
  "allocations": [
    {
      "category": "Team & Advisors",
      "standardGroup": "team",
      "percentage": 21.27,
      "totalTokens": 212700000,
      "vestingType": "linear",
      "cliffMonths": 12,
      "vestingMonths": 48,
      "tgePercent": 0,
      "monthlyValues": [0, 0, ..., 212700000]
    }
  ],
  "totalSupplyTimeSeries": [100000000, 115000000, ...],
  "inflationRate": [0, 15.0, 12.0, ...],
  "cliffEvents": [
    { "month": "2023-09", "label": "Team Cliff Unlock", "amount": 53175000 }
  ],
  "confidence": "high",
  "notes": "Based on official governance documentation"
}
```

**Refresh Policy**: Permanent for allocation structure. Market data (price, market cap) is refreshed on read from CoinGecko cache.

**Future API Endpoints**:
```
GET /api/v1/emissions/:coingeckoId
GET /api/v1/emissions/batch?ids=uniswap,aave,lido
GET /api/v1/emissions/market-summary?category=DeFi
GET /api/v1/emissions/compare?ids=uniswap,aave&metric=inflation
```

---

## Additional Cached Data (Per-Project, Not Global)

These are cached on individual crypto project records rather than in shared tables:

| Field | Location | TTL | Source |
|-------|----------|-----|--------|
| `cachedOnchainData` | `crypto_projects.cached_onchain_data` | Manual refresh | Thirdweb Insight API |
| `cachedDefiData` | `crypto_projects.cached_defi_data` | Manual refresh | DefiLlama API |

---

## Future API Architecture

### Authentication
- API keys issued per subscription tier
- Rate limiting per key (Free: 100/day, Pro: 10k/day, Enterprise: unlimited)
- JWT bearer tokens for authenticated endpoints

### Response Format
```json
{
  "data": { ... },
  "meta": {
    "cached": true,
    "cachedAt": "2025-02-20T12:00:00Z",
    "ttlSeconds": 900,
    "source": "coingecko"
  }
}
```

### Planned API Tiers
| Tier | Price | Rate Limit | Datasets |
|------|-------|------------|----------|
| Free | $0 | 100 req/day | Market data (delayed) |
| Pro | $49/mo | 10k req/day | All datasets, real-time |
| Enterprise | Custom | Unlimited | All datasets + webhooks + bulk export |

### Planned Endpoints Summary
```
# Market Data
GET /api/v1/market-data/:coingeckoId
GET /api/v1/market-data?ids=...

# DeFi Protocol Data
GET /api/v1/defi/:slug/tvl
GET /api/v1/defi/:slug/fees
GET /api/v1/defi/:slug/revenue

# Token Research
GET /api/v1/research/:coingeckoId/allocations
GET /api/v1/research/:coingeckoId/fundraising
GET /api/v1/research/:coingeckoId/supply-schedule

# Emissions Analysis
GET /api/v1/emissions/:coingeckoId
GET /api/v1/emissions/batch?ids=...
GET /api/v1/emissions/market-summary
GET /api/v1/emissions/compare

# Bulk Export (Enterprise)
GET /api/v1/export/market-data?format=csv
GET /api/v1/export/emissions?format=csv
```
