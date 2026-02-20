import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";

const SOLANA_RPC =
  process.env.SOLANA_RPC_URL?.trim() || "https://solana-rpc.publicnode.com";
const SOLSCAN_BASE_URL = "https://solscan.io";
const KAMINO_API_BASE = "https://api.kamino.finance";
const JUPITER_PORTFOLIO_API_BASE = "https://api.jup.ag/portfolio/v1";
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEFAULT_HTTP_HEADERS: HeadersInit = {
  accept: "application/json",
  "user-agent": "wealth-manager/1.0",
};

const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
const STAKE_PROGRAM_ID = new PublicKey(
  "Stake11111111111111111111111111111111111111"
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const KNOWN_TOKENS: Record<
  string,
  { symbol: string; name: string; decimals: number }
> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
  },
  "7i5KKsX2weiTkry7jA4ZwSuXGhsSnEAF7WjwFaENhuvY": {
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
  },
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: {
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    decimals: 9,
  },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: {
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    decimals: 9,
  },
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP22p2c: {
    symbol: "bSOL",
    name: "Blaze Staked SOL",
    decimals: 9,
  },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": {
    symbol: "stSOL",
    name: "Lido Staked SOL",
    decimals: 9,
  },
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
  },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": {
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
  },
  SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt: {
    symbol: "SRM",
    name: "Serum",
    decimals: 6,
  },
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": {
    symbol: "BTC",
    name: "Wrapped BTC (Wormhole)",
    decimals: 8,
  },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": {
    symbol: "ETH",
    name: "Wrapped ETH (Wormhole)",
    decimals: 8,
  },
  A9mUU4qviSctJVPJdBJWkb28fz945QxgoHgMU8sPmkpP: {
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
  },
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: {
    symbol: "PYUSD",
    name: "PayPal USD",
    decimals: 6,
  },
};

interface TokenInfo {
  mint?: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  rawAmount: string;
  chain: "solana";
  type?: string;
  tokenProgram?: string;
  explorerUrl?: string;
  source?: string;
  positionType?: "token" | "stake" | "protocol";
  priceUsd?: number;
  valueUsd?: number;
  [key: string]: any;
}

interface TokenMetadata {
  symbol: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address format" },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const publicKey = new PublicKey(address);
    const metaplex = Metaplex.make(connection);

    const [
      solBalanceLamports,
      tokenAccountsResponses,
      stakePositions,
      jupiterPortfolioPositions,
      jupiterStakePositions,
      kaminoLendPositions,
      kaminoVaultPositions,
    ] =
      await Promise.all([
        connection.getBalance(publicKey),
        Promise.all([
          connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: SPL_TOKEN_PROGRAM_ID,
          }),
          connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: TOKEN_2022_PROGRAM_ID,
          }),
        ]),
        fetchStakePositions(connection, address),
        fetchJupiterPortfolioPositions(address),
        fetchJupiterStakePositions(address),
        fetchKaminoPositions(address),
        fetchKaminoVaultPositions(address),
      ]);

    const solBalance = solBalanceLamports / 1e9;

    const tokenAccounts = tokenAccountsResponses.flatMap((response) => response.value);
    const baseTokens = tokenAccounts
      .map((account): TokenInfo | null => {
        const parsedInfo = (account.account.data as any)?.parsed?.info;
        const tokenAmount = parsedInfo?.tokenAmount;

        if (!parsedInfo?.mint || !tokenAmount) {
          return null;
        }

        const balance = parseUiAmount(tokenAmount);
        if (!Number.isFinite(balance) || balance <= 0) {
          return null;
        }

        return {
          mint: parsedInfo.mint,
          symbol: parsedInfo.mint.slice(0, 4),
          name: "Unknown Token",
          balance,
          decimals: tokenAmount.decimals || 0,
          rawAmount: tokenAmount.amount || "0",
          chain: "solana",
          type: "SPL",
          tokenProgram: account.account.owner.toBase58(),
          explorerUrl: `${SOLSCAN_BASE_URL}/token/${parsedInfo.mint}`,
          source: "solana-rpc",
          positionType: "token",
        };
      })
      .filter((token): token is TokenInfo => token !== null)
      .sort((a, b) => b.balance - a.balance);

    const metadataCache = new Map<string, TokenMetadata>();
    const tokensWithMetadata: TokenInfo[] = [];

    for (const token of baseTokens) {
      const mintAddress = token.mint;
      if (!mintAddress) {
        continue;
      }

      let metadata = metadataCache.get(mintAddress);

      if (!metadata) {
        metadata = await resolveTokenMetadata(connection, metaplex, mintAddress);
        metadataCache.set(mintAddress, metadata);
      }

      tokensWithMetadata.push({
        ...token,
        symbol: metadata.symbol || `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
        name: metadata.name || "Unknown Token",
      });

      await delay(40);
    }

    const allKaminoPositions = [...kaminoLendPositions, ...kaminoVaultPositions];
    const hasDirectJupiterStake = jupiterStakePositions.some(
      (position) => position.type === "JUP_STAKE"
    );
    const jupiterPositionsWithoutStakeFallback = hasDirectJupiterStake
      ? jupiterPortfolioPositions.filter(
          (position) => position.type !== "JUP_STAKE_FALLBACK"
        )
      : jupiterPortfolioPositions;
    const protocolPositions = dedupeProtocolPositions([
      ...jupiterPositionsWithoutStakeFallback,
      ...jupiterStakePositions,
      ...allKaminoPositions,
    ]);
    const mergedTokens = [
      ...tokensWithMetadata,
      ...stakePositions.tokens,
      ...protocolPositions,
    ]
      .sort((a, b) => (b.valueUsd ?? b.balance) - (a.valueUsd ?? a.balance));

    const result = {
      address,
      chain: "solana",
      nativeBalance: {
        chain: "solana",
        symbol: "SOL",
        balance: solBalance,
        decimals: 9,
        explorerUrl: `${SOLSCAN_BASE_URL}/account/${address}`,
      },
      tokens: mergedTokens,
      tokenCount: mergedTokens.length,
      stakedSolBalance: stakePositions.totalStakedSol,
      kaminoPositionCount: allKaminoPositions.length,
      jupiterPositionCount: jupiterPortfolioPositions.length,
      protocolPositionCount: protocolPositions.length,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching Solana wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data", details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function resolveTokenMetadata(
  connection: Connection,
  metaplex: Metaplex,
  mintAddress: string
): Promise<TokenMetadata> {
  if (KNOWN_TOKENS[mintAddress]) {
    return {
      symbol: KNOWN_TOKENS[mintAddress].symbol,
      name: KNOWN_TOKENS[mintAddress].name,
    };
  }

  const metaplexMetadata = await fetchMetaplexMetadata(connection, metaplex, mintAddress);
  if (metaplexMetadata) {
    return metaplexMetadata;
  }

  const token2022Metadata = await fetchToken2022Metadata(connection, mintAddress);
  if (token2022Metadata) {
    return token2022Metadata;
  }

  return {
    symbol: `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
    name: "Unknown Token",
  };
}

async function fetchMetaplexMetadata(
  connection: Connection,
  metaplex: Metaplex,
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const metadataPda = metaplex.nfts().pdas().metadata({ mint: mintPublicKey });
    const metadataAccount = await connection.getAccountInfo(metadataPda);

    if (!metadataAccount) {
      return null;
    }

    const data = metadataAccount.data;
    let offset = 1 + 32 + 32;

    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data
      .slice(offset, offset + nameLen)
      .toString("utf8")
      .replace(/\u0000/g, "")
      .trim();
    offset += nameLen;

    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data
      .slice(offset, offset + symbolLen)
      .toString("utf8")
      .replace(/\u0000/g, "")
      .trim();

    if (!symbol || !name) {
      return null;
    }

    return {
      symbol: symbol.slice(0, 20),
      name: name.slice(0, 60),
    };
  } catch {
    return null;
  }
}

async function fetchToken2022Metadata(
  connection: Connection,
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
    const parsedInfo = (mintInfo.value?.data as any)?.parsed?.info;

    if (!parsedInfo) {
      return null;
    }

    const extensionMetadata = extractToken2022Metadata(parsedInfo?.extensions);

    if (!extensionMetadata?.symbol || !extensionMetadata?.name) {
      return null;
    }

    return {
      symbol: String(extensionMetadata.symbol).trim().slice(0, 20),
      name: String(extensionMetadata.name).trim().slice(0, 60),
    };
  } catch {
    return null;
  }
}

function extractToken2022Metadata(extensions: any): { symbol?: string; name?: string } | null {
  if (!Array.isArray(extensions)) {
    return null;
  }

  for (const extension of extensions) {
    const extensionName = String(extension?.extension || "").toLowerCase();
    if (!extensionName.includes("metadata")) {
      continue;
    }

    const state = extension?.state || extension;
    const symbol = state?.symbol;
    const name = state?.name;

    if (symbol || name) {
      return { symbol, name };
    }
  }

  return null;
}

async function fetchStakePositions(connection: Connection, ownerAddress: string) {
  try {
    const [asStaker, asWithdrawer] = await Promise.all([
      connection.getParsedProgramAccounts(STAKE_PROGRAM_ID, {
        filters: [{ memcmp: { offset: 12, bytes: ownerAddress } }],
      }),
      connection.getParsedProgramAccounts(STAKE_PROGRAM_ID, {
        filters: [{ memcmp: { offset: 44, bytes: ownerAddress } }],
      }),
    ]);

    const uniqueStakeAccounts = new Map<string, any>();
    [...asStaker, ...asWithdrawer].forEach((account) => {
      uniqueStakeAccounts.set(account.pubkey.toBase58(), account);
    });

    const stakeTokens: TokenInfo[] = [];
    let totalStakedSol = 0;

    for (const [stakeAccount, accountInfo] of uniqueStakeAccounts.entries()) {
      const parsedData = (accountInfo.account.data as any)?.parsed?.info;
      const delegatedLamports = Number(parsedData?.stake?.delegation?.stake || 0);
      const rentExemptReserve = Number(parsedData?.meta?.rentExemptReserve || 0);
      const activeLamports = Math.max(accountInfo.account.lamports - rentExemptReserve, 0);
      const effectiveLamports =
        delegatedLamports > 0 ? delegatedLamports : activeLamports;

      if (!Number.isFinite(effectiveLamports) || effectiveLamports <= 0) {
        continue;
      }

      const balance = effectiveLamports / 1e9;
      totalStakedSol += balance;

      stakeTokens.push({
        symbol: "SOL",
        name: delegatedLamports > 0 ? "Staked SOL" : "Stake Account (Inactive)",
        balance,
        decimals: 9,
        rawAmount: String(effectiveLamports),
        chain: "solana",
        type: "NATIVE_STAKE",
        source: "solana-stake-program",
        positionType: "stake",
        explorerUrl: `${SOLSCAN_BASE_URL}/account/${stakeAccount}`,
        stakeAccount,
      });
    }

    return {
      tokens: stakeTokens.sort((a, b) => b.balance - a.balance),
      totalStakedSol,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Stake accounts unavailable on current Solana RPC: ${message}`);
    return { tokens: [] as TokenInfo[], totalStakedSol: 0 };
  }
}

function getJupiterApiHeaders(): HeadersInit {
  const apiKey = process.env.JUPITER_API_KEY?.trim();
  if (!apiKey) {
    return DEFAULT_HTTP_HEADERS;
  }

  return {
    ...DEFAULT_HTTP_HEADERS,
    "x-api-key": apiKey,
  };
}

async function fetchJupiterPortfolioPositions(address: string): Promise<TokenInfo[]> {
  const endpoints = [
    `${JUPITER_PORTFOLIO_API_BASE}/positions/${address}`,
    `https://lite-api.jup.ag/portfolio/v1/positions/${address}`,
  ];
  const headers = getJupiterApiHeaders();

  for (const endpoint of endpoints) {
    const payload = await fetchJsonIfOk(endpoint, headers);
    if (!payload) {
      continue;
    }

    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const mapped = elements
      .map((element: any) => mapJupiterPortfolioElement(element))
      .filter((entry: TokenInfo | null): entry is TokenInfo => entry !== null);

    if (mapped.length > 0) {
      return dedupeProtocolPositions(mapped);
    }
  }

  return [];
}

function mapJupiterPortfolioElement(element: any): TokenInfo | null {
  if (!element || typeof element !== "object") {
    return null;
  }

  const label = String(element?.label || "").trim();
  const labelLower = label.toLowerCase();
  const platformId = String(element?.platformId || "").trim();

  // Wallet and native stake entries are already collected from Solana RPC.
  if (labelLower.includes("wallet") || platformId.toLowerCase() === "native-stake") {
    return null;
  }

  const isStakeEntry =
    labelLower.includes("staked") || platformId.toLowerCase().includes("governance");

  const assetEntries = Array.isArray(element?.data?.assets) ? element.data.assets : [];
  const primaryAsset = assetEntries.find((asset: any) => {
    const amount = firstFiniteNumber([
      asset?.amount,
      asset?.data?.amount,
      asset?.balance,
      asset?.data?.balance,
    ]);
    return amount > 0;
  });
  const tokenAmount = firstFiniteNumber([
    element?.data?.amount,
    element?.data?.stakedAmount,
    element?.data?.stakedJup,
    primaryAsset?.amount,
    primaryAsset?.data?.amount,
    primaryAsset?.balance,
    primaryAsset?.data?.balance,
  ]);
  const valueUsd = firstFiniteNumber([
    element?.value,
    element?.data?.value,
    element?.data?.valueUsd,
    element?.data?.totalValueUsd,
    element?.data?.positionValueUsd,
  ]);

  if (valueUsd <= 0 && tokenAmount <= 0) {
    return null;
  }

  const effectiveBalance = tokenAmount > 0 ? tokenAmount : valueUsd;
  const derivedPriceUsd =
    tokenAmount > 0 && valueUsd > 0 ? valueUsd / tokenAmount : 1;
  const assetSymbol = String(
    primaryAsset?.symbol ||
      primaryAsset?.data?.symbol ||
      element?.data?.symbol ||
      ""
  ).trim();
  const name = String(
    (isStakeEntry
      ? "Jupiter Staked JUP"
      : undefined) ||
      element?.name ||
      (label && platformId
        ? `${label} (${platformId})`
        : label || platformId || "Jupiter Position")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  const symbol = isStakeEntry
    ? "JUP"
    : assetSymbol || deriveJupiterPositionSymbol(platformId || label);

  return {
    symbol,
    name: name || "Jupiter Position",
    balance: effectiveBalance,
    decimals: tokenAmount > 0 ? 6 : 2,
    rawAmount: String(effectiveBalance),
    chain: "solana",
    type: isStakeEntry ? "JUP_STAKE_FALLBACK" : "JUP_PORTFOLIO",
    source: "jupiter-portfolio-api",
    positionType: "protocol",
    priceUsd: derivedPriceUsd,
    valueUsd: valueUsd > 0 ? valueUsd : undefined,
    platform: platformId || undefined,
    label: label || undefined,
    portfolioType: String(element?.type || "").slice(0, 30) || undefined,
    explorerUrl: "https://jup.ag",
  };
}

function deriveJupiterPositionSymbol(value: string): string {
  const chunks = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.slice(0, 4).toUpperCase());

  return chunks.length > 0 ? chunks.join("-").slice(0, 20) : "JUP-POS";
}

async function fetchKaminoPositions(address: string): Promise<TokenInfo[]> {
  const directEndpoints = [
    `${KAMINO_API_BASE}/users/${address}/obligations`,
    `${KAMINO_API_BASE}/v2/users/${address}/obligations`,
    `${KAMINO_API_BASE}/obligations/users/${address}`,
    `${KAMINO_API_BASE}/users/${address}/obligations?env=mainnet-beta`,
    `${KAMINO_API_BASE}/obligations/users/${address}?env=mainnet-beta`,
    `${KAMINO_API_BASE}/v2/users/${address}/obligations?env=mainnet-beta`,
  ];

  for (const endpoint of directEndpoints) {
    const payload = await fetchJsonIfOk(endpoint);
    if (!payload) {
      continue;
    }

    const parsed = extractKaminoObligationEntries(payload)
      .map((entry) => mapKaminoObligation(entry))
      .filter((entry): entry is TokenInfo => entry !== null);

    if (parsed.length > 0) {
      return dedupeProtocolPositions(parsed);
    }
  }

  // Fallback for users where obligations are only exposed by market-specific endpoints.
  const marketIds = await fetchKaminoMarketIds();
  if (marketIds.length === 0) {
    return [];
  }

  const scannedMarketIds = marketIds.slice(0, 120);
  const marketBatchSize = 8;
  const aggregatedPositions: TokenInfo[] = [];

  for (let i = 0; i < scannedMarketIds.length; i += marketBatchSize) {
    const marketBatch = scannedMarketIds.slice(i, i + marketBatchSize);
    const batchResults = await Promise.all(
      marketBatch.map(async (marketId) => {
        const marketEndpoints = [
          `${KAMINO_API_BASE}/kamino-market/${marketId}/users/${address}/obligations`,
          `${KAMINO_API_BASE}/v2/kamino-market/${marketId}/users/${address}/obligations`,
        ];

        for (const endpoint of marketEndpoints) {
          const payload = await fetchJsonIfOk(endpoint);
          if (!payload) {
            continue;
          }

          const parsed = extractKaminoObligationEntries(payload)
            .map((entry) => mapKaminoObligation(entry, marketId))
            .filter((entry): entry is TokenInfo => entry !== null);
          if (parsed.length > 0) {
            return parsed;
          }
        }

        return [] as TokenInfo[];
      })
    );

    aggregatedPositions.push(...batchResults.flat());
    // Avoid very long responses when we already found positions.
    if (aggregatedPositions.length > 0 && i >= 48) {
      break;
    }
  }

  return dedupeProtocolPositions(aggregatedPositions);
}

async function fetchKaminoVaultPositions(address: string): Promise<TokenInfo[]> {
  const endpoints = [
    `${KAMINO_API_BASE}/kvaults/users/${address}/positions`,
    `${KAMINO_API_BASE}/v2/kvaults/users/${address}/positions`,
    `${KAMINO_API_BASE}/users/${address}/vault-positions`,
    `${KAMINO_API_BASE}/kvaults/users/${address}/positions?env=mainnet-beta`,
    `${KAMINO_API_BASE}/users/${address}/vault-positions?env=mainnet-beta`,
    `${KAMINO_API_BASE}/v2/kvaults/users/${address}/positions?env=mainnet-beta`,
  ];

  for (const endpoint of endpoints) {
    const payload = await fetchJsonIfOk(endpoint);
    if (!payload) {
      continue;
    }

    const parsed = extractKaminoVaultEntries(payload)
      .map((entry) => mapKaminoVaultPosition(entry))
      .filter((entry): entry is TokenInfo => entry !== null);

    if (parsed.length > 0) {
      return dedupeProtocolPositions(parsed);
    }
  }

  return [];
}

async function fetchKaminoMarketIds(): Promise<string[]> {
  const endpoints = [
    `${KAMINO_API_BASE}/v2/kamino-market`,
    `${KAMINO_API_BASE}/kamino-market`,
    `${KAMINO_API_BASE}/v2/markets`,
    `${KAMINO_API_BASE}/markets`,
  ];

  for (const endpoint of endpoints) {
    const payload = await fetchJsonIfOk(endpoint);
    if (!payload) {
      continue;
    }

    const marketIds = extractKaminoMarketAddresses(payload);
    if (marketIds.length > 0) {
      return marketIds;
    }
  }

  return [];
}

async function fetchJsonIfOk(
  endpoint: string,
  headers: HeadersInit = DEFAULT_HTTP_HEADERS
): Promise<any> {
  try {
    const response = await fetch(endpoint, {
      headers,
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return null;
    }

    return readJsonIfPossible(response);
  } catch {
    return null;
  }
}

function extractKaminoObligationEntries(payload: any): any[] {
  const candidates = collectNestedObjects(payload);
  const results: any[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
      continue;
    }

    const obligation = candidate?.obligation && typeof candidate.obligation === "object"
      ? candidate.obligation
      : candidate;

    const depositUsd = firstFiniteNumber([
      obligation?.refreshedStats?.userTotalDeposit,
      obligation?.userTotalDeposit,
      obligation?.depositUsd,
      obligation?.totalDepositValueUsd,
      obligation?.totalDepositsUsd,
    ]);
    const borrowUsd = firstFiniteNumber([
      obligation?.refreshedStats?.userTotalBorrow,
      obligation?.userTotalBorrow,
      obligation?.borrowUsd,
      obligation?.totalBorrowValueUsd,
      obligation?.totalBorrowsUsd,
    ]);
    const hasObligationAddress = isSolanaAddressLike(
      obligation?.obligationAddress ??
        obligation?.obligation ??
        obligation?.address ??
        obligation?.pubkey
    );

    if (depositUsd <= 0 && borrowUsd <= 0 && !hasObligationAddress) {
      continue;
    }

    const key = String(
      obligation?.obligationAddress ??
        obligation?.obligation ??
        obligation?.address ??
        obligation?.pubkey ??
        `${depositUsd}:${borrowUsd}`
    );
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(obligation);
  }

  return results;
}

function extractKaminoVaultEntries(payload: any): any[] {
  const candidates = collectNestedObjects(payload);
  const results: any[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
      continue;
    }

    const entry = candidate?.position && typeof candidate.position === "object"
      ? candidate.position
      : candidate;

    const usdValue = firstFiniteNumber([
      entry?.usdValue,
      entry?.valueUsd,
      entry?.positionUsdValue,
      entry?.totalValueUsd,
      entry?.currentValueUsd,
      entry?.balanceUsd,
      entry?.stats?.usdValue,
    ]);
    const shareBalance = firstFiniteNumber([
      entry?.shares,
      entry?.shareBalance,
      entry?.balance,
      entry?.amount,
      entry?.positionSize,
    ]);
    const hasVaultId = isSolanaAddressLike(
      entry?.vaultAddress ?? entry?.vault ?? entry?.vaultPubkey
    );
    const hasVaultHints = Boolean(
      entry?.vaultAddress ||
        entry?.vault ||
        entry?.vaultPubkey ||
        entry?.vaultSymbol ||
        entry?.symbol
    );

    if (!hasVaultHints || (usdValue <= 0 && shareBalance <= 0 && !hasVaultId)) {
      continue;
    }

    const key = String(
      entry?.vaultAddress ??
        entry?.vault ??
        entry?.vaultPubkey ??
        `${entry?.symbol || "vault"}:${shareBalance}:${usdValue}`
    );
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(entry);
  }

  return results;
}

function mapKaminoObligation(obligation: any, marketFallback?: string): TokenInfo | null {
  const depositUsd = firstFiniteNumber([
    obligation?.refreshedStats?.userTotalDeposit,
    obligation?.userTotalDeposit,
    obligation?.depositUsd,
    obligation?.totalDepositValueUsd,
    obligation?.totalDepositsUsd,
  ]);
  const borrowUsd = firstFiniteNumber([
    obligation?.refreshedStats?.userTotalBorrow,
    obligation?.userTotalBorrow,
    obligation?.borrowUsd,
    obligation?.totalBorrowValueUsd,
    obligation?.totalBorrowsUsd,
  ]);
  const netValueRaw = firstFiniteSignedNumber([
    obligation?.refreshedStats?.netAccountValue,
    obligation?.netAccountValue,
    obligation?.netValueUsd,
  ]);
  const netValueUsd = netValueRaw ?? depositUsd - borrowUsd;

  if (depositUsd <= 0 && borrowUsd <= 0 && netValueUsd <= 0) {
    return null;
  }

  const obligationAddress = String(
    obligation?.obligationAddress ||
      obligation?.obligation ||
      obligation?.address ||
      obligation?.pubkey ||
      ""
  );
  const marketAddress = String(
    obligation?.marketAddress ||
      obligation?.market ||
      obligation?.marketPubkey ||
      marketFallback ||
      ""
  );
  const marketName = String(
    obligation?.marketName || obligation?.marketLabel || obligation?.marketSymbol || ""
  ).trim();
  const effectiveValueUsd = netValueUsd > 0 ? netValueUsd : depositUsd;

  return {
    symbol: "KAMINO",
    name: marketName
      ? `Kamino Lend (${marketName.slice(0, 24)})`
      : "Kamino Lend Position",
    balance: effectiveValueUsd,
    decimals: 2,
    rawAmount: String(effectiveValueUsd),
    chain: "solana",
    type: "KAMINO_LEND",
    source: "kamino-api",
    positionType: "protocol",
    explorerUrl: obligationAddress
      ? `${SOLSCAN_BASE_URL}/account/${obligationAddress}`
      : "https://app.kamino.finance/lend",
    priceUsd: 1,
    valueUsd: effectiveValueUsd,
    borrowUsd,
    netValueUsd,
    market: marketAddress,
    obligationAddress,
  };
}

function mapKaminoVaultPosition(entry: any): TokenInfo | null {
  const usdValue = firstFiniteNumber([
    entry?.usdValue,
    entry?.valueUsd,
    entry?.positionUsdValue,
    entry?.totalValueUsd,
    entry?.currentValueUsd,
    entry?.balanceUsd,
    entry?.stats?.usdValue,
  ]);

  const shareBalance = firstFiniteNumber([
    entry?.shares,
    entry?.shareBalance,
    entry?.balance,
    entry?.amount,
    entry?.positionSize,
  ]);

  const effectiveBalance = shareBalance > 0 ? shareBalance : usdValue;
  if (!Number.isFinite(effectiveBalance) || effectiveBalance <= 0) {
    return null;
  }

  const symbol = String(
    entry?.symbol || entry?.vaultSymbol || entry?.tokenSymbol || "KVAULT"
  ).slice(0, 20);
  const name = String(
    entry?.vaultName || entry?.name || "Kamino Vault Position"
  ).slice(0, 60);

  const vaultAddress = String(
    entry?.vaultAddress || entry?.vault || entry?.vaultPubkey || ""
  );
  const derivedPriceUsd =
    usdValue > 0 && shareBalance > 0 ? usdValue / shareBalance : 1;
  const decimals = Number(entry?.decimals);

  return {
    symbol,
    name,
    balance: effectiveBalance,
    decimals: Number.isFinite(decimals) ? decimals : 9,
    rawAmount: String(effectiveBalance),
    chain: "solana",
    type: "KAMINO_VAULT",
    source: "kamino-api",
    positionType: "protocol",
    explorerUrl: vaultAddress
      ? `${SOLSCAN_BASE_URL}/account/${vaultAddress}`
      : "https://app.kamino.finance/earn",
    priceUsd: derivedPriceUsd,
    valueUsd: usdValue > 0 ? usdValue : undefined,
    vaultAddress,
  };
}

function collectNestedObjects(root: any, maxNodes: number = 4000): any[] {
  const queue: any[] = [root];
  const seen = new Set<any>();
  const collected: any[] = [];

  while (queue.length > 0 && collected.length < maxNodes) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (seen.has(current)) {
      continue;
    }

    seen.add(current);
    collected.push(current);

    if (Array.isArray(current)) {
      queue.push(...current);
    } else {
      queue.push(...Object.values(current));
    }
  }

  return collected;
}

function extractKaminoMarketAddresses(payload: any): string[] {
  const objects = collectNestedObjects(payload);
  const marketSet = new Set<string>();

  for (const item of objects) {
    if (!item || Array.isArray(item) || typeof item !== "object") {
      continue;
    }

    const marketCandidates = [
      item?.marketPubkey,
      item?.marketAddress,
      item?.market,
      item?.marketId,
    ];

    for (const candidate of marketCandidates) {
      if (isSolanaAddressLike(candidate)) {
        marketSet.add(String(candidate));
      }
    }

    const hasMarketHint =
      Object.keys(item).some((key) => key.toLowerCase().includes("market")) ||
      String(item?.type || item?.kind || "")
        .toLowerCase()
        .includes("market");

    if (!hasMarketHint) {
      continue;
    }

    const genericCandidates = [item?.pubkey, item?.address, item?.id];
    for (const candidate of genericCandidates) {
      if (isSolanaAddressLike(candidate)) {
        marketSet.add(String(candidate));
      }
    }
  }

  return Array.from(marketSet);
}

function isSolanaAddressLike(value: unknown): boolean {
  return typeof value === "string" && SOLANA_ADDRESS_REGEX.test(value);
}

function dedupeProtocolPositions(positions: TokenInfo[]): TokenInfo[] {
  const byKey = new Map<string, TokenInfo>();

  for (const position of positions) {
    const key = [
      position.type || "",
      position.obligationAddress || "",
      position.vaultAddress || "",
      position.market || "",
      position.symbol || "",
      position.name || "",
    ].join("|");
    const existing = byKey.get(key);
    const candidateValue = position.valueUsd ?? position.balance;
    const existingValue = existing?.valueUsd ?? existing?.balance ?? 0;

    if (!existing || candidateValue > existingValue) {
      byKey.set(key, position);
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => (b.valueUsd ?? b.balance) - (a.valueUsd ?? a.balance)
  );
}

function firstFiniteNumber(values: any[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function firstFiniteSignedNumber(values: any[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function fetchJupiterStakePositions(address: string): Promise<TokenInfo[]> {
  const headers = getJupiterApiHeaders();
  const endpoints = [
    `${JUPITER_PORTFOLIO_API_BASE}/staked-jup/${address}`,
    `https://lite-api.jup.ag/portfolio/v1/staked-jup/${address}`,
    `https://worker.jup.ag/voter/${address}`,
    `https://worker.jup.ag/staking/voter/${address}`,
    `https://api.jup.ag/staking/v1/voter/${address}`,
    `https://lite-api.jup.ag/staking/v1/voter/${address}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers,
        next: { revalidate: 120 },
      });
      if (!response.ok) {
        continue;
      }

      const payload = await readJsonIfPossible(response);
      const stakedRaw = firstFiniteNumber([
        payload?.amount,
        payload?.stakedAmount,
        payload?.stakedJup,
        payload?.stakedJupAmount,
        payload?.depositedAmount,
        payload?.lockedBalance,
        payload?.voter?.amount,
        payload?.voter?.stakedAmount,
        payload?.voter?.stakedJup,
        payload?.voter?.depositedAmount,
        payload?.voter?.lockedBalance,
        payload?.data?.amount,
        payload?.data?.stakedAmount,
        payload?.data?.stakedJup,
        payload?.data?.depositedAmount,
        payload?.data?.voter?.stakedAmount,
        payload?.data?.voter?.stakedJup,
      ]);

      if (stakedRaw <= 0) {
        continue;
      }

      const stakedJup = stakedRaw > 1_000_000 ? stakedRaw / 1e6 : stakedRaw;
      if (!Number.isFinite(stakedJup) || stakedJup <= 0) {
        continue;
      }

      return [
        {
          symbol: "JUP",
          name: "Jupiter Staked JUP",
          balance: stakedJup,
          decimals: 6,
          rawAmount: String(stakedRaw),
          chain: "solana",
          type: "JUP_STAKE",
          source: "jupiter-staking-api",
          positionType: "protocol",
          explorerUrl: "https://vote.jup.ag",
        },
      ];
    } catch {
      // Try next endpoint.
    }
  }

  return [];
}

async function readJsonIfPossible(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseUiAmount(tokenAmount: any): number {
  if (typeof tokenAmount?.uiAmount === "number") {
    return tokenAmount.uiAmount;
  }

  if (typeof tokenAmount?.uiAmountString === "string") {
    const parsed = parseFloat(tokenAmount.uiAmountString);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const decimals = Number(tokenAmount?.decimals || 0);
  const amount = Number(tokenAmount?.amount || 0);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return amount / Math.pow(10, decimals);
}
