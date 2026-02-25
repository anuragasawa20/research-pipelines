import config from '../../config/index.js';
import BraveSearchProvider from './brave.js';
import DuckDuckGoSearchProvider from './duckduckgo.js';
import SerperSearchProvider from './serper.js';

const providers = {
  brave: BraveSearchProvider,
  duckduckgo: DuckDuckGoSearchProvider,
  serper: SerperSearchProvider,
};

let instance = null;

export function getSearchProvider() {
  if (instance) return instance;

  const ProviderClass = providers[config.searchProvider];
  if (!ProviderClass) {
    throw new Error(`Unknown search provider: "${config.searchProvider}". Available: ${Object.keys(providers).join(', ')}`);
  }

  instance = new ProviderClass();
  return instance;
}
