import { prisma } from "@/lib/prisma";
import { WalletAddress, WalletBalance, Asset, Prisma } from "@prisma/client";
import { AddressValidationService } from "./addressValidationService";

// Minimum USD value to show asset in dashboard
const MIN_VISIBLE_VALUE_USD = 1;

// Minimum USD value to notify user about new asset
const MIN_NOTIFICATION_VALUE_USD = 100;

// Known spam/scam token symbols/patterns
const SPAM_PATTERNS = [
  /test/i,
  /fake/i,
  /scam/i,
  /^x+$/,
  /visit.*\./i,
  /claim.*free/i,
];

// Known legitimate tokens for verification
const VERIFIED_TOKENS = new Set([
  "ETH", "WETH", "USDC", "USDT", "DAI", "WBTC", "BTC",
  "SOL", "WSOL", "BONK", "JUP", "RAY", "SRM",
  "AVAX", "WAVAX", "MATIC", "WMATIC",
  "UNI", "LINK", "AAVE", "COMP", "MKR", "CRV",
  "SHIB", "DOGE", "FLOKI", "PEPE", "BONK",
  "AERO", "DEGEN", "USDC.E", "USDT.E",
]);

interface TokenBalance {
  contractAddress?: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  priceUsd?: number;
  valueUsd?: number;
  logoUrl?: string;
  isNative?: boolean;
}

interface SyncResult {
  success: boolean;
  walletAddressId: string;
  tokensSynced: number;
  newAssetsCreated: number;
  errors?: string[];
}

interface BatchSyncResult {
  totalWallets: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}

export class WalletSyncService {
  /**
   * Sync a single wallet address
   */
  async syncWalletAddress(walletAddressId: string): Promise<SyncResult> {
    const walletAddress = await prisma.walletAddress.findUnique({
      where: { id: walletAddressId },
      include: { account: true },
    });

    if (!walletAddress) {
      return {
        success: false,
        walletAddressId,
        tokensSynced: 0,
        newAssetsCreated: 0,
        errors: ["Wallet address not found"],
      };
    }

    if (!walletAddress.syncEnabled) {
      return {
        success: false,
        walletAddressId,
        tokensSynced: 0,
        newAssetsCreated: 0,
        errors: ["Sync is disabled for this wallet"],
      };
    }

    try {
      // Fetch balances from appropriate API
      const balances = await this.fetchBalances(walletAddress);

      // Upsert WalletBalance records
      let tokensSynced = 0;
      let newAssetsCreated = 0;

      for (const balance of balances) {
        const walletBalance = await this.upsertWalletBalance(walletAddressId, balance);
        tokensSynced++;

        // Auto-create/link Asset
        const assetResult = await this.syncBalanceToAsset(
          walletAddress.accountId,
          walletBalance,
          balance
        );
        
        if (assetResult.isNew) {
          newAssetsCreated++;
        }
      }

      // Update last synced timestamp
      await prisma.walletAddress.update({
        where: { id: walletAddressId },
        data: { lastSyncedAt: new Date() },
      });

      return {
        success: true,
        walletAddressId,
        tokensSynced,
        newAssetsCreated,
      };
    } catch (error) {
      console.error(`Error syncing wallet ${walletAddressId}:`, error);
      return {
        success: false,
        walletAddressId,
        tokensSynced: 0,
        newAssetsCreated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Sync all wallet addresses for an account
   */
  async syncAccountWallets(accountId: string): Promise<BatchSyncResult> {
    const walletAddresses = await prisma.walletAddress.findMany({
      where: { accountId, syncEnabled: true },
    });

    const results: SyncResult[] = [];
    
    for (const walletAddress of walletAddresses) {
      const result = await this.syncWalletAddress(walletAddress.id);
      results.push(result);
    }

    return {
      totalWallets: walletAddresses.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Fetch balances from external API based on chain type
   */
  private async fetchBalances(walletAddress: WalletAddress): Promise<TokenBalance[]> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (walletAddress.chainType === "SOLANA") {
      const response = await fetch(
        `${baseUrl}/api/crypto/wallet/solana?address=${encodeURIComponent(walletAddress.address)}`
      );

      if (!response.ok) {
        throw new Error(`Solana API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeSolanaBalances(data);
    }

    if (walletAddress.chainType === "EVM") {
      // For EVM, we need to detect if it's P-Chain or regular EVM
      if (walletAddress.isPChain) {
        const response = await fetch(
          `${baseUrl}/api/crypto/wallet/evm?address=${encodeURIComponent(walletAddress.address)}&chain=avalanche-p`
        );

        if (!response.ok) {
          throw new Error(`Avalanche P-Chain API error: ${response.status}`);
        }

        const data = await response.json();
        return this.normalizeEvmBalances(data);
      }

      // Regular EVM - use auto-scan for multiple chains
      const response = await fetch(
        `${baseUrl}/api/crypto/wallet/evm?address=${encodeURIComponent(walletAddress.address)}&chain=auto`
      );

      if (!response.ok) {
        throw new Error(`EVM API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeEvmBalances(data);
    }

    throw new Error(`Unsupported chain type: ${walletAddress.chainType}`);
  }

  /**
   * Normalize Solana API response to TokenBalance format
   */
  private normalizeSolanaBalances(data: any): TokenBalance[] {
    const balances: TokenBalance[] = [];

    // Add native SOL
    if (data.nativeBalance?.balance > 0) {
      balances.push({
        contractAddress: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        balance: data.nativeBalance.balance,
        isNative: true,
      });
    }

    // Add staked SOL if present
    if (data.stakedSolBalance > 0) {
      balances.push({
        contractAddress: "staked:sol",
        symbol: "SOL",
        name: "Staked SOL",
        decimals: 9,
        balance: data.stakedSolBalance,
        isNative: true,
      });
    }

    // Add tokens
    if (Array.isArray(data.tokens)) {
      for (const token of data.tokens) {
        if (token.balance > 0) {
          balances.push({
            contractAddress: token.mint || token.contractAddress,
            symbol: token.symbol || "UNKNOWN",
            name: token.name || "Unknown Token",
            decimals: token.decimals || 6,
            balance: token.balance,
            priceUsd: token.priceUsd,
            valueUsd: token.valueUsd,
            isNative: false,
          });
        }
      }
    }

    return balances;
  }

  /**
   * Normalize EVM API response to TokenBalance format
   */
  private normalizeEvmBalances(data: any): TokenBalance[] {
    const balances: TokenBalance[] = [];

    // Add native balances from all chains
    if (Array.isArray(data.nativeBalances)) {
      for (const native of data.nativeBalances) {
        if (native.balance > 0) {
          balances.push({
            contractAddress: `native:${native.chain}`,
            symbol: native.symbol,
            name: `${native.symbol} (${native.chain})`,
            decimals: native.decimals,
            balance: native.balance,
            isNative: true,
          });
        }
      }
    }

    // Add tokens
    if (Array.isArray(data.tokens)) {
      for (const token of data.tokens) {
        if (token.balance > 0) {
          balances.push({
            contractAddress: token.contractAddress,
            symbol: token.symbol || "UNKNOWN",
            name: token.name || "Unknown Token",
            decimals: token.decimals || 18,
            balance: token.balance,
            priceUsd: token.priceUsd,
            valueUsd: token.valueUsd,
            isNative: false,
          });
        }
      }
    }

    return balances;
  }

  /**
   * Upsert WalletBalance record
   */
  private async upsertWalletBalance(
    walletAddressId: string,
    balance: TokenBalance
  ): Promise<WalletBalance> {
    const contractAddress = balance.contractAddress || "native";
    const valueUsd = balance.valueUsd || 0;
    const valueEur = valueUsd > 0 ? valueUsd * 0.92 : 0; // Approximate EUR conversion

    return prisma.walletBalance.upsert({
      where: {
        walletAddressId_contractAddress: {
          walletAddressId,
          contractAddress,
        },
      },
      update: {
        balance: balance.balance,
        rawBalance: String(balance.balance * Math.pow(10, balance.decimals)),
        priceUsd: balance.priceUsd,
        valueUsd: valueUsd > 0 ? valueUsd : null,
        valueEur: valueEur > 0 ? valueEur : null,
        priceUpdatedAt: new Date(),
      },
      create: {
        walletAddressId,
        contractAddress,
        symbol: balance.symbol.slice(0, 20),
        name: balance.name.slice(0, 60),
        decimals: balance.decimals,
        balance: balance.balance,
        rawBalance: String(balance.balance * Math.pow(10, balance.decimals)),
        priceUsd: balance.priceUsd,
        valueUsd: valueUsd > 0 ? valueUsd : null,
        valueEur: valueEur > 0 ? valueEur : null,
        isNative: balance.isNative || false,
        isVerified: this.isVerifiedToken(balance.symbol),
      },
    });
  }

  /**
   * Sync WalletBalance to Asset with smart auto-add rules
   */
  private async syncBalanceToAsset(
    accountId: string,
    walletBalance: WalletBalance,
    tokenBalance: TokenBalance
  ): Promise<{ isNew: boolean; asset: Asset | null }> {
    // If already linked to an asset, update the asset quantity
    if (walletBalance.assetId) {
      const existingAsset = await prisma.asset.findUnique({
        where: { id: walletBalance.assetId },
      });

      if (existingAsset) {
        // Update quantity if it differs significantly
        if (Math.abs(existingAsset.quantity - tokenBalance.balance) > 0.000001) {
          await prisma.asset.update({
            where: { id: existingAsset.id },
            data: {
              quantity: tokenBalance.balance,
              currentPrice: tokenBalance.priceUsd || existingAsset.currentPrice,
              priceUpdatedAt: new Date(),
            },
          });
        }
        return { isNew: false, asset: existingAsset };
      }
    }

    // Check if asset with same symbol already exists in this account
    const existingAsset = await prisma.asset.findFirst({
      where: {
        accountId,
        symbol: tokenBalance.symbol,
        type: "CRYPTO",
      },
    });

    if (existingAsset) {
      // Link to existing asset
      await prisma.walletBalance.update({
        where: { id: walletBalance.id },
        data: { assetId: existingAsset.id },
      });

      // Update asset quantity to reflect total
      await prisma.asset.update({
        where: { id: existingAsset.id },
        data: {
          quantity: tokenBalance.balance,
          currentPrice: tokenBalance.priceUsd || existingAsset.currentPrice,
          priceUpdatedAt: new Date(),
        },
      });

      return { isNew: false, asset: existingAsset };
    }

    // Create new Asset with smart visibility
    const valueUsd = tokenBalance.valueUsd || 0;
    const isSpam = this.isSpamToken(tokenBalance);
    const shouldBeVisible = !isSpam && valueUsd >= MIN_VISIBLE_VALUE_USD;

    const newAsset = await prisma.asset.create({
      data: {
        accountId,
        symbol: tokenBalance.symbol.slice(0, 20),
        name: tokenBalance.name.slice(0, 60),
        type: "CRYPTO",
        quantity: tokenBalance.balance,
        currentPrice: tokenBalance.priceUsd,
        priceUpdatedAt: new Date(),
        currency: "USD",
        isManualPrice: false,
        isVisible: shouldBeVisible,
        isSpam,
        source: "WALLET_SYNC",
      },
    });

    // Link WalletBalance to new Asset
    await prisma.walletBalance.update({
      where: { id: walletBalance.id },
      data: { assetId: newAsset.id },
    });

    // TODO: Send notification if value is significant
    if (valueUsd >= MIN_NOTIFICATION_VALUE_USD && shouldBeVisible) {
      console.log(`[Notification] New asset discovered: ${tokenBalance.symbol} ($${valueUsd.toFixed(2)})`);
    }

    return { isNew: true, asset: newAsset };
  }

  /**
   * Check if token is a known spam/scam token
   */
  private isSpamToken(token: TokenBalance): boolean {
    const symbol = token.symbol.toLowerCase();
    const name = token.name.toLowerCase();

    // Check against spam patterns
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(symbol) || pattern.test(name)) {
        return true;
      }
    }

    // Check for excessive length (often spam)
    if (symbol.length > 15 || name.length > 50) {
      return true;
    }

    // Check for suspicious repetition
    if (/([a-z])\1{4,}/i.test(symbol)) {
      return true;
    }

    return false;
  }

  /**
   * Check if token is a verified/known legitimate token
   */
  private isVerifiedToken(symbol: string): boolean {
    return VERIFIED_TOKENS.has(symbol.toUpperCase());
  }

  /**
   * Get explorer URL for a wallet address
   */
  static getExplorerUrl(address: string, chainType: string): string | null {
    return AddressValidationService.getPortfolioExplorerUrl(address, chainType as any);
  }
}

// Export singleton instance
export const walletSyncService = new WalletSyncService();
