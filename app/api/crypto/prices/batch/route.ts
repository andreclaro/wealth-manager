import { NextRequest, NextResponse } from "next/server";

// DexScreener API - supports price by contract address
const DEXSCREENER_API = "https://api.dexscreener.com";

// CoinGecko for major tokens
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Token ID mappings for CoinGecko (major tokens only)
const TOKEN_ID_MAP: Record<string, string> = {
  ETH: "ethereum",
  MATIC: "matic-network",
  BNB: "binancecoin",
  SOL: "solana",
  AVAX: "avalanche-2",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  WBTC: "wrapped-bitcoin",
  WETH: "weth",
  UNI: "uniswap",
  LINK: "chainlink",
  AAVE: "aave",
  MKR: "maker",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  FLOKI: "floki",
  DOGE: "dogecoin",
  RAY: "raydium",
  SRM: "serum",
  FIDA: "bonfida",
  COPE: "cope",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  PYTH: "pyth-network",
};

// Chain mapping for DexScreener
const CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
  bsc: "bsc",
  solana: "solana",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, chain } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { error: "Tokens array is required" },
        { status: 400 }
      );
    }

    const chainId = CHAIN_MAP[chain] || chain;
    const prices: Record<string, any> = {};

    // Process in batches of 5 (DexScreener has stricter rate limits)
    const batchSize = 5;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (token) => {
          const symbol = token.symbol?.toUpperCase();
          const address = token.contractAddress || token.mint;
          const identifier = address || symbol;

          if (!identifier) return;

          // Skip tokens with obviously fake balances (airdrop spam)
          if (token.balance > 1e30) {
            prices[identifier] = { spam: true, reason: "Suspicious balance" };
            return;
          }

          try {
            // Try DexScreener first (supports any token with DEX liquidity)
            if (address && chainId) {
              const dexPrice = await fetchDexScreenerPrice(chainId, address);
              if (dexPrice) {
                prices[identifier] = {
                  usd: dexPrice.priceUsd,
                  liquidity: dexPrice.liquidity,
                  dex: dexPrice.dexId,
                  source: "dexscreener",
                  lowLiquidity: dexPrice.lowLiquidity,
                };
                return;
              }
            }

            // Fall back to CoinGecko for major tokens (by symbol)
            if (symbol && TOKEN_ID_MAP[symbol]) {
              const cgPrice = await fetchCoinGeckoPrice(symbol);
              if (cgPrice) {
                prices[identifier] = {
                  usd: cgPrice.usd,
                  eur: cgPrice.eur,
                  change24h: cgPrice.usd_24h_change,
                  source: "coingecko",
                };
                return;
              }
            }

            // No price found
            prices[identifier] = null;
          } catch (err) {
            console.error(`Failed to fetch price for ${identifier}:`, err);
            prices[identifier] = null;
          }
        })
      );

      // Delay between batches to avoid rate limits
      if (i + batchSize < tokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return NextResponse.json({ prices, chain });
  } catch (error) {
    console.error("Error fetching batch prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices", details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function fetchDexScreenerPrice(chainId: string, tokenAddress: string) {
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/token-pairs/v1/${chainId}/${tokenAddress}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Get the pair with highest liquidity
    const bestPair = data.pairs.sort((a: any, b: any) => {
      const liquidityA = a.liquidity?.usd || 0;
      const liquidityB = b.liquidity?.usd || 0;
      return liquidityB - liquidityA;
    })[0];

    if (!bestPair?.priceUsd) {
      return null;
    }

    const priceUsd = parseFloat(bestPair.priceUsd);
    const liquidity = bestPair.liquidity?.usd || 0;

    // Mark as low liquidity if under $10k
    const lowLiquidity = liquidity < 10000;

    return {
      priceUsd,
      liquidity,
      dexId: bestPair.dexId,
      volume24h: bestPair.volume?.h24,
      lowLiquidity,
    };
  } catch (error) {
    console.error("DexScreener fetch error:", error);
    return null;
  }
}

async function fetchCoinGeckoPrice(symbol: string) {
  try {
    const id = TOKEN_ID_MAP[symbol.toUpperCase()];
    if (!id) return null;

    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd,eur&include_24hr_change=true`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data[id];
  } catch (error) {
    console.error("CoinGecko fetch error:", error);
    return null;
  }
}
