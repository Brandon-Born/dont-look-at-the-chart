import NextAuth, { type NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD || !process.env.EMAIL_FROM) {
  throw new Error('Missing Email provider environment variables')
}

if (!process.env.AUTH_SECRET) {
  throw new Error('Missing AUTH_SECRET environment variable')
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // Max age for verification token (optional)
      // maxAge: 24 * 60 * 60, // 24 hours
    }),
    // Add other providers like Google, GitHub, Credentials here
  ],
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt', // Using JWT for session management
  },
  pages: {
    // signIn: '/auth/signin', // Custom sign-in page (optional)
    verifyRequest: '/auth/verify-request', // Page displayed after email is sent
    // error: '/auth/error', // Error page (optional)
    // newUser: '/auth/new-user' // Optional: Redirect new users to a specific page
  },
  // Callbacks can be used to control session/JWT content or handle events
  callbacks: {
    async session({ session, token }) {
      // Add user ID and other custom properties to the session
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      // Add custom fields here if needed
      // session.user.role = token.role
      return session
    },
    async jwt({ token, user }) {
      // Add custom properties to the JWT token on sign in
      if (user) {
        token.id = user.id
        // Add custom fields here if needed
        // token.role = user.role;
      }
      return token
    },
    // Add other callbacks like signIn, redirect etc. if needed
  },
  // Enable debug messages in development
  debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 