import { randomBytes } from 'node:crypto';

import { type AiConfig } from '../../config/ai.config';
import { EncryptionService } from './encryption.service';

function service(key = randomBytes(32)): EncryptionService {
  return new EncryptionService({ encryptionKey: key } as AiConfig);
}

describe('EncryptionService', () => {
  it('round-trips and never returns the plaintext in the payload', () => {
    const encryption = service();
    const payload = encryption.encrypt('sk-live-secret-key');

    expect(payload.startsWith('v1:')).toBe(true);
    expect(payload).not.toContain('sk-live-secret-key');
    expect(encryption.decrypt(payload)).toBe('sk-live-secret-key');
  });

  it('uses a fresh IV for every encryption', () => {
    const encryption = service();
    expect(encryption.encrypt('same')).not.toBe(encryption.encrypt('same'));
  });

  it('rejects tampered ciphertext and foreign keys', () => {
    const encryption = service();
    const [version, iv, tag, data] = encryption.encrypt('secret').split(':');
    const flipped = Buffer.from(data ?? '', 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      encryption.decrypt([version, iv, tag, flipped.toString('base64')].join(':')),
    ).toThrow();
    expect(() => service().decrypt(encryption.encrypt('secret'))).toThrow();
    expect(() => encryption.decrypt('v9:a:b:c')).toThrow(
      'Unsupported or malformed encrypted payload',
    );
  });
});
