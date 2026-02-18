"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PortfolioHistory } from "@/components/PortfolioHistory";
import { AssetCard } from "@/components/AssetCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AssetForm } from "@/components/AssetForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Euro,
  Package,
} from "lucide-react";
import { PortfolioSummary, AssetWithValue, PriceHistoryPoint, AssetFormData } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [assets, setAssets] = useState<AssetWithValue[]>([]);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);
  const router = useRouter();

  const fetchData = async (days = historyDays) => {
    try {
      setLoading(true);
      const daysParam = days === 0 ? "" : `days=${days}&`;
      const url = `/api/portfolio/history?${daysParam}includeAssets=true`;
      console.log("Fetching history:", url, "days:", days);
      const [summaryRes, assetsRes, historyRes] = await Promise.all([
        fetch("/api/portfolio/summary"),
        fetch("/api/assets"),
        fetch(url),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (assetsRes.ok) setAssets(await assetsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const handleDaysChange = (days: number) => {
    setHistoryDays(days);
    fetchData(days);
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/prices/refresh", { method: "POST" });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error refreshing prices:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddAsset = async (data: AssetFormData) => {
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setAddingAsset(false);
        await fetchData();
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  const handleRefreshAsset = async (id: string) => {
    try {
      const response = await fetch(`/api/assets/${id}/refresh`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error refreshing asset:", error);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your investment portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh Prices
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Value (EUR)
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalValueEUR || 0, "EUR", { decimals: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Value (USD)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalValueUSD || 0, "USD", { decimals: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAssets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Types</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? Object.values(summary.assetsByType).filter((a) => a.count > 0).length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioChart summary={summary} assets={assets} currency="EUR" />
        <PortfolioHistory 
          data={history} 
          days={historyDays}
          onDaysChange={handleDaysChange}
        />
      </div>

      {/* Recent Assets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Assets</h2>
          <Button variant="outline" onClick={() => router.push("/app/assets")}>
            View All
          </Button>
        </div>

        {assets.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No assets in your portfolio yet. Start by adding your first asset!
            </p>
            <Button onClick={() => setAddingAsset(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Asset
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.slice(0, 6).map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onRefresh={() => handleRefreshAsset(asset.id)}
                onEdit={() => router.push(`/app/assets/${asset.id}/edit`)}
                onDelete={() => handleDeleteAsset(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
