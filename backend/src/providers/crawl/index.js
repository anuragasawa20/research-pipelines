import config from '../../config/index.js';
import JinaCrawlProvider from './jina.js';

const providers = {
  jina: JinaCrawlProvider,
};

let instance = null;

export function getCrawlProvider() {
  if (instance) return instance;

  const ProviderClass = providers[config.crawlProvider];
  if (!ProviderClass) {
    throw new Error(`Unknown crawl provider: "${config.crawlProvider}". Available: ${Object.keys(providers).join(', ')}`);
  }

  instance = new ProviderClass();
  return instance;
}
