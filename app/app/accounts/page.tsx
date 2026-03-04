"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { AccountWithTotals, CURRENCY_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Currency } from "@prisma/client";
import {
  Building2,
  ExternalLink,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { format } from "date-fns";

type ViewMode = "grid" | "list";
const STORAGE_KEY = "accounts-page-preferences";

const ACCOUNT_TYPES = [
  "Bank",
  "Broker",
  "Crypto Exchange",
  "Crypto Wallet",
  "Equity",
  "Savings",
  "Pension",
  "P2P",
  "Other",
];

interface PagePreferences {
  viewMode: ViewMode;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithTotals | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    currency: "EUR" as Currency,
    notes: "",
  });
  
  // Wallet address state for Crypto Wallet accounts
  const [walletAddressData, setWalletAddressData] = useState({
    chainType: "EVM" as "EVM" | "SOLANA",
    address: "",
    evmChainId: "",
    label: "",
  });
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const preferences = JSON.parse(saved) as PagePreferences;
        if (preferences.viewMode === "grid" || preferences.viewMode === "list") {
          setViewMode(preferences.viewMode);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ viewMode: mode }));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const filterTypeOptions = useMemo(() => {
    const existingTypes = accounts
      .map((account) => account.type?.trim())
      .filter((type): type is string => Boolean(type));

    return Array.from(new Set([...ACCOUNT_TYPES, ...existingTypes])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((account) => {
        return (
          account.name.toLowerCase().includes(query) ||
          (account.type || "").toLowerCase().includes(query) ||
          (account.notes || "").toLowerCase().includes(query) ||
          account.currency.toLowerCase().includes(query)
        );
      });
    }

    if (typeFilter === "NONE") {
      filtered = filtered.filter((account) => !account.type);
    } else if (typeFilter !== "ALL") {
      filtered = filtered.filter((account) => account.type === typeFilter);
    }

    if (currencyFilter !== "ALL") {
      filtered = filtered.filter((account) => account.currency === currencyFilter);
    }

    return filtered;
  }, [accounts, searchQuery, typeFilter, currencyFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || typeFilter !== "ALL" || currencyFilter !== "ALL";

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setCurrencyFilter("ALL");
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const validateWalletAddress = (): boolean => {
    setWalletError(null);
    
    if (formData.type !== "Crypto Wallet") return true;
    
    if (!walletAddressData.address.trim()) {
      setWalletError("Wallet address is required for crypto wallets");
      return false;
    }
    
    const address = walletAddressData.address.trim();
    
    if (walletAddressData.chainType === "EVM") {
      const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
      const isPChain = /^P-avax1[0-9a-z]+$/i.test(address);
      const isPChainAlt = /^avax1[0-9a-z]+$/i.test(address);
      
      if (!isEvm && !isPChain && !isPChainAlt) {
        setWalletError("Invalid EVM address (should be 0x... or P-avax1...)");
        return false;
      }
      
      // Chain selection is optional - if not selected, all EVM chains will be scanned
    } else if (walletAddressData.chainType === "SOLANA") {
      const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      if (!isSolana) {
        setWalletError("Invalid Solana address");
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateWalletAddress()) return;
    
    setIsSubmitting(true);
    setIsCreatingWallet(formData.type === "Crypto Wallet");

    try {
      // 1. Create account
      const accountResponse = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!accountResponse.ok) {
        throw new Error("Failed to create account");
      }

      const account = await accountResponse.json();

      // 2. If Crypto Wallet, create wallet address
      if (formData.type === "Crypto Wallet") {
        const address = walletAddressData.address.trim();
        const isPChain = /^P-avax1[0-9a-z]+$/i.test(address) || /^avax1[0-9a-z]+$/i.test(address);
        
        const walletData = {
          chainType: walletAddressData.chainType,
          address: address,
          // If 'all' or no chain selected, all EVM chains will be scanned
          evmChainId: isPChain ? undefined : (walletAddressData.evmChainId && walletAddressData.evmChainId !== "all" ? parseInt(walletAddressData.evmChainId) : undefined),
          isPChain: isPChain,
          label: walletAddressData.label || undefined,
          syncEnabled: true,
        };
        
        const walletResponse = await fetch(`/api/accounts/${account.id}/wallet-addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(walletData),
        });
        
        // Auto-sync the wallet after creation
        if (walletResponse.ok) {
          const walletAddress = await walletResponse.json();
          console.log(`[AccountCreate] Auto-syncing wallet ${walletAddress.id}...`);
          
          // Trigger sync in background (don't await to avoid blocking)
          fetch(`/api/wallet-addresses/${walletAddress.id}/sync`, { method: "POST" })
            .then(syncResponse => {
              if (syncResponse.ok) {
                console.log(`[AccountCreate] Wallet ${walletAddress.id} synced successfully`);
              } else {
                console.warn(`[AccountCreate] Wallet ${walletAddress.id} sync failed`);
              }
            })
            .catch(err => console.error(`[AccountCreate] Sync error:`, err));
        }
      }

      // 3. Reset and close
      setIsDialogOpen(false);
      setFormData({ name: "", type: "", currency: "EUR", notes: "" });
      setWalletAddressData({ chainType: "EVM", address: "", evmChainId: "", label: "" });
      setWalletError(null);
      loadAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
    } finally {
      setIsSubmitting(false);
      setIsCreatingWallet(false);
    }
  };

  const handleDelete = async (id: string, assetCount: number) => {
    const hasAssets = assetCount > 0;
    const message = hasAssets
      ? `⚠️ This account has ${assetCount} asset(s). Deleting it will also delete all associated assets and wallet addresses. Are you sure you want to continue?`
      : "Are you sure you want to delete this account?";
    
    if (!confirm(message)) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadAccounts();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleEdit = (account: AccountWithTotals) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type || "",
      currency: account.currency,
      notes: account.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsEditDialogOpen(false);
        setEditingAccount(null);
        setFormData({ name: "", type: "", currency: "EUR", notes: "" });
        loadAccounts();
      }
    } catch (error) {
      console.error("Error updating account:", error);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="wm-page space-y-6">
      <div className="wm-page-header">
        <div>
          <h1 className="wm-page-title">Accounts</h1>
          <p className="wm-page-subtitle">
            Manage your accounts and wallets for tracking all assets
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="wm-soft-hover">
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
              <DialogDescription>
                Add a new account or wallet to track your assets
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Interactive Brokers, MetaMask, Chase Checking"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Account Type (Optional)</Label>
                <Select
                  value={formData.type || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      currency: value as Currency,
                    }))
                  }
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
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Add any additional notes..."
                  rows={2}
                />
              </div>

              {/* Wallet Address Section - only for Crypto Wallet */}
              {formData.type === "Crypto Wallet" && (
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Wallet Address</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="walletChainType">Chain Type</Label>
                    <Select
                      value={walletAddressData.chainType}
                      onValueChange={(value) =>
                        setWalletAddressData((prev) => ({
                          ...prev,
                          chainType: value as "EVM" | "SOLANA",
                          evmChainId: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVM">EVM (Ethereum, Polygon, etc.)</SelectItem>
                        <SelectItem value="SOLANA">Solana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {walletAddressData.chainType === "EVM" && (
                    <div className="space-y-2">
                      <Label htmlFor="evmChain">Chain (Optional)</Label>
                      <Select
                        value={walletAddressData.evmChainId}
                        onValueChange={(value) =>
                          setWalletAddressData((prev) => ({ ...prev, evmChainId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All chains (auto-scan)">
                            {walletAddressData.evmChainId === "all" ? "All chains (auto-scan)" : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All chains (auto-scan)</SelectItem>
                          <SelectItem value="1">Ethereum Mainnet</SelectItem>
                          <SelectItem value="137">Polygon</SelectItem>
                          <SelectItem value="42161">Arbitrum</SelectItem>
                          <SelectItem value="8453">Base</SelectItem>
                          <SelectItem value="43114">Avalanche C-Chain</SelectItem>
                          <SelectItem value="10">Optimism</SelectItem>
                          <SelectItem value="p-chain">Avalanche P-Chain</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to auto-scan all supported EVM chains
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="walletAddress">Address</Label>
                    <Input
                      id="walletAddress"
                      value={walletAddressData.address}
                      onChange={(e) =>
                        setWalletAddressData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder={
                        walletAddressData.chainType === "EVM"
                          ? "0x... or P-avax1..."
                          : "Solana address"
                      }
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="walletLabel">Label (Optional)</Label>
                    <Input
                      id="walletLabel"
                      value={walletAddressData.label}
                      onChange={(e) =>
                        setWalletAddressData((prev) => ({ ...prev, label: e.target.value }))
                      }
                      placeholder="e.g., Main Wallet"
                    />
                  </div>

                  {walletError && (
                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                      {walletError}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className={`h-4 w-4 mr-1 ${isCreatingWallet ? "animate-spin" : ""}`} />
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="wm-surface animate-pulse">
              <CardHeader className="h-16 bg-muted" />
              <CardContent className="h-16 bg-muted mt-1" />
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="wm-surface text-center py-12">
          <CardContent>
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Accounts Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first account to start tracking assets
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="wm-surface rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="NONE">No Type</SelectItem>
                  {filterTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-background">
                  <SelectValue placeholder="Filter by currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Currencies</SelectItem>
                  {Object.entries(CURRENCY_LABELS).map(([currency, label]) => (
                    <SelectItem key={currency} value={currency}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => handleViewModeChange("grid")}
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => handleViewModeChange("list")}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>

          {filteredAccounts.length === 0 ? (
            <Card className="wm-surface p-8 text-center">
              <p className="text-muted-foreground">No accounts match your filters.</p>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {filteredAccounts.map((account) => (
                <Card key={account.id} className="wm-surface wm-soft-hover">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={account.type === "Crypto Wallet" ? `/app/accounts/${account.id}` : `/app/assets?account=${account.id}`}
                          className="group flex items-center gap-1.5"
                        >
                          <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                            {account.name}
                          </CardTitle>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </Link>
                        <CardDescription className="text-xs">
                          {account.type || "No type"}
                          {account.type === "Crypto Wallet" && account.walletAddresses && account.walletAddresses.length > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              • Wallet connected
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(account)}
                          title="Edit account"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(account.id, account.assets.length)}
                          title="Delete account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 px-4">
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[11px] text-muted-foreground">EUR</p>
                          <p className="text-sm font-semibold leading-tight">
                            {formatCurrency(account.totalValueEUR, "EUR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">USD</p>
                          <p className="text-sm font-semibold leading-tight">
                            {formatCurrency(account.totalValueUSD, "USD")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {account.type === "Crypto Wallet" ? (
                          <>
                            <Wallet className="h-3.5 w-3.5" />
                            <span>
                              {account.walletAddresses && account.walletAddresses.length > 0 ? "Wallet connected" : "No wallet"}
                            </span>
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3.5 w-3.5" />
                            <span>
                              {account.assets.length} asset
                              {account.assets.length !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{account.currency}</span>
                      </div>
                      {account.notes && (
                        <p className="text-xs text-muted-foreground truncate">
                          {account.notes}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Added {format(new Date(account.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="wm-surface overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                    <TableHead className="text-right">Value (EUR)</TableHead>
                    <TableHead className="text-right">Value (USD)</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id} className="group hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={account.type === "Crypto Wallet" ? `/app/accounts/${account.id}` : `/app/assets?account=${account.id}`}
                          className="block hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            {account.type === "Crypto Wallet" ? (
                              <Wallet className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[220px]">
                                {account.name}
                              </p>
                              {account.type === "Crypto Wallet" && account.walletAddresses && account.walletAddresses.length > 0 && (
                                <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                  Wallet connected
                                </p>
                              )}
                              {account.notes && account.type !== "Crypto Wallet" && (
                                <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                  {account.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{account.type || "No type"}</TableCell>
                      <TableCell>{account.currency}</TableCell>
                      <TableCell className="text-right">{account.assets.length}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(account.totalValueEUR, "EUR")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(account.totalValueUSD, "USD")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(new Date(account.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={account.type === "Crypto Wallet" ? `/app/accounts/${account.id}` : `/app/assets?account=${account.id}`}>
                              <Link2 className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(account)}
                            title="Edit account"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(account.id, account.assets.length)}
                            title="Delete account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Interactive Brokers, MetaMask, Chase Checking"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Account Type (Optional)</Label>
              <Select
                value={formData.type || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    currency: value as Currency,
                  }))
                }
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
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingAccount(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
