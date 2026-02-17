import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/services/priceService";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/accounts - List all accounts with totals for current user
export async function GET() {
  try {
    const userId = getCurrentUserId();
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: {
        assets: true,
      },
    });

    // Calculate totals for each account
    const accountsWithTotals = await Promise.all(
      accounts.map(async (account) => {
        let totalValueUSD = 0;
        let totalValueEUR = 0;

        for (const asset of account.assets) {
          const currentPrice = asset.currentPrice || 0;
          const totalValue = currentPrice * asset.quantity;

          const valueUSD = await convertCurrency(
            totalValue,
            asset.currency,
            "USD"
          );
          const valueEUR = await convertCurrency(
            totalValue,
            asset.currency,
            "EUR"
          );

          totalValueUSD += valueUSD;
          totalValueEUR += valueEUR;
        }

        return {
          ...account,
          totalValueUSD,
          totalValueEUR,
          assets: account.assets.map((asset) => ({
            ...asset,
            totalValue: (asset.currentPrice || 0) * asset.quantity,
            totalValueUSD: 0, // Will be calculated per asset when needed
            totalValueEUR: 0,
          })),
        };
      })
    );

    return NextResponse.json(accountsWithTotals);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/accounts - Create a new account for current user
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    const body = await request.json();
    const { name, type, currency, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    // Ensure the dev user row exists (FK requirement for development mode)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: "Development User",
        email: "dev@localhost",
      },
    });

    const account = await prisma.account.create({
      data: {
        name,
        type,
        currency: currency || "EUR",
        notes,
        userId,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
