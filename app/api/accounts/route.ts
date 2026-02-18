import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { requireAuth, apiError } from "@/lib/api";
import { Currency } from "@prisma/client";

// Calculate account totals helper
async function calculateAccountTotals(account: { assets: Array<{ currentPrice: number | null; quantity: number; currency: Currency }> }) {
  let totalValueUSD = 0;
  let totalValueEUR = 0;

  for (const asset of account.assets) {
    const totalValue = (asset.currentPrice || 0) * asset.quantity;
    const [valueUSD, valueEUR] = await Promise.all([
      convertCurrency(totalValue, asset.currency, "USD"),
      convertCurrency(totalValue, asset.currency, "EUR"),
    ]);
    totalValueUSD += valueUSD;
    totalValueEUR += valueEUR;
  }

  return { totalValueUSD, totalValueEUR };
}

// GET /api/accounts - List all accounts with totals for current user
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const accounts = await prisma.portfolioAccount.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: { assets: true },
    });

    const accountsWithTotals = await Promise.all(
      accounts.map(async (account) => {
        const totals = await calculateAccountTotals(account);
        return {
          ...account,
          ...totals,
          assets: account.assets.map((asset) => ({
            ...asset,
            totalValue: (asset.currentPrice || 0) * asset.quantity,
            totalValueUSD: 0,
            totalValueEUR: 0,
          })),
        };
      })
    );

    return NextResponse.json(accountsWithTotals);
  } catch (err) {
    console.error("Error fetching accounts:", err);
    return apiError("Failed to fetch accounts");
  }
}

// POST /api/accounts - Create a new account for current user
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const { name, type, currency, notes } = await request.json();

    if (!name) {
      return apiError("Account name is required", 400);
    }

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: "User", email: "user@localhost" },
    });

    const account = await prisma.portfolioAccount.create({
      data: { name, type, currency: currency || "EUR", notes, userId },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error("Error creating account:", err);
    return apiError("Failed to create account");
  }
}
