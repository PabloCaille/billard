// =====================================================================
// RENDU
// Lecture seule de l'état. Seul endroit qui connaît les pixels et les
// couleurs. Table, bandes et billes passent par la MÊME vue (échelle +
// décalage), donc ce qu'on voit coïncide avec ce que calcule la physique.
// =====================================================================

const COLORS = {
  wood: '#5a3a1a',
  cushion: '#145a2b',
  felt: '#1e7a3c',
  cue: '#f5f5f0', red: '#c0392b', yellow: '#f1c40f', black: '#111',
};

const MARGIN_PX = 45;          // bois + bande autour du tapis (px)
const CUSHION_DRAW_WIDTH = 0.04; // épaisseur dessinée des bandes (m), purement visuelle

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

function drawTable(ctx, view, table) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(0, 0, W, H);

  // Tapis : exactement la surface de jeu de la physique
  const tl = toScreen(view, { x: 0, y: table.width });
  ctx.fillStyle = COLORS.felt;
  ctx.fillRect(tl.x, tl.y, table.length * view.scale, table.width * view.scale);

  // Bandes : dessinées à partir des MÊMES segments que la physique,
  // décalées vers l'extérieur (−n). Les mâchoires futures s'afficheront seules.
  ctx.fillStyle = COLORS.cushion;
  for (const c of table.cushions) {
    const off = { x: -c.n.x * CUSHION_DRAW_WIDTH, y: -c.n.y * CUSHION_DRAW_WIDTH };
    const pts = [
      c.a,
      c.b,
      { x: c.b.x + off.x, y: c.b.y + off.y },
      { x: c.a.x + off.x, y: c.a.y + off.y },
    ].map((p) => toScreen(view, p));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBall(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawState(ctx, state) {
  const { width: W, height: H } = ctx.canvas;
  const view = computeView(W, H, state.table);
  drawTable(ctx, view, state.table);
  for (const b of state.balls) {
    const p = toScreen(view, b.pos);
    drawBall(ctx, p.x, p.y, b.radius * view.scale, COLORS[b.kind]);
  }
}
