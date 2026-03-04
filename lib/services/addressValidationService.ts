import { WalletChainType } from "@prisma/client";

// EVM address regex: 0x followed by 40 hex characters
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Solana address regex: Base58 encoded, 32-44 characters
// Solana uses Base58 which excludes: 0, O, I, l
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Avalanche P-Chain address regex: P-avax1 followed by alphanumeric
const P_CHAIN_ADDRESS_REGEX = /^P-avax1[0-9a-z]+$/i;

// Alternative P-Chain format without P- prefix
const P_CHAIN_ADDRESS_ALT_REGEX = /^avax1[0-9a-z]+$/i;

export class AddressValidationService {
  /**
   * Validate address format based on chain type
   */
  static validateAddress(address: string, chainType: WalletChainType): boolean {
    switch (chainType) {
      case "EVM":
        return this.validateEvmAddress(address);
      case "SOLANA":
        return this.validateSolanaAddress(address);
      default:
        return false;
    }
  }

  /**
   * Validate EVM address (0x...)
   * Also accepts Avalanche P-Chain addresses when explicitly passed
   */
  static validateEvmAddress(address: string): boolean {
    const trimmed = address.trim();
    
    // Check if it's a P-Chain address (special case)
    if (this.isPChainAddress(trimmed)) {
      return true;
    }
    
    return EVM_ADDRESS_REGEX.test(trimmed);
  }

  /**
   * Validate Solana address (Base58)
   */
  static validateSolanaAddress(address: string): boolean {
    const trimmed = address.trim();
    return SOLANA_ADDRESS_REGEX.test(trimmed);
  }

  /**
   * Check if address is Avalanche P-Chain
   */
  static isPChainAddress(address: string): boolean {
    const trimmed = address.trim();
    return P_CHAIN_ADDRESS_REGEX.test(trimmed) || P_CHAIN_ADDRESS_ALT_REGEX.test(trimmed);
  }

  /**
   * Normalize P-Chain address to canonical format (P-avax1...)
   */
  static normalizePChainAddress(address: string): string | null {
    const trimmed = address.trim().toLowerCase();
    
    if (P_CHAIN_ADDRESS_REGEX.test(trimmed)) {
      // Already in correct format, just ensure P- prefix is uppercase
      return `P-${trimmed.slice(2)}`;
    }
    
    if (P_CHAIN_ADDRESS_ALT_REGEX.test(trimmed)) {
      // Add P- prefix
      return `P-${trimmed}`;
    }
    
    return null;
  }

  /**
   * Get portfolio explorer URL for a wallet address
   */
  static getPortfolioExplorerUrl(address: string, chainType: WalletChainType): string | null {
    if (chainType === "SOLANA") {
      return `https://jup.ag/portfolio/${address}`;
    }
    
    if (chainType === "EVM") {
      // DeBank supports most EVM chains
      return `https://debank.com/profile/${address}`;
    }
    
    return null;
  }

  /**
   * Detect if an address is native EVM (not P-Chain)
   */
  static isNativeEvmAddress(address: string): boolean {
    return EVM_ADDRESS_REGEX.test(address.trim());
  }

  /**
   * Get chain type from address (auto-detect)
   * Returns null if cannot determine
   */
  static detectChainType(address: string): WalletChainType | null {
    const trimmed = address.trim();
    
    if (this.isNativeEvmAddress(trimmed) || this.isPChainAddress(trimmed)) {
      return "EVM";
    }
    
    if (this.validateSolanaAddress(trimmed)) {
      return "SOLANA";
    }
    
    return null;
  }

  /**
   * Format address for display (truncate middle)
   */
  static formatAddress(address: string, prefixLength = 6, suffixLength = 4): string {
    const trimmed = address.trim();
    if (trimmed.length <= prefixLength + suffixLength + 3) {
      return trimmed;
    }
    return `${trimmed.slice(0, prefixLength)}...${trimmed.slice(-suffixLength)}`;
  }
}

// Export singleton instance
export const addressValidationService = new AddressValidationService();
