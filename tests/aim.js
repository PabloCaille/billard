// Vérification de la visée
//   node tests/aim.js
// 1. Lance-pierre inversé : près de la blanche = fort, loin = doux, bornes respectées.
// 2. L'aide (bille fantôme + direction de la couleur) correspond à ce que fait
//    vraiment la physique au premier choc.
import { TABLE_SPECS, createTable, createState, applyShot } from '../src/state.js';
import { createRandomScene } from '../src/scenarios.js';
import { step } from '../src/physics/index.js';
import { createSlingshot, V_MAX, V_MIN, PULL_MIN, PULL_MAX } from '../src/aim/slingshot.js';
import { computeGuide } from '../src/aim/aids.js';
import { contactRadius } from '../src/physics/cushion.js';

let failures = 0;
const fail = (m) => { failures++; console.log('  ÉCHEC : ' + m); };
const table = createTable(TABLE_SPECS.english7ft);

// --- 1. Courbe de puissance ---
const cue = createRandomScene(table, 2026)[0];
const s = createSlingshot();
console.log('Distance au bord de la blanche -> vitesse');
let prev = Infinity;
for (const gap of [0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7]) {
  s.press({ x: cue.pos.x - cue.radius - gap, y: cue.pos.y });
  const shot = s.currentShot(cue);
  console.log(`  ${(gap * 100).toFixed(0).padStart(3)} cm : ${shot.speed.toFixed(2)} m/s, angle ${shot.angle.toFixed(3)} rad`);
  if (shot.speed > prev + 1e-12) fail('la vitesse doit décroître avec la distance');
  if (Math.abs(shot.angle) > 1e-12) fail('curseur à gauche : le tir doit partir vers +x');
  prev = shot.speed;
  s.cancel();
}
s.press({ x: cue.pos.x - cue.radius - PULL_MIN, y: cue.pos.y });
if (Math.abs(s.currentShot(cue).speed - V_MAX) > 1e-12) fail('V_MAX à PULL_MIN');
s.press({ x: cue.pos.x - cue.radius - PULL_MAX, y: cue.pos.y });
if (Math.abs(s.currentShot(cue).speed - V_MIN) > 1e-12) fail('V_MIN à PULL_MAX');
s.press({ x: cue.pos.x + 0.005, y: cue.pos.y });
if (s.release(cue) !== null) fail('relâcher sur la blanche doit annuler');

// --- 2. Aide contre physique ---
let checked = 0, chained = 0, worstAng = 0;
for (const seed of [2026, 1, 42]) {
  const balls = createRandomScene(table, seed);
  const base = createState(table, balls);
  for (let k = 0; k < 72; k++) {
    const angle = (k * 5 * Math.PI) / 180;
    const guide = computeGuide(base, 'blanche', angle);
    if (!guide || guide.hit.type !== 'ball') continue;
    let st = applyShot(base, { ballId: 'blanche', speed: 2, angle, tip: { x: 0, y: 0 }, elevation: 0 });
    // Billes qui se mettent en mouvement au premier pas où quelque chose est touché
    let started = [];
    for (let i = 0; i < 240 * 3 && !started.length; i++) {
      const before = st;
      st = step(st, 1 / 240);
      started = st.balls.filter((b, j) => b.id !== 'blanche' && (b.vel.x || b.vel.y) &&
        !(before.balls[j].vel.x || before.balls[j].vel.y));
    }
    if (!started.length) { fail(`seed ${seed} angle ${k * 5}° : aucun choc alors que l'aide en annonce un`); continue; }
    checked++;
    if (!started.some((b) => b.id === guide.hit.id)) {
      fail(`seed ${seed} angle ${k * 5}° : billes touchées ${started.map((b) => b.id)}, aide ${guide.hit.id}`);
      continue;
    }
    // Si la couleur était collée à une voisine, elle lui a déjà transmis le choc
    // dans le même pas : sa direction ne se compare plus à l'aide.
    if (started.length > 1) { chained++; continue; }
    const hitBall = started[0];
    // Idem si elle était collée à une bande : elle rebondit dans le même pas
    const o = base.balls.find((b) => b.id === hitBall.id);
    const m = contactRadius(o.radius, table.cushions[0]);
    if (Math.min(o.pos.x - m, table.length - m - o.pos.x, o.pos.y - m, table.width - m - o.pos.y) < 1e-3) { chained++; continue; }
    const a1 = Math.atan2(hitBall.vel.y, hitBall.vel.x), a2 = Math.atan2(guide.hit.dir.y, guide.hit.dir.x);
    let da = Math.abs(a1 - a2); if (da > Math.PI) da = 2 * Math.PI - da;
    if (da * 180 / Math.PI > 0.5) console.log(`  écart ${(da * 180 / Math.PI).toFixed(1)}° : graine ${seed}, angle ${k * 5}°, ${hitBall.id}`);
    worstAng = Math.max(worstAng, (da * 180) / Math.PI);
  }
}
console.log(`Aide contre physique : ${checked} coups (dont ${chained} sur une couleur collée à une bille ou une bande, non comparés), écart max sur la direction de la couleur ${worstAng.toFixed(3)}°`);
if (worstAng > 0.5) fail('direction de la couleur annoncée trop différente de la physique');
console.log(failures ? `${failures} échec(s)` : 'OK');
process.exitCode = failures ? 1 : 0;
