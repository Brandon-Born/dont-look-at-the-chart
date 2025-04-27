import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Zod schema for validating the incoming request body for updates
const updateMorningSummarySettingsSchema = z.object({
  morningSummaryEnabled: z.boolean().optional(),
  morningSummaryTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM").optional(),
  // We don't update timezone here, it's part of the quiet time settings
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          morningSummaryEnabled: true,
          morningSummaryTime: true,
          quietTimeZone: true, // Include timezone for context on the frontend
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching morning summary settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  } else if (req.method === 'POST') {
    try {
      const validationResult = updateMorningSummarySettingsSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ error: 'Invalid input data', details: validationResult.error.errors });
      }

      const { morningSummaryEnabled, morningSummaryTime } = validationResult.data;

      // Construct update data, only including fields that were provided
      // Allow null for morningSummaryTime based on Prisma schema
      const dataToUpdate: { morningSummaryEnabled?: boolean; morningSummaryTime?: string | null } = {};
      if (morningSummaryEnabled !== undefined) {
        dataToUpdate.morningSummaryEnabled = morningSummaryEnabled;
      }
      if (morningSummaryTime !== undefined) {
         // Ensure null is saved if empty string or null is passed, otherwise save the time
         dataToUpdate.morningSummaryTime = morningSummaryTime || null;
      }

       if (Object.keys(dataToUpdate).length === 0) {
         return res.status(400).json({ error: 'No valid fields provided for update.' });
      }


      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: { // Return the updated values
          morningSummaryEnabled: true,
          morningSummaryTime: true,
        },
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating morning summary settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 