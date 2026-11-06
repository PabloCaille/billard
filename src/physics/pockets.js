// =====================================================================
// POCHES : instant de la chute
// La bille tombe quand son CENTRE dépasse la ligne de capture, située à
// captureDepth au-delà du point de référence de la poche (coin ou milieu
// de bande), perpendiculairement à l'axe d de la poche.
// Les mâchoires (segments de la table) gèrent les rebonds avant ça : ici
// on ne traite que la chute. Dans la boucle d'événements, c'est un
// événement comme un autre, donc l'instant est exact même à grande vitesse.
// =====================================================================

// Premier instant t ∈ [0, tMax] où le centre de la bille franchit la ligne
// de capture de la poche, ou null. Trajectoire rectiligne sur le pas.
export function findPocketCapture(b, pocket, tMax) {
  const vd = b.vel.x * pocket.d.x + b.vel.y * pocket.d.y; // vitesse vers l'extérieur
  if (vd <= 0) return null;

  const px = b.pos.x - pocket.ref.x, py = b.pos.y - pocket.ref.y;
  const d0 = px * pocket.d.x + py * pocket.d.y;           // profondeur actuelle
  const t = Math.max(0, (pocket.depth - d0) / vd);        // déjà au-delà : t = 0
  if (t > tMax) return null;

  // Garde-fou latéral : le franchissement doit se faire dans la poche
  const qx = px + b.vel.x * t, qy = py + b.vel.y * t;
  const u = qx * pocket.p.x + qy * pocket.p.y;
  return Math.abs(u) <= pocket.halfWidth ? t : null;
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
