import Groq from 'groq-sdk/index.mjs';
import config from '../../config/index.js';
import { LEADERSHIP_PROMPT, ASSETS_PROMPT } from './prompts.js';

/**
 * Groq LLM provider.
 * Uses Llama 3.1 70B (free tier: 30 RPM) for structured extraction.
 * Sign up at https://console.groq.com
 */
export default class GroqProvider {
  constructor() {
    if (!config.groqApiKey) {
      throw new Error('GROQ_API_KEY is required for Groq provider. Sign up at https://console.groq.com');
    }
    this.client = new Groq({ apiKey: config.groqApiKey });
    this.model = 'llama-3.3-70b-versatile';
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

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const text = completion.choices?.[0]?.message?.content || '';
    console.log('[LLM] Groq extractLeadership raw response length:', text?.length);
    console.log('[LLM] Groq extractLeadership raw response (first 500 chars):', text?.substring(0, 500));
    const parsed = this._parseJSON(text, 'leaders');
    console.log('[LLM] Groq extractLeadership parsed count:', parsed?.length);
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

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const text = completion.choices?.[0]?.message?.content || '';
    console.log('[LLM] Groq extractAssets raw response length:', text?.length);
    console.log('[LLM] Groq extractAssets raw response (first 500 chars):', text?.substring(0, 500));
    const parsed = this._parseJSON(text, 'assets');
    console.log('[LLM] Groq extractAssets parsed count:', parsed?.length);
    if (opts.returnRaw) return { parsed, raw: text };
    return parsed;
  }

  _parseJSON(text, key) {
    if (!text || typeof text !== 'string') {
      console.error('[LLM] Groq _parseJSON: empty or non-string input');
      throw new Error('LLM returned empty response');
    }
    let toParse = text.trim();
    const codeBlockMatch = toParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      toParse = codeBlockMatch[1].trim();
      console.log('[LLM] Groq _parseJSON: stripped markdown code block');
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
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          console.log('[LLM] Groq _parseJSON: extracted array via regex, length:', arr?.length);
          return arr;
        } catch { /* fall through */ }
      }
      console.error('[LLM] Groq _parseJSON failed:', parseErr.message);
      console.error('[LLM] Groq _parseJSON input preview:', text.substring(0, 300));
      throw new Error(`Failed to parse LLM response: ${parseErr.message}. Preview: ${text.substring(0, 150)}`);
    }
  }
}
