import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_BYTES = 32;

/** 256-bit URL-safe random token (refresh secrets, verification tokens). */
export function generateOpaqueToken(bytes = DEFAULT_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 hex digest. A fast hash is appropriate here because the inputs are high-entropy
 * random tokens, not user-chosen passwords.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function hexDigestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
