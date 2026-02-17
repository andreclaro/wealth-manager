"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AssetType, Currency, Account } from "@prisma/client";
import { AssetFormData, ASSET_TYPE_LABELS, CURRENCY_LABELS } from "@/types";
import { Loader2 } from "lucide-react";

interface AssetFormProps {
  initialData?: Partial<AssetFormData>;
  onSubmit: (data: AssetFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const defaultFormData: AssetFormData = {
  symbol: "",
  name: "",
  type: "STOCK",
  quantity: 0,
  purchasePrice: undefined,
  currency: "EUR",
  currentPrice: undefined,
  notes: "",
  isManualPrice: false,
  accountId: "",
};

// Asset types that support auto-fetching names
const AUTO_FETCH_TYPES = ["STOCK", "ETF", "CRYPTO"];

export function AssetForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = "Save Asset",
}: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormData>({
    ...defaultFormData,
    ...initialData,
  });
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Auto-fetch name when symbol changes
  const fetchAssetName = useCallback(async (symbol: string, type: string) => {
    if (!symbol || symbol.length < 1 || !AUTO_FETCH_TYPES.includes(type)) {
      return;
    }

    setIsFetchingName(true);
    try {
      const response = await fetch(
        `/api/assets/lookup?symbol=${encodeURIComponent(symbol)}&type=${type}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.name) {
          setFormData((prev) => ({ ...prev, name: data.name }));
        }
      }
    } catch (error) {
      console.error("Error fetching asset name:", error);
    } finally {
      setIsFetchingName(false);
    }
  }, []);

  // Debounce name fetching
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (
        formData.symbol &&
        AUTO_FETCH_TYPES.includes(formData.type) &&
        !formData.name &&
        !initialData?.name // Don't auto-fetch if editing with existing name
      ) {
        fetchAssetName(formData.symbol, formData.type);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.symbol, formData.type, formData.name, initialData?.name, fetchAssetName]);

  // Load accounts for all assets (required)
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = <K extends keyof AssetFormData>(
    field: K,
    value: AssetFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isCrypto = formData.type === "CRYPTO";
  const isManualType = ["REAL_ESTATE", "CASH", "SAVINGS", "OTHER", "BOND"].includes(
    formData.type
  );
  const isCash = formData.type === "CASH";
  const isSavings = formData.type === "SAVINGS";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="symbol">
            {isCash ? "Currency" : `Symbol / Ticker ${isCrypto ? "(e.g., BTC, ETH)" : ""}`}
          </Label>
          <Input
            id="symbol"
            value={formData.symbol}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              updateField("symbol", value);
              // Auto-update name for cash when symbol changes
              if (isCash) {
                updateField("name", `Cash - ${value}`);
              }
            }}
            placeholder={isCrypto ? "BTC" : isCash ? "USD" : "AAPL"}
            required
            disabled={isCash}
          />
          {isCash && (
            <p className="text-xs text-muted-foreground">
              Symbol is auto-set to the selected currency
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Name
            {isFetchingName && (
              <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />
            )}
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder={isCrypto ? "Bitcoin" : isCash ? "Cash - USD" : "Apple Inc."}
            required
            disabled={isCash}
          />
          {isCash && (
            <p className="text-xs text-muted-foreground">
              Name is auto-generated for cash
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Asset Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => {
              const newType = value as AssetType;
              updateField("type", newType);
              // Auto-set manual price for certain types
              if (["REAL_ESTATE", "CASH", "SAVINGS", "OTHER", "BOND"].includes(value)) {
                updateField("isManualPrice", true);
              }
              // Auto-set defaults for cash assets
              if (newType === "CASH") {
                updateField("symbol", formData.currency);
                updateField("name", `Cash - ${formData.currency}`);
                updateField("currentPrice", 1); // Cash is always worth 1.00 per unit
              } else if (newType === "SAVINGS") {
                updateField("symbol", "SAVINGS");
                updateField("name", "Savings Account");
                updateField("currentPrice", 1); // Savings balance per unit = 1.00
              } else {
                // Clear auto-set values when switching away from cash/savings
                if (formData.symbol === formData.currency && formData.name?.startsWith("Cash - ")) {
                  updateField("symbol", "");
                  updateField("name", "");
                }
                if (formData.symbol === "SAVINGS" && formData.name === "Savings Account") {
                  updateField("symbol", "");
                  updateField("name", "");
                }
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => {
              const newCurrency = value as Currency;
              updateField("currency", newCurrency);
              // Auto-update symbol and name for cash when currency changes
              if (isCash) {
                updateField("symbol", newCurrency);
                updateField("name", `Cash - ${newCurrency}`);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURRENCY_LABELS).map(([curr, label]) => (
                <SelectItem key={curr} value={curr}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">
            {formData.type === "REAL_ESTATE"
              ? "Property Value"
              : isCash || isSavings
              ? "Balance"
              : "Quantity"}
          </Label>
          <Input
            id="quantity"
            type="number"
            step="any"
            min="0"
            value={formData.quantity}
            onChange={(e) =>
              updateField("quantity", parseFloat(e.target.value) || 0)
            }
            placeholder={formData.type === "REAL_ESTATE" ? "500000" : "10"}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchasePrice">
            Purchase Price (Optional - for cost basis)
          </Label>
          <Input
            id="purchasePrice"
            type="number"
            step="any"
            min="0"
            value={formData.purchasePrice || ""}
            onChange={(e) =>
              updateField(
                "purchasePrice",
                e.target.value ? parseFloat(e.target.value) : undefined
              )
            }
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="manualPrice"
          checked={formData.isManualPrice}
          onCheckedChange={(checked) => updateField("isManualPrice", checked)}
          disabled={isManualType}
        />
        <Label htmlFor="manualPrice" className="cursor-pointer">
          Manual Price (don&apos;t auto-fetch)
          {isManualType && (
            <span className="text-muted-foreground text-sm ml-2">
              (Required for {ASSET_TYPE_LABELS[formData.type]})
            </span>
          )}
        </Label>
      </div>

      {formData.isManualPrice && (
        <div className="space-y-2">
          <Label htmlFor="currentPrice">
            {isCash ? "Unit Price (always 1.00 for cash)" : "Current Price"}
          </Label>
          <Input
            id="currentPrice"
            type="number"
            step="any"
            min="0"
            value={formData.currentPrice || ""}
            onChange={(e) =>
              updateField(
                "currentPrice",
                e.target.value ? parseFloat(e.target.value) : undefined
              )
            }
            placeholder={isCash ? "1.00" : "0.00"}
            required={formData.isManualPrice}
            disabled={isCash}
          />
          {isCash && (
            <p className="text-xs text-muted-foreground">
              Total value = Balance × 1.00 = {formData.quantity || 0} {formData.currency}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="account">
          Account
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Select
          value={formData.accountId || "none"}
          onValueChange={(value) =>
            updateField("accountId", value === "none" ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select an account...</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} {account.type && `(${account.type})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accounts.length === 0 && !isLoadingAccounts && (
          <p className="text-sm text-destructive">
            No accounts found. Please create an account first.
          </p>
        )}
        {accounts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Select the account/wallet where this asset is held
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Add any additional notes about this asset..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !formData.accountId}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
