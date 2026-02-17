import { NextRequest, NextResponse } from "next/server";
import { fetchAssetName } from "@/lib/services/priceService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const type = searchParams.get("type");

    if (!symbol || !type) {
      return NextResponse.json(
        { error: "Symbol and type are required" },
        { status: 400 }
      );
    }

    const name = await fetchAssetName(symbol, type);

    // Return 200 with null name when API isn't configured or symbol not found
    // Client can fall back to manual name entry
    return NextResponse.json({ name: name ?? null });
  } catch (error) {
    console.error("Error looking up asset:", error);
    return NextResponse.json(
      { error: "Failed to lookup asset" },
      { status: 500 }
    );
  }
}
