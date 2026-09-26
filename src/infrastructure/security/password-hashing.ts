import * as argon2 from 'argon2';

/**
 * Argon2id parameters following the OWASP Password Storage Cheat Sheet (19 MiB, t=2, p=1).
 * Shared by the auth module and the seed script so hashes are always produced the same way.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/** Returns false (never throws) for malformed hashes so callers can treat it as a failed login. */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
