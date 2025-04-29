import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from 'zod';

// Define schema for the route parameter
const cuidSchema = z.string().cuid({ message: "Invalid Rule ID format." });

// Helper function to verify ownership (could be moved to a lib file)
async function verifyRuleOwnership(ruleId: string, userId: string): Promise<boolean> {
  const rule = await prisma.notificationRule.findUnique({
    where: { id: ruleId },
    include: {
      trackedAsset: true, // Need this to check the userId on the parent
    },
  });

  if (!rule) {
    // Rule not found is treated differently than forbidden
    return false; 
  }

  // Check if the userId on the parent TrackedAsset matches
  if (rule.trackedAsset.userId !== userId) {
    // Throw an error for forbidden access to distinguish from not found
    throw new Error('Forbidden'); 
  }

  return true; // Ownership verified
}

// Schema for PATCH request body validation (only allowing isEnabled toggle for now)
const updateRuleSchema = z.object({
  isEnabled: z.boolean(),
});

// Using the simplified route handler pattern for Next.js App Router
// Without explicit typing for contexts to avoid type issues

export async function PATCH(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any // Use any for context to bypass complex type issues
) {
  const user = await getCurrentUser();
  // const ruleId = context?.params?.ruleId; // Removed

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the ID from route parameters
  const idValidation = cuidSchema.safeParse(context?.params?.ruleId);
  if (!idValidation.success) {
    return NextResponse.json(
      { error: "Invalid Rule ID", details: idValidation.error.flatten() },
      { status: 400 }
    );
  }
  const ruleId = idValidation.data; // Use validated ID

  // Remove redundant manual check
  // if (!ruleId) {
  //   return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
  // }

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationResult = updateRuleSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ error: "Invalid input", details: validationResult.error.flatten() }, { status: 400 });
  }

  const { isEnabled } = validationResult.data;

  try {
    const ruleExistsAndOwned = await verifyRuleOwnership(ruleId, user.id);
    if (!ruleExistsAndOwned) {
         return NextResponse.json({ error: "Notification rule not found" }, { status: 404 });
    }

    // Update the rule
    const updatedRule = await prisma.notificationRule.update({
      where: { id: ruleId },
      data: {
        isEnabled: isEnabled,
      },
    });

    return NextResponse.json(updatedRule);

  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[API/NOTIFICATION_RULES/:ruleId] PATCH Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any // Use any for context
) {
  const user = await getCurrentUser();
  // const ruleId = context?.params?.ruleId; // Removed

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the ID from route parameters
  const idValidation = cuidSchema.safeParse(context?.params?.ruleId);
  if (!idValidation.success) {
    return NextResponse.json(
      { error: "Invalid Rule ID", details: idValidation.error.flatten() },
      { status: 400 }
    );
  }
  const ruleId = idValidation.data; // Use validated ID

  // Remove redundant manual check
  // if (!ruleId) {
  //   return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
  // }

  try {
    const ruleExistsAndOwned = await verifyRuleOwnership(ruleId, user.id);
     if (!ruleExistsAndOwned) {
         return NextResponse.json({ error: "Notification rule not found" }, { status: 404 });
    }

    // Delete the rule
    await prisma.notificationRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ message: "Rule deleted successfully" }, { status: 200 });

  } catch (error) {
     if (error instanceof Error && error.message === 'Forbidden') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[API/NOTIFICATION_RULES/:ruleId] DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any // Use any for context
) {
  const user = await getCurrentUser();
  // const ruleId = context?.params?.ruleId; // Removed

  if (!user || !user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the ID from route parameters
  const idValidation = cuidSchema.safeParse(context?.params?.ruleId);
  if (!idValidation.success) {
    return NextResponse.json(
      { error: "Invalid Rule ID", details: idValidation.error.flatten() },
      { status: 400 }
    );
  }
  const ruleId = idValidation.data; // Use validated ID

  // Remove redundant manual check
  // if (!ruleId) {
  //   return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
  // }

  try {
    const ruleExistsAndOwned = await verifyRuleOwnership(ruleId, user.id);
    if (!ruleExistsAndOwned) {
      return NextResponse.json({ error: "Notification rule not found" }, { status: 404 });
    }

    // Fetch the rule
    const rule = await prisma.notificationRule.findUnique({
      where: { id: ruleId },
      include: {
        trackedAsset: true,
      },
    });

    if (!rule) {
      return NextResponse.json({ error: "Notification rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (e) {
    console.error("[API/NOTIFICATION_RULES/:ruleId] GET Error:", e); // Log error
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 