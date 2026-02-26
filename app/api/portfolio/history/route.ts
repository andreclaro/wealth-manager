import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { addDays, format, startOfDay } from "date-fns";
import { getCurrentUserId } from "@/lib/auth";

type AssetSnapshot = {
  symbol: string;
  valueUSD: number;
  valueEUR: number;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

// GET /api/portfolio/history - Get portfolio value history for current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const includeAssets = searchParams.get("includeAssets") === "true";

    // Validate and sanitize days parameter (0 for all-time, otherwise 1-365 range)
    let days = 30;
    if (daysParam !== null) {
      const parsed = Number.parseInt(daysParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        days = parsed === 0 ? 0 : Math.min(parsed, 365);
      }
    }

    // Calculate date range (if days is 0, get full history)
    const endDate = new Date();
    const endDay = startOfDay(endDate);
    let startDate: Date | null = null;
    if (days > 0) {
      startDate = startOfDay(new Date(endDate));
      startDate.setDate(startDate.getDate() - days);
    }

    // We fetch all entries until today to seed values before the selected range
    const historyEntries = await prisma.priceHistory.findMany({
      where: {
        recordedAt: { lte: endDate },
        asset: {
          account: {
            userId,
          },
        },
      },
      select: {
        assetId: true,
        totalValue: true,
        currency: true,
        recordedAt: true,
        asset: {
          select: {
            symbol: true,
          },
        },
      },
      orderBy: {
        recordedAt: "asc",
      },
    });

    // Day-level updates keyed by asset id so multiple updates in the same day keep only the latest value
    const updatesByDay = new Map<string, Map<string, AssetSnapshot>>();
    // Current "as-of-day" value for each asset
    const activeAssetSnapshots = new Map<string, AssetSnapshot>();
    let firstDayInRangeWithUpdate: Date | null = null;
    const selectedStartTime = startDate?.getTime() ?? null;

    for (const entry of historyEntries) {
      const [valueUSD, valueEUR] = await Promise.all([
        convertCurrency(entry.totalValue, entry.currency, "USD"),
        convertCurrency(entry.totalValue, entry.currency, "EUR"),
      ]);
      const snapshot: AssetSnapshot = {
        symbol: entry.asset.symbol,
        valueUSD,
        valueEUR,
      };
      const day = startOfDay(entry.recordedAt);
      const dayTime = day.getTime();

      // Seed latest known value before the requested window
      if (selectedStartTime !== null && dayTime < selectedStartTime) {
        activeAssetSnapshots.set(entry.assetId, snapshot);
        continue;
      }

      const dayKey = format(day, "yyyy-MM-dd");
      let dayUpdates = updatesByDay.get(dayKey);
      if (!dayUpdates) {
        dayUpdates = new Map<string, AssetSnapshot>();
        updatesByDay.set(dayKey, dayUpdates);
      }
      dayUpdates.set(entry.assetId, snapshot);

      if (!firstDayInRangeWithUpdate) {
        firstDayInRangeWithUpdate = day;
      }
    }

    const firstHistoryDay =
      historyEntries.length > 0
        ? startOfDay(historyEntries[0].recordedAt)
        : endDay;
    const requestedStartDay = startDate ?? firstHistoryDay;
    let iterationStartDay = requestedStartDay;

    if (startDate && activeAssetSnapshots.size === 0 && firstDayInRangeWithUpdate) {
      iterationStartDay = firstDayInRangeWithUpdate;
    }
    if (iterationStartDay.getTime() > endDay.getTime()) {
      iterationStartDay = endDay;
    }

    const result: Array<{
      date: string;
      valueUSD: number;
      valueEUR: number;
      assets?: Array<{ symbol: string; valueUSD: number; valueEUR: number }>;
    }> = [];

    for (
      let day = new Date(iterationStartDay);
      day.getTime() <= endDay.getTime();
      day = addDays(day, 1)
    ) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayUpdates = updatesByDay.get(dayKey);

      if (dayUpdates) {
        for (const [assetId, snapshot] of dayUpdates) {
          activeAssetSnapshots.set(assetId, snapshot);
        }
      }

      if (activeAssetSnapshots.size === 0) {
        continue;
      }

      let totalValueUSD = 0;
      let totalValueEUR = 0;
      for (const snapshot of activeAssetSnapshots.values()) {
        totalValueUSD += snapshot.valueUSD;
        totalValueEUR += snapshot.valueEUR;
      }

      const dayResult: {
        date: string;
        valueUSD: number;
        valueEUR: number;
        assets?: Array<{ symbol: string; valueUSD: number; valueEUR: number }>;
      } = {
        date: dayKey,
        valueUSD: roundToCents(totalValueUSD),
        valueEUR: roundToCents(totalValueEUR),
      };

      if (includeAssets) {
        const assetsBySymbol = new Map<string, AssetSnapshot>();

        for (const snapshot of activeAssetSnapshots.values()) {
          const existing = assetsBySymbol.get(snapshot.symbol);
          if (existing) {
            existing.valueUSD += snapshot.valueUSD;
            existing.valueEUR += snapshot.valueEUR;
          } else {
            assetsBySymbol.set(snapshot.symbol, {
              symbol: snapshot.symbol,
              valueUSD: snapshot.valueUSD,
              valueEUR: snapshot.valueEUR,
            });
          }
        }

        dayResult.assets = Array.from(assetsBySymbol.values())
          .sort((a, b) => b.valueEUR - a.valueEUR)
          .map((asset) => ({
            symbol: asset.symbol,
            valueUSD: roundToCents(asset.valueUSD),
            valueEUR: roundToCents(asset.valueEUR),
          }));
      }

      result.push(dayResult);
    }

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
            valueUSD: roundToCents(assetValueUSD),
            valueEUR: roundToCents(assetValueEUR),
          });
        }
      }

      const todayEntry: {
        date: string;
        valueUSD: number;
        valueEUR: number;
        assets?: Array<{ symbol: string; valueUSD: number; valueEUR: number }>;
      } = {
        date: format(new Date(), "yyyy-MM-dd"),
        valueUSD: roundToCents(totalValueUSD),
        valueEUR: roundToCents(totalValueEUR),
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
