import type { DefaultSession, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Extend the built-in session types

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's database id. */
      id: string;
      // Add other custom properties here if you extend the session callback
      // e.g., role: string;
    } & DefaultSession["user"]; // Keep the default properties like name, email, image
  }

  // If you need to augment the User model type itself (optional)
  // interface User {
  //   // Add custom properties from your Prisma User model here
  //   // e.g., role: string;
  // }
}

// Extend the built-in JWT types
declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    idToken?: string;
    // Add custom properties added in the jwt callback
    id?: string;
    // e.g., role?: string;
  }
} 