// Copies SQL migrations next to the compiled runner (dist/db/migrations)
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'db', 'migrations');
const dest = join(root, 'dist', 'db', 'migrations');
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src).filter((f) => f.endsWith('.sql'))) {
  cpSync(join(src, f), join(dest, f));
}
console.log(`[build] copied migrations to ${dest}`);
