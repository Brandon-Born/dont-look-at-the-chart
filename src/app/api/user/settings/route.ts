import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Corrected import path
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getBrowserTimeZone } from '@/lib/timezones'; // Import the function

// Basic time validation regex (HH:MM)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validation schema for the request body
const settingsSchema = z.object({
  quietTimeEnabled: z.boolean().optional(),
  quietTimeStart: z.string().regex(timeRegex, { message: 'Invalid start time format. Use HH:MM' }).optional().nullable(),
  quietTimeEnd: z.string().regex(timeRegex, { message: 'Invalid end time format. Use HH:MM' }).optional().nullable(),
  // Optional: Add validation for IANA time zone if needed, could be complex
  quietTimeZone: z.string().optional().nullable(), 
  morningSummaryEnabled: z.boolean().optional(), // Include other settings if needed
}).refine(data => {
    // If quiet time is enabled, start and end times and timezone should ideally be set
    if (data.quietTimeEnabled && (data.quietTimeStart === undefined || data.quietTimeEnd === undefined || data.quietTimeZone === undefined)) {
        // We allow null initially, but you might want stricter validation 
        // depending on UI flow (e.g., require all if enabled)
        // return false;
    }
    // You could add validation that start time is not the same as end time etc.
    return true;
}, { 
    message: "If quiet time is enabled, start time, end time, and time zone are required.", 
    // path: ["quietTimeEnabled"], // Optional: associate error with a specific field
});

// --- GET Handler --- 
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userSettings = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        quietTimeEnabled: true,
        quietTimeStart: true,
        quietTimeEnd: true,
        quietTimeZone: true,
        morningSummaryEnabled: true,
      },
    });

    if (!userSettings) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return the raw settings from the database. 
    // The client will handle nulls/defaults.
    return NextResponse.json(userSettings);

  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// --- Existing PATCH Handler --- 
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = settingsSchema.safeParse(requestBody);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
  }

  const dataToUpdate = validation.data;

  // Ensure nulls are passed correctly if user unsets optional fields
  if (dataToUpdate.quietTimeStart === undefined) delete dataToUpdate.quietTimeStart;
  if (dataToUpdate.quietTimeEnd === undefined) delete dataToUpdate.quietTimeEnd;
  if (dataToUpdate.quietTimeZone === undefined) delete dataToUpdate.quietTimeZone;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      // Pass the validated data directly. Prisma handles nulls correctly.
      data: dataToUpdate,
      // Select only the fields needed by the client to avoid exposing sensitive data
      select: {
        id: true,
        email: true,
        quietTimeEnabled: true,
        quietTimeStart: true,
        quietTimeEnd: true,
        quietTimeZone: true,
        morningSummaryEnabled: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
} 