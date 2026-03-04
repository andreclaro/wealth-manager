-- CreateTable
CREATE TABLE "WalletAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "chainType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "evmChainId" INTEGER,
    "isPChain" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WalletAddress_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortfolioAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddressId" TEXT NOT NULL,
    "contractAddress" TEXT,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "balance" REAL NOT NULL,
    "rawBalance" TEXT NOT NULL,
    "priceUsd" REAL,
    "priceEur" REAL,
    "valueUsd" REAL,
    "valueEur" REAL,
    "priceUpdatedAt" DATETIME,
    "isNative" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "assetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WalletBalance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WalletBalance_walletAddressId_fkey" FOREIGN KEY ("walletAddressId") REFERENCES "WalletAddress" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "purchasePrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "currentPrice" REAL,
    "priceUpdatedAt" DATETIME,
    "notes" TEXT,
    "isManualPrice" BOOLEAN NOT NULL DEFAULT false,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortfolioAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("accountId", "createdAt", "currency", "currentPrice", "id", "isManualPrice", "name", "notes", "priceUpdatedAt", "purchasePrice", "quantity", "symbol", "type", "updatedAt") SELECT "accountId", "createdAt", "currency", "currentPrice", "id", "isManualPrice", "name", "notes", "priceUpdatedAt", "purchasePrice", "quantity", "symbol", "type", "updatedAt" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_type_idx" ON "Asset"("type");
CREATE INDEX "Asset_currency_idx" ON "Asset"("currency");
CREATE INDEX "Asset_accountId_idx" ON "Asset"("accountId");
CREATE INDEX "Asset_isVisible_idx" ON "Asset"("isVisible");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WalletAddress_accountId_idx" ON "WalletAddress"("accountId");

-- CreateIndex
CREATE INDEX "WalletAddress_chainType_address_idx" ON "WalletAddress"("chainType", "address");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAddress_accountId_chainType_address_key" ON "WalletAddress"("accountId", "chainType", "address");

-- CreateIndex
CREATE INDEX "WalletBalance_walletAddressId_idx" ON "WalletBalance"("walletAddressId");

-- CreateIndex
CREATE INDEX "WalletBalance_assetId_idx" ON "WalletBalance"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_walletAddressId_contractAddress_key" ON "WalletBalance"("walletAddressId", "contractAddress");
