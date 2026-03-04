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

// DELETE /api/wallet-addresses/[id] - Delete wallet address
export async function DELETE(
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

    await prisma.walletAddress.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting wallet address:", err);
    return apiError("Failed to delete wallet address");
  }
}
