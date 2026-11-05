// =====================================================================
// PHYSIQUE : point d'entrée
// Fonction pure : step(état, dt) renvoie un NOUVEL état, sans toucher
// à l'ancien. Ne connaît ni le canvas, ni les pixels.
//
//   cloth.js    frottements du tapis (glissement, roulement, air)
//   cushion.js  contact et choc bille/bande
//   events.js   déplacement avec recherche du premier contact
// =====================================================================
import { applyFriction } from './cloth.js';
import { moveBall } from './events.js';

export { PHYS } from './constants.js';

export function step(state, dt) {
  const cushions = state.table.cushions;
  return {
    ...state,
    time: state.time + dt,
    balls: state.balls.map((b) => moveBall(applyFriction(b, dt), dt, cushions)),
  };
}
