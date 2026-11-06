// =====================================================================
// PHYSIQUE : point d'entrée
// Fonction pure : step(état, dt) renvoie un NOUVEL état, sans toucher
// à l'ancien. Ne connaît ni le canvas, ni les pixels.
//
//   constants.js  constantes physiques
//   cloth.js      frottements du tapis (glissement, roulement, air)
//   cushion.js    contact et choc bille/bande
//   ballball.js   contact et choc bille/bille
//   pockets.js    chute dans une poche
//   events.js     boucle d'événements : déplacement de toutes les billes
// =====================================================================
import { applyFriction } from './cloth.js';
import { moveBalls } from './events.js';

export { PHYS } from './constants.js';

// state.diag = diagnostic du dernier pas (nombre de chocs, plafond atteint).
// La physique n'écrit rien dans la console : c'est main.js qui décide.
export function step(state, dt) {
  const { balls, events, overflow } = moveBalls(
    state.balls.map((b) => (b.pocketed ? b : applyFriction(b, dt))),
    dt,
    state.table.cushions,
    state.table.pockets
  );
  // Bille tombée pendant ce pas : on note l'instant (les règles lisent l'ordre)
  const time = state.time + dt;
  const stamped = balls.map((b, i) =>
    b.pocketed && !state.balls[i].pocketed ? { ...b, pocketedAt: time } : b
  );
  return { ...state, time, balls: stamped, diag: { events, overflow } };
}
