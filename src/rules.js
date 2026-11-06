// =====================================================================
// RÈGLES (bloc Règles : fonctions pures sur l'état)
// Étape 5a : une seule règle PROVISOIRE, pour que le jeu ne se bloque pas.
// Si la blanche est tombée, on la remet au milieu de la ligne de baulk
// dès que tout est à l'arrêt. Les vraies règles (fautes, tours, groupes)
// arrivent en 5c et remplaceront celle-ci.
// =====================================================================
import { createBall, isAtRest } from './state.js';

const CUE_ID = 'blanche';
const SEARCH_STEP = 0.01; // m : si la place est prise, on décale le long de la ligne de baulk

const overlaps = (x, y, r, others) =>
  others.some((o) => !o.pocketed && Math.hypot(x - o.pos.x, y - o.pos.y) < r + o.radius + 1e-6);

// Renvoie le MÊME état si rien à faire, sinon un nouvel état.
export function applyRules(state) {
  const cue = state.balls.find((b) => b.id === CUE_ID);
  if (!cue || !cue.pocketed || !isAtRest(state)) return state;

  const { length: L, width: W } = state.table;
  const x = L / 5; // ligne de baulk
  const others = state.balls.filter((b) => b.id !== CUE_ID);
  const fresh = createBall(CUE_ID, 'cue', x, W / 2);
  // Milieu de la ligne ; si une bille l'occupe, on s'éloigne en alternant haut/bas
  let y = W / 2;
  for (let k = 1; overlaps(x, y, fresh.radius, others) && k < 80; k++) {
    y = W / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * SEARCH_STEP;
  }
  const respot = createBall(CUE_ID, 'cue', x, y);
  return { ...state, balls: state.balls.map((b) => (b.id === CUE_ID ? respot : b)) };
}
