// =====================================================================
// ENTRÉES
// Traduit le clavier/souris en COMMANDES abstraites.
// Plus tard, une IA produira les mêmes commandes : le reste du jeu
// ne saura pas si c'est un humain ou une IA qui joue.
//
// Le hasard est tiré ICI, pas dans la physique : la commande transporte
// des valeurs fixées, donc la simulation reste déterministe et un tir
// peut être rejoué à l'identique (touche T).
// =====================================================================

const SHOT_SPEED_MIN = 0.5; // m/s
const SHOT_SPEED_MAX = 2.5; // m/s

const queue = [];
let lastShot = null;

function randomShot() {
  return {
    type: 'shoot',
    ballId: 'blanche',
    speed: SHOT_SPEED_MIN + Math.random() * (SHOT_SPEED_MAX - SHOT_SPEED_MIN),
    angle: Math.random() * 2 * Math.PI, // rad, 0 = vers la droite, sens trigo
  };
}

function pushShot(shot) {
  lastShot = shot;
  queue.push({ type: 'reset' }, shot);
  console.log(
    `Tir : v0 = ${shot.speed.toFixed(3)} m/s, angle = ${(shot.angle * 180 / Math.PI).toFixed(1)}°`
  );
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'r') pushShot(randomShot());           // nouveau tir aléatoire
    if (k === 't' && lastShot) pushShot(lastShot);   // rejoue le dernier tir
  });
  pushShot(randomShot()); // un tir dès le chargement
}

// Renvoie les commandes accumulées depuis le dernier appel, puis vide la file
export function consumeCommands() {
  return queue.splice(0, queue.length);
}
