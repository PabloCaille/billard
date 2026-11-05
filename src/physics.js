// =====================================================================
// PHYSIQUE
// Fonction pure : step(état, dt) renvoie un NOUVEL état, sans toucher
// à l'ancien. Ne connaît ni le canvas, ni les pixels.
// =====================================================================

export const PHYS = {
  g: 9.81,           // m/s²
  muSlide: 0.2,      // frottement de glissement bille/tapis
  muRoll: 0.01,      // résistance au roulement (empirique)
  airDensity: 1.2,   // kg/m³
  dragCoef: 0.47,    // Cx d'une sphère
  slipEpsilon: 1e-4, // m/s : en dessous, on considère que la bille roule
  maxContactsPerStep: 8, // garde-fou : nombre max de chocs traités dans un même pas
};

export function step(state, dt) {
  const cushions = state.table.cushions;
  return {
    ...state,
    time: state.time + dt,
    balls: state.balls.map((b) => moveBall(applyFriction(b, dt), dt, cushions)),
  };
}

// ---------------------------------------------------------------------
// 1. FROTTEMENTS : met à jour vitesse et rotation (pas la position)
// ---------------------------------------------------------------------
function applyFriction(b, dt) {
  const { g, muSlide, muRoll, airDensity, dragCoef, slipEpsilon } = PHYS;
  const R = b.radius;
  const m = b.mass;

  let vx = b.vel.x, vy = b.vel.y;
  let wx = b.omega.x, wy = b.omega.y;
  const wz = b.omega.z; // effet latéral : pas traité avant l'étape 6

  // Vitesse de glissement au point de contact : u = v + ω × r, r = (0, 0, -R)
  const ux = vx - R * wy;
  const uy = vy + R * wx;
  const slip = Math.hypot(ux, uy);

  const speed = Math.hypot(vx, vy);

  // Traînée de l'air (appliquée au centre, donc sans couple)
  const area = Math.PI * R * R;
  const dragAcc = (0.5 * airDensity * dragCoef * area * speed * speed) / m;

  if (slip > slipEpsilon) {
    // ---------- PHASE DE GLISSEMENT ----------
    // Le glissement u décroît à 7/2·μg. S'il s'annule pendant ce pas,
    // on bascule directement en roulement en conservant le moment
    // cinétique au point de contact (le frottement n'y crée pas de couple).
    if (slip <= 3.5 * muSlide * g * dt) {
      vx = (5 * vx + 2 * R * wy) / 7;
      vy = (5 * vy - 2 * R * wx) / 7;
      wy = vx / R;
      wx = -vy / R;
    } else {
      // Frottement de Coulomb opposé au glissement
      const ax = (-muSlide * g * ux) / slip;
      const ay = (-muSlide * g * uy) / slip;
      // Couple du frottement : I·dω/dt = r × F, avec I = 2/5·m·R²
      wx += ((5 / 2) * ay / R) * dt;
      wy += ((-5 / 2) * ax / R) * dt;
      vx += ax * dt;
      vy += ay * dt;
      // Traînée : freine la translation seule
      if (speed > 0) {
        vx -= (dragAcc * b.vel.x / speed) * dt;
        vy -= (dragAcc * b.vel.y / speed) * dt;
      }
    }
  } else if (speed > 0) {
    // ---------- PHASE DE ROULEMENT ----------
    // Résistance au roulement + traînée. La traînée est pondérée par 5/7 :
    // en roulant, la bille doit aussi freiner sa rotation (masse effective 7/5·m).
    const decel = muRoll * g + (5 / 7) * dragAcc;
    if (speed <= decel * dt) {
      vx = 0; vy = 0; // arrêt : on évite que la bille reparte en arrière
    } else {
      const k = (speed - decel * dt) / speed;
      vx *= k;
      vy *= k;
    }
    // Contrainte de roulement sans glissement : v = R·ω
    wy = vx / R;
    wx = -vy / R;
  }

  return {
    ...b,
    vel: { x: vx, y: vy, z: 0 },
    omega: { x: wx, y: wy, z: wz },
  };
}

// ---------------------------------------------------------------------
// 2. DÉPLACEMENT AVEC CHOCS SUR LES BANDES
// Euler semi-implicite : on avance avec la NOUVELLE vitesse.
// Sur un pas, la trajectoire est supposée rectiligne à vitesse constante
// (la décélération sur 4 ms est négligeable pour trouver l'instant du choc).
// Boucle : on cherche le PREMIER contact dans le temps restant, on avance
// jusqu'à lui, on applique le choc, puis on recommence avec le temps
// qui reste. C'est ce qui gère deux bandes dans le même pas (coin).
// ---------------------------------------------------------------------
function moveBall(b, dt, cushions) {
  let px = b.pos.x, py = b.pos.y;
  let vel = b.vel, omega = b.omega;
  let remaining = dt;

  for (let i = 0; i < PHYS.maxContactsPerStep; i++) {
    let best = null;
    for (const c of cushions) {
      const hit = findContact(px, py, vel, contactRadius(b.radius, c), c, remaining);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    if (!best) break;

    px += vel.x * best.t;
    py += vel.y * best.t;
    remaining -= best.t;
    ({ vel, omega } = cushionImpulse(b, vel, omega, best.n, best.cushion));
  }

  return {
    ...b,
    pos: { x: px + vel.x * remaining, y: py + vel.y * remaining, z: b.pos.z },
    vel,
    omega,
  };
}

// Géométrie du contact avec le nez de bande, situé à la hauteur h du tapis.
// d = h − R : décalage du point de contact au-dessus du centre de la bille.
// sinθ = d/R. La bille touche le nez quand la distance HORIZONTALE entre son
// centre et la ligne du nez vaut R·cosθ (un peu moins que R : la bille passe
// légèrement sous le nez). La blanche, plus petite, a un θ plus grand.
function contactAngle(R, c) {
  const s = Math.max(-0.9, Math.min(0.9, (c.noseHeight - R) / R));
  return { sin: s, cos: Math.sqrt(1 - s * s) };
}
function contactRadius(R, c) {
  return R * contactAngle(R, c).cos;
}

// Premier instant t ∈ [0, tMax] où la bille (centre p, vitesse v, rayon R)
// touche le segment c. Deux cas :
//   - contact sur la partie droite du segment (distance au plan = R)
//   - contact sur une extrémité (distance au point = R), utile plus tard
//     pour les mâchoires de poche
// Renvoie { t, n, cushion } avec n la normale du choc (vers la bille), ou null.
function findContact(px, py, v, R, c, tMax) {
  const EPS = 1e-12;
  let best = null;

  // --- Partie droite ---
  const vn = v.x * c.n.x + v.y * c.n.y;          // < 0 : la bille va vers la bande
  if (vn < 0) {
    const d0 = (px - c.a.x) * c.n.x + (py - c.a.y) * c.n.y; // distance au plan
    if (d0 > -R) {                                // la bille est devant la bande
      const t = Math.max(0, (R - d0) / vn);       // d0 + vn·t = R
      if (t <= tMax) {
        // Le point de contact est-il bien sur le segment ?
        const ex = c.b.x - c.a.x, ey = c.b.y - c.a.y;
        const len2 = ex * ex + ey * ey;
        const s = ((px + v.x * t - c.a.x) * ex + (py + v.y * t - c.a.y) * ey) / len2;
        if (s >= 0 && s <= 1) best = { t, n: c.n, cushion: c };
      }
    }
  }

  // --- Extrémités ---
  for (const q of [c.a, c.b]) {
    const dx = px - q.x, dy = py - q.y;
    const a = v.x * v.x + v.y * v.y;
    const bq = dx * v.x + dy * v.y;                // < 0 : on se rapproche du point
    if (a < EPS || bq >= 0) continue;
    const cq = dx * dx + dy * dy - R * R;
    const disc = bq * bq - a * cq;
    if (disc < 0) continue;
    const t = Math.max(0, (-bq - Math.sqrt(disc)) / a); // |p + v·t − q| = R
    if (t > tMax || (best && t >= best.t)) continue;
    const cx = px + v.x * t - q.x, cy = py + v.y * t - q.y;
    const len = Math.hypot(cx, cy);
    best = { t, n: { x: cx / len, y: cy / len }, cushion: c };
  }

  return best;
}

// Choc bille/bande à la vraie hauteur du nez (choc instantané, type Han 2005).
// Point de contact vu du centre :  r = R·(−cosθ·n + sinθ·z)
// Normale de contact (vers la bille) : N = −r/R = cosθ·n − sinθ·z
//   (la bande repousse la bille ET l'appuie sur le tapis)
// Vitesse du point de contact : u = v + ω × r
//   Jn = −(1+e)·m·(u·N)                    (N passe par le centre : masse m)
//   uₜ = u − (u·N)·N                        (glissement dans le plan tangent)
//   Jₜ = −min(μ_c·Jn, 2/7·m·|uₜ|)·ûₜ         (2/7 : annule tout le glissement)
//   Δv = J/m,  Δω = (r × J)/I,  I = 2/5·m·R²
// Hypothèses : pendant le choc, on ignore le frottement du tapis, et la
// composante verticale de Δv est absorbée par le tapis (vz remis à 0).
// Si un jour la bande était plus basse que le centre (sinθ < 0), Δv_z serait
// positif : c'est l'amorce du saut, traité à l'étape 6.
function cushionImpulse(b, v, w, n, c) {
  const m = b.mass, R = b.radius, I = 0.4 * m * R * R;
  const { sin, cos } = contactAngle(R, c);

  const r = { x: -R * cos * n.x, y: -R * cos * n.y, z: R * sin };
  const N = { x: cos * n.x, y: cos * n.y, z: -sin };

  const wr = cross(w, r);
  const u = { x: v.x + wr.x, y: v.y + wr.y, z: v.z + wr.z };
  const uN = dot(u, N);
  if (uN >= 0) return { vel: v, omega: w }; // la bille s'éloigne déjà

  const Jn = -(1 + c.restitution) * m * uN;

  const ut = { x: u.x - uN * N.x, y: u.y - uN * N.y, z: u.z - uN * N.z };
  const utNorm = Math.hypot(ut.x, ut.y, ut.z);
  const Jt = utNorm > 1e-12 ? Math.min(c.friction * Jn, (2 / 7) * m * utNorm) / utNorm : 0;

  const J = {
    x: Jn * N.x - Jt * ut.x,
    y: Jn * N.y - Jt * ut.y,
    z: Jn * N.z - Jt * ut.z,
  };
  const rJ = cross(r, J);

  return {
    vel: { x: v.x + J.x / m, y: v.y + J.y / m, z: 0 },
    omega: { x: w.x + rJ.x / I, y: w.y + rJ.y / I, z: w.z + rJ.z / I },
  };
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
