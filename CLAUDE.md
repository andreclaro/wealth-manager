# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run lint         # Run ESLint

# Database
npx prisma migrate dev    # Create and apply a new migration
npx prisma db push        # Push schema changes without migration
npx prisma studio         # Open Prisma GUI
npx prisma generate       # Regenerate Prisma Client after schema changes
```

No test framework is configured.

## Architecture

Full-stack Next.js 16 app (App Router) with SQLite via Prisma + LibSQL adapter. All DB access is server-side through API routes.

### Data Flow

Client components (`"use client"`) call the internal `/api/*` routes which use Prisma to read/write `dev.db`. Price data is fetched server-side from external APIs (Finnhub, CoinGecko, ExchangeRate-API) via `lib/services/priceService.ts`.

### Key Directories

- `app/api/` — REST API routes (assets, accounts, portfolio, prices, backup)
- `components/` — Custom components (AssetCard, AssetForm, charts) + `ui/` shadcn/ui primitives
- `lib/services/priceService.ts` — All external price/exchange-rate fetching logic
- `lib/prisma.ts` — Prisma singleton with LibSQL adapter (uses absolute path to `dev.db`)
- `types/index.ts` — Shared interfaces and constants (ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, etc.)
- `prisma/schema.prisma` — DB schema: Asset, Account, PriceHistory, ExchangeRate, AppConfig models

### Asset Types

`STOCK`, `ETF`, `BOND`, `REAL_ESTATE`, `CRYPTO`, `CASH`, `SAVINGS`, `COMMODITY`, `OTHER`

Manual types (BOND, REAL_ESTATE, CASH, SAVINGS, COMMODITY, OTHER) skip price fetching — `priceService.fetchAssetPrice()` returns `null` for them.

### Price Fetching

`priceService.ts` routes by asset type:
- **STOCK/ETF**: Finnhub API first, fallback to Stooq for European ETFs (has hardcoded symbol mappings for 50+ European ETFs and stock aliases like `BRKB → BRK.B`)
- **CRYPTO**: CoinGecko API (hardcoded coin ID mappings for 50+ coins)
- **Exchange rates**: ExchangeRate-API with 1-hour in-memory cache and hardcoded fallback rates

### Multi-Currency

Assets and accounts each have a `currency` field (USD, EUR, GBP, CHF, JPY). The portfolio summary converts all values to EUR as the base display currency. `PriceHistory` snapshots store `price`, `quantity`, and `totalValue` with the asset's currency at the time of recording.

### Environment Variables

```
FINNHUB_API_KEY=       # Required for stock/ETF price fetching
COINGECKO_API_KEY=     # Optional, increases rate limits
EXCHANGERATE_API_KEY=  # Optional, for live exchange rates
```

App works without API keys via manual price entry (`isManualPrice: true` on an asset).

### Path Aliases

`@/*` maps to the project root — use `@/lib/...`, `@/components/...`, `@/types/...` etc.

### Styling

Tailwind CSS 4 with CSS-variable-based theming (configured in `globals.css`, not `tailwind.config`). Use the `cn()` utility from `@/lib/utils` for conditional class merging.
