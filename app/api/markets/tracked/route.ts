import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

// GET /api/markets/tracked - Get user's tracked market assets with prices
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

    return NextResponse.json(tracked);
  } catch (err) {
    console.error("Error fetching tracked assets:", err);
    return NextResponse.json(
      { error: "Failed to fetch tracked assets" },
      { status: 500 }
    );
  }
}

// POST /api/markets/tracked - Add an asset to track
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const { assetId } = await request.json();

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Check if asset exists
    const asset = await prisma.marketAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Get current max display order
    const maxOrder = await prisma.userMarketAsset.findFirst({
      where: { userId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    const tracked = await prisma.userMarketAsset.create({
      data: {
        userId,
        assetId,
        displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      },
      include: {
        asset: {
          include: {
            priceCache: true,
          },
        },
      },
    });

    return NextResponse.json(tracked, { status: 201 });
  } catch (err) {
    console.error("Error adding tracked asset:", err);
    return NextResponse.json(
      { error: "Failed to add tracked asset" },
      { status: 500 }
    );
  }
}
