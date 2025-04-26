// NOTE: SMS integration is currently ON HOLD.
// A paid Twilio account with a verified phone number is required for full functionality.
// This feature will be revisited and fully integrated after the initial application deployment.

import twilio from 'twilio';

// Initialize Twilio client
// Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set in your environment variables (.env.local)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Basic validation
if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.error('Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not set.');
  // In a real app, you might throw an error or have a more robust configuration check
}

// Only initialize client if credentials are provided
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Sends an SMS message using Twilio.
 * @param to The recipient's phone number (E.164 format recommended, e.g., +15551234567).
 * @param body The text message body.
 * @returns Promise resolving with the message SID on success, or rejecting on error.
 */
export async function sendSms(to: string, body: string): Promise<string | undefined> {
  if (!client) {
    console.error('Twilio client not initialized. Check environment variables.');
    // Potentially return a specific error or status
    return undefined; // Or throw new Error('Twilio client not initialized');
  }

  if (!twilioPhoneNumber) {
     console.error('Twilio phone number not configured.');
     return undefined; // Or throw new Error('Twilio phone number not configured');
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: twilioPhoneNumber,
      to: to,
    });
    console.log(`SMS sent successfully to ${to}. SID: ${message.sid}`);
    return message.sid;
  } catch (error) {
    console.error(`Error sending SMS to ${to}:`, error);
    // Consider more specific error handling or logging
    // Re-throw the error or return an indicator of failure
    throw error; // Or return undefined / null / specific error object
  }
}

// Example usage (optional, for testing)
/*
async function testSendSms() {
  const testPhoneNumber = process.env.TEST_PHONE_NUMBER; // Add a test number to your .env.local
  if (testPhoneNumber) {
    try {
      await sendSms(testPhoneNumber, "Hello from DLATC! This is a test message.");
      console.log("Test SMS function executed.");
    } catch (err) {
      console.error("Test SMS failed:", err);
    }
  } else {
    console.warn("TEST_PHONE_NUMBER not set in .env.local, skipping test SMS.");
  }
}

// Uncomment the line below to run the test when this module is loaded (use with caution)
// testSendSms();
*/ 