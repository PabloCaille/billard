export function drawTable(ctx, width, height) {
  ctx.fillStyle = "#5a3a1a";            // bois
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1e7a3c";            // tapis
  ctx.fillRect(30, 30, width - 60, height - 60);
}

export function drawBall(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

const COLORS = { cue: '#f5f5f0', red: '#c0392b', yellow: '#f1c40f', black: '#111' };
const MARGIN_PX = 40; // à ajuster pour coller au bord de ton tapis dessiné

function computeView(W, H, table) {
  const scale = Math.min((W - 2 * MARGIN_PX) / table.length, (H - 2 * MARGIN_PX) / table.width);
  return {
    scale,
    ox: (W - table.length * scale) / 2,
    oy: (H - table.width * scale) / 2,
    tableWidth: table.width,
  };
}

function toScreen(view, p) {
  return {
    x: view.ox + p.x * view.scale,
    y: view.oy + (view.tableWidth - p.y) * view.scale, // retournement de l'axe y
  };
}

export function drawState(ctx, state) {
  const { width: W, height: H } = ctx.canvas;
  const view = computeView(W, H, state.table);
  drawTable(ctx, W, H);
  for (const b of state.balls) {
    const p = toScreen(view, b.pos);
    drawBall(ctx, p.x, p.y, b.radius * view.scale, COLORS[b.kind]);
  }
}