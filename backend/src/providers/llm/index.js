import config from '../../config/index.js';
import GeminiProvider from './gemini.js';
import GroqProvider from './groq.js';

const providers = {
  gemini: GeminiProvider,
  groq: GroqProvider,
};

let instance = null;

export function getLLMProvider() {
  if (instance) return instance;

  const ProviderClass = providers[config.llmProvider];
  if (!ProviderClass) {
    throw new Error(`Unknown LLM provider: "${config.llmProvider}". Available: ${Object.keys(providers).join(', ')}`);
  }

  instance = new ProviderClass();
  return instance;
}
