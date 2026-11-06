// =====================================================================
// RENDU
// Lecture seule de l'état ET de la visée. Seul endroit qui connaît les
// couleurs. Table, bandes, billes et aides passent par la MÊME vue
// (view.js), donc ce qu'on voit coïncide avec ce que calcule la physique
// et avec ce que vise la souris.
// =====================================================================
import { toScreen } from './view.js';

const COLORS = {
  wood: '#5a3a1a',
  cushion: '#145a2b',
  felt: '#1e7a3c',
  cue: '#f5f5f0', red: '#c0392b', yellow: '#f1c40f', black: '#111',
  stick: '#c8a46a',
  pocket: '#0b0b0b',
  guide: 'rgba(255, 255, 255, 0.75)',
};

const CUSHION_DRAW_WIDTH = 0.04; // épaisseur dessinée des bandes (m), purement visuelle
const STICK_LENGTH = 1.2;        // m, purement visuel
const STICK_MAX_DRAW = 0.18;     // m : recul affiché de la queue à pleine puissance
const OBJECT_LINE = 0.25;        // m : longueur de la direction affichée de la couleur

function drawTable(ctx, view, table) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(0, 0, W, H);

  // Tapis : exactement la surface de jeu de la physique
  const tl = toScreen(view, { x: 0, y: table.width });
  ctx.fillStyle = COLORS.felt;
  ctx.fillRect(tl.x, tl.y, table.length * view.scale, table.width * view.scale);

  // Trous des poches (sous les bandes) : disque centré juste derrière la ligne
  // de capture, de la largeur de l'ouverture
  ctx.fillStyle = COLORS.pocket;
  for (const pk of table.pockets) {
    const c = toScreen(view, {
      x: pk.ref.x + pk.d.x * (pk.depth + 0.004),
      y: pk.ref.y + pk.d.y * (pk.depth + 0.004),
    });
    ctx.beginPath();
    ctx.arc(c.x, c.y, (pk.mouth / 2) * view.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bandes et mâchoires : dessinées à partir des MÊMES segments que la
  // physique, décalées vers l'extérieur (-n).
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

function line(ctx, view, a, b, { color, width = 1, dash = [] }) {
  const p = toScreen(view, a), q = toScreen(view, b);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
  ctx.restore();
}

// Prévision complète (débogage) : trajectoires simulées, sous les billes
function drawPrediction(ctx, view, paths) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  for (const { kind, points } of paths) {
    ctx.strokeStyle = COLORS[kind];
    ctx.beginPath();
    points.forEach((pt, i) => {
      const s = toScreen(view, pt);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

// Visée : lien curseur/blanche, ligne jusqu'au premier contact, bille
// fantôme, direction de la couleur, queue reculée selon la PUISSANCE.
function drawAim(ctx, view, aim) {
  const { cue, cursor, shot, guide } = aim;
  const c = { x: cue.pos.x, y: cue.pos.y };

  // Lien fin entre le curseur et la blanche (c'est lui qui règle tout)
  if (cursor) line(ctx, view, c, cursor, { color: 'rgba(255,255,255,0.25)', dash: [2, 4] });
  if (!shot) return;

  const d = { x: Math.cos(shot.angle), y: Math.sin(shot.angle) };

  if (guide) {
    line(ctx, view, c, guide.ghost, { color: COLORS.guide, dash: [6, 5] });
    const g = toScreen(view, guide.ghost);
    ctx.save();
    ctx.strokeStyle = COLORS.guide;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.x, g.y, cue.radius * view.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (guide.hit.type === 'ball') {
      const { from, dir } = guide.hit;
      line(ctx, view, from, { x: from.x + dir.x * OBJECT_LINE, y: from.y + dir.y * OBJECT_LINE },
        { color: COLORS.guide, width: 2 });
    }
  }

  // Queue : derrière la blanche, reculée proportionnellement à la puissance
  const back = cue.radius + 0.01 + STICK_MAX_DRAW * shot.power;
  const tipPos = { x: c.x - d.x * back, y: c.y - d.y * back };
  const endPos = { x: tipPos.x - d.x * STICK_LENGTH, y: tipPos.y - d.y * STICK_LENGTH };
  line(ctx, view, tipPos, endPos, { color: COLORS.stick, width: 6 });

  // Vitesse en clair, au-dessus de la blanche
  const s = toScreen(view, c);
  ctx.save();
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(`${shot.speed.toFixed(1)} m/s`, s.x, s.y - cue.radius * view.scale - 10);
  ctx.restore();
}

export function drawState(ctx, view, state, aim = null) {
  drawTable(ctx, view, state.table);
  if (aim && aim.prediction) drawPrediction(ctx, view, aim.prediction);
  for (const b of state.balls) {
    if (b.pocketed) continue; // tombée : plus dessinée (animation de chute : plus tard)
    const p = toScreen(view, b.pos);
    drawBall(ctx, p.x, p.y, b.radius * view.scale, COLORS[b.kind]);
  }
  if (aim) drawAim(ctx, view, aim);
}
