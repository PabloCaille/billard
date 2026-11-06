// =====================================================================
// ENTRÉES
// Traduit souris, clavier et panneau de test en COMMANDES abstraites.
// Plus tard, une IA produira les mêmes commandes : le reste du jeu
// ne saura pas si c'est un humain ou une IA qui joue.
//
// Le hasard est tiré ICI, pas dans la physique : chaque commande
// transporte des valeurs fixées, donc la simulation reste déterministe.
//
// Deux usages côte à côte :
//   - JEU : visée au lance-pierre inversé sur la table, en continu (la blanche
//     part d'où elle s'est arrêtée), seulement quand tout est à l'arrêt
//   - TEST : panneau sous la table (outil de développement)
//
//   Souris         : appuyer, placer le curseur à l'opposé du tir, relâcher
//                    (près de la blanche = fort, loin = doux ; Échap / clic droit : annuler)
//   P              : prévision complète du coup (débogage)
//   Tirer / Espace : recharge la scène 0 (même graine) puis tire avec les curseurs
//   R              : valeurs aléatoires dans les curseurs, puis Tirer
//   N              : nouvelle graine, nouvelle disposition des couleurs
//   0              : recharge la scène 0, à l'arrêt
//   1 à 8          : scénarios de test (6 à 8 : poches)
//
// getAim() fournit au rendu une vue EN LECTURE SEULE de la visée en cours.
// =====================================================================
import { toWorld } from './view.js';
import { isAtRest } from './state.js';
import { createSlingshot } from './aim/slingshot.js';
import { computeGuide, predictShot } from './aim/aids.js';

const DEFAULT_SEED = 2026;
const RANDOM_SPEED_MIN = 0.5; // m/s
const RANDOM_SPEED_MAX = 6;   // m/s
const CUE_ID = 'blanche';

const queue = [];
let seed = DEFAULT_SEED;
let ui = null;
let getState = null;
let showPrediction = false;
let predictionCache = { key: null, paths: null };
const slingshot = createSlingshot();

// ---------------------------------------------------------------------
// Panneau de test
// ---------------------------------------------------------------------
function readPanelShot() {
  return {
    type: 'shoot',
    ballId: CUE_ID,
    speed: Number(ui.speed.value),
    angle: (Number(ui.angle.value) * Math.PI) / 180, // rad, repère méca : 0 = +x, sens trigo
    tip: { x: 0, y: 0 },
    elevation: 0,
  };
}

function refreshLabels() {
  ui.speedValue.textContent = Number(ui.speed.value).toFixed(1);
  ui.angleValue.textContent = ui.angle.value;
  ui.seedValue.textContent = seed;
}

function panelShoot() {
  slingshot.cancel();
  const shot = readPanelShot();
  queue.push({ type: 'loadScene', seed }, shot);
  console.log(`Tir (panneau) : graine ${seed}, v0 = ${shot.speed.toFixed(1)} m/s, angle = ${ui.angle.value}°`);
}

function randomShot() {
  const v = RANDOM_SPEED_MIN + Math.random() * (RANDOM_SPEED_MAX - RANDOM_SPEED_MIN);
  ui.speed.value = v.toFixed(1);
  ui.angle.value = Math.floor(Math.random() * 360);
  refreshLabels();
  panelShoot();
}

function newSeed() {
  seed = Math.floor(Math.random() * 1e6);
  refreshLabels();
  slingshot.cancel();
  queue.push({ type: 'loadScene', seed });
  console.log(`Nouvelle graine : ${seed}`);
}

// ---------------------------------------------------------------------
// Souris (visée en jeu)
// ---------------------------------------------------------------------
function pointerToWorld(canvas, view, e) {
  // Le canvas peut être affiché à une autre taille que sa résolution
  const r = canvas.getBoundingClientRect();
  return toWorld(view, {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  });
}

const cueOf = (state) => state.balls.find((b) => b.id === CUE_ID && !b.pocketed);

function initPointer(canvas, view) {
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) { slingshot.cancel(); return; }
    if (e.button !== 0) return;
    const state = getState();
    if (!cueOf(state) || !isAtRest(state)) return; // on ne vise que quand tout est arrêté
    canvas.setPointerCapture(e.pointerId); // le relâchement est reçu même hors du canvas
    slingshot.press(pointerToWorld(canvas, view, e));
  });
  canvas.addEventListener('pointermove', (e) => slingshot.move(pointerToWorld(canvas, view, e)));
  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0 || !slingshot.dragging) return;
    const cue = cueOf(getState());
    const shot = slingshot.release(cue);
    if (!shot) return;
    queue.push(shot);
    console.log(`Tir : v0 = ${shot.speed.toFixed(2)} m/s, angle = ${((shot.angle * 180) / Math.PI).toFixed(1)}°`);
  });
}

// ---------------------------------------------------------------------
export function initInput({ canvas, view, getState: gs }) {
  getState = gs;
  const $ = (id) => document.getElementById(id);
  ui = {
    speed: $('speed'), angle: $('angle'),
    speedValue: $('speed-value'), angleValue: $('angle-value'), seedValue: $('seed-value'),
  };
  ui.speed.addEventListener('input', refreshLabels);
  ui.angle.addEventListener('input', refreshLabels);
  $('shoot').addEventListener('click', panelShoot);
  initPointer(canvas, view);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); panelShoot(); }
    else if (k === 'escape') slingshot.cancel();
    else if (k === 'p') {
      showPrediction = !showPrediction;
      console.log(`Prévision complète : ${showPrediction ? 'activée' : 'désactivée'}`);
    }
    else if (k === 'r') randomShot();
    else if (k === 'n') newSeed();
    else if (k === '0') { slingshot.cancel(); queue.push({ type: 'loadScene', seed }); }
    else if (k >= '1' && k <= '8') { slingshot.cancel(); queue.push({ type: 'loadScenario', id: Number(k) }); }
  });

  refreshLabels();
  queue.push({ type: 'loadScene', seed }); // au démarrage : scène 0, tout à l'arrêt
}

// Renvoie les commandes accumulées depuis le dernier appel, puis vide la file
export function consumeCommands() {
  return queue.splice(0, queue.length);
}

// Vue de la visée pour le rendu (null si on ne vise pas)
export function getAim(state) {
  const cue = cueOf(state);
  if (!cue || !slingshot.dragging || !isAtRest(state)) return null;
  const shot = slingshot.currentShot(cue);
  const cursor = slingshot.cursor;
  if (!shot) return { cue, cursor, shot: null };

  const aim = { cue, cursor, shot, guide: computeGuide(state, CUE_ID, shot.angle), prediction: null };
  if (showPrediction) {
    // On ne resimule que si le coup ou la position des billes a changé
    const layout = state.balls.map((b) => `${b.pos.x.toFixed(5)},${b.pos.y.toFixed(5)}`).join(';');
    const key = `${shot.speed.toFixed(3)}|${shot.angle.toFixed(4)}|${layout}`;
    if (predictionCache.key !== key) predictionCache = { key, paths: predictShot(state, shot) };
    aim.prediction = predictionCache.paths;
  }
  return aim;
}
