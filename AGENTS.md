# Investment Portfolio Service

## Project Overview

A full-stack Next.js application for tracking investment portfolios across multiple asset classes with real-time price updates, historical tracking, and multi-currency support.

**Location**: `/Users/andreclaro/Code/invest-portfolio`

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with CSS-based configuration
- **UI Components**: shadcn/ui (New York style)
- **Database**: SQLite with Prisma ORM 7.4.0
- **Database Adapter**: better-sqlite3
- **Charts**: Recharts
- **Icons**: Lucide React
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns

## Project Structure

```
/Users/andreclaro/Code/invest-portfolio/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Marketing pages (landing, login)
│   │   ├── layout.tsx            # Marketing layout
│   │   ├── page.tsx              # Landing page (root /)
│   │   └── login/
│   │       └── page.tsx          # Login page
│   ├── app/                      # Application pages (require login)
│   │   ├── layout.tsx            # App layout with auth check
│   │   ├── page.tsx              # Dashboard page
│   │   ├── assets/
│   │   │   ├── page.tsx          # Assets list page
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   │           └── page.tsx  # Edit asset page
│   │   ├── accounts/
│   │   │   └── page.tsx          # Accounts page
│   │   ├── analysis/
│   │   │   └── page.tsx          # Portfolio analysis page
│   │   └── profile/
│   │       └── page.tsx          # User profile page
│   ├── api/                      # API routes
│   │   ├── assets/               # Asset CRUD endpoints
│   │   ├── accounts/             # Account CRUD endpoints
│   │   ├── portfolio/            # Portfolio summary/history
│   │   ├── prices/               # Price refresh
│   │   └── analysis/             # Portfolio analysis
│   └── globals.css               # Global styles with Tailwind v4
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── AssetCard.tsx             # Asset display card with actions
│   ├── AssetForm.tsx             # Create/Edit asset form
│   ├── PortfolioChart.tsx        # Portfolio allocation pie chart
│   ├── PortfolioHistory.tsx      # Portfolio value over time line chart
│   ├── AssetHistory.tsx          # Individual asset price history chart and table
│   ├── CSVImportDialog.tsx       # CSV import with preview
│   └── TemplateImportDialog.tsx  # Quick start templates UI
├── lib/
│   ├── prisma.ts                 # Database client configuration
│   ├── services/
│   │   └── priceService.ts       # Price fetching and currency conversion
│   └── utils.ts                  # Utility functions (cn helper)
├── types/
│   └── index.ts                  # TypeScript types and constants
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── config.ts                 # Prisma configuration
├── public/                       # Static assets
├── .env                          # Environment variables (optional API keys)
├── components.json               # shadcn/ui configuration
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
└── postcss.config.mjs            # PostCSS configuration
```

## Database Schema (Prisma)

### User Model
```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts Account[]
}
```

### Account Model
```prisma
model Account {
  id        String   @id @default(uuid())
  name      String   // e.g., "Chase Checking", "ING Savings"
  type      String?  // e.g., "Bank", "Broker", "Crypto Wallet"
  currency  Currency @default(EUR)
  notes     String?
  userId    String   // References User
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assets Asset[]
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Asset Model
```prisma
model Asset {
  id             String    @id @default(uuid())
  symbol         String    // Asset symbol/ticker
  name           String    // Asset name
  type           AssetType // STOCK, ETF, BOND, REAL_ESTATE, CRYPTO, CASH, SAVINGS, COMMODITY, OTHER
  quantity       Float     // Number of units/shares
  purchasePrice  Float?    // Optional cost basis
  currency       Currency  @default(EUR) // USD, EUR, GBP, CHF, JPY
  currentPrice   Float?    // Current market price
  priceUpdatedAt DateTime? // Last price update timestamp
  notes          String?   // Optional notes
  isManualPrice  Boolean   @default(false) // Flag for manual price entry
  accountId      String    // References Account
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  priceHistory PriceHistory[]
  account      Account    @relation(fields: [accountId], references: [id], onDelete: Restrict)
}
```

### PriceHistory Model
```prisma
model PriceHistory {
  id         String   @id @default(uuid())
  assetId    String
  price      Float    // Price at this point in time
  quantity   Float    // Quantity snapshot
  totalValue Float    // Calculated: price * quantity
  currency   Currency
  recordedAt DateTime @default(now())

  asset Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)
}
```

### ExchangeRate Model
```prisma
model ExchangeRate {
  id           String   @id @default(uuid())
  fromCurrency Currency
  toCurrency   Currency
  rate         Float
  fetchedAt    DateTime @default(now())
}
```

### AppConfig Model
```prisma
model AppConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt
}
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all assets with calculated values (USD/EUR) |
| POST | `/api/assets` | Create new asset, auto-fetches price if not manual |
| GET | `/api/assets/:id` | Get asset details with price history |
| PUT | `/api/assets/:id` | Update asset, records history on price/quantity change |
| DELETE | `/api/assets/:id` | Delete asset and its history |
| POST | `/api/assets/:id/refresh` | Refresh asset price (skips if manual) |
| GET | `/api/assets/lookup?symbol=X&type=Y` | Lookup asset name from external API |
| GET | `/api/accounts` | List all accounts with calculated totals |
| POST | `/api/accounts` | Create new account |
| GET | `/api/accounts/:id` | Get account details with assets |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account (if empty) |
| GET | `/api/portfolio/summary` | Get portfolio totals and breakdowns |
| GET | `/api/portfolio/history?days=30` | Get portfolio value history |
| POST | `/api/prices/refresh` | Refresh all non-manual asset prices |
| GET | `/api/analysis` | Get portfolio analysis (P&L, allocation, risk metrics) |
| POST | `/api/import/csv` | Import accounts and assets from CSV (with preview mode) |
| GET | `/api/import/template` | List available quick-start templates |
| POST | `/api/import/template` | Apply a template to create account + assets |

## CSV Import Format

Required columns: `account, symbol, assetType, quantity, currency`
Optional columns: `name, price, accountType`

Example:
```csv
account,symbol,name,assetType,quantity,price,currency
"Interactive Brokers",AAPL,"Apple Inc.",STOCK,10,,USD
"Coinbase",BTC,Bitcoin,CRYPTO,0.5,,USD
"ING Bank",EUR,"Cash - EUR",CASH,5000,1,EUR
```

## Quick Templates

Available templates:
- **US Stock Investor**: AAPL, MSFT, GOOGL, AMZN, VOO, VTI
- **Crypto Hodler**: BTC, ETH, SOL
- **European Saver**: EUR Cash, VWCE, EXSA
- **All-in-One**: VTI, VXUS, BND, BTC, USD Cash
- **Dividend Growth**: JNJ, PG, KO, VYM, SCHD
- **Tech Focused**: NVDA, TSLA, META, NFLX, QQQ

## Price Fetching Services

### Stock/ETF Prices (Finnhub)
- Endpoint: `https://finnhub.io/api/v1/quote?symbol={SYMBOL}&token={API_KEY}`
- Rate limit: 60 calls/minute (free tier)
- Requires `FINNHUB_API_KEY` environment variable

### Crypto Prices (CoinGecko)
- Endpoint: `https://api.coingecko.com/api/v3/simple/price`
- Supports 50+ cryptocurrencies via symbol mapping
- Rate limit: 10-50 calls/minute (free tier)
- Optional `COINGECKO_API_KEY` for higher limits

### Exchange Rates (ExchangeRate-API)
- Endpoint: `https://api.exchangerate-api.com/v4/latest/{CURRENCY}`
- Fallback rates available if API fails
- 1-hour in-memory cache

### Supported Asset Types for Auto-Fetch
- **STOCK, ETF**: Finnhub API
- **CRYPTO**: CoinGecko API (50+ supported symbols)
- **BOND, REAL_ESTATE, CASH, SAVINGS, COMMODITY, OTHER**: Manual price entry only

## Build and Run Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Linting
npm run lint

# Database
npx prisma migrate dev      # Create and apply migrations
npx prisma db push          # Push schema changes
npx prisma studio           # Open Prisma Studio GUI
npx prisma generate         # Generate Prisma Client
```

## Environment Variables

Create `.env` file in project root:

```bash
# Optional: API keys for auto price fetching
# FINNHUB_API_KEY="your_finnhub_api_key"
# COINGECKO_API_KEY="your_coingecko_api_key"
```

**Note**: The app works without API keys - you can manually enter prices for all assets.

## Key Features

### Asset Management
- Track multiple asset types: Stocks, ETFs, Bonds, Real Estate, Cryptocurrency, Cash, Commodities
- Quantity and purchase price tracking for cost basis
- Manual price flag for non-marketable assets
- Notes for additional information
- **CSV Import**: Bulk import accounts and assets from CSV files with preview
- **Quick Templates**: One-click portfolio setups (US Stocks, Crypto, European Saver, etc.)

### Multi-Currency Support
- Base currencies: USD, EUR, GBP, CHF, JPY
- Automatic currency conversion for portfolio totals
- Display values in both USD and EUR simultaneously
- Exchange rate caching for performance

### Historical Tracking
- Every price update creates a history record
- Portfolio value tracking over time
- 30-day default history view on dashboard
- Tracks quantity changes alongside price changes

### Visualization
- Portfolio allocation pie chart (by asset type)
- Portfolio value over time line chart
- Asset cards with gain/loss indicators
- List and grid view for assets
- Color-coded asset type badges

### Analysis & Insights
- **Analysis Page** (`/analysis`): Comprehensive portfolio analytics including:
  - Portfolio performance summary (invested, current value, P&L, return %)
  - Asset allocation breakdowns (by type, currency, account)
  - Individual asset performance with unrealized gains/losses
  - Top performers and assets needing attention
  - Risk metrics (diversification score, top holdings, currency exposure)
  - AI Insights section (placeholder for future AI features)

## Development Guidelines

### Code Style
- TypeScript with strict mode enabled
- React Server Components by default
- Client components marked with `"use client"`
- Tailwind CSS for styling
- shadcn/ui component patterns

### File Naming Conventions
- Components: PascalCase (e.g., `AssetCard.tsx`)
- Utilities: camelCase (e.g., `priceService.ts`)
- API routes: `route.ts` in directory structure
- Pages: `page.tsx` in route directories

### Path Aliases
- `@/*` maps to project root
- Used for imports: `@/components/ui/button`, `@/lib/prisma`

### State Management
- React useState for local component state
- SWR/fetch pattern for server data
- No global state library needed

### Error Handling
- API routes return JSON with error messages and appropriate HTTP status codes
- Client components handle errors with try/catch and console.error
- Graceful degradation when external APIs are unavailable

## Testing Strategy

Currently, the project does not include automated tests. Recommended approach:
- Unit tests for `lib/services/priceService.ts`
- Integration tests for API routes
- E2E tests for critical user flows (adding asset, refreshing prices)

## Security Considerations

- API keys are server-side only (referenced in server routes)
- No authentication/authorization implemented (single-user local app)
- SQLite database file (`dev.db`) is git-ignored by default
- Input validation via Zod schemas on forms

## Multi-User Architecture

The application supports multiple users with data isolation:

- **User** → **Account** → **Asset** hierarchy
- Each user can only access their own accounts and assets
- API routes filter data by the current user
- Development mode uses localStorage to persist logged-in user

### Route Structure

**Marketing Routes** (public):
- `/` - Landing page with product info
- `/login` - Login page (any email accepted in dev mode)

**App Routes** (require login):
- `/app` - Dashboard
- `/app/assets` - Asset management
- `/app/assets/[id]/edit` - Edit asset
- `/app/accounts` - Account management
- `/app/analysis` - Portfolio analysis
- `/app/profile` - User profile

### Authentication (Development)

Currently using localStorage-based auth:
- `lib/auth.ts` exports:
  - `getCurrentUserId()` - returns stored or dev user ID
  - `setLoggedInUser(email)` - stores user in localStorage
  - `isLoggedIn()` - checks if user is authenticated
  - `logout()` - clears stored user
- Any email works for login (password ignored)
- Future: integrate NextAuth.js or similar for real authentication
- Run `npx ts-node prisma/seed.ts` to create the default dev user

## Known Limitations

- Free API tiers have rate limits (Finnhub: 60/min, CoinGecko: 10-50/min)
- Stock prices are fetched in USD and converted
- Historical data starts from when assets are added
- Authentication is mocked (dev user only)
- No automated price refresh scheduling

## Usage

1. Start the development server: `npm run dev`
2. Open http://localhost:3000
3. Add assets using the "Add Asset" button
4. For stocks/ETFs: Enter symbol (e.g., AAPL, MSFT) and prices will auto-fetch
5. For crypto: Enter symbol (e.g., BTC, ETH) and prices will auto-fetch
6. For real estate, cash, bonds: Enter manual prices
7. View portfolio allocation and history on the dashboard
