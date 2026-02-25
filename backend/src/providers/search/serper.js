import config from '../../config/index.js';

const SERPER_API_URL = 'https://google.serper.dev/search';

/**
 * Serper.dev search provider.
 * Uses Google search results. Free tier: 2,500 queries (email signup, no card).
 * Sign up at https://serper.dev
 */
export default class SerperSearchProvider {
  constructor() {
    this.apiKey = config.serperApiKey;
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is required for Serper search provider. Sign up free at https://serper.dev');
    }
  }

  /**
   * @param {string} queryStr
   * @param {number} numResults
   * @returns {Promise<Array<{ url: string, title: string, snippet: string }>>}
   */
  async search(queryStr, numResults = 5) {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: queryStr,
        num: numResults,
      }),
      signal: AbortSignal.timeout(config.pipeline.requestTimeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Serper search failed (${response.status}): ${body.substring(0, 200)}`);
    }

    const data = await response.json();
    const results = data.organic || [];

    return results.slice(0, numResults).map((r) => ({
      url: r.link,
      title: r.title || '',
      snippet: r.snippet || '',
    }));
  }
}
