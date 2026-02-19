import { NextRequest, NextResponse } from "next/server";

// CoinGecko API (free tier, no API key required)
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Token ID mappings (CoinGecko uses specific IDs)
const TOKEN_ID_MAP: Record<string, string> = {
  // Native tokens
  ETH: "ethereum",
  MATIC: "matic-network",
  BNB: "binancecoin",
  TRX: "tron",
  HYPE: "hyperliquid",
  SOL: "solana",
  AVAX: "avalanche-2",
  WAVAX: "wrapped-avax",
  SAVAX: "benqi-liquid-staked-avax",
  GGAVAX: "gogopool-ggavax",
  STAVAX: "gogopool-ggavax",
  
  // Major tokens
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
  
  // Solana tokens
  RAY: "raydium",
  SRM: "serum",
  FIDA: "bonfida",
  COPE: "cope",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  PYTH: "pyth-network",
  JitoSOL: "jito-staked-sol",
  mSOL: "marinade-staked-sol",
  bSOL: "blaze-staked-sol",
  stSOL: "lido-staked-sol",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get("symbols");
  const mints = searchParams.get("mints"); // For Solana
  const chain = searchParams.get("chain") || "ethereum";

  if (!symbols && !mints) {
    return NextResponse.json(
      { error: "Symbols or mints parameter is required" },
      { status: 400 }
    );
  }

  try {
    if (chain === "solana" && mints) {
      // For Solana, we'd ideally use Jupiter API
      // For now, return a mock structure
      return await fetchSolanaPrices(mints.split(","));
    }

    // EVM tokens - use CoinGecko
    if (symbols) {
      return await fetchEVMPrices(symbols.split(","));
    }

    return NextResponse.json({ prices: {} });
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices", details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function fetchEVMPrices(symbols: string[]) {
  // Map symbols to CoinGecko IDs
  const ids = symbols
    .map((s) => TOKEN_ID_MAP[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!ids) {
    return NextResponse.json({ prices: {} });
  }

  const response = await fetch(
    `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd,eur&include_24hr_change=true`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();

  // Map back to symbol-based response
  const prices: Record<string, any> = {};
  symbols.forEach((symbol) => {
    const id = TOKEN_ID_MAP[symbol.toUpperCase()];
    if (id && data[id]) {
      prices[symbol.toUpperCase()] = {
        usd: data[id].usd,
        eur: data[id].eur,
        usd_24h_change: data[id].usd_24h_change,
      };
    }
  });

  return NextResponse.json({ prices, source: "coingecko" });
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractDexPairs(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.pairs)) {
    return data.pairs;
  }

  return [];
}

function pickBestDexPair(pairs: any[]) {
  if (pairs.length === 0) {
    return null;
  }

  return pairs.reduce((best, current) => {
    const currentLiquidity = current?.liquidity?.usd || 0;
    const bestLiquidity = best?.liquidity?.usd || 0;
    return currentLiquidity > bestLiquidity ? current : best;
  });
}

async function fetchSolanaPrices(mints: string[]) {
  // Use DexScreener for Solana token prices (free, no API key)
  const prices: Record<string, { usd: number; mint: string }> = {};
  
  // Fetch prices sequentially with delays to avoid rate limits
  for (const mint of mints.slice(0, 10)) { // Limit to first 10 tokens
    try {
      await delay(150); // Delay between requests
      
      const response = await fetch(
        `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`,
        { next: { revalidate: 60 } }
      );

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      
      const pairs = extractDexPairs(data);

      if (pairs.length > 0) {
        // Get the pair with highest liquidity
        const bestPair = pickBestDexPair(pairs);
        
        if (bestPair?.priceUsd) {
          prices[mint] = {
            usd: parseFloat(bestPair.priceUsd),
            mint: mint,
          };
        }
      }
    } catch (error) {
      // Silently skip failed fetches
    }
  }
  
  return NextResponse.json({ 
    prices, 
    source: "dexscreener" 
  });
}

// Fetch single token price by contract address (using DexScreener as fallback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, tokenAddress } = body;

    if (!chainId || !tokenAddress) {
      return NextResponse.json(
        { error: "chainId and tokenAddress are required" },
        { status: 400 }
      );
    }

    // Use DexScreener for individual token prices
    const response = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    const pairs = extractDexPairs(data);

    if (pairs.length === 0) {
      return NextResponse.json({ price: null, found: false });
    }

    // Get the highest liquidity pair
    const bestPair = pickBestDexPair(pairs);

    if (!bestPair?.priceUsd || !bestPair?.priceNative) {
      return NextResponse.json({ price: null, found: false });
    }

    return NextResponse.json({
      price: {
        usd: parseFloat(bestPair.priceUsd),
        native: parseFloat(bestPair.priceNative),
      },
      pair: bestPair.pairAddress,
      dex: bestPair.dexId,
      liquidity: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
      found: true,
      source: "dexscreener",
    });
  } catch (error) {
    console.error("Error fetching token price:", error);
    return NextResponse.json(
      { error: "Failed to fetch price", details: (error as Error).message },
      { status: 500 }
    );
  }
}
