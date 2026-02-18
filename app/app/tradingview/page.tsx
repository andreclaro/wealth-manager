"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  ExternalLink, 
  TrendingUp, 
  Wallet,
  Search
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssetWithValue, ASSET_TYPE_COLORS, ASSET_TYPE_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { AssetType } from "@prisma/client";

// TradingView widget intervals
const INTERVALS = [
  { value: "1", label: "1 minute" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "D", label: "Daily" },
  { value: "W", label: "Weekly" },
  { value: "M", label: "Monthly" },
];

// Supported exchanges for the widget
const EXCHANGES = [
  { value: "none", label: "Auto-detect" },
  { value: "NASDAQ", label: "NASDAQ" },
  { value: "NYSE", label: "NYSE" },
  { value: "EURONEXT", label: "Euronext" },
  { value: "XETRA", label: "XETRA" },
  { value: "LSE", label: "London Stock Exchange" },
  { value: "SWISS", label: "SIX Swiss" },
  { value: "BINANCE", label: "Binance" },
  { value: "COINBASE", label: "Coinbase" },
];

// Asset types that can be charted
const CHARTABLE_TYPES: AssetType[] = ["STOCK", "ETF", "CRYPTO", "COMMODITY"];

type Theme = "light" | "dark";

export default function TradingViewPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [inputSymbol, setInputSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("D");
  const [exchange, setExchange] = useState("none");
  const [theme, setTheme] = useState<Theme>("light");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  
  // Assets list
  const [assets, setAssets] = useState<AssetWithValue[]>([]);
  const [assetSearch, setAssetSearch] = useState("");

  // Load assets
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => setAssets([]));
  }, []);

  // Load TradingView widget
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing widget
    containerRef.current.innerHTML = "";
    setWidgetLoaded(false);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Format symbol with exchange prefix if provided
    const formattedSymbol = exchange && exchange !== "none" ? `${exchange}:${symbol}` : symbol;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: interval,
      timezone: "exchange",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    script.onload = () => setWidgetLoaded(true);
    containerRef.current.appendChild(script);
  }, [symbol, interval, exchange, theme]);

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    setSymbol(inputSymbol.toUpperCase());
  };

  const handleAssetClick = (asset: AssetWithValue) => {
    setSymbol(asset.symbol);
    setInputSymbol(asset.symbol);
  };

  const openInTradingView = () => {
    const formattedSymbol = exchange && exchange !== "none" ? `${exchange}:${symbol}` : symbol;
    window.open(`https://www.tradingview.com/chart/?symbol=${formattedSymbol}`, "_blank");
  };

  // Filter chartable assets
  const chartableAssets = assets.filter(
    (a) => CHARTABLE_TYPES.includes(a.type) && (a.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || a.name.toLowerCase().includes(assetSearch.toLowerCase()))
  );

  // Group assets by type
  const assetsByType = chartableAssets.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<AssetType, AssetWithValue[]>);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/app")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                TradingView Charts
              </h1>
              <p className="text-sm text-muted-foreground">
                Professional charting and technical analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={openInTradingView}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in TradingView
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Assets */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Your Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search assets..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="h-8 pl-7 text-sm"
                  />
                </div>

                {/* Asset List by Type */}
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {Object.entries(assetsByType).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No chartable assets found.
                      <br />
                      Add stocks, ETFs, or crypto to see them here.
                    </p>
                  ) : (
                    Object.entries(assetsByType).map(([type, typeAssets]) => (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: ASSET_TYPE_COLORS[type as AssetType] }}
                          />
                          <span className="text-xs font-medium text-muted-foreground">
                            {ASSET_TYPE_LABELS[type as AssetType]} ({typeAssets.length})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {typeAssets.map((asset) => (
                            <button
                              key={asset.id}
                              onClick={() => handleAssetClick(asset)}
                              className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                                symbol === asset.symbol
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{asset.symbol}</span>
                                <span className="opacity-70">
                                  {formatCurrency(asset.totalValueEUR, "EUR")}
                                </span>
                              </div>
                              <div className="truncate opacity-70">{asset.name}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Chart */}
          <div className="lg:col-span-3 space-y-4">
            {/* Symbol Input */}
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleLoad} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="symbol" className="text-sm font-medium mb-1.5 block">
                      Symbol
                    </Label>
                    <Input
                      id="symbol"
                      placeholder="AAPL, BTCUSD, EURUSD..."
                      value={inputSymbol}
                      onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
                      className="h-10"
                    />
                  </div>

                  <Button type="submit" className="h-10">
                    Load
                  </Button>

                  <div className="w-[140px]">
                    <Label htmlFor="interval" className="text-sm font-medium mb-1.5 block">
                      Interval
                    </Label>
                    <Select value={interval} onValueChange={setInterval}>
                      <SelectTrigger id="interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map((int) => (
                          <SelectItem key={int.value} value={int.value}>
                            {int.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-[180px]">
                    <Label htmlFor="exchange" className="text-sm font-medium mb-1.5 block">
                      Exchange (optional)
                    </Label>
                    <Select value={exchange} onValueChange={setExchange}>
                      <SelectTrigger id="exchange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXCHANGES.map((ex) => (
                          <SelectItem key={ex.value} value={ex.value}>
                            {ex.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </form>

                {/* Quick Symbols */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Quick:</span>
                  {["AAPL", "MSFT", "GOOGL", "TSLA", "BTCUSD", "ETHUSD", "EURUSD"].map((sym) => (
                    <Button
                      key={sym}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setSymbol(sym);
                        setInputSymbol(sym);
                      }}
                    >
                      {sym}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chart Container */}
            <Card className={isFullscreen ? "fixed inset-4 z-50" : ""}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-muted-foreground">Chart:</span>
                    <span className="font-mono">{exchange && exchange !== "none" ? `${exchange}:` : ""}{symbol}</span>
                    {assets.find(a => a.symbol === symbol) && (
                      <Badge variant="secondary" className="text-xs">
                        In Portfolio
                      </Badge>
                    )}
                  </CardTitle>
                  {isFullscreen && (
                    <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  id="tradingview_chart"
                  ref={containerRef}
                  className={`w-full ${isFullscreen ? "h-[calc(100vh-180px)]" : "h-[600px]"}`}
                />
                {!widgetLoaded && (
                  <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                    Loading TradingView widget...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
