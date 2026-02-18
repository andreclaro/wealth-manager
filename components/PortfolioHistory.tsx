"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceHistoryPoint } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { TrendingUp, PieChart, Table2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PortfolioHistoryProps {
  data: PriceHistoryPoint[];
  days: number;
  onDaysChange: (days: number) => void;
}

const TIME_PERIODS = [
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
  { value: 90, label: "3 Months" },
  { value: 365, label: "1 Year" },
  { value: 0, label: "All Time" },
];

// Generate colors for asset lines
const ASSET_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

export function PortfolioHistory({ data, days, onDaysChange }: PortfolioHistoryProps) {
  const [viewMode, setViewMode] = useState<"total" | "assets" | "table">("total");

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No historical data available yet. Add assets and refresh prices to see trends.
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  // Calculate trend
  const firstValue = data[0]?.valueEUR || 0;
  const lastValue = data[data.length - 1]?.valueEUR || 0;
  const trend = lastValue - firstValue;
  const trendPercent = firstValue > 0 ? (trend / firstValue) * 100 : 0;

  // Get all unique asset symbols for the breakdown view
  const assetSymbols = useMemo(() => {
    const symbols = new Set<string>();
    data.forEach((day) => {
      day.assets?.forEach((asset) => symbols.add(asset.symbol));
    });
    return Array.from(symbols);
  }, [data]);

  // Prepare data for asset breakdown chart
  const assetChartData = useMemo(() => {
    if (viewMode !== "assets") return [];
    
    return data.map((day) => {
      const dayData: Record<string, number | string> = {
        date: day.date,
      };
      
      // Add each asset's value
      assetSymbols.forEach((symbol, index) => {
        const asset = day.assets?.find((a) => a.symbol === symbol);
        dayData[symbol] = asset?.valueEUR || 0;
      });
      
      return dayData;
    });
  }, [data, assetSymbols, viewMode]);

  const CustomTooltip = ({ 
    active, 
    payload, 
    label,
    isAssetView = false,
  }: { 
    active?: boolean; 
    payload?: Array<{ dataKey: string; value: number; color: string; name: string }>; 
    label?: string;
    isAssetView?: boolean;
  }) => {
    if (active && payload && payload.length) {
      // Sort payload by value (descending) for asset view
      const sortedPayload = isAssetView 
        ? [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))
        : payload;
      
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="text-sm text-muted-foreground mb-2">
            {formatDate(label || "")}
          </p>
          {sortedPayload.map((entry) => (
            <p
              key={entry.dataKey}
              className="text-sm font-medium"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatCurrency(entry.value, isAssetView ? "EUR" : entry.dataKey === "valueUSD" ? "USD" : "EUR")}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <CardTitle>Portfolio History</CardTitle>
            
            {/* Time Period Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {TIME_PERIODS.find((p) => p.value === days)?.label || "30 Days"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {TIME_PERIODS.map((period) => (
                  <DropdownMenuItem
                    key={period.value}
                    onClick={() => onDaysChange(period.value)}
                  >
                    {period.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "total" | "assets" | "table")}>
              <TabsList>
                <TabsTrigger value="total" className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Total
                </TabsTrigger>
                <TabsTrigger value="assets" className="flex items-center gap-1">
                  <PieChart className="h-3.5 w-3.5" />
                  Assets
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-1">
                  <Table2 className="h-3.5 w-3.5" />
                  Table
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {data.length > 1 && viewMode === "total" && (
            <div
              className={`text-sm font-medium ${
                trend >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend >= 0 ? "+" : ""}
              {trendPercent.toFixed(2)}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={viewMode === "table" ? "" : "h-[300px]"}>
          {viewMode === "total" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("en-US", {
                      notation: "compact",
                      compactDisplay: "short",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="valueUSD"
                  name="USD"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="valueEUR"
                  name="EUR"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : viewMode === "assets" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={assetChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("en-US", {
                      notation: "compact",
                      compactDisplay: "short",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip content={<CustomTooltip isAssetView />} />
                <Legend />
                {assetSymbols.map((symbol, index) => (
                  <Area
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    name={symbol}
                    stroke={ASSET_COLORS[index % ASSET_COLORS.length]}
                    fill={ASSET_COLORS[index % ASSET_COLORS.length]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            // Table View
            <div className="border rounded-md max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
                    <TableHead className="text-right">Total (EUR)</TableHead>
                    {assetSymbols.slice(0, 5).map((symbol) => (
                      <TableHead key={symbol} className="text-right">
                        {symbol}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data].reverse().map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {format(parseISO(day.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(day.valueUSD, "USD")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(day.valueEUR, "EUR")}
                      </TableCell>
                      {assetSymbols.slice(0, 5).map((symbol) => {
                        const asset = day.assets?.find((a) => a.symbol === symbol);
                        return (
                          <TableCell key={symbol} className="text-right text-muted-foreground">
                            {asset ? formatCurrency(asset.valueEUR, "EUR") : "-"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        {viewMode === "assets" && assetSymbols.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No individual asset history available. Asset breakdown will appear after price updates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
