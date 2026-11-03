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
      const hit = findContact(px, py, vel, b.radius, c, remaining);
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

// Choc bille/bande : restitution normale + frottement de Coulomb.
// Contact supposé à hauteur du centre : r = −R·n (horizontal).
// Le choc ne touche donc qu'à vx, vy et ω_z. ωx et ωy sont conservés :
// la bille repart en GLISSEMENT et applyFriction gère la suite.
//   Jn = −(1+e)·m·vn
//   uₜ = (v + ω × r)·t
//   Jₜ = −signe(uₜ)·min(μ_c·Jn, 2/7·m·|uₜ|)   (2/7 = annule tout le glissement)
//   Δv = J/m,  Δω = (r × J)/I,  I = 2/5·m·R²
function cushionImpulse(b, v, w, n, c) {
  const m = b.mass, R = b.radius, I = 0.4 * m * R * R;
  const tx = -n.y, ty = n.x;                      // tangente

  const vn = v.x * n.x + v.y * n.y;
  const Jn = -(1 + c.restitution) * m * vn;

  // ω × r avec r = (−R·nx, −R·ny, 0), composantes horizontales
  const cvx = v.x + R * w.z * n.y;
  const cvy = v.y - R * w.z * n.x;
  const ut = cvx * tx + cvy * ty;
  const Jt = -Math.sign(ut) * Math.min(c.friction * Jn, (2 / 7) * m * Math.abs(ut));

  const Jx = Jn * n.x + Jt * tx;
  const Jy = Jn * n.y + Jt * ty;

  return {
    vel: { x: v.x + Jx / m, y: v.y + Jy / m, z: 0 },
    omega: { x: w.x, y: w.y, z: w.z + (R * (n.y * Jx - n.x * Jy)) / I },
  };
}
