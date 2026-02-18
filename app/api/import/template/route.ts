import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssetType, Currency } from "@prisma/client";

const DEFAULT_USER_ID = "default-user";

interface TemplateAsset {
  symbol: string;
  name: string;
  type: AssetType;
  currency: Currency;
}

interface Template {
  id: string;
  name: string;
  description: string;
  account: {
    name: string;
    type: string;
    currency: Currency;
  };
  assets: TemplateAsset[];
}

const TEMPLATES: Record<string, Template> = {
  "us-stock-investor": {
    id: "us-stock-investor",
    name: "📈 US Stock Investor",
    description: "Popular US stocks and ETFs for long-term investing",
    account: {
      name: "Interactive Brokers",
      type: "Broker",
      currency: "USD",
    },
    assets: [
      { symbol: "AAPL", name: "Apple Inc.", type: "STOCK", currency: "USD" },
      { symbol: "MSFT", name: "Microsoft Corporation", type: "STOCK", currency: "USD" },
      { symbol: "GOOGL", name: "Alphabet Inc.", type: "STOCK", currency: "USD" },
      { symbol: "AMZN", name: "Amazon.com Inc.", type: "STOCK", currency: "USD" },
      { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", currency: "USD" },
      { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", currency: "USD" },
    ],
  },
  "crypto-hodler": {
    id: "crypto-hodler",
    name: "₿ Crypto Hodler",
    description: "Major cryptocurrencies for crypto enthusiasts",
    account: {
      name: "Crypto Exchange",
      type: "Crypto Exchange",
      currency: "USD",
    },
    assets: [
      { symbol: "BTC", name: "Bitcoin", type: "CRYPTO", currency: "USD" },
      { symbol: "ETH", name: "Ethereum", type: "CRYPTO", currency: "USD" },
      { symbol: "SOL", name: "Solana", type: "CRYPTO", currency: "USD" },
    ],
  },
  "european-saver": {
    id: "european-saver",
    name: "🏦 European Saver",
    description: "Simple savings setup for European investors",
    account: {
      name: "Main Bank",
      type: "Bank",
      currency: "EUR",
    },
    assets: [
      { symbol: "EUR", name: "Cash - EUR", type: "CASH", currency: "EUR" },
      { symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", type: "ETF", currency: "EUR" },
      { symbol: "EXSA", name: "iShares Core EURO STOXX 50 UCITS ETF", type: "ETF", currency: "EUR" },
    ],
  },
  "all-in-one": {
    id: "all-in-one",
    name: "🌍 All-in-One Portfolio",
    description: "Diversified portfolio with stocks, crypto, and cash",
    account: {
      name: "Multi-Asset Portfolio",
      type: "Broker",
      currency: "USD",
    },
    assets: [
      { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", currency: "USD" },
      { symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "ETF", currency: "USD" },
      { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF", currency: "USD" },
      { symbol: "BTC", name: "Bitcoin", type: "CRYPTO", currency: "USD" },
      { symbol: "USD", name: "Cash - USD", type: "CASH", currency: "USD" },
    ],
  },
  "dividend-growth": {
    id: "dividend-growth",
    name: "💰 Dividend Growth",
    description: "Dividend-paying stocks for income-focused investors",
    account: {
      name: "Dividend Portfolio",
      type: "Broker",
      currency: "USD",
    },
    assets: [
      { symbol: "JNJ", name: "Johnson & Johnson", type: "STOCK", currency: "USD" },
      { symbol: "PG", name: "Procter & Gamble", type: "STOCK", currency: "USD" },
      { symbol: "KO", name: "Coca-Cola", type: "STOCK", currency: "USD" },
      { symbol: "VYM", name: "Vanguard High Dividend Yield ETF", type: "ETF", currency: "USD" },
      { symbol: "SCHD", name: "Schwab US Dividend Equity ETF", type: "ETF", currency: "USD" },
    ],
  },
  "tech-focused": {
    id: "tech-focused",
    name: "🚀 Tech Focused",
    description: "Technology and growth stocks",
    account: {
      name: "Tech Portfolio",
      type: "Broker",
      currency: "USD",
    },
    assets: [
      { symbol: "NVDA", name: "NVIDIA Corporation", type: "STOCK", currency: "USD" },
      { symbol: "TSLA", name: "Tesla Inc.", type: "STOCK", currency: "USD" },
      { symbol: "META", name: "Meta Platforms Inc.", type: "STOCK", currency: "USD" },
      { symbol: "NFLX", name: "Netflix Inc.", type: "STOCK", currency: "USD" },
      { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", currency: "USD" },
    ],
  },
};

// GET /api/import/template - List available templates
export async function GET() {
  return NextResponse.json({
    templates: Object.values(TEMPLATES).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      accountName: t.account.name,
      assetCount: t.assets.length,
    })),
  });
}

// POST /api/import/template - Apply a template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, customAccountName } = body;

    if (!templateId || !TEMPLATES[templateId]) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const template = TEMPLATES[templateId];
    const accountName = customAccountName || template.account.name;

    // Check if account already exists
    let account = await prisma.portfolioAccount.findFirst({
      where: { name: accountName },
    });

    let accountCreated = false;
    if (!account) {
      account = await prisma.portfolioAccount.create({
        data: {
          name: accountName,
          type: template.account.type,
          currency: template.account.currency,
          userId: DEFAULT_USER_ID,
        },
      });
      accountCreated = true;
    }

    // Create assets with 0 quantity
    const createdAssets: string[] = [];
    const skippedAssets: string[] = [];

    for (const assetTemplate of template.assets) {
      // Check if asset already exists in this account
      const existingAsset = await prisma.asset.findFirst({
        where: {
          symbol: assetTemplate.symbol,
          accountId: account.id,
        },
      });

      if (existingAsset) {
        skippedAssets.push(assetTemplate.symbol);
        continue;
      }

      const isManualPrice = ["BOND", "REAL_ESTATE", "CASH", "SAVINGS", "COMMODITY", "OTHER"].includes(
        assetTemplate.type
      );

      await prisma.asset.create({
        data: {
          symbol: assetTemplate.symbol,
          name: assetTemplate.name,
          type: assetTemplate.type,
          quantity: 0,
          currency: assetTemplate.currency,
          isManualPrice,
          accountId: account.id,
        },
      });

      createdAssets.push(assetTemplate.symbol);
    }

    return NextResponse.json({
      success: true,
      template: template.name,
      account: {
        name: account.name,
        created: accountCreated,
      },
      assets: {
        created: createdAssets.length,
        skipped: skippedAssets.length,
        list: createdAssets,
      },
    });
  } catch (error) {
    console.error("Error applying template:", error);
    return NextResponse.json(
      { error: "Failed to apply template: " + (error as Error).message },
      { status: 500 }
    );
  }
}
