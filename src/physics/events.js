// =====================================================================
// DÉPLACEMENT AVEC CHOCS SUR LES BANDES
// Euler semi-implicite : on avance avec la NOUVELLE vitesse.
// Sur un pas, la trajectoire est supposée rectiligne à vitesse constante
// (la décélération sur 4 ms est négligeable pour trouver l'instant du choc).
// Boucle : on cherche le PREMIER contact dans le temps restant, on avance
// jusqu'à lui, on applique le choc, puis on recommence avec le temps
// qui reste. C'est ce qui gère deux bandes dans le même pas (coin).
// =====================================================================
import { PHYS } from './constants.js';
import { contactRadius, findCushionContact, cushionImpulse } from './cushion.js';

export function moveBall(b, dt, cushions) {
  let px = b.pos.x, py = b.pos.y;
  let vel = b.vel, omega = b.omega;
  let remaining = dt;

  for (let i = 0; i < PHYS.maxContactsPerStep; i++) {
    let best = null;
    for (const c of cushions) {
      const hit = findCushionContact(px, py, vel, contactRadius(b.radius, c), c, remaining);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    if (!best) break;

    px += vel.x * best.t;
    py += vel.y * best.t;
    remaining -= best.t;
    ({ vel, omega } = cushionImpulse(b, vel, omega, best.n, best.cushion));
  }

  return {
    ...b,
    pos: { x: px + vel.x * remaining, y: py + vel.y * remaining, z: b.pos.z },
    vel,
    omega,
  };
}
