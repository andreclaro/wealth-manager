# Crypto Wallet Auto-Retrieval Design Document

## Overview

This feature enables automatic retrieval and tracking of cryptocurrency assets from wallet addresses. Users can add their wallet addresses (EVM chains and Solana), and the system will automatically fetch all tokens, NFTs, and native balances, then track their values over time.

## Goals

1. **Zero-touch asset tracking**: Users add a wallet address, system discovers all assets automatically
2. **Multi-chain support**: EVM chains (Ethereum, Polygon, Arbitrum, Base, etc.) and Solana
3. **Real-time value tracking**: USD/EUR values updated automatically via price APIs
4. **Historical portfolio tracking**: Store balance snapshots over time
5. **DeFi position support**: Future support for staked tokens, LP positions, lending positions

---

## Supported Blockchains

### Phase 1 (MVP)
| Chain | Type | Chain ID / Network |
|-------|------|-------------------|
| Ethereum | EVM | 1 |
| Polygon | EVM | 137 |
| Arbitrum | EVM | 42161 |
| Base | EVM | 8453 |
| Solana | Native | mainnet |

### Phase 2
| Chain | Type | Chain ID / Network |
|-------|------|-------------------|
| Optimism | EVM | 10 |
| BNB Chain | EVM | 56 |
| Avalanche C-Chain | EVM | 43114 |

---

## API Selection

### EVM Chains: Moralis
**Why Moralis:**
- ✅ **Single API call returns balances + USD prices** (major time-saver)
- ✅ Built-in spam token detection
- ✅ Token logos and metadata included
- ✅ Cross-chain net worth calculation
- ✅ 40,000 CU/day free tier (~1,200 calls/day)

**API Key Required:** `MORALIS_API_KEY`

**Key Endpoints:**
```
GET /{address}/erc20 - Token balances with prices
GET /{address}/nft - NFT holdings
GET /wallets/{address}/networth - Cross-chain portfolio value
```

### Solana: Helius
**Why Helius:**
- ✅ **Single call for native SOL + all SPL tokens + prices**
- ✅ Built-in USD price data (hourly updated)
- ✅ Token metadata (symbol, name, logo, decimals)
- ✅ Staked SOL support via SDK
- ✅ 1M credits/month free tier

**API Key Required:** `HELIUS_API_KEY`

**Key Endpoints:**
```
GET /v1/wallet/{address}/balances - All balances with prices
GET /v0/addresses/?api-key={key} - Enhanced transactions
```

### Price Fallback: Jupiter (Solana)
- Free price API for Solana tokens
- Real-time prices from DEX liquidity
- Endpoint: `https://api.jup.ag/price/v2`

---

## Database Schema Updates

### New Model: CryptoWallet
```prisma
model CryptoWallet {
  id            String   @id @default(uuid())
  name          String   // User-defined name (e.g., "My Metamask")
  address       String   // Wallet address (0x... or ...solana)
  chain         Chain    // ETHEREUM, POLYGON, ARBITRUM, BASE, SOLANA
  chainId       String?  // For EVM chains (1, 137, 42161, etc.)
  
  // Sync settings
  syncEnabled   Boolean  @default(true)
  lastSyncedAt  DateTime?
  syncFrequency SyncFrequency @default(DAILY)
  
  // Metadata
  accountId     String   // References Account (the parent account)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  holdings      WalletHolding[]
  snapshots     WalletSnapshot[]
}

enum Chain {
  ETHEREUM
  POLYGON
  ARBITRUM
  BASE
  OPTIMISM
  BSC
  AVALANCHE
  SOLANA
}

enum SyncFrequency {
  HOURLY
  DAILY
  WEEKLY
}
```

### New Model: WalletHolding
```prisma
model WalletHolding {
  id              String   @id @default(uuid())
  walletId        String
  
  // Token info (fetched from API)
  contractAddress String   // Token contract (null for native token)
  symbol          String
  name            String
  decimals        Int      @default(18)
  logoUrl         String?
  
  // Balance info
  balance         String   // Raw balance (as string for precision)
  balanceFormatted Float   // Human-readable balance
  
  // Price info
  priceUsd        Float?
  priceEur        Float?
  valueUsd        Float?
  valueEur        Float?
  priceUpdatedAt  DateTime?
  
  // Metadata
  isNative        Boolean  @default(false)  // ETH, MATIC, SOL, etc.
  isNft           Boolean  @default(false)
  isSpam          Boolean  @default(false)
  
  wallet          CryptoWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  
  @@unique([walletId, contractAddress])
}
```

### New Model: WalletSnapshot
```prisma
model WalletSnapshot {
  id          String   @id @default(uuid())
  walletId    String
  
  // Snapshot data
  totalValueUsd Float
  totalValueEur Float
  holdings    Json     // Array of holding snapshots
  
  // Metadata
  recordedAt  DateTime @default(now())
  
  wallet      CryptoWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  
  @@index([walletId, recordedAt])
}
```

### Update Existing: Account
```prisma
model Account {
  // ... existing fields ...
  
  // Add relation to crypto wallets
  cryptoWallets CryptoWallet[]
}
```

---

## API Endpoints

### 1. Wallet Management

```typescript
// POST /api/crypto-wallets
// Create a new wallet connection
{
  "name": "My Metamask",
  "address": "0x1234...",
  "chain": "ETHEREUM",
  "accountId": "uuid-of-parent-account"
}

// GET /api/crypto-wallets
// List all connected wallets with current balances

// GET /api/crypto-wallets/:id
// Get wallet details with holdings

// PUT /api/crypto-wallets/:id
// Update wallet settings (name, sync frequency)

// DELETE /api/crypto-wallets/:id
// Remove wallet and all its data
```

### 2. Sync Operations

```typescript
// POST /api/crypto-wallets/:id/sync
// Trigger manual sync for a wallet
// Response: { syncedHoldings: 12, totalValueUsd: 1234.56 }

// POST /api/crypto-wallets/sync-all
// Trigger sync for all enabled wallets
```

### 3. Holdings

```typescript
// GET /api/crypto-wallets/:id/holdings
// Get current holdings with prices

// GET /api/crypto-wallets/:id/history?days=30
// Get wallet value history over time
```

---

## Services Architecture

### WalletSyncService
```typescript
class WalletSyncService {
  // Sync a single wallet
  async syncWallet(walletId: string): Promise<SyncResult>;
  
  // Sync all enabled wallets
  async syncAllWallets(): Promise<BatchSyncResult>;
  
  // Get wallet balances from external APIs
  private async fetchEvmBalances(address: string, chain: Chain): Promise<TokenBalance[]>;
  private async fetchSolanaBalances(address: string): Promise<TokenBalance[]>;
  
  // Convert external data to internal format
  private normalizeMoralisResponse(data: MoralisResponse): WalletHolding[];
  private normalizeHeliusResponse(data: HeliusResponse): WalletHolding[];
  
  // Store snapshot for historical tracking
  private createSnapshot(walletId: string, holdings: WalletHolding[]): Promise<void>;
}
```

### PriceService (Extension)
```typescript
// Extend existing priceService.ts
class PriceService {
  // Add crypto price fetching
  async getTokenPrice(contractAddress: string, chain: Chain): Promise<PriceData>;
  
  // Batch price update for wallet holdings
  async refreshWalletPrices(walletId: string): Promise<void>;
}
```

---

## UI Components

### 1. AddWalletDialog
- Chain selector (dropdown with icons)
- Address input with validation
- Wallet name input
- Account selector (which account to link to)
- Preview balance before saving

### 2. WalletCard
- Display wallet name, address (truncated), chain icon
- Total value (USD/EUR)
- Last synced time
- Quick sync button
- Expandable holdings list

### 3. WalletHoldingsTable
- Token icon, symbol, name
- Balance (formatted)
- Price (USD/EUR)
- Value (USD/EUR)
- 24h change indicator
- Spam token badge (with hide option)

### 4. WalletHistoryChart
- Portfolio value over time
- Filter by timeframe (7d, 30d, 90d, 1y, all)

---

## Sync Strategy

### Automatic Sync (Background)
- **Hourly**: For active wallets (> $1000 value)
- **Daily**: Default for all wallets
- **Weekly**: For manually set preference

### Implementation Options

**Option A: Vercel Cron Jobs** (Recommended for MVP)
```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-wallets",
      "schedule": "0 */6 * * *"  // Every 6 hours
    }
  ]
}
```

**Option B: Next.js Cron Route with External Scheduler**
- Use GitHub Actions, Railway cron, or similar
- HTTP POST to `/api/crypto-wallets/sync-all`

**Option C: Manual Sync Only**
- Users click sync button
- Simplest, no background jobs needed

### Sync Process
```
1. Fetch wallet from database
2. Call Moralis (EVM) or Helius (Solana) API
3. Filter out spam tokens (if flagged by API)
4. Update WalletHolding records (upsert)
5. Fetch latest prices for all tokens
6. Calculate total values
7. Create WalletSnapshot record
8. Update Asset records (link to main portfolio)
```

---

## Integration with Existing Assets

When a wallet is synced, discovered tokens should create/update `Asset` records:

```typescript
// Pseudocode for sync-to-asset mapping
for each holding in walletHoldings:
  if holding.valueUsd > MIN_VALUE_THRESHOLD (e.g., $1):
    asset = findOrCreateAsset({
      symbol: holding.symbol,
      type: holding.isNft ? 'NFT' : 'CRYPTO',
      walletHoldingId: holding.id,  // Link back
      quantity: holding.balanceFormatted,
      currentPrice: holding.priceUsd,
      currency: 'USD'
    })
    
    // Create price history entry
    createPriceHistory({
      assetId: asset.id,
      price: holding.priceUsd,
      totalValue: holding.valueUsd
    })
```

This ensures wallet assets appear in:
- Dashboard portfolio summary
- Analysis page
- Historical charts

---

## Environment Variables

```bash
# Required
MORALIS_API_KEY="your_moralis_api_key"    # For EVM chains
HELIUS_API_KEY="your_helius_api_key"      # For Solana

# Optional (fallbacks)
COINGECKO_API_KEY="your_coingecko_key"    # Price fallback
JUPITER_API_KEY=""                        # Usually not needed (free tier sufficient)
```

---

## Rate Limits & Caching

### API Rate Limits
| Provider | Free Tier | Our Usage |
|----------|-----------|-----------|
| Moralis | 40K CU/day | ~5 CU per wallet sync |
| Helius | 1M credits/mo | ~100 credits per wallet sync |

### Estimated Capacity
- Moralis: ~8,000 EVM wallet syncs/day
- Helius: ~10,000 Solana wallet syncs/day

### Caching Strategy
- **Token metadata**: Cache for 7 days (logos, names rarely change)
- **Prices**: Cache for 5 minutes (shared with existing price service)
- **Balances**: No cache (always fetch fresh)

---

## Security Considerations

1. **Address Validation**
   - EVM: Checksum validation for addresses
   - Solana: Base58 validation

2. **Rate Limiting**
   - Per-user sync limits (e.g., max 10 syncs/hour)
   - IP-based limits on sync endpoints

3. **Data Privacy**
   - Wallet addresses are sensitive (public but linkable)
   - Don't log full addresses in error messages

4. **API Key Protection**
   - Server-side only (Moralis/Helius keys)
   - Never expose to client

---

## Error Handling

### Common Error Scenarios

| Error | Cause | Action |
|-------|-------|--------|
| Invalid address | User typo | Return 400 with validation error |
| API rate limit | Too many requests | Queue for retry, notify user |
| Chain not supported | Wrong chain selected | Return 400 with supported chains |
| Empty wallet | New/empty address | Return empty holdings (not error) |
| Token price unavailable | Low liquidity token | Show balance, hide value |

---

## Implementation Phases

### Phase 1: MVP (Week 1-2)
- [ ] Database schema migration
- [ ] Moralis integration (Ethereum only)
- [ ] Basic wallet CRUD API
- [ ] Manual sync button
- [ ] Simple wallet card UI

### Phase 2: Multi-Chain (Week 3)
- [ ] Add Polygon, Arbitrum, Base support
- [ ] Helius integration (Solana)
- [ ] Chain selector UI

### Phase 3: Automation (Week 4)
- [ ] Cron job setup for auto-sync
- [ ] Sync frequency settings
- [ ] Wallet history charts

### Phase 4: Polish (Week 5)
- [ ] NFT support
- [ ] Spam token filtering UI
- [ ] DeFi positions (staked tokens)

---

## Appendix: API Response Examples

### Moralis Token Balances Response
```json
{
  "result": [
    {
      "token_address": "0xa0b86a33e6417a47ED70DD9D9DC51f677d80A485",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "balance": "1500000000",
      "balance_formatted": "1500.0",
      "usd_price": 1.00,
      "usd_value": 1500.00,
      "logo": "https://...",
      "possible_spam": false
    }
  ]
}
```

### Helius Wallet Balances Response
```json
{
  "nativeBalance": {
    "lamports": 1547263847,
    "sol": 1.547263847
  },
  "tokens": [
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "balance": 2500000000,
      "uiAmount": 2500.0,
      "priceUsd": 1.00,
      "valueUsd": 2500.00,
      "image": "https://..."
    }
  ]
}
```

---

## References

- Moralis Docs: https://docs.moralis.io/
- Helius Docs: https://docs.helius.dev/
- Jupiter Price API: https://station.jup.ag/docs/apis/price-api
- DAS API Spec: https://github.com/metaplex-foundation/digital-asset-standard-api

---

## Appendix B: FREE API Alternatives (No API Key Required)

If you want to avoid paid APIs entirely, here are **completely free** alternatives:

### Summary: Zero-Cost Options

| Use Case | Free API | API Key? | Rate Limit |
|----------|----------|----------|------------|
| EVM balances | **Pocket Network** | ❌ No | No hard limits |
| EVM token balances | **Blockscout API** | ❌ No | ~10 RPS |
| Solana balances | **Solana Public RPC** | ❌ No | 100/10 sec |
| Token prices | **CoinGecko** | ❌ No | 30/min |
| DEX prices | **DexScreener** | ❌ No | 60-300/min |

---

### EVM Chains: Pocket Network (FREE)

**Website**: https://api.pocket.network  
**Cost**: 100% FREE, no signup required  
**Chains**: 60+ including Ethereum, Polygon, Base, Arbitrum, Optimism

**Endpoints:**
```
Ethereum:  https://eth.api.pocket.network
Polygon:   https://poly.api.pocket.network
Base:      https://base.api.pocket.network
Arbitrum:  https://arb-one.api.pocket.network
Optimism:  https://op.api.pocket.network
```

**Code Example:**
```typescript
async function getEthBalance(address: string): Promise<number> {
  const response = await fetch('https://eth.api.pocket.network', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1
    })
  });
  
  const data = await response.json();
  const balanceInWei = parseInt(data.result, 16);
  return balanceInWei / 1e18; // Convert to ETH
}
```

**Limitations:**
- Returns only native token (ETH, MATIC) balance
- Token balances require additional calls
- No built-in USD prices

---

### EVM Token Balances: Blockscout API (FREE)

**Website**: https://docs.blockscout.com/devs/apis  
**Cost**: 100% FREE, no API key  
**Chains**: 200+ chains including Ethereum, Base, Optimism, Gnosis, Polygon

**Endpoints:**
```
https://eth.blockscout.com/api?module=account&action=balance&address={address}
https://eth.blockscout.com/api/v2/addresses/{address}/tokens
```

**Code Example:**
```typescript
async function getTokenBalances(address: string) {
  const response = await fetch(
    `https://eth.blockscout.com/api/v2/addresses/${address}/tokens`
  );
  return await response.json();
  // Returns: token symbols, balances, contract addresses
}
```

---

### Solana: Public RPC (FREE)

**Endpoint**: `https://api.mainnet.solana.com`  
**Cost**: 100% FREE, no signup  
**Rate Limit**: 100 requests per 10 seconds per IP

**Code Example:**
```typescript
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet.solana.com');

async function getSolanaWalletData(walletAddress: string) {
  const publicKey = new PublicKey(walletAddress);
  
  // Get SOL balance
  const solBalance = await connection.getBalance(publicKey);
  
  // Get SPL tokens
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );
  
  return {
    sol: solBalance / 1e9,
    tokens: tokenAccounts.value.map(acc => ({
      mint: acc.account.data.parsed.info.mint,
      amount: acc.account.data.parsed.info.tokenAmount.uiAmount
    }))
  };
}
```

---

### Token Prices: CoinGecko (FREE)

**Website**: https://www.coingecko.com/en/api  
**Cost**: FREE tier requires NO API key  
**Rate Limit**: ~30 calls/minute

**Endpoint:**
```
https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd
```

**Code Example:**
```typescript
async function getPrices(coinIds: string[]) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`
  );
  return await response.json();
  // Returns: { ethereum: { usd: 3500.50 }, bitcoin: { usd: 65000.00 } }
}
```

---

### Token Prices: DexScreener (FREE)

**Website**: https://docs.dexscreener.com/  
**Cost**: 100% FREE, no API key  
**Rate Limit**: 60-300 requests/minute

**Best for**: Real-time DEX prices across 80+ chains

**Endpoint:**
```
https://api.dexscreener.com/token-pairs/v1/{chainId}/{tokenAddress}
```

**Code Example:**
```typescript
async function getTokenPrice(chainId: string, tokenAddress: string) {
  const response = await fetch(
    `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`
  );
  const data = await response.json();
  return data.pairs?.[0]?.priceUsd;
}

// Usage:
// getTokenPrice('solana', 'So11111111111111111111111111111111111111112') // SOL price
// getTokenPrice('ethereum', '0xA0b86a33E6417a47ED70dD9D9DC51f677d80A485') // Token price
```

---

### Comparison: Paid vs Free APIs

| Feature | Paid (Moralis/Helius) | Free (Pocket/Blockscout/Public RPC) |
|---------|----------------------|-------------------------------------|
| **Cost** | Free tier limited | Completely free |
| **API Key** | Required | Not required |
| **Token Balances** | ✅ Single call | ❌ Multiple calls needed |
| **USD Prices** | ✅ Included | ❌ Separate API call |
| **Token Metadata** | ✅ Logos, symbols | ❌ Limited |
| **Rate Limits** | Higher | Lower |
| **Spam Filtering** | ✅ Built-in | ❌ Manual |
| **Reliability** | 99.99% uptime | Best effort |
| **Setup Complexity** | Low | Higher |

---

### Recommendation for Free-Only Setup

If you want **zero cost, no API keys:**

```typescript
// Free-only architecture
class FreeCryptoWalletService {
  private readonly endpoints = {
    ethereum: 'https://eth.api.pocket.network',
    polygon: 'https://poly.api.pocket.network',
    base: 'https://base.api.pocket.network',
    solana: 'https://api.mainnet.solana.com'
  };

  // 1. Get native balances via RPC
  async getNativeBalance(address: string, chain: string) {
    // Use Pocket Network RPC
  }

  // 2. Get token balances via Blockscout
  async getTokenBalances(address: string, chain: string) {
    // Use Blockscout API v2
  }

  // 3. Get prices via CoinGecko or DexScreener
  async getTokenPrices(tokenIds: string[]) {
    // Use CoinGecko (free) or DexScreener (free)
  }
}
```

**Trade-offs:**
- ✅ Zero cost, no signup
- ✅ No API key management
- ❌ More development work (multiple API calls)
- ❌ Lower rate limits
- ❌ No spam token filtering
- ❌ No customer support

---

### Final Recommendation

| Budget | Recommended Approach |
|--------|---------------------|
| **$0 (absolutely free)** | Use Pocket Network + Blockscout + CoinGecko |
| **Free tier okay** | Use Moralis (40K CU/day) + Helius (1M credits/mo) |
| **Production app** | Paid plans for reliability and support |

For a personal portfolio tracker or small app, the **completely free** option works well. For a production app with many users, consider the free tiers of Moralis/Helius for better reliability.
