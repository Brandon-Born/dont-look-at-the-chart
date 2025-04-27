import React from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import QuietTimeForm from '@/components/settings/QuietTimeForm';
import MorningSummaryForm from '@/components/settings/MorningSummaryForm';
import { Separator } from '@/components/ui/separator';

// You might want to add other setting sections here later
// import NotificationPreferencesForm from '@/components/settings/NotificationPreferencesForm';
// import AccountSettingsForm from '@/components/settings/AccountSettingsForm';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    // Redirect to login if not authenticated
    // Consider adding a callbackUrl to return here after login
    redirect('/api/auth/signin?callbackUrl=/settings');
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-8">
        {/* Quiet Time Settings Card */}
        <QuietTimeForm />

        {/* Separator */}
        <Separator />

        {/* Morning Summary Settings Card */}
        <MorningSummaryForm />

        {/* Add other settings sections as needed */}
        {/* <Separator />
        <AccountSettingsForm /> */}      
      </div>
    </div>
  );
} 