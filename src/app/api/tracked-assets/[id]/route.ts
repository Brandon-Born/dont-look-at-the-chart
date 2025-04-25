import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: {
      id: string; // This corresponds to the [id] in the folder name
    }
}

// DELETE /api/tracked-assets/[id] - Remove an asset from the user's tracked list
export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const trackedAssetId = params.id;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!trackedAssetId) {
    return NextResponse.json({ error: "Tracked Asset ID is required" }, { status: 400 });
  }

  try {
    // Verify the tracked asset exists and belongs to the current user before deleting
    const trackedAsset = await prisma.trackedAsset.findUnique({
      where: {
        id: trackedAssetId,
      },
    });

    if (!trackedAsset) {
        return NextResponse.json({ error: "Tracked asset not found" }, { status: 404 });
    }

    // Check ownership
    if (trackedAsset.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden - Asset does not belong to user" }, { status: 403 });
    }

    // Delete the tracked asset
    await prisma.trackedAsset.delete({
      where: {
        id: trackedAssetId,
        // Optionally include userId again for extra safety, though covered by check above
        // userId: user.id, 
      },
    });

    return NextResponse.json({ message: "Tracked asset removed successfully" }, { status: 200 });

  } catch (error) {
    console.error(`[API/TRACKED_ASSETS/[id]] DELETE Error (ID: ${trackedAssetId}):`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 