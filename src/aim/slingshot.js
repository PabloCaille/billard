// =====================================================================
// VISÉE "LANCE-PIERRE INVERSÉ" (bloc Entrées)
// On appuie n'importe où sur la table, on place le curseur à l'opposé de
// la direction voulue, on relâche. L'ancrage est le CENTRE de la blanche :
//   direction = blanche - curseur
//   distance  = distance curseur/bord de la blanche
// Choix de game design (Pablo) : la puissance est INVERSÉE.
//   curseur PRÈS de la blanche -> coup FORT  (bras de levier court : imprécis)
//   curseur LOIN de la blanche -> coup DOUX  (bras de levier long  : précis)
// Erreur d'angle ≈ erreur de pointage / distance : à 1 px ≈ 2 mm près,
// environ 2,3° à 5 cm et 0,2° à 50 cm. Tirer fort demande plus de maîtrise.
//
//   ratio   = (distance - PULL_MIN) / (PULL_MAX - PULL_MIN), borné à [0, 1]
//   vitesse = V_MIN + (V_MAX - V_MIN)·(1 - ratio)²
// La courbe quadratique est plate côté coups doux : dosage fin loin de la
// blanche, et dosage difficile près d'elle, en plus de l'angle.
//
// Curseur sur la blanche au relâchement, Échap ou clic droit : coup annulé.
// Le module ne touche pas à l'état : il émet une commande `shoot`.
// =====================================================================

// Réglages de difficulté
export const V_MAX = 8;       // m/s : coups de jeu (la casse sera traitée à part)
export const V_MIN = 0.1;     // m/s : coup le plus doux
export const PULL_MIN = 0.05; // m du bord de la blanche : puissance max (plus près, on reste à V_MAX)
export const PULL_MAX = 0.5;  // m du bord de la blanche : puissance min (plus loin, on reste à V_MIN)

export function createSlingshot() {
  let dragging = false;
  let cursor = null; // position du curseur sur la table (m)

  // Coup qui partirait si on relâchait maintenant (ou null)
  function currentShot(cue) {
    if (!dragging || !cursor) return null;
    const dx = cue.pos.x - cursor.x, dy = cue.pos.y - cursor.y;
    const gap = Math.hypot(dx, dy) - cue.radius;
    if (gap <= 0) return null; // curseur sur la blanche : rien
    const ratio = Math.min(Math.max((gap - PULL_MIN) / (PULL_MAX - PULL_MIN), 0), 1);
    const power = (1 - ratio) * (1 - ratio); // 0 = coup le plus doux, 1 = le plus fort
    return {
      type: 'shoot',
      ballId: cue.id,
      speed: V_MIN + (V_MAX - V_MIN) * power,
      angle: Math.atan2(dy, dx),
      tip: { x: 0, y: 0 }, // point d'impact sur la blanche (étape 6)
      elevation: 0,        // inclinaison de la queue (saut, étape 6)
      power,               // pour l'affichage seulement, retiré de la commande
    };
  }

  return {
    press(worldPos) { dragging = true; cursor = worldPos; },
    move(worldPos) { if (dragging) cursor = worldPos; },
    cancel() { dragging = false; cursor = null; },
    // Relâchement : renvoie la commande à émettre, ou null
    release(cue) {
      const shot = currentShot(cue);
      dragging = false;
      cursor = null;
      if (!shot) return null;
      const { power, ...command } = shot;
      return command;
    },
    get dragging() { return dragging; },
    get cursor() { return cursor; },
    currentShot,
  };
}
