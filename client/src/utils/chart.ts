/* Canvas chart drawing utilities — retina-aware, smooth paths */

export interface PrepResult {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function prepCanvas(canvas: HTMLCanvasElement): PrepResult | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export function calcPoints(
  data: number[],
  w: number,
  h: number,
  pad: number,
  min: number,
  max: number,
): { x: number; y: number }[] {
  const n = data.length;
  const span = max - min || 1;
  return data.map((v, i) => ({
    x: pad + (i / (n - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / span) * (h - pad * 2),
  }));
}

export function smoothPath(ctx: CanvasRenderingContext2D, p: { x: number; y: number }[]) {
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 0; i < p.length - 1; i++) {
    const xc = (p[i].x + p[i + 1].x) / 2;
    const yc = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
  }
  ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
}

export function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function hexA(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  if (c.startsWith('rgb')) {
    const nums = c.match(/[\d.]+/g);
    if (nums) return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
  }
  return c;
}

export function drawMainChart(
  canvas: HTMLCanvasElement,
  series: { cpu: number[]; net: number[] },
): void {
  const prep = prepCanvas(canvas);
  if (!prep) return;
  const { ctx, w, h } = prep;
  ctx.clearRect(0, 0, w, h);
  const pad = 8;
  const primary = getCSSVar('--color-primary');
  const violet = getCSSVar('--color-violet');
  const grid = getCSSVar('--color-grid-line');

  // Gridlines
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = pad + (g / 4) * (h - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  // Net (violet) area + line
  const np = calcPoints(series.net, w, h, pad, 0, 160);
  let grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexA(violet, 0.22));
  grad.addColorStop(1, hexA(violet, 0));
  ctx.beginPath();
  smoothPath(ctx, np);
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  smoothPath(ctx, np);
  ctx.strokeStyle = violet;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // CPU (primary) area + line
  const cp = calcPoints(series.cpu, w, h, pad, 0, 100);
  grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexA(primary, 0.28));
  grad.addColorStop(1, hexA(primary, 0));
  ctx.beginPath();
  smoothPath(ctx, cp);
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  smoothPath(ctx, cp);
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Last-point dot
  const last = cp[cp.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2);
  ctx.strokeStyle = hexA(primary, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function drawSparkline(
  canvas: HTMLCanvasElement,
  colorVar: string,
  seed: number,
  range?: { min: number; max: number },
  clamp?: { min: number; max: number },
): void {
  const prep = prepCanvas(canvas);
  if (!prep) return;
  const { ctx, w, h } = prep;
  ctx.clearRect(0, 0, w, h);
  const color = getCSSVar(colorVar);
  const r = seeded(seed);
  const n = 28;
  const data: number[] = [];
  let v = range ? (range.min + range.max) / 2 : 50;
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * 16;
    if (clamp) v = Math.max(clamp.min, Math.min(clamp.max, v));
    data.push(v);
  }
  const pad = 3;
  const p = calcPoints(data, w, h, pad, 10, 100);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexA(color, 0.25));
  grad.addColorStop(1, hexA(color, 0));
  ctx.beginPath();
  smoothPath(ctx, p);
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  smoothPath(ctx, p);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawRowSpark(
  canvas: HTMLCanvasElement,
  seed: number,
  state: 'ok' | 'warn' | 'down',
): void {
  const prep = prepCanvas(canvas);
  if (!prep) return;
  const { ctx, w, h } = prep;
  ctx.clearRect(0, 0, w, h);
  const colorMap = { ok: '--color-primary', warn: '--color-warn', down: '--color-down' };
  const color = getCSSVar(colorMap[state]);
  const r = seeded(seed);
  const n = 20;
  const data: number[] = [];
  let v = 45;
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * 20;
    v = Math.max(10, Math.min(95, v));
    data.push(state === 'down' ? 6 : v);
  }
  const pad = 2;
  const p = calcPoints(data, w, h, pad, 0, 100);
  ctx.beginPath();
  smoothPath(ctx, p);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
