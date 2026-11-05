// =====================================================================
// BILLES ENTRE ELLES : instant du contact et choc
// Les centres sont à z = R1 et z = R2 : la blanche étant plus petite,
// la ligne des centres (donc la normale du choc) est inclinée d'environ
// 1,9°. On garde ce calcul en 3D : il servira tel quel pour le saut.
// =====================================================================
import { PHYS } from './constants.js';
import { dot } from './vec.js';

// Premier instant t ∈ [0, tMax] où les deux billes se touchent :
//   Δp = p2 - p1, Δv = v2 - v1, D = R1 + R2
//   |Δp + Δv·t|² = D²  ->  (Δv·Δv)t² + 2(Δp·Δv)t + (Δp·Δp - D²) = 0
// Seulement si elles se rapprochent (Δp·Δv < 0). Si elles sont déjà au
// contact (ou un poil dedans) et se rapprochent : choc immédiat, t = 0.
// Renvoie t, ou null.
export function findBallBallContact(b1, b2, tMax) {
  const dp = { x: b2.pos.x - b1.pos.x, y: b2.pos.y - b1.pos.y, z: b2.pos.z - b1.pos.z };
  const dv = { x: b2.vel.x - b1.vel.x, y: b2.vel.y - b1.vel.y, z: b2.vel.z - b1.vel.z };
  const b = dot(dp, dv);
  if (b >= 0) return null; // immobiles l'une par rapport à l'autre, ou elles s'éloignent

  const D = b1.radius + b2.radius;
  const c = dot(dp, dp) - D * D;
  if (c <= 0) return 0; // déjà au contact

  const a = dot(dv, dv);
  const disc = b * b - a * c;
  if (disc < 0) return null; // elles se croisent sans se toucher
  const t = (-b - Math.sqrt(disc)) / a;
  return t <= tMax ? t : null;
}

// Choc sans frottement : impulsion portée par la ligne des centres.
//   n = (p2 - p1)/|p2 - p1|,  vn = (v1 - v2)·n  (> 0 si elles se rapprochent)
//   J = (1 + e)·vn / (1/m1 + 1/m2)
//   v1' = v1 - (J/m1)·n,  v2' = v2 + (J/m2)·n
// La normale passe par les deux centres : aucun couple, ω inchangés.
// C'est le tapis qui crée ensuite le coulé ou le rétro.
// La fonction reçoit les billes entières (ω compris) : le frottement
// bille/bille (étape 3b) s'ajoutera ici sans changer la signature.
export function resolveBallBall(b1, b2) {
  const dp = { x: b2.pos.x - b1.pos.x, y: b2.pos.y - b1.pos.y, z: b2.pos.z - b1.pos.z };
  const len = Math.hypot(dp.x, dp.y, dp.z);
  const n = { x: dp.x / len, y: dp.y / len, z: dp.z / len };
  const vn =
    (b1.vel.x - b2.vel.x) * n.x + (b1.vel.y - b2.vel.y) * n.y + (b1.vel.z - b2.vel.z) * n.z;
  if (vn <= 0) return [b1, b2];

  const J = ((1 + PHYS.ballRestitution) * vn) / (1 / b1.mass + 1 / b2.mass);
  const k1 = J / b1.mass, k2 = J / b2.mass;
  return [
    { ...b1, vel: { x: b1.vel.x - k1 * n.x, y: b1.vel.y - k1 * n.y, z: b1.vel.z - k1 * n.z } },
    { ...b2, vel: { x: b2.vel.x + k2 * n.x, y: b2.vel.y + k2 * n.y, z: b2.vel.z + k2 * n.z } },
  ];
}
