'use client'

import React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="bg-dracula-selection p-4 shadow-md">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href={session ? '/dashboard' : '/'} className="text-dracula-cyan hover:text-dracula-pink text-xl font-bold">
          Don't Look At The Chart
        </Link>
        
        <div>
          {status === 'authenticated' && (
            <button
              onClick={() => signOut()} 
              className="bg-dracula-red hover:bg-opacity-80 text-dracula-fg font-semibold py-2 px-4 rounded text-sm"
            >
              Sign Out
            </button>
          )}
          {/* Add Sign In button here if needed for non-logged-in pages */}
        </div>
      </nav>
    </header>
  )
} 