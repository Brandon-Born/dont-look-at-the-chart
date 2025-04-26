import { prisma } from '@/lib/prisma';
import { NotificationRule, PriceHistory, NotificationRuleType, Prisma, User } from '@prisma/client';
import { sendNotifications } from './notificationSender'; // Import the new service
import { toZonedTime, format } from 'date-fns-tz'; // Corrected import: used toZonedTime, removed zonedTimeToUtc
import { isWithinInterval, parse } from 'date-fns'; // Added imports

// Simple cooldown period (in minutes) to prevent rapid re-triggering of the same rule
const RULE_COOLDOWN_MINUTES = 60; 

interface RuleContext {
  rule: NotificationRule;
  latestPrice?: PriceHistory;
  historicalPrices?: PriceHistory[]; // Only populated for % change rules
}

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
 * @returns {boolean} True if it is currently quiet time, false otherwise.
 */
function isQuietTime(user: User): boolean {
  if (!user.quietTimeEnabled || !user.quietTimeStart || !user.quietTimeEnd || !user.quietTimeZone) {
    return false; // Quiet time not enabled or configured
  }

  try {
    const nowUtc = new Date();
    const timeZone = user.quietTimeZone;
    const nowZoned = toZonedTime(nowUtc, timeZone);

    // Parse start and end times relative to the *current date* in the user's timezone
    // This handles the date component correctly for comparisons.
    const startTimeStr = user.quietTimeStart; // e.g., "22:00"
    const endTimeStr = user.quietTimeEnd;   // e.g., "07:00"

    // Create Date objects for start/end times based on today's date in the target timezone
    const startHour = parseInt(startTimeStr.split(':')[0], 10);
    const startMinute = parseInt(startTimeStr.split(':')[1], 10);
    const endHour = parseInt(endTimeStr.split(':')[0], 10);
    const endMinute = parseInt(endTimeStr.split(':')[1], 10);

    let startTime = new Date(nowZoned); // Start with today's date in user's zone
    startTime.setHours(startHour, startMinute, 0, 0);

    let endTime = new Date(nowZoned);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Handle overnight case (start time is later than end time)
    if (startTime > endTime) { 
      // Is current time *after* start OR *before* end?
      // Example: Quiet time 22:00 to 07:00
      // If now is 23:00, it's >= start time (22:00) -> true
      // If now is 06:00, it's < end time (07:00) -> true
      // We need to check against yesterday's end time or tomorrow's start time conceptually,
      // but comparing against the start/end times set on today's date handles this implicitly
      // when combined with the check below.
      
      // If current time is after the start time (e.g., 23:00 >= 22:00)
      if (nowZoned >= startTime) return true;

      // If current time is before the end time (e.g., 06:00 < 07:00)
      // We need to compare against the *next day's* end time effectively.
      // Let's adjust endTime to be tomorrow if necessary for the check.
      let endCheckTime = new Date(endTime);
      endCheckTime.setDate(endCheckTime.getDate() + 1); // End time is on the next day
      
      // Alternatively, simpler approach: check if current time is >= start OR < end
       return nowZoned >= startTime || nowZoned < endTime;

    } else {
      // Normal case (e.g., 09:00 to 17:00)
      return isWithinInterval(nowZoned, { start: startTime, end: endTime });
    }

  } catch (error) {
    console.error(`Error checking quiet time for user ${user.id} (${user.email}):`, error);
    return false; // Fail safe: assume it's not quiet time if error occurs
  }
}

/**
 * Evaluates all active notification rules against the latest price data.
 * @returns {Promise<void>} 
 */
export async function evaluateRules(): Promise<void> {
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
  for (const rule of activeRules) {
    const assetId = rule.trackedAsset.asset.id;
    const latestPrice = latestPricesMap.get(assetId);

    if (!latestPrice) {
      continue; 
    }

    const ruleContext: RuleContext = { rule, latestPrice };
    let conditionMet = false;

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

                    if (startPriceRecord) {
                        const priceChange = latestPrice.price - startPriceRecord.price;
                        const percentChange = (priceChange / startPriceRecord.price) * 100;
                        
                        if (rule.type === NotificationRuleType.PERCENT_CHANGE_INCREASE) {
                            conditionMet = percentChange >= rule.value;
                        } else { 
                            conditionMet = percentChange <= rule.value;
                        }
                    } else {
                        // console.warn(`Rule Evaluator: Missing historical price for rule ${rule.id} time window.`);
                    }
                }
                break;
        }

        if (conditionMet) {
            // ---> Quiet Time Check <--- 
            if (isQuietTime(rule.trackedAsset.user)) {
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