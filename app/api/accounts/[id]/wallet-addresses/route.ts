import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { AddressValidationService } from "@/lib/services/addressValidationService";
import { walletSyncService } from "@/lib/services/walletSyncService";

// GET /api/accounts/[id]/wallet-addresses - List wallet addresses for an account
export async function GET(
  request: NextRequest,
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

    const walletAddresses = await prisma.walletAddress.findMany({
      where: { accountId: id },
      include: {
        balances: {
          orderBy: { valueUsd: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Add explorer URLs
    const addressesWithUrls = walletAddresses.map((wa) => ({
      ...wa,
      explorerUrl: AddressValidationService.getPortfolioExplorerUrl(
        wa.address,
        wa.chainType
      ),
    }));

    return NextResponse.json(addressesWithUrls);
  } catch (err) {
    console.error("Error fetching wallet addresses:", err);
    return apiError("Failed to fetch wallet addresses");
  }
}

// POST /api/accounts/[id]/wallet-addresses - Add a new wallet address
export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const {
      chainType,
      address,
      evmChainId,
      isPChain,
      label,
      syncEnabled = true,
    } = body;

    // Validation
    if (!chainType || !address) {
      return apiError("Chain type and address are required", 400);
    }

    if (!["EVM", "SOLANA"].includes(chainType)) {
      return apiError("Invalid chain type. Must be EVM or SOLANA", 400);
    }

    // Validate address format
    const isValidAddress = AddressValidationService.validateAddress(
      address,
      chainType
    );
    if (!isValidAddress) {
      return apiError(`Invalid ${chainType} address format`, 400);
    }

    // Check for duplicate address in this account
    const existingAddress = await prisma.walletAddress.findFirst({
      where: {
        accountId: id,
        chainType,
        address: address.trim(),
      },
    });

    if (existingAddress) {
      return apiError("This address is already added to this account", 409);
    }

    // Normalize P-Chain address if applicable
    let normalizedAddress = address.trim();
    if (chainType === "EVM" && AddressValidationService.isPChainAddress(address)) {
      const normalized = AddressValidationService.normalizePChainAddress(address);
      if (normalized) {
        normalizedAddress = normalized;
      }
    }

    // Create wallet address
    const walletAddress = await prisma.walletAddress.create({
      data: {
        accountId: id,
        chainType,
        address: normalizedAddress,
        evmChainId: evmChainId ? parseInt(evmChainId) : null,
        isPChain: isPChain || false,
        label: label || null,
        syncEnabled,
      },
    });

    // Trigger initial sync
    if (syncEnabled) {
      // Run sync in background, don't wait for it
      walletSyncService.syncWalletAddress(walletAddress.id).catch((err) => {
        console.error("Initial sync failed:", err);
      });
    }

    return NextResponse.json(
      {
        ...walletAddress,
        explorerUrl: AddressValidationService.getPortfolioExplorerUrl(
          walletAddress.address,
          walletAddress.chainType
        ),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating wallet address:", err);
    return apiError("Failed to create wallet address");
  }
}
