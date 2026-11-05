// =====================================================================
// AIDES À LA VISÉE (fonctions pures, lecture seule de l'état)
// Niveau 2 (par défaut) : ligne jusqu'au premier contact, bille fantôme,
//   direction de départ de la couleur touchée.
// Niveau 3 (touche P, débogage) : prévision complète du coup, simulée
//   avec la VRAIE physique (step est pure : simuler ne touche pas au jeu).
// Le calcul du niveau 2 réutilise les fonctions de contact de la physique
// avec un rayon droit : ce que montre l'aide est ce que fera la physique
// au premier choc.
// =====================================================================
import { findBallBallContact } from '../physics/ballball.js';
import { contactRadius, findCushionContact } from '../physics/cushion.js';
import { step } from '../physics/index.js';
import { applyShot, isAtRest } from '../state.js';

const RAY_LENGTH = 10; // m : plus long que la diagonale de la table

// Premier obstacle sur la trajectoire rectiligne de la blanche.
// Renvoie { ghost, hit } : ghost = position de la blanche au contact ;
// hit = { type: 'ball', id, dir } (dir = direction de départ de la couleur,
// le long de la ligne des centres) ou { type: 'cushion' }.
export function computeGuide(state, cueId, angle) {
  const cue = state.balls.find((b) => b.id === cueId);
  const d = { x: Math.cos(angle), y: Math.sin(angle) };
  // "Blanche" fictive à 1 m/s : le temps de contact vaut la distance parcourue
  const ray = { ...cue, vel: { x: d.x, y: d.y, z: 0 } };

  let best = null;
  for (const o of state.balls) {
    if (o.id === cueId) continue;
    const t = findBallBallContact(ray, { ...o, vel: { x: 0, y: 0, z: 0 } }, RAY_LENGTH);
    if (t !== null && (!best || t < best.t)) best = { t, type: 'ball', ball: o };
  }
  for (const c of state.table.cushions) {
    const hit = findCushionContact(cue.pos.x, cue.pos.y, ray.vel, contactRadius(cue.radius, c), c, RAY_LENGTH);
    if (hit && (!best || hit.t < best.t)) best = { t: hit.t, type: 'cushion' };
  }
  if (!best) return null;

  const ghost = { x: cue.pos.x + d.x * best.t, y: cue.pos.y + d.y * best.t };
  if (best.type === 'cushion') return { ghost, hit: { type: 'cushion' } };

  const o = best.ball;
  const nx = o.pos.x - ghost.x, ny = o.pos.y - ghost.y;
  const len = Math.hypot(nx, ny);
  return { ghost, hit: { type: 'ball', id: o.id, kind: o.kind, from: { x: o.pos.x, y: o.pos.y }, dir: { x: nx / len, y: ny / len } } };
}

// Prévision complète : simule le coup jusqu'à l'arrêt (ou maxTime) et
// renvoie, pour chaque bille qui a bougé, la liste de ses positions.
export function predictShot(state, shot, { dt = 1 / 240, maxTime = 10, sampleEvery = 4 } = {}) {
  let s = applyShot(state, shot);
  const paths = new Map(s.balls.map((b) => [b.id, { kind: b.kind, points: [{ x: b.pos.x, y: b.pos.y }] }]));
  const steps = Math.round(maxTime / dt);
  for (let i = 1; i <= steps; i++) {
    s = step(s, dt);
    const done = isAtRest(s);
    if (i % sampleEvery === 0 || done) {
      for (const b of s.balls) paths.get(b.id).points.push({ x: b.pos.x, y: b.pos.y });
    }
    if (done) break;
  }
  // On ne garde que les billes qui ont bougé
  return [...paths.values()].filter(({ points: [a, ...rest] }) =>
    rest.some((q) => q.x !== a.x || q.y !== a.y)
  );
}
