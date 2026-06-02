// helio-app/frontend/src/pages/Nodes.tsx
import React, { useEffect, useState } from 'react';
import { ServerTable } from '../components/ServerTable.tsx';
import type { Node } from '../types.ts';

export function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Nodes</h1>
        <span className="sub">{nodes.length} registriert</span>
      </div>
      <ServerTable nodes={nodes} />
    </>
  );
}
