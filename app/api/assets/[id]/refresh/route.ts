import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAssetPrice, isISIN, getBestTickerFromISIN } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// POST /api/assets/:id/refresh - Refresh asset price
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Get asset for current user
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        account: {
          userId,
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Skip if manual price
    if (asset.isManualPrice) {
      return NextResponse.json({
        message: "Asset has manual price, skipping refresh",
        asset,
      });
    }

    // Fetch new price (handle ISIN if stored as symbol)
    let symbolToFetch = asset.symbol;
    
    // If symbol looks like an ISIN, resolve it to ticker
    if (isISIN(symbolToFetch)) {
      const isinData = await getBestTickerFromISIN(symbolToFetch, asset.currency);
      if (isinData) {
        symbolToFetch = isinData.symbol;
        // Also update the asset symbol to the ticker for future refreshes
        await prisma.asset.update({
          where: { id },
          data: { symbol: isinData.symbol, name: isinData.name || asset.name },
        });
      }
    }
    
    const priceData = await fetchAssetPrice(symbolToFetch, asset.type);

    if (!priceData) {
      return NextResponse.json(
        { error: "Failed to fetch price" },
        { status: 502 }
      );
    }

    // Use appropriate currency
    const newPrice =
      asset.currency === "USD" ? priceData.usd : priceData.eur || priceData.usd;

    // Update asset
    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        currentPrice: newPrice,
        priceUpdatedAt: new Date(),
      },
    });

    // Record price history
    await prisma.priceHistory.create({
      data: {
        assetId: id,
        price: newPrice,
        quantity: asset.quantity,
        totalValue: newPrice * asset.quantity,
        currency: asset.currency,
      },
    });

    return NextResponse.json({
      message: "Price refreshed successfully",
      asset: updatedAsset,
      previousPrice: asset.currentPrice,
      newPrice,
    });
  } catch (error) {
    console.error("Error refreshing asset price:", error);
    return NextResponse.json(
      { error: "Failed to refresh price" },
      { status: 500 }
    );
  }
}
