import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import timeZoneData from 'timezones.json'; // Assuming this file exists and is correct

// Define type for timezone objects
interface TimeZone {
  value: string;
  text: string;
}

interface UserSettings {
  quietTimeEnabled: boolean;
  quietTimeStart: string | null;
  quietTimeEnd: string | null;
  quietTimeZone: string | null;
  morningSummaryEnabled: boolean; // New
  morningSummaryTime: string | null; // New
}

function UserSettingsForm() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Partial<UserSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch combined settings (Quiet Time + Morning Summary)
  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        // Fetch Quiet Time settings
        const quietRes = await fetch('/api/user/settings/quiet-time');
        if (!quietRes.ok) throw new Error('Failed to fetch quiet time settings');
        const quietData = await quietRes.json();

        // Fetch Morning Summary settings
        const summaryRes = await fetch('/api/user/settings/morning-summary');
        if (!summaryRes.ok) throw new Error('Failed to fetch morning summary settings');
        const summaryData = await summaryRes.json();

        // Combine settings
        setSettings({ ...quietData, ...summaryData });

      } catch (error) {
        console.error("Settings fetch error:", error);
        toast({
          title: "Error fetching settings",
          description: error instanceof Error ? error.message : "Could not load user preferences.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (session) {
      fetchSettings();
    }
  }, [session, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSwitchChange = (checked: boolean, name: string) => {
    setSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (value: string, name: string) => {
     setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save Quiet Time Settings
      const quietTimePayload = {
        quietTimeEnabled: settings.quietTimeEnabled,
        quietTimeStart: settings.quietTimeStart,
        quietTimeEnd: settings.quietTimeEnd,
        quietTimeZone: settings.quietTimeZone,
      };
      const quietRes = await fetch('/api/user/settings/quiet-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quietTimePayload),
      });
       if (!quietRes.ok) {
         const errorData = await quietRes.json();
         throw new Error(errorData.error || 'Failed to save quiet time settings');
       }

      // Save Morning Summary Settings
      const morningSummaryPayload = {
        morningSummaryEnabled: settings.morningSummaryEnabled,
        morningSummaryTime: settings.morningSummaryTime,
      };
      const summaryRes = await fetch('/api/user/settings/morning-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(morningSummaryPayload),
      });
       if (!summaryRes.ok) {
         const errorData = await summaryRes.json();
         throw new Error(errorData.error || 'Failed to save morning summary settings');
       }

      toast({
        title: "Settings saved successfully!",
      });

    } catch (error) {
        console.error("Settings save error:", error);
        toast({
          title: "Error saving settings",
          description: error instanceof Error ? error.message : "Could not save preferences.",
          variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quiet Time Section */}
        <div className="space-y-4 p-4 border rounded-md">
          <h3 className="font-semibold text-lg">Quiet Time</h3>
          <p className="text-sm text-muted-foreground">
            Suppress notifications during specific hours. Uses the selected timezone.
          </p>
          <div className="flex items-center space-x-2">
            <Switch
              id="quietTimeEnabled"
              name="quietTimeEnabled"
              checked={settings.quietTimeEnabled ?? false}
              onCheckedChange={(checked) => handleSwitchChange(checked, "quietTimeEnabled")}
            />
            <Label htmlFor="quietTimeEnabled">Enable Quiet Time</Label>
          </div>
          {settings.quietTimeEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quietTimeStart">Start Time</Label>
                <Input
                  id="quietTimeStart"
                  name="quietTimeStart"
                  type="time"
                  value={settings.quietTimeStart ?? ''}
                  onChange={handleInputChange}
                  disabled={!settings.quietTimeEnabled}
                />
              </div>
              <div>
                <Label htmlFor="quietTimeEnd">End Time</Label>
                <Input
                  id="quietTimeEnd"
                  name="quietTimeEnd"
                  type="time"
                  value={settings.quietTimeEnd ?? ''}
                  onChange={handleInputChange}
                  disabled={!settings.quietTimeEnabled}
                />
              </div>
               <div>
                <Label htmlFor="quietTimeZone">Time Zone</Label>
                 <Select
                    name="quietTimeZone" // Added name attribute
                    value={settings.quietTimeZone ?? ""} 
                    onValueChange={(value) => handleSelectChange(value, 'quietTimeZone')}> 
                  <SelectTrigger id="quietTimeZone">
                    <SelectValue placeholder="Select timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(timeZoneData as TimeZone[]).map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Morning Summary Section - NEW */}
        <div className="space-y-4 p-4 border rounded-md">
          <h3 className="font-semibold text-lg">Morning Summary</h3>
          <p className="text-sm text-muted-foreground">
            Receive a daily summary email. Uses the timezone selected in Quiet Time settings.
            Requires a valid timezone to be set.
          </p>
          <div className="flex items-center space-x-2">
            <Switch
              id="morningSummaryEnabled"
              name="morningSummaryEnabled"
              checked={settings.morningSummaryEnabled ?? false}
              onCheckedChange={(checked) => handleSwitchChange(checked, "morningSummaryEnabled")}
              disabled={!settings.quietTimeZone} // Disable if no timezone is set
            />
            <Label htmlFor="morningSummaryEnabled">Enable Morning Summary</Label>
             {!settings.quietTimeZone && (
              <span className="text-xs text-red-500 ml-2">(Set Timezone first)</span>
            )}
          </div>
          {settings.morningSummaryEnabled && settings.quietTimeZone && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {/* Time input for morning summary */}
              <div>
                <Label htmlFor="morningSummaryTime">Preferred Time</Label>
                <Input
                  id="morningSummaryTime"
                  name="morningSummaryTime"
                  type="time"
                  value={settings.morningSummaryTime ?? '08:00'} // Default to 08:00 if null
                  onChange={handleInputChange}
                  disabled={!settings.morningSummaryEnabled}
                />
              </div>
              {/* Placeholder for potential future summary options */}
              <div className="col-span-2"></div> 
            </div>
          )}
        </div>


        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ... rest of the profile page component ...

export default UserSettingsForm; 