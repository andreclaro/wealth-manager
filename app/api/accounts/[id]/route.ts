import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/accounts/[id] - Get a specific account with assets and totals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const account = await prisma.portfolioAccount.findUnique({
      where: { id, userId },
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Calculate totals
    let totalValueUSD = 0;
    let totalValueEUR = 0;

    const assetsWithValue = await Promise.all(
      account.assets.map(async (asset) => {
        const currentPrice = asset.currentPrice || 0;
        const totalValue = currentPrice * asset.quantity;

        const assetValueUSD = await convertCurrency(
          totalValue,
          asset.currency,
          "USD"
        );
        const assetValueEUR = await convertCurrency(
          totalValue,
          asset.currency,
          "EUR"
        );

        totalValueUSD += assetValueUSD;
        totalValueEUR += assetValueEUR;

        return {
          ...asset,
          totalValue,
          totalValueUSD: assetValueUSD,
          totalValueEUR: assetValueEUR,
        };
      })
    );

    return NextResponse.json({
      ...account,
      totalValueUSD,
      totalValueEUR,
      assets: assetsWithValue,
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id] - Update an account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const { name, type, currency, notes } = body;

    // Verify account belongs to current user
    const existingAccount = await prisma.portfolioAccount.findUnique({
      where: { id, userId },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const account = await prisma.portfolioAccount.update({
      where: { id },
      data: {
        name,
        type,
        currency,
        notes,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[id] - Delete an account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Check if account has assets and belongs to current user
    const account = await prisma.portfolioAccount.findUnique({
      where: { id, userId },
      include: { _count: { select: { assets: true } } },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (account._count.assets > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with assets. Move or delete assets first." },
        { status: 400 }
      );
    }

    await prisma.portfolioAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
