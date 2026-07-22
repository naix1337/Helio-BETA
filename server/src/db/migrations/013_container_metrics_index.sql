-- Container metrics timestamp index for efficient pruning
CREATE INDEX IF NOT EXISTS idx_container_metrics_timestamp
  ON container_metrics(timestamp);
