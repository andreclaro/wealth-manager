import {
  PlaygroundConnector,
  PlaygroundTestResult,
  ProviderDescriptor,
} from "@/lib/bank-playground/types";

const descriptor: ProviderDescriptor = {
  id: "revolut",
  displayName: "Revolut",
  support: "partial",
  capabilities: [
    "Official Open Banking account data in supported regions",
    "Official Revolut Business account APIs",
    "Revolut X APIs for exchange workflows",
  ],
  requirements: [
    "Open Banking or Business API onboarding with Revolut",
    "Region and product eligibility",
    "Retail investment holdings API is not publicly documented",
  ],
  docsUrl: "https://developer.revolut.com/docs/open-banking/account-information-service",
};

function buildResult(): PlaygroundTestResult {
  return {
    providerId: "revolut",
    support: descriptor.support,
    connectionStatus: "limited",
    authStatus: "limited",
    holdings: [],
    warnings: [
      "Official Revolut APIs are available for Open Banking/Business scopes, but retail investment holdings are not publicly documented as a stable API surface.",
      "Revolut X APIs are separate and do not provide a drop-in retail holdings endpoint for this app.",
    ],
    errors: [],
    fetchedAt: new Date().toISOString(),
    rawSummary: {
      status: "partial_support",
      recommendation: "Use CSV import for portfolio assets until official retail holdings API is available.",
    },
  };
}

export const revolutConnector: PlaygroundConnector = {
  descriptor,
  async runTest() {
    return buildResult();
  },
};
