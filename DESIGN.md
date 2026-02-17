# Investment Portfolio Service - Design Document

## Overview
A full-stack Next.js application for tracking investment portfolios across multiple asset classes with real-time price updates, historical tracking, and multi-currency support.

## Core Features

### 1. Asset Management
- **Asset Types**: Stocks, ETFs, Bonds, Real Estate, Cryptocurrency, Cash, Commodities, Other
- **Asset Properties**:
  - Name, Symbol/Ticker
  - Category/Type
  - Quantity/Amount held
  - Purchase price (optional, for cost basis tracking)
  - Current market price (auto-fetched)
  - Currency (USD, EUR, GBP, etc.)
  - Notes

### 2. Price Tracking
- **Stock/ETF Prices**: Finnhub API (free tier: 60 calls/minute)
- **Crypto Prices**: CoinGecko API (free tier: 10-50 calls/minute)
- **Manual Prices**: Real estate, private investments, cash
- **Automatic Updates**: Cron job or on-demand refresh

### 3. Multi-Currency Support
- Base currency selection (EUR by default)
- Exchange rates: ExchangeRate-API or similar
- Display values in USD and EUR simultaneously

### 4. Historical Tracking
- Every price update creates a history record
- Track portfolio value over time
- Performance analytics (daily, weekly, monthly, yearly)

### 5. Visualization
- Portfolio allocation pie chart (by category)
- Portfolio value over time line chart
- Asset performance bar chart
- Currency distribution

## Database Schema (Prisma)

```prisma
// Asset Types Enum
enum AssetType {
  STOCK
  ETF
  BOND
  REAL_ESTATE
  CRYPTO
  CASH
  COMMODITY
  OTHER
}

// Currency Enum
enum Currency {
  USD
  EUR
  GBP
  CHF
  JPY
}

// Asset Model
model Asset {
  id          String    @id @default(uuid())
  symbol      String    // Ticker symbol or identifier
  name        String
  type        AssetType
  quantity    Float
  purchasePrice Float?  // Optional cost basis
  currency    Currency  @default(EUR)
  currentPrice Float?
  priceUpdatedAt DateTime?
  notes       String?
  isManualPrice Boolean @default(false) // For real estate, private assets
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  priceHistory PriceHistory[]
}

// Price History Model
model PriceHistory {
  id        String   @id @default(uuid())
  assetId   String
  price     Float
  quantity  Float    // Snapshot of quantity at this time
  totalValue Float   // Calculated: price * quantity
  currency  Currency
  recordedAt DateTime @default(now())
  
  asset     Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  
  @@index([assetId, recordedAt])
}

// Exchange Rates Cache
model ExchangeRate {
  id        String   @id @default(uuid())
  fromCurrency Currency
  toCurrency  Currency
  rate      Float
  fetchedAt DateTime @default(now())
  
  @@unique([fromCurrency, toCurrency, fetchedAt])
}
```

## API Routes

### Assets
- `GET /api/assets` - List all assets
- `POST /api/assets` - Create new asset
- `GET /api/assets/:id` - Get asset details
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `POST /api/assets/:id/refresh` - Refresh price for asset

### Prices
- `POST /api/prices/refresh` - Refresh all prices
- `GET /api/prices/history/:assetId` - Get price history for asset

### Portfolio
- `GET /api/portfolio/summary` - Portfolio summary (total value, allocation)
- `GET /api/portfolio/history` - Portfolio value history over time

## Frontend Structure

```
app/
├── page.tsx                    # Dashboard
├── layout.tsx                  # Root layout
├── globals.css                 # Global styles
├── assets/
│   ├── page.tsx               # Assets list
│   ├── new/page.tsx           # Add new asset
│   └── [id]/edit/page.tsx     # Edit asset
├── api/                       # API routes
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── AssetForm.tsx          # Create/Edit asset form
│   ├── AssetCard.tsx          # Asset display card
│   ├── PortfolioChart.tsx     # Portfolio allocation chart
│   ├── PortfolioHistory.tsx   # Value over time chart
│   └── PriceDisplay.tsx       # Price with currency
├── lib/
│   ├── prisma.ts              # Database client
│   ├── api/                   # API utilities
│   └── utils.ts               # Helpers
└── types/
    └── index.ts               # TypeScript types
```

## Price Fetching Strategy

### Stock/ETF Prices (Finnhub)
```typescript
const fetchStockPrice = async (symbol: string) => {
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
  );
  const data = await response.json();
  return data.c; // Current price
};
```

### Crypto Prices (CoinGecko)
```typescript
const fetchCryptoPrice = async (id: string) => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,eur`
  );
  const data = await response.json();
  return data[id];
};
```

### Update Strategy
- Manual refresh button on each asset
- "Refresh All" button on dashboard
- Optional: Cron job for automatic updates (once per hour)

## Currency Conversion

Using ExchangeRate-API or storing rates in DB:
```typescript
const convertCurrency = (amount: number, from: Currency, to: Currency) => {
  if (from === to) return amount;
  const rate = getExchangeRate(from, to);
  return amount * rate;
};
```

## UI Components (shadcn/ui)

- **Data Table**: For asset list with sorting/filtering
- **Card**: Asset display cards
- **Dialog**: Add/Edit asset modals
- **Select**: Asset type, currency selection
- **Input**: Form fields
- **Button**: Actions
- **Chart**: Recharts for visualization
- **Tabs**: Different views (Dashboard, Assets, History)
- **Badge**: Asset type indicators
- **Skeleton**: Loading states

## Environment Variables

```bash
# Database
DATABASE_URL="file:./dev.db"

# APIs (optional - can work without for manual prices)
FINNHUB_API_KEY=""
COINGECKO_API_KEY="" # Optional, works without
EXCHANGE_RATE_API_KEY="" # Optional

# App
NEXT_PUBLIC_BASE_CURRENCY="EUR"
```

## Key Features to Implement

1. **Dashboard**:
   - Total portfolio value (USD + EUR)
   - Asset allocation pie chart
   - Recent performance indicator
   - Quick actions (Add asset, Refresh prices)

2. **Assets Page**:
   - Table view of all assets
   - Filter by type
   - Search functionality
   - Sort by value, name, type
   - Individual refresh buttons

3. **Asset Form**:
   - Symbol/name input
   - Type selector
   - Quantity input
   - Currency selector
   - Manual price toggle (for real estate)
   - Notes textarea

4. **History Page**:
   - Portfolio value over time chart
   - Individual asset performance
   - Date range selector

## Future Enhancements

- AI-powered portfolio analysis
- Goal setting and tracking
- Dividend tracking
- Tax reporting helpers
- Import/Export (CSV, PDF reports)
- Mobile app
- Real-time WebSocket updates
