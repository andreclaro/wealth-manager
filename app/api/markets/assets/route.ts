import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

// GET /api/markets/assets - List all available market assets
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    // Get all active market assets
    const assets = await prisma.marketAsset.findMany({
      where: { isActive: true },
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
    });

    // Get user's tracked assets to mark which ones are already selected
    const userTracked = await prisma.userMarketAsset.findMany({
      where: { userId },
      select: { assetId: true },
    });

    const trackedIds = new Set(userTracked.map((t) => t.assetId));

    const assetsWithTracked = assets.map((asset) => ({
      ...asset,
      isTracked: trackedIds.has(asset.id),
    }));

    return NextResponse.json(assetsWithTracked);
  } catch (err) {
    console.error("Error fetching market assets:", err);
    return NextResponse.json(
      { error: "Failed to fetch market assets" },
      { status: 500 }
    );
  }
}
