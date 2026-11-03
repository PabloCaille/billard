// =====================================================================
// ENTRÉES
// Traduit le clavier/souris en COMMANDES abstraites ({ type: 'reset' }).
// Plus tard, une IA produira les mêmes commandes : le reste du jeu
// ne saura pas si c'est un humain ou une IA qui joue.
// =====================================================================

const queue = [];

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') queue.push({ type: 'reset' });
  });
}

// Renvoie les commandes accumulées depuis le dernier appel, puis vide la file
export function consumeCommands() {
  return queue.splice(0, queue.length);
}
