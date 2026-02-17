import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { AssetType, Currency } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/portfolio/summary - Get portfolio summary for current user
export async function GET() {
  try {
    const userId = getCurrentUserId();
    const assets = await prisma.asset.findMany({
      where: {
        account: {
          userId,
        },
      },
    });

    let totalValueUSD = 0;
    let totalValueEUR = 0;
    const assetsByType: Record<
      AssetType,
      { count: number; valueUSD: number; valueEUR: number }
    > = {
      STOCK: { count: 0, valueUSD: 0, valueEUR: 0 },
      ETF: { count: 0, valueUSD: 0, valueEUR: 0 },
      BOND: { count: 0, valueUSD: 0, valueEUR: 0 },
      REAL_ESTATE: { count: 0, valueUSD: 0, valueEUR: 0 },
      CRYPTO: { count: 0, valueUSD: 0, valueEUR: 0 },
      CASH: { count: 0, valueUSD: 0, valueEUR: 0 },
      SAVINGS: { count: 0, valueUSD: 0, valueEUR: 0 },
      COMMODITY: { count: 0, valueUSD: 0, valueEUR: 0 },
      OTHER: { count: 0, valueUSD: 0, valueEUR: 0 },
    };

    const assetsByCurrency: Record<
      Currency,
      { count: number; valueUSD: number; valueEUR: number }
    > = {
      USD: { count: 0, valueUSD: 0, valueEUR: 0 },
      EUR: { count: 0, valueUSD: 0, valueEUR: 0 },
      GBP: { count: 0, valueUSD: 0, valueEUR: 0 },
      CHF: { count: 0, valueUSD: 0, valueEUR: 0 },
      JPY: { count: 0, valueUSD: 0, valueEUR: 0 },
    };

    for (const asset of assets) {
      const currentPrice = asset.currentPrice || 0;
      const valueInAssetCurrency = currentPrice * asset.quantity;

      // Convert to USD and EUR
      const valueUSD = await convertCurrency(
        valueInAssetCurrency,
        asset.currency,
        "USD"
      );
      const valueEUR = await convertCurrency(
        valueInAssetCurrency,
        asset.currency,
        "EUR"
      );

      totalValueUSD += valueUSD;
      totalValueEUR += valueEUR;

      // Update by type
      assetsByType[asset.type].count += 1;
      assetsByType[asset.type].valueUSD += valueUSD;
      assetsByType[asset.type].valueEUR += valueEUR;

      // Update by currency
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
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary" },
      { status: 500 }
    );
  }
}
