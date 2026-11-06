// =====================================================================
// GÉOMÉTRIE DE LA TABLE : bandes droites + mâchoires de poche courbes
// Fonction pure : spec -> { cushions, pockets }. Donnée statique, jamais
// modifiée ensuite. Aucun accès à l'écran ni à la physique.
//
// Une poche = deux mâchoires symétriques autour d'un axe d (unitaire,
// dirigé vers l'extérieur de la table). Chaque mâchoire, vue depuis la table :
//
//   bande (nez) ──► arc de rayon rk (genou arrondi) ──► paroi presque droite
//
// L'arc est tangent à la ligne des nez de la bande, puis tourne jusqu'à la
// direction de la paroi. La paroi s'évase de flareDeg par rapport à l'axe
// (poche anglaise : étroite, quasi parallèle, un peu plus large au fond).
//
// "Ouverture" (mouth) = écart MINIMAL entre les deux mâchoires, c'est-à-dire
// entre les deux points où les arcs rejoignent les parois. C'est la largeur
// que la bille doit passer. Les poches du milieu sont plus larges que les
// coins de spec.pocket.middleExtra. Le point où la bande quitte la ligne droite est
// donc un peu plus large que l'ouverture (de l'ordre de rk de chaque côté).
//
// Repère : celui de l'état (mètres, origine coin bas gauche, y vers le haut).
// Convention : p = rot90(d). σ = +1 est le côté de la mâchoire vers +p, σ = -1
// vers -p.
// =====================================================================

const dot2 = (a, b) => a.x * b.x + a.y * b.y;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
const rot90 = (v) => ({ x: -v.y, y: v.x });
const unit = (v) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const ARC_STEP = (15 * Math.PI) / 180; // un côté de l'arc tous les 15° au plus
const WALL_MARGIN = 0.04;              // m : la paroi dépasse la ligne de capture d'au moins ça

export function buildTableGeometry(spec) {
  const { length: L, width: W, cushion, pocket: P } = spec;
  const cornerMouth = P.mouthRatio * P.refBallDiameter;
  const rk = P.knuckleRadius;
  const f = (P.flareDeg * Math.PI) / 180;

  // Lignes de nez des 4 bandes : point, normale vers le tapis, direction
  const rails = {
    bottom: { P0: { x: 0, y: 0 }, n: { x: 0, y: 1 },  dir: { x: 1, y: 0 },  pts: [] },
    right:  { P0: { x: L, y: 0 }, n: { x: -1, y: 0 }, dir: { x: 0, y: 1 },  pts: [] },
    top:    { P0: { x: L, y: W }, n: { x: 0, y: -1 }, dir: { x: -1, y: 0 }, pts: [] },
    left:   { P0: { x: 0, y: W }, n: { x: 1, y: 0 },  dir: { x: 0, y: -1 }, pts: [] },
  };

  const s2 = Math.SQRT1_2;
  // ref = point de référence de la poche : le coin (nez contre nez) ou le
  // milieu de la bande. rail.plus / rail.minus = bande de chaque côté.
  const defs = [
    { name: 'coin bas gauche',  ref: { x: 0, y: 0 },     d: { x: -s2, y: -s2 }, rail: { plus: 'bottom', minus: 'left' } },
    { name: 'milieu bas',       ref: { x: L / 2, y: 0 }, d: { x: 0, y: -1 },     rail: { plus: 'bottom', minus: 'bottom' } },
    { name: 'coin bas droite',  ref: { x: L, y: 0 },     d: { x: s2, y: -s2 },   rail: { plus: 'right',  minus: 'bottom' } },
    { name: 'coin haut droite', ref: { x: L, y: W },     d: { x: s2, y: s2 },    rail: { plus: 'top',    minus: 'right' } },
    { name: 'milieu haut',      ref: { x: L / 2, y: W }, d: { x: 0, y: 1 },      rail: { plus: 'top',    minus: 'top' } },
    { name: 'coin haut gauche', ref: { x: 0, y: W },     d: { x: -s2, y: s2 },   rail: { plus: 'left',   minus: 'top' } },
  ];

  const mkSeg = (a, b, n) => ({ a, b, n, ...cushion });
  const jaws = [];
  const pockets = [];

  for (const def of defs) {
    const d = def.d;
    const p = rot90(d);
    const mouth = def.name.startsWith('milieu') ? cornerMouth + P.middleExtra : cornerMouth;
    const half = mouth / 2;

    // --- Position de l'ouverture sur l'axe : on la déduit de la contrainte
    // "l'arc est tangent à la ligne des nez" (centre à rk derrière la ligne).
    // M = ref + μ·d ; centre de l'arc C = M + σ·half·p - rk·n_w ; (C - P0)·n_r = -rk
    const nW = (sigma) => add(scale(p, -sigma * Math.cos(f)), scale(d, Math.sin(f)));
    const railOf = (sigma) => rails[sigma > 0 ? def.rail.plus : def.rail.minus];
    const solveMu = (sigma) => {
      const r = railOf(sigma);
      const q = add(add(def.ref, scale(p, sigma * half)), scale(nW(sigma), -rk));
      const num = -rk - dot2({ x: q.x - r.P0.x, y: q.y - r.P0.y }, r.n);
      return num / dot2(d, r.n);
    };
    const mu = solveMu(+1);
    if (Math.abs(mu - solveMu(-1)) > 1e-9) throw new Error(`Poche asymétrique : ${def.name}`);
    const M = add(def.ref, scale(d, mu)); // milieu de l'ouverture

    // Longueur de paroi : jusqu'à dépasser la ligne de capture
    const wallLen = (P.captureDepth - mu + WALL_MARGIN) / Math.cos(f);
    const narrow = [];

    for (const sigma of [+1, -1]) {
      const rail = railOf(sigma);
      const nw = nW(sigma);
      const w = add(scale(d, Math.cos(f)), scale(p, sigma * Math.sin(f))); // direction de la paroi
      const Wp = add(M, scale(p, sigma * half));                           // fin de l'arc
      const C = add(Wp, scale(nw, -rk));                                   // centre de l'arc
      const T = add(C, scale(rail.n, rk));                                 // où la bande quitte la ligne droite
      narrow.push(Wp);
      rail.pts.push({ t: dot2({ x: T.x - rail.P0.x, y: T.y - rail.P0.y }, rail.dir), pt: T });

      // Arc : de la normale de la bande (n_r) à la normale de la paroi (n_w)
      const a0 = Math.atan2(rail.n.y, rail.n.x);
      const diff = wrapAngle(Math.atan2(nw.y, nw.x) - a0);
      const N = Math.max(1, Math.ceil(Math.abs(diff) / ARC_STEP));
      const pts = [];
      for (let k = 0; k <= N; k++) {
        const ang = a0 + (diff * k) / N;
        pts.push(add(C, { x: rk * Math.cos(ang), y: rk * Math.sin(ang) }));
      }
      for (let k = 0; k < N; k++) {
        const angMid = a0 + (diff * (k + 0.5)) / N;
        jaws.push(mkSeg(pts[k], pts[k + 1], { x: Math.cos(angMid), y: Math.sin(angMid) }));
      }
      // Paroi
      jaws.push(mkSeg(Wp, add(Wp, scale(w, wallLen)), unit(nw)));
    }

    pockets.push({
      name: def.name,
      ref: def.ref,
      d,
      p,
      mouth,
      depth: P.captureDepth,        // la bille tombe quand son centre dépasse ref de depth le long de d
      halfWidth: half + 2 * rk,     // garde-fou latéral de la capture
      center: M,
      narrow,                       // les deux points les plus rapprochés des mâchoires
    });
  }

  // Bandes droites : les points de tangence triés le long de chaque bande,
  // pris deux par deux (l'espace entre deux points = une poche)
  const cushions = [];
  for (const rail of Object.values(rails)) {
    const sorted = rail.pts.sort((u, v) => u.t - v.t);
    for (let i = 0; i < sorted.length; i += 2) {
      cushions.push(mkSeg(sorted[i].pt, sorted[i + 1].pt, rail.n));
    }
  }

  return { cushions: [...cushions, ...jaws], pockets };
}
