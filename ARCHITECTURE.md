# DLATC Architecture Document

This document outlines the architecture of the "Don't Look At The Chart" (DLATC) application, based on the implemented codebase.

## 1. Overview

DLATC is a web application built with Next.js (App Router) enabling users to track cryptocurrency prices and receive notifications based on custom rules. It leverages Vercel for deployment, hosting, serverless functions (API Routes), cron jobs, and database (Vercel Postgres).

## 2. Technology Stack

*   **Framework:** Next.js 15 (React)
*   **Language:** TypeScript
*   **Database:** Vercel Postgres (via Prisma ORM)
*   **Authentication:** NextAuth.js (v4, Credentials/Email/OAuth - inferred from schema)
*   **Styling:** Tailwind CSS + Shadcn/ui components
*   **API Client (Crypto):** Custom client for CoinGecko API (`src/lib/coingecko.ts`)
*   **Notification Services:**
    *   Email: Resend (`resend` package, `src/lib/emailSender.ts`, `src/lib/notificationSender.ts`)
    *   SMS: Twilio (`twilio` package - likely integrated within `src/lib/notificationSender.ts` or similar, though not explicitly confirmed in file listing)
*   **Background Jobs:** Vercel Cron Jobs triggering Next.js API Routes (`app/api/cron/`)
*   **Validation:** Zod (`zod` package)
*   **Deployment:** Vercel

## 3. Code Structure

*   **`app/`:** Next.js App Router directory.
    *   **`app/api/`:** Serverless API routes.
        *   **`app/api/cron/`:** API routes triggered by Vercel Cron Jobs (e.g., price fetching, rule evaluation).
    *   **`app/(pages)/`** (Inferred): Likely contains the main application pages/routes for the UI.
*   **`src/`:** Main application source code.
    *   **`src/components/`:** Reusable React components (likely using Shadcn/ui).
    *   **`src/lib/`:** Core backend logic, utilities, and service clients.
        *   `prisma.ts`: Prisma client setup.
        *   `coingecko.ts`: CoinGecko API interaction.
        *   `ruleEvaluator.ts`: Core logic for checking notification rules against price data.
        *   `notificationSender.ts`, `emailSender.ts`: Handles sending notifications via different channels.
        *   `morningSummary*.ts`: Logic for the daily summary feature.
        *   `session.ts`: Session/Auth related utilities.
        *   `utils.ts`, `timezones.ts`: General utilities.
    *   **`src/hooks/`:** Custom React hooks.
    *   **`src/types/`:** TypeScript type definitions.
    *   **`src/app/`** (Potentially legacy or specific app logic): Needs clarification if separate from root `app/`.
*   **`prisma/`:** Database schema (`schema.prisma`) and migrations.
*   **`public/`:** Static assets.
*   **Configuration Files:** `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `package.json`, `vercel.json`.

## 4. Data Flow & Key Processes

1.  **User Authentication:** Handled by NextAuth.js, storing user data and sessions in the Postgres database via the Prisma adapter.
2.  **Asset Tracking & Rule Management:**
    *   Frontend UI (in `src/components/`, `app/(pages)/`) allows users to search/add assets and define notification rules.
    *   API routes (likely in `app/api/`) handle CRUD operations for `TrackedAsset` and `NotificationRule`, interacting with the database via Prisma (`src/lib/prisma.ts`).
3.  **Price Fetching (Cron Job):**
    *   A Vercel Cron Job periodically triggers an API route (e.g., `app/api/cron/fetch-prices/route.ts`).
    *   This route uses `src/lib/coingecko.ts` to fetch current prices for all actively tracked assets.
    *   Fetched prices are stored in the `PriceHistory` table via Prisma.
4.  **Rule Evaluation (Cron Job):**
    *   A Vercel Cron Job periodically triggers an API route (e.g., `app/api/cron/evaluate-rules/route.ts`).
    *   This route fetches relevant `NotificationRule`s and recent `PriceHistory`.
    *   `src/lib/ruleEvaluator.ts` processes the rules against the price data.
    *   If a rule's conditions are met and it hasn't been triggered recently (checking `lastTriggeredAt`), a notification is queued/triggered.
    *   The `TriggeredAlert` table is updated, and `lastTriggeredAt` on the `NotificationRule` is potentially updated.
5.  **Notification Delivery:**
    *   Triggered rules invoke `src/lib/notificationSender.ts`.
    *   This service checks user preferences (e.g., quiet time via `src/lib/timezones.ts` and `User` settings) and determines the delivery channel (Email/SMS).
    *   It uses specific senders (`src/lib/emailSender.ts` for Resend, potentially another for Twilio) to dispatch the notification.
6.  **Morning Summary (Cron Job):**
    *   A Vercel Cron Job triggers an API route (likely related to `src/lib/morningSummaryScheduler.ts`).
    *   `src/lib/morningSummaryGenerator.ts` fetches relevant price data or triggered alerts for opted-in users.
    *   `src/lib/emailSender.ts` sends the summary email.
7.  **Data Pruning (Cron Job):**
    *   A Vercel Cron Job triggers an API route to delete old entries from `PriceHistory`.

## 5. Database Schema

*   Uses Prisma with Vercel Postgres.
*   Key Models: `User`, `Asset`, `TrackedAsset`, `NotificationRule`, `PriceHistory`, `TriggeredAlert`.
*   Includes standard NextAuth.js models (`Account`, `Session`, `VerificationToken`).
*   Relationships are defined (e.g., User -> TrackedAsset -> NotificationRule, Asset -> PriceHistory).
*   Indexes are present for performance (`@@index`).

## 6. Proposed Improvements & Considerations

1.  **Refine Cron Job Logic:**
    *   **Staggering:** Ensure cron jobs (price fetching, rule evaluation, summaries) are sufficiently staggered to avoid overloading the database or hitting API rate limits simultaneously.
    *   **Error Handling & Retries:** Implement robust error handling within cron job API routes (e.g., for CoinGecko API failures, database issues, notification service errors). Consider simple retry mechanisms for transient errors.
    *   **Idempotency:** Design cron job logic to be idempotent where possible (running it multiple times with the same input should produce the same result without side effects), especially for rule evaluation. Check if `lastTriggeredAt` logic sufficiently handles this.
2.  **Rule Evaluation Optimization:**
    *   As the number of users/rules grows, `src/lib/ruleEvaluator.ts` might become a bottleneck. Consider optimizing queries to fetch only necessary data. Fetching all rules and recent history for *all* assets might become inefficient. Fetch data per user or per asset being processed.
    *   **Batching:** Process rules in batches rather than all at once if performance becomes an issue.
3.  **Notification Service Abstraction:**
    *   While `notificationSender.ts` seems to exist, ensure it provides a clean abstraction over Resend/Twilio. This makes it easier to add new channels (e.g., Push Notifications, Discord) later without modifying the core rule evaluation logic.
4.  **State Management (Frontend):**
    *   Review frontend state management. For complex interactions, consider libraries like Zustand or Jotai if simple `useState`/`useContext` becomes hard to manage. (Depends on actual UI complexity).
5.  **Testing:**
    *   Introduce unit tests for critical logic (e.g., `ruleEvaluator.ts`, `coingecko.ts`, notification formatting).
    *   Consider integration tests for API routes and key user flows.
6.  **Security Hardening:**
    *   **Input Validation:** Ensure all API route inputs (especially those from cron jobs and user interactions) are rigorously validated using Zod.
    *   **Rate Limiting:** Implement rate limiting on sensitive API endpoints to prevent abuse. Vercel offers some built-in capabilities.
    *   **Authentication Checks:** Double-check that all API routes modifying user-specific data properly verify authentication and authorization using `src/lib/session.ts` or similar NextAuth utilities.
7.  **Monitoring & Logging:**
    *   Integrate Vercel's logging or a third-party logging service to monitor cron job execution, API errors, and notification delivery success/failures.
8.  **Twilio Integration Confirmation:** The `twilio` package is present, but its usage isn't explicitly confirmed in the file listing. Verify its integration within `notificationSender.ts` or related files and ensure proper configuration (API keys, phone numbers). *Self-correction: The REQUIREMENTS.md notes this is deferred.*
9.  **`src/app/` Directory:** Clarify the purpose of `src/app/` if it exists alongside the root `app/` directory. It might be legacy from Pages Router or contain specific configurations. If unused, consider removing it.
10. **Quiet Time Timezone Handling:** Ensure the `quietTimeZone` logic (`src/lib/timezones.ts`) correctly compares the user's quiet time range (potentially spanning midnight) against the *current time in their specified timezone* during notification sending. Libraries like `date-fns-tz` are suitable for this.
11. **Price History Pruning:** Confirm the pruning logic efficiently deletes old data without causing significant database load. Using the `timestamp` index is good. Ensure the cron job frequency and deletion batch size are reasonable. 