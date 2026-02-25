import { getSearchProvider } from '../providers/search/index.js';
import { getCrawlProvider } from '../providers/crawl/index.js';
import { getLLMProvider } from '../providers/llm/index.js';
import * as db from '../db/queries.js';
import config from '../config/index.js';

const MAX_RETRIES = config.pipeline.maxRetries;
const MAX_CONTENT_LEN = config.pipeline.maxCrawlContentLength;
const MAX_CONTENT_PER_URL = config.pipeline.maxCrawlContentLengthPerUrl ?? 6000;
const MIN_CONTENT_LEN = 100;
const MAX_URLS_TO_CRAWL = config.pipeline.maxUrlsToCrawlPerTopic ?? 3;

// Prefer URLs whose path contains these (for leadership). Crawl these first.
const LEADERSHIP_URL_HINTS = ['board', 'management', 'executive', 'leadership', 'about'];
// Prefer URLs for assets.
const ASSETS_URL_HINTS = ['operation', 'project', 'mine', 'asset', 'location', 'portfolio'];

/**
 * Process a full pipeline run: for each company, search -> crawl -> extract -> store.
 * Runs asynchronously (fire-and-forget from the API layer).
 */
export async function runPipeline(runId, companyNames) {
  const search = getSearchProvider();
  const crawl = getCrawlProvider();
  const llm = getLLMProvider();

  let completedCount = 0;
  let failedCount = 0;

  for (const companyName of companyNames) {
    try {
      await processCompany(runId, companyName.trim(), search, crawl, llm);
      completedCount++;
    } catch (err) {
      failedCount++;
      console.error(`[Pipeline] Company "${companyName}" failed:`, err.message);
      await db.updateCompanyStatus(runId, companyName.trim(), 'failed', 'failed', err.message);
    }
  }

  const finalStatus = failedCount === companyNames.length
    ? 'failed'
    : failedCount > 0
      ? 'partial'
      : 'completed';

  await db.updatePipelineRunStatus(
    runId,
    finalStatus,
    failedCount > 0 ? `${failedCount}/${companyNames.length} companies failed` : null
  );

  console.log(`[Pipeline] Run ${runId} finished: ${finalStatus} (${completedCount} ok, ${failedCount} failed)`);
}

async function processCompany(runId, companyName, search, crawl, llm) {
  console.log(`[Pipeline] Processing: ${companyName}`);

  // -- Step 1: Search for leadership pages --
  await db.updateCompanyStatus(runId, companyName, 'searching', 'processing');

  const leadershipQuery = `${companyName} mining company leadership board executives management team`;
  const assetsQuery = `${companyName} mining operations mines projects assets properties`;

  let leadershipUrls = [];
  let assetUrls = [];

  try {
    const leaderResults = await search.search(leadershipQuery, config.pipeline.searchResultsPerQuery);
    leadershipUrls = leaderResults.map((r) => r.url);
    console.log('[Pipeline] Leadership search URLs:', leadershipUrls);

    const assetResults = await search.search(assetsQuery, config.pipeline.searchResultsPerQuery);
    assetUrls = assetResults.map((r) => r.url);
    console.log('[Pipeline] Assets search URLs:', assetUrls);
  } catch (err) {
    throw new Error(`Search failed: ${err.message}`);
  }

  if (leadershipUrls.length === 0 && assetUrls.length === 0) {
    throw new Error('No search results found for leadership or assets');
  }

  leadershipUrls = reorderUrlsByRelevance(leadershipUrls, LEADERSHIP_URL_HINTS);
  assetUrls = reorderUrlsByRelevance(assetUrls, ASSETS_URL_HINTS);
  console.log('[Pipeline] Reordered leadership URLs:', leadershipUrls);
  console.log('[Pipeline] Reordered assets URLs:', assetUrls);

  // -- Step 2: Crawl multiple leadership pages and merge content --
  await db.updateCompanyStatus(runId, companyName, 'crawling_leadership', 'processing');

  const leadershipChunks = await crawlMultipleUrls(
    crawl,
    leadershipUrls.slice(0, MAX_URLS_TO_CRAWL),
    MIN_CONTENT_LEN,
    MAX_CONTENT_PER_URL
  );
  const leadershipMarkdown = leadershipChunks.text.substring(0, MAX_CONTENT_LEN);
  const leadershipSourceUrl = leadershipChunks.firstUrl;
  console.log('[Pipeline] Leadership crawl: total chars=', leadershipChunks.text.length, 'firstUrl=', leadershipSourceUrl);
  console.log('[Pipeline] Leadership content preview (first 300):', leadershipMarkdown.substring(0, 300));

  // -- Step 3: Crawl multiple asset pages and merge content --
  await db.updateCompanyStatus(runId, companyName, 'crawling_assets', 'processing');

  const assetsChunks = await crawlMultipleUrls(
    crawl,
    assetUrls.slice(0, MAX_URLS_TO_CRAWL),
    MIN_CONTENT_LEN,
    MAX_CONTENT_PER_URL
  );
  const assetsMarkdown = assetsChunks.text.substring(0, MAX_CONTENT_LEN);
  const assetsSourceUrl = assetsChunks.firstUrl;
  console.log('[Pipeline] Assets crawl: total chars=', assetsChunks.text.length, 'firstUrl=', assetsSourceUrl);
  console.log('[Pipeline] Assets content preview (first 300):', assetsMarkdown.substring(0, 300));

  if (!leadershipMarkdown && !assetsMarkdown) {
    throw new Error('All crawl attempts returned empty or too-short content');
  }

  // -- Step 4: Extract leadership via LLM --
  let leaders = [];
  if (leadershipMarkdown) {
    await db.updateCompanyStatus(runId, companyName, 'extracting_leadership', 'processing');
    console.log('[Pipeline] Calling LLM extractLeadership, input length=', leadershipMarkdown.length);
    leaders = await retryLLM(() => llm.extractLeadership(leadershipMarkdown, companyName));
    console.log('[Pipeline] extractLeadership result: count=', leaders.length);
  }

  // -- Step 5: Extract assets via LLM --
  let assets = [];
  if (assetsMarkdown) {
    await db.updateCompanyStatus(runId, companyName, 'extracting_assets', 'processing');
    console.log('[Pipeline] Calling LLM extractAssets, input length=', assetsMarkdown.length);
    assets = await retryLLM(() => llm.extractAssets(assetsMarkdown, companyName));
    console.log('[Pipeline] extractAssets result: count=', assets.length);
  }

  // -- Step 6: Store in database --
  await db.updateCompanyStatus(runId, companyName, 'storing', 'processing');

  const rawSource = [leadershipMarkdown, assetsMarkdown].filter(Boolean).join('\n\n---\n\n');
  const websiteUrl = leadershipSourceUrl || assetsSourceUrl || null;

  const company = await db.upsertCompany({
    name: companyName,
    websiteUrl,
    description: null,
    rawSource,
  });

  await db.upsertLeaders(company.id, leaders, leadershipSourceUrl);
  await db.upsertAssets(company.id, assets, assetsSourceUrl);

  await db.updateCompanyStatus(runId, companyName, 'complete', 'complete', null, company.id);
  console.log(`[Pipeline] Completed: ${companyName} (${leaders.length} leaders, ${assets.length} assets)`);
}

/**
 * Reorder URLs so that those whose path contains any of the hints come first.
 */
function reorderUrlsByRelevance(urls, hints) {
  const lower = (s) => s.toLowerCase();
  return [...urls].sort((a, b) => {
    const aPath = lower(new URL(a).pathname);
    const bPath = lower(new URL(b).pathname);
    const aScore = hints.filter((h) => aPath.includes(lower(h))).length;
    const bScore = hints.filter((h) => bPath.includes(lower(h))).length;
    return bScore - aScore;
  });
}

/**
 * Crawl up to N URLs and merge markdown. Returns { text, firstUrl }.
 */
async function crawlMultipleUrls(crawl, urls, minContentLen, maxCharsPerUrl) {
  const chunks = [];
  let firstUrl = null;

  for (const url of urls) {
    try {
      const result = await crawl.crawl(url);
      if (result.markdown && result.markdown.length >= minContentLen) {
        if (!firstUrl) firstUrl = url;
        chunks.push(result.markdown.substring(0, maxCharsPerUrl));
      }
    } catch (err) {
      console.warn(`[Pipeline] Crawl failed for ${url}: ${err.message}`);
    }
  }

  const text = chunks.join('\n\n---\n\n');
  return { text, firstUrl };
}

/**
 * Retry an LLM call up to MAX_RETRIES times on JSON parse failures.
 */
async function retryLLM(fn) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[Pipeline] LLM attempt ${attempt + 1} failed:`, err.message);
      console.warn(`[Pipeline] LLM error stack:`, err.stack);
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * (attempt + 1);
        console.log(`[Pipeline] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  console.error(`[Pipeline] LLM extraction failed after ${MAX_RETRIES + 1} attempts. Last error:`, lastError?.message);
  return [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debug pipeline: runs full flow for one company, no DB writes.
 * Returns debug payload with all intermediate data.
 * Logs every step to console.
 */
export async function runDebugPipeline(companyName) {
  const search = getSearchProvider();
  const crawl = getCrawlProvider();
  const llm = getLLMProvider();

  const debug = {
    companyName,
    searchUrls: { leadership: [], assets: [] },
    searchUrlsReordered: { leadership: [], assets: [] },
    crawl: { leadership: { length: 0, firstUrl: null }, assets: { length: 0, firstUrl: null } },
    llm: { leadership: { raw: null, parsed: [], error: null }, assets: { raw: null, parsed: [], error: null } },
  };

  console.log('\n========== [DEBUG] Pipeline Start ==========');
  console.log('[DEBUG] Company:', companyName);

  const leadershipQuery = `${companyName} mining company leadership board executives management team`;
  const assetsQuery = `${companyName} mining operations mines projects assets properties`;

  let leadershipUrls = [];
  let assetUrls = [];

  try {
    const leaderResults = await search.search(leadershipQuery, config.pipeline.searchResultsPerQuery);
    leadershipUrls = leaderResults.map((r) => r.url);
    debug.searchUrls.leadership = leadershipUrls;
    console.log('[DEBUG] Leadership search URLs:', leadershipUrls);

    const assetResults = await search.search(assetsQuery, config.pipeline.searchResultsPerQuery);
    assetUrls = assetResults.map((r) => r.url);
    debug.searchUrls.assets = assetUrls;
    console.log('[DEBUG] Assets search URLs:', assetUrls);
  } catch (err) {
    console.error('[DEBUG] Search failed:', err.message);
    debug.searchError = err.message;
    return debug;
  }

  leadershipUrls = reorderUrlsByRelevance(leadershipUrls, LEADERSHIP_URL_HINTS);
  assetUrls = reorderUrlsByRelevance(assetUrls, ASSETS_URL_HINTS);
  debug.searchUrlsReordered.leadership = leadershipUrls;
  debug.searchUrlsReordered.assets = assetUrls;
  console.log('[DEBUG] Reordered leadership URLs:', leadershipUrls);
  console.log('[DEBUG] Reordered assets URLs:', assetUrls);

  const leadershipChunks = await crawlMultipleUrls(
    crawl,
    leadershipUrls.slice(0, MAX_URLS_TO_CRAWL),
    MIN_CONTENT_LEN,
    MAX_CONTENT_PER_URL
  );
  const leadershipMarkdown = leadershipChunks.text.substring(0, MAX_CONTENT_LEN);
  debug.crawl.leadership = { length: leadershipChunks.text.length, firstUrl: leadershipChunks.firstUrl };
  console.log('[DEBUG] Leadership crawl length:', leadershipChunks.text.length, 'firstUrl:', leadershipChunks.firstUrl);

  const assetsChunks = await crawlMultipleUrls(
    crawl,
    assetUrls.slice(0, MAX_URLS_TO_CRAWL),
    MIN_CONTENT_LEN,
    MAX_CONTENT_PER_URL
  );
  const assetsMarkdown = assetsChunks.text.substring(0, MAX_CONTENT_LEN);
  debug.crawl.assets = { length: assetsChunks.text.length, firstUrl: assetsChunks.firstUrl };
  console.log('[DEBUG] Assets crawl length:', assetsChunks.text.length, 'firstUrl:', assetsChunks.firstUrl);

  if (leadershipMarkdown) {
    console.log('[DEBUG] Calling LLM extractLeadership...');
    try {
      const result = await llm.extractLeadership(leadershipMarkdown, companyName, { returnRaw: true });
      debug.llm.leadership.parsed = result.parsed;
      debug.llm.leadership.raw = result.raw;
      console.log('[DEBUG] Leadership parsed count:', result.parsed?.length);
      console.log('[DEBUG] Leadership raw (first 800 chars):', result.raw?.substring(0, 800));
    } catch (err) {
      debug.llm.leadership.error = err.message;
      console.error('[DEBUG] Leadership extraction failed:', err.message, err.stack);
    }
  }

  if (assetsMarkdown) {
    console.log('[DEBUG] Calling LLM extractAssets...');
    try {
      const result = await llm.extractAssets(assetsMarkdown, companyName, { returnRaw: true });
      debug.llm.assets.parsed = result.parsed;
      debug.llm.assets.raw = result.raw;
      console.log('[DEBUG] Assets parsed count:', result.parsed?.length);
      console.log('[DEBUG] Assets raw (first 800 chars):', result.raw?.substring(0, 800));
    } catch (err) {
      debug.llm.assets.error = err.message;
      console.error('[DEBUG] Assets extraction failed:', err.message, err.stack);
    }
  }

  console.log('[DEBUG] Parsed leaders:', debug.llm.leadership.parsed?.length);
  console.log('[DEBUG] Parsed assets:', debug.llm.assets.parsed?.length);
  console.log('========== [DEBUG] Pipeline End ==========\n');

  return debug;
}
