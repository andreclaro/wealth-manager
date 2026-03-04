-- CreateTable
CREATE TABLE "MarketAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserMarketAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMarketAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserMarketAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MarketAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPriceCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "change" REAL,
    "changePercent" REAL,
    "volume" REAL,
    "high24h" REAL,
    "low24h" REAL,
    "lastUpdated" DATETIME NOT NULL,
    "source" TEXT,
    CONSTRAINT "MarketPriceCache_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MarketAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MarketAsset_category_idx" ON "MarketAsset"("category");

-- CreateIndex
CREATE INDEX "MarketAsset_isActive_idx" ON "MarketAsset"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MarketAsset_symbol_category_key" ON "MarketAsset"("symbol", "category");

-- CreateIndex
CREATE INDEX "UserMarketAsset_userId_idx" ON "UserMarketAsset"("userId");

-- CreateIndex
CREATE INDEX "UserMarketAsset_userId_displayOrder_idx" ON "UserMarketAsset"("userId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserMarketAsset_userId_assetId_key" ON "UserMarketAsset"("userId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceCache_assetId_key" ON "MarketPriceCache"("assetId");

-- CreateIndex
CREATE INDEX "MarketPriceCache_lastUpdated_idx" ON "MarketPriceCache"("lastUpdated");
