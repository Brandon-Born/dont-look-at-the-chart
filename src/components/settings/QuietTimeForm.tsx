'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { z } from 'zod';
import { commonTimeZones, getBrowserTimeZone } from '@/lib/timezones';
import { toast } from "sonner";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

// Schema matching the API PATCH endpoint's expected input
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const settingsSchema = z.object({
  quietTimeEnabled: z.boolean(),
  quietTimeStart: z.string().regex(timeRegex).nullable().optional(),
  quietTimeEnd: z.string().regex(timeRegex).nullable().optional(),
  quietTimeZone: z.string().nullable().optional(),
});

type SettingsData = z.infer<typeof settingsSchema>;

// Type for the user data we expect to fetch (subset of User model)
interface UserSettings {
  quietTimeEnabled: boolean;
  quietTimeStart: string | null;
  quietTimeEnd: string | null;
  quietTimeZone: string | null;
  // morningSummaryEnabled: boolean; // Add if needed
}

export default function QuietTimeForm() {
  const { data: session, status } = useSession();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<SettingsData>({ // Local form state
    quietTimeEnabled: false,
    quietTimeStart: null,
    quietTimeEnd: null,
    quietTimeZone: null,
  });
  const [initialSettings, setInitialSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      // Only fetch if authenticated
      if (status === 'authenticated') { 
        setIsLoading(true);
        try {
          console.log("QuietTimeForm: Fetching settings from API...");
          const response = await fetch('/api/user/settings'); 
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
            throw new Error(errorData.error || `Failed to fetch settings (${response.status})`);
          }
          
          const data: UserSettings = await response.json();
          console.log("QuietTimeForm: Received settings from API:", data);

          // Determine default timezone if needed
          const defaultTimeZone = getBrowserTimeZone() ?? 'UTC';

          // Use fetched data to initialize state, applying default TZ if null
          const loadedSettings = {
            quietTimeEnabled: data.quietTimeEnabled ?? false,
            quietTimeStart: data.quietTimeStart, // Keep null as null
            quietTimeEnd: data.quietTimeEnd,
            quietTimeZone: data.quietTimeZone ?? defaultTimeZone, // Apply default if null
          };
          setSettings(loadedSettings);
          
          // Also set initial settings for change detection (use raw fetched data or processed data?)
          // Using the processed loadedSettings ensures consistency if defaults were applied
          setInitialSettings({
             ...loadedSettings,
             // Ensure initialSettings structure matches UserSettings exactly if needed elsewhere
             // For this form, matching loadedSettings is likely sufficient
          });

        } catch (error) {
          console.error("Failed to fetch settings:", error);
          toast.error(error instanceof Error ? error.message : "Could not load your current settings.");
          // Optionally set defaults or leave form empty on error
           setSettings({
            quietTimeEnabled: false,
            quietTimeStart: '22:00', // Default example
            quietTimeEnd: '07:00',
            quietTimeZone: getBrowserTimeZone() ?? 'UTC', 
          });
          setInitialSettings(null); // Indicate loading failed for change detection
        } finally {
          setIsLoading(false);
        }
      } else if (status === 'unauthenticated') {
          setIsLoading(false); // Not logged in, stop loading
      }
    };

    // Initial fetch when session status is known
    if (status !== 'loading') { 
        fetchSettings();
    }

  }, [status]); // Depend only on session status change

  const handleInputChange = (field: keyof SettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
     // Allow empty string temporarily, validation happens on save
    if (value === '' || timeRegex.test(value)) {
        handleInputChange(name as keyof SettingsData, value || null);
    }
  };

  const handleTimeZoneChange = (value: string) => {
     handleInputChange('quietTimeZone', value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!initialSettings) return; // Should not happen if button is enabled

    // Determine if any quiet time setting has changed
    const quietEnabledChanged = settings.quietTimeEnabled !== initialSettings.quietTimeEnabled;
    const quietStartChanged = settings.quietTimeStart !== initialSettings.quietTimeStart;
    const quietEndChanged = settings.quietTimeEnd !== initialSettings.quietTimeEnd;
    const quietZoneChanged = settings.quietTimeZone !== initialSettings.quietTimeZone;
    const anyQuietSettingChanged = quietEnabledChanged || quietStartChanged || quietEndChanged || quietZoneChanged;

    if (!anyQuietSettingChanged) {
        toast.info("Quiet time settings haven't changed.");
        return;
    }
    
    // --- Build the data payload --- 
    const dataToSubmit: Partial<SettingsData> = {};

    if (anyQuietSettingChanged) {
        dataToSubmit.quietTimeEnabled = settings.quietTimeEnabled;
        if (settings.quietTimeEnabled) {
            // If enabling or modifying while enabled, send all current values
            dataToSubmit.quietTimeStart = settings.quietTimeStart;
            dataToSubmit.quietTimeEnd = settings.quietTimeEnd;
            dataToSubmit.quietTimeZone = settings.quietTimeZone;

             // Frontend validation: Ensure all required fields are present if enabled
            if (!settings.quietTimeStart || !settings.quietTimeEnd || !settings.quietTimeZone) {
                toast.error("Please provide start time, end time, and time zone when enabling quiet time.");
                return; // Stop submission
            }
        } else {
            // If disabling, explicitly null out related fields
            dataToSubmit.quietTimeStart = null;
            dataToSubmit.quietTimeEnd = null;
            dataToSubmit.quietTimeZone = null;
        }
    }
    // --- End build data payload --- 

    startTransition(async () => {
      try {
        const response = await fetch('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSubmit),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update settings');
        }

        const updatedData: UserSettings = await response.json();
        // Update local state with confirmed data from backend
        setSettings(updatedData);
        setInitialSettings(updatedData);

        toast.success("Quiet time settings updated.");
      } catch (error: any) {
        console.error("Failed to update settings:", error);
        toast.error(error.message || "Could not update settings.");
        // Optionally revert local state on error
        // setSettings(initialSettings || { quietTimeEnabled: false, quietTimeStart: null, quietTimeEnd: null, quietTimeZone: null });
      }
    });
  };

  if (status === 'loading' || isLoading) {
    return <div>Loading settings...</div>; // Or a Spinner component
  }

  if (status === 'unauthenticated') {
    return <div>Please log in to manage settings.</div>;
  }

  const isEnabled = settings.quietTimeEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiet Time</CardTitle>
        <CardDescription>
          Suppress non-critical notifications during specific hours.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="quietTimeEnabled"
              checked={isEnabled}
              onCheckedChange={(checked: boolean) => handleInputChange('quietTimeEnabled', checked)}
              aria-labelledby="quiet-time-label"
            />
            <Label htmlFor="quietTimeEnabled" id="quiet-time-label">Enable Quiet Time</Label>
          </div>

          <div className={`grid gap-4 sm:grid-cols-3 ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <Label htmlFor="quietTimeStart">Start Time (HH:MM)</Label>
              <Input
                id="quietTimeStart"
                name="quietTimeStart"
                type="time" // Use time input for better UX
                value={settings.quietTimeStart || ''}
                onChange={handleTimeChange}
                required={isEnabled} // Required only if quiet time is enabled
                disabled={!isEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quietTimeEnd">End Time (HH:MM)</Label>
              <Input
                id="quietTimeEnd"
                name="quietTimeEnd"
                type="time"
                value={settings.quietTimeEnd || ''}
                onChange={handleTimeChange}
                required={isEnabled}
                disabled={!isEnabled}
              />
            </div>
             <div className="space-y-2">
                <Label htmlFor="quietTimeZone">Time Zone</Label>
                <Select 
                    value={settings.quietTimeZone || ''}
                    onValueChange={handleTimeZoneChange}
                    required={isEnabled}
                    disabled={!isEnabled}
                >
                    <SelectTrigger id="quietTimeZone">
                        <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                        {commonTimeZones.map(tz => (
                            <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
           {!isEnabled && (
              <p className="text-sm text-muted-foreground">
                Enable quiet time to set the start/end times and time zone.
              </p>
            )}
             {isEnabled && (!settings.quietTimeStart || !settings.quietTimeEnd || !settings.quietTimeZone) && (
                <p className="text-sm text-destructive">
                    Please specify start time, end time, and time zone.
                </p>
             )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending || !initialSettings}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 