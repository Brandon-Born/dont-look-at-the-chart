import { Resend } from 'resend';
import { AssetSummaryData } from './morningSummaryGenerator'; // Import the interface

// Ensure RESEND_API_KEY is set in your .env file
if (!process.env.RESEND_API_KEY) {
    console.warn("EMAIL SENDER: RESEND_API_KEY environment variable is not set. Email sending will fail.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Replace with your verified sender email from Resend
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com'; 
if (FROM_EMAIL === 'noreply@example.com') {
    console.warn("EMAIL SENDER: FROM_EMAIL environment variable is not set or is using the default placeholder. Please configure a verified sender email in Resend and set the FROM_EMAIL variable.");
}

/**
 * Formats the summary data into an HTML email body.
 * @param summaryData Array of asset summary data.
 * @returns HTML string for the email body.
 */
function formatSummaryEmailHtml(summaryData: AssetSummaryData[]): string {
    let tableRows = ''; // Use let as it's reassigned
    summaryData.forEach(asset => {
        tableRows += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${asset.name} (${asset.symbol})</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${asset.currentPrice !== null ? `$${asset.currentPrice.toFixed(2)}` : 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${asset.changePercent24h === null ? 'black' : asset.changePercent24h >= 0 ? 'green' : 'red'};"> 
                    ${asset.changePercent24h !== null ? `${asset.changePercent24h >= 0 ? '+' : ''}${asset.changePercent24h.toFixed(2)}%` : 'N/A'}
                </td>
            </tr>
        `;
    });

    return `
        <h1>Your Daily Crypto Summary</h1>
        <p>Here's a look at the 24-hour performance of your tracked assets:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Asset</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Current Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">24h Change</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <p style="margin-top: 20px; font-size: 0.8em; color: #666;">
            Prices are approximate and based on available data. Data provided by CoinGecko.
            You can adjust your notification settings in your profile.
        </p>
    `;
}

/**
 * Sends the morning summary email to a user.
 * @param to Recipient email address.
 * @param summaryData Array of asset summary data.
 * @returns {Promise<void>}
 */
export async function sendMorningSummaryEmail(to: string, summaryData: AssetSummaryData[]): Promise<void> {
    if (!process.env.RESEND_API_KEY || FROM_EMAIL === 'noreply@example.com') {
        console.error("Email Sender: Cannot send email due to missing API key or FROM_EMAIL configuration.");
        // Optionally throw an error or just return
        return; 
    }

     if (summaryData.length === 0) {
        console.log(`Email Sender: No summary data to send for ${to}. Skipping email.`);
        return;
    }

    const subject = 'Your Daily Crypto Price Summary';
    const htmlBody = formatSummaryEmailHtml(summaryData);

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject: subject,
            html: htmlBody,
        });

        if (error) {
            console.error(`Email Sender: Failed to send summary email to ${to}:`, error);
            // Handle error appropriately (e.g., retry logic, logging)
        } else {
            console.log(`Email Sender: Morning summary email sent successfully to ${to}. ID: ${data?.id}`);
        }
    } catch (error) {
        console.error(`Email Sender: Exception occurred while sending summary email to ${to}:`, error);
    }
} 