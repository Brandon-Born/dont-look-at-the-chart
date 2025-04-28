import { User, NotificationRule, PriceHistory, NotificationRuleType, Asset, TrackedAsset, TriggeredAlert } from '@prisma/client';

// --- Define Mock Functions FIRST ---
const mockNotificationRuleFindMany = jest.fn();
const mockPriceHistoryFindMany = jest.fn();
const mockPriceHistoryFindFirst = jest.fn();
const mockTriggeredAlertCreate = jest.fn();
const mockTriggeredAlertCreateMany = jest.fn();
const mockSendNotificationsFn = jest.fn();
const mockIsQuietTimeFnImpl = jest.fn();

// --- Apply Mocks using jest.mock SECOND ---
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notificationRule: { findMany: mockNotificationRuleFindMany },
    priceHistory: { findMany: mockPriceHistoryFindMany, findFirst: mockPriceHistoryFindFirst },
    triggeredAlert: { create: mockTriggeredAlertCreate, createMany: mockTriggeredAlertCreateMany },
  }
}));
jest.mock('./notificationSender', () => ({
  sendNotifications: mockSendNotificationsFn,
}));

// --- Group Mock Functions for Test Access THIRD ---
const mockPrisma = {
  notificationRule: { findMany: mockNotificationRuleFindMany },
  priceHistory: { findMany: mockPriceHistoryFindMany, findFirst: mockPriceHistoryFindFirst },
  triggeredAlert: { create: mockTriggeredAlertCreate, createMany: mockTriggeredAlertCreateMany },
};
const mockSendNotifications = mockSendNotificationsFn;
const mockIsQuietTime = mockIsQuietTimeFnImpl;

// --- Imports needed AFTER mocks --- 
// Import evaluateRules which uses the mocked dependencies
import { evaluateRules } from './ruleEvaluator';
// We still need the *real* isQuietTime for its own tests
import { isQuietTime as actual_isQuietTime_for_tests } from './ruleEvaluator';

// Helper function to create a mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  emailVerified: null,
  phoneNumber: null,
  phoneNumberVerified: null,
  passwordHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  quietTimeEnabled: true,
  quietTimeStart: '22:00',
  quietTimeEnd: '07:00',
  quietTimeZone: 'America/New_York',
  morningSummaryEnabled: false,
  morningSummaryTime: '08:00',
  ...overrides,
});

describe('isQuietTime', () => {
  // Use the explicitly imported real function
  test('should return false if quiet time is disabled', () => {
    const user = createMockUser({ quietTimeEnabled: false });
    expect(actual_isQuietTime_for_tests(user)).toBe(false);
  });

  test('should return false if quiet time settings are incomplete', () => {
    const user1 = createMockUser({ quietTimeStart: null });
    const user2 = createMockUser({ quietTimeEnd: null });
    const user3 = createMockUser({ quietTimeZone: null });
    const dummyDate = new Date();
    expect(actual_isQuietTime_for_tests(user1, dummyDate)).toBe(false);
    expect(actual_isQuietTime_for_tests(user2, dummyDate)).toBe(false);
    expect(actual_isQuietTime_for_tests(user3, dummyDate)).toBe(false);
  });

  describe('Standard Quiet Time (09:00 - 17:00)', () => {
    const user = createMockUser({ quietTimeStart: '09:00', quietTimeEnd: '17:00', quietTimeZone: 'America/New_York' });
    test('should return true if current time is within the standard period', () => {
      const testTimeUtc = new Date('2024-01-15T19:00:00Z'); // 14:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(true);
    });
    test('should return false if current time is before the standard period', () => {
      const testTimeUtc = new Date('2024-01-15T13:00:00Z'); // 08:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
    test('should return false if current time is after the standard period', () => {
      const testTimeUtc = new Date('2024-01-15T22:00:00Z'); // 17:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
    test('should return false if current time is way after the standard period', () => {
      const testTimeUtc = new Date('2024-01-15T23:00:00Z'); // 18:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
  });

  describe('Overnight Quiet Time (22:00 - 07:00)', () => {
     const user = createMockUser({ quietTimeStart: '22:00', quietTimeEnd: '07:00', quietTimeZone: 'America/New_York' });
     test('should return true if current time is after start (e.g., 23:00)', () => {
      const testTimeUtc = new Date('2024-01-16T04:00:00Z'); // 23:00 EST (prev day)
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(true);
    });
    test('should return true if current time is before end (e.g., 06:00)', () => {
      const testTimeUtc = new Date('2024-01-16T11:00:00Z'); // 06:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(true);
    });
    test('should return true if current time is exactly start time (22:00)', () => {
        const testTimeUtc = new Date('2024-01-16T03:00:00Z'); // 22:00 EST (prev day)
        expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(true);
    });
    test('should return false if current time is exactly end time (07:00)', () => {
        const testTimeUtc = new Date('2024-01-16T12:00:00Z'); // 07:00 EST
        expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
    test('should return false if current time is before start (e.g., 21:00)', () => {
      const testTimeUtc = new Date('2024-01-16T02:00:00Z'); // 21:00 EST (prev day)
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
    test('should return false if current time is after end (e.g., 08:00)', () => {
      const testTimeUtc = new Date('2024-01-16T13:00:00Z'); // 08:00 EST
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
  });

  describe('Different Timezone (Europe/London)', () => {
     const user = createMockUser({ quietTimeStart: '23:00', quietTimeEnd: '08:00', quietTimeZone: 'Europe/London' });
     test('should return true if within quiet time (e.g., 02:00 London time)', () => {
      const testTimeUtc = new Date('2024-01-16T02:00:00Z'); // 02:00 GMT
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(true);
    });
    test('should return false if outside quiet time (e.g., 10:00 London time)', () => {
      const testTimeUtc = new Date('2024-01-16T10:00:00Z'); // 10:00 GMT
      expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    });
  });

  test('should handle errors during processing and return false', () => {
    const user = createMockUser({ quietTimeZone: 'Invalid/Timezone' });
    const testTimeUtc = new Date();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(actual_isQuietTime_for_tests(user, testTimeUtc)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

// --- Tests for evaluateRules ---
describe('evaluateRules', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsQuietTime.mockReturnValue(false);
  });

  test('should do nothing if no active rules are found', async () => {
    mockPrisma.notificationRule.findMany.mockResolvedValue([]);
    await evaluateRules(mockIsQuietTime);
    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).not.toHaveBeenCalled();
    expect(mockSendNotifications).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.createMany).not.toHaveBeenCalled();
  });

  test('should trigger notification for PRICE_TARGET_ABOVE', async () => {
    const mockUser = createMockUser({ id: 'user-1', email: 'user1@test.com' });
    const mockAsset: Asset = { id: 'asset-btc', coingeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-1',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-1',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PRICE_TARGET_ABOVE,
      value: 50000,
      timeWindowHours: null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };
    const mockPrice: PriceHistory = {
      id: 'price-1',
      assetId: mockAsset.id,
      price: 51000,
      timestamp: new Date(),
    };

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockPrice]);
    mockPrisma.triggeredAlert.createMany.mockResolvedValue({ count: 1 });

    await evaluateRules(mockIsQuietTime);

    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledTimes(1);
    expect(mockIsQuietTime).toHaveBeenCalledWith(mockUser, expect.any(Date));
    expect(mockSendNotifications).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();

    expect(mockSendNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        ruleId: mockRule.id,
        assetSymbol: mockAsset.symbol.toUpperCase(),
        ruleType: mockRule.type,
        ruleValue: mockRule.value,
        triggeringPrice: mockPrice.price,
        userEmail: mockUser.email,
      }),
    ]);

     expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          ruleId: mockRule.id,
          triggeringPrice: mockPrice.price,
        }),
      ]),
      skipDuplicates: true,
    });
  });

  test('should trigger notification for PRICE_TARGET_BELOW', async () => {
    const mockUser = createMockUser({ id: 'user-2', email: 'user2@test.com' });
    const mockAsset: Asset = { id: 'asset-eth', coingeckoId: 'ethereum', symbol: 'ETH', name: 'Ethereum' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-2',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-2',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PRICE_TARGET_BELOW,
      value: 3000,
      timeWindowHours: null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };
    const mockPrice: PriceHistory = {
      id: 'price-2',
      assetId: mockAsset.id,
      price: 2950, // Price is below target
      timestamp: new Date(),
    };

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockPrice]);
    mockPrisma.triggeredAlert.createMany.mockResolvedValue({ count: 1 });

    await evaluateRules(mockIsQuietTime);

    expect(mockIsQuietTime).toHaveBeenCalledWith(mockUser, expect.any(Date));
    expect(mockSendNotifications).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();

    expect(mockSendNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        ruleId: mockRule.id,
        assetSymbol: mockAsset.symbol.toUpperCase(),
        ruleType: mockRule.type,
        ruleValue: mockRule.value,
        triggeringPrice: mockPrice.price,
        userEmail: mockUser.email,
      }),
    ]);

    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          ruleId: mockRule.id,
          triggeringPrice: mockPrice.price,
        }),
      ]),
      skipDuplicates: true,
    });
  });

  test('should trigger notification for PERCENT_CHANGE_INCREASE', async () => {
    const mockUser = createMockUser({ id: 'user-3', email: 'user3@test.com' });
    const mockAsset: Asset = { id: 'asset-sol', coingeckoId: 'solana', symbol: 'SOL', name: 'Solana' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-3',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const ruleTimeWindowHours = 24;
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-3',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PERCENT_CHANGE_INCREASE,
      value: 10, // Target: +10%
      timeWindowHours: ruleTimeWindowHours,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };

    // Set up current and historical prices
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() - ruleTimeWindowHours);

    const mockCurrentPrice: PriceHistory = {
      id: 'price-3-now',
      assetId: mockAsset.id,
      price: 115, // Current price
      timestamp: now,
    };
    const mockPastPrice: PriceHistory = {
      id: 'price-3-past',
      assetId: mockAsset.id,
      price: 100, // Price 24 hours ago
      timestamp: startTime, // Timestamp within the window
    };
    // Price increased from 100 to 115 (+15%), which is >= 10%

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockCurrentPrice]); // Latest price
    mockPrisma.priceHistory.findFirst.mockResolvedValue(mockPastPrice); // Historical price
    mockPrisma.triggeredAlert.createMany.mockResolvedValue({ count: 1 });

    await evaluateRules(mockIsQuietTime);

    // Verify mocks
    expect(mockIsQuietTime).toHaveBeenCalledWith(mockUser, expect.any(Date));
    expect(mockPrisma.priceHistory.findFirst).toHaveBeenCalledWith({
      where: {
        assetId: mockAsset.id,
        timestamp: { gte: expect.any(Date) }, // Check that a start time was calculated
      },
      orderBy: { timestamp: 'asc' },
    });
    expect(mockSendNotifications).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledTimes(1);

    // Verify notification content
    expect(mockSendNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        ruleId: mockRule.id,
        ruleType: mockRule.type,
        triggeringPrice: mockCurrentPrice.price,
        // Optional: could also check ruleValue or calculated % change if needed
      }),
    ]);

     // Verify triggered alert recording
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
            expect.objectContaining({ ruleId: mockRule.id, triggeringPrice: mockCurrentPrice.price })
        ]),
        skipDuplicates: true,
    });
  });

  test('should trigger notification for PERCENT_CHANGE_DECREASE', async () => {
    const mockUser = createMockUser({ id: 'user-4', email: 'user4@test.com' });
    const mockAsset: Asset = { id: 'asset-ada', coingeckoId: 'cardano', symbol: 'ADA', name: 'Cardano' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-4',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const ruleTimeWindowHours = 4;
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-4',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PERCENT_CHANGE_DECREASE,
      value: 5, // Target: 5% decrease (represented as a positive number)
      timeWindowHours: ruleTimeWindowHours,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };

    // Set up current and historical prices
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() - ruleTimeWindowHours);

    const mockCurrentPrice: PriceHistory = {
      id: 'price-4-now',
      assetId: mockAsset.id,
      price: 0.45, // Current price
      timestamp: now,
    };
    const mockPastPrice: PriceHistory = {
      id: 'price-4-past',
      assetId: mockAsset.id,
      price: 0.50, // Price 4 hours ago
      timestamp: startTime, 
    };
    // Price decreased from 0.50 to 0.45 (-10%), which triggers a rule set for a 5% decrease 
    // (-10 is <= -5)

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockCurrentPrice]);
    mockPrisma.priceHistory.findFirst.mockResolvedValue(mockPastPrice);
    mockPrisma.triggeredAlert.createMany.mockResolvedValue({ count: 1 });

    await evaluateRules(mockIsQuietTime);

    // Verify mocks
    expect(mockIsQuietTime).toHaveBeenCalledWith(mockUser, expect.any(Date));
    expect(mockPrisma.priceHistory.findFirst).toHaveBeenCalledWith({
      where: {
        assetId: mockAsset.id,
        timestamp: { gte: expect.any(Date) },
      },
      orderBy: { timestamp: 'asc' },
    });
    expect(mockSendNotifications).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();

    // Verify notification content
    expect(mockSendNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        ruleId: mockRule.id,
        ruleType: mockRule.type,
        triggeringPrice: mockCurrentPrice.price,
        ruleValue: 5, // Check that the positive target value is passed/checked
      }),
    ]);

     // Verify triggered alert recording
    expect(mockPrisma.triggeredAlert.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
            expect.objectContaining({ ruleId: mockRule.id, triggeringPrice: mockCurrentPrice.price })
        ]),
        skipDuplicates: true,
    });
  });

  test('should NOT trigger notification if within cooldown period', async () => {
    const mockUser = createMockUser({ id: 'user-cool', email: 'cool@test.com' });
    const mockAsset: Asset = { id: 'asset-btc', coingeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-cool',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    // Set last triggered time to 30 minutes ago (within the default 60 min cooldown)
    const lastTriggeredTime = new Date();
    lastTriggeredTime.setMinutes(lastTriggeredTime.getMinutes() - 30);
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-cool',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PRICE_TARGET_ABOVE,
      value: 60000,
      timeWindowHours: null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: lastTriggeredTime, // Set on the rule itself (may not be strictly needed if triggeredAlerts is used)
      trackedAsset: mockTrackedAsset,
      // Provide a recent triggered alert
      triggeredAlerts: [{ 
        id: 'alert-recent', 
        ruleId: 'rule-cool', 
        triggeredAt: lastTriggeredTime, 
        triggeringPrice: 61000 
      }], 
    };
    const mockPrice: PriceHistory = {
      id: 'price-cool',
      assetId: mockAsset.id,
      price: 62000, // Price is still above target
      timestamp: new Date(),
    };

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockPrice]);
    // No need to mock createMany as it shouldn't be called

    await evaluateRules(mockIsQuietTime);

    // Verify rule and price were checked
    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledTimes(1);

    // Verify NO notification or alert creation happened
    expect(mockIsQuietTime).not.toHaveBeenCalled(); // Check shouldn't even be reached
    expect(mockSendNotifications).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.createMany).not.toHaveBeenCalled();
  });

  test('should record alert but NOT notify if quiet time is active', async () => {
    const mockUser = createMockUser({ 
      id: 'user-quiet', 
      email: 'quiet@test.com', 
      quietTimeEnabled: true, // Ensure quiet time is enabled in mock user data
      // quietTimeStart/End/Zone don't strictly matter here as we mock the check fn
    });
    const mockAsset: Asset = { id: 'asset-btc', coingeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-quiet',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-quiet',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PRICE_TARGET_ABOVE,
      value: 70000,
      timeWindowHours: null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [], // No recent triggers
    };
    const mockPrice: PriceHistory = {
      id: 'price-quiet',
      assetId: mockAsset.id,
      price: 71000, // Price is above target
      timestamp: new Date(),
    };

    // --- Mock quiet time to be TRUE for this user ---
    mockIsQuietTime.mockReturnValue(true);

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockPrice]);
    // Mock the single create call for suppressed alert
    mockPrisma.triggeredAlert.create.mockResolvedValue({ 
        id: 'alert-suppressed', 
        ruleId: mockRule.id, 
        triggeredAt: new Date(), 
        triggeringPrice: mockPrice.price 
    }); 

    await evaluateRules(mockIsQuietTime);

    // Verify rule and price were checked
    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledTimes(1);
    // Verify quiet time *was* checked
    expect(mockIsQuietTime).toHaveBeenCalledWith(mockUser, expect.any(Date));
    
    // Verify NO notification was sent and createMany wasn't used
    expect(mockSendNotifications).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.createMany).not.toHaveBeenCalled();

    // Verify alert *was* recorded via prisma.triggeredAlert.create (for suppressed)
    expect(mockPrisma.triggeredAlert.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.triggeredAlert.create).toHaveBeenCalledWith({
      data: {
        ruleId: mockRule.id,
        triggeringPrice: mockPrice.price,
        triggeredAt: expect.any(Date),
      },
    });
  });

  test('should skip rule evaluation if latest price data is missing', async () => {
    const mockUser = createMockUser({ id: 'user-no-price', email: 'noprice@test.com' });
    const mockAsset: Asset = { id: 'asset-missing', coingeckoId: 'missingcoin', symbol: 'MISS', name: 'MissingCoin' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-missing',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-missing',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PRICE_TARGET_ABOVE,
      value: 100,
      timeWindowHours: null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };

    // Mock rules, but return NO price data for the relevant asset
    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([]); // Empty price history

    await evaluateRules(mockIsQuietTime);

    // Verify rule and price fetches were attempted
    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledTimes(1);

    // Verify NO notification/alert actions occurred
    expect(mockIsQuietTime).not.toHaveBeenCalled();
    expect(mockSendNotifications).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.createMany).not.toHaveBeenCalled();
    // Ensure findFirst wasn't called either (as it's only for % rules after latest price is found)
    expect(mockPrisma.priceHistory.findFirst).not.toHaveBeenCalled();
  });

  test('should not trigger PERCENT_CHANGE rule if historical price data is missing', async () => {
    const mockUser = createMockUser({ id: 'user-no-hist', email: 'nohist@test.com' });
    const mockAsset: Asset = { id: 'asset-hist-miss', coingeckoId: 'histcoin', symbol: 'HIST', name: 'HistCoin' };
    const mockTrackedAsset: TrackedAsset & { asset: Asset; user: User } = {
      id: 'tracked-hist-miss',
      userId: mockUser.id,
      assetId: mockAsset.id,
      createdAt: new Date(),
      asset: mockAsset,
      user: mockUser,
    };
    const ruleTimeWindowHours = 12;
    const mockRule: NotificationRule & { trackedAsset: TrackedAsset & { asset: Asset; user: User }; triggeredAlerts: TriggeredAlert[] } = {
      id: 'rule-hist-miss',
      trackedAssetId: mockTrackedAsset.id,
      type: NotificationRuleType.PERCENT_CHANGE_INCREASE,
      value: 5, // Target: +5%
      timeWindowHours: ruleTimeWindowHours,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      trackedAsset: mockTrackedAsset,
      triggeredAlerts: [],
    };
    const mockCurrentPrice: PriceHistory = {
      id: 'price-hist-now',
      assetId: mockAsset.id,
      price: 105, // Current price exists
      timestamp: new Date(),
    };

    mockPrisma.notificationRule.findMany.mockResolvedValue([mockRule]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([mockCurrentPrice]);
    // --- Mock findFirst to return null (no historical data found) ---
    mockPrisma.priceHistory.findFirst.mockResolvedValue(null); 

    await evaluateRules(mockIsQuietTime);

    // Verify rule and price fetches were attempted, including findFirst
    expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceHistory.findFirst).toHaveBeenCalledTimes(1); // Verify historical fetch was attempted
    expect(mockPrisma.priceHistory.findFirst).toHaveBeenCalledWith({
        where: {
            assetId: mockAsset.id,
            timestamp: { gte: expect.any(Date) },
        },
        orderBy: { timestamp: 'asc' },
    });

    // Verify NO notification/alert actions occurred
    expect(mockIsQuietTime).not.toHaveBeenCalled(); // Shouldn't be called if conditionMet remains false
    expect(mockSendNotifications).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.create).not.toHaveBeenCalled();
    expect(mockPrisma.triggeredAlert.createMany).not.toHaveBeenCalled();
  });

  // Add more tests for different scenarios here...

});

// Tests for evaluateRules would go here... 