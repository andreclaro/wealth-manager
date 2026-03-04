import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { walletSyncService } from "@/lib/services/walletSyncService";

// POST /api/wallet-addresses/[id]/sync - Trigger sync for a wallet address
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Verify ownership
    const walletAddress = await prisma.walletAddress.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!walletAddress) {
      return apiError("Wallet address not found", 404);
    }

    if (!walletAddress.syncEnabled) {
      return apiError("Sync is disabled for this wallet address", 400);
    }

    // Trigger sync
    const result = await walletSyncService.syncWalletAddress(id);

    if (!result.success) {
      return apiError(
        result.errors?.join("; ") || "Sync failed",
        500
      );
    }

    // Fetch updated balances
    const updatedBalances = await prisma.walletBalance.findMany({
      where: { walletAddressId: id },
      orderBy: { valueUsd: "desc" },
      include: {
        asset: true,
      },
    });

    return NextResponse.json({
      success: true,
      tokensSynced: result.tokensSynced,
      newAssetsCreated: result.newAssetsCreated,
      balances: updatedBalances,
      lastSyncedAt: new Date(),
    });
  } catch (err) {
    console.error("Error syncing wallet address:", err);
    return apiError("Failed to sync wallet address");
  }
}
