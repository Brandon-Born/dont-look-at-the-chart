import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { signIn } from "next-auth/react"; // Still need signIn for the button
import SignInButton from "@/components/SignInButton"; // Create a dedicated client component for the button

export default async function Home() {
  const user = await getCurrentUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // If user is not logged in, show landing page content
  return (
    <div className="flex flex-col items-center justify-center text-center mt-16">
      <h1 className="text-4xl font-bold text-dracula-cyan mb-4">
        Stop Watching Charts.
      </h1>
      <h2 className="text-2xl font-semibold text-dracula-purple mb-8">
        Get Crypto Price Alerts Delivered.
      </h2>
      <p className="text-lg text-dracula-fg max-w-xl mb-12">
        Don't Look At The Chart monitors cryptocurrency prices for you and sends notifications based on your custom rules via Email or SMS. Stay informed without the stress.
      </p>
      
      {/* Use a Client Component for the button that uses onClick */}
      <SignInButton /> 

    </div>
  );
}
