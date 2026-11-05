// =====================================================================
// CHEF D'ORCHESTRE : boucle de jeu à pas de temps fixe
// =====================================================================
import { TABLE_SPECS, createTable, createState, applyShot } from './state.js';
import { createRandomScene, createScenario, SCENARIO_NAMES } from './scenarios.js';
import { step } from './physics/index.js';
import { createView } from './view.js';
import { drawState } from './render.js';
import { initInput, consumeCommands, getAim } from './input.js';

const DT = 1 / 240;       // pas physique fixe (s)
const MAX_FRAME = 0.25;   // si l'onglet a été mis en pause, on n'essaie pas de rattraper 10 s d'un coup

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const table = createTable(TABLE_SPECS.english7ft); // statique, partagée par tous les états
const view = createView(canvas.width, canvas.height, table); // la même pour le rendu et la souris
let state = createState(table, []);
let accumulator = 0;
let lastTime = null;

initInput({ canvas, view, getState: () => state });

function frame(now) {
  if (lastTime === null) lastTime = now;
  const elapsed = Math.min((now - lastTime) / 1000, MAX_FRAME);
  lastTime = now;

  // 1. Entrées
  for (const cmd of consumeCommands()) {
    if (cmd.type === 'loadScene') state = createState(table, createRandomScene(table, cmd.seed));
    if (cmd.type === 'loadScenario') {
      state = createState(table, createScenario(table, cmd.id));
      console.log(`Scénario ${cmd.id} : ${SCENARIO_NAMES[cmd.id]}`);
    }
    if (cmd.type === 'shoot') state = applyShot(state, cmd);
  }

  // 2. Physique : autant de pas fixes que le temps réel écoulé le demande
  accumulator += elapsed;
  while (accumulator >= DT) {
    state = step(state, DT);
    if (state.diag.overflow) console.warn(`Plafond de chocs atteint à t = ${state.time.toFixed(3)} s`);
    accumulator -= DT;
  }

  // 3. Rendu (lecture seule de l'état et de la visée)
  drawState(ctx, view, state, getAim(state));

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
