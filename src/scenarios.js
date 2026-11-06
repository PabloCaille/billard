// =====================================================================
// SCÈNES DE TEST (bloc État : données pures, aucun accès à l'écran)
//
// Scène 0 : la blanche à un point fixe + les 15 couleurs tirées au
//   hasard avec une GRAINE. Même graine = même disposition, au bit près.
//   Le tirage force des cas limites (billes collées à une bande, paires
//   collées) : un tirage uniforme n'en produirait jamais.
// Scénarios 1 à 5 : états initiaux complets (positions, v ET ω) pour
//   tester un comportement précis. Imposer ω permet d'avoir un glissement
//   pur ou un roulement pur au moment du choc, impossible avec un simple
//   tir avant l'étape 6.
// =====================================================================
import { createBall } from './state.js';
import { contactRadius, segmentDistance } from './physics/cushion.js';

// "Collée" = au contact + 1 µm : jamais de chevauchement à cause des arrondis
const TOUCH_GAP = 1e-6; // m
const CUE_CLEARANCE = 0.10; // m : aucune couleur à moins de 10 cm de la blanche

// Générateur pseudo-aléatoire à graine (mulberry32) : rapide, déterministe
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distance 3D entre centres (les centres sont à z = R : la blanche, plus
// petite, a son centre plus bas)
const dist3 = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);

// Distance minimale centre/bande pour que la bille ne pénètre pas une bande
// DROITE : tous les segments partagent le même nez, on lit la marge sur le 1er.
const cushionMargin = (table, b) => contactRadius(b.radius, table.cushions[0]);

// Jeu entre la bille et la bande ou mâchoire la plus proche (< 0 : pénétration)
export function cushionClearance(table, b) {
  let best = Infinity;
  for (const c of table.cushions) {
    best = Math.min(best, segmentDistance(b.pos.x, b.pos.y, c) - contactRadius(b.radius, c));
  }
  return best;
}

function fits(table, b, placed) {
  const m = cushionMargin(table, b) + TOUCH_GAP * 0.5;
  if (b.pos.x < m || b.pos.x > table.length - m) return false;
  if (b.pos.y < m || b.pos.y > table.width - m) return false;
  // Mâchoires de poche comprises (le rectangle seul laisserait passer une
  // bille posée dans l'ouverture d'une poche)
  if (cushionClearance(table, b) < TOUCH_GAP * 0.5) return false;
  for (const o of placed) {
    const minD = b.radius + o.radius + TOUCH_GAP * 0.5;
    if (dist3(b, o) < minD) return false;
    if (o.kind === 'cue' && dist3(b, o) < CUE_CLEARANCE) return false;
  }
  return true;
}

function colourKinds() {
  const kinds = [];
  for (let i = 1; i <= 7; i++) kinds.push(['jaune' + i, 'yellow']);
  for (let i = 1; i <= 7; i++) kinds.push(['rouge' + i, 'red']);
  kinds.push(['noire', 'black']);
  return kinds;
}

export function createRandomScene(table, seed) {
  const rnd = mulberry32(seed);
  const L = table.length, W = table.width;

  const cue = createBall('blanche', 'cue', L / 5, W / 2); // milieu de la ligne de baulk
  const placed = [cue];

  // Ordre des couleurs mélangé (Fisher-Yates), pour que la noire ou une
  // jaune puissent tomber dans les cas "collés"
  const kinds = colourKinds();
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }

  const tryPlace = (make) => {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const b = make();
      if (b && fits(table, b, placed)) { placed.push(b); return b; }
    }
    throw new Error(`Scène ${seed} : impossible de placer une bille`);
  };

  const freeBall = ([id, kind]) => () => {
    const b = createBall(id, kind, 0, 0);
    const m = cushionMargin(table, b);
    return createBall(id, kind, m + rnd() * (L - 2 * m), m + rnd() * (W - 2 * m));
  };

  let k = 0;
  // 3 billes collées à une bande (bande et position le long de la bande au hasard)
  for (let n = 0; n < 3; n++, k++) {
    const [id, kind] = kinds[k];
    tryPlace(() => {
      const b = createBall(id, kind, 0, 0);
      const d = cushionMargin(table, b) + TOUCH_GAP;
      const side = Math.floor(rnd() * 4); // 0 bas, 1 droite, 2 haut, 3 gauche
      const along = rnd();
      if (side === 0) return createBall(id, kind, d + along * (L - 2 * d), d);
      if (side === 1) return createBall(id, kind, L - d, d + along * (W - 2 * d));
      if (side === 2) return createBall(id, kind, d + along * (L - 2 * d), W - d);
      return createBall(id, kind, d, d + along * (W - 2 * d));
    });
  }
  // 2 paires de billes collées (direction de la paire au hasard)
  for (let n = 0; n < 2; n++, k += 2) {
    const first = tryPlace(freeBall(kinds[k]));
    const [id, kind] = kinds[k + 1];
    tryPlace(() => {
      const phi = rnd() * 2 * Math.PI;
      const D = first.radius + createBall(id, kind, 0, 0).radius + TOUCH_GAP;
      return createBall(id, kind, first.pos.x + D * Math.cos(phi), first.pos.y + D * Math.sin(phi));
    });
  }
  // Le reste, librement
  for (; k < kinds.length; k++) tryPlace(freeBall(kinds[k]));

  return placed;
}

// ---------------------------------------------------------------------
// SCÉNARIOS 1 À 8 (lancés tels quels : 1 à 5 à 1 m/s ; 6 à 8 vers une poche)
// Roulement pur dans la direction +x : ω = (0, v/R, 0)  (v = R·ω, r = -R·z)
// ---------------------------------------------------------------------
function moving(id, kind, x, y, v, rolling) {
  const b = createBall(id, kind, x, y);
  return {
    ...b,
    vel: { x: v, y: 0, z: 0 },
    omega: { x: 0, y: rolling ? v / b.radius : 0, z: 0 },
  };
}

// Bille en roulement pur (ou non) lancée vers un point cible
function movingToward(id, kind, x, y, target, speed, rolling) {
  const b = createBall(id, kind, x, y);
  const a = Math.atan2(target.y - y, target.x - x);
  const vx = speed * Math.cos(a), vy = speed * Math.sin(a);
  // Roulement pur : ωx = -vy/R, ωy = vx/R
  return { ...b, vel: { x: vx, y: vy, z: 0 }, omega: rolling ? { x: -vy / b.radius, y: vx / b.radius, z: 0 } : { x: 0, y: 0, z: 0 } };
}

export const SCENARIO_NAMES = {
  1: 'Plein, blanche en glissement pur',
  2: 'Plein, blanche en roulement pur',
  3: 'Coupe demi-bille, glissement pur',
  4: 'Coupe demi-bille, roulement pur',
  5: 'Blanche vers 3 couleurs alignées collées',
  6: 'Blanche droit dans le coin bas gauche (doit tomber)',
  7: 'Blanche sur le genou de la mâchoire du milieu bas (rebond)',
  8: 'Blanche en biais vers la poche du milieu bas',
};

export function createScenario(table, id) {
  const W = table.width;
  const target = createBall('rouge1', 'red', 1.2, W / 2);
  const cueR = createBall('x', 'cue', 0, 0).radius;
  // Distance HORIZONTALE entre centres au contact : 2·√(R1·R2)
  // (les centres ne sont pas à la même hauteur)
  const h = 2 * Math.sqrt(cueR * target.radius);
  const GAP = 0.01; // la blanche part à 1 cm du contact

  switch (id) {
    case 1:
    case 2:
      return [moving('blanche', 'cue', target.pos.x - h - GAP, W / 2, 1, id === 2), target];
    case 3:
    case 4: {
      // Demi-bille : décalage latéral = moitié de la distance de contact
      const dy = h / 2;
      const dx = Math.sqrt(h * h - dy * dy);
      return [moving('blanche', 'cue', target.pos.x - dx - GAP, W / 2 - dy, 1, id === 4), target];
    }
    case 5: {
      const D = 2 * target.radius + TOUCH_GAP;
      const row = [0, 1, 2].map((i) =>
        createBall(['rouge1', 'jaune1', 'rouge2'][i], i === 1 ? 'yellow' : 'red', 1.0 + i * D, W / 2)
      );
      return [moving('blanche', 'cue', 1.0 - h - 0.10, W / 2, 1, true), ...row];
    }
    case 6: {
      // Sur l'axe du coin bas gauche, visée sur le point de référence de la poche
      const pk = table.pockets[0];
      return [movingToward('blanche', 'cue', 0.40, 0.40, pk.ref, 1, true)];
    }
    case 7: {
      // Visée sur le point le plus étroit de la mâchoire : le centre vise le genou
      const pk = table.pockets[1];
      return [movingToward('blanche', 'cue', pk.ref.x + 0.30, 0.30, pk.narrow[0], 1.5, true)];
    }
    case 8: {
      // Tir en biais vers le milieu de l'ouverture
      const pk = table.pockets[1];
      return [movingToward('blanche', 'cue', pk.ref.x - 0.35, 0.30, pk.center, 1.2, true)];
    }
    default:
      throw new Error(`Scénario inconnu : ${id}`);
  }
}
