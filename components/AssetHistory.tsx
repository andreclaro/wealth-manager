"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceHistory } from "@prisma/client";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, History } from "lucide-react";

interface AssetHistoryProps {
  priceHistory: PriceHistory[];
  currency: string;
  symbol: string;
}

export function AssetHistory({ priceHistory, currency, symbol }: AssetHistoryProps) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No price history available yet. Update the asset to record history.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by date ascending for the chart
  const sortedHistory = [...priceHistory].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  // Format data for chart
  const chartData = sortedHistory.map((record) => ({
    date: record.recordedAt,
    price: record.price,
    value: record.totalValue,
    quantity: record.quantity,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    try {
      return format(new Date(date), "MMM d, yyyy HH:mm");
    } catch {
      return String(date);
    }
  };

  const formatShortDate = (date: Date | string) => {
    try {
      return format(new Date(date), "MMM d");
    } catch {
      return String(date);
    }
  };

  // Calculate trend
  const firstRecord = sortedHistory[0];
  const lastRecord = sortedHistory[sortedHistory.length - 1];
  const priceTrend = lastRecord.price - firstRecord.price;
  const priceTrendPercent = firstRecord.price > 0 
    ? (priceTrend / firstRecord.price) * 100 
    : 0;

  const CustomTooltip = ({ 
    active, 
    payload, 
    label 
  }: { 
    active?: boolean; 
    payload?: Array<{ dataKey: string; value: number; color: string; name: string }>; 
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {formatDate(label || "")}
          </p>
          {payload.map((entry) => (
            <p
              key={entry.dataKey}
              className="text-sm font-medium"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Price History
            </CardTitle>
            {sortedHistory.length > 1 && (
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  priceTrend >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {priceTrend >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {priceTrend >= 0 ? "+" : ""}
                {priceTrendPercent.toFixed(2)}%
                <span className="text-muted-foreground font-normal ml-1">
                  ({sortedHistory.length} records)
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
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
                  dataKey="price"
                  name={`Price (${currency})`}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={`Total Value (${currency})`}
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...priceHistory]
                  .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                  .map((record, index) => {
                    const prevRecord = priceHistory[index + 1];
                    const priceChange = prevRecord 
                      ? record.price - prevRecord.price 
                      : 0;
                    const priceChangePercent = prevRecord && prevRecord.price > 0
                      ? (priceChange / prevRecord.price) * 100
                      : 0;

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="text-sm">
                          {formatDate(record.recordedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(record.price)}</span>
                            {prevRecord && (
                              <span
                                className={`text-xs ${
                                  priceChange >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {priceChange >= 0 ? "+" : ""}
                                {priceChangePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.totalValue)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
