import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from 'zod';
import { NotificationRuleType } from "@prisma/client";

// Schema for POST request body validation
const createRuleSchema = z.object({
  trackedAssetId: z.string().cuid(),
  type: z.nativeEnum(NotificationRuleType),
  value: z.number(),
  timeWindowHours: z.number().int().min(1).max(72).optional(), // Optional, but validated if present
}).refine((data: { type: NotificationRuleType, timeWindowHours?: number | null }) => {
    // Require timeWindowHours for percent change types
    const isPercentChange = data.type === NotificationRuleType.PERCENT_CHANGE_INCREASE || data.type === NotificationRuleType.PERCENT_CHANGE_DECREASE;
    return !isPercentChange || (isPercentChange && typeof data.timeWindowHours === 'number');
  }, {
    message: "timeWindowHours is required for percentage change rule types",
    path: ["timeWindowHours"], // Field responsible for the error
});

// GET /api/notification-rules?trackedAssetId={id} - Fetch rules for a specific tracked asset
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trackedAssetId = request.nextUrl.searchParams.get('trackedAssetId');
  if (!trackedAssetId) {
    return NextResponse.json({ error: "trackedAssetId query parameter is required" }, { status: 400 });
  }

  try {
    // Verify user owns the parent TrackedAsset before fetching rules
    const trackedAsset = await prisma.trackedAsset.findUnique({
      where: { id: trackedAssetId },
    });

    if (!trackedAsset) {
      return NextResponse.json({ error: "Tracked asset not found" }, { status: 404 });
    }
    if (trackedAsset.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch rules for the verified trackedAssetId
    const rules = await prisma.notificationRule.findMany({
      where: {
        trackedAssetId: trackedAssetId,
      },
      orderBy: {
        createdAt: 'asc', // Or order by type, value etc.
      }
    });

    return NextResponse.json(rules);

  } catch (error) {
    console.error("[API/NOTIFICATION_RULES] GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/notification-rules - Create a new rule for a tracked asset
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationResult = createRuleSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ error: "Invalid input", details: validationResult.error.flatten() }, { status: 400 });
  }

  const { trackedAssetId, type, value, timeWindowHours } = validationResult.data;

  try {
    // Verify user owns the parent TrackedAsset before creating rule
    const trackedAsset = await prisma.trackedAsset.findUnique({
      where: { id: trackedAssetId },
    });

    if (!trackedAsset) {
      return NextResponse.json({ error: "Tracked asset not found" }, { status: 404 });
    }
    if (trackedAsset.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create the rule
    const newRule = await prisma.notificationRule.create({
      data: {
        trackedAssetId: trackedAssetId,
        type: type,
        value: value,
        timeWindowHours: timeWindowHours, // Will be null/undefined if not applicable
        isEnabled: true, // Default
      },
    });

    return NextResponse.json(newRule, { status: 201 });

  } catch (error: any) {
    // Could add checks for other specific errors if needed
    console.error("[API/NOTIFICATION_RULES] POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 