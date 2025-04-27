import type { DefaultUser } from "next-auth";
// import type { DefaultSession, User as DefaultUser } from "next-auth"; // DefaultSession unused
import type { JWT as DefaultJWT } from "next-auth/jwt";

// Extend the built-in session types

declare module "next-auth" {
  /**
   * Augment the default User type
   */
  interface User extends DefaultUser {
    // Add custom properties from your Prisma User model here
    id: string;
    quietTimeEnabled?: boolean;
    quietTimeStart?: string | null;
    quietTimeEnd?: string | null;
    quietTimeZone?: string | null;
    // e.g., role: string;
  }

  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context.
   * We keep the default properties but ensure user includes our augmented User type.
   */
  interface Session {
    user: User & {
      // Keep default fields like name, email, image if needed, 
      // DefaultSession["user"] provides these, but User already extends DefaultUser
    };
  }
}

// Extend the built-in JWT types
declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** OpenID ID Token */
    idToken?: string;
    // Add custom properties added in the jwt callback
    id?: string;
    quietTimeEnabled?: boolean;
    quietTimeStart?: string | null;
    quietTimeEnd?: string | null;
    quietTimeZone?: string | null;
    // e.g., role?: string;
  }
} 