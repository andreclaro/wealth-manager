import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssetType, Currency } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth";
import { isISIN, getBestTickerFromISIN } from "@/lib/services/priceService";
import { startOfDay, endOfDay } from "date-fns";

// GET /api/assets/:id - Get asset by ID
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
      updateMode = "modify",
      fixDate,
    } = body;

    // Check if asset exists and belongs to current user
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        account: {
          userId,
        },
      },
      include: {
        priceHistory: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!existingAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // If accountId is being changed, verify new account belongs to user
    if (accountId && accountId !== existingAsset.accountId) {
      const newAccount = await prisma.portfolioAccount.findUnique({
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

    // Resolve ISIN to ticker if needed
    if (symbol !== undefined) {
      let finalSymbol = symbol.toUpperCase().trim();
      let finalName = name;
      
      if (isISIN(finalSymbol)) {
        const isinData = await getBestTickerFromISIN(finalSymbol, updateData.currency);
        if (isinData) {
          finalSymbol = isinData.symbol;
          // Use API name if user didn't provide a custom name
          if (!finalName || finalName === symbol.toUpperCase().trim()) {
            finalName = isinData.name;
          }
        }
      }
      
      updateData.symbol = finalSymbol;
      if (finalName !== undefined) updateData.name = finalName;
    } else if (name !== undefined) {
      updateData.name = name;
    }
    if (type !== undefined) updateData.type = type as AssetType;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (purchasePrice !== undefined)
      updateData.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : null;
    if (currency !== undefined) updateData.currency = currency as Currency;
    if (notes !== undefined) updateData.notes = notes || null;
    if (isManualPrice !== undefined) updateData.isManualPrice = isManualPrice;
    if (accountId !== undefined) updateData.accountId = accountId;

    // Handle price update
    const newPrice = currentPrice !== undefined ? parseFloat(currentPrice) : undefined;
    const newQuantity = quantity !== undefined ? parseFloat(quantity) : undefined;
    
    if (newPrice !== undefined) {
      updateData.currentPrice = newPrice;
      updateData.priceUpdatedAt = new Date();
    }

    // Handle history updates based on updateMode
    if (updateMode === "new") {
      // Add new entry - always create a new history record
      const finalPrice = newPrice ?? existingAsset.currentPrice ?? 0;
      const finalQuantity = newQuantity ?? existingAsset.quantity;
      const finalCurrency = updateData.currency ?? existingAsset.currency;
      
      await prisma.priceHistory.create({
        data: {
          assetId: id,
          price: finalPrice,
          quantity: finalQuantity,
          totalValue: finalPrice * finalQuantity,
          currency: finalCurrency,
          recordedAt: new Date(),
        },
      });
    } else if (updateMode === "fix" && fixDate) {
      // Fix older entry - find the closest history entry to the fixDate
      const targetDate = new Date(fixDate);
      const startOfTargetDay = startOfDay(targetDate);
      const endOfTargetDay = endOfDay(targetDate);

      // Find history entry closest to the target date
      const historyEntries = await prisma.priceHistory.findMany({
        where: {
          assetId: id,
          recordedAt: {
            gte: new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Within 7 days before
            lte: new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Within 7 days after
          },
        },
        orderBy: { recordedAt: "asc" },
      });

      if (historyEntries.length > 0) {
        // Find the entry closest to the target date
        const closestEntry = historyEntries.reduce((closest, entry) => {
          const entryDate = new Date(entry.recordedAt).getTime();
          const targetTime = targetDate.getTime();
          const closestTime = new Date(closest.recordedAt).getTime();
          return Math.abs(entryDate - targetTime) < Math.abs(closestTime - targetTime)
            ? entry
            : closest;
        });

        // Update the history entry with new values
        const finalPrice = newPrice ?? closestEntry.price;
        const finalQuantity = newQuantity ?? closestEntry.quantity;
        
        await prisma.priceHistory.update({
          where: { id: closestEntry.id },
          data: {
            price: finalPrice,
            quantity: finalQuantity,
            totalValue: finalPrice * finalQuantity,
            ...(updateData.currency && { currency: updateData.currency }),
          },
        });
      } else {
        // No existing entry found near that date, create one at that date
        const finalPrice = newPrice ?? existingAsset.currentPrice ?? 0;
        const finalQuantity = newQuantity ?? existingAsset.quantity;
        const finalCurrency = updateData.currency ?? existingAsset.currency;
        
        await prisma.priceHistory.create({
          data: {
            assetId: id,
            price: finalPrice,
            quantity: finalQuantity,
            totalValue: finalPrice * finalQuantity,
            currency: finalCurrency,
            recordedAt: targetDate,
          },
        });
      }
    } else {
      // Modify mode (default) - only create history if values changed significantly
      const finalPrice = newPrice ?? existingAsset.currentPrice ?? 0;
      const finalQuantity = newQuantity ?? existingAsset.quantity;
      
      const priceChanged = newPrice !== undefined &&
        Math.abs((existingAsset.currentPrice || 0) - newPrice) > 0.0001;
      const quantityChanged = newQuantity !== undefined &&
        Math.abs(newQuantity - existingAsset.quantity) > 0.0001;

      if (priceChanged || quantityChanged) {
        const finalCurrency = updateData.currency ?? existingAsset.currency;
        await prisma.priceHistory.create({
          data: {
            assetId: id,
            price: finalPrice,
            quantity: finalQuantity,
            totalValue: finalPrice * finalQuantity,
            currency: finalCurrency,
          },
        });
      }
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
