import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

// DELETE /api/history/:id - Delete a price history entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Find the history entry and verify it belongs to the user's asset
    const historyEntry = await prisma.priceHistory.findFirst({
      where: {
        id,
        asset: {
          account: {
            userId,
          },
        },
      },
      include: {
        asset: true,
      },
    });

    if (!historyEntry) {
      return NextResponse.json(
        { error: "History entry not found" },
        { status: 404 }
      );
    }

    // Check if this is the only history entry for the asset
    const historyCount = await prisma.priceHistory.count({
      where: {
        assetId: historyEntry.assetId,
      },
    });

    if (historyCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only history record for an asset" },
        { status: 400 }
      );
    }

    // Delete the history entry
    await prisma.priceHistory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting history entry:", error);
    return NextResponse.json(
      { error: "Failed to delete history entry" },
      { status: 500 }
    );
  }
}
