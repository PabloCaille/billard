// =====================================================================
// PHYSIQUE : point d'entrée
// Fonction pure : step(état, dt) renvoie un NOUVEL état, sans toucher
// à l'ancien. Ne connaît ni le canvas, ni les pixels.
//
//   constants.js  constantes physiques
//   cloth.js      frottements du tapis (glissement, roulement, air)
//   cushion.js    contact et choc bille/bande
//   ballball.js   contact et choc bille/bille
//   events.js     boucle d'événements : déplacement de toutes les billes
// =====================================================================
import { applyFriction } from './cloth.js';
import { moveBalls } from './events.js';

export { PHYS } from './constants.js';

// state.diag = diagnostic du dernier pas (nombre de chocs, plafond atteint).
// La physique n'écrit rien dans la console : c'est main.js qui décide.
export function step(state, dt) {
  const { balls, events, overflow } = moveBalls(
    state.balls.map((b) => applyFriction(b, dt)),
    dt,
    state.table.cushions
  );
  return { ...state, time: state.time + dt, balls, diag: { events, overflow } };
}
