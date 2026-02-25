import config from '../../config/index.js';

const JINA_BASE_URL = 'https://r.jina.ai/';

/**
 * Jina AI crawl provider.
 * Uses r.jina.ai to convert any URL to clean markdown.
 */
export default class JinaCrawlProvider {
  /**
   * @param {string} url - The URL to crawl
   * @returns {Promise<{ markdown: string, title: string }>}
   */
  async crawl(url) {
    const jinaUrl = `${JINA_BASE_URL}${url}`;

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(config.pipeline.requestTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Jina crawl failed for ${url} (${response.status})`);
    }

    const data = await response.json();

    const markdown = data.data?.content || data.content || '';
    const title = data.data?.title || data.title || '';

    return { markdown, title };
  }
}
