// helio-app/backend/src/routes/nodes.ts
import { Router } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import type { Node } from '../types.js';

export const nodesRouter = Router();

nodesRouter.get('/', (_req, res) => {
  const db = getDb();
  const nodes = db.prepare('SELECT * FROM nodes').all() as Node[];
  res.json(nodes);
});

nodesRouter.post('/', (req, res) => {
  const { name, addr } = req.body as { name?: string; addr?: string };
  if (!name || !addr) {
    res.status(400).json({ error: 'name and addr are required' });
    return;
  }
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  const db = getDb();
  db.prepare(
    'INSERT INTO nodes (id, name, addr, token, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name.trim(), addr.trim(), token, 'unknown');
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node;
  res.status(201).json(node);
});

nodesRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, addr, status } = req.body as { name?: string; addr?: string; status?: string };
  const db = getDb();
  const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  db.prepare(
    'UPDATE nodes SET name = ?, addr = ?, status = ? WHERE id = ?'
  ).run(
    name?.trim() ?? existing.name,
    addr?.trim() ?? existing.addr,
    status ?? existing.status,
    id
  );
  const updated = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node;
  res.json(updated);
});

nodesRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.status(204).send();
});
