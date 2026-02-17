"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioSummary, ASSET_TYPE_COLORS, ASSET_TYPE_LABELS } from "@/types";
import { AssetType } from "@prisma/client";

interface PortfolioChartProps {
  summary: PortfolioSummary | null;
  currency: "USD" | "EUR";
}

export function PortfolioChart({ summary, currency }: PortfolioChartProps) {
  if (!summary) return null;

  const data = Object.entries(summary.assetsByType)
    .filter(([_, stats]) => stats.count > 0)
    .map(([type, stats]) => ({
      name: ASSET_TYPE_LABELS[type as AssetType],
      value: currency === "USD" ? stats.valueUSD : stats.valueEUR,
      color: ASSET_TYPE_COLORS[type as AssetType],
      count: stats.count,
    }))
    .sort((a, b) => b.value - a.value);

  const total = currency === "USD" ? summary.totalValueUSD : summary.totalValueEUR;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { count: number; color: string } }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold" style={{ color: item.payload.color }}>
            {item.name}
          </p>
          <p className="text-lg font-bold">{formatCurrency(item.value)}</p>
          <p className="text-sm text-muted-foreground">
            {percentage}% of portfolio
          </p>
          <p className="text-xs text-muted-foreground">
            {item.payload.count} asset{item.payload.count !== 1 ? "s" : ""}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value: string) => (
                  <span className="text-sm">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
