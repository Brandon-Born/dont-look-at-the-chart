import { NextResponse } from 'next/server';
// import { evaluateRules } from '@/lib/ruleEvaluator'; // Keep import commented out

// Simple route to manually trigger rule evaluation for testing purposes.
// GET /api/test/evaluate

// --- TEMPORARILY DISABLED ---
export async function GET(request: Request) {
  console.log('API Route: /api/test/evaluate accessed but is disabled.');
  return NextResponse.json(
    { message: 'This test endpoint is currently disabled.' },
    { status: 403 } // Return Forbidden status
  );
/* --- Original Logic Below ---
export async function GET(request: Request) {
  console.log('API Route: /api/test/evaluate triggered.');

  try {
    // Call the rule evaluation function
    await evaluateRules();

    console.log('API Route: /api/test/evaluate finished successfully.');
    return NextResponse.json({ message: 'Rule evaluation triggered successfully.' });

  } catch (error) {
    console.error('API Route: /api/test/evaluate encountered an error:', error);
    return NextResponse.json(
      { message: 'Error triggering rule evaluation.', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
*/
} 