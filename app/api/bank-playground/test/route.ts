import { NextRequest, NextResponse } from "next/server";
import {
  getBankConnector,
  isBankProviderId,
} from "@/lib/bank-playground/registry";
import {
  BankProviderId,
  PlaygroundTestOptions,
  PlaygroundTestResult,
} from "@/lib/bank-playground/types";
import { unknownToErrorMessage } from "@/lib/bank-playground/http";

function parseOptions(raw: unknown): PlaygroundTestOptions {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const options = raw as Record<string, unknown>;
  const ibkrAccountId =
    typeof options.ibkrAccountId === "string" && options.ibkrAccountId.trim()
      ? options.ibkrAccountId.trim()
      : undefined;

  return {
    ibkrAccountId,
  };
}

function parseProviderId(raw: unknown): BankProviderId | null {
  if (typeof raw !== "string") {
    return null;
  }

  return isBankProviderId(raw) ? raw : null;
}

function buildUnexpectedErrorResult(providerId: BankProviderId): PlaygroundTestResult {
  return {
    providerId,
    support: getBankConnector(providerId).descriptor.support,
    connectionStatus: "error",
    authStatus: "error",
    holdings: [],
    warnings: [],
    errors: ["Unexpected connector error."],
    fetchedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  const providerId = parseProviderId(payload?.providerId);

  if (!providerId) {
    return NextResponse.json(
      {
        error:
          "Invalid providerId. Expected one of: trading212, interactive_brokers, revolut, trade_republic.",
      },
      { status: 400 }
    );
  }

  const connector = getBankConnector(providerId);
  const options = parseOptions(payload?.options);

  try {
    const result = await connector.runTest(options);
    return NextResponse.json(result);
  } catch (error) {
    const result = buildUnexpectedErrorResult(providerId);
    result.errors = [unknownToErrorMessage(error)];

    return NextResponse.json(result, { status: 500 });
  }
}
