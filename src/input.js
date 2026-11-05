// =====================================================================
// ENTRÉES
// Traduit le clavier et le panneau de test en COMMANDES abstraites.
// Plus tard, une IA produira les mêmes commandes : le reste du jeu
// ne saura pas si c'est un humain ou une IA qui joue.
//
// Le hasard est tiré ICI, pas dans la physique : chaque commande
// transporte des valeurs fixées, donc la simulation reste déterministe.
//
// Le panneau (curseurs vitesse et angle) est un OUTIL DE TEST, pas le
// système de visée du jeu (étape 4).
//
//   Tirer / Espace : recharge la scène 0 (même graine) puis tire la blanche
//   R              : valeurs aléatoires dans les curseurs, puis Tirer
//   N              : nouvelle graine, nouvelle disposition des couleurs
//   0              : recharge la scène 0, à l'arrêt
//   1 à 5          : scénarios de test
// =====================================================================

const DEFAULT_SEED = 2026;
const RANDOM_SPEED_MIN = 0.5; // m/s
const RANDOM_SPEED_MAX = 6;   // m/s

const queue = [];
let seed = DEFAULT_SEED;
let ui = null;

function readShot() {
  return {
    type: 'shoot',
    ballId: 'blanche',
    speed: Number(ui.speed.value),
    angle: (Number(ui.angle.value) * Math.PI) / 180, // rad, repère méca : 0 = +x, sens trigo
  };
}

function refreshLabels() {
  ui.speedValue.textContent = Number(ui.speed.value).toFixed(1);
  ui.angleValue.textContent = ui.angle.value;
  ui.seedValue.textContent = seed;
}

function shoot() {
  const shot = readShot();
  queue.push({ type: 'loadScene', seed }, shot);
  console.log(`Tir : graine ${seed}, v0 = ${shot.speed.toFixed(1)} m/s, angle = ${ui.angle.value}°`);
}

function randomShot() {
  const v = RANDOM_SPEED_MIN + Math.random() * (RANDOM_SPEED_MAX - RANDOM_SPEED_MIN);
  ui.speed.value = v.toFixed(1);
  ui.angle.value = Math.floor(Math.random() * 360);
  refreshLabels();
  shoot();
}

function newSeed() {
  seed = Math.floor(Math.random() * 1e6);
  refreshLabels();
  queue.push({ type: 'loadScene', seed });
  console.log(`Nouvelle graine : ${seed}`);
}

export function initInput() {
  const $ = (id) => document.getElementById(id);
  ui = {
    speed: $('speed'), angle: $('angle'),
    speedValue: $('speed-value'), angleValue: $('angle-value'), seedValue: $('seed-value'),
  };
  ui.speed.addEventListener('input', refreshLabels);
  ui.angle.addEventListener('input', refreshLabels);
  $('shoot').addEventListener('click', shoot);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); shoot(); }
    else if (k === 'r') randomShot();
    else if (k === 'n') newSeed();
    else if (k === '0') queue.push({ type: 'loadScene', seed });
    else if (k >= '1' && k <= '5') queue.push({ type: 'loadScenario', id: Number(k) });
  });

  refreshLabels();
  queue.push({ type: 'loadScene', seed }); // au démarrage : scène 0, tout à l'arrêt
}

// Renvoie les commandes accumulées depuis le dernier appel, puis vide la file
export function consumeCommands() {
  return queue.splice(0, queue.length);
}
