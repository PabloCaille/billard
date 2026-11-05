// =====================================================================
// ÉTAT DU JEU
// Unités SI : mètres, secondes, kilogrammes, radians.
// Repère (convention méca, direct) :
//   origine = coin bas gauche du tapis
//   x vers la droite, y vers le haut de l'écran, z sortant du tapis
// Le rendu se charge de retourner l'axe y pour le canvas.
// =====================================================================

// ---------------------------------------------------------------------
// TABLES
// Une table = une spec (dimensions + propriétés des bandes). D'autres
// modes de jeu pourront ajouter leur propre spec sans toucher au reste.
// length/width = surface de jeu ENTRE LES NEZ DE BANDE.
// ---------------------------------------------------------------------
export const TABLE_SPECS = {
  english7ft: {
    name: 'Pool anglais 7 pieds',
    length: 1.78,
    width: 0.89,
    cushion: {
      // e et μ_c : valeurs de Mathavan et al. (2010), à calibrer
      restitution: 0.98, // e : rapport des vitesses normales après/avant
      friction: 0.14,    // μ_c : frottement bille/bande
      // Nez de bande à 63,5 % du diamètre des couleurs (spec WPA, 50,8 mm) :
      // environ 1,27·R au-dessus du tapis. Hauteur absolue : la blanche,
      // plus petite, prend la bande plus haut par rapport à son centre.
      noseHeight: 0.0323, // m
    },
  },
};

// Construit la table utilisée par la physique et le rendu.
// Les bandes sont une LISTE DE SEGMENTS : pour l'instant 4, plus tard
// les mâchoires de poche s'ajouteront simplement à cette liste.
// Chaque segment porte sa normale unitaire n, dirigée vers le tapis.
export function createTable(spec) {
  const { length: L, width: W, cushion } = spec;
  const seg = (ax, ay, bx, by, nx, ny) => ({
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    n: { x: nx, y: ny },
    ...cushion,
  });
  return {
    name: spec.name,
    length: L,
    width: W,
    cushions: [
      seg(0, 0, L, 0, 0, 1),   // bande du bas
      seg(L, 0, L, W, -1, 0),  // bande de droite
      seg(L, W, 0, W, 0, -1),  // bande du haut
      seg(0, W, 0, 0, 1, 0),   // bande de gauche
    ],
  };
}

// Caractéristiques des billes (masses à vérifier). Elles comptent dans la
// traînée de l'air et, depuis l'étape 3, dans les chocs entre billes :
// la blanche, plus légère, recule un peu sur un plein sans effet.
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

// Un état = la table (donnée statique, partagée entre états successifs,
// que personne ne modifie) + la liste des billes.
export function createState(table, balls) {
  return { time: 0, table, balls };
}

// État minimal : la blanche seule au quart de la table, immobile.
// Gardé pour la simulation de référence (tests/reference.js).
export function createInitialState(spec = TABLE_SPECS.english7ft) {
  const table = createTable(spec);
  const cue = createBall('blanche', 'cue', table.length / 4, table.width / 2);
  return createState(table, [cue]);
}

// Toutes les billes sont-elles à l'arrêt ? (on ne vise qu'à ce moment-là)
export function isAtRest(state) {
  return state.balls.every((b) => b.vel.x === 0 && b.vel.y === 0 && b.vel.z === 0);
}

// Tir : commande { ballId, speed, angle, tip, elevation }.
// tip = point d'impact de la queue sur la blanche, elevation = inclinaison
// de la queue : prévus pour les effets et le saut (étape 6), toujours 0
// pour l'instant, donc ignorés. Frappe au centre : vitesse sans rotation.
// Renvoie un NOUVEL état.
export function applyShot(state, { ballId, speed, angle }) {
  return {
    ...state,
    balls: state.balls.map((b) =>
      b.id !== ballId
        ? b
        : { ...b, vel: vec(speed * Math.cos(angle), speed * Math.sin(angle), 0), omega: vec() }
    ),
  };
}
