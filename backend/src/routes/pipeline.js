import { Router } from 'express';
import * as db from '../db/queries.js';
import { runPipeline, runDebugPipeline } from '../pipeline/orchestrator.js';

const router = Router();

/**
 * POST /api/pipeline/ingest
 * Body: { input: "Company A, Company B, Company C" }
 * Kicks off the pipeline asynchronously and returns the run ID.
 */
router.post('/ingest', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "input" field. Provide comma-separated company names.' });
    }

    const companyNames = input
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (companyNames.length === 0) {
      return res.status(400).json({ error: 'No valid company names found in input.' });
    }

    const run = await db.createPipelineRun(input, companyNames);

    // Fire and forget — pipeline runs in background
    runPipeline(run.id, companyNames).catch((err) => {
      console.error(`[Pipeline] Unexpected top-level error for run ${run.id}:`, err);
      db.updatePipelineRunStatus(run.id, 'failed', err.message).catch(() => {});
    });

    return res.status(202).json({
      runId: run.id,
      status: 'processing',
      totalCompanies: companyNames.length,
      companies: companyNames,
    });
  } catch (err) {
    console.error('[API] POST /ingest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/pipeline/debug
 * Body: { company: "BHP" }
 * Runs full pipeline for one company (search, crawl, extract) without DB writes.
 * Logs every step to console. Returns debug payload with raw LLM output, parsed data, URLs.
 */
router.post('/debug', async (req, res) => {
  try {
    const { company } = req.body;
    const companyName = typeof company === 'string' ? company.trim() : null;

    if (!companyName) {
      return res.status(400).json({ error: 'Missing "company" field. Example: { "company": "BHP" }' });
    }

    const debug = await runDebugPipeline(companyName);
    return res.json(debug);
  } catch (err) {
    console.error('[API] POST /debug error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

/**
 * GET /api/pipeline/runs/:id
 * Returns run status with per-company progress.
 */
router.get('/runs/:id', async (req, res) => {
  try {
    const run = await db.getPipelineRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Pipeline run not found' });
    }
    return res.json(run);
  } catch (err) {
    console.error('[API] GET /runs/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
