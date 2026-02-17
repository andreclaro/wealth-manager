"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetType, Currency } from "@prisma/client";
import { ASSET_TYPE_LABELS, CURRENCY_LABELS } from "@/types";
import { Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Loader2, Wand2 } from "lucide-react";

type WizardStep = "account" | "assets" | "review" | "done";
type AccountMode = "new" | "existing";

const MANUAL_TYPES: AssetType[] = [
  "BOND",
  "REAL_ESTATE",
  "CASH",
  "SAVINGS",
  "COMMODITY",
  "OTHER",
];

const ACCOUNT_TYPES = [
  "Bank",
  "Broker",
  "Crypto Wallet",
  "Exchange",
  "Savings Account",
  "Investment Fund",
  "Other",
];

interface ExistingAccount {
  id: string;
  name: string;
  type?: string | null;
  currency: Currency;
}

interface AccountDraft {
  name: string;
  type: string;
  currency: Currency;
}

interface AssetRow {
  id: string;
  symbol: string;
  type: AssetType;
  currency: Currency;
  quantity: string;
  currentPrice: string;
}

interface ValidatedRow extends AssetRow {
  resolvedName: string | null;
  isManualPrice: boolean;
  status: "valid" | "warning" | "error";
  error?: string;
}

interface DoneResult {
  accountName: string;
  created: number;
  skipped: number;
}

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function makeEmptyRow(): AssetRow {
  return {
    id: crypto.randomUUID(),
    symbol: "",
    type: "STOCK",
    currency: "EUR",
    quantity: "",
    currentPrice: "",
  };
}

const DEFAULT_ACCOUNT: AccountDraft = {
  name: "",
  type: "",
  currency: "EUR",
};

export function SetupWizard({ open, onOpenChange, onSuccess }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("account");
  const [accountMode, setAccountMode] = useState<AccountMode>("new");
  const [account, setAccount] = useState<AccountDraft>(DEFAULT_ACCOUNT);
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [rows, setRows] = useState<AssetRow[]>([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [doneResult, setDoneResult] = useState<DoneResult | null>(null);

  // Fetch existing accounts when wizard opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setExistingAccounts(Array.isArray(data) ? data : []))
      .catch(() => setExistingAccounts([]));
  }, [open]);

  const reset = useCallback(() => {
    setStep("account");
    setAccountMode("new");
    setAccount(DEFAULT_ACCOUNT);
    setSelectedAccountId("");
    setRows([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
    setValidatedRows([]);
    setIsValidating(false);
    setIsCreating(false);
    setDoneResult(null);
  }, []);

  // ── Step 2: row helpers ──────────────────────────────────────────────────

  const updateRow = (id: string, field: keyof AssetRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "symbol") return { ...r, symbol: value.toUpperCase() };
        return { ...r, [field]: value };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, makeEmptyRow()]);

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? [makeEmptyRow()] : next;
    });
  };

  // ── Step 2 → 3: validate ────────────────────────────────────────────────

  const handleValidate = async () => {
    const nonEmpty = rows.filter((r) => r.symbol.trim() || r.quantity.trim());

    setIsValidating(true);

    const results = await Promise.all(
      nonEmpty.map(async (row): Promise<ValidatedRow> => {
        const symbol = row.symbol.trim();
        const qty = parseFloat(row.quantity);
        const isManual = MANUAL_TYPES.includes(row.type);

        if (!symbol) {
          return { ...row, resolvedName: null, isManualPrice: isManual, status: "error", error: "Symbol is required" };
        }
        if (!row.quantity.trim() || isNaN(qty) || qty <= 0) {
          return { ...row, resolvedName: null, isManualPrice: isManual, status: "error", error: "Quantity must be > 0" };
        }
        if (isManual && !row.currentPrice.trim()) {
          return { ...row, resolvedName: null, isManualPrice: true, status: "error", error: "Price required for this type" };
        }

        if (isManual) {
          return { ...row, resolvedName: symbol, isManualPrice: true, status: "valid" };
        }

        try {
          const res = await fetch(`/api/assets/lookup?symbol=${encodeURIComponent(symbol)}&type=${row.type}`);
          if (res.ok) {
            const data = await res.json();
            if (data.name) {
              return { ...row, resolvedName: data.name, isManualPrice: false, status: "valid" };
            } else {
              return { ...row, resolvedName: null, isManualPrice: false, status: "warning" };
            }
          }
        } catch {
          // treat as warning
        }
        return { ...row, resolvedName: null, isManualPrice: false, status: "warning" };
      })
    );

    setValidatedRows(results);
    setIsValidating(false);
    setStep("review");
  };

  // ── Step 3 → 4: create ──────────────────────────────────────────────────

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      let accountId: string;
      let accountName: string;

      if (accountMode === "existing") {
        accountId = selectedAccountId;
        accountName = existingAccounts.find((a) => a.id === selectedAccountId)?.name ?? "";
      } else {
        const accRes = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: account.name,
            type: account.type || undefined,
            currency: account.currency,
          }),
        });

        if (!accRes.ok) throw new Error("Failed to create account");

        const createdAccount = await accRes.json();
        accountId = createdAccount.id;
        accountName = account.name;
      }

      // Create assets for valid/warning rows
      const importable = validatedRows.filter((r) => r.status === "valid" || r.status === "warning");
      let created = 0;

      for (const row of importable) {
        const assetName = row.resolvedName ?? row.symbol.trim();
        const payload = {
          symbol: row.symbol.trim(),
          name: assetName,
          type: row.type,
          quantity: parseFloat(row.quantity),
          currency: row.currency,
          currentPrice: row.currentPrice.trim() ? parseFloat(row.currentPrice) : undefined,
          isManualPrice: row.isManualPrice,
          accountId,
        };

        try {
          const assetRes = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (assetRes.ok) created++;
        } catch {
          // count as skipped
        }
      }

      setDoneResult({
        accountName,
        created,
        skipped: validatedRows.filter((r) => r.status === "error").length,
      });
      setStep("done");
    } catch (err) {
      console.error("Setup wizard error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const canProceedFromAccount =
    accountMode === "existing"
      ? !!selectedAccountId
      : !!account.name.trim();

  const confirmButtonLabel = accountMode === "existing" ? "Import Assets" : "Create Account & Import";

  // ── Step indicators ──────────────────────────────────────────────────────

  const STEPS: { key: WizardStep; label: string }[] = [
    { key: "account", label: "Account" },
    { key: "assets", label: "Assets" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) reset();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="w-[90vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Create an account and bulk-import your assets in a few steps.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  idx < stepIndex
                    ? "bg-primary text-primary-foreground"
                    : idx === stepIndex
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {idx < stepIndex ? "✓" : idx + 1}
              </div>
              <span
                className={`text-sm ${
                  idx === stepIndex ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {idx < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Account ── */}
        {step === "account" && (
          <div className="space-y-5">
            {/* Mode toggle */}
            <div className="flex rounded-md border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setAccountMode("new")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  accountMode === "new"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Create new
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("existing")}
                disabled={existingAccounts.length === 0}
                className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  accountMode === "existing"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Use existing
                {existingAccounts.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">({existingAccounts.length})</span>
                )}
              </button>
            </div>

            {/* Existing account picker */}
            {accountMode === "existing" && (
              <div className="space-y-2">
                <Label htmlFor="existing-account">Select Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger id="existing-account" className="w-full">
                    <SelectValue placeholder="Choose an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-medium">{a.name}</span>
                        {a.type && (
                          <span className="ml-2 text-muted-foreground text-xs">{a.type}</span>
                        )}
                        <span className="ml-2 text-muted-foreground text-xs">{a.currency}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* New account form */}
            {accountMode === "new" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="acc-name">Account Name *</Label>
                  <Input
                    id="acc-name"
                    placeholder="e.g. Interactive Brokers, Coinbase"
                    value={account.name}
                    onChange={(e) => setAccount({ ...account, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acc-type">Account Type</Label>
                  <Select
                    value={account.type}
                    onValueChange={(v) => setAccount({ ...account, type: v })}
                  >
                    <SelectTrigger id="acc-type" className="w-full">
                      <SelectValue placeholder="Select type (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acc-currency">Base Currency *</Label>
                  <Select
                    value={account.currency}
                    onValueChange={(v) => setAccount({ ...account, currency: v as Currency })}
                  >
                    <SelectTrigger id="acc-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep("assets")} disabled={!canProceedFromAccount}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Assets ── */}
        {step === "assets" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your assets below. Rows with no symbol and no quantity are skipped.
            </p>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Symbol</TableHead>
                    <TableHead className="w-[150px]">Type</TableHead>
                    <TableHead className="w-[120px]">Currency</TableHead>
                    <TableHead className="w-[100px]">Quantity</TableHead>
                    <TableHead className="w-[100px]">Price *</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-2">
                        <Input
                          placeholder="AAPL"
                          value={row.symbol}
                          onChange={(e) => updateRow(row.id, "symbol", e.target.value)}
                          className="h-8 uppercase"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={row.type}
                          onValueChange={(v) => updateRow(row.id, "type", v)}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ASSET_TYPE_LABELS).map(([code, label]) => (
                              <SelectItem key={code} value={code}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={row.currency}
                          onValueChange={(v) => updateRow(row.id, "currency", v)}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                              <SelectItem key={code} value={code}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          type="number"
                          placeholder="10"
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                          className="h-8"
                          min="0"
                          step="any"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          type="number"
                          placeholder="optional"
                          value={row.currentPrice}
                          onChange={(e) => updateRow(row.id, "currentPrice", e.target.value)}
                          className="h-8"
                          min="0"
                          step="any"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              * Price required for Bond, Real Estate, Cash, Savings, Commodity, Other
            </p>

            <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("account")}>
                ← Back
              </Button>
              <Button onClick={handleValidate} disabled={isValidating}>
                {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isValidating ? "Validating…" : "Validate & Preview →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === "review" && (
          <div className="space-y-4">
            {validatedRows.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No assets to import. Go back and add at least one row.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-medium">
                    {validatedRows.filter((r) => r.status === "valid").length} ready
                  </span>
                  <span className="text-amber-600 font-medium">
                    {validatedRows.filter((r) => r.status === "warning").length} warnings
                  </span>
                  <span className="text-destructive font-medium">
                    {validatedRows.filter((r) => r.status === "error").length} errors (skipped)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Resolved Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validatedRows.map((row, idx) => (
                        <TableRow
                          key={row.id}
                          className={row.status === "error" ? "opacity-50" : ""}
                        >
                          <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-semibold">{row.symbol}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.resolvedName ?? (row.status === "warning" ? row.symbol : "—")}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{ASSET_TYPE_LABELS[row.type]}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{row.currency}</span>
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.quantity || "—"}</TableCell>
                          <TableCell className="text-right text-sm">{row.currentPrice || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge row={row} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {validatedRows.every((r) => r.status === "error") && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      All rows have errors. Go back and fix them before importing.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("assets")}>
                ← Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  validatedRows.length === 0 ||
                  validatedRows.every((r) => r.status === "error")
                }
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreating ? "Creating…" : confirmButtonLabel}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && doneResult && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                <p className="font-semibold">Setup complete!</p>
              </AlertDescription>
            </Alert>

            <div className="rounded-lg bg-muted p-4 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Account:</span>{" "}
                <span className="font-medium">{doneResult.accountName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Assets created:</span>{" "}
                <span className="font-medium text-green-600">{doneResult.created}</span>
              </p>
              {doneResult.skipped > 0 && (
                <p>
                  <span className="text-muted-foreground">Rows skipped (errors):</span>{" "}
                  <span className="font-medium text-destructive">{doneResult.skipped}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onSuccess();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ row }: { row: ValidatedRow }) {
  if (row.status === "valid") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-0">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }
  if (row.status === "warning") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-0">
        <AlertTriangle className="h-3 w-3" />
        No name found
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-destructive/50 text-destructive"
      title={row.error}
    >
      <XCircle className="h-3 w-3" />
      {row.error ?? "Error"}
    </Badge>
  );
}
