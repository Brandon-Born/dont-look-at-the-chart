import { prisma } from '@/lib/prisma';
import { generateMorningSummaryForUser } from './morningSummaryGenerator';
import { sendMorningSummaryEmail } from './emailSender';
import { Prisma } from '@prisma/client';
import { getHours } from 'date-fns';
import { toZonedTime, format } from 'date-fns-tz';

// Define a type for the user object structure we expect from the query
type UserForSummary = Prisma.UserGetPayload<{
  select: {
    id: true,
    email: true,
    morningSummaryTime: true,
    quietTimeZone: true,
  }
}>

/**
 * Finds users scheduled to receive their morning summary at the current hour 
 * (considering their timezone and preferred time) and triggers sending.
 * 
 * This function is designed to be called hourly by a cron job.
 */
export async function sendScheduledSummaries(): Promise<void> {
    console.log('Scheduler: Starting check for scheduled morning summaries...');

    const nowUtc = new Date();
    // We don't need the UTC hour directly anymore
    // const currentUtcHour = getHours(nowUtc); 

    console.log(`Scheduler: Current UTC time is ${format(nowUtc, 'yyyy-MM-dd HH:mm:ss XXX')}.`);

    try {
        // 1. Find users eligible for summary NOW
        const usersToSend: UserForSummary[] = await prisma.user.findMany({
            where: {
                morningSummaryEnabled: true,
                morningSummaryTime: { not: null }, // Keep null here as it likely works for DateTime?
                quietTimeZone: { not: null },    // Keep null here as it likely works for String?
                email: { not: undefined }       // Change to undefined for String field based on linter error
            },
            select: {
                id: true,
                email: true,
                morningSummaryTime: true,
                quietTimeZone: true,
            },
        });

        console.log(`Scheduler: Found ${usersToSend.length} users potentially eligible for summary.`);

        const usersDueNow: UserForSummary[] = [];

        // 2. Filter users based on their preferred time in their local timezone
        for (const user of usersToSend) {
            // The initial check below combined with the Prisma query should guarantee non-null values.
            // We use non-null assertions (!) where needed to inform TypeScript.
            if (!user.morningSummaryTime || !user.quietTimeZone || !user.email) { 
                console.warn(`Scheduler: Skipping user ${user.id} due to missing required fields (initial check).`);
                continue;
            }
            
            try {
                // Convert current UTC time to user's local timezone
                // Use non-null assertion as TS doesn't infer from the above check/query alone.
                const nowInUserTz = toZonedTime(nowUtc, user.quietTimeZone!); 
                const currentHourInUserTz = getHours(nowInUserTz);

                // Get user's preferred hour (integer)
                // Use non-null assertion here as well.
                const preferredHour = parseInt(user.morningSummaryTime!.split(':')[0], 10);

                // Log the comparison
                console.log(`Scheduler: User ${user.id} (${user.email}), TimeZone: ${user.quietTimeZone}, CurrentLocalHour: ${currentHourInUserTz}, PreferredLocalHour: ${preferredHour}`);

                // Check if the current hour in the user's timezone matches their preferred hour
                if (currentHourInUserTz === preferredHour) {
                    usersDueNow.push(user);
                }
            } catch (timeError) {
                 console.error(`Scheduler: Error processing time for user ${user.id} (${user.email}) with timezone ${user.quietTimeZone} and time ${user.morningSummaryTime}:`, timeError);
            }
        }

        console.log(`Scheduler: Found ${usersDueNow.length} users whose summary time matches the current hour in their timezone.`);

        // 3. Generate and send summaries for users due now
        for (const user of usersDueNow) {
             // Added null check again for TS safety, though filtered above
            if (!user.email) continue; 
            
            console.log(`Scheduler: Processing summary for user ${user.id} (${user.email}).`);
            try {
                const summaryData = await generateMorningSummaryForUser(user.id);
                if (summaryData.length > 0) {
                    await sendMorningSummaryEmail(user.email, summaryData);
                } else {
                    console.log(`Scheduler: No summary data generated for user ${user.id}. Skipping email.`);
                }
            } catch (error) {
                console.error(`Scheduler: Failed to generate or send summary for user ${user.id}:`, error);
                // Continue to next user even if one fails
            }
        }

        console.log('Scheduler: Finished checking for scheduled morning summaries.');

    } catch (error) {
        console.error('Scheduler: Error fetching users for morning summaries:', error);
    }
} 