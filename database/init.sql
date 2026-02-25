-- Mining Intelligence Data Pipeline
-- Database Schema for Neon Postgres
-- Run this file to initialize the database: psql $DATABASE_URL -f init.sql

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    name_normalized TEXT NOT NULL GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED,
    website_url     TEXT,
    description     TEXT,
    raw_source      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_companies_name_normalized UNIQUE (name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);

-- ============================================================
-- LEADERS (executives / board members)
-- ============================================================
CREATE TABLE IF NOT EXISTS leaders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    title           TEXT,
    expertise_tags  TEXT[] DEFAULT '{}',
    summary_bullets TEXT[] DEFAULT '{}',
    source_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaders_company_id ON leaders (company_id);

-- ============================================================
-- ASSETS (mines / projects)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    commodities     TEXT[] DEFAULT '{}',
    status          TEXT DEFAULT 'unknown'
                    CHECK (status IN ('operating', 'developing', 'exploration', 'closed', 'care_and_maintenance', 'unknown')),
    country         TEXT,
    state_province  TEXT,
    town            TEXT,
    latitude        DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude       DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    source_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets (company_id);

-- ============================================================
-- PIPELINE RUNS (one per batch submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    input_string    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    total_companies INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    error_log       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);

-- ============================================================
-- PIPELINE COMPANY STATUS (per-company progress within a run)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_company_status (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name    TEXT NOT NULL,
    step            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (step IN (
                        'pending',
                        'searching',
                        'crawling_leadership',
                        'crawling_assets',
                        'extracting_leadership',
                        'extracting_assets',
                        'storing',
                        'complete',
                        'failed'
                    )),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'skipped')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_run_id ON pipeline_company_status (run_id);
CREATE INDEX IF NOT EXISTS idx_pcs_company_id ON pipeline_company_status (company_id);

-- ============================================================
-- HELPER: auto-update updated_at on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pcs_updated_at ON pipeline_company_status;
CREATE TRIGGER trg_pcs_updated_at
    BEFORE UPDATE ON pipeline_company_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
