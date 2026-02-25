import { query, getClient } from './pool.js';

// ============================================================
// PIPELINE RUNS
// ============================================================

export async function createPipelineRun(inputString, companyNames) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const runResult = await client.query(
      `INSERT INTO pipeline_runs (input_string, status, total_companies)
       VALUES ($1, 'processing', $2)
       RETURNING *`,
      [inputString, companyNames.length]
    );
    const run = runResult.rows[0];

    for (const name of companyNames) {
      await client.query(
        `INSERT INTO pipeline_company_status (run_id, company_name, step, status)
         VALUES ($1, $2, 'pending', 'pending')`,
        [run.id, name.trim()]
      );
    }

    await client.query('COMMIT');
    return run;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPipelineRun(runId) {
  const runResult = await query('SELECT * FROM pipeline_runs WHERE id = $1', [runId]);
  if (runResult.rows.length === 0) return null;

  const statusResult = await query(
    `SELECT * FROM pipeline_company_status WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId]
  );

  return {
    ...runResult.rows[0],
    companies: statusResult.rows,
  };
}

export async function updatePipelineRunStatus(runId, status, errorLog = null) {
  const completedAt = ['completed', 'failed', 'partial'].includes(status) ? 'NOW()' : 'NULL';
  await query(
    `UPDATE pipeline_runs SET status = $1, error_log = $2, completed_at = ${completedAt} WHERE id = $3`,
    [status, errorLog, runId]
  );
}

// ============================================================
// PIPELINE COMPANY STATUS
// ============================================================

export async function updateCompanyStatus(runId, companyName, step, status, errorMessage = null, companyId = null) {
  const params = [step, status, errorMessage, runId, companyName];
  let sql = `UPDATE pipeline_company_status
             SET step = $1, status = $2, error_message = $3
             WHERE run_id = $4 AND company_name = $5`;

  if (companyId) {
    sql = `UPDATE pipeline_company_status
           SET step = $1, status = $2, error_message = $3, company_id = $6
           WHERE run_id = $4 AND company_name = $5`;
    params.push(companyId);
  }

  await query(sql, params);
}

// ============================================================
// COMPANIES
// ============================================================

export async function upsertCompany({ name, websiteUrl, description, rawSource }) {
  const result = await query(
    `INSERT INTO companies (name, website_url, description, raw_source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ON CONSTRAINT uq_companies_name_normalized
     DO UPDATE SET
       website_url = COALESCE(EXCLUDED.website_url, companies.website_url),
       description = COALESCE(EXCLUDED.description, companies.description),
       raw_source = COALESCE(EXCLUDED.raw_source, companies.raw_source)
     RETURNING *`,
    [name.trim(), websiteUrl || null, description || null, rawSource || null]
  );
  return result.rows[0];
}

export async function getAllCompanies() {
  const result = await query(
    `SELECT
       c.*,
       (SELECT COUNT(*) FROM leaders l WHERE l.company_id = c.id) AS leader_count,
       (SELECT COUNT(*) FROM assets a WHERE a.company_id = c.id) AS asset_count
     FROM companies c
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

export async function getCompanyById(companyId) {
  const companyResult = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
  if (companyResult.rows.length === 0) return null;

  const leadersResult = await query(
    'SELECT * FROM leaders WHERE company_id = $1 ORDER BY name ASC',
    [companyId]
  );

  const assetsResult = await query(
    'SELECT * FROM assets WHERE company_id = $1 ORDER BY name ASC',
    [companyId]
  );

  return {
    ...companyResult.rows[0],
    leaders: leadersResult.rows,
    assets: assetsResult.rows,
  };
}

// ============================================================
// LEADERS
// ============================================================

export async function upsertLeaders(companyId, leaders, sourceUrl) {
  if (!leaders || leaders.length === 0) return;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM leaders WHERE company_id = $1', [companyId]);

    for (const leader of leaders) {
      await client.query(
        `INSERT INTO leaders (company_id, name, title, expertise_tags, summary_bullets, source_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          companyId,
          leader.name,
          leader.title || null,
          leader.expertise_tags || [],
          leader.summary_bullets || [],
          sourceUrl || null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// ASSETS
// ============================================================

export async function upsertAssets(companyId, assets, sourceUrl) {
  if (!assets || assets.length === 0) return;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM assets WHERE company_id = $1', [companyId]);

    for (const asset of assets) {
      const lat = validateCoordinate(asset.latitude, -90, 90);
      const lng = validateCoordinate(asset.longitude, -180, 180);

      await client.query(
        `INSERT INTO assets (company_id, name, commodities, status, country, state_province, town, latitude, longitude, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          companyId,
          asset.name,
          asset.commodities || [],
          normalizeStatus(asset.status),
          asset.country || null,
          asset.state_province || null,
          asset.town || null,
          lat,
          lng,
          sourceUrl || null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function validateCoordinate(value, min, max) {
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}

const VALID_STATUSES = ['operating', 'developing', 'exploration', 'closed', 'care_and_maintenance', 'unknown'];

function normalizeStatus(status) {
  if (!status) return 'unknown';
  const lower = status.toLowerCase().trim().replace(/\s+/g, '_');
  if (VALID_STATUSES.includes(lower)) return lower;
  if (lower.includes('operat')) return 'operating';
  if (lower.includes('develop') || lower.includes('construct')) return 'developing';
  if (lower.includes('explor')) return 'exploration';
  if (lower.includes('clos') || lower.includes('shut')) return 'closed';
  if (lower.includes('care') || lower.includes('maintenance')) return 'care_and_maintenance';
  return 'unknown';
}
