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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wm-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Markets
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-4 w-4" />
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

      <CardContent className="pt-0">
        {trackedAssets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              No assets tracked. Select assets to monitor live prices.
            </p>
            <Button variant="outline" size="sm" onClick={() => setIsConfigOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Assets
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(trackedByCategory).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  {CATEGORY_ICONS[category as MarketAssetCategory]}
                  {CATEGORY_LABELS[category as MarketAssetCategory]}
                  <Badge variant="secondary" className="text-[10px]">
                    {items.length}
                  </Badge>
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex-shrink-0 w-[160px] p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group relative"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                        onClick={() => handleToggleAsset(item.asset.id, true)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="min-w-0 pr-5">
                        <p className="font-medium text-sm truncate">
                          {item.asset.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.asset.symbol}
                        </p>
                      </div>
                      
                      {item.asset.priceCache ? (
                        <div className="mt-2">
                          <p className="text-lg font-semibold">
                            {formatCurrency(item.asset.priceCache.price, item.asset.currency as any, {
                              decimals: 2,
                            })}
                          </p>
                          {formatChange(
                            item.asset.priceCache.change,
                            item.asset.priceCache.changePercent
                          )}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">Loading...</p>
                          <p className="text-[10px] text-muted-foreground">Click refresh</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
