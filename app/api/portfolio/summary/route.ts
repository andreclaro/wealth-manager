import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { AssetType, Currency } from "@prisma/client";
import { requireAuth, apiError } from "@/lib/api";

const INITIAL_ASSET_TYPE_DATA = { count: 0, valueUSD: 0, valueEUR: 0 };

const INITIAL_CURRENCY_DATA = { count: 0, valueUSD: 0, valueEUR: 0 };

// GET /api/portfolio/summary - Get portfolio summary for current user
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const assets = await prisma.asset.findMany({
      where: { account: { userId } },
    });

    let totalValueUSD = 0;
    let totalValueEUR = 0;

    const assetsByType = Object.fromEntries(
      Object.values(AssetType).map((type) => [type, { ...INITIAL_ASSET_TYPE_DATA }])
    ) as Record<AssetType, { count: number; valueUSD: number; valueEUR: number }>;

    const assetsByCurrency = Object.fromEntries(
      Object.values(Currency).map((curr) => [curr, { ...INITIAL_CURRENCY_DATA }])
    ) as Record<Currency, { count: number; valueUSD: number; valueEUR: number }>;

    for (const asset of assets) {
      const currentPrice = asset.currentPrice || 0;
      const valueInAssetCurrency = currentPrice * asset.quantity;

      const [valueUSD, valueEUR] = await Promise.all([
        convertCurrency(valueInAssetCurrency, asset.currency, "USD"),
        convertCurrency(valueInAssetCurrency, asset.currency, "EUR"),
      ]);

      totalValueUSD += valueUSD;
      totalValueEUR += valueEUR;

      assetsByType[asset.type].count += 1;
      assetsByType[asset.type].valueUSD += valueUSD;
      assetsByType[asset.type].valueEUR += valueEUR;

      assetsByCurrency[asset.currency].count += 1;
      assetsByCurrency[asset.currency].valueUSD += valueUSD;
      assetsByCurrency[asset.currency].valueEUR += valueEUR;
    }

    return NextResponse.json({
      totalValueUSD,
      totalValueEUR,
      totalAssets: assets.length,
      assetsByType,
      assetsByCurrency,
    });
  } catch (error) {
    console.error("Error fetching portfolio summary:", error);
    return apiError("Failed to fetch portfolio summary");
  }
}
