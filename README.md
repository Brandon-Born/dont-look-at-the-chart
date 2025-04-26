# Don't Look At The Chart (DLATC)

DLATC is a notification service enabling users to receive cryptocurrency price updates for specified assets without needing to constantly monitor charts. The service aims to reduce the time and anxiety associated with manual price checking.

This project is built with Next.js and designed for deployment on Vercel.

## Core Features

*   **User Management:** Simple user registration/login (Email/OAuth via NextAuth.js).
*   **Asset Tracking:** Search, select, and track cryptocurrencies using CoinGecko data.
*   **Notification Rules:** Define custom triggers (price targets, percentage changes) for tracked assets.
*   **Notification Delivery:** Receive alerts via Email (Resend). SMS (Twilio) is planned.
*   **Background Processing:** Vercel Cron Jobs handle regular price fetching, rule evaluation, and data pruning.
*   **Quiet Time:** Suppress non-critical notifications during user-defined periods.
*   **Morning Summary:** Optional daily email summary of price movements.

## Technology Stack

*   **Framework:** Next.js 15 (React, App Router)
*   **Language:** TypeScript
*   **Database:** Vercel Postgres (via Prisma ORM)
*   **Authentication:** NextAuth.js v4
*   **Styling:** Tailwind CSS + Shadcn/ui
*   **API Client (Crypto):** CoinGecko API
*   **Notification Services:** Resend (Email), Twilio (SMS - deferred)
*   **Background Jobs:** Vercel Cron Jobs
*   **Deployment:** Vercel

## Getting Started

1.  **Prerequisites:**
    *   Node.js and npm/yarn/pnpm/bun
    *   Access to a PostgreSQL database (Vercel Postgres recommended)
    *   CoinGecko API Key (Free tier available)
    *   Resend API Key
    *   NextAuth.js configuration (Credentials, OAuth providers)

2.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd dont-look-at-the-chart
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install / pnpm install / bun install
    ```

4.  **Set up environment variables:**
    *   Create a `.env` file in the root directory.
    *   Add the following variables (replace placeholders with your actual values):
        ```env
        DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require"

        # NextAuth Configuration
        NEXTAUTH_URL="http://localhost:3000" # Use your deployment URL in production
        NEXTAUTH_SECRET="YOUR_NEXTAUTH_SECRET" # Generate a strong secret: `openssl rand -base64 32`
        # Add provider secrets (e.g., GITHUB_ID, GITHUB_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

        # Service API Keys
        COINGECKO_API_KEY="YOUR_COINGECKO_API_KEY" # Optional, increases rate limits
        RESEND_API_KEY="YOUR_RESEND_API_KEY"
        # TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID" # Add when SMS is implemented
        # TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
        # TWILIO_PHONE_NUMBER="YOUR_TWILIO_PHONE_NUMBER"
        ```

5.  **Set up the database:**
    ```bash
    npx prisma migrate dev --name init
    npx prisma db seed # If you have a seed script
    ```

6.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

This application is designed for deployment on [Vercel](https://vercel.com/).

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the project into Vercel.
3.  Configure the Environment Variables in the Vercel project settings (use the same ones from your `.env` file, ensuring `NEXTAUTH_URL` points to your production domain).
4.  Set up Vercel Postgres and link it to your project.
5.  Configure Vercel Cron Jobs based on the routes in `app/api/cron/` and settings in `vercel.json`.
6.  Deploy!

## Further Information

*   See `REQUIREMENTS.md` for detailed feature specifications.
*   See `ARCHITECTURE.md` for a deeper dive into the application structure.
