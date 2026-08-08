CREATE TABLE IF NOT EXISTS model_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type    VARCHAR(50) NOT NULL,
  version       INT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived', 'failed')),
  payload       JSONB,
  metrics       JSONB,
  triggered_by  VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (triggered_by IN ('manual', 'scheduled')),
  duration_ms   INT,
  error         TEXT,
  trained_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_type, version)
);
CREATE INDEX IF NOT EXISTS idx_registry_model_version
  ON model_registry (model_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_registry_status
  ON model_registry (model_type, status);
