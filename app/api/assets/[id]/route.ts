import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssetType, Currency } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/assets/:id - Get asset by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { id } = await params;
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        account: {
          userId,
        },
      },
      include: {
        priceHistory: {
          orderBy: { recordedAt: "desc" },
          take: 30,
        },
        account: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
      { status: 500 }
    );
  }
}

// PUT /api/assets/:id - Update asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { id } = await params;
    const body = await request.json();
    const {
      symbol,
      name,
      type,
      quantity,
      purchasePrice,
      currency,
      currentPrice,
      notes,
      isManualPrice,
      accountId,
    } = body;

    // Check if asset exists and belongs to current user
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        account: {
          userId,
        },
      },
    });

    if (!existingAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // If accountId is being changed, verify new account belongs to user
    if (accountId && accountId !== existingAsset.accountId) {
      const newAccount = await prisma.account.findUnique({
        where: { id: accountId, userId },
      });
      if (!newAccount) {
        return NextResponse.json(
          { error: "Target account not found or not owned by user" },
          { status: 404 }
        );
      }
    }

    // Prepare update data
    const updateData: {
      symbol?: string;
      name?: string;
      type?: AssetType;
      quantity?: number;
      purchasePrice?: number | null;
      currency?: Currency;
      currentPrice?: number | null;
      priceUpdatedAt?: Date | null;
      notes?: string | null;
      isManualPrice?: boolean;
      accountId?: string;
    } = {};

    if (symbol !== undefined) updateData.symbol = symbol.toUpperCase();
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as AssetType;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (purchasePrice !== undefined)
      updateData.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : null;
    if (currency !== undefined) updateData.currency = currency as Currency;
    if (notes !== undefined) updateData.notes = notes || null;
    if (isManualPrice !== undefined) updateData.isManualPrice = isManualPrice;
    if (accountId !== undefined) updateData.accountId = accountId;

    // Handle price update
    if (currentPrice !== undefined) {
      const newPrice = parseFloat(currentPrice);
      updateData.currentPrice = newPrice;
      updateData.priceUpdatedAt = new Date();

      // Record in price history if price changed significantly or quantity changed
      const priceChanged =
        Math.abs((existingAsset.currentPrice || 0) - newPrice) > 0.0001;
      const quantityChanged =
        updateData.quantity !== undefined &&
        Math.abs(updateData.quantity - existingAsset.quantity) > 0.0001;

      if (priceChanged || quantityChanged) {
        const finalQuantity = updateData.quantity || existingAsset.quantity;
        const finalCurrency = updateData.currency || existingAsset.currency;
        await prisma.priceHistory.create({
          data: {
            assetId: id,
            price: newPrice,
            quantity: finalQuantity,
            totalValue: newPrice * finalQuantity,
            currency: finalCurrency,
          },
        });
      }
    } else if (updateData.quantity !== undefined && existingAsset.currentPrice) {
      // Quantity changed but price didn't - still record history
      const finalCurrency = updateData.currency || existingAsset.currency;
      await prisma.priceHistory.create({
        data: {
          assetId: id,
          price: existingAsset.currentPrice,
          quantity: updateData.quantity,
          totalValue: existingAsset.currentPrice * updateData.quantity,
          currency: finalCurrency,
        },
      });
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}

// DELETE /api/assets/:id - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { id } = await params;

    // Check if asset exists and belongs to current user
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        account: {
          userId,
        },
      },
    });

    if (!existingAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await prisma.asset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
