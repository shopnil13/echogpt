import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

const BLOCKED_HOST_SUFFIXES = ['localhost', '.local', '.internal', '.localdomain'];

/**
 * SSRF guard for admin-supplied provider base URLs: HTTPS only, and the host must not be (or
 * resolve to) a loopback, private, link-local or otherwise internal address.
 * DNS can still change after validation (rebinding); network egress rules are the backstop.
 */
export async function assertSafeBaseUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw reject('baseUrl is not a valid URL');
  }
  if (url.protocol !== 'https:') throw reject('baseUrl must use https');
  if (url.username || url.password) throw reject('baseUrl must not contain credentials');

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    BLOCKED_HOST_SUFFIXES.some(
      (suffix) => host === suffix.replace(/^\./, '') || host.endsWith(suffix),
    )
  ) {
    throw reject('baseUrl must not point to an internal host');
  }

  const addresses = isIP(host) ? [host] : await resolveAll(host);
  if (addresses.some(isInternalAddress)) {
    throw reject('baseUrl must not resolve to a private or loopback address');
  }
  return url.toString().replace(/\/$/, '');
}

async function resolveAll(host: string): Promise<string[]> {
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    return results.map((result) => result.address);
  } catch {
    throw reject('baseUrl host could not be resolved');
  }
}

export function isInternalAddress(address: string): boolean {
  if (isIP(address) === 4) return isInternalIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isInternalIpv4(normalized.slice('::ffff:'.length));
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  );
}

function isInternalIpv4(address: string): boolean {
  const [a = 0, b = 0] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function reject(message: string): AppException {
  return AppException.unprocessable(ErrorCode.PROVIDER_BASE_URL_NOT_ALLOWED, message);
}
