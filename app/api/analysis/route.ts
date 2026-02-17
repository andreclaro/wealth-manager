import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";
import { AssetType, Currency } from "@prisma/client";

interface AssetPerformance {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  currency: Currency;
  costBasis: number;
  costBasisUSD: number;
  currentValue: number;
  currentValueUSD: number;
  unrealizedPnL: number;
  unrealizedPnLUSD: number;
  returnPercent: number;
  allocationPercent: number;
}

// GET /api/analysis - Get portfolio analysis data
export async function GET() {
  try {
    const userId = getCurrentUserId();

    // Get all assets for the user with their accounts
    const assets = await prisma.asset.findMany({
      where: {
        account: {
          userId,
        },
      },
      include: {
        account: {
          select: {
            name: true,
          },
        },
      },
    });

    if (assets.length === 0) {
      return NextResponse.json({
        summary: {
          totalInvestedUSD: 0,
          currentValueUSD: 0,
          totalUnrealizedPnLUSD: 0,
          totalReturnPercent: 0,
        },
        performance: [],
        allocation: {
          byType: {},
          byCurrency: {},
          byAccount: {},
        },
        riskMetrics: {
          topHoldings: [],
          currencyExposure: [],
          typeConcentration: [],
          diversificationScore: 0,
        },
        topPerformers: [],
        worstPerformers: [],
      });
    }

    // Calculate performance for each asset
    const performanceData: AssetPerformance[] = [];
    let totalInvestedUSD = 0;
    let totalCurrentValueUSD = 0;

    for (const asset of assets) {
      const purchasePrice = asset.purchasePrice || 0;
      const currentPrice = asset.currentPrice || 0;
      const quantity = asset.quantity;

      // Calculate in asset's currency
      const costBasis = purchasePrice * quantity;
      const currentValue = currentPrice * quantity;
      const unrealizedPnL = currentValue - costBasis;

      // Convert to USD for aggregation
      const costBasisUSD = await convertCurrency(costBasis, asset.currency, "USD");
      const currentValueUSD = await convertCurrency(currentValue, asset.currency, "USD");
      const unrealizedPnLUSD = currentValueUSD - costBasisUSD;

      // Calculate return percentage
      const returnPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

      totalInvestedUSD += costBasisUSD;
      totalCurrentValueUSD += currentValueUSD;

      performanceData.push({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        quantity,
        currency: asset.currency,
        costBasis,
        costBasisUSD,
        currentValue,
        currentValueUSD,
        unrealizedPnL,
        unrealizedPnLUSD,
        returnPercent,
        allocationPercent: 0, // Will calculate after we have total
      });
    }

    // Calculate allocation percentages
    for (const asset of performanceData) {
      asset.allocationPercent = totalCurrentValueUSD > 0
        ? (asset.currentValueUSD / totalCurrentValueUSD) * 100
        : 0;
    }

    // Sort by current value (descending) for various analyses
    const sortedByValue = [...performanceData].sort((a, b) => b.currentValueUSD - a.currentValueUSD);
    const sortedByReturn = [...performanceData].sort((a, b) => b.returnPercent - a.returnPercent);

    // Calculate allocation breakdowns
    const allocationByType: Record<string, { valueUSD: number; percent: number; count: number }> = {};
    const allocationByCurrency: Record<string, { valueUSD: number; percent: number; count: number }> = {};
    const allocationByAccount: Record<string, { valueUSD: number; percent: number; count: number }> = {};

    for (const asset of performanceData) {
      // By type
      if (!allocationByType[asset.type]) {
        allocationByType[asset.type] = { valueUSD: 0, percent: 0, count: 0 };
      }
      allocationByType[asset.type].valueUSD += asset.currentValueUSD;
      allocationByType[asset.type].count += 1;

      // By currency
      if (!allocationByCurrency[asset.currency]) {
        allocationByCurrency[asset.currency] = { valueUSD: 0, percent: 0, count: 0 };
      }
      allocationByCurrency[asset.currency].valueUSD += asset.currentValueUSD;
      allocationByCurrency[asset.currency].count += 1;

      // By account
      const accountName = assets.find((a) => a.id === asset.id)?.account.name || "Unknown";
      if (!allocationByAccount[accountName]) {
        allocationByAccount[accountName] = { valueUSD: 0, percent: 0, count: 0 };
      }
      allocationByAccount[accountName].valueUSD += asset.currentValueUSD;
      allocationByAccount[accountName].count += 1;
    }

    // Calculate percentages for allocations
    for (const key of Object.keys(allocationByType)) {
      allocationByType[key].percent = totalCurrentValueUSD > 0
        ? (allocationByType[key].valueUSD / totalCurrentValueUSD) * 100
        : 0;
    }
    for (const key of Object.keys(allocationByCurrency)) {
      allocationByCurrency[key].percent = totalCurrentValueUSD > 0
        ? (allocationByCurrency[key].valueUSD / totalCurrentValueUSD) * 100
        : 0;
    }
    for (const key of Object.keys(allocationByAccount)) {
      allocationByAccount[key].percent = totalCurrentValueUSD > 0
        ? (allocationByAccount[key].valueUSD / totalCurrentValueUSD) * 100
        : 0;
    }

    // Risk metrics
    const topHoldings = sortedByValue.slice(0, 5).map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      valueUSD: asset.currentValueUSD,
      allocationPercent: asset.allocationPercent,
    }));

    // Type concentration risk
    const typeConcentration = Object.entries(allocationByType)
      .map(([type, data]) => ({ type, percent: data.percent }))
      .sort((a, b) => b.percent - a.percent);

    // Currency exposure
    const currencyExposure = Object.entries(allocationByCurrency)
      .map(([currency, data]) => ({ currency, percent: data.percent }))
      .sort((a, b) => b.percent - a.percent);

    const totalUnrealizedPnLUSD = totalCurrentValueUSD - totalInvestedUSD;
    const totalReturnPercent = totalInvestedUSD > 0
      ? (totalUnrealizedPnLUSD / totalInvestedUSD) * 100
      : 0;

    return NextResponse.json({
      summary: {
        totalInvestedUSD,
        currentValueUSD: totalCurrentValueUSD,
        totalUnrealizedPnLUSD,
        totalReturnPercent,
      },
      performance: performanceData,
      topPerformers: sortedByReturn.slice(0, 5),
      worstPerformers: sortedByReturn.slice(-5).reverse(),
      allocation: {
        byType: allocationByType,
        byCurrency: allocationByCurrency,
        byAccount: allocationByAccount,
      },
      riskMetrics: {
        topHoldings,
        typeConcentration,
        currencyExposure,
        diversificationScore: calculateDiversificationScore(allocationByType),
      },
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 }
    );
  }
}

// Simple diversification score (0-100) based on type distribution
function calculateDiversificationScore(
  allocationByType: Record<string, { valueUSD: number; percent: number; count: number }>
): number {
  const percents = Object.values(allocationByType).map((a) => a.percent);
  
  if (percents.length === 0) return 0;
  if (percents.length === 1) return 20; // Single asset type is risky

  // Calculate Herfindahl-Hirschman Index (HHI)
  const hhi = percents.reduce((sum, p) => sum + Math.pow(p, 2), 0);
  
  // Convert to 0-100 score (lower HHI = more diversified)
  // Max HHI is 10000 (100^2), min for N types is 10000/N
  const maxHHI = 10000;
  const minHHI = 10000 / percents.length;
  const normalizedHHI = (hhi - minHHI) / (maxHHI - minHHI);
  
  // Invert so higher score = more diversified
  const score = Math.round((1 - normalizedHHI) * 100);
  
  return Math.max(0, Math.min(100, score));
}
