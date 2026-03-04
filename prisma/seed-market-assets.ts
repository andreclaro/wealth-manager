import { MarketAssetCategory, Currency } from "@prisma/client";
import { prisma } from "../lib/prisma";

const DEFAULT_MARKET_ASSETS = [
  // Indexes - Using Yahoo Finance compatible symbols
  { symbol: "^GSPC", name: "S&P 500", category: MarketAssetCategory.INDEX, exchange: "NYSE", currency: Currency.USD },
  { symbol: "^IXIC", name: "NASDAQ Composite", category: MarketAssetCategory.INDEX, exchange: "NASDAQ", currency: Currency.USD },
  { symbol: "^DJI", name: "Dow Jones Industrial", category: MarketAssetCategory.INDEX, exchange: "NYSE", currency: Currency.USD },
  { symbol: "^FTSE", name: "FTSE 100", category: MarketAssetCategory.INDEX, exchange: "LSE", currency: Currency.GBP },
  { symbol: "^GDAXI", name: "DAX 40", category: MarketAssetCategory.INDEX, exchange: "XETRA", currency: Currency.EUR },
  { symbol: "^N225", name: "Nikkei 225", category: MarketAssetCategory.INDEX, exchange: "TSE", currency: Currency.JPY },
  { symbol: "^HSI", name: "Hang Seng Index", category: MarketAssetCategory.INDEX, exchange: "HKEX", currency: Currency.USD },
  { symbol: "^STOXX50E", name: "EURO STOXX 50", category: MarketAssetCategory.INDEX, exchange: "EUREX", currency: Currency.EUR },
  
  // Commodities
  { symbol: "GC=F", name: "Gold", category: MarketAssetCategory.COMMODITY, exchange: "COMEX", currency: Currency.USD },
  { symbol: "SI=F", name: "Silver", category: MarketAssetCategory.COMMODITY, exchange: "COMEX", currency: Currency.USD },
  { symbol: "CL=F", name: "Crude Oil (WTI)", category: MarketAssetCategory.COMMODITY, exchange: "NYMEX", currency: Currency.USD },
  { symbol: "BZ=F", name: "Brent Oil", category: MarketAssetCategory.COMMODITY, exchange: "ICE", currency: Currency.USD },
  { symbol: "NG=F", name: "Natural Gas", category: MarketAssetCategory.COMMODITY, exchange: "NYMEX", currency: Currency.USD },
  { symbol: "PL=F", name: "Platinum", category: MarketAssetCategory.COMMODITY, exchange: "NYMEX", currency: Currency.USD },
  { symbol: "PA=F", name: "Palladium", category: MarketAssetCategory.COMMODITY, exchange: "NYMEX", currency: Currency.USD },
  { symbol: "HG=F", name: "Copper", category: MarketAssetCategory.COMMODITY, exchange: "COMEX", currency: Currency.USD },
  
  // Crypto
  { symbol: "BTC", name: "Bitcoin", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "ETH", name: "Ethereum", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "SOL", name: "Solana", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "XRP", name: "XRP", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "DOGE", name: "Dogecoin", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "ADA", name: "Cardano", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "AVAX", name: "Avalanche", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  { symbol: "LINK", name: "Chainlink", category: MarketAssetCategory.CRYPTO, exchange: "Binance", currency: Currency.USD },
  
  // Currencies (Forex)
  { symbol: "EURUSD=X", name: "EUR/USD", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.USD },
  { symbol: "GBPUSD=X", name: "GBP/USD", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.USD },
  { symbol: "USDJPY=X", name: "USD/JPY", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.JPY },
  { symbol: "USDCHF=X", name: "USD/CHF", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.CHF },
  { symbol: "AUDUSD=X", name: "AUD/USD", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.USD },
  { symbol: "USDCAD=X", name: "USD/CAD", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.USD },
  { symbol: "EURGBP=X", name: "EUR/GBP", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.GBP },
  { symbol: "EURJPY=X", name: "EUR/JPY", category: MarketAssetCategory.CURRENCY, exchange: "FOREX", currency: Currency.JPY },
];

async function main() {
  console.log("Seeding market assets...");
  
  for (const asset of DEFAULT_MARKET_ASSETS) {
    await prisma.marketAsset.upsert({
      where: { 
        symbol_category: {
          symbol: asset.symbol,
          category: asset.category
        }
      },
      update: {},
      create: asset,
    });
  }
  
  console.log(`Seeded ${DEFAULT_MARKET_ASSETS.length} market assets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
