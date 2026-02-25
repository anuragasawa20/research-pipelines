import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL,

  searchProvider: process.env.SEARCH_PROVIDER || 'duckduckgo',
  crawlProvider: process.env.CRAWL_PROVIDER || 'jina',
  llmProvider: process.env.LLM_PROVIDER || 'gemini',

  braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
  serperApiKey: process.env.SERPER_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  pipeline: {
    maxRetries: 2,
    requestTimeoutMs: 30000,
    maxCrawlContentLength: 30000,
    maxCrawlContentLengthPerUrl: 20000,
    searchResultsPerQuery: 5,
    maxUrlsToCrawlPerTopic: 3,
  },
};

export default config;
