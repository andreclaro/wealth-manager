import { AssetType, Currency, PortfolioAccount } from "@prisma/client";

export type { PortfolioAccount as Account };

export interface AssetWithValue {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  purchasePrice: number | null;
  currency: Currency;
  currentPrice: number | null;
  priceUpdatedAt: Date | null;
  notes: string | null;
  isManualPrice: boolean;
  accountId: string;
  account: PortfolioAccount;
  createdAt: Date;
  updatedAt: Date;
  totalValue: number;
  totalValueUSD: number;
  totalValueEUR: number;
}

export interface PortfolioSummary {
  totalValueUSD: number;
  totalValueEUR: number;
  totalAssets: number;
  assetsByType: Record<AssetType, { count: number; valueUSD: number; valueEUR: number }>;
  assetsByCurrency: Record<Currency, { count: number; valueUSD: number; valueEUR: number }>;
}

export interface AssetHistoryPoint {
  symbol: string;
  valueUSD: number;
  valueEUR: number;
}

export interface PriceHistoryPoint {
  date: string;
  valueUSD: number;
  valueEUR: number;
  assets?: AssetHistoryPoint[];
}

export interface AssetFormData {
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  purchasePrice?: number;
  currency: Currency;
  currentPrice?: number;
  notes?: string;
  isManualPrice: boolean;
  accountId: string;
}

export interface AccountFormData {
  name: string;
  type?: string;
  currency: Currency;
  notes?: string;
}

export interface AccountWithTotals extends PortfolioAccount {
  totalValueUSD: number;
  totalValueEUR: number;
  assets: AssetWithValue[];
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  STOCK: "Stock",
  ETF: "ETF",
  FUND: "Fund",
  PPR_FPR: "PPR / FPR",
  PRIVATE_EQUITY: "Private Equity",
  P2P: "P2P Lending",
  BOND: "Bond",
  REAL_ESTATE: "Real Estate",
  CRYPTO: "Cryptocurrency",
  CASH: "Cash",
  SAVINGS: "Savings Account",
  COMMODITY: "Commodity",
  OTHER: "Other",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD ($)",
  EUR: "EUR (€)",
  GBP: "GBP (£)",
  CHF: "CHF (Fr)",
  JPY: "JPY (¥)",
};

export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  STOCK: "#3b82f6",
  ETF: "#8b5cf6",
  FUND: "#a855f7",
  PPR_FPR: "#0d9488",
  PRIVATE_EQUITY: "#7c3aed",
  P2P: "#ec4899",
  BOND: "#10b981",
  REAL_ESTATE: "#f59e0b",
  CRYPTO: "#f97316",
  CASH: "#6b7280",
  SAVINGS: "#14b8a6",
  COMMODITY: "#ef4444",
  OTHER: "#6366f1",
};

// Analysis Types
export interface PortfolioAnalysis {
  summary: {
    totalInvestedUSD: number;
    currentValueUSD: number;
    totalUnrealizedPnLUSD: number;
    totalReturnPercent: number;
  };
  performance: AssetPerformance[];
  topPerformers: AssetPerformanceSummary[];
  worstPerformers: AssetPerformanceSummary[];
  allocation: {
    byType: Record<string, AllocationData>;
    byCurrency: Record<string, AllocationData>;
    byAccount: Record<string, AllocationData>;
  };
  riskMetrics: RiskMetrics;
}

export interface AssetPerformance {
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

export interface AssetPerformanceSummary {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: Currency;
  returnPercent: number;
  currentValueUSD: number;
}

export interface AllocationData {
  valueUSD: number;
  percent: number;
  count: number;
}

export interface RiskMetrics {
  topHoldings: TopHolding[];
  typeConcentration: ConcentrationItem[];
  currencyExposure: ConcentrationItem[];
  diversificationScore: number;
}

export interface TopHolding {
  symbol: string;
  name: string;
  valueUSD: number;
  allocationPercent: number;
}

export interface ConcentrationItem {
  type?: string;
  currency?: string;
  percent: number;
}
