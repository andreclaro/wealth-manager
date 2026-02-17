import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAssetPrice } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// POST /api/assets/:id/refresh - Refresh asset price
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCurrentUserId();
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

    // Fetch new price
    const priceData = await fetchAssetPrice(asset.symbol, asset.type);

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
