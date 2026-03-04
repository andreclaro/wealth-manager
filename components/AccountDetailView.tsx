"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletAddressCard } from "./WalletAddressCard";
import { AddWalletAddressDialog } from "./AddWalletAddressDialog";
import { AccountWithTotals, WalletChainType } from "@/types";
import { RefreshCw, Wallet, TrendingUp, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface AccountDetailViewProps {
  account: AccountWithTotals;
  onUpdate: () => void;
}

export function AccountDetailView({ account, onUpdate }: AccountDetailViewProps) {
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showHiddenAssets, setShowHiddenAssets] = useState(false);

  const handleSyncWallet = useCallback(
    async (walletAddressId: string) => {
      setIsSyncing(walletAddressId);
      try {
        const response = await fetch(
          `/api/wallet-addresses/${walletAddressId}/sync`,
          { method: "POST" }
        );
        if (response.ok) {
          onUpdate();
        }
      } catch (error) {
        console.error("Error syncing wallet:", error);
      } finally {
        setIsSyncing(null);
      }
    },
    [onUpdate]
  );

  const handleSyncAll = useCallback(async () => {
    setIsSyncingAll(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}/sync-wallets`, {
        method: "POST",
      });
      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error syncing all wallets:", error);
    } finally {
      setIsSyncingAll(false);
    }
  }, [account.id, onUpdate]);

  const handleAddWalletAddress = useCallback(
    async (data: {
      chainType: WalletChainType;
      address: string;
      evmChainId?: number;
      isPChain?: boolean;
      label?: string;
      syncEnabled: boolean;
    }) => {
      const response = await fetch(`/api/accounts/${account.id}/wallet-addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add wallet address");
      }

      onUpdate();
    },
    [account.id, onUpdate]
  );

  const handleDeleteWalletAddress = useCallback(
    async (walletAddressId: string) => {
      const response = await fetch(`/api/wallet-addresses/${walletAddressId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onUpdate();
      }
    },
    [onUpdate]
  );

  const handleToggleAssetVisibility = useCallback(
    async (assetId: string, isVisible: boolean) => {
      // This would require an API endpoint to update asset visibility
      // For now, we'll just refresh
      onUpdate();
    },
    [onUpdate]
  );

  const isCryptoWallet = account.type === "Crypto Wallet";
  const walletAddresses = account.walletAddresses || [];
  const visibleAssets = account.assets.filter((a) => a.isVisible !== false);
  const hiddenAssets = account.assets.filter((a) => a.isVisible === false);

  // Calculate wallet totals
  const walletTotalValue = walletAddresses.reduce((total, wa) => {
    return (
      total +
      wa.balances.reduce((sum, b) => {
        if (b.asset?.isVisible !== false) {
          return sum + (b.valueUsd || 0);
        }
        return sum;
      }, 0)
    );
  }, 0);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-muted-foreground">
            {account.type || "No type"} • {account.currency}
          </p>
          {account.notes && (
            <p className="text-sm text-muted-foreground mt-1">{account.notes}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {formatCurrency(account.totalValueEUR, "EUR")}
          </p>
          <p className="text-muted-foreground">
            {formatCurrency(account.totalValueUSD, "USD")}
          </p>
        </div>
      </div>

      <Tabs defaultValue={isCryptoWallet ? "wallets" : "assets"} className="w-full">
        <TabsList>
          {isCryptoWallet && (
            <TabsTrigger value="wallets" className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Wallets ({walletAddresses.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="assets" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Assets ({visibleAssets.length})
          </TabsTrigger>
        </TabsList>

        {isCryptoWallet && (
          <TabsContent value="wallets" className="space-y-4">
            {/* Wallet Summary Card */}
            <Card className="wm-surface">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Wallet Summary</CardTitle>
                    <CardDescription>
                      {walletAddresses.length} address
                      {walletAddresses.length !== 1 ? "es" : ""} connected
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncAll}
                      disabled={isSyncingAll || walletAddresses.length === 0}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1 ${
                          isSyncingAll ? "animate-spin" : ""
                        }`}
                      />
                      Sync
                    </Button>
                    {walletAddresses.length === 0 && (
                      <AddWalletAddressDialog
                        accountId={account.id}
                        onAdd={handleAddWalletAddress}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              {walletTotalValue > 0 && (
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Wallet Value
                    </span>
                    <span className="text-xl font-semibold">
                      ${walletTotalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Wallet Address */}
            {walletAddresses.length > 0 ? (
              <div className="max-w-xl">
                <WalletAddressCard
                  walletAddress={walletAddresses[0]}
                  onSync={handleSyncWallet}
                  onDelete={handleDeleteWalletAddress}
                  isSyncing={isSyncing === walletAddresses[0].id}
                />
              </div>
            ) : (
              <Card className="wm-surface text-center py-12">
                <CardContent>
                  <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Wallet Addresses
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Add a wallet address to start tracking your crypto assets
                  </p>
                  <AddWalletAddressDialog
                    accountId={account.id}
                    onAdd={handleAddWalletAddress}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="assets" className="space-y-4">
          {/* Assets Summary */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Tracked Assets ({visibleAssets.length})
            </h3>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/assets?account=${account.id}`}>
                Manage Assets
              </Link>
            </Button>
          </div>

          {/* Visible Assets */}
          {visibleAssets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleAssets.map((asset) => (
                <Card key={asset.id} className="wm-surface">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{asset.symbol}</CardTitle>
                      <Badge variant="secondary">{asset.type}</Badge>
                    </div>
                    <CardDescription>{asset.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Quantity
                        </span>
                        <span className="font-medium">
                          {asset.quantity.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Value
                        </span>
                        <span className="font-medium">
                          {formatCurrency(asset.totalValueEUR, "EUR")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="wm-surface text-center py-8">
              <CardContent>
                <p className="text-muted-foreground">No tracked assets yet</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href={`/app/assets?account=${account.id}`}>
                    Add Assets
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Hidden Assets */}
          {hiddenAssets.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHiddenAssets(!showHiddenAssets)}
                className="text-muted-foreground"
              >
                {showHiddenAssets ? (
                  <EyeOff className="h-4 w-4 mr-1" />
                ) : (
                  <Eye className="h-4 w-4 mr-1" />
                )}
                {showHiddenAssets ? "Hide" : "Show"} {hiddenAssets.length} hidden
                assets
              </Button>

              {showHiddenAssets && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hiddenAssets.map((asset) => (
                    <Card
                      key={asset.id}
                      className="wm-surface opacity-60"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {asset.symbol}
                          </CardTitle>
                          <Badge variant="outline">Hidden</Badge>
                        </div>
                        <CardDescription>{asset.name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {asset.quantity.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}{" "}
                            {asset.symbol}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleToggleAssetVisibility(asset.id, true)
                            }
                          >
                            Restore
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
