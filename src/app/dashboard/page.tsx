import { getCurrentUser } from '@/lib/session' // Get user server-side
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  // Protect the route - redirect to home if not logged in
  if (!user) {
    redirect('/')
  }

  return (
    <div className="container mx-auto mt-8">
      <h1 className="text-3xl font-bold text-dracula-purple mb-6">
        Welcome, {user.email}!
      </h1>
      <p className="text-dracula-fg mb-4">
        This is your dashboard. You can manage your tracked assets and notification rules here.
      </p>
      
      {/* Placeholder for future content */}
      <div className="bg-dracula-selection p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-dracula-pink mb-4">Coming Soon</h2>
        <p className="text-dracula-comment">Asset tracking and rule management features will appear here.</p>
      </div>
    </div>
  )
} 