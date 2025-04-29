import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from 'zod'; // Import Zod

// Define schema for the route parameter
const cuidSchema = z.string().cuid({ message: "Invalid ID format." });

// DELETE /api/tracked-assets/[id] - Remove an asset from the user's tracked list
export async function DELETE(
  request: Request, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any // Use any for context to bypass complex type issues
) {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the ID from route parameters
  const idValidation = cuidSchema.safeParse(context?.params?.id);
  if (!idValidation.success) {
    return NextResponse.json(
      { error: "Invalid Tracked Asset ID", details: idValidation.error.flatten() },
      { status: 400 }
    );
  }
  const trackedAssetId = idValidation.data;

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