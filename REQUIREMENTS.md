# Don't Look At The Chart - Requirements

## 1. Overview

**App Name:** Don't Look At The Chart (DLATC)

**Purpose:** A notification service enabling users to receive cryptocurrency price updates for specified assets without needing to constantly monitor charts. The service aims to reduce the time and anxiety associated with manual price checking.

## 2. Core Functionality

*   **User Management:**
    *   Simple user registration and login (e.g., email/password, OAuth, or magic links).
    *   Ability for users to manage their account settings.
*   **Asset Tracking:**
    *   Users can search for and select cryptocurrencies to track from a comprehensive list (sourced from a reliable data provider).
    *   Users can add and remove assets from their tracked list.
*   **Notification Rules:**
    *   Users can define custom notification triggers for each tracked asset. Examples:
        *   Price reaches a specific target (e.g., BTC hits $75,000).
        *   Price increases/decreases by a certain percentage within a time window (e.g., ETH drops 5% in 1 hour). Maximum configurable time window: 72 hours (3 days).
        *   Price crosses a moving average (potential future enhancement).
    *   Users can manage (create, edit, delete) their notification rules.
*   **Price Data Fetching:**
    *   The system must reliably fetch near real-time price data for a wide range of cryptocurrencies.
    *   Integration with the CoinGecko API (offers a generous free tier).
*   **Notification Delivery:**
    *   Deliver notifications based on triggered rules.
    *   Support for Email and SMS notifications.
    *   Potential future support for other channels (e.g., push notifications, Discord/Telegram bots).
*   **Background Processing:**
    *   A robust background job system to continuously:
        *   Fetch updated price data (target frequency: every 15 minutes) and store it in `PriceHistory`.
        *   Evaluate user-defined rules against current and historical prices.
        *   Trigger notifications when conditions are met.
        *   Periodically prune `PriceHistory` data older than 7 days.
*   **Quiet Time:**
    *   Users can define a "quiet time" period during which non-critical notifications will be suppressed.
*   **Morning Summary:**
    *   Users can opt-in to receive a daily morning email summarizing relevant price changes or triggered notifications from the previous day/overnight period.

## 3. Technical Goals & Considerations

*   **Deployment:** Target deployment on free-tier cloud services (e.g., Vercel, Netlify, Render).
*   **Scalability:** Design the architecture with scalability in mind to handle a growing user base and number of tracked assets/rules with minimal refactoring.
*   **Technology Stack (Vercel Focused):**
    *   **Framework:** Next.js (React) - For frontend UI and API routes (serverless functions).
    *   **Language:** TypeScript (for type safety and maintainability).
    *   **Database:** Vercel Postgres.
    *   **Price Data API:** CoinGecko API.
    *   **Notification Service:** Resend (Email), Twilio (SMS) - Or similar services with good free tiers/integration.
    *   **Background Jobs:** Vercel Cron Jobs (for scheduled price fetching and checks).
    *   **Deployment Platform:** Vercel.
*   **Maintainability:** Clean code practices, leveraging TypeScript.
*   **Cost-Effectiveness:** Prioritize Vercel's free tier capabilities and associated services.

## 4. Non-Functional Requirements

*   **Reliability:** The service should be reliable in fetching prices and sending notifications promptly.
*   **Usability:** Simple and intuitive user interface.
*   **Security:** Basic security measures for user data and authentication.

## 5. Future Enhancements (Ideas)

*   More complex notification rules (e.g., technical indicators).
*   Additional notification channels (Push, Bots).
*   Portfolio tracking features.
*   Basic charting for historical context (ironically).
*   Premium tier for advanced features or higher usage limits.

## 6. Implementation Plan

- [x] Initial Project Setup (`create-next-app`, Requirements Doc)
- [x] Database Schema Definition & Prisma Setup (Vercel Postgres)
- [x] User Authentication Setup (e.g., NextAuth.js)
- [x] CoinGecko API Client Implementation
- [x] Frontend: Basic UI Layout & Pages
- [x] Frontend: Asset Tracking UI (Search, Add, Remove)
- [x] Frontend: Notification Rule Management UI
- [x] Backend: API Endpoints for Assets & Rules (CRUD)
- [ ] Backend: Price Fetching & History Storage Logic (Vercel Cron Job -> API Route)
- [ ] Backend: Notification Rule Evaluation Logic (using Price History)
- [ ] Backend: Price History Pruning Logic
- [ ] Feature: Quiet Time Implementation
- [ ] Feature: Morning Summary Implementation
- [ ] Deployment & Testing on Vercel 