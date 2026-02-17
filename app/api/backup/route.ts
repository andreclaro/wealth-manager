import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/backup - Export all data
export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "asc" },
    });

    const assets = await prisma.asset.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        priceHistory: {
          orderBy: { recordedAt: "asc" },
        },
      },
    });

    const exchangeRates = await prisma.exchangeRate.findMany({
      orderBy: { fetchedAt: "asc" },
    });

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      accounts,
      assets: assets.map((asset) => ({
        ...asset,
        // Exclude auto-generated relations that will be recreated
        priceHistory: asset.priceHistory.map((ph) => ({
          price: ph.price,
          quantity: ph.quantity,
          totalValue: ph.totalValue,
          currency: ph.currency,
          recordedAt: ph.recordedAt.toISOString(),
        })),
      })),
      exchangeRates,
    };

    return NextResponse.json(backup);
  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

// POST /api/backup/restore - Restore data from backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accounts, assets } = body;

    if (!accounts || !Array.isArray(accounts)) {
      return NextResponse.json(
        { error: "Invalid backup format: accounts array required" },
        { status: 400 }
      );
    }

    // Clear existing data (in reverse order of dependencies)
    await prisma.priceHistory.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.account.deleteMany({});

    // Create accounts first and map old IDs to new IDs
    const accountIdMap = new Map<string, string>();
    
    for (const account of accounts) {
      const { id: oldId, createdAt, updatedAt, ...accountData } = account;
      const newAccount = await prisma.account.create({
        data: {
          ...accountData,
          currency: accountData.currency || "EUR",
        },
      });
      accountIdMap.set(oldId, newAccount.id);
    }

    // Create assets with mapped account IDs
    for (const asset of assets || []) {
      const { 
        id: oldAssetId, 
        createdAt, 
        updatedAt, 
        accountId: oldAccountId,
        priceHistory,
        ...assetData 
      } = asset;

      // Map to new account ID
      const newAccountId = accountIdMap.get(oldAccountId);
      if (!newAccountId) {
        console.warn(`Skipping asset ${asset.symbol}: account not found`);
        continue;
      }

      const newAsset = await prisma.asset.create({
        data: {
          ...assetData,
          accountId: newAccountId,
          priceUpdatedAt: assetData.priceUpdatedAt 
            ? new Date(assetData.priceUpdatedAt) 
            : null,
        },
      });

      // Restore price history
      if (priceHistory && Array.isArray(priceHistory)) {
        for (const ph of priceHistory) {
          await prisma.priceHistory.create({
            data: {
              assetId: newAsset.id,
              price: ph.price,
              quantity: ph.quantity,
              totalValue: ph.totalValue,
              currency: ph.currency,
              recordedAt: new Date(ph.recordedAt),
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Restored ${accounts.length} accounts and ${assets?.length || 0} assets`,
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    return NextResponse.json(
      { error: "Failed to restore backup: " + (error as Error).message },
      { status: 500 }
    );
  }
}
