"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BankProviderId,
  DiagnosticStatus,
  PlaygroundTestResult,
  ProviderDescriptor,
  ProviderSupport,
} from "@/lib/bank-playground/types";

const SUPPORT_LABELS: Record<ProviderSupport, string> = {
  supported: "Supported",
  partial: "Partial",
  unsupported: "Unsupported",
};

const SUPPORT_BADGE_VARIANT: Record<
  ProviderSupport,
  "default" | "secondary" | "outline" | "destructive"
> = {
  supported: "secondary",
  partial: "outline",
  unsupported: "destructive",
};

const STATUS_LABELS: Record<DiagnosticStatus, string> = {
  ok: "OK",
  error: "Error",
  not_configured: "Not Configured",
  limited: "Limited",
  not_supported: "Not Supported",
};

const STATUS_BADGE_VARIANT: Record<
  DiagnosticStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ok: "secondary",
  error: "destructive",
  not_configured: "outline",
  limited: "outline",
  not_supported: "outline",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || "USD"} ${formatNumber(value)}`;
  }
}

async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        return data.error;
      }
      return `Request failed with status ${response.status}`;
    } catch {
      return `Request failed with status ${response.status}`;
    }
  }

  try {
    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export default function BankPlaygroundPage() {
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const [results, setResults] = useState<
    Partial<Record<BankProviderId, PlaygroundTestResult>>
  >({});
  const [requestErrors, setRequestErrors] = useState<
    Partial<Record<BankProviderId, string>>
  >({});
  const [runningProviderId, setRunningProviderId] = useState<BankProviderId | null>(null);
  const [ibkrAccountId, setIbkrAccountId] = useState("");

  const providersById = useMemo(() => {
    const map: Partial<Record<BankProviderId, ProviderDescriptor>> = {};
    for (const provider of providers) {
      map[provider.id] = provider;
    }
    return map;
  }, [providers]);

  useEffect(() => {
    async function loadProviders() {
      setProvidersLoading(true);
      setProvidersError(null);

      try {
        const response = await fetch("/api/bank-playground/providers", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data = await response.json();
        setProviders(Array.isArray(data.providers) ? data.providers : []);
      } catch (error) {
        setProvidersError(
          error instanceof Error ? error.message : "Failed to load providers"
        );
      } finally {
        setProvidersLoading(false);
      }
    }

    loadProviders();
  }, []);

  async function runProviderTest(providerId: BankProviderId) {
    setRunningProviderId(providerId);
    setRequestErrors((current) => ({ ...current, [providerId]: undefined }));

    try {
      const payload: Record<string, unknown> = { providerId };

      if (providerId === "interactive_brokers" && ibkrAccountId.trim()) {
        payload.options = {
          ibkrAccountId: ibkrAccountId.trim(),
        };
      }

      const response = await fetch("/api/bank-playground/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as PlaygroundTestResult;
      setResults((current) => ({ ...current, [providerId]: data }));
    } catch (error) {
      setRequestErrors((current) => ({
        ...current,
        [providerId]:
          error instanceof Error ? error.message : "Provider test failed",
      }));
    } finally {
      setRunningProviderId(null);
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bank Playground</h1>
        <p className="text-muted-foreground">
          Read-only connectivity playground for bank and broker integrations. This
          page never writes to your portfolio database.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Official APIs only</AlertTitle>
        <AlertDescription>
          This playground uses documented official provider surfaces. Unsupported
          providers include CSV fallback guidance.
        </AlertDescription>
      </Alert>

      {providersError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Provider metadata failed</AlertTitle>
          <AlertDescription>{providersError}</AlertDescription>
        </Alert>
      )}

      {providersLoading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {providers.map((provider) => {
            const result = results[provider.id];
            const requestError = requestErrors[provider.id];
            const isRunning = runningProviderId === provider.id;

            return (
              <Card key={provider.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{provider.displayName}</CardTitle>
                      <CardDescription>
                        {provider.capabilities.join(" • ")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={SUPPORT_BADGE_VARIANT[provider.support]}>
                        {SUPPORT_LABELS[provider.support]}
                      </Badge>
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Docs
                      </a>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Requirements: {provider.requirements.join(" • ")}
                  </div>

                  {provider.id === "interactive_brokers" && (
                    <div className="grid gap-2 sm:max-w-sm">
                      <Label htmlFor="ibkr-account-id">
                        IBKR Account (optional)
                      </Label>
                      <Input
                        id="ibkr-account-id"
                        placeholder="e.g. U1234567"
                        value={ibkrAccountId}
                        onChange={(event) => setIbkrAccountId(event.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <Button
                      onClick={() => runProviderTest(provider.id)}
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Running test
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Run test
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {requestError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Request failed</AlertTitle>
                      <AlertDescription>{requestError}</AlertDescription>
                    </Alert>
                  )}

                  {result && (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase text-muted-foreground mb-1">
                            Connection
                          </p>
                          <Badge variant={STATUS_BADGE_VARIANT[result.connectionStatus]}>
                            {STATUS_LABELS[result.connectionStatus]}
                          </Badge>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase text-muted-foreground mb-1">
                            Authentication
                          </p>
                          <Badge variant={STATUS_BADGE_VARIANT[result.authStatus]}>
                            {STATUS_LABELS[result.authStatus]}
                          </Badge>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs uppercase text-muted-foreground mb-1">
                            Holdings
                          </p>
                          <p className="font-semibold">{result.holdings.length}</p>
                        </div>
                      </div>

                      {result.errors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Errors</AlertTitle>
                          <AlertDescription>
                            {result.errors.join(" ")}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.warnings.length > 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Warnings</AlertTitle>
                          <AlertDescription>
                            {result.warnings.join(" ")}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.holdings.length > 0 ? (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead className="text-right">Market Value</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Asset Class</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.holdings.map((holding) => (
                                <TableRow key={`${holding.externalId}-${holding.symbol}`}>
                                  <TableCell className="font-medium">
                                    {holding.symbol}
                                  </TableCell>
                                  <TableCell>{holding.name}</TableCell>
                                  <TableCell className="text-right">
                                    {formatNumber(holding.quantity)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(holding.unitPrice, holding.currency)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(holding.marketValue, holding.currency)}
                                  </TableCell>
                                  <TableCell>{holding.currency}</TableCell>
                                  <TableCell>{holding.assetClass}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground rounded-lg border p-3">
                          No holdings returned for this test run.
                        </div>
                      )}

                      <details className="rounded-lg border p-3">
                        <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Raw diagnostics
                        </summary>
                        <pre className="mt-3 text-xs overflow-auto bg-muted p-3 rounded-md">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!providersLoading && providers.length === 0 && !providersError && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No provider descriptors returned by API.
          </CardContent>
        </Card>
      )}

      {!providersLoading && Object.keys(providersById).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Read-only mode enabled: test endpoints return diagnostics and normalized holdings only.
        </p>
      )}
    </div>
  );
}
