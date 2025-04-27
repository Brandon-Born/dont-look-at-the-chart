'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { Asset } from '@prisma/client' // Import Prisma type
import { getPrices, PriceData } from '@/lib/coingecko' // Import price fetching
import NotificationRuleList from './NotificationRuleList' // Import rule list
import AddNotificationRuleForm from './AddNotificationRuleForm' // Import rule form
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid' // Example icons

// Type for the data received from GET /api/tracked-assets
interface TrackedAssetWithDetails {
  id: string;         // ID of the TrackedAsset record
  userId: string;
  assetId: string;
  createdAt: Date;
  asset: Asset;       // Nested Asset details
  _count: {          // Add count field
    notificationRules: number;
  };
}

interface TrackedAssetsListProps {
  refreshKey: number;
  requestAssetListRefresh: () => void; // Add callback prop
}

export default function TrackedAssetsList({ refreshKey, requestAssetListRefresh }: TrackedAssetsListProps) {
  const [trackedAssets, setTrackedAssets] = useState<TrackedAssetWithDetails[]>([])
  const [prices, setPrices] = useState<PriceData>({})
  const [isLoading, setIsLoading] = useState(true) // Start loading initially
  const [error, setError] = useState<string | null>(null)
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null) // Track expanded asset
  const [ruleListRefreshKey, setRuleListRefreshKey] = useState(0) // Key to refresh rule list

  // Fetch tracked assets whenever refreshKey changes
  useEffect(() => {
    const fetchTrackedAssets = async () => {
      // Only set loading true on initial load or if there's an error
      if (trackedAssets.length === 0 || error) {
          setIsLoading(true);
      }
      setError(null);
      try {
        const response = await fetch('/api/tracked-assets')
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch tracked assets')
        }
        const data: TrackedAssetWithDetails[] = await response.json()
        setTrackedAssets(data)

        // Fetch prices for the newly loaded assets
        if (data.length > 0) {
          const coinIds = data.map(ta => ta.asset.coingeckoId)
          const priceData = await getPrices(coinIds)
          setPrices(priceData)
        } else {
          setPrices({}) // Reset prices if no assets are tracked
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
        console.error("Error fetching tracked assets:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrackedAssets();
  }, [refreshKey, error, trackedAssets.length]); // Re-run effect when refreshKey changes

  const handleRemoveAsset = async (trackedAssetId: string) => {
    // Optimistic UI update (optional but improves UX)
    const originalAssets = [...trackedAssets]
    setTrackedAssets(prev => prev.filter(asset => asset.id !== trackedAssetId))
    if (expandedAssetId === trackedAssetId) {
      setExpandedAssetId(null) // Collapse if the removed asset was expanded
    }

    try {
      const response = await fetch(`/api/tracked-assets/${trackedAssetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update on failure
        setTrackedAssets(originalAssets)
        const errorData = await response.json()
        // TODO: Show error feedback to user (e.g., using a toast library)
        console.error("Failed to remove asset:", errorData.error)
        alert(`Error removing asset: ${errorData.error || 'Unknown error'}`)
      }
      // On success, the optimistic update is already applied

    } catch (err) {
      // Revert optimistic update on network error
      setTrackedAssets(originalAssets)
      console.error("Error removing asset:", err)
      alert("An error occurred while removing the asset.")
    }
  }

  // Toggle asset expansion
  const toggleExpand = (trackedAssetId: string) => {
    setExpandedAssetId(prevId => prevId === trackedAssetId ? null : trackedAssetId)
  }

  // Callback to refresh rule list AND the main asset list
  const handleRuleAdded = useCallback(() => {
    setRuleListRefreshKey(prev => prev + 1); // Refresh the rule list for current asset
    requestAssetListRefresh(); // Request refresh of the main asset list (updates count)
  }, [requestAssetListRefresh]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-dracula-cyan mb-4">Tracked Assets & Rules</h2>
      {isLoading && <p className="text-dracula-comment">Loading tracked assets...</p>}
      {error && <p className="text-dracula-red">Error: {error}</p>}
      
      {!isLoading && !error && (
         <div className="space-y-3">
          {trackedAssets.length > 0 ? (
            trackedAssets.map((ta) => {
              const currentPrice = prices[ta.asset.coingeckoId]?.usd
              const isExpanded = expandedAssetId === ta.id
              return (
                <div key={ta.id} className="bg-dracula-selection rounded-lg shadow">
                  {/* Asset Header Row */}
                  <div className="flex justify-between items-center p-4 cursor-pointer" onClick={() => toggleExpand(ta.id)}>
                    <div className="flex items-center space-x-3">
                      <button
                        aria-label={isExpanded ? 'Collapse rules' : 'Expand rules'}
                        className="text-dracula-purple hover:text-dracula-pink"
                      >
                        {isExpanded 
                          ? <ChevronUpIcon className="h-5 w-5" /> 
                          : <ChevronDownIcon className="h-5 w-5" />}
                      </button>
                      <div>
                        <span className="font-semibold text-dracula-fg">{ta.asset.name}</span>
                        <span className="text-dracula-comment ml-2">({ta.asset.symbol.toUpperCase()})</span>
                        {/* Display Rule Count */} 
                        <span className="text-xs text-dracula-purple ml-2 bg-dracula-bg px-1.5 py-0.5 rounded">
                          {ta._count.notificationRules} Rule(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-dracula-green font-medium w-28 text-right">
                        {currentPrice !== undefined
                          ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                          : <span className="text-dracula-comment text-sm">Loading...</span>}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveAsset(ta.id); }} // Stop propagation to prevent toggle
                        className="bg-dracula-red hover:bg-opacity-80 text-dracula-fg font-semibold py-1 px-3 rounded text-sm transition duration-150 ease-in-out z-10" // Added z-index
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Expanded Section for Rules */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-dracula-comment">
                      <NotificationRuleList 
                        refreshKey={ruleListRefreshKey}
                        trackedAssetId={ta.id} 
                        assetSymbol={ta.asset.symbol.toUpperCase()} 
                        requestAssetListRefresh={requestAssetListRefresh} // Pass down the main refresh fn
                      />
                      <AddNotificationRuleForm 
                        trackedAssetId={ta.id} 
                        onRuleAdded={handleRuleAdded} 
                      />
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-dracula-comment p-3 text-center">You are not tracking any assets yet. Use the search above to add some!</p>
          )}
        </div>
      )}
    </div>
  )
} 