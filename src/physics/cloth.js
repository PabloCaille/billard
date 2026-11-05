// =====================================================================
// TAPIS : frottements. Met à jour vitesse et rotation (pas la position).
// =====================================================================
import { PHYS } from './constants.js';

export function applyFriction(b, dt) {
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
