import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";

// Use a free Solana RPC with higher limits (Helius dev tier or fallback to public)
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet.solana.com";

// Delay helper to avoid rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Common SPL token metadata fallback (for tokens that don't have Metaplex metadata)
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USD", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", name: "Bonk", decimals: 5 },
  "7i5KKsX2weiTkry7jA4ZwSuXGhsSnEAF7WjwFaENhuvY": { symbol: "JUP", name: "Jupiter", decimals: 6 },
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "JitoSOL", name: "Jito Staked SOL", decimals: 9 },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", name: "Marinade Staked SOL", decimals: 9 },
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP22p2c": { symbol: "bSOL", name: "Blaze Staked SOL", decimals: 9 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", name: "Lido Staked SOL", decimals: 9 },
  "So11111111111111111111111111111111111111112": { symbol: "SOL", name: "Wrapped SOL", decimals: 9 },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": { symbol: "RAY", name: "Raydium", decimals: 6 },
  "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt": { symbol: "SRM", name: "Serum", decimals: 6 },
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": { symbol: "BTC", name: "Wrapped BTC (Wormhole)", decimals: 8 },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", name: "Wrapped ETH (Wormhole)", decimals: 8 },
  "A9mUU4qviSctJVPJdBJWkb28fz945QxgoHgMU8sPmkpP": { symbol: "PYTH", name: "Pyth Network", decimals: 6 },
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": { symbol: "PYUSD", name: "PayPal USD", decimals: 6 },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  // Validate Solana address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address format" },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const publicKey = new PublicKey(address);

    // Fetch native SOL balance
    const solBalanceLamports = await connection.getBalance(publicKey);
    const solBalance = solBalanceLamports / 1e9; // Convert lamports to SOL

    // Fetch all SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
    );

    // Format token data
    interface TokenInfo {
      mint: string;
      balance: number;
      decimals: number;
      rawAmount: string;
      symbol?: string;
      name?: string;
      [key: string]: any; // Allow additional properties
    }
    
    const tokens: TokenInfo[] = tokenAccounts.value
      .map((account) => {
        const parsedInfo = account.account.data.parsed.info;
        const tokenAmount = parsedInfo.tokenAmount;
        
        // Skip zero balance tokens
        if (tokenAmount.uiAmount === 0) return null;

        return {
          mint: parsedInfo.mint,
          balance: tokenAmount.uiAmount,
          decimals: tokenAmount.decimals,
          rawAmount: tokenAmount.amount,
        };
      })
      .filter((t): t is TokenInfo => t !== null) // Type guard to remove nulls
      .sort((a, b) => b.balance - a.balance);

    // Initialize Metaplex for fetching token metadata
    const metaplex = Metaplex.make(connection);

    // Fetch token metadata with rate limiting - process sequentially with delays
    const tokensWithMetadata: TokenInfo[] = [];
    for (const token of tokens) {
      const mintAddress = token.mint;
      
      // First check known tokens list
      if (KNOWN_TOKENS[mintAddress]) {
        tokensWithMetadata.push({
          ...token,
          symbol: KNOWN_TOKENS[mintAddress].symbol,
          name: KNOWN_TOKENS[mintAddress].name,
        });
        continue;
      }
      
      // Try to fetch from Metaplex with delay to avoid rate limits
      let metadataFound = false;
      try {
        await delay(100); // Small delay between requests
        const mintPublicKey = new PublicKey(mintAddress);
        const metadataPda = metaplex.nfts().pdas().metadata({ mint: mintPublicKey });
        
        const metadataAccount = await connection.getAccountInfo(metadataPda);
        
        if (metadataAccount) {
          // Parse the metadata account data
          const data = metadataAccount.data;
          let offset = 1 + 32 + 32; // Skip key, update authority, mint
          
          // Read name length and name
          const nameLen = data.readUInt32LE(offset);
          offset += 4;
          const name = data.slice(offset, offset + nameLen).toString("utf8").replace(/\u0000/g, "");
          offset += nameLen;
          
          // Read symbol length and symbol
          const symbolLen = data.readUInt32LE(offset);
          offset += 4;
          const symbol = data.slice(offset, offset + symbolLen).toString("utf8").replace(/\u0000/g, "");
          
          if (symbol && name) {
            tokensWithMetadata.push({
              ...token,
              symbol: symbol.slice(0, 10),
              name: name.slice(0, 50),
            });
            metadataFound = true;
          }
        }
      } catch (e) {
        // Silently fail and continue
      }
      
      if (!metadataFound) {
        // Return with truncated mint as fallback
        tokensWithMetadata.push({
          ...token,
          symbol: `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
          name: "Unknown Token",
        });
      }
    }

    const result = {
      address,
      chain: "solana",
      nativeBalance: {
        symbol: "SOL",
        balance: solBalance,
        decimals: 9,
      },
      tokens: tokensWithMetadata,
      tokenCount: tokensWithMetadata.length,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching Solana wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data", details: (error as Error).message },
      { status: 500 }
    );
  }
}
