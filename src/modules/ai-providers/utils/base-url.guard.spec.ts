import { assertSafeBaseUrl, isInternalAddress } from './base-url.guard';

describe('provider base URL guard', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
  ])('treats %s as internal', (address) => {
    expect(isInternalAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111'])('treats %s as public', (address) => {
    expect(isInternalAddress(address)).toBe(false);
  });

  it.each([
    ['http://api.example.com', 'baseUrl must use https'],
    ['https://user:pass@api.example.com', 'baseUrl must not contain credentials'],
    ['https://localhost:8443', 'baseUrl must not point to an internal host'],
    ['https://metadata.internal', 'baseUrl must not point to an internal host'],
    ['https://169.254.169.254/latest', 'baseUrl must not resolve to a private or loopback address'],
    ['https://[::1]/v1', 'baseUrl must not resolve to a private or loopback address'],
    ['not a url', 'baseUrl is not a valid URL'],
  ])('rejects %s', async (url, message) => {
    await expect(assertSafeBaseUrl(url)).rejects.toMatchObject({
      code: 'PROVIDER_BASE_URL_NOT_ALLOWED',
      message,
    });
  });

  it('accepts a public https IP and strips the trailing slash', async () => {
    await expect(assertSafeBaseUrl('https://8.8.8.8/v1/')).resolves.toBe('https://8.8.8.8/v1');
  });
});
