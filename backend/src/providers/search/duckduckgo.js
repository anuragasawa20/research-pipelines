import { search as ddgSearch, SafeSearchType } from 'duck-duck-scrape';

const RETRY_DELAYS = [2000, 5000, 10000];

/**
 * DuckDuckGo search provider.
 * No API key required. Includes retry logic for DDG rate limiting.
 */
export default class DuckDuckGoSearchProvider {
  constructor() {
    this._lastRequestTime = 0;
    this._minDelayMs = 3000;
  }

  /**
   * @param {string} queryStr
   * @param {number} numResults
   * @returns {Promise<Array<{ url: string, title: string, snippet: string }>>}
   */
  async search(queryStr, numResults = 5) {
    await this._throttle();

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const results = await ddgSearch(queryStr, {
          safeSearch: SafeSearchType.MODERATE,
        });

        this._lastRequestTime = Date.now();

        if (!results || !results.results) {
          return [];
        }

        return results.results.slice(0, numResults).map((r) => ({
          url: r.url,
          title: r.title || '',
          snippet: r.description || '',
        }));
      } catch (err) {
        const isRateLimit = err.message && err.message.includes('anomaly');
        if (isRateLimit && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`[DDG] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await sleep(delay);
        } else {
          throw err;
        }
      }
    }

    return [];
  }

  async _throttle() {
    const elapsed = Date.now() - this._lastRequestTime;
    if (elapsed < this._minDelayMs) {
      await sleep(this._minDelayMs - elapsed);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
