import {
  PlaygroundConnector,
  PlaygroundTestOptions,
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

const DEFAULT_IBKR_BASE_URL = "http://127.0.0.1:5000/v1/api";

const descriptor: ProviderDescriptor = {
  id: "interactive_brokers",
  displayName: "Interactive Brokers",
  support: "supported",
  capabilities: [
    "Account discovery",
    "Portfolio positions fetch",
    "Read-only diagnostics via Client Portal API",
  ],
  requirements: [
    "Run Interactive Brokers Client Portal Gateway locally",
    "Set IBKR_BASE_URL if gateway URL differs",
    "Authenticate active session in IBKR gateway",
  ],
  docsUrl: "https://interactivebrokers.github.io/cpwebapi/",
};

function baseResult(): PlaygroundTestResult {
  return {
    providerId: "interactive_brokers",
    support: descriptor.support,
    connectionStatus: "error",
    authStatus: "error",
    holdings: [],
    warnings: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };
}

function mapHolding(rawItem: unknown): NormalizedHolding {
  const row = toRecord(rawItem);
  const quantity = toNumber(row.position) ?? toNumber(row.qty) ?? 0;
  const unitPrice =
    toNumber(row.mktPrice) ??
    toNumber(row.marketPrice) ??
    toNumber(row.lastPrice) ??
    null;
  const marketValue =
    toNumber(row.mktValue) ??
    toNumber(row.marketValue) ??
    (unitPrice !== null ? unitPrice * quantity : null);

  const symbol = String(
    row.ticker || row.symbol || row.contractDesc || row.conid || "UNKNOWN"
  ).toUpperCase();

  return {
    externalId: String(row.conid || row.conidEx || row.contractDesc || symbol),
    symbol,
    name: String(row.contractDesc || row.description || row.name || symbol),
    quantity,
    unitPrice,
    marketValue,
    currency: String(row.currency || "USD").toUpperCase(),
    assetClass: String(row.assetClass || row.secType || row.type || "UNKNOWN"),
    sourceType: "position",
    raw: row,
  };
}

function extractAccountIds(body: unknown): string[] {
  if (!Array.isArray(body)) {
    return [];
  }

  const ids: string[] = [];

  for (const item of body) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim());
      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const accountId =
      row.accountId || row.id || row.account || row.accountCode || row.acctId;

    if (typeof accountId === "string" && accountId.trim()) {
      ids.push(accountId.trim());
    }
  }

  return Array.from(new Set(ids));
}

function extractPositions(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (!body || typeof body !== "object") {
    return [];
  }

  const row = body as Record<string, unknown>;

  if (Array.isArray(row.positions)) {
    return row.positions;
  }

  if (Array.isArray(row.data)) {
    return row.data;
  }

  if (Array.isArray(row.items)) {
    return row.items;
  }

  return [];
}

async function fetchPositions(
  baseUrl: string,
  accountId: string
): Promise<{ positions: unknown[]; status: number; endpoint: string } | null> {
  const endpoints = [
    `${baseUrl}/portfolio/${accountId}/positions/0`,
    `${baseUrl}/portfolio/${accountId}/positions`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const body = await readResponseBody(response);
    if (!response.ok) {
      continue;
    }

    const positions = extractPositions(body);

    return {
      positions,
      status: response.status,
      endpoint,
    };
  }

  return null;
}

function resolveAuthFlags(body: unknown): {
  authenticated: boolean;
  connected: boolean;
  message?: string;
} {
  if (!body || typeof body !== "object") {
    return {
      authenticated: false,
      connected: false,
    };
  }

  const row = body as Record<string, unknown>;
  const authenticated = Boolean(
    row.authenticated ?? row.isAuthenticated ?? row.loggedIn
  );
  const connected = Boolean(row.connected ?? row.competing ?? true);
  const message =
    typeof row.message === "string"
      ? row.message
      : typeof row.error === "string"
        ? row.error
        : undefined;

  return {
    authenticated,
    connected,
    message,
  };
}

export const interactiveBrokersConnector: PlaygroundConnector = {
  descriptor,
  async runTest(options?: PlaygroundTestOptions) {
    const result = baseResult();
    const baseUrl = (
      process.env.IBKR_BASE_URL || DEFAULT_IBKR_BASE_URL
    ).replace(/\/+$/, "");

    try {
      const authResponse = await fetchWithTimeout(`${baseUrl}/iserver/auth/status`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const authBody = await readResponseBody(authResponse);

      if (!authResponse.ok) {
        result.connectionStatus = "error";
        result.authStatus = "error";
        const upstreamMessage = extractErrorMessage(authBody);
        result.errors.push(
          upstreamMessage ||
            `IBKR auth probe failed with status ${authResponse.status}.`
        );
        result.rawSummary = {
          baseUrl,
          authStatusCode: authResponse.status,
        };
        return result;
      }

      const authFlags = resolveAuthFlags(authBody);

      if (!authFlags.connected) {
        result.connectionStatus = "error";
        result.authStatus = "error";
        result.errors.push(
          "IBKR Client Portal Gateway is reachable but not connected to backend services."
        );
        if (authFlags.message) {
          result.warnings.push(authFlags.message);
        }
        result.rawSummary = {
          baseUrl,
          authStatusCode: authResponse.status,
        };
        return result;
      }

      result.connectionStatus = "ok";

      if (!authFlags.authenticated) {
        result.authStatus = "error";
        result.errors.push(
          "IBKR gateway session is not authenticated. Log in to Client Portal Gateway and retry."
        );
        if (authFlags.message) {
          result.warnings.push(authFlags.message);
        }
        result.rawSummary = {
          baseUrl,
          authStatusCode: authResponse.status,
        };
        return result;
      }

      result.authStatus = "ok";

      const accountsResponse = await fetchWithTimeout(`${baseUrl}/portfolio/accounts`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const accountsBody = await readResponseBody(accountsResponse);

      if (!accountsResponse.ok) {
        const upstreamMessage = extractErrorMessage(accountsBody);
        result.errors.push(
          upstreamMessage ||
            `IBKR accounts request failed with status ${accountsResponse.status}.`
        );
        result.rawSummary = {
          baseUrl,
          accountsStatusCode: accountsResponse.status,
        };
        return result;
      }

      const accountIds = extractAccountIds(accountsBody);

      if (accountIds.length === 0) {
        result.warnings.push(
          "Connected and authenticated, but no IBKR accounts were returned."
        );
        result.rawSummary = {
          baseUrl,
          accountsStatusCode: accountsResponse.status,
          accountCount: 0,
        };
        return result;
      }

      const requestedAccountId = options?.ibkrAccountId?.trim();
      const selectedAccountId =
        requestedAccountId && accountIds.includes(requestedAccountId)
          ? requestedAccountId
          : accountIds[0];

      if (requestedAccountId && !accountIds.includes(requestedAccountId)) {
        result.warnings.push(
          `Requested IBKR account '${requestedAccountId}' was not found. Using '${selectedAccountId}' instead.`
        );
      }

      const positionsResult = await fetchPositions(baseUrl, selectedAccountId);

      if (!positionsResult) {
        result.errors.push(
          `Unable to fetch IBKR positions for account '${selectedAccountId}'.`
        );
        result.rawSummary = {
          baseUrl,
          accountCount: accountIds.length,
          selectedAccountId,
          positionsFetched: false,
        };
        return result;
      }

      result.holdings = positionsResult.positions
        .map((entry) => mapHolding(entry))
        .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity !== 0);

      if (result.holdings.length === 0) {
        result.warnings.push(
          `Connected successfully but no open positions were returned for account '${selectedAccountId}'.`
        );
      }

      result.rawSummary = {
        baseUrl,
        accountCount: accountIds.length,
        selectedAccountId,
        positionsCount: result.holdings.length,
        positionsEndpoint: positionsResult.endpoint,
        positionsStatusCode: positionsResult.status,
      };

      return result;
    } catch (error) {
      result.connectionStatus = "error";
      result.authStatus = "error";
      result.errors.push(unknownToErrorMessage(error));
      result.rawSummary = {
        baseUrl,
      };
      return result;
    }
  },
};
