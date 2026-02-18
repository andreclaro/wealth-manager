"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssetWithValue, ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  MoreHorizontal,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Edit,
  Building2,
  ExternalLink,
} from "lucide-react";

interface AssetCardProps {
  asset: AssetWithValue;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isRefreshing?: boolean;
}

export function AssetCard({
  asset,
  onRefresh,
  onEdit,
  onDelete,
  isRefreshing = false,
}: AssetCardProps) {
  const editUrl = `/app/assets/${asset.id}/edit`;


  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(value);
  };

  // Calculate gain/loss if purchase price is available
  const purchasePrice = asset.purchasePrice;
  const hasPurchasePrice = purchasePrice && purchasePrice > 0;
  const currentValue = asset.totalValue;
  const purchaseValue = hasPurchasePrice
    ? purchasePrice * asset.quantity
    : 0;
  const gainLoss = hasPurchasePrice ? currentValue - purchaseValue : 0;
  const gainLossPercent =
    hasPurchasePrice && purchaseValue > 0 ? (gainLoss / purchaseValue) * 100 : 0;
  const isProfitable = gainLoss >= 0;

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link 
              href={editUrl}
              className="block hover:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold truncate">
                  {asset.symbol}
                </CardTitle>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: `${ASSET_TYPE_COLORS[asset.type]}20`,
                    color: ASSET_TYPE_COLORS[asset.type],
                    borderColor: ASSET_TYPE_COLORS[asset.type],
                  }}
                  className="border"
                >
                  {ASSET_TYPE_LABELS[asset.type]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {asset.name}
              </p>
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={editUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onRefresh}
                disabled={isRefreshing || asset.isManualPrice}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh Price
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main Value */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-bold">
                {formatCurrency(asset.totalValueEUR, "EUR")}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(asset.totalValueUSD, "USD")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm">
                {formatNumber(asset.quantity)} {asset.currency}
              </p>
              <p className="text-sm text-muted-foreground">
                @ {formatCurrency(asset.currentPrice || 0, asset.currency)}
              </p>
            </div>
          </div>

          {/* Gain/Loss */}
          {hasPurchasePrice && (
            <div
              className={`flex items-center gap-1 text-sm ${
                isProfitable ? "text-green-600" : "text-red-600"
              }`}
            >
              {isProfitable ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="font-medium">
                {isProfitable ? "+" : ""}
                {formatCurrency(gainLoss, asset.currency)}
              </span>
              <span>({isProfitable ? "+" : ""}
                {gainLossPercent.toFixed(2)}%)</span>
            </div>
          )}

          {/* Account info */}
          {asset.account && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{asset.account.name}</span>
              {asset.account.type && (
                <span className="text-xs">({asset.account.type})</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{asset.currency}</Badge>
              {asset.isManualPrice && (
                <Badge variant="outline" className="text-amber-600">
                  Manual
                </Badge>
              )}
            </div>
            {asset.priceUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Updated {format(new Date(asset.priceUpdatedAt), "MMM d, HH:mm")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
