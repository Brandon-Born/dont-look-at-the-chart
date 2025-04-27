'use client'

import React, { useState, useEffect } from 'react'
import { NotificationRule } from '@prisma/client' // Import actual Prisma type

interface NotificationRuleListProps {
  trackedAssetId: string; // ID of the parent TrackedAsset
  assetSymbol: string;    // Symbol of the asset (for display)
  refreshKey: number; // Key to trigger re-fetch
  requestAssetListRefresh: () => void; // Add callback prop
}

export default function NotificationRuleList({ trackedAssetId, assetSymbol, refreshKey, requestAssetListRefresh }: NotificationRuleListProps) {
  const [rules, setRules] = useState<NotificationRule[]>([]); // Use actual type
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const [error, setError] = useState<string | null>(null);

  // Fetch rules when trackedAssetId or refreshKey changes
  useEffect(() => {
    const fetchRules = async () => {
      if (!trackedAssetId) return; // Don't fetch if no ID
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/notification-rules?trackedAssetId=${trackedAssetId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch notification rules');
        }
        const data: NotificationRule[] = await response.json();
        setRules(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error(`Error fetching rules for ${trackedAssetId}:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRules();
  }, [trackedAssetId, refreshKey]); // Add refreshKey dependency

  const handleToggleRule = async (ruleId: string, currentStatus: boolean) => {
    const originalRules = [...rules];
    // Optimistic update
    setRules(prev => prev.map(rule => rule.id === ruleId ? { ...rule, isEnabled: !currentStatus } : rule));

    try {
      const response = await fetch(`/api/notification-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !currentStatus }),
      });

      if (!response.ok) {
        setRules(originalRules); // Revert on failure
        const errorData = await response.json();
        console.error("Failed to toggle rule:", errorData.error);
        alert(`Error toggling rule: ${errorData.error || 'Unknown error'}`);
      } else {
         requestAssetListRefresh(); // Refresh parent list on success
      }
      // No need to update state on success, optimistic update already done
    } catch (err) {
      setRules(originalRules); // Revert on error
      console.error("Error toggling rule:", err);
      alert("An error occurred while toggling the rule.");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const originalRules = [...rules];
    // Optimistic update
    setRules(prev => prev.filter(rule => rule.id !== ruleId));

    try {
      const response = await fetch(`/api/notification-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setRules(originalRules); // Revert on failure
        const errorData = await response.json();
        console.error("Failed to delete rule:", errorData.error);
        alert(`Error deleting rule: ${errorData.error || 'Unknown error'}`);
      } else {
         requestAssetListRefresh(); // Refresh parent list on success
      }
      // No need to update state on success, optimistic update already done
    } catch (err) {
      setRules(originalRules); // Revert on error
      console.error("Error deleting rule:", err);
      alert("An error occurred while deleting the rule.");
    }
  };

  // Helper to format rule description (using actual NotificationRule type)
  const formatRule = (rule: NotificationRule): string => {
    const valueStr = rule.type.includes('PERCENT') ? `${rule.value}%` : `$${rule.value.toLocaleString()}`;
    switch (rule.type) {
      case 'PRICE_TARGET_ABOVE': return `Price > ${valueStr}`;
      case 'PRICE_TARGET_BELOW': return `Price < ${valueStr}`;
      case 'PERCENT_CHANGE_INCREASE': return `Increase ${valueStr} in ${rule.timeWindowHours}h`;
      case 'PERCENT_CHANGE_DECREASE': return `Decrease ${valueStr} in ${rule.timeWindowHours}h`;
      default: return 'Unknown rule';
    }
  };

  return (
    <div className="mt-4 pl-6 border-l-2 border-dracula-comment">
      <h3 className="text-lg font-semibold text-dracula-purple mb-3">Alert Rules</h3>
      {isLoading && <p className="text-dracula-comment text-sm">Loading rules...</p>}
      {error && <p className="text-dracula-red text-sm">Error loading rules: {error}</p>}
      
      {!isLoading && !error && (
        <div className="space-y-2">
          {rules.length > 0 ? (
            rules.map((rule) => (
              <div key={rule.id} className="flex justify-between items-center p-2 bg-dracula-bg rounded">
                <span className={`text-sm ${rule.isEnabled ? 'text-dracula-fg' : 'text-dracula-comment line-through'}`}>
                  {formatRule(rule)}
                </span>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleToggleRule(rule.id, rule.isEnabled)}
                    className={`text-xs font-medium py-1 px-2 rounded ${rule.isEnabled ? 'bg-dracula-orange text-dracula-bg' : 'bg-dracula-comment text-dracula-fg'} hover:bg-opacity-80`}
                  >
                    {rule.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button 
                    onClick={() => handleDeleteRule(rule.id)}
                    className="bg-dracula-red hover:bg-opacity-80 text-dracula-fg font-semibold py-1 px-2 rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-dracula-comment text-sm italic">No rules defined for {assetSymbol}.</p>
          )}
        </div>
      )}
      {/* AddNotificationRuleForm is now added by the parent component (TrackedAssetsList) */}
    </div>
  )
} 