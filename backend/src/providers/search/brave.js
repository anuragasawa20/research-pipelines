import config from '../../config/index.js';

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Brave Search provider.
 * Implements the search provider contract.
 */
export default class BraveSearchProvider {
  constructor() {
    this.apiKey = config.braveSearchApiKey;
    if (!this.apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY is required for Brave search provider');
    }
  }

  /**
   * @param {string} queryStr
   * @param {number} numResults
   * @returns {Promise<Array<{ url: string, title: string, snippet: string }>>}
   */
  async search(queryStr, numResults = 5) {
    const url = new URL(BRAVE_API_URL);
    url.searchParams.set('q', queryStr);
    url.searchParams.set('count', String(numResults));
    url.searchParams.set('safesearch', 'moderate');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
      signal: AbortSignal.timeout(config.pipeline.requestTimeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brave search failed (${response.status}): ${body.substring(0, 200)}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];

    return results.map((r) => ({
      url: r.url,
      title: r.title || '',
      snippet: r.description || '',
    }));
  }
}
