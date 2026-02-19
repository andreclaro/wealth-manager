import {
  PlaygroundConnector,
  PlaygroundTestResult,
  ProviderDescriptor,
} from "@/lib/bank-playground/types";

const descriptor: ProviderDescriptor = {
  id: "trade_republic",
  displayName: "Trade Republic",
  support: "unsupported",
  capabilities: [
    "No official public portfolio API currently available",
  ],
  requirements: [
    "Official API for portfolio holdings is required (currently unavailable)",
  ],
  docsUrl: "https://www.traderepublic.com/",
};

function buildResult(): PlaygroundTestResult {
  return {
    providerId: "trade_republic",
    support: descriptor.support,
    connectionStatus: "not_supported",
    authStatus: "not_supported",
    holdings: [],
    warnings: [
      "Community and reverse-engineered clients exist, but this playground intentionally uses official APIs only.",
      "Fallback: export your portfolio and import holdings through the CSV import flow.",
    ],
    errors: [
      "Trade Republic does not provide an official public API for portfolio holdings integration at this time.",
    ],
    fetchedAt: new Date().toISOString(),
    rawSummary: {
      status: "unsupported",
      fallback: "CSV import",
    },
  };
}

export const tradeRepublicConnector: PlaygroundConnector = {
  descriptor,
  async runTest() {
    return buildResult();
  },
};
