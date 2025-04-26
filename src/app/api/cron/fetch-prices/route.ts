import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrices } from '@/lib/coingecko';
import { evaluateRules } from '@/lib/ruleEvaluator';

// Function to fetch prices and save them to history
async function fetchAndStorePrices() {
  console.log("Cron Job: Fetching and storing prices...");

  // 1. Find all unique assets being tracked by at least one user
  const trackedAssets = await prisma.asset.findMany({
    where: {
      trackedBy: {
        some: {}, // Filter assets that have at least one TrackedAsset entry
      },
    },
    select: {
      id: true,
      coingeckoId: true, 
    },
  });

  if (trackedAssets.length === 0) {
    console.log("Cron Job: No assets are currently being tracked. Skipping price fetch.");
    return { message: "No assets tracked", count: 0 };
  }

  const coingeckoIds = trackedAssets.map(a => a.coingeckoId);
  console.log(`Cron Job: Found ${coingeckoIds.length} unique assets to fetch prices for.`);

  // 2. Fetch current prices from CoinGecko
  const priceData = await getPrices(coingeckoIds);

  // 3. Prepare data for PriceHistory insertion
  const now = new Date(); // Consistent timestamp for this batch
  const priceHistoryEntries = [];

  for (const asset of trackedAssets) {
    const price = priceData[asset.coingeckoId]?.usd;
    if (price !== undefined) {
      priceHistoryEntries.push({
        assetId: asset.id, // Use our internal Asset ID
        price: price,
        timestamp: now,
      });
    }
  }

  if (priceHistoryEntries.length === 0) {
    console.log("Cron Job: Failed to fetch any prices from CoinGecko.");
    // Consider logging which IDs failed if possible from getPrices error handling
    return { message: "No prices fetched", count: 0 };
  }

  // 4. Insert new price history records
  const result = await prisma.priceHistory.createMany({
    data: priceHistoryEntries,
    skipDuplicates: true, // Should not happen with timestamp, but safe to include
  });

  console.log(`Cron Job: Successfully stored ${result.count} price points.`);
  return { message: "Prices stored", count: result.count };
}

// Function to prune old price history
async function pruneOldPriceHistory() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log(`Cron Job: Pruning price history older than ${sevenDaysAgo.toISOString()}...`);

  try {
    const result = await prisma.priceHistory.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo, // Less than 7 days ago
        },
      },
    });
    console.log(`Cron Job: Successfully pruned ${result.count} old price history records.`);
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Cron Job: Error pruning price history:", error);
    return { success: false, count: 0 };
  }
}

// GET /api/cron/fetch-prices
export async function GET(request: Request) {
  // 1. Basic Security Check (Vercel Cron Secret)
  // Recommended: Protect your cron job endpoints
  // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    console.warn("Cron Job: Unauthorized access attempt.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Execute the price fetching, storing, rule evaluation, and pruning
  try {
    const storeResult = await fetchAndStorePrices();

    // Only evaluate rules if new prices were actually stored
    if (storeResult.count > 0) { 
        console.log("Cron Job: New prices stored, evaluating rules...");
        await evaluateRules(); // Just call it, don't expect a return value
        // Logs within evaluateRules and sendNotifications will indicate triggered rules
    }

    // Prune old history after processing
    const pruneResult = await pruneOldPriceHistory();

    // Updated response: Rule evaluation success is now implicit if no error is thrown.
    // We no longer get the count of triggered rules back from evaluateRules.
    return NextResponse.json({
      success: true,
      pricesStored: storeResult.count,
      // rulesEvaluated: evaluationResult.length, // Removed
      evaluationTriggered: storeResult.count > 0, // Indicate if evaluation was attempted
      historyPruned: pruneResult.count,
    });

  } catch (error) {
    console.error("[API/CRON/FETCH-PRICES] Error:", error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 