'use client'

import { signIn } from 'next-auth/react'
import React from 'react'

export default function SignInButton() {
  return (
    <button 
      onClick={() => signIn('email')} // Trigger email sign-in flow
      className="bg-dracula-pink hover:bg-opacity-80 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-200 ease-in-out"
    >
      Sign In / Sign Up with Email
    </button>
  )
} 