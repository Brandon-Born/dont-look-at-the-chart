import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from 'zod'; // Import Zod
// import { Prisma } from '@prisma/client'; // Unused

// Define Zod schema for the POST request body
const addTrackedAssetSchema = z.object({
  coingeckoId: z.string().min(1, { message: "CoinGecko ID is required" }),
  symbol: z.string().min(1, { message: "Symbol is required" }),
  name: z.string().min(1, { message: "Name is required" }),
});

// GET /api/tracked-assets - Fetch assets tracked by the current user
export async function GET() {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trackedAssets = await prisma.trackedAsset.findMany({
      where: {
        userId: user.id,
      },
      include: {
        asset: true, // Include the details of the tracked asset (name, symbol)
        _count: { // Include the count of related rules
          select: { notificationRules: true },
        },
      },
      orderBy: {
        asset: {
            name: 'asc', // Order alphabetically by asset name
        }
      }
    });

    // We might want to fetch current prices here too eventually, 
    // but for now, just return the tracked assets structure.
    return NextResponse.json(trackedAssets);

  } catch (error) {
    console.error("[API/TRACKED_ASSETS] GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tracked-assets - Add an asset for the current user to track
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate the request body using Zod
  const validationResult = addTrackedAssetSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid input", details: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  // Use the validated data
  const coinData = validationResult.data;

  try {
    // 1. Ensure the Asset exists in our database (create if not)
    const asset = await prisma.asset.upsert({
      where: { coingeckoId: coinData.coingeckoId },
      update: {
        // Update symbol/name if they somehow changed on CoinGecko
        symbol: coinData.symbol,
        name: coinData.name,
       },
      create: {
        coingeckoId: coinData.coingeckoId,
        symbol: coinData.symbol,
        name: coinData.name,
      },
    });

    // 2. Create the link between the User and the Asset
    const newTrackedAsset = await prisma.trackedAsset.create({
      data: {
        userId: user.id,
        assetId: asset.id,
      },
      include: {
        asset: true // Return the created record with asset details
      }
    });

    return NextResponse.json(newTrackedAsset, { status: 201 }); // 201 Created

  } catch (error) {
    // Check if the error object has a 'code' property matching P2002
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') { 
      return NextResponse.json({ error: "Asset already tracked" }, { status: 409 }); // 409 Conflict
    }
    console.error("[API/TRACKED_ASSETS] POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 