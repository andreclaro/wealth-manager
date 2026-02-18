import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { startOfDay, format } from "date-fns";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/portfolio/history - Get portfolio value history for current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam) : 30;
    const includeAssets = searchParams.get("includeAssets") === "true";

    // Calculate date range (if days is 0, get all history)
    const endDate = new Date();
    const startDate = days > 0 ? new Date() : null;
    if (startDate) {
      startDate.setDate(endDate.getDate() - days);
    }

    // Build date filter (only if days > 0)
    const dateFilter = startDate ? { gte: startDate, lte: endDate } : undefined;

    // Get all price history entries within the date range for current user's assets
    const historyEntries = await prisma.priceHistory.findMany({
      where: {
        ...(dateFilter && { recordedAt: dateFilter }),
        asset: {
          account: {
            userId,
          },
        },
      },
      include: {
        asset: true,
      },
      orderBy: {
        recordedAt: "asc",
      },
    });

    // Group by day and calculate total portfolio value
    const dailyValues: Map<
      string,
      { valueUSD: number; valueEUR: number; date: Date; assets: Map<string, { symbol: string; valueUSD: number; valueEUR: number }> }
    > = new Map();

    for (const entry of historyEntries) {
      const day = startOfDay(entry.recordedAt);
      const dayKey = format(day, "yyyy-MM-dd");

      // Convert to USD and EUR
      const valueUSD = await convertCurrency(
        entry.totalValue,
        entry.currency,
        "USD"
      );
      const valueEUR = await convertCurrency(
        entry.totalValue,
        entry.currency,
        "EUR"
      );

      if (dailyValues.has(dayKey)) {
        const existing = dailyValues.get(dayKey)!;
        existing.valueUSD += valueUSD;
        existing.valueEUR += valueEUR;
        
        // Track individual asset values
        if (includeAssets) {
          const assetKey = entry.asset.symbol;
          if (existing.assets.has(assetKey)) {
            const assetEntry = existing.assets.get(assetKey)!;
            assetEntry.valueUSD += valueUSD;
            assetEntry.valueEUR += valueEUR;
          } else {
            existing.assets.set(assetKey, {
              symbol: entry.asset.symbol,
              valueUSD,
              valueEUR,
            });
          }
        }
      } else {
        const assets = new Map<string, { symbol: string; valueUSD: number; valueEUR: number }>();
        if (includeAssets) {
          assets.set(entry.asset.symbol, {
            symbol: entry.asset.symbol,
            valueUSD,
            valueEUR,
          });
        }
        dailyValues.set(dayKey, {
          valueUSD,
          valueEUR,
          date: day,
          assets,
        });
      }
    }

    // Convert to array and sort by date
    const result = Array.from(dailyValues.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        date: format(item.date, "yyyy-MM-dd"),
        valueUSD: Math.round(item.valueUSD * 100) / 100,
        valueEUR: Math.round(item.valueEUR * 100) / 100,
        ...(includeAssets && {
          assets: Array.from(item.assets.values()).map(a => ({
            symbol: a.symbol,
            valueUSD: Math.round(a.valueUSD * 100) / 100,
            valueEUR: Math.round(a.valueEUR * 100) / 100,
          })),
        }),
      }));

    // If no history, try to get current values for current user's assets
    if (result.length === 0) {
      const assets = await prisma.asset.findMany({
        where: {
          account: {
            userId,
          },
        },
      });
      let totalValueUSD = 0;
      let totalValueEUR = 0;
      const currentAssets: { symbol: string; valueUSD: number; valueEUR: number }[] = [];

      for (const asset of assets) {
        const currentPrice = asset.currentPrice || 0;
        const valueInAssetCurrency = currentPrice * asset.quantity;

        const assetValueUSD = await convertCurrency(
          valueInAssetCurrency,
          asset.currency,
          "USD"
        );
        const assetValueEUR = await convertCurrency(
          valueInAssetCurrency,
          asset.currency,
          "EUR"
        );

        totalValueUSD += assetValueUSD;
        totalValueEUR += assetValueEUR;
        
        if (includeAssets) {
          currentAssets.push({
            symbol: asset.symbol,
            valueUSD: Math.round(assetValueUSD * 100) / 100,
            valueEUR: Math.round(assetValueEUR * 100) / 100,
          });
        }
      }

      const todayEntry: any = {
        date: format(new Date(), "yyyy-MM-dd"),
        valueUSD: Math.round(totalValueUSD * 100) / 100,
        valueEUR: Math.round(totalValueEUR * 100) / 100,
      };
      
      if (includeAssets) {
        todayEntry.assets = currentAssets;
      }
      
      result.push(todayEntry);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching portfolio history:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio history" },
      { status: 500 }
    );
  }
}
