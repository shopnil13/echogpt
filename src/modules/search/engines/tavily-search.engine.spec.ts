import { TavilySearchEngine } from './tavily-search.engine';

describe('TavilySearchEngine', () => {
  const engine = new TavilySearchEngine('tvly-test-key', 1000);
  const fetchMock = jest.spyOn(global, 'fetch');

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('narrows untrusted results and drops non-http urls', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { title: 'Good', url: 'https://example.com', content: 'snippet', score: 0.9 },
            { title: 'Bad', url: 'javascript:alert(1)', content: 'x' },
            { url: 'http://plain.example.com', content: 42 },
          ],
        }),
        { status: 200 },
      ),
    );

    const results = await engine.search('coffee', { maxResults: 5 });

    expect(results).toEqual([
      {
        title: 'Good',
        url: 'https://example.com',
        snippet: 'snippet',
        score: 0.9,
        publishedAt: null,
      },
      {
        title: 'http://plain.example.com',
        url: 'http://plain.example.com',
        snippet: '',
        score: null,
        publishedAt: null,
      },
    ]);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tvly-test-key');
  });

  it.each([
    ['an HTTP error', () => Promise.resolve(new Response('nope', { status: 500 }))],
    [
      'an invalid payload',
      () => Promise.resolve(new Response(JSON.stringify({ oops: true }), { status: 200 })),
    ],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
  ])('maps %s to SEARCH_ENGINE_UNAVAILABLE', async (_label, implementation) => {
    fetchMock.mockImplementation(implementation);
    await expect(engine.search('coffee', { maxResults: 5 })).rejects.toMatchObject({
      code: 'SEARCH_ENGINE_UNAVAILABLE',
      status: 502,
    });
  });
});
