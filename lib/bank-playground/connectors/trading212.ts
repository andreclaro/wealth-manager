import {
  PlaygroundConnector,
  PlaygroundTestResult,
  ProviderDescriptor,
  NormalizedHolding,
} from "@/lib/bank-playground/types";
import {
  extractErrorMessage,
  fetchWithTimeout,
  readResponseBody,
  toNumber,
  toRecord,
  unknownToErrorMessage,
} from "@/lib/bank-playground/http";

const TRADING212_BASE_URL =
  process.env.TRADING212_BASE_URL ||
  "https://live.trading212.com/api/v0";

const descriptor: ProviderDescriptor = {
  id: "trading212",
  displayName: "Trading 212",
  support: "supported",
  capabilities: [
    "Portfolio holdings fetch",
    "Read-only connectivity diagnostics",
    "Official Trading 212 API",
  ],
  requirements: [
    "Set TRADING212_API_KEY in server environment",
    "Trading 212 API access enabled for your account",
  ],
  docsUrl: "https://docs.trading212.com/rest-api/reference/equity/portfolio",
};

function baseResult(): PlaygroundTestResult {
  return {
    providerId: "trading212",
    support: descriptor.support,
    connectionStatus: "error",
    authStatus: "error",
    holdings: [],
    warnings: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };
}

function mapHolding(rawItem: unknown): NormalizedHolding | null {
  const row = toRecord(rawItem);
  const quantity =
    toNumber(row.quantity) ??
    toNumber(row.shares) ??
    toNumber(row.currentShares) ??
    0;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const symbol =
    String(row.ticker || row.symbol || row.isin || row.instrument || "UNKNOWN").toUpperCase();
  const unitPrice =
    toNumber(row.currentPrice) ??
    toNumber(row.price) ??
    toNumber(row.averagePrice) ??
    null;
  const marketValue =
    toNumber(row.marketValue) ??
    toNumber(row.value) ??
    (unitPrice !== null ? unitPrice * quantity : null);

  return {
    externalId: String(row.ticker || row.isin || row.id || symbol),
    symbol,
    name: String(row.instrumentName || row.name || row.description || symbol),
    quantity,
    unitPrice,
    marketValue,
    currency: String(row.currency || row.currencyCode || "USD").toUpperCase(),
    assetClass: String(row.assetType || row.type || "EQUITY"),
    sourceType: "position",
    raw: row,
  };
}

function extractHoldings(body: unknown): NormalizedHolding[] {
  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown>)?.items)
      ? ((body as Record<string, unknown>).items as unknown[])
      : Array.isArray((body as Record<string, unknown>)?.positions)
        ? ((body as Record<string, unknown>).positions as unknown[])
        : [];

  return rows
    .map((entry) => mapHolding(entry))
    .filter((entry): entry is NormalizedHolding => Boolean(entry));
}

export const trading212Connector: PlaygroundConnector = {
  descriptor,
  async runTest() {
    const result = baseResult();
    const apiKey = process.env.TRADING212_API_KEY?.trim();

    if (!apiKey) {
      result.connectionStatus = "not_configured";
      result.authStatus = "not_configured";
      result.errors.push(
        "Missing TRADING212_API_KEY. Add it to your server environment to run this connector."
      );
      result.rawSummary = {
        baseUrl: TRADING212_BASE_URL,
        configured: false,
      };
      return result;
    }

    try {
      const authVariants = Array.from(
        new Set(
          apiKey.startsWith("Bearer ")
            ? [apiKey, apiKey.replace(/^Bearer\s+/i, "")]
            : [apiKey, `Bearer ${apiKey}`]
        )
      );

      let response: Response | null = null;
      let body: unknown = null;
      let authAttempt: string | null = null;

      for (const variant of authVariants) {
        const attemptResponse = await fetchWithTimeout(
          `${TRADING212_BASE_URL}/equity/portfolio`,
          {
            method: "GET",
            headers: {
              Authorization: variant,
              Accept: "application/json",
            },
          }
        );
        const attemptBody = await readResponseBody(attemptResponse);

        response = attemptResponse;
        body = attemptBody;
        authAttempt = variant.startsWith("Bearer ") ? "bearer" : "raw";

        if (attemptResponse.ok || (attemptResponse.status !== 401 && attemptResponse.status !== 403)) {
          break;
        }
      }

      if (!response) {
        result.connectionStatus = "error";
        result.authStatus = "error";
        result.errors.push("Trading 212 request could not be executed.");
        result.rawSummary = {
          baseUrl: TRADING212_BASE_URL,
        };
        return result;
      }

      if (response.status === 401 || response.status === 403) {
        result.connectionStatus = "ok";
        result.authStatus = "error";
        result.errors.push(
          "Trading 212 authentication failed. Verify TRADING212_API_KEY permissions and validity."
        );
        const upstreamMessage = extractErrorMessage(body);
        if (upstreamMessage) {
          result.warnings.push(`Upstream response: ${upstreamMessage}`);
        }
        result.rawSummary = {
          baseUrl: TRADING212_BASE_URL,
          status: response.status,
          authAttempt,
        };
        return result;
      }

      if (response.status === 429) {
        result.connectionStatus = "ok";
        result.authStatus = "ok";
        result.errors.push(
          "Trading 212 rate limit reached. Try again in a few moments."
        );
        result.rawSummary = {
          baseUrl: TRADING212_BASE_URL,
          status: response.status,
          authAttempt,
        };
        return result;
      }

      if (!response.ok) {
        result.connectionStatus = "error";
        result.authStatus = "error";
        const upstreamMessage = extractErrorMessage(body);
        result.errors.push(
          upstreamMessage ||
            `Trading 212 request failed with status ${response.status}.`
        );
        result.rawSummary = {
          baseUrl: TRADING212_BASE_URL,
          status: response.status,
          authAttempt,
        };
        return result;
      }

      const holdings = extractHoldings(body);

      result.connectionStatus = "ok";
      result.authStatus = "ok";
      result.holdings = holdings;

      if (holdings.length === 0) {
        result.warnings.push(
          "Connected successfully but no portfolio holdings were returned."
        );
      }

      result.rawSummary = {
        baseUrl: TRADING212_BASE_URL,
        status: response.status,
        holdingsCount: holdings.length,
        authAttempt,
      };

      return result;
    } catch (error) {
      result.connectionStatus = "error";
      result.authStatus = "error";
      result.errors.push(unknownToErrorMessage(error));
      result.rawSummary = {
        baseUrl: TRADING212_BASE_URL,
      };
      return result;
    }
  },
};
