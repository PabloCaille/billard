// Simulation de référence : à relancer après chaque modification de la physique.
//   node tests/reference.js
// Une couleur part du centre de la table en roulement pur à 1 m/s vers la
// bande du haut (perpendiculairement), on simule 3 s. Les valeurs attendues
// ont été obtenues avec le code de l'étape 2 (commit af98f00).
import { createInitialState, createBall } from '../src/state.js';
import { step } from '../src/physics/index.js';

const DT = 1 / 240;
let s = createInitialState();
const b = createBall('c', 'red', 0.6, s.table.width / 2);
b.vel = { x: 0, y: 1, z: 0 };
b.omega = { x: -1 / b.radius, y: 0, z: 0 }; // roulement pur : v = R·ω
s = { ...s, balls: [b] };
for (let i = 0; i < 3 * 240; i++) s = step(s, DT);

const c = s.balls[0];
const got = { x: c.pos.x.toFixed(4), y: c.pos.y.toFixed(4), vy: c.vel.y.toFixed(4) };
const expected = { x: '0.6000', y: '0.1648', vy: '0.1331' };
const ok = Object.keys(expected).every((k) => got[k] === expected[k]);
console.log('obtenu  ', got);
console.log('attendu ', expected);
console.log(ok ? 'OK : comportement identique' : 'ÉCART : la physique a changé');
process.exitCode = ok ? 0 : 1;
