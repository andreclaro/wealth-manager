"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wallet, 
  Search, 
  Loader2, 
  Coins, 
  DollarSign, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface Token {
  contractAddress?: string;
  mint?: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  type?: string;
  priceUsd?: number;
  valueUsd?: number;
  priceSource?: string;
  liquidity?: number;
  lowLiquidity?: boolean;
  spam?: boolean;
}

interface WalletData {
  address: string;
  chain: string;
  nativeBalance: {
    symbol: string;
    balance: number;
    decimals: number;
    priceUsd?: number;
    valueUsd?: number;
  };
  tokens: Token[];
  tokenCount: number;
  fetchedAt: string;
}

const EVM_CHAINS = [
  { value: "ethereum", label: "Ethereum", native: "ETH" },
  { value: "polygon", label: "Polygon", native: "MATIC" },
  { value: "base", label: "Base", native: "ETH" },
  { value: "arbitrum", label: "Arbitrum", native: "ETH" },
  { value: "optimism", label: "Optimism", native: "ETH" },
  { value: "bsc", label: "BSC", native: "BNB" },
];

const SAMPLE_WALLETS = {
  ethereum: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
};

export default function CryptoPlaygroundPage() {
  const [activeTab, setActiveTab] = useState("evm");
  const [evmAddress, setEvmAddress] = useState("");
  const [evmChain, setEvmChain] = useState("ethereum");
  const [solanaAddress, setSolanaAddress] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [prices, setPrices] = useState<Record<string, any>>({});

  const fetchEVMWallet = async () => {
    const address = evmAddress.trim();
    if (!address) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setWalletData(null);

    try {
      const response = await fetch(
        `/api/crypto/wallet/evm?address=${address}&chain=${evmChain}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch wallet");
      }

      const data = await response.json();
      setWalletData(data);
      
      // Fetch prices for tokens
      await fetchPrices(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSolanaWallet = async () => {
    const address = solanaAddress.trim();
    if (!address) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setWalletData(null);

    try {
      const response = await fetch(
        `/api/crypto/wallet/solana?address=${address}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch wallet");
      }

      const data = await response.json();
      setWalletData(data);
      
      // Fetch prices for tokens
      await fetchSolanaPrices(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrices = async (data: WalletData) => {
    try {
      // Use new batch price API that fetches by contract address
      const response = await fetch(`/api/crypto/prices/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: data.tokens,
          chain: data.chain,
        }),
      });

      if (response.ok) {
        const priceData = await response.json();
        const prices = priceData.prices || {};
        setPrices(prices);

        // Update wallet data with prices
        const updatedData = { ...data };

        // Try to get native token price
        const nativeSymbol = data.nativeBalance.symbol;
        const nativePrice =
          prices[nativeSymbol] ||
          Object.values(prices).find(
            (p: any) => p && (p.symbol === nativeSymbol || p.id === nativeSymbol)
          );

        if (nativePrice?.usd) {
          updatedData.nativeBalance.priceUsd = nativePrice.usd;
          updatedData.nativeBalance.valueUsd =
            data.nativeBalance.balance * nativePrice.usd;
        }

        updatedData.tokens = data.tokens.map((token) => {
          const priceInfo =
            prices[token.contractAddress || ""] ||
            prices[token.mint || ""] ||
            prices[token.symbol?.toUpperCase() || ""];

          if (priceInfo?.usd) {
            return {
              ...token,
              priceUsd: priceInfo.usd,
              valueUsd: token.balance * priceInfo.usd,
              priceSource: priceInfo.source,
              liquidity: priceInfo.liquidity,
            };
          }
          return token;
        });

        setWalletData(updatedData);
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    }
  };

  const fetchSolanaPrices = async (data: WalletData) => {
    try {
      // Use batch price API with Solana chain
      const tokensWithNative = [
        { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", balance: data.nativeBalance.balance },
        ...data.tokens,
      ];

      const response = await fetch(`/api/crypto/prices/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: tokensWithNative,
          chain: "solana",
        }),
      });

      if (response.ok) {
        const priceData = await response.json();
        const prices = priceData.prices || {};

        // Update wallet data with prices
        const updatedData = { ...data };

        // Native SOL price
        const solPriceInfo = prices["So11111111111111111111111111111111111111112"];
        if (solPriceInfo?.usd) {
          updatedData.nativeBalance.priceUsd = solPriceInfo.usd;
          updatedData.nativeBalance.valueUsd = data.nativeBalance.balance * solPriceInfo.usd;
        }

        updatedData.tokens = data.tokens.map((token) => {
          const priceInfo = prices[token.mint || ""];
          if (priceInfo?.usd) {
            return {
              ...token,
              priceUsd: priceInfo.usd,
              valueUsd: token.balance * priceInfo.usd,
              priceSource: priceInfo.source,
              liquidity: priceInfo.liquidity,
            };
          }
          return token;
        });

        setWalletData(updatedData);
      }
    } catch (err) {
      console.error("Failed to fetch Solana prices:", err);
    }
  };

  const formatNumber = (num: number | undefined, decimals: number = 4) => {
    if (num === undefined || isNaN(num)) return "-";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const formatCurrency = (num: number | undefined) => {
    if (num === undefined || isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getTotalValue = () => {
    if (!walletData) return 0;
    let total = walletData.nativeBalance.valueUsd || 0;
    total += walletData.tokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);
    return total;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          Crypto Wallet Playground
        </h1>
        <p className="text-muted-foreground mt-2">
          Test wallet discovery and token fetching using free APIs. No API keys required!
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="evm">EVM Chains</TabsTrigger>
          <TabsTrigger value="solana">Solana</TabsTrigger>
        </TabsList>

        {/* EVM Tab */}
        <TabsContent value="evm" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Fetch EVM Wallet
              </CardTitle>
              <CardDescription>
                Uses Blockscout API (free, no API key) to discover all tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <Label htmlFor="evm-chain">Chain</Label>
                  <Select value={evmChain} onValueChange={setEvmChain}>
                    <SelectTrigger id="evm-chain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVM_CHAINS.map((chain) => (
                        <SelectItem key={chain.value} value={chain.value}>
                          {chain.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label htmlFor="evm-address">Wallet Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="evm-address"
                      placeholder="0x..."
                      value={evmAddress}
                      onChange={(e) => setEvmAddress(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchEVMWallet()}
                    />
                    <Button 
                      onClick={fetchEVMWallet} 
                      disabled={loading}
                      className="shrink-0"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEvmAddress(SAMPLE_WALLETS.ethereum)}
                >
                  Load Sample Address
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEvmAddress("");
                    setWalletData(null);
                    setError(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Solana Tab */}
        <TabsContent value="solana" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Fetch Solana Wallet
              </CardTitle>
              <CardDescription>
                Uses Solana Public RPC (free, no API key) to discover all SPL tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="solana-address">Wallet Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="solana-address"
                    placeholder="Enter Solana address..."
                    value={solanaAddress}
                    onChange={(e) => setSolanaAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchSolanaWallet()}
                  />
                  <Button 
                    onClick={fetchSolanaWallet} 
                    disabled={loading}
                    className="shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSolanaAddress(SAMPLE_WALLETS.solana)}
                >
                  Load Sample Address
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSolanaAddress("");
                    setWalletData(null);
                    setError(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="mt-6">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {walletData && !loading && (
        <div className="space-y-6 mt-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Wallet Overview
                </span>
                <Badge variant="outline">{walletData.chain}</Badge>
              </CardTitle>
              <CardDescription className="font-mono text-xs break-all">
                {walletData.address}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Coins className="h-4 w-4" />
                    Native Balance
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatNumber(walletData.nativeBalance.balance, 6)} {walletData.nativeBalance.symbol}
                  </div>
                  {walletData.nativeBalance.valueUsd !== undefined && (
                    <div className="text-sm text-green-600">
                      {formatCurrency(walletData.nativeBalance.valueUsd)}
                    </div>
                  )}
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Total Tokens
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {walletData.tokenCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    SPL / ERC-20 tokens
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Total Value
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatCurrency(getTotalValue())}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on available prices
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tokens Table */}
          <Card>
            <CardHeader>
              <CardTitle>Token Holdings</CardTitle>
              <CardDescription>
                Discovered {walletData.tokens.length} tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              {walletData.tokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tokens found (other than native balance)
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Token</th>
                        <th className="text-left py-3 px-2">Balance</th>
                        <th className="text-left py-3 px-2">Price (USD)</th>
                        <th className="text-left py-3 px-2">Value (USD)</th>
                        <th className="text-left py-3 px-2 hidden md:table-cell">Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletData.tokens.map((token, idx) => (
                        <tr key={idx} className={`border-b last:border-0 hover:bg-muted/50 ${token.spam ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{token.symbol || "???"}</span>
                              {token.spam && (
                                <Badge variant="destructive" className="text-[10px]">SPAM</Badge>
                              )}
                              {token.lowLiquidity && (
                                <Badge variant="outline" className="text-[10px] text-yellow-600">Low Liquidity</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{token.name || "Unknown"}</div>
                            {token.priceSource && (
                              <div className="text-[10px] text-muted-foreground">
                                via {token.priceSource}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {formatNumber(token.balance, token.decimals > 6 ? 4 : token.decimals)}
                          </td>
                          <td className="py-3 px-2">
                            {token.priceUsd ? (
                              <div>
                                {formatCurrency(token.priceUsd)}
                                {token.liquidity && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Liq: {formatCurrency(token.liquidity)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {token.valueUsd ? (
                              <span className="text-green-600 font-medium">
                                {formatCurrency(token.valueUsd)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 hidden md:table-cell">
                            <a
                              href={
                                activeTab === "solana"
                                  ? `https://solscan.io/token/${token.mint}`
                                  : `https://${walletData.chain}.blockscout.com/token/${token.contractAddress}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                            >
                              {(token.mint || token.contractAddress || "").slice(0, 8)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Data (collapsible) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Raw API Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
                {JSON.stringify(walletData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">EVM Chains API</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Source:</strong> Blockscout API</p>
            <p><strong>Cost:</strong> 100% Free, no API key</p>
            <p><strong>Rate Limit:</strong> ~10 requests/second</p>
            <p><strong>Features:</strong> Native balance, all ERC-20 tokens, token metadata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Solana API</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Source:</strong> Solana Public RPC</p>
            <p><strong>Cost:</strong> 100% Free, no API key</p>
            <p><strong>Rate Limit:</strong> 100 requests/10 seconds per IP</p>
            <p><strong>Features:</strong> SOL balance, all SPL tokens (by mint address)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
