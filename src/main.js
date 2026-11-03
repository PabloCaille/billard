// =====================================================================
// CHEF D'ORCHESTRE : boucle de jeu à pas de temps fixe
// =====================================================================
import { createInitialState } from './state.js';
import { step } from './physics.js';
import { drawState } from './render.js';
import { initInput, consumeCommands } from './input.js';

const DT = 1 / 240;       // pas physique fixe (s)
const MAX_FRAME = 0.25;   // si l'onglet a été mis en pause, on n'essaie pas de rattraper 10 s d'un coup

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

let state = createInitialState();
let accumulator = 0;
let lastTime = null;

initInput();

function frame(now) {
  if (lastTime === null) lastTime = now;
  const elapsed = Math.min((now - lastTime) / 1000, MAX_FRAME);
  lastTime = now;

  // 1. Entrées
  for (const cmd of consumeCommands()) {
    if (cmd.type === 'reset') state = createInitialState();
  }

  // 2. Physique : autant de pas fixes que le temps réel écoulé le demande
  accumulator += elapsed;
  while (accumulator >= DT) {
    state = step(state, DT);
    accumulator -= DT;
  }

  // 3. Rendu (lecture seule de l'état)
  drawState(ctx, state);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
