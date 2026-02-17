"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AssetForm } from "@/components/AssetForm";
import { AssetCard } from "@/components/AssetCard";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { SetupWizard } from "@/components/SetupWizard";
import { Plus, Search, RefreshCw, LayoutGrid, List, Building2, Upload, Wand2 } from "lucide-react";
import { AssetWithValue, AssetFormData, ASSET_TYPE_LABELS, Account } from "@/types";
import { AssetType } from "@prisma/client";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ASSET_TYPE_COLORS } from "@/types";

type ViewMode = "grid" | "list";

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetWithValue[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetWithValue[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [accountFilter, setAccountFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [addingAsset, setAddingAsset] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchAssets = async () => {
    try {
      const response = await fetch("/api/assets");
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
        setFilteredAssets(data);
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchAccounts();
  }, []);

  // Calculate totals per account
  const accountTotals = accounts.map((account) => {
    const accountAssets = assets.filter((a) => a.accountId === account.id);
    const totalValueUSD = accountAssets.reduce((sum, a) => sum + a.totalValueUSD, 0);
    const totalValueEUR = accountAssets.reduce((sum, a) => sum + a.totalValueEUR, 0);
    return { ...account, totalValueUSD, totalValueEUR, assetCount: accountAssets.length };
  });

  useEffect(() => {
    let filtered = assets;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== "ALL") {
      filtered = filtered.filter((asset) => asset.type === typeFilter);
    }

    if (accountFilter !== "ALL") {
      filtered = filtered.filter((asset) => asset.accountId === accountFilter);
    }

    setFilteredAssets(filtered);
  }, [searchQuery, typeFilter, accountFilter, assets]);

  const handleAddAsset = async (data: AssetFormData) => {
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setAddingAsset(false);
        await fetchAssets();
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  const handleRefreshAsset = async (id: string) => {
    setRefreshingId(id);
    try {
      const response = await fetch(`/api/assets/${id}/refresh`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchAssets();
      }
    } catch (error) {
      console.error("Error refreshing asset:", error);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchAssets();
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            Manage your investment portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSetupWizardOpen(true)}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Setup Wizard
          </Button>
          <Button
            variant="outline"
            onClick={() => setCsvImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={addingAsset} onOpenChange={setAddingAsset}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
              </DialogHeader>
              <AssetForm
                onSubmit={handleAddAsset}
                onCancel={() => setAddingAsset(false)}
                submitLabel="Add Asset"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Import Dialogs */}
      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onSuccess={fetchAssets}
      />
      <SetupWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        onSuccess={() => { fetchAssets(); fetchAccounts(); }}
      />

      {/* Account Summary Cards */}
      {accountTotals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accountTotals.slice(0, 4).map((account) => (
            <Card 
              key={account.id} 
              className={`cursor-pointer transition-colors ${accountFilter === account.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              onClick={() => setAccountFilter(accountFilter === account.id ? "ALL" : account.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{account.name}</span>
                </div>
                <div className="text-lg font-bold">
                  {formatCurrency(account.totalValueEUR, "EUR")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(account.totalValueUSD, "USD")} • {account.assetCount} assets
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredAssets.length} of {assets.length} assets
      </p>

      {/* Assets Display */}
      {filteredAssets.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            {assets.length === 0
              ? "No assets in your portfolio yet. Start by adding your first asset!"
              : "No assets match your search criteria."}
          </p>
          {assets.length === 0 && (
            <Button onClick={() => setAddingAsset(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Asset
            </Button>
          )}
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onRefresh={() => handleRefreshAsset(asset.id)}
              onEdit={() => router.push(`/app/assets/${asset.id}/edit`)}
              onDelete={() => handleDeleteAsset(asset.id)}
              isRefreshing={refreshingId === asset.id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value (EUR)</TableHead>
                <TableHead className="text-right">Value (USD)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/app/assets/${asset.id}/edit`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{asset.symbol}</p>
                      <p className="text-sm text-muted-foreground">
                        {asset.name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">
                        {asset.account?.name || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: `${ASSET_TYPE_COLORS[asset.type]}20`,
                        color: ASSET_TYPE_COLORS[asset.type],
                      }}
                    >
                      {ASSET_TYPE_LABELS[asset.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {asset.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(asset.currentPrice || 0, asset.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(asset.totalValueEUR, "EUR")}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(asset.totalValueUSD, "USD")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshAsset(asset.id);
                      }}
                      disabled={refreshingId === asset.id || asset.isManualPrice}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          refreshingId === asset.id ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset.id);
                      }}
                    >
                      <span className="sr-only">Delete</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
