// Vérification de la scène 0 (tirage à graine) et de la boucle d'événements
//   node tests/scene.js
// 1. Pour plusieurs graines : aucun chevauchement, billes "collées" bien à
//    contact + 1 µm, même graine = même scène.
// 2. Tirs violents sur ces scènes : à aucun pas deux billes ne se
//    chevauchent ni ne traversent une bande, le plafond n'est jamais atteint.
import { TABLE_SPECS, createTable, createState, applyShot } from '../src/state.js';
import { createRandomScene, cushionClearance } from '../src/scenarios.js';
import { contactRadius } from '../src/physics/cushion.js';
import { step } from '../src/physics/index.js';

const DT = 1 / 240;
const TOL = 1e-9;
const table = createTable(TABLE_SPECS.english7ft);
const dist3 = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
let failures = 0;
const fail = (msg) => { failures++; console.log('  ÉCHEC : ' + msg); };

// Une bille non tombée doit rester à distance des bandes ET des mâchoires
// (distance aux segments, plus au rectangle : elle peut entrer dans une poche)
// et ne jamais finir hors du tapis sans être tombée.
function check(balls, label) {
  let worst = Infinity;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.pocketed) continue;
    const gapC = cushionClearance(table, b);
    if (gapC < -TOL) fail(`${label} : ${b.id} dans la bande (${gapC.toExponential(2)} m)`);
    const far = 0.03; // marge : une bille dans l'entonnoir dépasse un peu du rectangle
    if (b.pos.x < -far || b.pos.x > table.length + far || b.pos.y < -far || b.pos.y > table.width + far) {
      fail(`${label} : ${b.id} hors de la table sans être tombée (${b.pos.x.toFixed(3)}, ${b.pos.y.toFixed(3)})`);
    }
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[j].pocketed) continue;
      const gap = dist3(b, balls[j]) - b.radius - balls[j].radius;
      worst = Math.min(worst, gap);
      if (gap < -TOL) fail(`${label} : ${b.id} et ${balls[j].id} se chevauchent (${gap.toExponential(2)} m)`);
    }
  }
  return worst;
}

for (const seed of [1, 2026, 123456, 777, 42]) {
  const balls = createRandomScene(table, seed);
  console.log(`Graine ${seed} : ${balls.length} billes`);
  if (balls.length !== 16) fail('il faut 16 billes');
  if (JSON.stringify(balls) !== JSON.stringify(createRandomScene(table, seed))) fail('tirage non reproductible');
  check(balls, 'placement');

  let atCushion = 0, pairs = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const m = contactRadius(b.radius, table.cushions[0]);
    const g = Math.min(b.pos.x - m, table.length - m - b.pos.x, b.pos.y - m, table.width - m - b.pos.y);
    if (Math.abs(g - 1e-6) < 1e-9) atCushion++;
    for (let j = i + 1; j < balls.length; j++) {
      const gap = dist3(b, balls[j]) - b.radius - balls[j].radius;
      if (Math.abs(gap - 1e-6) < 1e-9) pairs++;
    }
  }
  console.log(`  collées à une bande : ${atCushion}, paires collées : ${pairs}`);
  if (atCushion < 3 || pairs < 2) fail('cas limites manquants');

  // Tirs : vers chaque bille collée + quelques tirs à 12 m/s
  let maxEvents = 0, overflow = false, pocketedTotal = 0;
  const cue = balls[0];
  const shots = balls.slice(1, 8).map((t) => ({ speed: 3, angle: Math.atan2(t.pos.y - cue.pos.y, t.pos.x - cue.pos.x) }));
  shots.push({ speed: 12, angle: 0.1 }, { speed: 12, angle: 2.0 }, { speed: 12, angle: 4.4 });
  for (const sh of shots) {
    let s = applyShot(createState(table, balls), { ballId: 'blanche', ...sh });
    for (let i = 0; i < 15 * 240; i++) {
      s = step(s, DT);
      maxEvents = Math.max(maxEvents, s.diag.events);
      overflow ||= s.diag.overflow;
      if (failures > 5) break;
      check(s.balls, `tir v=${sh.speed} a=${sh.angle.toFixed(2)} t=${s.time.toFixed(3)}`);
    }
    const moving = s.balls.filter((b) => b.vel.x || b.vel.y).length;
    if (moving) fail(`${moving} billes encore en mouvement après 15 s`);
    pocketedTotal += s.balls.filter((b) => b.pocketed).length;
  }
  console.log(`  ${shots.length} tirs, max ${maxEvents} chocs dans un même pas, ${pocketedTotal} billes tombées${overflow ? ', PLAFOND ATTEINT' : ''}`);
  if (overflow) fail('plafond atteint');
}
console.log(failures ? `${failures} échec(s)` : 'OK');
process.exitCode = failures ? 1 : 0;
