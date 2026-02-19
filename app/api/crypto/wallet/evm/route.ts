import { NextRequest, NextResponse } from "next/server";

const BLOCKSCOUT_ENDPOINTS: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  polygon: "https://polygon.blockscout.com",
  base: "https://base.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  optimism: "https://optimism.blockscout.com",
  bsc: "https://bsc.blockscout.com",
  gnosis: "https://gnosis.blockscout.com",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const chain = searchParams.get("chain") || "ethereum";

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  // Validate address format (basic EVM check)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid EVM wallet address format" },
      { status: 400 }
    );
  }

  const endpoint = BLOCKSCOUT_ENDPOINTS[chain];
  if (!endpoint) {
    return NextResponse.json(
      { error: `Unsupported chain: ${chain}`, supportedChains: Object.keys(BLOCKSCOUT_ENDPOINTS) },
      { status: 400 }
    );
  }

  try {
    // Fetch native balance
    const nativeBalanceRes = await fetch(
      `${endpoint}/api?module=account&action=balance&address=${address}`
    );
    const nativeBalanceData = await nativeBalanceRes.json();

    // Fetch token list (this returns all tokens with non-zero balance)
    const tokensRes = await fetch(
      `${endpoint}/api?module=account&action=tokenlist&address=${address}`
    );
    
    if (!tokensRes.ok) {
      throw new Error(`Blockscout API error: ${tokensRes.status}`);
    }
    
    const tokensData = await tokensRes.json();

    // Get chain native token symbol
    const nativeSymbols: Record<string, string> = {
      ethereum: "ETH",
      polygon: "MATIC",
      base: "ETH",
      arbitrum: "ETH",
      optimism: "ETH",
      bsc: "BNB",
      gnosis: "xDAI",
    };

    const nativeSymbol = nativeSymbols[chain] || "ETH";
    const nativeDecimals = 18;
    const nativeBalance = nativeBalanceData.result 
      ? parseInt(nativeBalanceData.result) / Math.pow(10, nativeDecimals)
      : 0;

    // Format tokens - filter for tokens with actual balance
    const tokens = (tokensData.result || [])
      .filter((item: any) => {
        // Only include tokens with non-zero balance
        const balance = parseFloat(item.balance || "0");
        return balance > 0;
      })
      .map((item: any) => {
        const decimals = parseInt(item.decimals || "18");
        const rawBalance = item.balance || "0";
        const balance = parseFloat(rawBalance) / Math.pow(10, decimals);
        
        return {
          contractAddress: item.contractAddress,
          symbol: item.symbol || "UNKNOWN",
          name: item.name || "Unknown Token",
          decimals: decimals,
          balance: balance,
          type: item.type || "ERC-20",
        };
      })
      .sort((a: any, b: any) => b.balance - a.balance)
      .slice(0, 100); // Limit to top 100 tokens by balance

    const result = {
      address,
      chain,
      nativeBalance: {
        symbol: nativeSymbol,
        balance: nativeBalance,
        decimals: nativeDecimals,
      },
      tokens,
      tokenCount: tokens.length,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching EVM wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data", details: (error as Error).message },
      { status: 500 }
    );
  }
}
