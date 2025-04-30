'use client' // Need client hooks for state

import React, { useState, useCallback } from 'react'; // Import useState and useCallback
import { useSession } from 'next-auth/react'; // Use client hook for session
import { redirect } from 'next/navigation';
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
    <div className="bg-dracula-background text-dracula-foreground"> 
      <div className="container mx-auto mt-8 px-4"> 
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

      {/* Footer Section - This will be pushed down by flex-grow in layout.tsx */}
      <footer className="w-full mt-12 py-6 border-t border-dracula-current-line text-center text-dracula-comment text-sm bg-dracula-background">
        <div className="container mx-auto px-4"> {/* Center content within footer */}
          <p className="mb-4">
            This app was built for learning and fun. If you enjoy it, consider leaving a tip!
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6"> {/* Flex layout for addresses */}
            {/* Bitcoin */}
            <div className="flex items-center space-x-2">
              {/* <Image src="https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg" alt="BTC Logo" width={20} height={20} /> */}
              <span className="font-semibold text-dracula-orange">BTC:</span>
              <code className="text-xs break-all bg-dracula-current-line px-1 rounded">bc1q38vthmqz97fmvp068c6ktcj2a2rfucqpvcsk9y</code>
            </div>
            {/* Ethereum */}
            <div className="flex items-center space-x-2">
              {/* <Image src="https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg" alt="ETH Logo" width={20} height={20} /> */}
              <span className="font-semibold text-dracula-cyan">ETH:</span>
              <code className="text-xs break-all bg-dracula-current-line px-1 rounded">0x27b1bAA721c10777443c9eCC6FF0B47Fc366b871</code>
            </div>
            {/* Solana */}
            <div className="flex items-center space-x-2">
              {/* <Image src="https://static.cdnlogo.com/logos/s/85/solana.svg" alt="SOL Logo" width={20} height={20} /> */}
              <span className="font-semibold text-dracula-pink">SOL:</span>
              <code className="text-xs break-all bg-dracula-current-line px-1 rounded">CTXXkj4wgdH9cwxMuT2iSwEPxb77QNCnLpPPmMAVK6MW</code>
            </div>
          </div>
          <p className="mt-4 text-xs text-dracula-foreground/50">
            (Please double-check addresses before sending)
          </p>
        </div>
      </footer>

    </div>
  )
} 