import type { AuthConfig } from "convex/server";

/**
 * Custom JWT auth for WorkOS users.
 * In Convex dashboard: Authentication → Add provider → Custom JWT.
 * Set applicationID, issuer, and jwks (URL to your JWKS JSON or data URI with public key).
 * Generate RS256 keys and expose public JWKS; sign tokens with private key in Next.js.
 */
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "kcheng-app",
      issuer: "https://kcheng-app",
      jwks: "data:application/json;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJraWQiOiJrY2hlbmctYXBwLTEiLCJuIjoidExYTjdySDVMbV9ySXU4cURKYnNfVldXWmt4NUEwal9sUkRzQnYyN0h3NnhFN2JZRFJzQlVpZko1QnR6UWJzbzFmYmtpclp2dGVmOS1BZEZBSURTdlJaSmdvdnZxbDNOejNOTXlmMi1tWmNrdVJMcDlYMFFyOE1iWHRwSHZQdGF5ZFA5R24zb2w2NWNUNTg0OW52bTZ4ZlJ6ZmowM0IwM2ZLSDhSNER1N2c0TGRCMmVlaFVrc1c3cmJza1lSTGhsTVNzMzhOVW05dWV1NUw0dndtN0ZIdEp3YXlvRUx1SW9LRGppQjNMenI1eDRoRDVtekpnRXNSMzBNNEstWHRGOENtR0dYQmxMYnp5ZzJJSTNmbS1VX0hKSXRYYUo3U3poU0NDMDJfNGh0bXJWWFJZYmk3OVRwaC1jM2xnemF5bVd2X2V0bmZiRnZnelNmU01Qd1RBeE13IiwiZSI6IkFRQUIiLCJ1c2UiOiJzaWciLCJhbGciOiJSUzI1NiJ9XX0=",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
