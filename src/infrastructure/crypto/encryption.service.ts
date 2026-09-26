import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { aiConfig, type AiConfig } from '../../config/ai.config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const CURRENT_VERSION = 'v1';

/**
 * Authenticated symmetric encryption for secrets the server must read back (provider API keys).
 * Format: `v1:<iv>:<authTag>:<ciphertext>` (base64 parts). The version prefix allows key
 * rotation: add `v2` with a new key and re-encrypt, while `v1` values stay readable (ADR-007).
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(@Inject(aiConfig.KEY) config: AiConfig) {
    this.key = config.encryptionKey;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_BYTES });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      CURRENT_VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /** Throws if the value was tampered with, encrypted with another key, or malformed. */
  decrypt(payload: string): string {
    const [version, iv, tag, ciphertext] = payload.split(':');
    if (version !== CURRENT_VERSION || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unsupported or malformed encrypted payload');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'), {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
