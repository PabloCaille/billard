// =====================================================================
// BOUCLE D'ÉVÉNEMENTS : déplacement de TOUTES les billes avec les chocs
// Euler semi-implicite : on avance avec la NOUVELLE vitesse.
// Sur un pas, les trajectoires sont supposées rectilignes à vitesse
// constante (la décélération sur 4 ms est négligeable pour trouver
// l'instant du choc).
//
// Une bille ne peut plus être déplacée seule : si A touche B à 0,3·dt,
// B doit être au bon endroit à cet instant. Donc, sur le temps restant :
//   1. chercher le PREMIER événement parmi toutes les bandes (mâchoires de
//      poche comprises), les lignes de capture des poches et toutes les
//      paires de billes (force brute : 120 paires à 16 billes) ;
//   2. avancer toutes les billes jusqu'à cet instant ;
//   3. résoudre ce seul événement (choc, ou chute dans une poche) ;
//   4. recommencer avec le temps qui reste.
// Un contact n'est retenu que si les objets se rapprochent : deux billes
// au repos qui se touchent ne créent pas de boucle infinie.
// =====================================================================
import { PHYS } from './constants.js';
import { contactRadius, findCushionContact, cushionImpulse } from './cushion.js';
import { findBallBallContact, resolveBallBall } from './ballball.js';
import { findPocketCapture, pocketBall } from './pockets.js';

const isMoving = (b) => b.vel.x !== 0 || b.vel.y !== 0 || b.vel.z !== 0;

// Contrainte du tapis, appliquée à UN SEUL endroit après chaque choc :
// la bille reste posée (z = R) et le tapis absorbe toute vitesse verticale.
// C'est la règle à retirer (ou à conditionner) pour le saut, à l'étape 6.
function clothConstraint(b) {
  return { ...b, pos: { ...b.pos, z: b.radius }, vel: { ...b.vel, z: 0 } };
}

function advance(balls, t) {
  if (t === 0) return balls;
  return balls.map((b) =>
    isMoving(b)
      ? { ...b, pos: { x: b.pos.x + b.vel.x * t, y: b.pos.y + b.vel.y * t, z: b.pos.z } }
      : b
  );
}

function findFirstEvent(balls, cushions, pockets, tMax) {
  let best = null;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.pocketed || !isMoving(b)) continue;
    for (let k = 0; k < pockets.length; k++) {
      const t = findPocketCapture(b, pockets[k], tMax);
      if (t !== null && (!best || t < best.t)) best = { t, type: 'pocket', i, pocket: k };
    }
    for (const c of cushions) {
      const hit = findCushionContact(b.pos.x, b.pos.y, b.vel, contactRadius(b.radius, c), c, tMax);
      if (hit && (!best || hit.t < best.t)) {
        best = { t: hit.t, type: 'cushion', i, n: hit.n, cushion: c };
      }
    }
  }
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[j].pocketed) continue;
      if (!isMoving(balls[i]) && !isMoving(balls[j])) continue;
      const t = findBallBallContact(balls[i], balls[j], tMax);
      if (t !== null && (!best || t < best.t)) best = { t, type: 'ball', i, j };
    }
  }
  return best;
}

// Renvoie { balls, events, overflow }. overflow = true si le plafond
// d'événements a été atteint (le reste du pas est alors fait sans choc).
export function moveBalls(balls, dt, cushions, pockets = []) {
  let remaining = dt;
  let events = 0;
  let overflow = false;

  while (true) {
    const ev = findFirstEvent(balls, cushions, pockets, remaining);
    if (!ev) break;
    if (events >= PHYS.maxEventsPerStep) { overflow = true; break; }
    events++;

    balls = advance(balls, ev.t);
    remaining -= ev.t;
    balls = balls.slice();

    if (ev.type === 'pocket') {
      balls[ev.i] = pocketBall(balls[ev.i], ev.pocket);
    } else if (ev.type === 'cushion') {
      const b = balls[ev.i];
      const { vel, omega } = cushionImpulse(b, b.vel, b.omega, ev.n, ev.cushion);
      balls[ev.i] = clothConstraint({ ...b, vel, omega });
    } else {
      const [b1, b2] = resolveBallBall(balls[ev.i], balls[ev.j]);
      balls[ev.i] = clothConstraint(b1);
      balls[ev.j] = clothConstraint(b2);
    }
  }

  return { balls: advance(balls, remaining), events, overflow };
}
