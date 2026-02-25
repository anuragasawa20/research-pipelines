import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/index.js';
import { LEADERSHIP_PROMPT, ASSETS_PROMPT } from './prompts.js';
import { getLLMLimiterConfig, scheduleLLM } from './rateLimiter.js';

/**
 * Gemini LLM provider.
 * Uses Gemini 1.5 Flash (free tier) for structured extraction.
 */
export default class GeminiProvider {
  constructor() {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required for Gemini provider');
    }
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });
    const limiter = getLLMLimiterConfig();
    console.log(`[LLM] Gemini limiter configured at ${limiter.requestsPerMinute} RPM (${limiter.minTimeMs}ms spacing)`);
  }

  /**
   * Extract leadership/board data from page markdown.
   * @param {string} markdown
   * @param {string} companyName
   * @param {{ returnRaw?: boolean }} opts - If returnRaw, returns { parsed, raw }
   * @returns {Promise<Array|{ parsed: Array, raw: string }>}
   */
  async extractLeadership(markdown, companyName, opts = {}) {
    const truncated = markdown.substring(0, config.pipeline.maxCrawlContentLength);
    const prompt = LEADERSHIP_PROMPT
      .replace('{{COMPANY_NAME}}', companyName)
      .replace('{{CONTENT}}', truncated);

    const result = await this._generateWithRateLimitAndRetry(prompt, 'extractLeadership');
    const text = result.response.text();
    console.log('[LLM] extractLeadership raw response length:', text?.length);
    console.log('[LLM] extractLeadership raw response (first 500 chars):', text?.substring(0, 500));
    const parsed = this._parseJSON(text, 'leaders');
    console.log('[LLM] extractLeadership parsed count:', parsed?.length);
    if (opts.returnRaw) return { parsed, raw: text };
    return parsed;
  }

  /**
   * Extract mining assets/operations from page markdown.
   * @param {string} markdown
   * @param {string} companyName
   * @param {{ returnRaw?: boolean }} opts - If returnRaw, returns { parsed, raw }
   * @returns {Promise<Array|{ parsed: Array, raw: string }>}
   */
  async extractAssets(markdown, companyName, opts = {}) {
    const truncated = markdown.substring(0, config.pipeline.maxCrawlContentLength);
    const prompt = ASSETS_PROMPT
      .replace('{{COMPANY_NAME}}', companyName)
      .replace('{{CONTENT}}', truncated);

    const result = await this._generateWithRateLimitAndRetry(prompt, 'extractAssets');
    const text = result.response.text();
    console.log('[LLM] extractAssets raw response length:', text?.length);
    console.log('[LLM] extractAssets raw response (first 500 chars):', text?.substring(0, 500));
    const parsed = this._parseJSON(text, 'assets');
    console.log('[LLM] extractAssets parsed count:', parsed?.length);
    if (opts.returnRaw) return { parsed, raw: text };
    return parsed;
  }

  _parseJSON(text, key) {
    if (!text || typeof text !== 'string') {
      console.error('[LLM] _parseJSON: empty or non-string input');
      throw new Error('LLM returned empty response');
    }
    let toParse = text.trim();
    const codeBlockMatch = toParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      toParse = codeBlockMatch[1].trim();
      console.log('[LLM] _parseJSON: stripped markdown code block');
    }
    try {
      const parsed = JSON.parse(toParse);
      if (Array.isArray(parsed)) return parsed;
      if (parsed[key] && Array.isArray(parsed[key])) return parsed[key];
      if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
      if (parsed.leaders && Array.isArray(parsed.leaders)) return parsed.leaders;
      if (parsed.assets && Array.isArray(parsed.assets)) return parsed.assets;
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      // Try greedy array regex first
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          console.log('[LLM] _parseJSON: extracted array via regex, length:', arr?.length);
          return arr;
        } catch { /* fall through */ }
      }
      // Response was likely truncated mid-array — salvage complete objects
      const salvaged = this._salvageTruncatedArray(toParse);
      if (salvaged) return salvaged;

      console.error('[LLM] _parseJSON failed:', parseErr.message);
      console.error('[LLM] _parseJSON input preview:', text.substring(0, 300));
      throw new Error(`Failed to parse LLM response: ${parseErr.message}. Preview: ${text.substring(0, 150)}`);
    }
  }

  /**
   * Walk the text character-by-character and return every complete top-level
   * JSON object found inside an (possibly truncated) JSON array.
   * This lets us recover partial results when the LLM hits its output token limit.
   */
  _salvageTruncatedArray(text) {
    const objects = [];
    let i = 0;
    // Skip leading whitespace / opening bracket
    while (i < text.length && (text[i] === '[' || text[i] === ' ' || text[i] === '\n' || text[i] === '\r')) i++;

    while (i < text.length) {
      if (text[i] !== '{') { i++; continue; }
      // Track depth to find the matching closing brace
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = i;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              objects.push(JSON.parse(text.slice(start, i + 1)));
            } catch { /* skip malformed object */ }
            i++;
            break;
          }
        }
      }
    }

    if (objects.length > 0) {
      console.warn(`[LLM] _salvageTruncatedArray: recovered ${objects.length} objects from truncated response`);
      return objects;
    }
    return null;
  }

  async _generateWithRateLimitAndRetry(prompt, opName) {
    const maxAttempts = Math.max(1, (config.pipeline.maxRetries || 0) + 1);
    let lastErr = null;
    const queuedGenerate = () => this.model.generateContent(prompt);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await scheduleLLM(queuedGenerate);
      } catch (err) {
        lastErr = err;
        const shouldRetry429 = config.pipeline.retryOn429 && this._isRateLimitError(err);
        if (!shouldRetry429 || attempt >= maxAttempts) {
          throw err;
        }
        const delayMs = this._getRetryDelayMs(err, attempt);
        console.warn(`[LLM] ${opName} hit rate limit. Retry ${attempt}/${maxAttempts - 1} in ${delayMs}ms`);
        await sleep(delayMs);
      }
    }

    throw lastErr;
  }

  _isRateLimitError(err) {
    const status = err?.status || err?.response?.status || err?.cause?.status;
    if (status === 429) return true;
    const message = String(err?.message || '').toLowerCase();
    return message.includes('429') || message.includes('resource_exhausted') || message.includes('rate limit');
  }

  _getRetryDelayMs(err, attempt) {
    const retryAfterHeader = err?.response?.headers?.['retry-after'] || err?.response?.headers?.get?.('retry-after');
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000;
    }
    const base = 30000;
    return Math.min(base * (2 ** (attempt - 1)), 180000);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
