// Validation du choc bille/bille sur les scénarios 1 et 2 (plein à 1 m/s)
//   node tests/ballball.js
// Valeurs attendues (e_b = 0,95, blanche 105 g, couleur 118 g), à ~2 % près
// (la blanche glisse sur 1 cm avant le choc) :
//   juste après le choc : blanche ≈ -0,03 m/s, couleur ≈ 0,92 m/s (scénarios 1 et 2)
//   au roulement : sc. 1 blanche ≈ 0, couleur ≈ 0,66 ; sc. 2 blanche ≈ +0,26, couleur ≈ 0,66
import { TABLE_SPECS, createTable, createState } from '../src/state.js';
import { createScenario } from '../src/scenarios.js';
import { step, PHYS } from '../src/physics/index.js';

const DT = 1 / 240;
const table = createTable(TABLE_SPECS.english7ft);
const slip = (b) => Math.hypot(b.vel.x - b.radius * b.omega.y, b.vel.y + b.radius * b.omega.x);
const rolling = (b) => slip(b) <= PHYS.slipEpsilon;
const f = (x) => x.toFixed(3).padStart(7);

for (const id of [1, 2, 3, 4]) {
  let s = createState(table, createScenario(table, id));
  let after = null;
  for (let i = 0; i < 3 * 240; i++) {
    s = step(s, DT);
    const [cue, col] = s.balls;
    if (!after && Math.hypot(col.vel.x, col.vel.y) > 0) after = { cue, col };
    if (after && rolling(cue) && rolling(col)) break;
  }
  const [cue, col] = s.balls;
  const deg = (b) => (Math.atan2(b.vel.y, b.vel.x) * 180) / Math.PI;
  console.log(`Scénario ${id}`);
  console.log(`  juste après : blanche vx = ${f(after.cue.vel.x)}  couleur vx = ${f(after.col.vel.x)} m/s`);
  console.log(`  au roulement : blanche v = ${f(Math.hypot(cue.vel.x, cue.vel.y))} (${f(deg(cue))}°)` +
              `  couleur v = ${f(Math.hypot(col.vel.x, col.vel.y))} (${f(deg(col))}°)  t = ${s.time.toFixed(2)} s`);
  if (id >= 3) console.log(`  angle entre les deux directions finales : ${f(Math.abs(deg(cue) - deg(col)))}°`);
}
