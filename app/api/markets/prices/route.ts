import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

// Symbol mapping for Yahoo Finance compatibility
function mapToYahooSymbol(symbol: string): string {
  const mapping: Record<string, string> = {
    // Indexes
    "SPX": "^GSPC",
    "IXIC": "^IXIC",
    "DJI": "^DJI",
    "FTSE": "^FTSE",
    "DAX": "^GDAXI",
    "N225": "^N225",
    "HSI": "^HSI",
    "STOXX50E": "^STOXX50E",
    // Commodities (futures)
    "GC=F": "GC=F",
    "SI=F": "SI=F",
    "CL=F": "CL=F",
    "BZ=F": "BZ=F",
    "NG=F": "NG=F",
    "PL=F": "PL=F",
    "PA=F": "PA=F",
    "HG=F": "HG=F",
  };
  return mapping[symbol.toUpperCase()] || symbol;
}

// Price fetchers for different asset types
async function fetchYahooPrice(symbol: string): Promise<Partial<MarketPriceData> | null> {
  try {
    const yahooSymbol = mapToYahooSymbol(symbol);
    // Use Yahoo Finance API (free, no key required for basic data)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) return null;

    const meta = result.meta;
    const regularMarketPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose;
    
    if (!regularMarketPrice) return null;

    const change = previousClose ? regularMarketPrice - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    return {
      price: regularMarketPrice,
      change,
      changePercent,
      high24h: meta.regularMarketDayHigh || null,
      low24h: meta.regularMarketDayLow || null,
      volume: meta.regularMarketVolume || null,
      source: "yahoo",
    };
  } catch (error) {
    console.error(`Error fetching Yahoo price for ${symbol}:`, error);
    return null;
  }
}

async function fetchCryptoPrice(symbol: string): Promise<Partial<MarketPriceData> | null> {
  try {
    // Use CoinGecko API for crypto
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${getCoinGeckoId(symbol)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const coinId = getCoinGeckoId(symbol);
    const coinData = data[coinId];
    
    if (!coinData) return null;

    return {
      price: coinData.usd,
      changePercent: coinData.usd_24h_change || 0,
      volume: coinData.usd_24h_vol || null,
      source: "coingecko",
    };
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error);
    return null;
  }
}

function getCoinGeckoId(symbol: string): string {
  const mapping: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    XRP: "ripple",
    DOGE: "dogecoin",
    ADA: "cardano",
    AVAX: "avalanche-2",
    LINK: "chainlink",
  };
  return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
}

interface MarketPriceData {
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  high24h?: number;
  low24h?: number;
  source: string;
}

// POST /api/markets/prices - Refresh prices for tracked assets
export async function POST() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    // Get user's tracked assets
    const tracked = await prisma.userMarketAsset.findMany({
      where: { userId },
      include: { asset: true },
    });

    const results = [];

    for (const item of tracked) {
      let priceData: Partial<MarketPriceData> | null = null;

      // Fetch price based on category
      if (item.asset.category === "CRYPTO") {
        priceData = await fetchCryptoPrice(item.asset.symbol);
      } else {
        priceData = await fetchYahooPrice(item.asset.symbol);
      }

      if (priceData) {
        // Update or create price cache
        const cached = await prisma.marketPriceCache.upsert({
          where: { assetId: item.assetId },
          update: {
            price: priceData.price!,
            change: priceData.change ?? null,
            changePercent: priceData.changePercent ?? null,
            volume: priceData.volume ?? null,
            high24h: priceData.high24h ?? null,
            low24h: priceData.low24h ?? null,
            source: priceData.source!,
            lastUpdated: new Date(),
          },
          create: {
            assetId: item.assetId,
            price: priceData.price!,
            change: priceData.change ?? null,
            changePercent: priceData.changePercent ?? null,
            volume: priceData.volume ?? null,
            high24h: priceData.high24h ?? null,
            low24h: priceData.low24h ?? null,
            source: priceData.source!,
          },
        });

        results.push({
          assetId: item.assetId,
          symbol: item.asset.symbol,
          price: cached.price,
          changePercent: cached.changePercent,
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      results,
    });
  } catch (err) {
    console.error("Error refreshing market prices:", err);
    return NextResponse.json(
      { error: "Failed to refresh prices" },
      { status: 500 }
    );
  }
}

// GET /api/markets/prices - Get cached prices
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const tracked = await prisma.userMarketAsset.findMany({
      where: { userId },
      include: {
        asset: {
          include: {
            priceCache: true,
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    // Check if any prices are stale (older than 5 minutes)
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    const hasStalePrices = tracked.some((item) => {
      if (!item.asset.priceCache) return true;
      const age = now.getTime() - item.asset.priceCache.lastUpdated.getTime();
      return age > staleThreshold;
    });

    return NextResponse.json({
      assets: tracked,
      hasStalePrices,
      lastUpdated: now.toISOString(),
    });
  } catch (err) {
    console.error("Error fetching market prices:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
