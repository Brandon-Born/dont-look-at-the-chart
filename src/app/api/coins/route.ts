import { NextResponse } from "next/server";

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const API_KEY = process.env.COINGECKO_API_KEY; // Optional

// Interface for the relevant fields from /coins/markets response
interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  // other fields like image, current_price, market_cap are available but ignored here
}

// Interface for the expected output format (compatible with frontend)
export interface SimpleCoin {
  id: string;
  symbol: string;
  name: string;
}

// Basic in-memory cache
let cachedCoins: SimpleCoin[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // Cache for 1 hour
const RESULTS_PER_PAGE = 250;
const PAGES_TO_FETCH = 4; // Fetch top 1000 (4 * 250)

async function fetchMarketCoinsPage(page: number): Promise<MarketCoin[]> {
  const url = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${RESULTS_PER_PAGE}&page=${page}&sparkline=false&locale=en`;
  const options = API_KEY ? { headers: { 'x-cg-demo-api-key': API_KEY } } : {};
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`CoinGecko API Error (Page ${page}): ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function GET(request: Request) {
  const now = Date.now();

  // Check cache first
  if (cachedCoins && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
    return NextResponse.json(cachedCoins);
  }

  try {
    // Fetch all pages in parallel
    const pagePromises: Promise<MarketCoin[]>[] = [];
    for (let i = 1; i <= PAGES_TO_FETCH; i++) {
      pagePromises.push(fetchMarketCoinsPage(i));
    }
    const pagesResults = await Promise.all(pagePromises);

    // Combine results and extract needed fields
    const allMarketCoins = pagesResults.flat(); // Flatten array of arrays
    const simplifiedCoins: SimpleCoin[] = allMarketCoins.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
    }));

    if (simplifiedCoins.length === 0) {
       // If CoinGecko fails, return previous cache if available but stale
        if (cachedCoins) {
            console.warn("CoinGecko market fetch failed, returning stale cache.");
            return NextResponse.json(cachedCoins);
        }
      return NextResponse.json({ error: "Failed to fetch coin market data from CoinGecko." }, { status: 502 });
    }

    // Update cache
    cachedCoins = simplifiedCoins;
    cacheTimestamp = now;

    return NextResponse.json(simplifiedCoins);

  } catch (error) {
    console.error("[API/COINS] Error fetching coin market data:", error);
    // Return stale cache on error if available
    if (cachedCoins) {
        console.warn("CoinGecko market fetch failed, returning stale cache.");
        return NextResponse.json(cachedCoins);
    }
    return NextResponse.json({ error: "Internal server error fetching coin market data." }, { status: 500 });
  }
}

// Optional: Force revalidation
// export const revalidate = 3600; // Revalidate every hour 