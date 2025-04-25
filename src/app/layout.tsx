import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Don't Look At The Chart",
  description: "Get crypto price alerts without watching the charts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body 
        className={`${inter.className} bg-dracula-bg text-dracula-fg selection:bg-dracula-selection`} 
      >
        <AuthProvider>
          <Header />
          <main className="min-h-screen p-4 md:p-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
