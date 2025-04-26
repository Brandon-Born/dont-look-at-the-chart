// src/lib/timezones.ts

// A list of common IANA time zones
// Source: Often derived from libraries or standard lists. 
// This is a subset for brevity. You can expand it or use a library.
export const commonTimeZones = [
  'UTC',
  'GMT',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Pacific/Honolulu',
  // Add more as needed
];

/**
 * Gets the user's current browser time zone.
 * @returns The IANA time zone string or undefined if not available.
 */
export function getBrowserTimeZone(): string | undefined {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      console.error("Error getting browser time zone:", e);
      return undefined;
    }
  }
  return undefined;
} 