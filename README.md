# My Wealth

Personal investment portfolio tracker built with Next.js.

## Features

- Track stocks, ETFs, crypto, real estate, cash, and more
- Real-time price updates via Finnhub & CoinGecko
- Multi-currency support (USD, EUR, GBP, CHF, JPY)
- Portfolio analytics and visualization
- CSV import for bulk data

## Quick Start

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables (Optional)

```bash
FINNHUB_API_KEY=       # For stock/ETF prices
COINGECKO_API_KEY=     # For crypto prices
```

App works without API keys — enter prices manually.

## License

MIT
