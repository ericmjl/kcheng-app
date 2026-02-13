/**
 * Get the current user id from the Convex auth token (JWT sub claim).
 * Throws if not authenticated.
 */
export async function requireUserId(ctx: {
  auth: { getUserIdentity(): Promise<{ subject?: string } | null> };
}): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }
  return identity.subject;
}
