// helio-app/backend/src/db/migrations/runner.ts
// Migration runner: scans migrations/*.sql files sorted numerically,
// checks migrations_log table, applies any not-yet-applied ones.
// Always runs each migration in a transaction. If a migration fails,
// rolls back and throws with clear context.

import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(__dirname);

interface MigrationLogRow {
  id: number;
  name: string;
  applied_at: number;
}

function ensureMigrationsLog(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `);
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db
    .prepare<[], MigrationLogRow>('SELECT name FROM migrations_log ORDER BY id ASC')
    .all() as MigrationLogRow[];
  return new Set(rows.map((r) => r.name));
}

function getMigrationFiles(): string[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic sort: 001_... < 002_... < ...
  return files;
}

/**
 * Apply all pending SQL migrations to the given database.
 * Idempotent: already-applied migrations are skipped.
 * Each migration runs in its own transaction; on failure the transaction
 * is rolled back and an error is thrown identifying which migration failed.
 */
export function runMigrations(db: Database.Database): void {
  ensureMigrationsLog(db);

  const applied = getAppliedMigrations(db);
  const files = getMigrationFiles();

  for (const file of files) {
    if (applied.has(file)) {
      continue; // already applied
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Migrations containing ALTER TABLE need statement-by-statement execution
    // so we can tolerate "duplicate column name" per-statement (SQLite has no
    // ALTER TABLE ADD COLUMN IF NOT EXISTS). All other migrations (including
    // those with triggers) use db.exec() on the whole file so SQLite's native
    // parser handles semicolons inside trigger bodies correctly.
    const hasAlterTable = /alter\s+table/i.test(sql);

    const applyMigration = db.transaction(() => {
      if (hasAlterTable) {
        // Strip line comments, then split and run per statement
        const cleanSql = sql.replace(/--[^\n]*/g, '');
        const statements = cleanSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          try {
            db.exec(stmt + ';');
          } catch (err: unknown) {
            // SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
            // Tolerate duplicate-column errors so migration 002 is safe to
            // run against a database that already has the extended columns.
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('duplicate column name')) {
              continue;
            }
            throw err;
          }
        }
      } else {
        // Use exec on the whole file: SQLite's native parser handles
        // trigger bodies and multi-statement SQL correctly.
        db.exec(sql);
      }

      db.prepare(
        'INSERT INTO migrations_log (name, applied_at) VALUES (?, ?)'
      ).run(file, Math.floor(Date.now() / 1000));
    });

    try {
      applyMigration();
      console.log(`[migrations] Applied: ${file}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[migrations] Migration "${file}" failed: ${message}`
      );
    }
  }
}
