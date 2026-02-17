import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAssetPrice } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// POST /api/prices/refresh - Refresh all asset prices for current user
export async function POST() {
  try {
    const userId = getCurrentUserId();
    const assets = await prisma.asset.findMany({
      where: {
        isManualPrice: false,
        account: {
          userId,
        },
      },
    });

    const results = [];
    const errors = [];

    for (const asset of assets) {
      try {
        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));

        const priceData = await fetchAssetPrice(asset.symbol, asset.type);

        if (!priceData) {
          errors.push({
            symbol: asset.symbol,
            error: "Failed to fetch price",
          });
          continue;
        }

        // Use appropriate currency
        const newPrice =
          asset.currency === "USD"
            ? priceData.usd
            : priceData.eur || priceData.usd;

        // Update asset
        const updatedAsset = await prisma.asset.update({
          where: { id: asset.id },
          data: {
            currentPrice: newPrice,
            priceUpdatedAt: new Date(),
          },
        });

        // Record price history
        await prisma.priceHistory.create({
          data: {
            assetId: asset.id,
            price: newPrice,
            quantity: asset.quantity,
            totalValue: newPrice * asset.quantity,
            currency: asset.currency,
          },
        });

        results.push({
          symbol: asset.symbol,
          previousPrice: asset.currentPrice,
          newPrice,
          change: newPrice - (asset.currentPrice || 0),
          changePercent:
            asset.currentPrice && asset.currentPrice > 0
              ? ((newPrice - asset.currentPrice) / asset.currentPrice) * 100
              : 0,
        });
      } catch (error) {
        console.error(`Error refreshing ${asset.symbol}:`, error);
        errors.push({
          symbol: asset.symbol,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      refreshed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error refreshing prices:", error);
    return NextResponse.json(
      { error: "Failed to refresh prices" },
      { status: 500 }
    );
  }
}
