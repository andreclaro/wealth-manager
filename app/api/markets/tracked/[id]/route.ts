import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

// DELETE /api/markets/tracked/[id] - Remove a tracked asset
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Verify ownership
    const tracked = await prisma.userMarketAsset.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!tracked) {
      return NextResponse.json(
        { error: "Tracked asset not found" },
        { status: 404 }
      );
    }

    await prisma.userMarketAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error removing tracked asset:", err);
    return NextResponse.json(
      { error: "Failed to remove tracked asset" },
      { status: 500 }
    );
  }
}
