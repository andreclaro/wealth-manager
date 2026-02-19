"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Wallet, 
  Search, 
  Loader2, 
  Coins, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface Token {
  contractAddress?: string;
  mint?: string;
  chain?: string;
  explorerUrl?: string;
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

interface NativeBalance {
  chain?: string;
  symbol: string;
  balance: number;
  decimals: number;
  priceUsd?: number;
  valueUsd?: number;
  explorerUrl?: string;
}

interface ChainResult {
  chain: string;
  source: string;
  status: "ok" | "error";
  tokenCount: number;
  nativeBalance?: number;
  nativeSymbol?: string;
  error?: string;
}

interface WalletData {
  address: string;
  chain: string;
  nativeBalance: NativeBalance;
  nativeBalances?: NativeBalance[];
  tokens: Token[];
  tokenCount: number;
  chainsSearched?: string[];
  chainResults?: ChainResult[];
  fetchedAt: string;
}

const getTokenUsdValue = (token: Token) =>
  token.valueUsd ??
  (typeof token.priceUsd === "number"
    ? token.balance * token.priceUsd
    : 0);

const sortTokensByUsdValue = (tokens: Token[]) =>
  [...tokens].sort((a, b) => {
    const valueDiff = getTokenUsdValue(b) - getTokenUsdValue(a);
    if (valueDiff !== 0) {
      return valueDiff;
    }

    return b.balance - a.balance;
  });

const parseErrorResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();
      if (json?.error) {
        return String(json.error);
      }
    } catch {
      // Ignore JSON parse failures and fallback to text.
    }
  }

  try {
    const text = await response.text();
    if (text.includes("<!DOCTYPE")) {
      return `Request failed with status ${response.status}. The server returned an HTML error page.`;
    }

    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const SAMPLE_WALLETS = {
  ethereum: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
};

export default function CryptoPlaygroundPage() {
  const [activeTab, setActiveTab] = useState("evm");
  const [evmAddress, setEvmAddress] = useState("");
  const [solanaAddress, setSolanaAddress] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [chainFilter, setChainFilter] = useState("all");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);

  const resetTokenFilters = () => {
    setTokenSearch("");
    setChainFilter("all");
  };

  const availableChains = useMemo(() => {
    if (!walletData) return [];

    return [...new Set(
      walletData.tokens.map((token) => token.chain || walletData.chain || "unknown")
    )].sort((a, b) => a.localeCompare(b));
  }, [walletData]);

  const filteredTokens = useMemo(() => {
    if (!walletData) return [];

    const query = tokenSearch.trim().toLowerCase();

    return walletData.tokens.filter((token) => {
      const tokenChain = token.chain || walletData.chain || "unknown";
      const matchesChain = chainFilter === "all" || tokenChain === chainFilter;

      if (!matchesChain) {
        return false;
      }

      if (!query) {
        return true;
      }

      const tokenSymbol = token.symbol?.toLowerCase() || "";
      const tokenName = token.name?.toLowerCase() || "";

      return tokenSymbol.includes(query) || tokenName.includes(query);
    });
  }, [walletData, tokenSearch, chainFilter]);

  const fetchEVMWallet = async () => {
    const address = evmAddress.trim();
    if (!address) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setWalletData(null);
    resetTokenFilters();

    try {
      const response = await fetch(`/api/crypto/wallet/evm?address=${address}`);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || "Failed to fetch wallet");
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
    resetTokenFilters();

    try {
      const response = await fetch(
        `/api/crypto/wallet/solana?address=${address}`
      );
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || "Failed to fetch wallet");
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
      const nativeEntries =
        data.nativeBalances && data.nativeBalances.length > 0
          ? data.nativeBalances
          : [data.nativeBalance];

      const nativeTokensForPricing = nativeEntries.map((native) => ({
        symbol: native.symbol,
        balance: native.balance,
        chain: native.chain,
      }));

      const response = await fetch(`/api/crypto/prices/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: [...data.tokens, ...nativeTokensForPricing],
          chain: data.chain,
        }),
      });

      if (response.ok) {
        const priceData = await response.json();
        const priceMap = priceData.prices || {};

        // Update wallet data with prices
        const updatedData: WalletData = { ...data };

        updatedData.tokens = sortTokensByUsdValue(data.tokens.map((token) => {
          const priceInfo =
            priceMap[token.contractAddress || ""] ||
            priceMap[token.mint || ""] ||
            priceMap[token.symbol?.toUpperCase() || ""];

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
        }));

        updatedData.nativeBalances = nativeEntries.map((native) => {
          const symbolKey = native.symbol?.toUpperCase() || "";
          const priceInfo = priceMap[symbolKey];

          if (priceInfo?.usd) {
            return {
              ...native,
              priceUsd: priceInfo.usd,
              valueUsd: native.balance * priceInfo.usd,
            };
          }

          return native;
        });

        const primaryNative =
          updatedData.nativeBalances.find(
            (native) =>
              native.chain &&
              native.chain === data.nativeBalance.chain
          ) || updatedData.nativeBalances[0];

        if (primaryNative) {
          updatedData.nativeBalance = primaryNative;
        }

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

        updatedData.tokens = sortTokensByUsdValue(data.tokens.map((token) => {
          const priceInfo =
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
        }));

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
    const nativeTotal =
      walletData.nativeBalances && walletData.nativeBalances.length > 0
        ? walletData.nativeBalances.reduce((sum, native) => sum + (native.valueUsd || 0), 0)
        : walletData.nativeBalance.valueUsd || 0;

    let total = nativeTotal;
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
                Automatically scans Ethereum, Optimism, Base, Arbitrum, Polygon, Avalanche (C/Fuji/Beam/DFK/Dexalot/Shrapnel), Hyperliquid (HyperEVM + Mainnet), and Tron
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
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
                    resetTokenFilters();
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
                    resetTokenFilters();
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
                    Native Assets
                  </div>
                  {walletData.nativeBalances && walletData.nativeBalances.length > 1 ? (
                    <>
                      <div className="text-2xl font-bold mt-1">
                        {walletData.nativeBalances.length} chains
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {walletData.nativeBalances
                          .slice(0, 3)
                          .map(
                            (native) =>
                              `${native.symbol} (${native.chain || "unknown"})`
                          )
                          .join(" • ")}
                      </div>
                      <div className="text-sm text-green-600">
                        {formatCurrency(
                          walletData.nativeBalances.reduce(
                            (sum, native) => sum + (native.valueUsd || 0),
                            0
                          )
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold mt-1">
                        {formatNumber(walletData.nativeBalance.balance, 6)}{" "}
                        {walletData.nativeBalance.symbol}
                      </div>
                      {walletData.nativeBalance.chain && (
                        <div className="text-xs text-muted-foreground">
                          Chain: {walletData.nativeBalance.chain}
                        </div>
                      )}
                    </>
                  )}
                  {walletData.nativeBalance.valueUsd !== undefined &&
                    (!walletData.nativeBalances ||
                      walletData.nativeBalances.length <= 1) && (
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
                    SPL / ERC-20 / TRC tokens
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
              {walletData.chainResults && walletData.chainResults.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {walletData.chainResults.map((result) => (
                    <Badge
                      key={result.chain}
                      variant={result.status === "ok" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {result.chain}: {result.status === "ok" ? `${result.tokenCount} tokens` : "error"}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tokens Table */}
          <Card>
            <CardHeader>
              <CardTitle>Token Holdings</CardTitle>
              <CardDescription>
                Showing {filteredTokens.length} of {walletData.tokens.length} tokens
                {walletData.chainsSearched?.length
                  ? ` across ${walletData.chainsSearched.length} chains`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={tokenSearch}
                    onChange={(event) => setTokenSearch(event.target.value)}
                    placeholder="Filter by token name or symbol..."
                    className="pl-9"
                  />
                </div>
                <Select value={chainFilter} onValueChange={setChainFilter}>
                  <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue placeholder="All chains" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All chains</SelectItem>
                    {availableChains.map((chain) => (
                      <SelectItem key={chain} value={chain}>
                        {chain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {walletData.tokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tokens found (other than native balance)
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tokens match your current filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Token</th>
                        <th className="text-left py-3 px-2 hidden md:table-cell">Chain</th>
                        <th className="text-left py-3 px-2">Balance</th>
                        <th className="text-left py-3 px-2">Price (USD)</th>
                        <th className="text-left py-3 px-2">Value (USD)</th>
                        <th className="text-left py-3 px-2 hidden md:table-cell">Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((token, idx) => (
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
                          <td className="py-3 px-2 hidden md:table-cell">
                            <span className="capitalize text-muted-foreground">
                              {token.chain || walletData.chain}
                            </span>
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
                            {(() => {
                              const fallbackUrl =
                                token.mint
                                  ? `https://solscan.io/token/${token.mint}`
                                  : token.contractAddress
                                    ? `https://${
                                        token.chain || walletData.chain
                                      }.blockscout.com/token/${token.contractAddress}`
                                    : undefined;
                              const url = token.explorerUrl || fallbackUrl;

                              if (!url) {
                                return <span className="text-muted-foreground">-</span>;
                              }

                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                                >
                                  {(token.mint || token.contractAddress || token.symbol || "")
                                    .slice(0, 8)}
                                  ...
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              );
                            })()}
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
            <p><strong>Sources:</strong> Blockscout + TronScan</p>
            <p><strong>Cost:</strong> 100% Free, no API key</p>
            <p><strong>Rate Limit:</strong> Chain-dependent public API limits</p>
            <p><strong>Features:</strong> Auto-scan across Ethereum, Optimism, Base, Arbitrum, Hyperliquid, Tron, Polygon</p>
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
