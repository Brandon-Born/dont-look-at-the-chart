// import { env } from '@/env.mjs'; // Assuming we'll use T3 Env for env validation later

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
// Although the demo key is public, good practice to use env var if available
const API_KEY = process.env.COINGECKO_API_KEY; // Optional: Get a free demo key from CoinGecko

// Interface for the coin list response
export interface Coin { 
  id: string;
  symbol: string;
  name: string;
}

// Interface for the simple price response
// e.g., { "bitcoin": { "usd": 65000.12 } }
export interface PriceData {
  [coinId: string]: {
    [currency: string]: number;
  };
}

/**
 * Fetches the list of all supported cryptocurrencies from CoinGecko.
 * @returns {Promise<Coin[]>}
 */
export async function getCoinsList(): Promise<Coin[]> {
  const url = `${COINGECKO_API_BASE_URL}/coins/list?include_platform=false`;
  const options = API_KEY ? { headers: { 'x-cg-demo-api-key': API_KEY } } : {};

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`CoinGecko API Error: ${response.status} ${response.statusText}`);
    }
    const data: Coin[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching CoinGecko coin list:", error);
    // Return empty array or re-throw depending on desired error handling
    return []; 
  }
}

/**
 * Fetches the current price for a list of specified coin IDs in USD.
 * @param {string[]} coinIds - Array of CoinGecko coin IDs (e.g., ["bitcoin", "ethereum"])
 * @returns {Promise<PriceData>}
 */
export async function getPrices(coinIds: string[]): Promise<PriceData> {
  if (!coinIds || coinIds.length === 0) {
    return {};
  }

  const idsParam = coinIds.join(',');
  const url = `${COINGECKO_API_BASE_URL}/simple/price?ids=${idsParam}&vs_currencies=usd`;
  const options = API_KEY ? { headers: { 'x-cg-demo-api-key': API_KEY } } : {};

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      // Handle potential 404 if an ID is invalid, though CoinGecko often just omits it
      if (response.status === 404) {
         console.warn(`CoinGecko price fetch returned 404, possibly invalid IDs: ${coinIds.join(', ')}`);
         // Attempt to parse potentially partial data if possible, or return empty
         try { return await response.json(); } catch { return {}; }
      }
      throw new Error(`CoinGecko API Error: ${response.status} ${response.statusText}`);
    }
    const data: PriceData = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching CoinGecko prices for IDs [${coinIds.join(', ')}]:`, error);
    return {}; // Return empty object on error
  }
}

// Example usage (can be tested in an API route or server component):
/*
async function testCoinGecko() {
  // const coins = await getCoinsList();
  // console.log("First 5 Coins:", coins.slice(0, 5));

  const prices = await getPrices(["bitcoin", "ethereum", "invalid-coin-id"]);
  console.log("Prices:", prices);
}
*/ 