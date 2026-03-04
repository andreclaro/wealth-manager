import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { AddressValidationService } from "@/lib/services/addressValidationService";

// GET /api/wallet-addresses/[id] - Get a single wallet address with balances
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const walletAddress = await prisma.walletAddress.findFirst({
      where: {
        id,
        account: { userId },
      },
      include: {
        account: true,
        balances: {
          orderBy: { valueUsd: "desc" },
          include: {
            asset: true,
          },
        },
      },
    });

    if (!walletAddress) {
      return apiError("Wallet address not found", 404);
    }

    return NextResponse.json({
      ...walletAddress,
      explorerUrl: AddressValidationService.getPortfolioExplorerUrl(
        walletAddress.address,
        walletAddress.chainType
      ),
    });
  } catch (err) {
    console.error("Error fetching wallet address:", err);
    return apiError("Failed to fetch wallet address");
  }
}

// PUT /api/wallet-addresses/[id] - Update wallet address
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Verify ownership
    const existingAddress = await prisma.walletAddress.findFirst({
      where: {
        id,
        account: { userId },
      },
    });

    if (!existingAddress) {
      return apiError("Wallet address not found", 404);
    }

    const body = await request.json();
    const { label, syncEnabled } = body;

    const updateData: { label?: string | null; syncEnabled?: boolean } = {};

    if (label !== undefined) {
      updateData.label = label || null;
    }

    if (syncEnabled !== undefined) {
      updateData.syncEnabled = syncEnabled;
    }

    const updatedAddress = await prisma.walletAddress.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updatedAddress,
      explorerUrl: AddressValidationService.getPortfolioExplorerUrl(
        updatedAddress.address,
        updatedAddress.chainType
      ),
    });
  } catch (err) {
    console.error("Error updating wallet address:", err);
    return apiError("Failed to update wallet address");
  }
}

// DELETE /api/wallet-addresses/[id] - Delete wallet address and associated assets
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Verify ownership and get related data
    const existingAddress = await prisma.walletAddress.findFirst({
      where: {
        id,
        account: { userId },
      },
      include: {
        balances: {
          include: {
            asset: true,
          },
        },
      },
    });

    if (!existingAddress) {
      return apiError("Wallet address not found", 404);
    }

    // Collect asset IDs that were created from this wallet and are not linked to other wallets
    const assetIdsToCheck = existingAddress.balances
      .filter(b => b.asset && b.asset.source === "WALLET_SYNC")
      .map(b => b.asset!.id);

    await prisma.$transaction(async (tx) => {
      // 1. Delete wallet balances
      await tx.walletBalance.deleteMany({
        where: { walletAddressId: id },
      });

      // 2. Delete the wallet address
      await tx.walletAddress.delete({
        where: { id },
      });

      // 3. For each asset created from this wallet, check if it's linked to other wallet balances
      for (const assetId of assetIdsToCheck) {
        const otherBalances = await tx.walletBalance.findFirst({
          where: { assetId },
        });

        // If no other wallet balances link to this asset, delete it
        if (!otherBalances) {
          await tx.priceHistory.deleteMany({
            where: { assetId },
          });
          await tx.asset.delete({
            where: { id: assetId },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting wallet address:", err);
    return apiError("Failed to delete wallet address");
  }
}
