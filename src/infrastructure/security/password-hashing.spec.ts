import { hashPassword, passwordNeedsRehash, verifyPassword } from './password-hashing';

describe('password hashing', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('Correct-horse-1');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'Correct-horse-1')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong')).resolves.toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it('returns false instead of throwing for malformed hashes', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });
});
