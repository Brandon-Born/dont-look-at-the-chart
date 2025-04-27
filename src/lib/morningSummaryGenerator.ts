import { prisma } from '@/lib/prisma';
import { subHours } from 'date-fns';

export interface AssetSummaryData {
  symbol: string;
  name: string;
  currentPrice: number | null;
  price24hAgo: number | null;
  changePercent24h: number | null;
}

/**
 * Generates the data needed for a morning summary email for a specific user.
 * Calculates the 24-hour price change for each tracked asset.
 * @param userId The ID of the user to generate the summary for.
 * @returns {Promise<AssetSummaryData[]>} An array of summary data for each tracked asset.
 */
export async function generateMorningSummaryForUser(userId: string): Promise<AssetSummaryData[]> {
  console.log(`Generating morning summary data for user: ${userId}`);
  const summaryResults: AssetSummaryData[] = [];

  try {
    // 1. Get user's tracked assets
    const trackedAssets = await prisma.trackedAsset.findMany({
      where: { userId: userId },
      include: {
        asset: true, // Include asset details (symbol, name)
      },
    });

    if (trackedAssets.length === 0) {
      console.log(`User ${userId} has no tracked assets. Skipping summary generation.`);
      return [];
    }

    const assetIds = trackedAssets.map(ta => ta.assetId);
    const now = new Date();
    const time24hAgo = subHours(now, 24);

    // 2. Get latest price for each asset
    const latestPrices = await prisma.priceHistory.findMany({
      where: {
        assetId: { in: assetIds },
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['assetId'],
    });
    const latestPricesMap = new Map(latestPrices.map(p => [p.assetId, p]));

    // 3. Get price from ~24 hours ago for each asset
    // For each asset, find the *first* price recorded *after* 24 hours ago.
    // This is a reasonable approximation for the price 24h ago.
    const prices24hAgo = await prisma.priceHistory.findMany({
        where: {
            assetId: { in: assetIds },
            timestamp: { gte: time24hAgo } // Price recorded >= 24h ago
        },
        orderBy: [
            { assetId: 'asc' }, // Group by asset
            { timestamp: 'asc' } // Get the earliest timestamp first within each group
        ],
        distinct: ['assetId'] // Get only the first record per asset meeting the criteria
    });
    const prices24hAgoMap = new Map(prices24hAgo.map(p => [p.assetId, p]));


    // 4. Calculate changes and format results
    for (const ta of trackedAssets) {
      const latestPrice = latestPricesMap.get(ta.assetId);
      const price24hAgo = prices24hAgoMap.get(ta.assetId);

      let changePercent: number | null = null;
      if (latestPrice && price24hAgo && price24hAgo.price !== 0) {
        const priceDiff = latestPrice.price - price24hAgo.price;
        changePercent = (priceDiff / price24hAgo.price) * 100;
      }

      summaryResults.push({
        symbol: ta.asset.symbol.toUpperCase(),
        name: ta.asset.name,
        currentPrice: latestPrice?.price ?? null,
        price24hAgo: price24hAgo?.price ?? null,
        changePercent24h: changePercent,
      });
    }

    console.log(`Successfully generated summary data for ${summaryResults.length} assets for user ${userId}.`);

  } catch (error) {
    console.error(`Error generating morning summary for user ${userId}:`, error);
    // Return empty array or re-throw depending on desired error handling
    return [];
  }

  return summaryResults;
} 