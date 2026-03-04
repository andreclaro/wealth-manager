# Crypto Wallet Integration Design Document

## Overview

This document outlines the integration of cryptocurrency wallet functionality into the Wealth Manager application. The goal is to extend the existing `PortfolioAccount` model to support crypto wallets with multiple addresses (EVM, Solana, etc.) and enable automatic balance fetching from the blockchain.

## Goals

1. **Wallet-Aware Accounts**: Allow users to associate blockchain addresses with their accounts
2. **Multi-Chain Support**: EVM chains (Ethereum, Polygon, Avalanche C-Chain, etc.) and Solana
3. **Avalanche P-Chain Support**: Special handling for AVAX P-Chain addresses alongside EVM addresses
4. **Automatic Balance Sync**: Fetch and update asset balances from blockchain
5. **Asset Discovery**: Automatically discover and add tokens held in connected wallets
6. **Historical Tracking**: Store balance snapshots over time

---

## Database Schema Changes

### New Enum: `WalletChainType`

```prisma
enum WalletChainType {
  EVM           // Ethereum, Polygon, Arbitrum, Base, Avalanche C-Chain, etc.
  SOLANA        // Solana
  // Future: BITCOIN, CARDANO, etc.
}
```

### New Model: `WalletAddress`

Stores individual blockchain addresses linked to an account.

```prisma
model WalletAddress {
  id          String        @id @default(uuid())
  accountId   String        // References PortfolioAccount
  
  // Address details
  chainType   WalletChainType
  address     String        // The actual blockchain address
  label       String?       // User-defined label (e.g., "Main Wallet", "Cold Storage")
  
  // Chain-specific fields
  evmChainId  Int?          // For EVM: 1 (Ethereum), 137 (Polygon), 43114 (Avalanche), etc.
  isPChain    Boolean       @default(false)  // For Avalanche P-Chain
  
  // Sync settings
  syncEnabled Boolean       @default(true)
  lastSyncedAt DateTime?
  
  // Metadata
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  // Relations
  account     PortfolioAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  balances    WalletBalance[]
  
  // Computed explorer URLs (not stored, generated on-the-fly)
  // Solana: https://jup.ag/portfolio/{address}
  // EVM: https://debank.com/profile/{address}
  
  @@unique([accountId, chainType, address])
  @@index([accountId])
  @@index([chainType, address])
}
```

### New Model: `WalletBalance`

Stores token balances discovered from wallet scans.

```prisma
model WalletBalance {
  id              String   @id @default(uuid())
  walletAddressId String   // References WalletAddress
  
  // Token info
  contractAddress String?  // Token contract (null for native tokens)
  symbol          String
  name            String
  decimals        Int      @default(18)
  
  // Balance
  balance         Float    // Human-readable balance
  rawBalance      String   // Raw balance as string for precision
  
  // Price info (cached)
  priceUsd        Float?
  priceEur        Float?
  valueUsd        Float?
  valueEur        Float?
  priceUpdatedAt  DateTime?
  
  // Metadata
  isNative        Boolean  @default(false)  // ETH, SOL, AVAX, etc.
  isVerified      Boolean  @default(false)  // Known/verified token
  logoUrl         String?
  
  // Link to Asset (if user wants to track this in portfolio)
  assetId         String?
  asset           Asset?   @relation(fields: [assetId], references: [id], onDelete: SetNull)
  
  walletAddress   WalletAddress @relation(fields: [walletAddressId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([walletAddressId, contractAddress])
  @@index([walletAddressId])
  @@index([assetId])
}
```

### Updated Model: `PortfolioAccount`

```prisma
model PortfolioAccount {
  id        String   @id @default(uuid())
  name      String   // e.g., "Chase Checking", "MetaMask Main"
  type      String?  // e.g., "Bank", "Broker", "Crypto Wallet", "Exchange"
  currency  Currency @default(EUR)
  notes     String?
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assets        Asset[]
  walletAddresses WalletAddress[]  // NEW: Linked blockchain addresses
  user          User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([type])
  @@index([userId])
}
```

### Updated Model: `Asset`

Add relation to wallet balance for tracking source and visibility control.

```prisma
model Asset {
  id             String    @id @default(uuid())
  symbol         String
  name           String
  type           AssetType
  quantity       Float
  purchasePrice  Float?
  currency       Currency  @default(EUR)
  currentPrice   Float?
  priceUpdatedAt DateTime?
  notes          String?
  isManualPrice  Boolean   @default(false)
  accountId      String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  // NEW: Visibility control for auto-added assets
  isVisible      Boolean   @default(true)   // Show in dashboard?
  isSpam         Boolean   @default(false)  // User-marked spam
  source         AssetSource @default(MANUAL)  // MANUAL | WALLET_SYNC
  
  // NEW: Link to wallet balance if auto-discovered
  walletBalances WalletBalance[]

  priceHistory PriceHistory[]
  account      PortfolioAccount @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([type])
  @@index([currency])
  @@index([accountId])
  @@index([isVisible])
}

enum AssetSource {
  MANUAL
  WALLET_SYNC
}
```

---

## Supported Asset Types

The existing `AssetType` enum already includes `CRYPTO`. We'll use this for all cryptocurrency assets:

```prisma
enum AssetType {
  STOCK
  ETF
  FUND
  PPR_FPR
  PRIVATE_EQUITY
  P2P
  BOND
  REAL_ESTATE
  CRYPTO        // <-- Use this for all crypto assets
  CASH
  SAVINGS
  COMMODITY
  OTHER
}
```

### Cryptocurrency Sub-types (stored in Asset.notes or new field)

For more granular classification within `CRYPTO`:

- **Native Token**: ETH, SOL, AVAX, MATIC
- **ERC-20 / SPL Token**: USDC, USDT, BONK, etc.
- **Staked Token**: stSOL, mSOL, etc.
- **LP Token**: Liquidity pool positions
- **Governance Token**: JUP stake, etc.

---

## Account Type: Crypto Wallet

When creating an account with `type: "Crypto Wallet"`, users can:

1. **Add multiple addresses** per account (e.g., same MetaMask across chains)
2. **Specify chain type**: EVM or Solana
3. **For EVM**: Add optional Avalanche P-Chain address
4. **Enable auto-sync**: Fetch balances automatically

### Account Structure Example

```typescript
// Account: "My MetaMask"
{
  name: "My MetaMask",
  type: "Crypto Wallet",
  currency: "USD",
  walletAddresses: [
    {
      chainType: "EVM",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEe",
      evmChainId: 1,        // Ethereum
      label: "Ethereum Main"
    },
    {
      chainType: "EVM", 
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEe", // Same address
      evmChainId: 43114,    // Avalanche C-Chain
      isPChain: false,
      label: "Avalanche C-Chain"
    },
    {
      chainType: "EVM",
      address: "P-avax1abc123...",  // Different address format
      isPChain: true,
      label: "Avalanche P-Chain"
    }
  ]
}

// Account: "Solana Main"
{
  name: "Solana Main",
  type: "Crypto Wallet", 
  currency: "USD",
  walletAddresses: [
    {
      chainType: "SOLANA",
      address: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
      label: "Phantom Wallet"
    }
  ]
}
```

---

## API Endpoints

### 1. Wallet Address Management

```typescript
// POST /api/accounts/:id/wallet-addresses
// Add a new wallet address to an account
{
  "chainType": "EVM",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEe",
  "evmChainId": 1,           // Optional, for EVM chains
  "isPChain": false,         // For Avalanche P-Chain
  "label": "Ethereum Main"
}

// GET /api/accounts/:id/wallet-addresses
// List all wallet addresses for an account

// PUT /api/accounts/:id/wallet-addresses/:addressId
// Update wallet address (label, sync settings)
{
  "label": "Updated Label",
  "syncEnabled": true
}

// DELETE /api/accounts/:id/wallet-addresses/:addressId
// Remove wallet address and its balances
```

### 2. Wallet Sync

```typescript
// POST /api/wallet-addresses/:id/sync
// Trigger manual sync for a specific wallet address
// Response: { syncedTokens: 12, totalValueUsd: 1234.56 }

// POST /api/accounts/:id/sync-wallets
// Sync all wallet addresses for an account

// GET /api/wallet-addresses/:id/balances
// Get current balances for a wallet address

// GET /api/wallet-addresses/:id/balances/history
// Get balance history over time
```

### 3. Wallet-to-Asset Linking

```typescript
// POST /api/wallet-balances/:balanceId/link-to-asset
// Link a wallet-discovered token to a portfolio asset
{
  "assetId": "uuid-of-existing-asset"  // Optional: link to existing
}

// Or create new asset from wallet balance:
// POST /api/wallet-balances/:balanceId/create-asset
{
  "trackInPortfolio": true
}
```

### 4. Existing Account API Changes

Update existing endpoints to include wallet addresses:

```typescript
// GET /api/accounts (updated)
// Include walletAddresses in response

// GET /api/accounts/:id (updated)  
// Include walletAddresses with latest balances
```

---

## Services Architecture

### WalletSyncService

```typescript
class WalletSyncService {
  // Sync a single wallet address
  async syncWalletAddress(walletAddressId: string): Promise<SyncResult>;
  
  // Sync all wallets for an account
  async syncAccountWallets(accountId: string): Promise<BatchSyncResult>;
  
  // Sync all wallets for a user
  async syncAllUserWallets(userId: string): Promise<BatchSyncResult>;
  
  // Fetch balances based on chain type
  private async fetchEvmBalances(address: string, chainId?: number): Promise<TokenBalance[]>;
  private async fetchSolanaBalances(address: string): Promise<TokenBalance[]>;
  private async fetchAvalanchePChainBalances(address: string): Promise<TokenBalance[]>;
  
  // Update or create wallet balances
  private async upsertWalletBalances(
    walletAddressId: string, 
    balances: TokenBalance[]
  ): Promise<void>;
  
  // Create/update corresponding Asset records
  private async syncBalancesToAssets(
    walletAddressId: string
  ): Promise<void>;
}
```

### AddressValidationService

```typescript
class AddressValidationService {
  // Validate address format based on chain type
  validateAddress(address: string, chainType: WalletChainType): boolean;
  
  // EVM address validation (0x...)
  private validateEvmAddress(address: string): boolean;
  
  // Solana address validation (Base58)
  private validateSolanaAddress(address: string): boolean;
  
  // Avalanche P-Chain validation (P-avax1...)
  private validatePChainAddress(address: string): boolean;
  
  // Get chain ID from EVM address (via checksum or API)
  detectEvmChain(address: string): Promise<number[]>;
}
```

---

## UI/UX Design

### 1. Account Creation Flow

When user selects "Crypto Wallet" as account type:

```
┌─────────────────────────────────────────┐
│  Create Account                          │
├─────────────────────────────────────────┤
│  Name: [My MetaMask        ]            │
│  Type: [Crypto Wallet  ▼   ]            │
│  Currency: [USD          ▼ ]            │
│  Notes: [                 ]             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Wallet Addresses                │    │
│  ├─────────────────────────────────┤    │
│  │ Chain: [EVM            ▼]       │    │
│  │ Address: [0x...               ] │    │
│  │ Network: [Ethereum Mainnet  ▼]  │    │
│  │ Label: [Main Wallet          ]  │    │
│  │ [+ Add Avalanche P-Chain]       │    │
│  │ [+ Add Another Address]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Cancel]              [Create Account] │
└─────────────────────────────────────────┘
```

### 2. Account Detail Page

Show wallet addresses with sync status and balances:

```
┌─────────────────────────────────────────┐
│  My MetaMask                    [Edit] │
│  Crypto Wallet                           │
├─────────────────────────────────────────┤
│                                          │
│  Wallet Addresses (3)              [+]   │
│  ┌─────────────────────────────────┐    │
│  │ 🔗 Ethereum Mainnet             │    │
│  │ 0x742d...8dEe           [Sync ▶]│    │
│  │ Last synced: 5 min ago          │    │
│  │                                 │    │
│  │ Balances:                       │    │
│  │ • ETH: 1.5 ($4,200)     [Add]   │    │
│  │ • USDC: 1,000 ($1,000)  [Added] │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🔗 Avalanche C-Chain            │    │
│  │ 0x742d...8dEe           [Sync ▶]│    │
│  │ Last synced: 1 hour ago         │    │
│  │                                 │    │
│  │ Balances:                       │    │
│  │ • AVAX: 50 ($1,500)     [Add]   │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🔗 Avalanche P-Chain            │    │
│  │ P-avax1...abc           [Sync ▶]│    │
│  │ Last synced: 1 hour ago         │    │
│  └─────────────────────────────────┘    │
│                                          │
│  [Sync All Wallets]                      │
└─────────────────────────────────────────┘
```

### 3. Hidden Assets Section

When auto-add hides low-value/spam tokens:

```
┌─────────────────────────────────────────┐
│  My Portfolio                            │
├─────────────────────────────────────────┤
│                                          │
│  Tracked Assets                     [+]  │
│  ┌─────────────────────────────────┐    │
│  │ ETH          1.5     $4,200     │    │
│  │ USDC       1,000     $1,000     │    │
│  │ AERO         150       $245     │    │
│  └─────────────────────────────────┘    │
│                                          │
│  [Show 8 Hidden Assets ▼]                │
│  ┌─────────────────────────────────┐    │
│  │ SHIB       1M      $0.05  [Restore] │ │
│  │ FLOKI      500K    $0.00  [Restore] │ │
│  │ UNKNOWN    999     $0.00  [Delete]  │ │
│  └─────────────────────────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

**Actions:**
- **Restore**: Shows asset in main dashboard (`isVisible = true`)
- **Delete**: Removes Asset AND unlinks WalletBalance
- **Mark as Spam**: Hides permanently, improves spam detection

### 4. Wallet Address Card with Explorer Links

```
┌─────────────────────────────────────────┐
│ 🔗 Ethereum Mainnet              [⋯]    │
│ 0x742d...8dEe                           │
├─────────────────────────────────────────┤
│                                         │
│  [🔗 View on DeBank]                    │
│  [🔄 Sync Now]                          │
│                                         │
│  Last synced: 5 min ago                 │
│                                         │
│  Balances:                              │
│  • ETH: 1.5 ($4,200)                    │
│  • USDC: 1,000 ($1,000)                 │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔗 Solana Mainnet                [⋯]    │
│ HN7c...YWrH                             │
├─────────────────────────────────────────┤
│                                         │
│  [🔗 View on Jupiter]                   │
│  [🔄 Sync Now]                          │
│                                         │
│  Last synced: 10 min ago                │
│                                         │
│  Balances:                              │
│  • SOL: 50 ($7,250)                     │
│  • USDC: 2,500 ($2,500)                 │
│  • JUP: 100 ($450)                      │
│                                         │
└─────────────────────────────────────────┘
```

**Explorer Links:**
- **Solana**: `https://jup.ag/portfolio/{address}` - Complete portfolio view with LP positions
- **EVM**: `https://debank.com/profile/{address}` - Multi-chain EVM aggregator

Clicking these opens the external portfolio viewer in a new tab, giving users a detailed view without leaving the app context.

---

## Supported Chains (Phase 1)

| Chain | Type | Chain ID | Notes | Portfolio Explorer |
|-------|------|----------|-------|-------------------|
| Ethereum | EVM | 1 | Native ETH, ERC-20 tokens | [DeBank](https://debank.com/) |
| Polygon | EVM | 137 | MATIC, ERC-20 tokens | [DeBank](https://debank.com/) |
| Arbitrum | EVM | 42161 | ETH, ERC-20 tokens | [DeBank](https://debank.com/) |
| Base | EVM | 8453 | ETH, ERC-20 tokens | [DeBank](https://debank.com/) |
| Avalanche C-Chain | EVM | 43114 | AVAX, ERC-20 tokens | [DeBank](https://debank.com/) |
| Avalanche P-Chain | Special | - | AVAX staking, validators | - |
| Solana | Native | - | SOL, SPL tokens, stake accounts | [Jupiter](https://jup.ag/portfolio/) |

### Portfolio Explorer Links

Generate external portfolio viewer links for each wallet address:

```typescript
function getPortfolioExplorerUrl(address: string, chainType: WalletChainType): string | null {
  if (chainType === 'SOLANA') {
    return `https://jup.ag/portfolio/${address}`;
  }
  
  if (chainType === 'EVM') {
    // DeBank supports most EVM chains
    return `https://debank.com/profile/${address}`;
  }
  
  return null;
}
```

| Explorer | Chains | URL Pattern | Features |
|----------|--------|-------------|----------|
| **Jupiter** | Solana | `https://jup.ag/portfolio/{address}` | SPL tokens, LP positions, stake accounts, DCA orders |
| **DeBank** | EVM multi-chain | `https://debank.com/profile/{address}` | All EVM tokens, DeFi positions, NFTs, transaction history |

---

## External API Integration

### EVM Chains: Blockscout + Routescan (Existing)

Reuse existing implementation from `/app/api/crypto/wallet/evm`:
- Blockscout API for Ethereum, Polygon, Arbitrum, Base
- Routescan for Avalanche C-Chain
- Avalanche Platform RPC for P-Chain

### Solana: Solana RPC + Jupiter (Existing)

Reuse existing implementation from `/app/api/crypto/wallet/solana`:
- Solana RPC for balances and stake accounts
- Jupiter Portfolio API for protocol positions
- Metaplex for token metadata

---

## Sync Strategy

### Automatic Sync

- **On account creation**: Initial sync after adding first address
- **On manual trigger**: User clicks "Sync" button
- **Scheduled**: Daily sync for all enabled wallets (cron job)

### Sync Process

```
1. Validate wallet address format
2. Fetch balances from appropriate API
3. Filter out spam/unknown tokens (optional)
4. Upsert WalletBalance records
5. Fetch current prices for tokens
6. Calculate USD/EUR values
7. Create/update linked Asset records (if enabled)
8. Record sync timestamp
```

### Rate Limiting

Reuse existing rate limiting from crypto API routes:
- 12 requests per minute per wallet endpoint
- Cache results for 5 minutes

---

## Security Considerations

1. **Address Validation**: Validate all addresses before storing
2. **Read-Only**: Never request or store private keys
3. **Rate Limiting**: Prevent abuse of sync endpoints
4. **Data Privacy**: Wallet addresses are sensitive - log carefully

---

## Implementation Phases

### Phase 1: Database & API Foundation
- [ ] Create Prisma migration for new tables
- [ ] Implement wallet address CRUD API
- [ ] Add address validation service
- [ ] Update account API to include wallet addresses

### Phase 2: Sync Integration
- [ ] Integrate existing EVM wallet sync service
- [ ] Integrate existing Solana wallet sync service
- [ ] Implement WalletSyncService
- [ ] Add sync endpoints

### Phase 3: UI Integration
- [ ] Update account creation form for crypto wallets
- [ ] Add wallet address management UI
- [ ] Create wallet balance display component
- [ ] Add "Add to Portfolio" flow for discovered tokens

### Phase 4: Automation
- [ ] Add cron job for scheduled syncs
- [ ] Implement sync history tracking
- [ ] Add notifications for sync failures

---

## Environment Variables

```bash
# Existing (reused)
# - Solana RPC and Jupiter API keys
# - Avalanche RPC endpoints

# New (optional)
SYNC_WALLETS_CRON="0 */6 * * *"  # Every 6 hours
WALLET_SYNC_ENABLED="true"
```

---

## Asset Visibility & Auto-Add Strategy

### Smart Auto-Add Rules

When a wallet sync discovers new tokens, the system automatically creates Assets with smart defaults:

```typescript
// Decision matrix for new tokens
if (existingAssetWithSameSymbol) {
  // Link to existing, update quantity
  await linkToExistingAsset(balance, existingAsset);
} else if (isSpamToken(balance)) {
  // Create hidden asset
  await createAsset({ ...balance, isVisible: false, isSpam: true });
} else if (balance.valueUsd < 1) {
  // Dust - hidden by default
  await createAsset({ ...balance, isVisible: false });
} else {
  // Worthwhile token - visible in dashboard
  await createAsset({ ...balance, isVisible: true });
  
  // Notify if significant
  if (balance.valueUsd > 100) {
    notifyUser(`New asset discovered: ${balance.symbol} ($${balance.valueUsd})`);
  }
}
```

### User Controls

| Action | Result |
|--------|--------|
| **Untrack/Hide** | Sets `isVisible = false`, keeps in wallet view |
| **Restore** | Sets `isVisible = true`, shows in dashboard |
| **Mark as Spam** | Sets `isSpam = true`, trains spam detection |
| **Delete** | Removes Asset, unlinks WalletBalance |

### Hidden Assets Count

Dashboard shows summary:
- **"Showing 5 assets (3 hidden)"**
- Click to expand hidden assets list
- One-click restore for any hidden item

## Migration Strategy

Existing crypto assets (manually added) remain unchanged. Users can optionally:
1. Link existing assets to wallet balances
2. Create new accounts with wallet addresses
3. Merge duplicate assets discovered from wallets

---

## References

- Existing EVM wallet API: `/app/api/crypto/wallet/evm/route.ts`
- Existing Solana wallet API: `/app/api/crypto/wallet/solana/route.ts`
- Original crypto wallet design: `/docs/DESIGN-CRYPTO-WALLET.md`
- Solana API research: `/research/solana-wallet-api-research.md`
