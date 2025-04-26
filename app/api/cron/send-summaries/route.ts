import { NextResponse } from 'next/server';
import { sendScheduledSummaries } from '@/lib/morningSummaryScheduler';

export const dynamic = 'force-dynamic'; // Ensure the function runs dynamically

export async function GET(request: Request) {
    console.log("API Route: /api/cron/send-summaries called");

    // 1. Authorization Check
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET) {
        console.error("API Route Error: CRON_SECRET environment variable is not set.");
        // In production, you should definitely require a secret
        // For local development, you might temporarily allow access without it, but log a strong warning.
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
        }
        console.warn("API Route Warning: Running without CRON_SECRET check in non-production environment.");
    } else if (!authHeader || authHeader !== expectedToken) {
        console.warn("API Route Warning: Unauthorized access attempt to /api/cron/send-summaries");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Execute the Scheduler
    try {
        console.log("API Route: Authorization successful (or bypassed in dev). Triggering sendScheduledSummaries...");
        await sendScheduledSummaries();
        console.log("API Route: sendScheduledSummaries finished successfully.");
        return NextResponse.json({ success: true, message: 'Scheduled summaries check completed.' });
    } catch (error) {
        console.error("API Route Error: Failed to execute sendScheduledSummaries:", error);
        return NextResponse.json({ error: 'Failed to execute scheduled summaries function.', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
} 