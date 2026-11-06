// =====================================================================
// POCHES : instant de la chute
// Principe de gravité : la bille tombe quand son CENTRE n'est plus
// soutenu, c'est-à-dire quand il entre dans le trou de l'ardoise.
// Ce trou est un disque (pocket.fall : centre et rayon) dont le point le
// plus proche du tapis, sur l'axe de la poche, est à captureDepth au-delà
// de la ligne des nez. Le bord est donc courbe : une bille qui longe une
// paroi tombe un peu plus loin qu'une bille dans l'axe.
// Les mâchoires (segments de la table) gèrent les rebonds avant ça : ici
// on ne traite que la chute. Dans la boucle d'événements, c'est un
// événement comme un autre, donc l'instant est exact même à grande vitesse.
// Le disque est entièrement hors du tapis : on n'y entre qu'en passant
// par l'ouverture de la poche.
// =====================================================================

// Premier instant t ∈ [0, tMax] où le centre de la bille entre dans le
// disque de chute de la poche, ou null. Trajectoire rectiligne sur le pas.
// Même calcul que le contact bille/bille : |q + v·t|² = r², q = p - centre.
export function findPocketCapture(b, pocket, tMax) {
  const { x: fx, y: fy, r } = pocket.fall;
  const qx = b.pos.x - fx, qy = b.pos.y - fy;
  const c = qx * qx + qy * qy - r * r;
  if (c <= 0) return 0; // déjà dans le trou

  const a = b.vel.x * b.vel.x + b.vel.y * b.vel.y;
  const bq = qx * b.vel.x + qy * b.vel.y;
  if (a === 0 || bq >= 0) return null; // immobile, ou on s'éloigne du trou
  const disc = bq * bq - a * c;
  if (disc < 0) return null;           // la trajectoire passe à côté
  const t = (-bq - Math.sqrt(disc)) / a;
  return t <= tMax ? t : null;
}

// Bille tombée : plus de vitesse, plus de rotation, marquée pour les règles
export function pocketBall(b, pocketIndex) {
  return {
    ...b,
    vel: { x: 0, y: 0, z: 0 },
    omega: { x: 0, y: 0, z: 0 },
    pocketed: true,
    pocket: pocketIndex,
  };
}
