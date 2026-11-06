// Vérification des poches (étape 5a)
//   node tests/pockets.js
// 1. Géométrie : 6 poches, ouverture = 1,6 x diamètre, chaînes de segments continues
// 2. Tir droit dans l'axe de chaque poche : la bille tombe, dans la bonne poche
// 3. Fenêtre de tolérance : de combien peut-on décaler un tir parallèle à l'axe
// 4. Bille trop lente : elle s'arrête avant la ligne de capture
// 5. 300 tirs aléatoires : jamais de pénétration des mâchoires, jamais de bille hors table
// 6. Règle provisoire : la blanche tombée revient au milieu du baulk
import { TABLE_SPECS, createTable, createState, createBall, applyShot, isAtRest } from '../src/state.js';
import { createRandomScene, cushionClearance } from '../src/scenarios.js';
import { step } from '../src/physics/index.js';
import { applyRules } from '../src/rules.js';

const DT = 1 / 240;
const TOL = 1e-9;
const table = createTable(TABLE_SPECS.english7ft);
const spec = TABLE_SPECS.english7ft;
let failures = 0;
const fail = (msg) => { failures++; console.log('  ÉCHEC : ' + msg); };
const expect = (cond, msg) => { if (!cond) fail(msg); };

const withBall = (b) => createState(table, [b]);
function run(state, seconds, onStep) {
  let s = state;
  for (let i = 0; i < seconds * 240; i++) {
    s = step(s, DT);
    if (onStep) onStep(s);
    if (isAtRest(s)) break;
  }
  return s;
}

// ---------------------------------------------------------------- 1
console.log('1. Géométrie');
{
  const mouth = spec.pocket.mouthRatio * spec.pocket.refBallDiameter;
  expect(table.pockets.length === 6, 'il faut 6 poches');
  for (const pk of table.pockets) {
    const [a, b] = pk.narrow;
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    expect(Math.abs(gap - mouth) < 1e-9, `${pk.name} : ouverture ${gap} au lieu de ${mouth}`);
  }
  // Extrémités de segments : chaque raccord (bande/arc, arc/arc, arc/paroi) doit
  // être partagé par deux segments. Il reste 12 bouts libres : le fond des parois.
  const pts = table.cushions.flatMap((c) => [c.a, c.b]);
  let free = 0;
  for (const p of pts) {
    const n = pts.filter((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9).length;
    if (n === 1) free++;
  }
  console.log(`  ${table.cushions.length} segments, ${free} bouts libres (attendu 12)`);
  expect(free === 12, 'chaîne de segments discontinue');
  // Normales unitaires, dirigées vers la table ou la poche (centre de l'ouverture côté libre)
  for (const c of table.cushions) {
    expect(Math.abs(Math.hypot(c.n.x, c.n.y) - 1) < 1e-9, 'normale non unitaire');
  }
}

// ---------------------------------------------------------------- 2
console.log('2. Tir droit dans l\'axe de chaque poche (1 m/s, de 0,5 m)');
table.pockets.forEach((pk, k) => {
  const x = pk.ref.x - pk.d.x * 0.5, y = pk.ref.y - pk.d.y * 0.5;
  const b = createBall('blanche', 'cue', x, y);
  const angle = Math.atan2(pk.d.y, pk.d.x);
  const s = run(applyShot(withBall(b), { ballId: 'blanche', speed: 1, angle }), 5);
  const c = s.balls[0];
  console.log(`  ${pk.name.padEnd(17)} tombée : ${c.pocketed}, poche ${c.pocket}, t = ${c.pocketedAt?.toFixed(3)} s`);
  expect(c.pocketed && c.pocket === k, `${pk.name} : bille non tombée dans la bonne poche`);
});

// ---------------------------------------------------------------- 3
console.log('3. Fenêtre de tolérance (tir parallèle à l\'axe, de 0,6 m, couleur 2 m/s)');
table.pockets.forEach((pk, k) => {
  const ok = [];
  for (let off = -0.06; off <= 0.0601; off += 0.0025) {
    const x = pk.ref.x - pk.d.x * 0.6 + pk.p.x * off;
    const y = pk.ref.y - pk.d.y * 0.6 + pk.p.y * off;
    const b = createBall('c', 'red', x, y);
    const s = run(applyShot(withBall(b), { ballId: 'c', speed: 2, angle: Math.atan2(pk.d.y, pk.d.x) }), 6);
    if (s.balls[0].pocketed && s.balls[0].pocket === k) ok.push(off);
  }
  const lo = Math.min(...ok), hi = Math.max(...ok);
  console.log(`  ${pk.name.padEnd(17)} tombe de ${(lo * 1000).toFixed(1)} à ${(hi * 1000).toFixed(1)} mm (${ok.length} tirs sur 49)`);
  expect(ok.includes(0) || ok.some((o) => Math.abs(o) < 1e-9), `${pk.name} : le tir dans l'axe doit tomber`);
  expect(Math.max(Math.abs(lo), Math.abs(hi)) < pk.mouth / 2 + 0.03, `${pk.name} : fenêtre trop large`);
});

// ---------------------------------------------------------------- 4
console.log('4. Bille lente vers le milieu bas');
{
  const pk = table.pockets[1];
  for (const [v, shouldFall] of [[0.2, false], [0.4, true]]) {
    const b = createBall('c', 'red', pk.ref.x, 0.30);
    const s = run(applyShot(withBall(b), { ballId: 'c', speed: v, angle: -Math.PI / 2 }), 30);
    const c = s.balls[0];
    console.log(`  v = ${v} m/s : tombée ${c.pocketed}, arrêtée en y = ${c.pos.y.toFixed(3)}`);
    expect(c.pocketed === shouldFall, `v = ${v} : résultat inattendu`);
  }
}

// ---------------------------------------------------------------- 5
console.log('5. 300 tirs aléatoires (une bille, puis scènes complètes)');
{
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let pocketed = 0, shots = 0, kicked = 0;
  for (let n = 0; n < 300; n++) {
    const full = n % 3 === 0;
    let state;
    if (full) {
      state = createState(table, createRandomScene(table, 1000 + n));
    } else {
      state = withBall(createBall('blanche', 'cue', 0.15 + rnd() * 1.5, 0.15 + rnd() * 0.6));
    }
    const cue = state.balls[0];
    // Une moitié des tirs vise une poche (avec bruit), l'autre est libre
    let angle = rnd() * 2 * Math.PI;
    if (n % 2 === 0) {
      const pk = table.pockets[Math.floor(rnd() * 6)];
      angle = Math.atan2(pk.ref.y - cue.pos.y, pk.ref.x - cue.pos.x) + (rnd() - 0.5) * 0.15;
    }
    const speed = 0.5 + rnd() * 7.5;
    let worst = Infinity;
    const s = run(applyShot(state, { ballId: 'blanche', speed, angle }), 15, (st) => {
      for (const b of st.balls) {
        if (b.pocketed) continue;
        const g = cushionClearance(table, b);
        worst = Math.min(worst, g);
        if (g < -TOL) fail(`tir ${n} : ${b.id} pénètre une bande ou une mâchoire (${g.toExponential(2)} m)`);
        if (b.pos.x < -0.03 || b.pos.x > table.length + 0.03 || b.pos.y < -0.03 || b.pos.y > table.width + 0.03) {
          fail(`tir ${n} : ${b.id} hors de la table sans être tombée à (${b.pos.x.toFixed(3)}, ${b.pos.y.toFixed(3)})`);
        }
      }
      if (st.diag.overflow) fail(`tir ${n} : plafond d'événements atteint`);
    });
    shots++;
    const down = s.balls.filter((b) => b.pocketed).length;
    pocketed += down;
    if (s.balls[0].pocketed) kicked++;
    if (!isAtRest(s)) fail(`tir ${n} : billes encore en mouvement après 15 s`);
    if (failures > 8) break;
  }
  console.log(`  ${shots} tirs, ${pocketed} billes tombées dont ${kicked} blanches`);
}

// ---------------------------------------------------------------- 6
console.log('6. Règle provisoire : blanche tombée -> milieu du baulk');
{
  const pk = table.pockets[0];
  const b = createBall('blanche', 'cue', pk.ref.x + 0.4, pk.ref.y + 0.4);
  // Une couleur posée exactement sur le point de remise force le décalage
  const blocker = createBall('rouge1', 'red', table.length / 5, table.width / 2);
  let s = createState(table, [b, blocker]);
  s = applyShot(s, { ballId: 'blanche', speed: 1, angle: Math.atan2(pk.d.y, pk.d.x) });
  let respot = null;
  for (let i = 0; i < 6 * 240 && !respot; i++) {
    s = applyRules(step(s, DT));
    const c = s.balls.find((x) => x.id === 'blanche');
    if (!c.pocketed && c.pocket === null && c.pos.x === table.length / 5) respot = c;
  }
  expect(respot !== null, 'la blanche n\'a pas été remise en jeu');
  if (respot) {
    const gap = Math.hypot(respot.pos.x - blocker.pos.x, respot.pos.y - blocker.pos.y) - respot.radius - blocker.radius;
    console.log(`  remise en (${respot.pos.x.toFixed(3)}, ${respot.pos.y.toFixed(3)}), jeu avec la rouge : ${(gap * 1000).toFixed(1)} mm`);
    expect(gap >= 0, 'la blanche remise chevauche une bille');
  }
}

console.log(failures ? `${failures} échec(s)` : 'OK');
process.exitCode = failures ? 1 : 0;
