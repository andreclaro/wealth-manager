import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssetType, Currency } from "@prisma/client";
import { fetchAssetPrice, convertCurrency, isISIN, getBestTickerFromISIN } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/assets - List all assets for current user
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const assets = await prisma.asset.findMany({
      where: {
        account: {
          userId,
        },
      },
      orderBy: { name: "asc" },
      include: {
        account: true,
      },
    });

    // Calculate values with currency conversion
    const assetsWithValue = await Promise.all(
      assets.map(async (asset) => {
        const currentPrice = asset.currentPrice || 0;
        const totalValue = currentPrice * asset.quantity;

        // Convert to USD and EUR
        const totalValueUSD = await convertCurrency(
          totalValue,
          asset.currency,
          "USD"
        );
        const totalValueEUR = await convertCurrency(
          totalValue,
          asset.currency,
          "EUR"
        );

        return {
          ...asset,
          totalValue,
          totalValueUSD,
          totalValueEUR,
        };
      })
    );

    return NextResponse.json(assetsWithValue);
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

// POST /api/assets - Create new asset
export async function POST(request: NextRequest) {
  try {
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

    // Validate required fields
    if (!symbol || !name || !type || quantity === undefined || !accountId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );

    }

    // Verify account belongs to current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const account = await prisma.portfolioAccount.findUnique({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or not owned by user" },
        { status: 404 }
      );
    }

    // Resolve ISIN to ticker if needed
    let finalSymbol = symbol.toUpperCase().trim();
    let finalName = name;
    
    if (isISIN(finalSymbol)) {
      const isinData = await getBestTickerFromISIN(finalSymbol, currency);
      if (isinData) {
        finalSymbol = isinData.symbol;
        // Use API name if user didn't provide a custom name
        if (!finalName || finalName === finalSymbol) {
          finalName = isinData.name;
        }
      }
    }

    // Fetch current price if not manual and not provided
    let finalPrice = currentPrice;
    let priceUpdatedAt = null;

    if (!isManualPrice && !currentPrice) {
      const priceData = await fetchAssetPrice(finalSymbol, type);
      if (priceData) {
        // Store price in asset's currency
        finalPrice =
          currency === "USD" ? priceData.usd : priceData.eur || priceData.usd;
        priceUpdatedAt = new Date();
      }
    } else if (currentPrice) {
      priceUpdatedAt = new Date();
    }

    // Create asset
    const asset = await prisma.asset.create({
      data: {
        symbol: finalSymbol,
        name: finalName,
        type: type as AssetType,
        quantity: parseFloat(quantity),
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        currency: (currency as Currency) || "EUR",
        currentPrice: finalPrice ? parseFloat(finalPrice) : null,
        priceUpdatedAt,
        notes: notes || null,
        isManualPrice: isManualPrice || false,
        accountId,
      },
    });

    // Record initial price history if price is available
    if (asset.currentPrice) {
      const totalValue = asset.currentPrice * asset.quantity;
      await prisma.priceHistory.create({
        data: {
          assetId: asset.id,
          price: asset.currentPrice,
          quantity: asset.quantity,
          totalValue,
          currency: asset.currency,
        },
      });
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    );
  }
}
