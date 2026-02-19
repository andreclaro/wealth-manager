# My Wealth

Personal investment portfolio tracker built with Next.js.

## Features

- Track stocks, ETFs, crypto, real estate, cash, and more
- Real-time price updates via Finnhub & CoinGecko
- Multi-currency support (USD, EUR, GBP, CHF, JPY)
- Portfolio analytics and visualization
- CSV import for bulk data
- Bank Playground at `/bank-playground` for read-only provider connectivity tests

## Quick Start

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3005](http://localhost:3005)

## Environment Variables (Optional)

```bash
FINNHUB_API_KEY=       # For stock/ETF prices
COINGECKO_API_KEY=     # For crypto prices

# Bank Playground (read-only diagnostics)
TRADING212_API_KEY=
TRADING212_BASE_URL=https://live.trading212.com/api/v0
IBKR_BASE_URL=http://127.0.0.1:5000/v1/api
TIMEOUT_MS=15000
```

App works without API keys — enter prices manually.

## Bank Playground

Use `/bank-playground` to test official bank/broker connectivity in read-only mode.

- Trading 212: supported (official API, requires API key)
- Interactive Brokers: supported (requires Client Portal Gateway session)
- Revolut: partial (official Open Banking/Business APIs exist; retail holdings API is limited)
- Trade Republic: unsupported (no official public holdings API, use CSV import fallback)

No bank playground action writes to `Asset` or `PortfolioAccount`.

## License

MIT
