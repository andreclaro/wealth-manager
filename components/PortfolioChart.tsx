"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PieChart as PieChartIcon, ExternalLink } from "lucide-react";
import { PortfolioSummary, ASSET_TYPE_COLORS, ASSET_TYPE_LABELS, AssetWithValue } from "@/types";
import { AssetType } from "@prisma/client";
import { useRouter } from "next/navigation";

interface PortfolioChartProps {
  summary: PortfolioSummary | null;
  assets: AssetWithValue[];
  currency: "USD" | "EUR";
}

interface ChartDataItem {
  name: string;
  fullName: string;
  value: number;
  color: string;
  count: number;
  type?: AssetType;
  assetId?: string;
}

export function PortfolioChart({ summary, assets, currency }: PortfolioChartProps) {
  const router = useRouter();
  const [drillDown, setDrillDown] = useState<{ type: AssetType; label: string } | null>(null);

  if (!summary) return null;

  const total = currency === "USD" ? summary.totalValueUSD : summary.totalValueEUR;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Build data based on current view
  let data: ChartDataItem[];
  
  if (drillDown) {
    // Show individual assets of the selected type
    const typeAssets = assets.filter(a => a.type === drillDown.type);
    data = typeAssets.map(asset => {
      const value = currency === "USD" ? asset.totalValueUSD : asset.totalValueEUR;
      // Generate a color based on asset symbol (consistent coloring)
      const hue = asset.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
      return {
        name: asset.symbol,
        fullName: asset.name,
        value,
        color: `hsl(${hue}, 70%, 50%)`,
        count: 1,
        type: asset.type,
        assetId: asset.id,
      };
    }).sort((a, b) => b.value - a.value);
  } else {
    // Show by type
    data = Object.entries(summary.assetsByType)
      .filter(([_, stats]) => stats.count > 0)
      .map(([type, stats]) => ({
        name: ASSET_TYPE_LABELS[type as AssetType],
        fullName: ASSET_TYPE_LABELS[type as AssetType],
        value: currency === "USD" ? stats.valueUSD : stats.valueEUR,
        color: ASSET_TYPE_COLORS[type as AssetType],
        count: stats.count,
        type: type as AssetType,
      }))
      .sort((a, b) => b.value - a.value);
  }

  const handleSliceClick = (entry: ChartDataItem) => {
    if (!drillDown && entry.type && entry.count > 1) {
      // Drill down into this type
      setDrillDown({ type: entry.type, label: entry.name });
    } else if (drillDown && entry.assetId) {
      // Single click on asset in drill-down - navigate to asset page
      router.push(`/app/assets/${entry.assetId}/edit`);
    }
  };

  const handleSliceDoubleClick = (entry: ChartDataItem) => {
    if (drillDown && entry.assetId) {
      // Open asset in new tab when double-clicked in drill-down view
      window.open(`/app/assets/${entry.assetId}/edit`, '_blank');
    }
  };

  const handleLegendClick = (entry: ChartDataItem) => {
    if (drillDown && entry.assetId) {
      router.push(`/app/assets/${entry.assetId}/edit`);
    }
  };

  const handleBack = () => {
    setDrillDown(null);
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ChartDataItem }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg max-w-[250px]">
          <p className="font-semibold" style={{ color: item.payload.color }}>
            {item.name}
          </p>
          {drillDown && (
            <p className="text-xs text-muted-foreground truncate">
              {item.payload.fullName}
            </p>
          )}
          <p className="text-lg font-bold">{formatCurrency(item.value)}</p>
          <p className="text-sm text-muted-foreground">
            {percentage}% of portfolio
          </p>
          {!drillDown ? (
            <p className="text-xs text-muted-foreground">
              {item.payload.count} asset{item.payload.count !== 1 ? "s" : ""}
              {item.payload.count > 1 && " (click to view)"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click to open • Double-click for new tab
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom legend renderer with click handler
  const CustomLegend = () => {
    return (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((entry, index) => (
          <li
            key={`legend-${index}`}
            className={`flex items-center gap-1.5 text-sm ${drillDown ? 'cursor-pointer hover:opacity-70' : ''}`}
            onClick={() => handleLegendClick(entry)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm">
              {entry.name}
              {!drillDown && entry.count > 1 && (
                <span className="text-muted-foreground text-xs ml-1">
                  ({entry.count})
                </span>
              )}
            </span>
            {drillDown && entry.assetId && (
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {drillDown && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            {drillDown ? `${drillDown.label} Assets` : "Portfolio Allocation"}
          </CardTitle>
        </div>
        {drillDown && (
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to Overview
          </Button>
        )}
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
                onClick={(_, index) => handleSliceClick(data[index])}
                onDoubleClick={(_, index) => handleSliceDoubleClick(data[index])}
                style={{ cursor: "pointer" }}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke={drillDown ? "#fff" : "none"}
                    strokeWidth={drillDown ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {!drillDown ? (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value: string, entry: any) => (
                    <span className="text-sm">
                      {value}
                      {entry?.payload?.count > 1 && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({entry.payload.count})
                        </span>
                      )}
                    </span>
                  )}
                />
              ) : null}
            </PieChart>
          </ResponsiveContainer>
          {drillDown && <CustomLegend />}
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {drillDown ? `Total ${drillDown.label} Value` : "Total Portfolio Value"}
          </p>
          <p className="text-2xl font-bold">{formatCurrency(drillDown 
            ? data.reduce((sum, item) => sum + item.value, 0)
            : total
          )}</p>
        </div>
        {!drillDown ? (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Click on a segment with multiple assets to view details
          </p>
        ) : (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Click slice/legend to open • Double-click for new tab
          </p>
        )}
      </CardContent>
    </Card>
  );
}
