import { NextRequest, NextResponse } from "next/server";

// DexScreener API - supports price by contract address
const DEXSCREENER_API = "https://api.dexscreener.com";

// CoinGecko for major tokens
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINGECKO_RATE_LIMIT_BACKOFF_MS = 60_000;
let coinGeckoBackoffUntil = 0;

// Token ID mappings for CoinGecko (major tokens only)
const TOKEN_ID_MAP: Record<string, string> = {
  ETH: "ethereum",
  MATIC: "matic-network",
  BNB: "binancecoin",
  TRX: "tron",
  HYPE: "hyperliquid",
  SOL: "solana",
  AVAX: "avalanche-2",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  WBTC: "wrapped-bitcoin",
  WETH: "ethereum",
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

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI"]);
const WRAPPED_MAJOR_SYMBOLS = new Set(["WETH", "WBTC"]);

// Chain mapping for DexScreener
const CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
  bsc: "bsc",
  solana: "solana",
  hyperliquid: "hyperevm",
  "hyperliquid-mainnet": "hyperevm",
  tron: "tron",
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

    const defaultChainId = CHAIN_MAP[chain] || chain;
    const prices: Record<string, any> = {};
    const coinGeckoPrices = await fetchCoinGeckoPricesBySymbols(tokens);
    const jupiterPrices = await fetchJupiterPricesByMint(tokens, defaultChainId);

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
            const tokenChain = CHAIN_MAP[token.chain] || token.chain || defaultChainId;
            const dexPromise =
              address && tokenChain && isDexScreenerCompatibleAddress(address, tokenChain)
                ? fetchDexScreenerPrice(tokenChain, address)
                : Promise.resolve(null);
            const dexPrice = await dexPromise;
            const cgPrice = symbol ? coinGeckoPrices[symbol] : null;
            const jupiterPrice = address ? jupiterPrices[address] : null;

            // Prefer CoinGecko for clearly wrong DEX prices on stablecoins / low-liquidity pools.
            if (cgPrice?.usd && shouldPreferCoinGeckoPrice(symbol, dexPrice, cgPrice)) {
              prices[identifier] = {
                usd: cgPrice.usd,
                eur: cgPrice.eur,
                change24h: cgPrice.usd_24h_change,
                source: "coingecko",
              };
              return;
            }

            if (dexPrice) {
              if (
                jupiterPrice &&
                shouldPreferJupiterPrice(dexPrice, jupiterPrice)
              ) {
                prices[identifier] = {
                  usd: jupiterPrice.usd,
                  source: "jupiter",
                };
                return;
              }

              prices[identifier] = {
                usd: dexPrice.priceUsd,
                liquidity: dexPrice.liquidity,
                dex: dexPrice.dexId,
                source: "dexscreener",
                lowLiquidity: dexPrice.lowLiquidity,
              };
              return;
            }

            if (cgPrice?.usd) {
              prices[identifier] = {
                usd: cgPrice.usd,
                eur: cgPrice.eur,
                change24h: cgPrice.usd_24h_change,
                source: "coingecko",
              };
              return;
            }

            if (jupiterPrice?.usd) {
              prices[identifier] = {
                usd: jupiterPrice.usd,
                source: "jupiter",
              };
              return;
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

function shouldPreferCoinGeckoPrice(symbol: string | undefined, dexPrice: any, cgPrice: any) {
  if (!cgPrice?.usd) {
    return false;
  }

  if (!dexPrice?.priceUsd) {
    return true;
  }

  const dexUsd = Number(dexPrice.priceUsd);
  const cgUsd = Number(cgPrice.usd);

  if (!Number.isFinite(dexUsd) || !Number.isFinite(cgUsd) || cgUsd <= 0) {
    return true;
  }

  const divergence = Math.abs(dexUsd - cgUsd) / cgUsd;
  const normalizedSymbol = symbol?.toUpperCase() || "";

  if (STABLECOIN_SYMBOLS.has(normalizedSymbol) && divergence > 0.1) {
    return true;
  }

  // Wrapped majors should track the underlying closely.
  if (WRAPPED_MAJOR_SYMBOLS.has(normalizedSymbol) && divergence > 0.12) {
    return true;
  }

  if (dexPrice.lowLiquidity && divergence > 0.25) {
    return true;
  }

  return false;
}

function shouldPreferJupiterPrice(dexPrice: any, jupiterPrice: any) {
  if (!jupiterPrice?.usd) {
    return false;
  }

  if (!dexPrice?.priceUsd) {
    return true;
  }

  const dexUsd = Number(dexPrice.priceUsd);
  const jupUsd = Number(jupiterPrice.usd);

  if (!Number.isFinite(dexUsd) || !Number.isFinite(jupUsd) || jupUsd <= 0) {
    return true;
  }

  const divergence = Math.abs(dexUsd - jupUsd) / jupUsd;
  if (dexPrice.lowLiquidity && divergence > 0.15) {
    return true;
  }

  return divergence > 0.3;
}

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

async function fetchDexScreenerPrice(chainId: string, tokenAddress: string) {
  const chainCandidates = [chainId];
  if (chainId === "hyperevm") {
    chainCandidates.push("hyperliquid");
  }

  for (const chainCandidate of chainCandidates) {
    try {
      const response = await fetch(
        `${DEXSCREENER_API}/token-pairs/v1/${chainCandidate}/${tokenAddress}`,
        { next: { revalidate: 60 } }
      );

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }
        continue;
      }

      const data = await response.json();
      const pairs = extractDexPairs(data);

      if (pairs.length === 0) {
        continue;
      }

      // Get the pair with highest liquidity
      const bestPair = pickBestDexPair(pairs);

      if (!bestPair?.priceUsd) {
        continue;
      }

      const priceUsd = parseFloat(bestPair.priceUsd);

      if (!Number.isFinite(priceUsd)) {
        continue;
      }

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
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function isDexScreenerCompatibleAddress(address: string, chainId: string) {
  const normalizedChain = String(chainId || "").toLowerCase();

  if (normalizedChain === "solana") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  if (normalizedChain === "tron") {
    return (
      /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) ||
      /^41[a-fA-F0-9]{40}$/.test(address)
    );
  }

  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function fetchCoinGeckoPricesBySymbols(tokens: any[]) {
  if (Date.now() < coinGeckoBackoffUntil) {
    return {} as Record<string, any>;
  }

  const symbols = Array.from(
    new Set(
      tokens
        .map((token) => String(token?.symbol || "").toUpperCase())
        .filter((symbol) => Boolean(TOKEN_ID_MAP[symbol]))
    )
  );

  if (symbols.length === 0) {
    return {} as Record<string, any>;
  }

  const ids = Array.from(
    new Set(symbols.map((symbol) => TOKEN_ID_MAP[symbol]).filter(Boolean))
  ) as string[];

  const idPriceMap: Record<string, any> = {};
  const chunkSize = 50;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const idChunk = ids.slice(i, i + chunkSize);

    try {
      const params = new URLSearchParams({
        ids: idChunk.join(","),
        vs_currencies: "usd,eur",
        include_24hr_change: "true",
      });

      const response = await fetch(`${COINGECKO_API}/simple/price?${params.toString()}`, {
        next: { revalidate: 300 },
      });

      if (response.status === 429) {
        coinGeckoBackoffUntil = Date.now() + COINGECKO_RATE_LIMIT_BACKOFF_MS;
        console.warn("CoinGecko rate limit reached (429), falling back to DexScreener");
        break;
      }

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      Object.assign(idPriceMap, data);
    } catch {
      // Best effort only; DexScreener remains primary fallback.
    }
  }

  const symbolPriceMap: Record<string, any> = {};
  for (const symbol of symbols) {
    const id = TOKEN_ID_MAP[symbol];
    if (idPriceMap[id]) {
      symbolPriceMap[symbol] = idPriceMap[id];
    }
  }

  return symbolPriceMap;
}

async function fetchJupiterPricesByMint(tokens: any[], defaultChainId: string) {
  const shouldQueryJupiter = defaultChainId === "solana" || tokens.some((token) => token?.chain === "solana");
  if (!shouldQueryJupiter) {
    return {} as Record<string, { usd: number }>;
  }

  const mints = Array.from(
    new Set(
      tokens
        .map((token) => String(token?.mint || token?.contractAddress || ""))
        .filter((value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))
    )
  );

  if (mints.length === 0) {
    return {} as Record<string, { usd: number }>;
  }

  const endpointBuilders = [
    (ids: string) => `https://lite-api.jup.ag/price/v2?ids=${ids}`,
    (ids: string) => `https://api.jup.ag/price/v2?ids=${ids}`,
    (ids: string) => `https://price.jup.ag/v4/price?ids=${ids}`,
  ];

  const priceMap: Record<string, { usd: number }> = {};
  const chunkSize = 50;

  for (let i = 0; i < mints.length; i += chunkSize) {
    const mintChunk = mints.slice(i, i + chunkSize);
    const idsParam = encodeURIComponent(mintChunk.join(","));

    let chunkResolved = false;

    for (const buildEndpoint of endpointBuilders) {
      try {
        const response = await fetch(buildEndpoint(idsParam), {
          next: { revalidate: 60 },
        });

        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        const data = payload?.data;

        if (!data || typeof data !== "object") {
          continue;
        }

        for (const mint of mintChunk) {
          const entry = (data as any)[mint];
          const price = Number(entry?.price ?? entry?.usdPrice ?? entry?.value);
          if (Number.isFinite(price) && price > 0) {
            priceMap[mint] = { usd: price };
          }
        }

        chunkResolved = true;
        break;
      } catch {
        // Try next endpoint.
      }
    }

    if (!chunkResolved) {
      continue;
    }
  }

  return priceMap;
}
