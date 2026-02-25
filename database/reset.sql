-- Reset all pipeline data — keeps table structure intact, deletes all rows.
-- Run: psql $DATABASE_URL -f database/reset.sql

BEGIN;

TRUNCATE TABLE
  pipeline_company_status,
  pipeline_runs,
  assets,
  leaders,
  companies
CASCADE;

COMMIT;

SELECT 'Reset complete. All companies, leaders, assets and pipeline runs deleted.' AS status;
