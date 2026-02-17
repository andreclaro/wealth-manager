import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { startOfDay, format } from "date-fns";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/portfolio/history - Get portfolio value history for current user
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get all price history entries within the date range for current user's assets
    const historyEntries = await prisma.priceHistory.findMany({
      where: {
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
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
      { valueUSD: number; valueEUR: number; date: Date }
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
      } else {
        dailyValues.set(dayKey, {
          valueUSD,
          valueEUR,
          date: day,
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

      for (const asset of assets) {
        const currentPrice = asset.currentPrice || 0;
        const valueInAssetCurrency = currentPrice * asset.quantity;

        totalValueUSD += await convertCurrency(
          valueInAssetCurrency,
          asset.currency,
          "USD"
        );
        totalValueEUR += await convertCurrency(
          valueInAssetCurrency,
          asset.currency,
          "EUR"
        );
      }

      result.push({
        date: format(new Date(), "yyyy-MM-dd"),
        valueUSD: Math.round(totalValueUSD * 100) / 100,
        valueEUR: Math.round(totalValueEUR * 100) / 100,
      });
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
