import { prisma } from '@/lib/prisma';
import { PriceHistory, NotificationRuleType, User } from '@prisma/client';
import { sendNotifications } from './notificationSender';
import { toZonedTime, format } from 'date-fns-tz';

// Simple cooldown period (in minutes) to prevent rapid re-triggering of the same rule
const RULE_COOLDOWN_MINUTES = 119;

interface TriggeredRuleInfo {
  ruleId: string;
  trackedAssetId: string;
  userId: string;
  assetSymbol: string;
  assetName: string;
  ruleType: NotificationRuleType;
  ruleValue: number;
  triggeringPrice: number;
  userEmail: string; // Needed for notification
  userPhoneNumber?: string | null; // Needed for SMS
}

/**
 * Checks if the current time falls within the user's defined quiet time.
 * Handles overnight periods (e.g., 10 PM to 7 AM).
 * @param user The user object containing quiet time settings.
 * @param nowUtc Optional date object representing the current UTC time (for testing).
 * @returns {boolean} True if it is currently quiet time, false otherwise.
 */
export function isQuietTime(user: User, nowUtc: Date = new Date()): boolean {
  if (!user.quietTimeEnabled || !user.quietTimeStart || !user.quietTimeEnd || !user.quietTimeZone) {
    return false; // Quiet time not enabled or configured
  }

  try {
    const timeZone = user.quietTimeZone; // e.g., "America/New_York"
    const nowZoned = toZonedTime(nowUtc, timeZone);

    // Use format to reliably extract hour/minute in the target timezone
    const currentHour = parseInt(format(nowZoned, 'H', { timeZone }), 10);
    const currentMinute = parseInt(format(nowZoned, 'm', { timeZone }), 10);

    // Parse start and end times
    const startTimeStr = user.quietTimeStart; // e.g., "22:00"
    const endTimeStr = user.quietTimeEnd;   // e.g., "07:00"

    const startHour = parseInt(startTimeStr.split(':')[0], 10);
    const startMinute = parseInt(startTimeStr.split(':')[1], 10);
    const endHour = parseInt(endTimeStr.split(':')[0], 10);
    const endMinute = parseInt(endTimeStr.split(':')[1], 10);

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    // Handle zero duration case
    if (startTimeInMinutes === endTimeInMinutes) {
      return false;
    }

    const isOvernight = startTimeInMinutes > endTimeInMinutes;

    if (isOvernight) {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    }

  } catch (error) {
    // Log the specific error for better debugging if it happens
    console.error(`Error checking quiet time for user ${user.id} (${user.email}) in timezone ${user.quietTimeZone}:`, error);
    return false; // Fail safe: assume it's not quiet time if error occurs
  }
}

/**
 * Evaluates all active notification rules against the latest price data.
 * @param quietTimeChecker Optional function to check for quiet time (defaults to isQuietTime).
 * @returns {Promise<void>}
 */
export async function evaluateRules(
  quietTimeChecker: (user: User, nowUtc?: Date) => boolean = isQuietTime
): Promise<void> {
  console.log("Rule Evaluator: Starting evaluation...");

  const triggeredRules: TriggeredRuleInfo[] = [];

  // 1. Fetch all enabled rules with necessary relations
  const activeRules = await prisma.notificationRule.findMany({
    where: {
      isEnabled: true,
    },
    include: {
      trackedAsset: {
        include: {
          asset: true, 
          user: true,
        },
      },
      triggeredAlerts: {
        orderBy: { triggeredAt: 'desc' },
        take: 1,
      },
    },
  });

  if (activeRules.length === 0) {
    console.log("Rule Evaluator: No active rules found.");
    return;
  }

  console.log(`Rule Evaluator: Found ${activeRules.length} active rules to evaluate.`);

  // 2. Group rules by Asset ID for efficient price fetching
  const assetIds = [...new Set(activeRules.map(r => r.trackedAsset.asset.id))];

  // 3. Fetch latest price for each relevant asset
  const latestPricesMap = new Map<string, PriceHistory>();
  const latestPriceRecords = await prisma.priceHistory.findMany({
    where: {
      assetId: { in: assetIds },
    },
    orderBy: { timestamp: 'desc' },
    distinct: ['assetId'], // Get only the most recent record for each asset
  });
  latestPriceRecords.forEach(p => latestPricesMap.set(p.assetId, p));

  // 4. Evaluate each rule
  const nowForQuietTimeCheck = new Date(); // Use a consistent time for all checks in this run
  for (const rule of activeRules) {
    const assetId = rule.trackedAsset.asset.id;
    const latestPrice = latestPricesMap.get(assetId);

    if (!latestPrice) {
      continue; 
    }

    // --- Cooldown Check --- 
    const lastTriggered = rule.triggeredAlerts?.[0];
    if (lastTriggered) {
        const cooldownThreshold = new Date();
        cooldownThreshold.setMinutes(cooldownThreshold.getMinutes() - RULE_COOLDOWN_MINUTES);
        if (lastTriggered.triggeredAt > cooldownThreshold) {
            continue; 
        }
    }
    // --- End Cooldown Check ---

    let conditionMet = false;
    try {
        switch (rule.type) {
            case NotificationRuleType.PRICE_TARGET_ABOVE:
                conditionMet = latestPrice.price > rule.value;
                break;

            case NotificationRuleType.PRICE_TARGET_BELOW:
                conditionMet = latestPrice.price < rule.value;
                break;

            case NotificationRuleType.PERCENT_CHANGE_INCREASE:
            case NotificationRuleType.PERCENT_CHANGE_DECREASE:
                if (rule.timeWindowHours) {
                    const startTime = new Date(latestPrice.timestamp);
                    startTime.setHours(startTime.getHours() - rule.timeWindowHours);

                    const startPriceRecord = await prisma.priceHistory.findFirst({
                        where: {
                            assetId: assetId,
                            timestamp: { gte: startTime },
                        },
                        orderBy: { timestamp: 'asc' }, 
                    });

                    if (startPriceRecord && startPriceRecord.price !== 0) { // Avoid division by zero
                        const priceChange = latestPrice.price - startPriceRecord.price;
                        const percentChange = (priceChange / startPriceRecord.price) * 100;
                        
                        if (rule.type === NotificationRuleType.PERCENT_CHANGE_INCREASE) {
                            conditionMet = percentChange >= rule.value;
                        } else { // PERCENT_CHANGE_DECREASE
                            // Ensure we compare against the negative magnitude
                            conditionMet = percentChange <= -Math.abs(rule.value);
                        }
                    } 
                }
                break;
        }

        if (conditionMet) {
            // ---> Use the passed-in quietTimeChecker <--- 
            if (quietTimeChecker(rule.trackedAsset.user, nowForQuietTimeCheck)) { 
                console.log(`Rule Evaluator: Rule ${rule.id} triggered for user ${rule.trackedAsset.user.email}, but it's quiet time. Suppressing notification.`);
                // We still record the trigger, but don't add to notification list
                 const triggeredAlertData = {
                    ruleId: rule.id,
                    triggeringPrice: latestPrice.price,
                    triggeredAt: new Date(), 
                 };
                 try {
                    await prisma.triggeredAlert.create({ data: triggeredAlertData });
                    console.log(`Rule Evaluator: Recorded suppressed triggered alert ${rule.id} in DB.`);
                 } catch (dbError) {
                    console.error(`Rule Evaluator: Failed to record suppressed triggered alert ${rule.id} in DB:`, dbError);
                 }
                continue; // Skip adding to triggeredRules for notification
            }
            // ---> End Quiet Time Check <--- 

            console.log(`Rule Evaluator: Rule ${rule.id} triggered for user ${rule.trackedAsset.user.email} - ${rule.trackedAsset.asset.symbol} ${rule.type} ${rule.value}`);
            triggeredRules.push({
                ruleId: rule.id,
                trackedAssetId: rule.trackedAssetId,
                userId: rule.trackedAsset.userId,
                assetSymbol: rule.trackedAsset.asset.symbol.toUpperCase(),
                assetName: rule.trackedAsset.asset.name,
                ruleType: rule.type,
                ruleValue: rule.value,
                triggeringPrice: latestPrice.price,
                userEmail: rule.trackedAsset.user.email,
                userPhoneNumber: rule.trackedAsset.user.phoneNumber,
            });
        }
    } catch(evalError) {
        console.error(`Rule Evaluator: Error evaluating rule ${rule.id}:`, evalError);
    }
  }

  console.log(`Rule Evaluator: Found ${triggeredRules.length} rules meeting trigger conditions (after quiet time check).`);

  // 5. Record the triggered alerts in the database (for non-suppressed alerts)
  if (triggeredRules.length > 0) {
    const triggeredAlertData = triggeredRules.map(tr => ({
      ruleId: tr.ruleId,
      triggeringPrice: tr.triggeringPrice,
      triggeredAt: new Date(), 
    }));
    
    try {
        // Note: We moved the recording of suppressed alerts into the quiet time check block
        // This createMany only handles alerts that WILL be notified.
        const creationResult = await prisma.triggeredAlert.createMany({
            data: triggeredAlertData,
            skipDuplicates: true, // Avoid error if somehow recorded during quiet time check (defensive)
        });
        console.log(`Rule Evaluator: Recorded ${creationResult.count} non-suppressed triggered alerts in DB.`);
    } catch (dbError) {
        console.error(`Rule Evaluator: Failed to record non-suppressed triggered alerts in DB:`, dbError);
    }
  }

  // Send notifications only for rules not suppressed by quiet time
  if (triggeredRules.length > 0) {
    console.log(`Sending notifications for ${triggeredRules.length} triggered rules.`);
    await sendNotifications(triggeredRules);
  }

  console.log('Rule evaluation finished.');
} 