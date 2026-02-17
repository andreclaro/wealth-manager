import { Currency } from "@prisma/client";

// Cache for exchange rates
interface ExchangeRateCache {
  rate: number;
  timestamp: number;
}

const exchangeRateCache: Map<string, ExchangeRateCache> = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Known crypto mappings (CoinGecko IDs)
const CRYPTO_MAPPINGS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  SUSHI: "sushi",
  COMP: "compound-governance-token",
  MKR: "maker",
  YFI: "yearn-finance",
  CRV: "curve-dao-token",
  "1INCH": "1inch",
  SNX: "havven",
  GRT: "the-graph",
  BAT: "basic-attention-token",
  ENJ: "enjincoin",
  MANA: "decentraland",
  SAND: "the-sandbox",
  AXS: "axie-infinity",
  FTM: "fantom",
  NEAR: "near",
  ALGO: "algorand",
  VET: "vechain",
  FIL: "filecoin",
  EOS: "eos",
  XTZ: "tezos",
  XLM: "stellar",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XRP: "ripple",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  TRX: "tron",
};

// European ETFs (XETRA/LSE) - Finnhub doesn't support these. Stooq format: symbol.de, symbol.l
const EUROPEAN_ETF_MAPPINGS: Record<string, { stooqSymbol: string; name: string }> = {
  H4ZZ: { stooqSymbol: "h4zz.de", name: "HSBC Euro Stoxx 50 UCITS ETF EUR Acc" },
  "H4ZZ.DE": { stooqSymbol: "h4zz.de", name: "HSBC Euro Stoxx 50 UCITS ETF EUR Acc" },
  EXSA: { stooqSymbol: "exsa.de", name: "iShares Core EURO STOXX 50 UCITS ETF EUR Acc" },
  "EXSA.DE": { stooqSymbol: "exsa.de", name: "iShares Core EURO STOXX 50 UCITS ETF EUR Acc" },
  SXR8: { stooqSymbol: "sxr8.de", name: "iShares Core S&P 500 UCITS ETF USD Acc" },
  "SXR8.DE": { stooqSymbol: "sxr8.de", name: "iShares Core S&P 500 UCITS ETF USD Acc" },
  VWCE: { stooqSymbol: "vwce.de", name: "Vanguard FTSE All-World UCITS ETF USD Acc" },
  "VWCE.DE": { stooqSymbol: "vwce.de", name: "Vanguard FTSE All-World UCITS ETF USD Acc" },
};

// Stock symbols with class shares: Finnhub uses dot format (BRK.B, BF.B)
const STOCK_SYMBOL_ALIASES: Record<string, string> = {
  BRKB: "BRK.B",
  "BRK B": "BRK.B",
  "BRK-B": "BRK.B",
  BRKA: "BRK.A",
  "BRK A": "BRK.A",
  "BRK-A": "BRK.A",
  BFB: "BF.B",
  "BF B": "BF.B",
  "BF-B": "BF.B",
};

/**
 * Normalize stock symbol for API (Finnhub uses BRK.B format)
 */
function normalizeStockSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const withSpace = upper.replace(/-/g, " ");
  const withDot = upper.replace(/[\s-]/g, ".");
  return (
    STOCK_SYMBOL_ALIASES[upper] ??
    STOCK_SYMBOL_ALIASES[withSpace] ??
    (upper.includes(" ") || upper.includes("-") ? withDot : upper)
  );
}

/**
 * Fetch price from Stooq (European ETFs - XETRA, LSE). Free, no API key.
 */
async function fetchStooqPrice(stooqSymbol: string): Promise<{ usd: number; eur: number } | null> {
  try {
    const response = await fetch(
      `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`,
      { next: { revalidate: 60 } }
    );
    if (!response.ok) return null;

    const text = await response.text();
    const lines = text.trim().split("\n").filter((l) => l);
    if (lines.length < 2) return null;

    // CSV: Date,Open,High,Low,Close,Volume - last row is most recent
    const lastRow = lines[lines.length - 1];
    const close = parseFloat(lastRow.split(",")[4]);
    if (isNaN(close) || close <= 0) return null;

    // Stooq .DE symbols are in EUR
    const eurPrice = close;
    const usdRate = await getExchangeRate("EUR", "USD");
    const usdPrice = eurPrice * usdRate;

    return { usd: usdPrice, eur: eurPrice };
  } catch (error) {
    console.error("Stooq API error:", error);
    return null;
  }
}

/**
 * Fetch stock/ETF price from Finnhub (US) or Stooq (European ETFs)
 */
export async function fetchStockPrice(symbol: string): Promise<{ usd: number; eur: number } | null> {
  const upper = symbol.trim().toUpperCase();
  const baseSymbol = upper.split(".")[0];
  const europeanEtf = EUROPEAN_ETF_MAPPINGS[upper] ?? EUROPEAN_ETF_MAPPINGS[baseSymbol];

  // Try Stooq first for known European ETFs
  if (europeanEtf) {
    const stooqPrice = await fetchStooqPrice(europeanEtf.stooqSymbol);
    if (stooqPrice) return stooqPrice;
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  const normalizedSymbol = normalizeStockSymbol(symbol);

  if (!apiKey) {
    console.warn("Finnhub API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(normalizedSymbol)}&token=${apiKey}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      console.error(`Finnhub API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const usdPrice = data.c; // Current price

    if (!usdPrice || usdPrice <= 0) {
      return null;
    }

    // Convert to EUR
    const eurRate = await getExchangeRate("USD", "EUR");
    const eurPrice = usdPrice * eurRate;

    return { usd: usdPrice, eur: eurPrice };
  } catch (error) {
    console.error("Error fetching stock price:", error);
    return null;
  }
}

/**
 * Fetch cryptocurrency price from CoinGecko
 */
export async function fetchCryptoPrice(symbol: string): Promise<{ usd: number; eur: number } | null> {
  const coinId = CRYPTO_MAPPINGS[symbol.toUpperCase()];
  
  if (!coinId) {
    console.warn(`Unknown cryptocurrency symbol: ${symbol}`);
    return null;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,eur`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const coinData = data[coinId];

    if (!coinData || !coinData.usd) {
      return null;
    }

    return {
      usd: coinData.usd,
      eur: coinData.eur || coinData.usd * 0.92, // Fallback conversion
    };
  } catch (error) {
    console.error("Error fetching crypto price:", error);
    return null;
  }
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;

  const cacheKey = `${from}-${to}`;
  const cached = exchangeRateCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rate;
  }

  try {
    // Use a free exchange rate API
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates[to];

    if (!rate) {
      throw new Error(`Rate not found for ${from} to ${to}`);
    }

    exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() });
    return rate;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    // Fallback rates (approximate)
    const fallbackRates: Record<string, number> = {
      "USD-EUR": 0.92,
      "EUR-USD": 1.09,
      "USD-GBP": 0.79,
      "GBP-USD": 1.27,
      "USD-CHF": 0.88,
      "CHF-USD": 1.14,
      "USD-JPY": 150,
      "JPY-USD": 0.0067,
      "EUR-GBP": 0.85,
      "GBP-EUR": 1.18,
      "EUR-CHF": 0.94,
      "CHF-EUR": 1.06,
    };
    return fallbackRates[cacheKey] || 1;
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): Promise<number> {
  if (from === to) return amount;
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}

/**
 * Fetch stock/ETF name from Finnhub or European ETF mapping
 */
export async function fetchStockName(symbol: string): Promise<string | null> {
  const upper = symbol.trim().toUpperCase();
  const baseSymbol = upper.split(".")[0];
  const europeanEtf = EUROPEAN_ETF_MAPPINGS[upper] ?? EUROPEAN_ETF_MAPPINGS[baseSymbol];

  // European ETFs: return name from mapping (no API needed)
  if (europeanEtf) return europeanEtf.name;

  const apiKey = process.env.FINNHUB_API_KEY;
  const normalizedSymbol = normalizeStockSymbol(symbol);

  if (!apiKey) {
    console.warn("Finnhub API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(normalizedSymbol)}&token=${apiKey}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      console.error(`Finnhub API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.name || null;
  } catch (error) {
    console.error("Error fetching stock name:", error);
    return null;
  }
}

/**
 * Fetch cryptocurrency name from CoinGecko
 */
export async function fetchCryptoName(symbol: string): Promise<string | null> {
  const coinId = CRYPTO_MAPPINGS[symbol.toUpperCase()];

  if (!coinId) {
    console.warn(`Unknown cryptocurrency symbol: ${symbol}`);
    return null;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.name || null;
  } catch (error) {
    console.error("Error fetching crypto name:", error);
    return null;
  }
}

/**
 * Fetch name for an asset based on its type
 */
export async function fetchAssetName(
  symbol: string,
  type: string
): Promise<string | null> {
  switch (type) {
    case "STOCK":
    case "ETF":
      return fetchStockName(symbol);
    case "CRYPTO":
      return fetchCryptoName(symbol);
    default:
      // For bonds, real estate, cash, etc., names are manual
      return null;
  }
}

/**
 * Fetch price for an asset based on its type
 */
export async function fetchAssetPrice(
  symbol: string,
  type: string
): Promise<{ usd: number; eur: number } | null> {
  switch (type) {
    case "STOCK":
    case "ETF":
      return fetchStockPrice(symbol);
    case "CRYPTO":
      return fetchCryptoPrice(symbol);
    default:
      // For bonds, real estate, cash, etc., prices are manual
      return null;
  }
}
