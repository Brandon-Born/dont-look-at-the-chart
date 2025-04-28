'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface MorningSummarySettings {
  morningSummaryEnabled: boolean;
  morningSummaryTime: string | null;
  quietTimeZone: string | null; // Used for display context
}

export default function MorningSummaryForm() {
  const [settings, setSettings] = useState<Partial<MorningSummarySettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch initial settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/settings/morning-summary');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings({
        morningSummaryEnabled: data.morningSummaryEnabled ?? false,
        morningSummaryTime: data.morningSummaryTime ?? '',
        quietTimeZone: data.quietTimeZone ?? 'UTC',
      });
    } catch (error) {
      console.error("Fetch Error:", error);
      toast.error("Could not load morning summary settings.");
      setSettings({
          morningSummaryEnabled: false,
          morningSummaryTime: '',
          quietTimeZone: 'UTC'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setSettings(prev => ({ ...prev, morningSummaryEnabled: checked }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/settings/morning-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          morningSummaryEnabled: settings.morningSummaryEnabled,
          morningSummaryTime: settings.morningSummaryTime || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(prev => ({
          ...prev,
          morningSummaryEnabled: updatedSettings.morningSummaryEnabled,
          morningSummaryTime: updatedSettings.morningSummaryTime ?? '',
      }));

      toast.success("Morning summary settings saved.");

    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Error Saving Settings", {
          description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Morning Summary</CardTitle>
        <CardDescription>
          Enable to receive a daily email summary of your tracked assets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-12" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <Switch
                id="morningSummaryEnabled"
                checked={settings.morningSummaryEnabled ?? false}
                onCheckedChange={handleSwitchChange}
                aria-labelledby="morning-summary-label"
              />
              <Label htmlFor="morningSummaryEnabled" id="morning-summary-label" className="flex flex-col space-y-1">
                <span>Enable Morning Summary</span>
              </Label>
            </div>

            {settings.morningSummaryEnabled && (
              <div className="space-y-2">
                <Label htmlFor="morningSummaryTime">Preferred Summary Hour</Label>
                <select
                  id="morningSummaryTime"
                  name="morningSummaryTime"
                  value={settings.morningSummaryTime ?? '08:00'}
                  onChange={handleInputChange}
                  className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!settings.morningSummaryEnabled}
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    const timeValue = `${hour}:00`;
                    return (
                      <option key={timeValue} value={timeValue}>
                        {timeValue}
                      </option>
                    );
                  })}
                </select>
                <p className="text-sm text-muted-foreground">
                  The summary will be sent around this hour, based on your configured time zone ({settings.quietTimeZone || 'Not set'}).
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
} 