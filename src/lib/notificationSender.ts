import { Resend } from 'resend';
import { NotificationRuleType } from '@prisma/client';

// Interface matching the one from ruleEvaluator
interface TriggeredRuleInfo {
  ruleId: string;
  userId: string;
  assetSymbol: string;
  assetName: string;
  ruleType: NotificationRuleType;
  ruleValue: number;
  triggeringPrice: number;
  userEmail: string;
  userPhoneNumber?: string | null;
}

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set.');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function formatPrice(price: number): string {
    return price.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatRuleDescription(rule: TriggeredRuleInfo): string {
    const valueStr = rule.ruleType.includes('PERCENT') 
        ? `${rule.ruleValue}%` 
        : formatPrice(rule.ruleValue);
    switch (rule.ruleType) {
      case 'PRICE_TARGET_ABOVE': return `Price went above ${valueStr}`;
      case 'PRICE_TARGET_BELOW': return `Price went below ${valueStr}`;
      case 'PERCENT_CHANGE_INCREASE': return `Increased by ${valueStr} or more`; // Simplified for alert text
      case 'PERCENT_CHANGE_DECREASE': return `Decreased by ${valueStr} or more`; // Simplified for alert text
      default: return 'Rule triggered';
    }
}

/**
 * Sends an email notification for a triggered rule.
 */
export async function sendEmailNotification(triggeredInfo: TriggeredRuleInfo): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();
  const fromAddress = process.env.EMAIL_FROM || 'alerts@dontlookatthechart.app'; // Use configured from address or a default

  const subject = `DLATC Alert: ${triggeredInfo.assetName} (${triggeredInfo.assetSymbol}) Rule Triggered!`;
  const ruleDescription = formatRuleDescription(triggeredInfo);
  const currentPriceFormatted = formatPrice(triggeredInfo.triggeringPrice);

  const body = `
    <h2>Don't Look At The Chart Alert!</h2>
    <p>Your alert rule for <strong>${triggeredInfo.assetName} (${triggeredInfo.assetSymbol})</strong> was triggered.</p>
    <ul>
        <li><strong>Rule:</strong> ${ruleDescription}</li>
        <li><strong>Current Price:</strong> ${currentPriceFormatted}</li>
    </ul>
    <p>Rule ID: ${triggeredInfo.ruleId}</p>
    <hr>
    <p><small>To manage your alerts, visit the dashboard.</small></p>
  `;

  try {
    const { data, error } = await client.emails.send({
      from: `DLATC Alerts <${fromAddress}>`, // Friendly 'From' name
      to: [triggeredInfo.userEmail],
      subject: subject,
      html: body,
    });

    if (error) {
      console.error(`Resend Error sending email to ${triggeredInfo.userEmail} for rule ${triggeredInfo.ruleId}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`Email notification sent successfully to ${triggeredInfo.userEmail} for rule ${triggeredInfo.ruleId}. Message ID: ${data?.id}`);
    return { success: true };

  } catch (exception) {
    console.error(`Exception sending email to ${triggeredInfo.userEmail} for rule ${triggeredInfo.ruleId}:`, exception);
    return { success: false, error: exception instanceof Error ? exception.message : 'Unknown exception' };
  }
}

/**
 * Sends notifications for a list of triggered rules.
 * Currently only sends email.
 */
export async function sendNotifications(triggeredRules: TriggeredRuleInfo[]) {
    console.log(`Notification Sender: Processing ${triggeredRules.length} triggered rules.`);
    let successCount = 0;
    let failureCount = 0;

    // Consider sending in parallel with Promise.allSettled for performance
    for (const ruleInfo of triggeredRules) {
        // TODO: Add check for user preferences (email/sms enabled, quiet time)
        const emailResult = await sendEmailNotification(ruleInfo);
        if (emailResult.success) {
            successCount++;
        } else {
            failureCount++;
        }
        // TODO: Add SMS sending logic here if ruleInfo.userPhoneNumber exists
    }
    console.log(`Notification Sender: Finished processing. Success: ${successCount}, Failed: ${failureCount}`);
} 