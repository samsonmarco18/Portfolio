-- Applied idempotently at startup. Never drop or truncate existing content.
CREATE SCHEMA IF NOT EXISTS portfolio_private;
CREATE TABLE IF NOT EXISTS portfolio_private.portfolio_objects (
    object_key TEXT PRIMARY KEY,
    data_base64 TEXT NOT NULL,
    metadata JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
