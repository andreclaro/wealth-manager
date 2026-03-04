"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  Plus,
  Minus,
  Activity,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { MarketAssetCategory } from "@prisma/client";

interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  category: MarketAssetCategory;
  exchange: string | null;
  currency: string;
  isTracked: boolean;
}

interface PriceCache {
  price: number;
  change: number | null;
  changePercent: number | null;
  lastUpdated: string;
}

interface TrackedAsset {
  id: string;
  asset: MarketAsset & { priceCache: PriceCache | null };
}

const CATEGORY_ICONS: Record<MarketAssetCategory, string> = {
  INDEX: "📊",
  COMMODITY: "🛢️",
  CRYPTO: "₿",
  CURRENCY: "💱",
};

const CATEGORY_LABELS: Record<MarketAssetCategory, string> = {
  INDEX: "Indexes",
  COMMODITY: "Commodities",
  CRYPTO: "Crypto",
  CURRENCY: "Currencies",
};

export function LiveMarketsWidget() {
  const [trackedAssets, setTrackedAssets] = useState<TrackedAsset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<MarketAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MarketAssetCategory | "ALL">("ALL");

  const fetchTracked = useCallback(async () => {
    try {
      const response = await fetch("/api/markets/prices");
      if (response.ok) {
        const data = await response.json();
        setTrackedAssets(data.assets);
      }
    } catch (error) {
      console.error("Error fetching tracked assets:", error);
    }
  }, []);

  const fetchAvailable = useCallback(async () => {
    try {
      const response = await fetch("/api/markets/assets");
      if (response.ok) {
        const data = await response.json();
        setAvailableAssets(data);
      }
    } catch (error) {
      console.error("Error fetching available assets:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchTracked(), fetchAvailable()]);
    setIsLoading(false);
  }, [fetchTracked, fetchAvailable]);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchTracked, 60000);
    return () => clearInterval(interval);
  }, [loadData, fetchTracked]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/markets/prices", { method: "POST" });
      await fetchTracked();
    } catch (error) {
      console.error("Error refreshing prices:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleAsset = async (assetId: string, isTracked: boolean) => {
    try {
      if (isTracked) {
        // Remove from tracked
        const tracked = trackedAssets.find((t) => t.asset.id === assetId);
        if (tracked) {
          await fetch(`/api/markets/tracked/${tracked.id}`, { method: "DELETE" });
        }
      } else {
        // Add to tracked
        await fetch("/api/markets/tracked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
      }
      
      // Refresh both lists
      await Promise.all([fetchTracked(), fetchAvailable()]);
    } catch (error) {
      console.error("Error toggling asset:", error);
    }
  };

  const formatChange = (change: number | null, changePercent: number | null) => {
    if (changePercent === null || changePercent === undefined) return "—";
    const isPositive = changePercent >= 0;
    return (
      <span className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-green-600" : "text-red-600"
      )}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {changePercent >= 0 ? "+" : ""}
        {changePercent.toFixed(2)}%
      </span>
    );
  };

  const filteredAssets = selectedCategory === "ALL" 
    ? availableAssets 
    : availableAssets.filter((a) => a.category === selectedCategory);

  const trackedByCategory = trackedAssets.reduce((acc, item) => {
    const cat = item.asset.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<MarketAssetCategory, TrackedAsset[]>);

  if (isLoading) {
    return (
      <Card className="wm-surface">
        <CardContent className="py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading markets...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wm-surface">
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Markets
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Settings className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Select Assets to Track</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="ALL" onValueChange={(v) => setSelectedCategory(v as any)}>
                  <TabsList className="grid grid-cols-5">
                    <TabsTrigger value="ALL">All</TabsTrigger>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <TabsTrigger key={key} value={key}>
                        {CATEGORY_ICONS[key as MarketAssetCategory]} {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  <ScrollArea className="h-[400px] mt-4">
                    <div className="space-y-2">
                      {filteredAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {CATEGORY_ICONS[asset.category]}
                            </span>
                            <div>
                              <p className="font-medium text-sm">{asset.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {asset.symbol} • {asset.exchange || "N/A"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={asset.isTracked}
                            onCheckedChange={() => handleToggleAsset(asset.id, asset.isTracked)}
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-2 px-4">
        {trackedAssets.length === 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">No assets tracked</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsConfigOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {trackedAssets.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.asset.symbol}</span>
                  {item.asset.priceCache ? (
                    <>
                      <span className="text-sm">
                        {formatCurrency(item.asset.priceCache.price, item.asset.currency as any, { decimals: 2 })}
                      </span>
                      <span className={cn(
                        "text-xs",
                        (item.asset.priceCache.changePercent || 0) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {(item.asset.priceCache.changePercent || 0) >= 0 ? "+" : ""}
                        {(item.asset.priceCache.changePercent || 0).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
