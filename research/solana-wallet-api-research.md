# Solana Wallet Balance & Token Holdings APIs - Research Report

**Date:** February 19, 2026  
**Purpose:** Compare APIs for fetching Solana wallet balances, SPL tokens, token metadata, and USD prices

---

## Executive Summary

For fetching Solana wallet balances and token holdings, **Helius** emerges as the best overall option with its purpose-built Wallet API that returns enriched data including USD prices, token metadata, and logos in a single request. For price data specifically, **Jupiter Price API V3** (free tier available) is the gold standard. For a budget-conscious approach, combining **QuickNode** (free RPC tier) with **Jupiter Price API** provides excellent value.

---

## 1. Helius (Recommended)

### Overview
Helius is a Solana-native infrastructure provider offering the most developer-friendly APIs for wallet data.

### Pricing

| Plan | Price | Monthly Credits | RPC Rate Limit | DAS API Rate |
|------|-------|-----------------|----------------|--------------|
| **Free** | $0/month | 1M credits | 10 req/s | 2 req/s |
| Developer | $49/month | 10M credits | 50 req/s | 10 req/s |
| Business | $499/month | 100M credits | 200 req/s | 50 req/s |
| Professional | $999/month | 200M credits | 500 req/s | 100 req/s |

### Key Features
- **Wallet Balances API**: Returns all tokens + NFTs with USD values, metadata, and logos in ONE call
- **Native SOL + SPL Tokens**: Handles both native SOL and all SPL tokens automatically
- **Token-2022 Support**: Full support for the new Token-2022 program
- **USD Pricing**: Hourly-updated prices for major tokens
- **Pagination**: Up to 100 tokens per page, sorted by USD value
- **Staking Support**: Dedicated methods for stake account management

### API Endpoints

#### Wallet Balances (Recommended)
```
GET https://api.helius.xyz/v1/wallet/{address}/balances?api-key={API_KEY}
```

**Features:**
- Returns tokens + NFTs in one call
- Includes: symbol, name, decimals, balance, pricePerToken, usdValue, logoUri
- Sorted by USD value (highest first)
- 100 credits per request

#### DAS API - Get Assets By Owner
```
POST https://mainnet.helius-rpc.com/?api-key={API_KEY}
```

### Code Examples

#### TypeScript/JavaScript (Using SDK)
```bash
npm install helius-sdk
```

```typescript
import { createHelius } from "helius-sdk";

const helius = createHelius({ apiKey: "YOUR_API_KEY" });

// Get wallet balances with USD values
const getWalletBalances = async (address: string) => {
  const url = `https://api.helius.xyz/v1/wallet/${address}/balances?api-key=${process.env.HELIUS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  // SOL is always first when showNative=true (default)
  const solBalance = data.balances[0];
  console.log(`SOL: ${solBalance.balance} ($${solBalance.usdValue})`);
  
  // All other tokens sorted by USD value
  data.balances.slice(1).forEach(token => {
    console.log(`${token.symbol}: ${token.balance} ($${token.usdValue || 'N/A'})`);
  });
  
  console.log(`Total Value: $${data.totalUsdValue}`);
  return data;
};

// Using DAS API for more control
const getAssetsByOwner = async (ownerAddress: string) => {
  const assets = await helius.getAssetsByOwner({
    ownerAddress,
    page: 1,
    limit: 100,
    options: {
      showFungible: true,
      showNativeBalance: true,
    }
  });
  return assets;
};

// Get staked SOL accounts
const getStakedAccounts = async (ownerAddress: string) => {
  const stakeAccounts = await helius.rpc.getHeliusStakeAccounts(ownerAddress);
  return stakeAccounts;
};
```

#### Response Format (Wallet Balances)
```json
{
  "balances": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "name": "Solana",
      "balance": 1.5,
      "decimals": 9,
      "pricePerToken": 145.32,
      "usdValue": 217.98,
      "logoUri": "https://.../sol-logo.png",
      "tokenProgram": "spl-token"
    },
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": 1000.5,
      "decimals": 6,
      "pricePerToken": 1.0,
      "usdValue": 1000.5,
      "logoUri": "https://.../usdc-logo.png",
      "tokenProgram": "spl-token"
    }
  ],
  "totalUsdValue": 1218.48,
  "pagination": {
    "page": 1,
    "limit": 100,
    "hasMore": false
  }
}
```

### Pros
✅ Single API call returns everything (balances, prices, metadata, logos)  
✅ Native Solana focus - best-in-class performance  
✅ Excellent TypeScript SDK  
✅ Built-in USD pricing (hourly updates)  
✅ Supports NFTs and compressed NFTs  
✅ Staking API for delegated SOL  
✅ Webhooks for real-time updates  

### Cons
❌ Free tier limited to 1M credits/month (~10k wallet balance requests)  
❌ Pricing data limited to major tokens (long tail may be missing)  
❌ No real-time price updates (hourly only)  

---

## 2. QuickNode + DAS API

### Overview
QuickNode is a general-purpose blockchain infrastructure provider with excellent Solana support and Metaplex DAS API integration.

### Pricing

| Plan | Price | API Credits | Requests/Second |
|------|-------|-------------|-----------------|
| **Free** | $0/month | 10M credits | 15 req/s |
| Starter | $10/month | 25M credits | 40 req/s |
| Growth | $39/month | 75M credits | 125 req/s |
| Business | $199/month | 300M credits | 400 req/s |

*Note: Solana DAS API has its own rate limits within QuickNode*

### Key Features
- **DAS API (Digital Asset Standard)**: Metaplex standard for querying assets
- **Standard RPC Methods**: `getTokenAccountsByOwner`, `getTokenAccountBalance`
- **Compressed NFT Support**: Full support for cNFTs via DAS
- **Archive Data**: Access to historical data

### API Endpoints

#### Standard RPC - Get Token Accounts
```
POST https://{endpoint}.solana-mainnet.quiknode.pro/{API_KEY}/
```

#### DAS API - Get Assets By Owner
```
POST https://{endpoint}.solana-mainnet.quiknode.pro/{API_KEY}/
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getAssetsByOwner",
  "params": {
    "ownerAddress": "WALLET_ADDRESS",
    "page": 1,
    "limit": 100,
    "displayOptions": {
      "showFungible": true
    }
  }
}
```

### Code Examples

```typescript
const QUICKNODE_RPC = "https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_API_KEY";

// Get all token accounts for a wallet
const getTokenAccounts = async (walletAddress: string) => {
  const response = await fetch(QUICKNODE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' }
      ]
    })
  });
  
  const data = await response.json();
  
  // Parse token accounts
  const tokens = data.result.value.map(account => ({
    mint: account.account.data.parsed.info.mint,
    balance: account.account.data.parsed.info.tokenAmount.uiAmount,
    decimals: account.account.data.parsed.info.tokenAmount.decimals,
    address: account.pubkey
  }));
  
  return tokens;
};

// Using DAS API
const getAssetsByOwner = async (walletAddress: string) => {
  const response = await fetch(QUICKNODE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: walletAddress,
        page: 1,
        limit: 100,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true
        }
      }
    })
  });
  
  return await response.json();
};

// Get native SOL balance
const getSolBalance = async (walletAddress: string) => {
  const response = await fetch(QUICKNODE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [walletAddress]
    })
  });
  
  const data = await response.json();
  return data.result.value / 1e9; // Convert lamports to SOL
};
```

### Pros
✅ 10M free credits/month (generous free tier)  
✅ DAS API standard (works across providers)  
✅ Good compressed NFT support  
✅ Multi-chain support (if needed)  
✅ Reliable infrastructure  

### Cons
❌ No built-in USD pricing (requires separate price API)  
❌ No token metadata in basic RPC calls  
❌ More complex: need to fetch balances, then metadata, then prices separately  
❌ DAS API returns metadata but not USD prices  

---

## 3. Moralis (Solana API)

### Overview
Moralis provides a unified Web3 API with good Solana support, especially for wallet data.

### Pricing

| Plan | Price | Compute Units | Rate Limit |
|------|-------|---------------|------------|
| **Free** | $0/month | 40,000 CU/day | 1,000 CU/s |
| Starter | $49/month | 2M CU/month | 1,000 CU/s |
| Pro | $199/month | 100M CU/month | 2,000 CU/s |
| Business | $490/month | 500M CU/month | 5,000 CU/s |

### Key Features
- **Unified API**: Same interface for Solana and EVM chains
- **Spam Token Filtering**: Built-in excludeSpam parameter
- **Wallet API**: Dedicated endpoints for wallet data
- **NFT Support**: Get NFTs by wallet

### API Endpoints

```
GET https://solana-gateway.moralis.io/account/{network}/{address}/tokens
GET https://solana-gateway.moralis.io/account/{network}/{address}/balance
```

### Code Examples

```typescript
const MORALIS_API_KEY = "YOUR_API_KEY";

// Get wallet token balances
const getWalletTokens = async (address: string) => {
  const response = await fetch(
    `https://solana-gateway.moralis.io/account/mainnet/${address}/tokens?excludeSpam=true`,
    {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    }
  );
  
  return await response.json();
};

// Get native SOL balance
const getNativeBalance = async (address: string) => {
  const response = await fetch(
    `https://solana-gateway.moralis.io/account/mainnet/${address}/balance`,
    {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    }
  );
  
  return await response.json();
};
```

### Response Format
```json
[
  {
    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000000",
    "amountRaw": "1000000000000000",
    "decimals": 6,
    "name": "USD Coin",
    "symbol": "USDC",
    "logo": "https://.../usdc.png"
  }
]
```

### Pros
✅ Unified API for multi-chain apps  
✅ Built-in spam token filtering  
✅ Returns metadata (name, symbol, logo)  
✅ Simple REST API (easy to use)  

### Cons
❌ Free tier very limited (40k CU/day)  
❌ No USD pricing in responses  
❌ Less Solana-specific than Helius  
❌ Compute unit pricing can be confusing  

---

## 4. Alchemy (Solana)

### Overview
Alchemy offers Solana support alongside their EVM infrastructure, using a compute unit model.

### Pricing

| Plan | Price | Compute Units | Rate Limit |
|------|-------|---------------|------------|
| **Free** | $0/month | 30M CU/month | 25 req/s |
| Pay As You Go | Variable | $0.45/M CU | 300 req/s |
| Enterprise | Custom | Custom | Custom |

*Note: Solana methods have specific CU costs*

### Key Features
- **Token API**: Enhanced endpoints for token data
- **Portfolio API**: Multi-chain portfolio tracking
- **Webhook Support**: Real-time notifications

### API Endpoints

```
https://solana-mainnet.g.alchemy.com/v2/{API_KEY}
```

### Code Examples

```typescript
const ALCHEMY_URL = "https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY";

// Get token accounts by owner
const getTokenAccounts = async (walletAddress: string) => {
  const response = await fetch(ALCHEMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' }
      ]
    })
  });
  
  return await response.json();
};
```

### Pros
✅ 30M CU free tier (generous)  
✅ Multi-chain support  
✅ Enhanced APIs for token data  
✅ Reliable infrastructure  

### Cons
❌ No native USD pricing for Solana tokens  
❌ Primarily EVM-focused  
❌ Solana support is newer/less mature  

---

## 5. Jupiter Price API (For Pricing)

### Overview
Jupiter is the leading DEX aggregator on Solana and provides the most accurate token pricing.

### Pricing

| Tier | Price | Rate Limit |
|------|-------|------------|
| **Free** | $0 | 6 req/10 seconds (via lite-api.jup.ag) |
| Pro Plan | Variable | Higher limits via portal.jup.ag |

### Key Features
- **Last Swap Price**: Prices derived from actual on-chain swaps
- **Reliability Heuristics**: Filters out manipulative/wash trading
- **Wide Token Coverage**: Covers almost all SPL tokens with liquidity
- **Real-time**: Near real-time price updates

### API Endpoints

```
https://lite-api.jup.ag/price/v2?ids={TOKEN_MINT}
https://lite-api.jup.ag/tokens/v1/token/{MINT}
```

### Code Examples

```typescript
// Get prices for multiple tokens
const getTokenPrices = async (mintAddresses: string[]) => {
  const ids = mintAddresses.join(',');
  const response = await fetch(
    `https://lite-api.jup.ag/price/v2?ids=${ids}&vsToken=USDC`
  );
  
  const data = await response.json();
  return data.data;
};

// Get single token price
const getTokenPrice = async (mintAddress: string) => {
  const response = await fetch(
    `https://lite-api.jup.ag/price/v2?ids=${mintAddress}`
  );
  
  const data = await response.json();
  return data.data[mintAddress]?.price || null;
};

// Get token metadata
const getTokenMetadata = async (mintAddress: string) => {
  const response = await fetch(
    `https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`
  );
  
  return await response.json();
};
```

### Response Format
```json
{
  "data": {
    "So11111111111111111111111111111111111111112": {
      "id": "So11111111111111111111111111111111111111112",
      "type": "derivedPrice",
      "price": "145.32456789",
      "extraInfo": {
        "lastSwappedPrice": {
          "lastJupiterSellAt": "1704067200",
          "lastJupiterSellPrice": "145.32",
          "lastJupiterBuyAt": "1704067200",
          "lastJupiterBuyPrice": "145.33"
        }
      }
    }
  },
  "timeTaken": 0.0234
}
```

### Pros
✅ **FREE tier available**  
✅ Most accurate prices for Solana tokens  
✅ Covers long-tail of SPL tokens  
✅ Real-time updates  
✅ Simple REST API  

### Cons
❌ Rate limits on free tier  
❌ Prices may be null for illiquid tokens (by design)  
❌ No wallet balance data (pricing only)  

---

## 6. SolanaFM

### Overview
SolanaFM is a Solana-native explorer with API access. Best for historical data and transaction analysis.

### Pricing
- **Public API**: Limited free access
- **Enterprise**: Custom pricing

### API Endpoints
```
https://api.solana.fm/v1/
```

### Pros
✅ Solana-native  
✅ Good historical data  
✅ Transaction analysis  

### Cons
❌ Limited documentation  
❌ Not primarily designed for wallet balance queries  
❌ Pricing not transparent  

---

## 7. DAS API (Digital Asset Standard)

### Overview
DAS is a Metaplex standard, not a provider. Multiple providers implement it (Helius, QuickNode, etc.).

### Methods
- `getAssetsByOwner`: Get all assets for a wallet
- `getAsset`: Get single asset details
- `searchAssets`: Query with filters

### Code Example
```typescript
const getAssetsByOwner = async (rpcUrl: string, ownerAddress: string) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAssetsByOwner',
      params: {
        ownerAddress,
        page: 1,
        limit: 100,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true
        }
      }
    })
  });
  
  return await response.json();
};
```

---

## Staked SOL Considerations

Staked SOL is stored in separate **stake accounts**, not in the main wallet. To get staked SOL:

### Option 1: Helius SDK (Recommended)
```typescript
const stakeAccounts = await helius.rpc.getHeliusStakeAccounts(ownerAddress);
```

### Option 2: Standard RPC
```typescript
const getStakeAccounts = async (walletAddress: string) => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getProgramAccounts',
      params: [
        'Stake11111111111111111111111111111111111111',
        {
          encoding: 'jsonParsed',
          filters: [
            {
              memcmp: {
                offset: 44,
                bytes: walletAddress
              }
            }
          ]
        }
      ]
    })
  });
  
  return await response.json();
};
```

---

## Recommendations by Use Case

### 1. Best Overall: Helius
**Use when:** You want the simplest, most complete solution  
**Setup:** Single API key, single SDK  
**Cost:** Free tier for prototyping, $49/month for small apps  

### 2. Best Budget Option: QuickNode + Jupiter
**Use when:** You want to minimize costs and don't mind more code  
**Setup:** QuickNode for balances + Jupiter for prices  
**Cost:** Free tier sufficient for most small projects  

### 3. Best for Multi-Chain: Moralis
**Use when:** You're building across Solana + EVM chains  
**Setup:** Single Moralis API key  
**Cost:** Free tier limited, paid plans from $49/month  

### 4. Best for Pricing Only: Jupiter Price API
**Use when:** You only need token prices, not wallet data  
**Setup:** No API key required for free tier  
**Cost:** FREE  

---

## Implementation Strategy

### Recommended Architecture

```
┌─────────────────┐
│  Your App       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────┐
│ Helius  │ │ Jupiter     │
│ Wallet  │ │ Price API   │
│ API     │ │ (fallback)  │
└─────────┘ └─────────────┘
```

### Example Integration

```typescript
// config.ts
export const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// solanaService.ts
export class SolanaService {
  async getWalletPortfolio(walletAddress: string) {
    // 1. Get balances from Helius
    const balancesUrl = `https://api.helius.xyz/v1/wallet/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(balancesUrl);
    const data = await response.json();
    
    // 2. Get staked SOL separately
    const stakedAccounts = await this.getStakedAccounts(walletAddress);
    const stakedSol = stakedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    // 3. For tokens without Helius pricing, fetch from Jupiter
    const tokensWithoutPrice = data.balances.filter(t => !t.usdValue && t.balance > 0);
    if (tokensWithoutPrice.length > 0) {
      const jupiterPrices = await this.getJupiterPrices(tokensWithoutPrice.map(t => t.mint));
      // Merge prices...
    }
    
    return {
      tokens: data.balances,
      nfts: data.nfts,
      stakedSol,
      totalValue: data.totalUsdValue + (stakedSol * solPrice)
    };
  }
  
  private async getJupiterPrices(mints: string[]) {
    const response = await fetch(
      `https://lite-api.jup.ag/price/v2?ids=${mints.join(',')}`
    );
    return await response.json();
  }
  
  private async getStakedAccounts(walletAddress: string) {
    // Implementation using Helius SDK or RPC
  }
}
```

---

## Summary Table

| Provider | Free Tier | USD Prices | Metadata | Staking | Ease of Use | Best For |
|----------|-----------|------------|----------|---------|-------------|----------|
| **Helius** | 1M credits | ✅ Built-in | ✅ | ✅ SDK | ⭐⭐⭐⭐⭐ | Complete solution |
| **QuickNode** | 10M credits | ❌ | Via DAS | Via RPC | ⭐⭐⭐ | Budget/RPC needs |
| **Moralis** | 40k CU/day | ❌ | ✅ | ❌ | ⭐⭐⭐⭐ | Multi-chain |
| **Alchemy** | 30M CU | ❌ | Limited | ❌ | ⭐⭐⭐ | EVM + Solana |
| **Jupiter** | FREE | ✅ | ✅ | ❌ | ⭐⭐⭐⭐⭐ | Pricing only |
| **SolanaFM** | Limited | ❌ | Limited | ❌ | ⭐⭐ | Historical data |

---

## Final Recommendation

**For a portfolio tracker like Wealth Manager:**

1. **Primary:** Use **Helius Wallet API** for fetching wallet balances with USD values
   - Simplest integration
   - Includes metadata, logos, prices in one call
   - Good free tier for development

2. **Fallback:** Use **Jupiter Price API** for tokens Helius doesn't price
   - Free
   - Best prices for long-tail tokens

3. **Staking:** Use **Helius SDK** `getHeliusStakeAccounts()` for staked SOL

4. **Budget Alternative:** Use **QuickNode** (free tier) + **Jupiter Price API**
   - More code but completely free for small apps
