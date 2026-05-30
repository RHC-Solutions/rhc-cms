/**
 * Returns the NextAuth secret from the environment.
 * Throws at runtime if not configured — never falls back to a default,
 * because a known secret allows trivial JWT forgery.
 */
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'NEXTAUTH_SECRET is not configured. Set it in the environment to a strong random value.'
    );
  }
  return secret;
}
