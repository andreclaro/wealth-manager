import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssetType, Currency } from "@prisma/client";
import { fetchAssetName } from "@/lib/services/priceService";
import { requireAuth } from "@/lib/api";

interface CSVRow {
  account: string;
  accountType?: string;
  symbol: string;
  name?: string;
  assetType: string;
  quantity: string;
  price?: string;
  currency: string;
}

interface ImportResult {
  success: boolean;
  row: number;
  account?: string;
  symbol?: string;
  error?: string;
}

const MAX_CSV_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_CSV_ROWS = 2000;
const ACCEPTED_CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas inside
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    rows.push({
      account: row.account || "",
      accountType: row.accounttype || row["account type"] || "Other",
      symbol: row.symbol || "",
      name: row.name || "",
      assetType: row.assettype || row["asset type"] || row.type || "STOCK",
      quantity: row.quantity || "0",
      price: row.price || "",
      currency: row.currency || "EUR",
    });
  }

  return rows;
}

function validateAssetType(type: string): AssetType | null {
  const validTypes = ["STOCK", "ETF", "BOND", "REAL_ESTATE", "CRYPTO", "CASH", "SAVINGS", "COMMODITY", "OTHER"];
  const upperType = type.toUpperCase().trim();
  return validTypes.includes(upperType) ? (upperType as AssetType) : null;
}

function validateCurrency(currency: string): Currency | null {
  const validCurrencies = ["USD", "EUR", "GBP", "CHF", "JPY"];
  const upperCurrency = currency.toUpperCase().trim();
  return validCurrencies.includes(upperCurrency) ? (upperCurrency as Currency) : null;
}

// POST /api/import/csv - Import accounts and assets from CSV
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const preview = formData.get("preview") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
    }

    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `CSV file is too large. Maximum allowed size is ${Math.round(
            MAX_CSV_FILE_SIZE_BYTES / (1024 * 1024)
          )}MB.`,
        },
        { status: 413 }
      );
    }

    const fileType = file.type?.toLowerCase() || "";
    const fileName = file.name?.toLowerCase() || "";
    const isAcceptedType =
      !fileType ||
      ACCEPTED_CSV_MIME_TYPES.has(fileType) ||
      fileName.endsWith(".csv");
    if (!isAcceptedType) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a CSV file." },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
    }

    if (rows.length > MAX_CSV_ROWS) {
      return NextResponse.json(
        {
          error: `CSV contains too many rows. Maximum allowed is ${MAX_CSV_ROWS} rows.`,
        },
        { status: 400 }
      );
    }

    const results: ImportResult[] = [];
    const previewData: Array<{
      row: number;
      account: string;
      symbol: string;
      assetType: string;
      quantity: number;
      currency: string;
      willCreate: boolean;
      error?: string;
    }> = [];

    // Track accounts to create
    const accountsToCreate = new Map<string, { name: string; type: string; currency: Currency }>();

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is headers

      // Validate required fields
      if (!row.account) {
        results.push({ success: false, row: rowNum, error: "Account name is required" });
        continue;
      }
      if (!row.symbol) {
        results.push({ success: false, row: rowNum, error: "Symbol is required" });
        continue;
      }

      const assetType = validateAssetType(row.assetType);
      if (!assetType) {
        results.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: `Invalid asset type: ${row.assetType}`,
        });
        continue;
      }

      const currency = validateCurrency(row.currency);
      if (!currency) {
        results.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: `Invalid currency: ${row.currency}`,
        });
        continue;
      }

      const quantity = parseFloat(row.quantity);
      if (isNaN(quantity) || quantity < 0) {
        results.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: "Invalid quantity",
        });
        continue;
      }

      // Track account for creation
      if (!accountsToCreate.has(row.account)) {
        accountsToCreate.set(row.account, {
          name: row.account,
          type: row.accountType || "Other",
          currency,
        });
      }

      results.push({
        success: true,
        row: rowNum,
        account: row.account,
        symbol: row.symbol,
      });

      previewData.push({
        row: rowNum,
        account: row.account,
        symbol: row.symbol.toUpperCase(),
        assetType,
        quantity,
        currency,
        willCreate: true,
      });
    }

    // If preview mode, return preview without creating
    if (preview) {
      return NextResponse.json({
        preview: true,
        totalRows: rows.length,
        validRows: results.filter((r) => r.success).length,
        invalidRows: results.filter((r) => !r.success).length,
        errors: results.filter((r) => !r.success),
        accountsToCreate: Array.from(accountsToCreate.keys()),
        previewData,
      });
    }

    // Create accounts and assets
    const createdAccounts = new Map<string, string>(); // name -> id
    const createdAssets: Array<{ symbol: string; account: string }> = [];
    const errors: ImportResult[] = [];

    // Create accounts first
    for (const [accountName, accountData] of accountsToCreate) {
      try {
        // Check if account already exists for this user
        const existingAccount = await prisma.portfolioAccount.findFirst({
          where: { name: accountName, userId },
        });

        if (existingAccount) {
          createdAccounts.set(accountName, existingAccount.id);
        } else {
          const newAccount = await prisma.portfolioAccount.create({
            data: {
              name: accountData.name,
              type: accountData.type,
              currency: accountData.currency,
              userId,
            },
          });
          createdAccounts.set(accountName, newAccount.id);
        }
      } catch (error) {
        console.error(`Error creating account ${accountName}:`, error);
        errors.push({
          success: false,
          row: 0,
          account: accountName,
          error: "Failed to create account",
        });
      }
    }

    // Create assets
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Skip if validation failed
      const validationResult = results.find((r) => r.row === rowNum);
      if (!validationResult?.success) continue;

      const accountId = createdAccounts.get(row.account);
      if (!accountId) {
        errors.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: "Account not found",
        });
        continue;
      }

      const assetType = validateAssetType(row.assetType)!;
      const currency = validateCurrency(row.currency)!;
      const quantity = parseFloat(row.quantity);
      const price = row.price ? parseFloat(row.price) : null;

      // Check if asset already exists
      const existingAsset = await prisma.asset.findFirst({
        where: {
          symbol: row.symbol.toUpperCase(),
          accountId,
        },
      });

      if (existingAsset) {
        errors.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: "Asset already exists in this account",
        });
        continue;
      }

      try {
        // Fetch name if not provided
        let assetName = row.name;
        if (!assetName) {
          const fetchedName = await fetchAssetName(row.symbol, assetType);
          assetName = fetchedName || row.symbol.toUpperCase();
        }

        // Determine if manual price
        const isManualPrice = ["BOND", "REAL_ESTATE", "CASH", "SAVINGS", "COMMODITY", "OTHER"].includes(assetType);

        const asset = await prisma.asset.create({
          data: {
            symbol: row.symbol.toUpperCase(),
            name: assetName,
            type: assetType,
            quantity,
            currency,
            currentPrice: price,
            priceUpdatedAt: price ? new Date() : null,
            isManualPrice,
            accountId,
          },
        });

        // Create initial price history if price provided
        if (price) {
          await prisma.priceHistory.create({
            data: {
              assetId: asset.id,
              price,
              quantity,
              totalValue: price * quantity,
              currency,
            },
          });
        }

        createdAssets.push({ symbol: asset.symbol, account: row.account });
      } catch (error) {
        console.error(`Error creating asset ${row.symbol}:`, error);
        errors.push({
          success: false,
          row: rowNum,
          account: row.account,
          symbol: row.symbol,
          error: "Failed to create asset",
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: {
        accounts: Array.from(createdAccounts.keys()),
        assets: createdAssets.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: "Failed to import CSV" },
      { status: 500 }
    );
  }
}
