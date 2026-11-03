// =====================================================================
// ÉTAT DU JEU
// Unités SI : mètres, secondes, kilogrammes, radians.
// Repère (convention méca, direct) :
//   origine = coin bas gauche du tapis
//   x vers la droite, y vers le haut de l'écran, z sortant du tapis
// Le rendu se charge de retourner l'axe y pour le canvas.
// =====================================================================

// Dimensions d'une table anglaise 7 pieds (surface de jeu)
export const TABLE = { length: 1.83, width: 0.915 };

// Caractéristiques des billes (masses à vérifier, elles n'interviennent
// que dans la traînée de l'air : partout ailleurs, m se simplifie)
const BALL_SPECS = {
  cue:    { radius: 0.0476 / 2, mass: 0.105 }, // blanche : 1 7/8"
  red:    { radius: 0.0508 / 2, mass: 0.118 }, // couleurs : 2"
  yellow: { radius: 0.0508 / 2, mass: 0.118 },
  black:  { radius: 0.0508 / 2, mass: 0.118 },
};

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });

// kind = identité de la bille (cue, red, yellow, black).
// La couleur d'affichage n'est PAS dans l'état : c'est le rendu qui décide.
export function createBall(id, kind, x, y) {
  const { radius, mass } = BALL_SPECS[kind];
  return {
    id,
    kind,
    radius,
    mass,
    pos: vec(x, y, radius), // centre posé sur le tapis : z = R
    vel: vec(),             // m/s
    omega: vec(),           // rad/s
  };
}

// Vitesse de test : frappe au centre, donc v0 sans rotation.
// v0 = 0,7 m/s : ~6 cm de glissement + ~1,28 m de roulement, arrêt sur la table.
export const TEST_SPEED = 0.7;

export function createInitialState() {
  const cue = createBall('blanche', 'cue', 0.40, TABLE.width / 2);
  cue.vel.x = TEST_SPEED;
  return {
    time: 0,
    table: { ...TABLE },
    balls: [cue],
  };
}
