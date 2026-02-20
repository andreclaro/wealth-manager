import { createHash } from "crypto";
import {
  HttpTransport,
  InfoClient,
} from "@nktkas/hyperliquid";
import { NextRequest, NextResponse } from "next/server";

const ROUTESCAN_EVM_API_BASE = "https://api.routescan.io/v2/network";
const AVALANCHE_C_CHAIN = "avalanche-c" as const;
const AVALANCHE_P_CHAIN = "avalanche-p" as const;
const ROUTESCAN_AVALANCHE_C_CHAIN_ID = 43114;
const AVALANCHE_PLATFORM_RPC_ENDPOINTS = [
  "https://api.avax.network/ext/bc/P",
  "https://api.avax.network/ext/P",
] as const;
const AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS = [350, 900];
const AVALANCHE_GLACIER_API_BASE = "https://glacier-api.avax.network/v1";
const AVALANCHE_C_CHAIN_RPC = "https://api.avax.network/ext/bc/C/rpc";
const AVALANCHE_P_CHAIN_DECIMALS = 9;

const BLOCKSCOUT_ENDPOINTS = {
  ethereum: ["https://eth.blockscout.com"],
  optimism: ["https://optimism.blockscout.com"],
  base: ["https://base.blockscout.com"],
  arbitrum: ["https://arbitrum.blockscout.com"],
  polygon: ["https://polygon.blockscout.com"],
  [AVALANCHE_C_CHAIN]: [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/43114/etherscan/api`,
  ],
  hyperliquid: [
    "https://www.hyperscan.com",
    "https://hyperscan.com",
    "https://hyperliquid.cloud.blockscout.com",
  ],
} as const;

const AUTO_SCAN_CHAINS = [
  "ethereum",
  "optimism",
  "base",
  "arbitrum",
  "hyperliquid",
  "hyperliquid-mainnet",
  "tron",
  "polygon",
  AVALANCHE_C_CHAIN,
  AVALANCHE_P_CHAIN,
] as const;

type SupportedChain = (typeof AUTO_SCAN_CHAINS)[number];
type EvmChain = keyof typeof BLOCKSCOUT_ENDPOINTS;

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  optimism: "ETH",
  base: "ETH",
  arbitrum: "ETH",
  [AVALANCHE_C_CHAIN]: "AVAX",
  [AVALANCHE_P_CHAIN]: "AVAX",
  hyperliquid: "HYPE",
  "hyperliquid-mainnet": "USDC",
  tron: "TRX",
  polygon: "MATIC",
};

const NATIVE_DECIMALS: Record<SupportedChain, number> = {
  ethereum: 18,
  optimism: 18,
  base: 18,
  arbitrum: 18,
  [AVALANCHE_C_CHAIN]: 18,
  [AVALANCHE_P_CHAIN]: AVALANCHE_P_CHAIN_DECIMALS,
  hyperliquid: 18,
  "hyperliquid-mainnet": 6,
  tron: 6,
  polygon: 18,
};

const CHAIN_ALIASES: Record<string, SupportedChain[]> = {
  avalanche: [AVALANCHE_C_CHAIN, AVALANCHE_P_CHAIN],
  avax: [AVALANCHE_C_CHAIN, AVALANCHE_P_CHAIN],
};

const TRONSCAN_API = "https://apilist.tronscanapi.com";
const HYPERLIQUID_EXPLORER_BASE = "https://app.hyperliquid.xyz/explorer";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HYPERLIQUID_INFO_CLIENT = new InfoClient({
  transport: new HttpTransport({
    timeout: 10_000,
  }),
});

interface WalletToken {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  type: string;
  chain: SupportedChain;
  explorerUrl: string;
  priceUsd?: number;
  valueUsd?: number;
  priceSource?: string;
}

function mapNativeBalanceToWalletToken(nativeBalance: NativeBalanceEntry): WalletToken | null {
  if (!Number.isFinite(nativeBalance.balance) || nativeBalance.balance <= 0) {
    return null;
  }

  return {
    contractAddress: `native:${nativeBalance.chain}`,
    symbol: nativeBalance.symbol,
    name: `${nativeBalance.symbol} (${nativeBalance.chain} native)`,
    decimals: nativeBalance.decimals,
    balance: nativeBalance.balance,
    type: "NATIVE",
    chain: nativeBalance.chain,
    explorerUrl: nativeBalance.explorerUrl,
  };
}

interface NativeBalanceEntry {
  chain: SupportedChain;
  symbol: string;
  balance: number;
  decimals: number;
  explorerUrl: string;
}

interface ChainScanResult {
  chain: SupportedChain;
  source: "blockscout" | "tronscan" | "hyperliquid" | "avalanche-platform";
  status: "ok" | "error";
  tokens: WalletToken[];
  nativeBalance?: NativeBalanceEntry;
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address")?.trim();
  const explicitPAddress = normalizeAvalanchePAddress(
    searchParams.get("pAddress") || searchParams.get("avalanchePAddress")
  );
  const chainParam = (searchParams.get("chain") || "auto").toLowerCase();

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
  const inlinePAddress = isEvmAddress
    ? null
    : normalizeAvalanchePAddress(address);

  if (!isEvmAddress && !inlinePAddress) {
    return NextResponse.json(
      {
        error: "Invalid wallet address format",
        details:
          "Expected a 0x-prefixed 40-hex-character EVM address or a P-avax1... address.",
      },
      { status: 400 }
    );
  }

  const evmAddress = isEvmAddress ? address : null;
  const pAddressOverride = explicitPAddress || inlinePAddress;

  if (chainParam === AVALANCHE_P_CHAIN && !pAddressOverride) {
    return NextResponse.json(
      {
        error: "Avalanche P-Chain address is required",
        details: "Provide a P-avax1... address using `address` or `pAddress`.",
      },
      { status: 400 }
    );
  }

  let chainsToScan: SupportedChain[] = [];
  try {
    chainsToScan = resolveChains(
      chainParam,
      Boolean(evmAddress),
      Boolean(pAddressOverride)
    );
  } catch {
    return NextResponse.json(
      {
        error: `Unsupported chain: ${chainParam}`,
        supportedChains: Array.from(
          new Set([...AUTO_SCAN_CHAINS, ...Object.keys(CHAIN_ALIASES)])
        ),
      },
      { status: 400 }
    );
  }

  const settled = await Promise.allSettled(
    chainsToScan.map((chain) => scanChain(chain, evmAddress, pAddressOverride))
  );

  const chainResults: ChainScanResult[] = settled.map((result, index) => {
    const chain = chainsToScan[index];

    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      chain,
      source: getChainSource(chain),
      status: "error",
      tokens: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown scan error",
    };
  });

  const successfulResults = chainResults.filter(
    (result) => result.status === "ok"
  );

  if (successfulResults.length === 0) {
    return NextResponse.json(
      {
        error: "Failed to fetch wallet data on all requested chains",
        chainResults: chainResults.map((result) => ({
          chain: result.chain,
          status: result.status,
          source: result.source,
          error: result.error,
        })),
      },
      { status: 502 }
    );
  }

  const nativeBalances = successfulResults
    .map((result) => result.nativeBalance)
    .filter((balance): balance is NativeBalanceEntry => Boolean(balance));

  const nativeTokens = nativeBalances
    .map((nativeBalance) => mapNativeBalanceToWalletToken(nativeBalance))
    .filter((token): token is WalletToken => Boolean(token));

  const tokens = successfulResults
    .flatMap((result) => result.tokens)
    .concat(nativeTokens)
    .sort((a, b) => {
      const aValue = Number(a.valueUsd || 0);
      const bValue = Number(b.valueUsd || 0);

      if (aValue !== bValue) {
        return bValue - aValue;
      }

      return b.balance - a.balance;
    })
    .slice(0, 500);

  const primaryNative = nativeBalances[0] || {
    chain: chainsToScan[0],
    symbol: NATIVE_SYMBOLS[chainsToScan[0]],
    balance: 0,
    decimals: NATIVE_DECIMALS[chainsToScan[0]],
    explorerUrl: getAddressExplorerUrl(
      chainsToScan[0],
      chainsToScan[0] === AVALANCHE_P_CHAIN && pAddressOverride
        ? pAddressOverride
        : evmAddress || address
    ),
  };

  return NextResponse.json({
    address,
    chain: chainsToScan.length === 1 ? chainsToScan[0] : "multi-evm",
    nativeBalance: {
      chain: primaryNative.chain,
      symbol: primaryNative.symbol,
      balance: primaryNative.balance,
      decimals: primaryNative.decimals,
      explorerUrl: primaryNative.explorerUrl,
    },
    nativeBalances,
    tokens,
    tokenCount: tokens.length,
    chainsSearched: chainsToScan,
    chainResults: chainResults.map((result) => ({
      chain: result.chain,
      source: result.source,
      status: result.status,
      tokenCount:
        result.tokens.length +
        ((result.nativeBalance?.balance ?? 0) > 0 ? 1 : 0),
      nativeBalance: result.nativeBalance?.balance ?? 0,
      nativeSymbol: result.nativeBalance?.symbol,
      error: result.error,
    })),
    fetchedAt: new Date().toISOString(),
  });
}

function resolveChains(
  chainParam: string,
  hasEvmAddress: boolean,
  hasPAddress: boolean
): SupportedChain[] {
  if (!chainParam || chainParam === "all" || chainParam === "auto") {
    if (!hasEvmAddress) {
      return [AVALANCHE_P_CHAIN];
    }

    return hasPAddress
      ? [...AUTO_SCAN_CHAINS]
      : AUTO_SCAN_CHAINS.filter((chain) => chain !== AVALANCHE_P_CHAIN);
  }

  const aliasChains = CHAIN_ALIASES[chainParam];
  if (aliasChains?.length) {
    const filteredAliases = aliasChains.filter((chain) => {
      if (chain === AVALANCHE_P_CHAIN) {
        return hasPAddress;
      }

      return hasEvmAddress;
    });

    if (filteredAliases.length > 0) {
      return filteredAliases;
    }

    throw new Error("Unsupported chain");
  }

  if (isSupportedChain(chainParam)) {
    if (!hasEvmAddress && chainParam !== AVALANCHE_P_CHAIN) {
      throw new Error("Unsupported chain");
    }

    if (chainParam === AVALANCHE_P_CHAIN && !hasPAddress) {
      throw new Error("Unsupported chain");
    }

    return [chainParam];
  }

  throw new Error("Unsupported chain");
}

function isSupportedChain(chain: string): chain is SupportedChain {
  return (AUTO_SCAN_CHAINS as readonly string[]).includes(chain);
}

function isAvalancheCChain(chain: SupportedChain): chain is typeof AVALANCHE_C_CHAIN {
  return chain === AVALANCHE_C_CHAIN;
}

function normalizeAvalanchePAddress(address: string | null | undefined) {
  const raw = String(address || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  if (/^p-avax1[0-9a-z]+$/.test(normalized)) {
    return `P-${normalized.slice(2)}`;
  }

  if (/^avax1[0-9a-z]+$/.test(normalized)) {
    return `P-${normalized}`;
  }

  return null;
}

async function scanChain(
  chain: SupportedChain,
  evmAddress: string | null,
  pAddressOverride?: string | null
) {
  if (chain === AVALANCHE_P_CHAIN) {
    return fetchAvalanchePChainData(pAddressOverride);
  }

  if (!evmAddress) {
    throw new Error(`Chain ${chain} requires an EVM address`);
  }

  if (chain === "tron") {
    return fetchTronChainData(evmAddress);
  }

  if (chain === "hyperliquid-mainnet") {
    return fetchHyperliquidMainnetData(evmAddress);
  }

  if (isEvmChain(chain)) {
    return fetchBlockscoutChainData(chain, evmAddress);
  }

  throw new Error(`Unsupported chain: ${chain}`);
}

function getChainSource(chain: SupportedChain): ChainScanResult["source"] {
  if (chain === AVALANCHE_P_CHAIN) {
    return "avalanche-platform";
  }

  if (chain === "tron") {
    return "tronscan";
  }

  if (chain === "hyperliquid-mainnet") {
    return "hyperliquid";
  }

  return "blockscout";
}

function isEvmChain(chain: SupportedChain): chain is EvmChain {
  return chain in BLOCKSCOUT_ENDPOINTS;
}

async function fetchBlockscoutChainData(chain: EvmChain, address: string): Promise<ChainScanResult> {
  const endpoints = BLOCKSCOUT_ENDPOINTS[chain];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      return await fetchBlockscoutChainDataFromEndpoint(chain, address, endpoint);
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`No reachable Blockscout endpoints for chain ${chain}`);
}

async function fetchBlockscoutChainDataFromEndpoint(
  chain: EvmChain,
  address: string,
  endpoint: string
): Promise<ChainScanResult> {
  const legacyResult = await fetchBlockscoutLegacyData(chain, address, endpoint);
  if (legacyResult) {
    return legacyResult;
  }

  if (!isRoutescanLegacyEndpoint(endpoint)) {
    const v2Result = await fetchBlockscoutV2Data(chain, address, endpoint);
    if (v2Result) {
      return v2Result;
    }
  }

  throw new Error(`Blockscout API unsupported on ${chain} (${endpoint})`);
}

async function fetchBlockscoutLegacyData(
  chain: EvmChain,
  address: string,
  endpoint: string
): Promise<ChainScanResult | null> {
  const nativeSymbol = NATIVE_SYMBOLS[chain];
  const nativeDecimals = NATIVE_DECIMALS[chain];

  const nativeBalanceRes = await fetch(
    buildLegacyApiUrl(endpoint, {
      module: "account",
      action: "balance",
      address,
    })
  );

  if (!nativeBalanceRes.ok) {
    return null;
  }

  let nativeBalanceData: any;
  try {
    nativeBalanceData = await nativeBalanceRes.json();
  } catch {
    return null;
  }

  const tokenItems = await fetchLegacyTokenItems(endpoint, address);
  let nativeBalance = normalizeAtomicBalance(
    nativeBalanceData?.result ?? nativeBalanceData?.balance,
    nativeDecimals
  );

  if (chain === AVALANCHE_C_CHAIN && nativeBalance <= 0) {
    const rpcNativeBalance = await fetchAvalancheCChainNativeBalance(address);
    if (rpcNativeBalance > nativeBalance) {
      nativeBalance = rpcNativeBalance;
    }
  }

  const tokens = tokenItems
    .map((item: any): WalletToken | null =>
      mapBlockscoutToken(item, chain, endpoint)
    )
    .filter((token: WalletToken | null): token is WalletToken => Boolean(token))
    .sort((a: WalletToken, b: WalletToken) => b.balance - a.balance)
    .slice(0, 100);

  return {
    chain,
    source: "blockscout",
    status: "ok",
    nativeBalance: {
      chain,
      symbol: nativeSymbol,
      balance: nativeBalance,
      decimals: nativeDecimals,
      explorerUrl: getAddressExplorerUrl(chain, address),
    },
    tokens,
  };
}

async function fetchLegacyTokenItems(endpoint: string, address: string): Promise<any[]> {
  const tokenEndpoints = [
    buildLegacyApiUrl(endpoint, {
      module: "account",
      action: "tokenlist",
      address,
    }),
    buildLegacyApiUrl(endpoint, {
      module: "account",
      action: "addresstokenbalance",
      address,
      page: "1",
      offset: "200",
    }),
  ];

  for (const tokenEndpoint of tokenEndpoints) {
    try {
      const response = await fetch(tokenEndpoint);
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const items = extractLegacyTokenItems(payload);
      if (items) {
        return items;
      }
    } catch {
      // Try next endpoint.
    }
  }

  return [];
}

function extractLegacyTokenItems(payload: any): any[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  if (Array.isArray(payload?.result?.items)) {
    return payload.result.items;
  }

  if (Array.isArray(payload?.result?.tokens)) {
    return payload.result.tokens;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  const resultMessage =
    typeof payload?.result === "string" ? payload.result.toLowerCase() : "";
  if (
    resultMessage.includes("no transactions found") ||
    resultMessage.includes("no records found") ||
    resultMessage.includes("no tokens found")
  ) {
    return [];
  }

  return null;
}

function buildLegacyApiUrl(endpoint: string, params: Record<string, string>) {
  const normalizedEndpoint = endpoint.endsWith("/api")
    ? endpoint
    : `${endpoint.replace(/\/$/, "")}/api`;
  const url = new URL(normalizedEndpoint);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function isRoutescanLegacyEndpoint(endpoint: string) {
  return (
    endpoint.includes("api.routescan.io/v2/network") &&
    endpoint.includes("/etherscan/api")
  );
}

async function fetchBlockscoutV2Data(
  chain: EvmChain,
  address: string,
  endpoint: string
): Promise<ChainScanResult | null> {
  const nativeSymbol = NATIVE_SYMBOLS[chain];
  const nativeDecimals = NATIVE_DECIMALS[chain];

  const [addressRes, tokenBalancesRes] = await Promise.all([
    fetch(buildBlockscoutV2ApiUrl(endpoint, `/addresses/${address}`)),
    fetch(buildBlockscoutV2ApiUrl(endpoint, `/addresses/${address}/token-balances`)),
  ]);

  if (!addressRes.ok || !tokenBalancesRes.ok) {
    return null;
  }

  let addressData: any;
  let tokenBalancesData: any;

  try {
    [addressData, tokenBalancesData] = await Promise.all([
      addressRes.json(),
      tokenBalancesRes.json(),
    ]);
  } catch {
    return null;
  }

  const nativeBalanceRaw =
    addressData?.coin_balance ??
    addressData?.balance ??
    addressData?.native_balance ??
    "0";
  let nativeBalance = normalizeAtomicBalance(nativeBalanceRaw, nativeDecimals);

  if (chain === AVALANCHE_C_CHAIN && nativeBalance <= 0) {
    const rpcNativeBalance = await fetchAvalancheCChainNativeBalance(address);
    if (rpcNativeBalance > nativeBalance) {
      nativeBalance = rpcNativeBalance;
    }
  }

  const tokenItems = Array.isArray(tokenBalancesData)
    ? tokenBalancesData
    : Array.isArray(tokenBalancesData?.items)
      ? tokenBalancesData.items
      : [];

  const tokens = tokenItems
    .map((item: any): WalletToken | null =>
      mapBlockscoutV2Token(item, chain, endpoint)
    )
    .filter((token: WalletToken | null): token is WalletToken => Boolean(token))
    .sort((a: WalletToken, b: WalletToken) => b.balance - a.balance)
    .slice(0, 100);

  return {
    chain,
    source: "blockscout",
    status: "ok",
    nativeBalance: {
      chain,
      symbol: nativeSymbol,
      balance: nativeBalance,
      decimals: nativeDecimals,
      explorerUrl: getAddressExplorerUrl(chain, address),
    },
    tokens,
  };
}

function buildBlockscoutV2ApiUrl(endpoint: string, path: string) {
  const normalizedEndpoint = endpoint.endsWith("/api")
    ? endpoint.replace(/\/api$/, "")
    : endpoint;
  return `${normalizedEndpoint}/api/v2${path}`;
}

function mapBlockscoutToken(
  item: any,
  chain: EvmChain,
  endpoint: string
): WalletToken | null {
  const contractAddress =
    item?.contractAddress ||
    item?.contract_address ||
    item?.tokenAddress ||
    item?.token_address ||
    item?.TokenAddress;
  if (!contractAddress) {
    return null;
  }

  const decimals = normalizeDecimals(
    item?.decimals ??
      item?.tokenDecimal ??
      item?.token_decimal ??
      item?.TokenDecimal ??
      item?.TokenDivisor ??
      item?.divisor,
    18
  );
  const balance = normalizeAtomicBalance(
    item?.balance ??
      item?.tokenBalance ??
      item?.token_balance ??
      item?.TokenQuantity ??
      item?.value ??
      item?.amount,
    decimals
  );

  if (balance <= 0) {
    return null;
  }

  return {
    contractAddress: String(contractAddress),
    symbol: String(
      item?.symbol ?? item?.tokenSymbol ?? item?.TokenSymbol ?? "UNKNOWN"
    ),
    name: String(
      item?.name ?? item?.tokenName ?? item?.TokenName ?? "Unknown Token"
    ),
    decimals,
    balance,
    type: String(
      item?.type ?? item?.tokenType ?? item?.TokenType ?? "ERC-20"
    ),
    chain,
    explorerUrl: getTokenExplorerUrl(chain, String(contractAddress), endpoint),
  };
}

function mapBlockscoutV2Token(
  item: any,
  chain: EvmChain,
  endpoint: string
): WalletToken | null {
  const tokenMeta = item?.token || {};
  const contractAddress =
    tokenMeta?.address ||
    item?.token_address ||
    item?.address ||
    "";

  if (!contractAddress || contractAddress === "native") {
    return null;
  }

  const decimals = normalizeDecimals(
    tokenMeta?.decimals ?? item?.decimals,
    18
  );
  const rawBalance = item?.value ?? item?.balance ?? item?.token_balance ?? "0";
  const balance = normalizeAtomicBalance(rawBalance, decimals);

  if (balance <= 0) {
    return null;
  }

  return {
    contractAddress: String(contractAddress),
    symbol: String(tokenMeta?.symbol || item?.symbol || "UNKNOWN"),
    name: String(tokenMeta?.name || item?.name || "Unknown Token"),
    decimals,
    balance,
    type: String(tokenMeta?.type || item?.type || "ERC-20"),
    chain,
    explorerUrl: getTokenExplorerUrl(chain, String(contractAddress), endpoint),
  };
}

async function fetchTronChainData(evmAddress: string): Promise<ChainScanResult> {
  const tronAddress = evmToTronAddress(evmAddress);
  const apiUrl = `${TRONSCAN_API}/api/account/token_asset_overview?address=${tronAddress}`;
  const headers: HeadersInit = {};

  if (process.env.TRONSCAN_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONSCAN_API_KEY;
  }

  const response = await fetch(apiUrl, {
    headers,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`TronScan API error: ${response.status}`);
  }

  const data = await response.json();
  const entries = Array.isArray(data?.data) ? data.data : [];

  const nativeEntry = entries.find(
    (entry: any) =>
      String(entry?.tokenId) === "_" ||
      String(entry?.tokenAbbr || "").toUpperCase() === "TRX"
  );

  const nativeBalance = nativeEntry
    ? normalizeAtomicBalance(nativeEntry.balance, normalizeDecimals(nativeEntry.tokenDecimal, 6))
    : 0;

  const tokens = entries
    .map((entry: any): WalletToken | null => mapTronToken(entry))
    .filter((token: WalletToken | null): token is WalletToken => Boolean(token))
    .sort((a: WalletToken, b: WalletToken) => b.balance - a.balance)
    .slice(0, 100);

  return {
    chain: "tron",
    source: "tronscan",
    status: "ok",
    nativeBalance: {
      chain: "tron",
      symbol: "TRX",
      balance: nativeBalance,
      decimals: 6,
      explorerUrl: getAddressExplorerUrl("tron", tronAddress),
    },
    tokens,
  };
}

interface AvalanchePlatformRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

interface AvalanchePChainBalanceResult {
  balance?: string;
  unlocked?: string;
  lockedStakeable?: string;
  lockedNotStakeable?: string;
}

interface AvalanchePChainStakeResult {
  staked?: string;
  stakedOutputs?: any[];
  outputs?: any[];
}

interface AvalancheGlacierStakingAmount {
  assetId?: string;
  amount?: string;
  symbol?: string;
}

interface AvalancheGlacierStakingTransaction {
  startTimestamp?: number | string;
  endTimestamp?: number | string;
  amountStaked?: AvalancheGlacierStakingAmount[];
}

interface AvalancheGlacierStakingResponse {
  transactions?: AvalancheGlacierStakingTransaction[];
}

async function fetchAvalanchePChainData(
  pAddressOverride?: string | null
): Promise<ChainScanResult> {
  const candidateAddresses = Array.from(
    new Set(
      [pAddressOverride]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => [value, value.replace(/^P-/, "")])
    )
  );

  if (candidateAddresses.length === 0) {
    throw new Error("Avalanche P-Chain address is required");
  }

  const primaryPChainAddress =
    candidateAddresses.find((address) => address.startsWith("P-")) ||
    `P-${candidateAddresses[0]}`;

  // Stake retrieval is the critical signal for P-chain assets, so fetch it first.
  // Public endpoints aggressively rate-limit bursts; sequential calls improve success rate.
  let stakeResult: PromiseSettledResult<AvalanchePChainStakeResult>;
  try {
    const stakeValue = await fetchAvalanchePChainStakeWithFallback(candidateAddresses);
    stakeResult = { status: "fulfilled", value: stakeValue };
  } catch (error) {
    stakeResult = { status: "rejected", reason: error };
  }

  let balanceResult: PromiseSettledResult<AvalanchePChainBalanceResult>;
  try {
    const balanceValue = await fetchAvalanchePChainBalanceWithFallback(candidateAddresses);
    balanceResult = { status: "fulfilled", value: balanceValue };
  } catch (error) {
    balanceResult = { status: "rejected", reason: error };
  }

  if (balanceResult.status === "rejected" && stakeResult.status === "rejected") {
    const balanceError = normalizeErrorMessage(balanceResult.reason);
    const stakeError = normalizeErrorMessage(stakeResult.reason);
    throw new Error(
      `Avalanche P-Chain RPC error: ${stakeError || balanceError || "No data available"}`
    );
  }

  const nativeBalance =
    balanceResult.status === "fulfilled"
      ? resolveAvalanchePChainUnlockedBalance(balanceResult.value)
      : 0;

  const lockedStakeable =
    balanceResult.status === "fulfilled"
      ? normalizeAtomicBalance(
          balanceResult.value?.lockedStakeable,
          AVALANCHE_P_CHAIN_DECIMALS
        )
      : 0;

  const lockedNotStakeable =
    balanceResult.status === "fulfilled"
      ? normalizeAtomicBalance(
          balanceResult.value?.lockedNotStakeable,
          AVALANCHE_P_CHAIN_DECIMALS
        )
      : 0;

  const totalStaked =
    stakeResult.status === "fulfilled"
      ? extractAvalanchePChainStakedAmount(stakeResult.value)
      : 0;

  const tokens: WalletToken[] = [];
  if (totalStaked > 0) {
    tokens.push({
      contractAddress: `avalanche-p-staking:${primaryPChainAddress}`,
      symbol: "AVAX",
      name: "AVAX Staked (Avalanche P-Chain)",
      decimals: AVALANCHE_P_CHAIN_DECIMALS,
      balance: totalStaked,
      type: "AVALANCHE_P_STAKING",
      chain: AVALANCHE_P_CHAIN,
      explorerUrl: getAddressExplorerUrl(AVALANCHE_P_CHAIN, primaryPChainAddress),
    });
  } else {
    if (lockedStakeable > 0) {
      tokens.push({
        contractAddress: `avalanche-p-locked:stakeable:${primaryPChainAddress}`,
        symbol: "AVAX",
        name: "AVAX Locked Stakeable (Avalanche P-Chain)",
        decimals: AVALANCHE_P_CHAIN_DECIMALS,
        balance: lockedStakeable,
        type: "AVALANCHE_P_LOCKED_STAKEABLE",
        chain: AVALANCHE_P_CHAIN,
        explorerUrl: getAddressExplorerUrl(AVALANCHE_P_CHAIN, primaryPChainAddress),
      });
    }

    if (lockedNotStakeable > 0) {
      tokens.push({
        contractAddress: `avalanche-p-locked:nonstakeable:${primaryPChainAddress}`,
        symbol: "AVAX",
        name: "AVAX Locked (Avalanche P-Chain)",
        decimals: AVALANCHE_P_CHAIN_DECIMALS,
        balance: lockedNotStakeable,
        type: "AVALANCHE_P_LOCKED",
        chain: AVALANCHE_P_CHAIN,
        explorerUrl: getAddressExplorerUrl(AVALANCHE_P_CHAIN, primaryPChainAddress),
      });
    }
  }

  return {
    chain: AVALANCHE_P_CHAIN,
    source: "avalanche-platform",
    status: "ok",
    nativeBalance: {
      chain: AVALANCHE_P_CHAIN,
      symbol: "AVAX",
      balance: nativeBalance,
      decimals: AVALANCHE_P_CHAIN_DECIMALS,
      explorerUrl: getAddressExplorerUrl(AVALANCHE_P_CHAIN, primaryPChainAddress),
    },
    tokens,
  };
}

async function fetchAvalanchePChainBalanceWithFallback(addresses: string[]) {
  let lastError: Error | null = null;

  for (const address of addresses) {
    try {
      return await callAvalanchePlatformRpc<AvalanchePChainBalanceResult>(
        "platform.getBalance",
        { address }
      );
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to resolve Avalanche P-Chain balance");
}

async function fetchAvalanchePChainStakeWithFallback(addresses: string[]) {
  let lastError: Error | null = null;

  for (const address of addresses) {
    try {
      return await callAvalanchePlatformRpc<AvalanchePChainStakeResult>(
        "platform.getStake",
        { addresses: [address] }
      );
    } catch (error) {
      lastError = error as Error;
    }
  }

  const glacierFallback = await fetchAvalanchePChainStakeViaGlacier(addresses);
  if (glacierFallback) {
    return glacierFallback;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to resolve Avalanche P-Chain stake");
}

async function fetchAvalanchePChainStakeViaGlacier(
  addresses: string[]
): Promise<AvalanchePChainStakeResult | null> {
  const nowUnix = Math.floor(Date.now() / 1000);
  const candidateAddresses = Array.from(
    new Set(
      addresses
        .map((address) => String(address || "").trim())
        .filter(Boolean)
        .map((address) => (address.startsWith("P-") ? address : `P-${address}`))
    )
  );

  for (const address of candidateAddresses) {
    const url = new URL(
      `${AVALANCHE_GLACIER_API_BASE}/networks/mainnet/blockchains/p-chain/transactions:listStaking`
    );
    url.searchParams.set("addresses", address);
    url.searchParams.set("pageSize", "100");

    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 30 },
      });

      if (!response.ok) {
        continue;
      }

      const payload =
        (await response.json()) as AvalancheGlacierStakingResponse;
      const transactions = Array.isArray(payload?.transactions)
        ? payload.transactions
        : [];

      let totalAtomic = 0n;
      for (const transaction of transactions) {
        const startTimestamp = normalizeAvalancheUnixTimestamp(
          transaction?.startTimestamp
        );
        const endTimestamp = normalizeAvalancheUnixTimestamp(
          transaction?.endTimestamp
        );

        if (startTimestamp !== null && nowUnix < startTimestamp) {
          continue;
        }

        if (endTimestamp !== null && nowUnix > endTimestamp) {
          continue;
        }

        totalAtomic += extractAvalancheGlacierStakedAtomicAmount(transaction);
      }

      return {
        staked: totalAtomic.toString(),
      };
    } catch {
      // Try next candidate address.
    }
  }

  return null;
}

function normalizeAvalancheUnixTimestamp(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

function extractAvalancheGlacierStakedAtomicAmount(
  transaction: AvalancheGlacierStakingTransaction
) {
  const amounts = Array.isArray(transaction?.amountStaked)
    ? transaction.amountStaked
    : [];

  let total = 0n;
  for (const amountEntry of amounts) {
    const symbol = String(amountEntry?.symbol || "").toUpperCase();
    if (symbol && symbol !== "AVAX") {
      continue;
    }

    const rawAmount = String(amountEntry?.amount ?? "0");
    try {
      const atomic = BigInt(rawAmount);
      if (atomic > 0n) {
        total += atomic;
      }
    } catch {
      // Ignore malformed amount entries.
    }
  }

  return total;
}

async function callAvalanchePlatformRpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  let lastError: Error | null = null;

  for (const endpoint of AVALANCHE_PLATFORM_RPC_ENDPOINTS) {
    for (let attempt = 0; attempt <= AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
          }),
          next: { revalidate: 30 },
        });

        const rawBody = await response.text();
        const statusErrorMessage = `Avalanche RPC HTTP ${response.status}`;

        if (!response.ok) {
          if (
            response.status === 429 &&
            attempt < AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS.length
          ) {
            await wait(AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS[attempt]);
            continue;
          }

          throw new Error(statusErrorMessage);
        }

        let payload: AvalanchePlatformRpcResponse<T>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          if (
            isAvalancheRpcRateLimitMessage(rawBody) &&
            attempt < AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS.length
          ) {
            await wait(AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS[attempt]);
            continue;
          }

          throw new Error("Invalid Avalanche RPC response");
        }

        if (payload?.error) {
          const errorMessage =
            payload.error.message || `Avalanche RPC ${method} failed`;
          if (
            isAvalancheRpcRateLimitMessage(errorMessage) &&
            attempt < AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS.length
          ) {
            await wait(AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS[attempt]);
            continue;
          }

          throw new Error(errorMessage);
        }

        if (!payload?.result) {
          throw new Error(`Avalanche RPC ${method} returned no result`);
        }

        return payload.result;
      } catch (error) {
        const normalizedMessage = normalizeErrorMessage(error);
        lastError = error instanceof Error ? error : new Error(normalizedMessage);

        if (
          isAvalancheRpcRateLimitMessage(normalizedMessage) &&
          attempt < AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS.length
        ) {
          await wait(AVALANCHE_PLATFORM_RPC_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        break;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Avalanche RPC ${method} failed`);
}

function isAvalancheRpcRateLimitMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("1015") ||
    normalized.includes("rate limit")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAvalanchePChainStakedAmount(result: AvalanchePChainStakeResult) {
  const directStaked = normalizeAtomicBalance(
    result?.staked,
    AVALANCHE_P_CHAIN_DECIMALS
  );

  const entries = Array.isArray(result?.stakedOutputs)
    ? result.stakedOutputs
    : Array.isArray(result?.outputs)
      ? result.outputs
      : [];

  const fromOutputs = entries.reduce((sum: number, entry: any) => {
    const amount = normalizeAtomicBalance(
      entry?.amount ??
        entry?.stakeAmount ??
        entry?.stakedAmount ??
        entry?.output?.amount ??
        entry?.output?.stakeAmount,
      AVALANCHE_P_CHAIN_DECIMALS
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return sum;
    }

    return sum + amount;
  }, 0);

  return Math.max(directStaked, fromOutputs);
}

function resolveAvalanchePChainUnlockedBalance(result: AvalanchePChainBalanceResult) {
  const unlocked = normalizeAtomicBalance(
    result?.unlocked,
    AVALANCHE_P_CHAIN_DECIMALS
  );
  const lockedStakeable = normalizeAtomicBalance(
    result?.lockedStakeable,
    AVALANCHE_P_CHAIN_DECIMALS
  );
  const lockedNotStakeable = normalizeAtomicBalance(
    result?.lockedNotStakeable,
    AVALANCHE_P_CHAIN_DECIMALS
  );

  const hasBalanceBreakdown =
    result?.unlocked !== undefined ||
    result?.lockedStakeable !== undefined ||
    result?.lockedNotStakeable !== undefined;

  if (hasBalanceBreakdown) {
    return Math.max(
      0,
      unlocked
    );
  }

  return normalizeAtomicBalance(result?.balance, AVALANCHE_P_CHAIN_DECIMALS);
}

function sortWalletTokensByValue(tokens: WalletToken[]) {
  return [...tokens].sort((a, b) => {
    const aValue = Number(a.valueUsd || 0);
    const bValue = Number(b.valueUsd || 0);

    if (aValue !== bValue) {
      return bValue - aValue;
    }

    return b.balance - a.balance;
  });
}

async function fetchAvalancheCChainNativeBalance(address: string) {
  try {
    const response = await fetch(AVALANCHE_C_CHAIN_RPC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return 0;
    }

    const payload = await response.json();
    return normalizeHexAtomicBalance(payload?.result, 18);
  } catch {
    return 0;
  }
}

function normalizeHexAtomicBalance(value: unknown, decimals: number) {
  if (typeof value !== "string") {
    return 0;
  }

  try {
    const atomic = BigInt(value);
    const divisor = 10n ** BigInt(decimals);
    const whole = Number(atomic / divisor);
    const fraction = Number(atomic % divisor) / Math.pow(10, decimals);
    if (!Number.isFinite(whole) || !Number.isFinite(fraction)) {
      return 0;
    }

    return whole + fraction;
  } catch {
    return 0;
  }
}

async function fetchHyperliquidMainnetData(address: string): Promise<ChainScanResult> {
  const [spotResult, perpResult, vaultResult, stakingResult] = await Promise.allSettled([
    fetchHyperliquidSpotState(address),
    fetchHyperliquidPerpState(address),
    fetchHyperliquidVaultEquities(address),
    fetchHyperliquidStakingSummary(address),
  ]);

  const spotData = spotResult.status === "fulfilled" ? spotResult.value : null;
  const perpData = perpResult.status === "fulfilled" ? perpResult.value : null;
  const vaultData = vaultResult.status === "fulfilled" ? vaultResult.value : null;
  const stakingData = stakingResult.status === "fulfilled" ? stakingResult.value : null;

  if (!spotData && !perpData) {
    const spotError =
      spotResult.status === "rejected"
        ? normalizeErrorMessage(spotResult.reason)
        : null;
    const perpError =
      perpResult.status === "rejected"
        ? normalizeErrorMessage(perpResult.reason)
        : null;

    throw new Error(
      `Hyperliquid API error: ${spotError || perpError || "No data available"}`
    );
  }

  const spot = parseHyperliquidSpotState(spotData);
  const perps = parseHyperliquidPerpState(perpData);
  const perpCollateral = parseHyperliquidPerpCollateral(perpData);
  const vaults = await parseHyperliquidVaultEquities(vaultData);
  const staking = parseHyperliquidStakingSummary(stakingData);
  const perpWithdrawable = normalizeHyperliquidBalance(
    perpData?.withdrawable
  );
  const perpAccountValue = normalizeHyperliquidBalance(
    perpData?.crossMarginSummary?.accountValue ??
      perpData?.marginSummary?.accountValue ??
      perpData?.accountValue
  );
  const nativeUsdcBalance =
    spot.usdcBalance > 0
      ? spot.usdcBalance
      : perpWithdrawable > 0
        ? perpWithdrawable
        : perpAccountValue;

  // Perp positions/collateral must remain visible even when many spot/vault assets exist.
  const prioritizedPerps = sortWalletTokensByValue([
    ...perps,
    ...(perpCollateral ? [perpCollateral] : []),
  ]);
  const otherAssets = sortWalletTokensByValue([
    ...spot.tokens,
    ...vaults,
    ...staking,
  ]);
  const tokens = [...prioritizedPerps, ...otherAssets].slice(0, 100);

  return {
    chain: "hyperliquid-mainnet",
    source: "hyperliquid",
    status: "ok",
    nativeBalance: {
      chain: "hyperliquid-mainnet",
      symbol: "USDC",
      balance: nativeUsdcBalance,
      decimals: 6,
      explorerUrl: getAddressExplorerUrl("hyperliquid-mainnet", address),
    },
    tokens,
  };
}

async function fetchHyperliquidSpotState(address: string) {
  return HYPERLIQUID_INFO_CLIENT.spotClearinghouseState({
    user: address,
  });
}

async function fetchHyperliquidPerpState(address: string) {
  return HYPERLIQUID_INFO_CLIENT.clearinghouseState({
    user: address,
  });
}

async function fetchHyperliquidVaultEquities(address: string) {
  return HYPERLIQUID_INFO_CLIENT.userVaultEquities({
    user: address,
  });
}

async function fetchHyperliquidStakingSummary(address: string) {
  return HYPERLIQUID_INFO_CLIENT.delegatorSummary({
    user: address,
  });
}

async function fetchHyperliquidVaultDetails(vaultAddress: string) {
  return HYPERLIQUID_INFO_CLIENT.vaultDetails({
    vaultAddress,
  });
}

function parseHyperliquidSpotState(data: any) {
  const aggregated = new Map<string, { balance: number; valueUsd?: number }>();
  const arrayCandidates: any[] = [];

  if (Array.isArray(data?.balances)) {
    arrayCandidates.push(data.balances);
  }

  if (Array.isArray(data?.tokenBalances)) {
    arrayCandidates.push(data.tokenBalances);
  }

  if (Array.isArray(data?.spotBalances)) {
    arrayCandidates.push(data.spotBalances);
  }

  if (Array.isArray(data?.state?.balances)) {
    arrayCandidates.push(data.state.balances);
  }

  if (Array.isArray(data?.spotState?.balances)) {
    arrayCandidates.push(data.spotState.balances);
  }

  if (Array.isArray(data?.evmEscrows)) {
    arrayCandidates.push(data.evmEscrows);
  }

  const objectBalances =
    data?.balances && !Array.isArray(data?.balances) && typeof data.balances === "object"
      ? data.balances
      : null;

  for (const entries of arrayCandidates) {
    for (const entry of entries) {
      const symbol = normalizeSymbol(
        entry?.coin ??
          entry?.symbol ??
          entry?.token ??
          entry?.asset ??
          entry?.name
      );
      if (!symbol) {
        continue;
      }

      const balance = normalizeHyperliquidBalance(
        entry?.total ??
          entry?.balance ??
          entry?.amount ??
          entry?.size ??
          entry?.position
      );
      if (balance <= 0) {
        continue;
      }

      const valueUsd = normalizeHyperliquidBalance(
        entry?.usdValue ??
          entry?.usdcValue ??
          entry?.notionalValue ??
          entry?.positionValue ??
          entry?.entryNtl
      );
      const previous = aggregated.get(symbol);
      const nextValue =
        valueUsd > 0 ? (previous?.valueUsd || 0) + valueUsd : previous?.valueUsd;

      aggregated.set(symbol, {
        balance: (previous?.balance || 0) + balance,
        valueUsd: nextValue,
      });
    }
  }

  if (objectBalances) {
    for (const [rawSymbol, rawEntry] of Object.entries(objectBalances)) {
      const symbol = normalizeSymbol(rawSymbol);
      if (!symbol) {
        continue;
      }

      const entry = rawEntry as any;
      const balance = normalizeHyperliquidBalance(
        typeof entry === "number" || typeof entry === "string"
          ? entry
          : entry?.total ?? entry?.balance ?? entry?.amount
      );
      if (balance <= 0) {
        continue;
      }

      const valueUsd = normalizeHyperliquidBalance(
        typeof entry === "object"
          ? entry?.usdValue ?? entry?.usdcValue ?? entry?.notionalValue
          : undefined
      );
      const previous = aggregated.get(symbol);
      const nextValue =
        valueUsd > 0 ? (previous?.valueUsd || 0) + valueUsd : previous?.valueUsd;

      aggregated.set(symbol, {
        balance: (previous?.balance || 0) + balance,
        valueUsd: nextValue,
      });
    }
  }

  const tokens = Array.from(aggregated.entries()).map(([symbol, entry]) => {
    const decimals = symbol === "USDC" ? 6 : 8;
    const priceUsd =
      entry.valueUsd && entry.balance > 0 ? entry.valueUsd / entry.balance : undefined;

    return {
      contractAddress: `hyperliquid-spot:${symbol}`,
      symbol,
      name: `${symbol} (Hyperliquid Spot)`,
      decimals,
      balance: entry.balance,
      type: "HYPERLIQUID_SPOT",
      chain: "hyperliquid-mainnet" as const,
      explorerUrl: getHyperliquidTokenExplorerUrl(symbol, "spot"),
      priceUsd,
      valueUsd: entry.valueUsd,
      priceSource: priceUsd ? "hyperliquid" : undefined,
    };
  });

  const usdcEntry = aggregated.get("USDC");
  return {
    usdcBalance: usdcEntry?.balance || 0,
    tokens: tokens.filter((token) => token.symbol !== "USDC"),
  };
}

function parseHyperliquidPerpState(data: any): WalletToken[] {
  const positions = Array.isArray(data?.assetPositions)
    ? data.assetPositions
    : Array.isArray(data?.positions)
      ? data.positions
      : [];

  const tokens: WalletToken[] = [];

  for (const item of positions) {
    const position = item?.position ?? item;
    const symbol = normalizeSymbol(
      position?.coin ??
        position?.symbol ??
        position?.asset ??
        item?.coin ??
        item?.symbol
    );
    if (!symbol) {
      continue;
    }

    const signedSize = normalizeHyperliquidBalance(
      position?.szi ?? position?.size ?? position?.position ?? position?.sz
    );
    if (!Number.isFinite(signedSize) || signedSize === 0) {
      continue;
    }

    const balance = Math.abs(signedSize);
    const markPx = normalizeHyperliquidBalance(position?.markPx ?? position?.oraclePx);
    const positionValueRaw = normalizeHyperliquidBalance(
      position?.positionValue ??
        position?.notionalValue ??
        position?.usdValue ??
        item?.positionValue
    );
    const valueUsd =
      positionValueRaw > 0
        ? positionValueRaw
        : markPx > 0
          ? balance * markPx
          : undefined;

    tokens.push({
      contractAddress: `hyperliquid-perp:${symbol}:${signedSize > 0 ? "long" : "short"}`,
      symbol,
      name: `${symbol} Perp (${signedSize > 0 ? "Long" : "Short"})`,
      decimals: 6,
      balance,
      type: "HYPERLIQUID_PERP",
      chain: "hyperliquid-mainnet",
      explorerUrl: getHyperliquidTokenExplorerUrl(symbol, "perp"),
      priceUsd: markPx > 0 ? markPx : undefined,
      valueUsd,
      priceSource: markPx > 0 ? "hyperliquid" : undefined,
    });
  }

  return tokens;
}

function parseHyperliquidPerpCollateral(data: any): WalletToken | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const collateralValue = normalizeHyperliquidBalance(
    data?.withdrawable ??
      data?.crossMarginSummary?.accountValue ??
      data?.marginSummary?.accountValue ??
      data?.accountValue
  );

  if (!Number.isFinite(collateralValue) || collateralValue <= 0) {
    return null;
  }

  return {
    contractAddress: "hyperliquid-perp:USDC-collateral",
    symbol: "USDC",
    name: "USDC Perp Collateral",
    decimals: 6,
    balance: collateralValue,
    type: "HYPERLIQUID_PERP_COLLATERAL",
    chain: "hyperliquid-mainnet",
    explorerUrl: `${HYPERLIQUID_EXPLORER_BASE}/portfolio`,
    priceUsd: 1,
    valueUsd: collateralValue,
    priceSource: "hyperliquid",
  };
}

async function parseHyperliquidVaultEquities(data: any): Promise<WalletToken[]> {
  if (!Array.isArray(data)) {
    return [];
  }

  const entries = data
    .map((entry: any) => ({
      vaultAddress: String(entry?.vaultAddress || "").trim(),
      equity: normalizeHyperliquidBalance(entry?.equity),
      lockedUntilTimestamp: Number(entry?.lockedUntilTimestamp || 0),
    }))
    .filter((entry) => entry.vaultAddress && entry.equity > 0);

  const settled = await Promise.allSettled(
    entries.map(async (entry): Promise<WalletToken> => {
      let vaultName = "";
      try {
        const details = await fetchHyperliquidVaultDetails(entry.vaultAddress);
        vaultName = typeof details?.name === "string" ? details.name.trim() : "";
      } catch {
        vaultName = "";
      }

      const shortAddress = shortenAddress(entry.vaultAddress);
      const baseName = vaultName || `Vault ${shortAddress}`;
      const vaultSymbol = deriveHyperliquidVaultSymbol(vaultName, entry.vaultAddress);
      const lockSuffix =
        Number.isFinite(entry.lockedUntilTimestamp) && entry.lockedUntilTimestamp > Date.now()
          ? " (Locked)"
          : "";

      return {
        contractAddress: `hyperliquid-vault:${entry.vaultAddress}`,
        symbol: vaultSymbol,
        name: `${baseName}${lockSuffix}`,
        decimals: 6,
        balance: entry.equity,
        type: "HYPERLIQUID_VAULT",
        chain: "hyperliquid-mainnet",
        explorerUrl: getAddressExplorerUrl("hyperliquid-mainnet", entry.vaultAddress),
        priceUsd: 1,
        valueUsd: entry.equity,
        priceSource: "hyperliquid",
      };
    })
  );

  return settled
    .filter((entry): entry is PromiseFulfilledResult<WalletToken> => entry.status === "fulfilled")
    .map((entry) => entry.value);
}

function deriveHyperliquidVaultSymbol(vaultName: string, vaultAddress: string) {
  const normalizedName = String(vaultName || "").trim();
  const parenMatch = normalizedName.match(/\(([A-Za-z0-9._-]{2,12})\)/);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].toUpperCase();
  }

  if (/hyperliquidity\s+provider/i.test(normalizedName)) {
    return "HLP";
  }

  const alnum = normalizedName.replace(/[^A-Za-z0-9]/g, "");
  if (alnum.length >= 2 && alnum.length <= 10) {
    return alnum.toUpperCase();
  }

  return `VLT-${shortenAddress(vaultAddress).replace(/\.\.\./g, "")}`.slice(0, 12);
}

function shortenAddress(address: string) {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseHyperliquidStakingSummary(data: any): WalletToken[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const delegated = normalizeHyperliquidBalance(data?.delegated);
  const undelegated = normalizeHyperliquidBalance(data?.undelegated);
  const pending = normalizeHyperliquidBalance(data?.totalPendingWithdrawal);

  const stakingEntries = [
    {
      key: "delegated",
      amount: delegated,
      label: "Delegated",
      kind: "delegated",
    },
    {
      key: "undelegated",
      amount: undelegated,
      label: "Undelegated",
      kind: "undelegated",
    },
    {
      key: "pending",
      amount: pending,
      label: "Pending Withdrawal",
      kind: "pending",
    },
  ];

  return stakingEntries
    .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0)
    .map((entry) => ({
      contractAddress: `hyperliquid-staking:${entry.kind}`,
      symbol: "HYPE",
      name: `HYPE Staking (${entry.label})`,
      decimals: 8,
      balance: entry.amount,
      type: "HYPERLIQUID_STAKING",
      chain: "hyperliquid-mainnet" as const,
      explorerUrl: `${HYPERLIQUID_EXPLORER_BASE}/staking`,
    }));
}

function normalizeHyperliquidBalance(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSymbol(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized || "";
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function mapTronToken(entry: any): WalletToken | null {
  const tokenId = String(entry?.tokenId || "");
  if (!tokenId || tokenId === "_") {
    return null;
  }

  const tokenType = String(entry?.tokenType || "").toUpperCase();
  if (!tokenType.includes("TRC20") && !tokenType.includes("TRC10")) {
    return null;
  }

  const decimals = normalizeDecimals(entry?.tokenDecimal, 6);
  const balance = normalizeAtomicBalance(entry?.balance, decimals);

  if (balance <= 0) {
    return null;
  }

  return {
    contractAddress: tokenId,
    symbol: String(entry?.tokenAbbr || "UNKNOWN"),
    name: String(entry?.tokenName || "Unknown Token"),
    decimals,
    balance,
    type: tokenType || "TRON_TOKEN",
    chain: "tron",
    explorerUrl: getTronTokenExplorerUrl(tokenType, tokenId),
  };
}

function normalizeDecimals(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeAtomicBalance(value: unknown, decimals: number) {
  if (value === null || value === undefined) {
    return 0;
  }

  const raw = String(value);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (raw.includes(".")) {
    return parsed;
  }

  return parsed / Math.pow(10, decimals);
}

function getAddressExplorerUrl(chain: SupportedChain, address: string) {
  if (chain === "tron") {
    return `https://tronscan.org/#/address/${address}`;
  }

  if (chain === AVALANCHE_P_CHAIN) {
    return `https://subnets.avax.network/p-chain/address/${address}`;
  }

  if (chain === "hyperliquid-mainnet") {
    return `${HYPERLIQUID_EXPLORER_BASE}/address/${address}`;
  }

  if (isAvalancheCChain(chain)) {
    return `https://routescan.io/address/${address}?chainid=${ROUTESCAN_AVALANCHE_C_CHAIN_ID}`;
  }

  return `${getExplorerBaseUrl(BLOCKSCOUT_ENDPOINTS[chain][0])}/address/${address}`;
}

function getTokenExplorerUrl(
  chain: EvmChain,
  tokenAddress: string,
  endpoint: string
) {
  if (chain === AVALANCHE_C_CHAIN) {
    return `https://routescan.io/token/${tokenAddress}?chainid=${ROUTESCAN_AVALANCHE_C_CHAIN_ID}`;
  }

  return `${getExplorerBaseUrl(endpoint)}/token/${tokenAddress}`;
}

function getExplorerBaseUrl(endpoint: string) {
  return endpoint.replace(/\/api\/?$/, "");
}

function getHyperliquidTokenExplorerUrl(symbol: string, marketType: "spot" | "perp") {
  return `${HYPERLIQUID_EXPLORER_BASE}?market=${marketType}&symbol=${encodeURIComponent(symbol)}`;
}

function getTronTokenExplorerUrl(tokenType: string, tokenId: string) {
  if (tokenType.includes("TRC20")) {
    return `https://tronscan.org/#/token20/${tokenId}`;
  }

  return `https://tronscan.org/#/token/${tokenId}`;
}

function evmToTronAddress(evmAddress: string) {
  const normalized = evmAddress.toLowerCase().replace(/^0x/, "");
  const tronHexPayload = Buffer.from(`41${normalized}`, "hex");

  const firstHash = createHash("sha256").update(tronHexPayload).digest();
  const secondHash = createHash("sha256").update(firstHash).digest();
  const checksum = secondHash.subarray(0, 4);

  return base58Encode(Buffer.concat([tronHexPayload, checksum]));
}

function base58Encode(buffer: Buffer) {
  if (buffer.length === 0) {
    return "";
  }

  let value = BigInt(`0x${buffer.toString("hex")}`);
  const zero = BigInt(0);
  const fiftyEight = BigInt(58);
  let encoded = "";

  while (value > zero) {
    const remainder = Number(value % fiftyEight);
    value = value / fiftyEight;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  for (let i = 0; i < buffer.length && buffer[i] === 0; i += 1) {
    encoded = `1${encoded}`;
  }

  return encoded || "1";
}
