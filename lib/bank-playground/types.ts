export type BankProviderId =
  | "trading212"
  | "interactive_brokers"
  | "revolut"
  | "trade_republic";

export type ProviderSupport = "supported" | "partial" | "unsupported";

export type DiagnosticStatus =
  | "ok"
  | "error"
  | "not_configured"
  | "limited"
  | "not_supported";

export interface NormalizedHolding {
  externalId: string;
  symbol: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  marketValue: number | null;
  currency: string;
  assetClass: string;
  sourceType: string;
  raw: Record<string, unknown>;
}

export interface PlaygroundTestResult {
  providerId: BankProviderId;
  support: ProviderSupport;
  connectionStatus: DiagnosticStatus;
  authStatus: DiagnosticStatus;
  holdings: NormalizedHolding[];
  warnings: string[];
  errors: string[];
  fetchedAt: string;
  rawSummary?: Record<string, unknown>;
}

export interface ProviderDescriptor {
  id: BankProviderId;
  displayName: string;
  support: ProviderSupport;
  capabilities: string[];
  requirements: string[];
  docsUrl: string;
}

export interface PlaygroundTestOptions {
  ibkrAccountId?: string;
}

export interface PlaygroundConnector {
  descriptor: ProviderDescriptor;
  runTest: (options?: PlaygroundTestOptions) => Promise<PlaygroundTestResult>;
}
