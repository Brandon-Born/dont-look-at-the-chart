import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Corrected import path
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Basic time validation regex (HH:MM)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validation schema for the request body
const settingsSchema = z.object({
  quietTimeEnabled: z.boolean().optional(),
  quietTimeStart: z.string().regex(timeRegex, { message: 'Invalid start time format. Use HH:MM' }).optional().nullable(),
  quietTimeEnd: z.string().regex(timeRegex, { message: 'Invalid end time format. Use HH:MM' }).optional().nullable(),
  quietTimeZone: z.string().optional().nullable(),
  morningSummaryEnabled: z.boolean().optional(),
}).refine(data => {
    if (data.quietTimeEnabled && (data.quietTimeStart === undefined || data.quietTimeEnd === undefined || data.quietTimeZone === undefined)) {
      // Depending on UI, might enforce required fields if enabled
    }
    return true;
}, { 
    message: "If quiet time is enabled, start time, end time, and time zone are required.", 
});

// --- GET Handler --- 
export async function GET() {
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
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = settingsSchema.safeParse(requestBody);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
  }

  const dataToUpdate = validation.data;

  if (dataToUpdate.quietTimeStart === undefined) delete dataToUpdate.quietTimeStart;
  if (dataToUpdate.quietTimeEnd === undefined) delete dataToUpdate.quietTimeEnd;
  if (dataToUpdate.quietTimeZone === undefined) delete dataToUpdate.quietTimeZone;
  // Ensure morningSummaryEnabled is deleted if not provided, to avoid setting it to undefined
  if (dataToUpdate.morningSummaryEnabled === undefined) delete dataToUpdate.morningSummaryEnabled;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: dataToUpdate,
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