import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { walletSyncService } from "@/lib/services/walletSyncService";

// POST /api/accounts/[id]/sync-wallets - Sync all wallet addresses for an account
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Verify account ownership
    const account = await prisma.portfolioAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return apiError("Account not found", 404);
    }

    // Sync all wallets for this account
    const result = await walletSyncService.syncAccountWallets(id);

    return NextResponse.json({
      success: true,
      totalWallets: result.totalWallets,
      successful: result.successful,
      failed: result.failed,
      details: result.results,
    });
  } catch (err) {
    console.error("Error syncing account wallets:", err);
    return apiError("Failed to sync account wallets");
  }
}
