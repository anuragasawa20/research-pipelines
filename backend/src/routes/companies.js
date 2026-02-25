import { Router } from 'express';
import * as db from '../db/queries.js';

const router = Router();

/**
 * GET /api/companies
 * Returns all ingested companies with leader/asset counts.
 */
router.get('/', async (req, res) => {
  try {
    const companies = await db.getAllCompanies();
    return res.json(companies);
  } catch (err) {
    console.error('[API] GET /companies error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/companies/:id
 * Returns full company detail with leaders and assets.
 */
router.get('/:id', async (req, res) => {
  try {
    const company = await db.getCompanyById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.json(company);
  } catch (err) {
    console.error('[API] GET /companies/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
