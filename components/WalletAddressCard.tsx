"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { WalletAddressWithBalances } from "@/types";
import {
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WalletAddressCardProps {
  walletAddress: WalletAddressWithBalances;
  onSync: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSyncing: boolean;
}

export function WalletAddressCard({
  walletAddress,
  onSync,
  onDelete,
  isSyncing,
}: WalletAddressCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this wallet address?")) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(walletAddress.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getChainLabel = () => {
    if (walletAddress.isPChain) return "Avalanche P-Chain";
    if (walletAddress.chainType === "EVM") {
      const chainNames: Record<number, string> = {
        1: "Ethereum",
        137: "Polygon",
        42161: "Arbitrum",
        8453: "Base",
        43114: "Avalanche C-Chain",
        10: "Optimism",
      };
      return chainNames[walletAddress.evmChainId || 1] || "EVM";
    }
    return walletAddress.chainType;
  };

  const getChainIcon = () => {
    if (walletAddress.chainType === "SOLANA") {
      return "◎";
    }
    if (walletAddress.isPChain) {
      return "🔺";
    }
    return "⬡";
  };

  const visibleBalances = walletAddress.balances.filter(
    (b) => !b.asset || (b.asset.isVisible !== false && !b.asset.isSpam)
  );

  const totalValue = visibleBalances.reduce(
    (sum, b) => sum + (b.valueUsd || 0),
    0
  );

  return (
    <Card className="wm-surface">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getChainIcon()}</span>
            <div>
              <CardTitle className="text-sm font-medium">
                {walletAddress.label || getChainLabel()}
              </CardTitle>
              <CardDescription className="text-xs font-mono">
                {formatAddress(walletAddress.address)}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSync(walletAddress.id)}
              disabled={isSyncing || !walletAddress.syncEnabled}
              title="Sync wallet"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
            </Button>
            {walletAddress.explorerUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                asChild
                title="View on explorer"
              >
                <a
                  href={walletAddress.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-[10px]">
            {getChainLabel()}
          </Badge>
          {walletAddress.syncEnabled ? (
            <Badge variant="outline" className="text-[10px]">
              Auto-sync
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Sync paused
            </Badge>
          )}
          {walletAddress.lastSyncedAt && (
            <span className="text-[10px] text-muted-foreground">
              Synced {formatDistanceToNow(new Date(walletAddress.lastSyncedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-2">
          To change address, remove this one first
        </p>
        {visibleBalances.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-muted-foreground pb-1 border-b">
              <span>Token</span>
              <span>Value</span>
            </div>
            {visibleBalances.slice(0, 5).map((balance) => (
              <div
                key={balance.id}
                className="flex justify-between items-center text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{balance.symbol}</span>
                  <span className="text-xs text-muted-foreground">
                    {balance.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                  {balance.assetId && (
                    <LinkIcon className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <span className="text-muted-foreground">
                  {balance.valueUsd && balance.valueUsd > 0
                    ? `$${balance.valueUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "—"}
                </span>
              </div>
            ))}
            {visibleBalances.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{visibleBalances.length - 5} more tokens
              </p>
            )}
            {totalValue > 0 && (
              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="text-xs font-medium">Total</span>
                <span className="font-semibold">
                  ${totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No balances found</p>
            {walletAddress.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground mt-1">
                Last synced {formatDistanceToNow(new Date(walletAddress.lastSyncedAt), { addSuffix: true })}
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onSync(walletAddress.id)}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                Sync now
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
