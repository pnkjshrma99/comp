import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  multiSessionClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { ac, allRoles } from './permissions';

/**
 * Auth client for browser-side authentication.
 *
 * Points directly to the API server. Cross-subdomain cookies (.trycomp.ai)
 * ensure the session works across all apps (app, portal, etc.).
 *
 * For server-side session validation, use auth.ts instead.
 *
 * SECURITY NOTE: Authentication is handled via httpOnly cookies set by the API.
 * We do not store tokens in localStorage to prevent XSS attacks.
 */
// Use the app's own URL for auth requests so cookies are same-origin.
// Next.js rewrites /api/auth/* -> API server in next.config.ts
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    organizationClient({
      ac,
      roles: allRoles,
    }),
    adminClient(),
    emailOTPClient(),
    magicLinkClient(),
    multiSessionClient(),
  ],
  // Authentication is handled via httpOnly cookies - no localStorage tokens needed
});

export const {
  signIn,
  signOut,
  useSession,
  useActiveOrganization,
  organization,
  useListOrganizations,
  useActiveMember,
} = authClient;
