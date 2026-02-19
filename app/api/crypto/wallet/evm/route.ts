import { createHash } from "crypto";
import {
  HttpTransport,
  InfoClient,
} from "@nktkas/hyperliquid";
import { NextRequest, NextResponse } from "next/server";

const ROUTESCAN_EVM_API_BASE = "https://api.routescan.io/v2/network";

const AVALANCHE_CHAINS = [
  "avalanche-c",
  "avalanche-fuji",
  "avalanche-beam",
  "avalanche-dfk",
  "avalanche-dexalot",
  "avalanche-shrapnel",
] as const;

const ROUTESCAN_CHAIN_IDS: Record<(typeof AVALANCHE_CHAINS)[number], number> = {
  "avalanche-c": 43114,
  "avalanche-fuji": 43113,
  "avalanche-beam": 4337,
  "avalanche-dfk": 53935,
  "avalanche-dexalot": 432204,
  "avalanche-shrapnel": 2044,
};

const BLOCKSCOUT_ENDPOINTS = {
  ethereum: ["https://eth.blockscout.com"],
  optimism: ["https://optimism.blockscout.com"],
  base: ["https://base.blockscout.com"],
  arbitrum: ["https://arbitrum.blockscout.com"],
  polygon: ["https://polygon.blockscout.com"],
  "avalanche-c": [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/43114/etherscan/api`,
  ],
  "avalanche-fuji": [
    `${ROUTESCAN_EVM_API_BASE}/testnet/evm/43113/etherscan/api`,
  ],
  "avalanche-beam": [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/4337/etherscan/api`,
  ],
  "avalanche-dfk": [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/53935/etherscan/api`,
  ],
  "avalanche-dexalot": [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/432204/etherscan/api`,
  ],
  "avalanche-shrapnel": [
    `${ROUTESCAN_EVM_API_BASE}/mainnet/evm/2044/etherscan/api`,
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
  ...AVALANCHE_CHAINS,
] as const;

type SupportedChain = (typeof AUTO_SCAN_CHAINS)[number];
type EvmChain = keyof typeof BLOCKSCOUT_ENDPOINTS;
type AvalancheChain = (typeof AVALANCHE_CHAINS)[number];

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  optimism: "ETH",
  base: "ETH",
  arbitrum: "ETH",
  "avalanche-c": "AVAX",
  "avalanche-fuji": "AVAX",
  "avalanche-beam": "BEAM",
  "avalanche-dfk": "JEWEL",
  "avalanche-dexalot": "ALOT",
  "avalanche-shrapnel": "SHRAP",
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
  "avalanche-c": 18,
  "avalanche-fuji": 18,
  "avalanche-beam": 18,
  "avalanche-dfk": 18,
  "avalanche-dexalot": 18,
  "avalanche-shrapnel": 18,
  hyperliquid: 18,
  "hyperliquid-mainnet": 6,
  tron: 6,
  polygon: 18,
};

const CHAIN_ALIASES: Record<string, SupportedChain[]> = {
  avalanche: [...AVALANCHE_CHAINS],
  avax: [...AVALANCHE_CHAINS],
  "avalanche-all": [...AVALANCHE_CHAINS],
};

const TRONSCAN_API = "https://apilist.tronscanapi.com";
const HYPERLIQUID_EXPLORER_BASE = "https://app.hyperliquid.xyz/explorer";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAX_HYPERLIQUID_VAULTS_TO_EXPAND = 20;
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

interface NativeBalanceEntry {
  chain: SupportedChain;
  symbol: string;
  balance: number;
  decimals: number;
  explorerUrl: string;
}

interface ChainScanResult {
  chain: SupportedChain;
  source: "blockscout" | "tronscan" | "hyperliquid";
  status: "ok" | "error";
  tokens: WalletToken[];
  nativeBalance?: NativeBalanceEntry;
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address")?.trim();
  const chainParam = (searchParams.get("chain") || "auto").toLowerCase();

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      {
        error: "Invalid EVM wallet address format",
        details: "Expected a 0x-prefixed 40-hex-character address.",
      },
      { status: 400 }
    );
  }

  let chainsToScan: SupportedChain[] = [];
  try {
    chainsToScan = resolveChains(chainParam);
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
    chainsToScan.map((chain) => scanChain(chain, address))
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

  const tokens = successfulResults
    .flatMap((result) => result.tokens)
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
    explorerUrl: getAddressExplorerUrl(chainsToScan[0], address),
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
      tokenCount: result.tokens.length,
      nativeBalance: result.nativeBalance?.balance ?? 0,
      nativeSymbol: result.nativeBalance?.symbol,
      error: result.error,
    })),
    fetchedAt: new Date().toISOString(),
  });
}

function resolveChains(chainParam: string): SupportedChain[] {
  if (!chainParam || chainParam === "all" || chainParam === "auto") {
    return [...AUTO_SCAN_CHAINS];
  }

  const aliasChains = CHAIN_ALIASES[chainParam];
  if (aliasChains) {
    return [...aliasChains];
  }

  if (isSupportedChain(chainParam)) {
    return [chainParam];
  }

  throw new Error("Unsupported chain");
}

function isSupportedChain(chain: string): chain is SupportedChain {
  return (AUTO_SCAN_CHAINS as readonly string[]).includes(chain);
}

function isAvalancheChain(chain: SupportedChain): chain is AvalancheChain {
  return (AVALANCHE_CHAINS as readonly string[]).includes(chain);
}

async function scanChain(chain: SupportedChain, evmAddress: string) {
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
  const nativeBalance = normalizeAtomicBalance(
    nativeBalanceData?.result ?? nativeBalanceData?.balance,
    nativeDecimals
  );

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
  const nativeBalance = normalizeAtomicBalance(nativeBalanceRaw, nativeDecimals);

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
  const vaultBreakdown = await fetchHyperliquidVaultAssetBreakdown(
    vaultData,
    address
  );
  const vaults = [
    ...vaultBreakdown.tokens,
    ...parseHyperliquidVaultEquities(vaultData, {
      excludeVaultAddresses: vaultBreakdown.resolvedVaultAddresses,
    }),
  ];
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
  const tokens = [...spot.tokens, ...perps, ...vaults, ...staking]
    .sort((a, b) => {
      const aValue = Number(a.valueUsd || 0);
      const bValue = Number(b.valueUsd || 0);

      if (aValue !== bValue) {
        return bValue - aValue;
      }

      return b.balance - a.balance;
    })
    .slice(0, 100);

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

async function fetchHyperliquidVaultDetails(vaultAddress: string, user?: string) {
  return HYPERLIQUID_INFO_CLIENT.vaultDetails({
    vaultAddress,
    user,
  });
}

async function fetchHyperliquidVaultAssetBreakdown(
  vaultEquities: any,
  userAddress: string
) {
  const result: {
    tokens: WalletToken[];
    resolvedVaultAddresses: Set<string>;
  } = {
    tokens: [],
    resolvedVaultAddresses: new Set<string>(),
  };

  if (!Array.isArray(vaultEquities)) {
    return result;
  }

  const entries = vaultEquities
    .map((entry: any) => ({
      vaultAddress: String(entry?.vaultAddress || "").trim(),
      equity: normalizeHyperliquidBalance(entry?.equity),
    }))
    .filter((entry) => entry.vaultAddress && entry.equity > 0)
    .sort((a, b) => b.equity - a.equity)
    .slice(0, MAX_HYPERLIQUID_VAULTS_TO_EXPAND);

  if (entries.length === 0) {
    return result;
  }

  const settled = await Promise.allSettled(
    entries.map(async (entry) => {
      let details: any = null;
      try {
        details = await fetchHyperliquidVaultDetails(
          entry.vaultAddress,
          userAddress
        );
      } catch {
        details = null;
      }

      const vaultShare = getHyperliquidVaultUserShare({
        details,
        userAddress,
        fallbackUserEquity: entry.equity,
      });

      if (!vaultShare || vaultShare <= 0) {
        return {
          vaultAddress: entry.vaultAddress,
          tokens: [] as WalletToken[],
        };
      }

      const accountAddresses = getHyperliquidVaultAccountAddresses(
        entry.vaultAddress,
        details
      );
      const rawTokens: WalletToken[] = [];

      const accountSettled = await Promise.allSettled(
        accountAddresses.map(async (accountAddress) => {
          const [spotResult, perpResult] = await Promise.allSettled([
            fetchHyperliquidSpotState(accountAddress),
            fetchHyperliquidPerpState(accountAddress),
          ]);

          const spotData =
            spotResult.status === "fulfilled" ? spotResult.value : null;
          const perpData =
            perpResult.status === "fulfilled" ? perpResult.value : null;

          if (!spotData && !perpData) {
            return [] as WalletToken[];
          }

          return parseHyperliquidVaultStateTokensRaw({
            vaultAddress: entry.vaultAddress,
            accountAddress,
            spotData,
            perpData,
          });
        })
      );

      for (const accountEntry of accountSettled) {
        if (accountEntry.status === "fulfilled") {
          rawTokens.push(...accountEntry.value);
        }
      }

      const tokens = scaleHyperliquidVaultTokens(rawTokens, vaultShare);

      return {
        vaultAddress: entry.vaultAddress,
        tokens,
      };
    })
  );

  for (const settledEntry of settled) {
    if (settledEntry.status !== "fulfilled") {
      continue;
    }

    const { vaultAddress, tokens } = settledEntry.value;
    if (tokens.length === 0) {
      continue;
    }

    result.tokens.push(...tokens);
    result.resolvedVaultAddresses.add(vaultAddress);
  }

  return result;
}

function getHyperliquidVaultAccountAddresses(vaultAddress: string, details: any) {
  const addresses = new Set<string>([vaultAddress]);

  const childAddresses =
    details?.relationship?.type === "parent" &&
    Array.isArray(details?.relationship?.data?.childAddresses)
      ? details.relationship.data.childAddresses
      : [];

  for (const childAddress of childAddresses) {
    const normalized = String(childAddress || "").trim();
    if (normalized) {
      addresses.add(normalized);
    }
  }

  return Array.from(addresses);
}

function getHyperliquidVaultUserShare(params: {
  details: any;
  userAddress: string;
  fallbackUserEquity: number;
}) {
  const { details, userAddress, fallbackUserEquity } = params;
  if (!details || typeof details !== "object") {
    return null;
  }

  const followers = Array.isArray(details?.followers) ? details.followers : [];
  const userAddressLower = userAddress.toLowerCase();
  const leaderAddressLower = String(details?.leader || "").toLowerCase();
  const isLeader = userAddressLower !== "" && userAddressLower === leaderAddressLower;

  let totalEquity = 0;
  let userEquity = normalizeHyperliquidBalance(details?.followerState?.vaultEquity);
  let leaderEquity = 0;

  for (const follower of followers) {
    const followerEquity = normalizeHyperliquidBalance(follower?.vaultEquity);
    if (followerEquity <= 0) {
      continue;
    }

    totalEquity += followerEquity;

    const followerUser = String(follower?.user || "").toLowerCase();
    if (followerUser === userAddressLower) {
      userEquity = Math.max(userEquity, followerEquity);
    }

    if (followerUser === "leader") {
      leaderEquity = Math.max(leaderEquity, followerEquity);
    }
  }

  if (userEquity <= 0 && isLeader && leaderEquity > 0) {
    userEquity = leaderEquity;
  }

  if (userEquity <= 0 && fallbackUserEquity > 0) {
    userEquity = fallbackUserEquity;
  }

  if (totalEquity <= 0 || userEquity <= 0) {
    return null;
  }

  const rawShare = userEquity / totalEquity;
  if (!Number.isFinite(rawShare) || rawShare <= 0) {
    return null;
  }

  return Math.min(1, rawShare);
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

function parseHyperliquidVaultStateTokensRaw(params: {
  vaultAddress: string;
  accountAddress: string;
  spotData: any;
  perpData: any;
}): WalletToken[] {
  const { vaultAddress, accountAddress, spotData, perpData } = params;

  const spot = parseHyperliquidSpotState(spotData);
  const perps = parseHyperliquidPerpState(perpData);
  const vaultUsdcBalance =
    spot.usdcBalance > 0
      ? spot.usdcBalance
      : normalizeHyperliquidBalance(perpData?.withdrawable);

  const vaultTokens: WalletToken[] = [...spot.tokens, ...perps];

  if (vaultUsdcBalance > 0) {
    vaultTokens.push({
      contractAddress: "hyperliquid-spot:USDC",
      symbol: "USDC",
      name: "USDC (Hyperliquid Spot)",
      decimals: 6,
      balance: vaultUsdcBalance,
      type: "HYPERLIQUID_SPOT",
      chain: "hyperliquid-mainnet",
      explorerUrl: getHyperliquidTokenExplorerUrl("USDC", "spot"),
      priceUsd: 1,
      valueUsd: vaultUsdcBalance,
      priceSource: "hyperliquid",
    });
  }

  if (vaultTokens.length === 0) {
    return [];
  }

  const vaultTag = shortenAddress(vaultAddress);
  const accountTag = shortenAddress(accountAddress);
  const accountSuffix =
    accountAddress.toLowerCase() !== vaultAddress.toLowerCase()
      ? ` [Sub ${accountTag}]`
      : "";

  return vaultTokens
    .map((token) => {
      return {
        ...token,
        contractAddress: `${token.contractAddress}:vault:${vaultAddress}:account:${accountAddress}`,
        name: `${token.name} [Vault ${vaultTag}]${accountSuffix}`,
      };
    })
    .filter((token): token is WalletToken => Boolean(token));
}

function scaleHyperliquidVaultTokens(
  tokens: WalletToken[],
  share: number
): WalletToken[] {
  if (tokens.length === 0) {
    return [];
  }

  if (!Number.isFinite(share) || share <= 0) {
    return [];
  }

  const clampedShare = Math.min(1, share);

  return tokens
    .map((token) => {
      const scaledBalance = token.balance * clampedShare;
      if (!Number.isFinite(scaledBalance) || scaledBalance <= 0) {
        return null;
      }

      const scaledValue =
        typeof token.valueUsd === "number" && Number.isFinite(token.valueUsd)
          ? token.valueUsd * clampedShare
          : typeof token.priceUsd === "number" &&
              Number.isFinite(token.priceUsd)
            ? scaledBalance * token.priceUsd
            : undefined;

      return {
        ...token,
        balance: scaledBalance,
        valueUsd: scaledValue,
      };
    })
    .filter((token: WalletToken | null): token is WalletToken => Boolean(token));
}

function parseHyperliquidVaultEquities(
  data: any,
  options?: { excludeVaultAddresses?: Set<string> }
): WalletToken[] {
  const exclude = options?.excludeVaultAddresses ?? new Set<string>();

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry: any): WalletToken | null => {
      const vaultAddress = String(entry?.vaultAddress || "").trim();
      if (!vaultAddress) {
        return null;
      }

      if (exclude.has(vaultAddress)) {
        return null;
      }

      const equity = normalizeHyperliquidBalance(entry?.equity);
      if (!Number.isFinite(equity) || equity <= 0) {
        return null;
      }

      const shortAddress =
        vaultAddress.length > 10
          ? `${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`
          : vaultAddress;

      return {
        contractAddress: `hyperliquid-vault:${vaultAddress}`,
        symbol: "USDC",
        name: `Hyperliquid Vault (${shortAddress})`,
        decimals: 6,
        balance: equity,
        type: "HYPERLIQUID_VAULT",
        chain: "hyperliquid-mainnet",
        explorerUrl: getAddressExplorerUrl("hyperliquid-mainnet", vaultAddress),
        priceUsd: 1,
        valueUsd: equity,
        priceSource: "hyperliquid",
      };
    })
    .filter((token: WalletToken | null): token is WalletToken => Boolean(token));
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

  if (chain === "hyperliquid-mainnet") {
    return `${HYPERLIQUID_EXPLORER_BASE}/address/${address}`;
  }

  if (isAvalancheChain(chain)) {
    return `https://routescan.io/address/${address}?chainid=${ROUTESCAN_CHAIN_IDS[chain]}`;
  }

  return `${getExplorerBaseUrl(BLOCKSCOUT_ENDPOINTS[chain][0])}/address/${address}`;
}

function getTokenExplorerUrl(
  chain: EvmChain,
  tokenAddress: string,
  endpoint: string
) {
  if (isAvalancheChain(chain)) {
    return `https://routescan.io/token/${tokenAddress}?chainid=${ROUTESCAN_CHAIN_IDS[chain]}`;
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
