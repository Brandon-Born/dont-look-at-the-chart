'use client' // Need client hooks for state

import React, { useState, useCallback } from 'react'; // Import useState and useCallback
import { useSession } from 'next-auth/react'; // Use client hook for session
import { redirect } from 'next/navigation';
import Link from 'next/link'; // <-- Import Link
import AssetSearch from '@/components/AssetSearch';
import TrackedAssetsList from '@/components/TrackedAssetsList';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger list refresh

  // Callback function to increment the refresh key for the Asset List
  const requestAssetListRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  // Loading state while session is being fetched
  if (status === "loading") {
    return (
        <div className="container mx-auto mt-8 text-center text-dracula-comment">
            Loading dashboard...
        </div>
    );
  }

  // Redirect if not authenticated
  if (status === "unauthenticated") {
    redirect('/');
  }

  // Should have session here
  if (!session?.user) {
    // This case should ideally not happen if redirect above works
    console.error("Dashboard loaded without authenticated user session.");
    redirect('/');
    return null; // Return null to avoid rendering errors before redirect
  }

  return (
    <div className="container mx-auto mt-8">
      <h1 className="text-3xl font-bold text-dracula-purple mb-6">
        Welcome, {session.user.email}!
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"> {/* Changed md to lg for breakpoint */}
        {/* Column 1: Search */}
        <div>
          {/* Pass callback to AssetSearch */}
          <AssetSearch onAssetAdded={requestAssetListRefresh} /> 
        </div>

        {/* Column 2: Tracked List */}
        <div>
          {/* Pass refreshKey and the refresh callback */}
          <TrackedAssetsList refreshKey={refreshKey} requestAssetListRefresh={requestAssetListRefresh} /> 
        </div>
      </div>

    </div>
  )
} 