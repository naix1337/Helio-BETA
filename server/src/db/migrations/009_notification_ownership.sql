ALTER TABLE notifications ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_user ON notifications(user_id);
