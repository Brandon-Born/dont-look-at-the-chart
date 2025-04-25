'use client'

import React, { useState, useEffect } from 'react'
import type { Coin } from '@/lib/coingecko'
import { useDebounce } from '@/hooks/useDebounce'

interface AssetSearchProps {
  onAssetAdded: () => void; // Callback to notify parent when an asset is added
}

export default function AssetSearch({ onAssetAdded }: AssetSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allCoins, setAllCoins] = useState<Coin[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<Coin[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Loading state for coin list fetch
  const [isAdding, setIsAdding] = useState<string | null>(null); // Track which coin is being added
  const [error, setError] = useState<string | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch all coins
  useEffect(() => {
    const fetchCoins = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/coins');
        if (!response.ok) {
          throw new Error('Failed to fetch coin list');
        }
        const data: Coin[] = await response.json();
        setAllCoins(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error("Error fetching coins:", err);
      }
      setIsLoading(false);
    };
    fetchCoins();
  }, []);

  // Filter coins
  useEffect(() => {
    if (!debouncedSearchTerm) {
      setFilteredCoins([]);
      return;
    }
    if (allCoins.length > 0) {
      const lowerCaseTerm = debouncedSearchTerm.toLowerCase();
      const results = allCoins.filter(coin => 
        coin.name.toLowerCase().includes(lowerCaseTerm) ||
        coin.symbol.toLowerCase().includes(lowerCaseTerm)
      ).slice(0, 50);
      setFilteredCoins(results);
    }
  }, [debouncedSearchTerm, allCoins]);

  const handleAddAsset = async (coin: Coin) => {
    setIsAdding(coin.id); // Set loading state for this specific button
    try {
      const response = await fetch('/api/tracked-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          coingeckoId: coin.id, // Use coingeckoId field name expected by API
          symbol: coin.symbol, 
          name: coin.name 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to add asset (status: ${response.status})`);
      }

      console.log('Successfully added asset:', result);
      setSearchTerm(''); // Clear search on success
      onAssetAdded(); // Notify parent component
    } catch (err) {
      console.error("Error adding asset:", err);
      // TODO: Add better error feedback (e.g., toast notification)
      alert(`Error adding ${coin.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAdding(null); // Clear loading state for the button
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-dracula-cyan mb-4">Search & Add Assets</h2>
      <input
        type="text"
        placeholder="Search top 1000 coins (e.g., Bitcoin, btc)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 bg-dracula-selection border border-dracula-comment rounded-lg focus:outline-none focus:border-dracula-purple text-dracula-fg placeholder-dracula-comment mb-4"
        disabled={isLoading}
      />

      {isLoading && <p className="text-dracula-comment">Loading coin list...</p>}
      {error && <p className="text-dracula-red">Error loading coin list: {error}</p>}
      
      {debouncedSearchTerm && !isLoading && !error && (
        <div className="max-h-60 overflow-y-auto bg-dracula-selection rounded-lg border border-dracula-comment">
          {filteredCoins.length > 0 ? (
            filteredCoins.map((coin) => (
              <div key={coin.id} className="flex justify-between items-center p-3 border-b border-dracula-comment last:border-b-0">
                <span>
                  {coin.name} <span className="text-dracula-comment">({coin.symbol.toUpperCase()})</span>
                </span>
                <button 
                  onClick={() => handleAddAsset(coin)}
                  className={`bg-dracula-green hover:bg-opacity-80 text-dracula-bg font-semibold py-1 px-3 rounded text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={isAdding === coin.id}
                >
                  {isAdding === coin.id ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))
          ) : (
            <p className="text-dracula-comment p-3">No results found.</p>
          )}
        </div>
      )}
    </div>
  )
} 