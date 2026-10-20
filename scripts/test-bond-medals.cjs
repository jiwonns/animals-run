const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { readCollections, renderRules, readRewards } = require('./generate-gacha');
const collections = readCollections();
const characters = collections.flatMap(c => c.characters.map(ch => ({ ...ch, collection: c.id, grade: c.config.grade })));
const constants = {
  COLLECTIONS: collections.map(c => ({ id: c.id, name: c.config.name, grade: c.config.grade })),
  GRADE_ORDER: [...new Set(collections.map(c => c.config.grade))],
  GRADES: Object.fromEntries(['N','R','EP','U','L','E','H'].map(g => [g, { label: g }])),
  CHARACTER_BY_ID: Object.fromEntries(characters.map(c => [c.id, c])),
  CHARACTERS: characters,
  charactersIn: id => characters.filter(c => c.collection === id),
};
const kindsByGrade = owned => {
  const counts = Object.fromEntries(constants.GRADE_ORDER.map(g => [g, 0]));
  characters.forEach(c => { if ((owned[c.id] ?? 0) > 0) counts[c.grade]++; }); return counts;
};
function load(file, extra = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mocks = {
    '@/constants/characters': constants,
    './firebase': { db: {} },
    './profile': { displayName: p => p.nickname || p.username },
    './ranking': { RANKING_COUNTS: ['hatchCount','evolveCount','fuseCount','recycleCount'] },
    './inventory': { kindsByGrade },
    '@/constants/gacha.generated': { REWARDS: { sale: {} } },
    'firebase/firestore': {},
    ...extra,
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: key => {
    assert.ok(key in mocks, `Unexpected import ${key}`); return mocks[key];
  }, Date });
  return module.exports;
}
const bond = load('src/lib/bond.ts');
const medals = load('src/lib/medals.ts');
const display = load('src/lib/medal-display.ts', { './medals': medals });
const inventory = load('src/lib/inventory.ts');
const avatar = characters[0].id;
const profile = { username: 'tester', nickname: '테스터', avatar, steps: 0, characters: {}, drawCount: 0 };
assert.equal(bond.bondStatus({ ...profile, avatar: null }, {}), null);
assert.equal(bond.bondStatus(profile, {}).level, 1);
const now = 1800000000000;
const record = { seconds: 0, steps: 0, stepStart: 0, since: { toMillis: () => now - 3600000 } };
assert.equal(bond.bondStatus({ ...profile, steps: 9900 }, { [avatar]: record }, now).points, 100);
for (let i = 0; i < bond.BOND_LEVELS.length; i++) {
  const threshold = bond.BOND_LEVELS[i].points;
  const state = { [avatar]: { ...record, since: null, seconds: threshold * 3600 } };
  const status = bond.bondStatus(profile, state, now);
  assert.equal(status.level, i + 1);
  assert.ok(status.message.includes('테스터'));
  assert.ok(status.message.includes(characters[0].name));
  if (threshold) assert.equal(bond.bondStatus(profile, { [avatar]: { ...state[avatar], seconds: (threshold - 1) * 3600 } }, now).level, i);
}
assert.equal(bond.bondStatus(profile, { [avatar]: { ...record, since: { toMillis: () => now + 3600000 } } }, now).points, 0);
assert.equal(bond.bondStatus(profile, { [avatar]: { ...record, since: null, steps: 50000 } }, now).points, 500, 'saved bond survives switching away and back');
assert.equal(new Set(medals.PERMANENT_MEDALS.map(m => m.id)).size, medals.PERMANENT_MEDALS.length);
for (const medal of medals.COLLECTION_MEDALS) {
  const id = medal.id.split(':')[1];
  const owned = Object.fromEntries(constants.charactersIn(id).map(c => [c.id, 1]));
  assert.equal(medal.eligible({ ...profile, characters: owned }), true);
  delete owned[Object.keys(owned)[0]];
  assert.equal(medal.eligible({ ...profile, characters: owned }), false);
}
for (const medal of medals.MILESTONE_MEDALS) {
  const [kind, target] = medal.id.split(':');
  const field = kind === 'draws' ? 'drawCount' : kind;
  assert.equal(medal.eligible({ ...profile, [field]: +target - 1 }), false);
  assert.equal(medal.eligible({ ...profile, [field]: +target }), true);
}
const crown = medals.RANKING_MEDALS.find(m => m.id === 'ranking:steps');
const a = { ...profile, uid: 'a', steps: 100 };
const b = { ...profile, uid: 'b', steps: 90 };
assert.equal(medals.rankingMedalHolder([], crown), null);
assert.equal(medals.rankingMedalHolder([{ ...a, steps: 0 }], crown), null);
assert.equal(medals.rankingMedalHolder([a, b], crown), 'a');
assert.equal(medals.rankingMedalHolder([a, { ...b, steps: 101 }], crown), 'b', 'crown transfers on overtaking');
const claimed = new Set([medals.PERMANENT_MEDALS[0].id]);
const owned = display.ownedMedals('a', claimed, [a,b]);
assert.equal(display.equippedMedal(medals.PERMANENT_MEDALS[0].id, owned).temporary, false);
assert.equal(display.equippedMedal('ranking:steps', owned).temporary, true);
assert.equal(display.equippedMedal(null, owned), null);
assert.equal(display.equippedMedal('unknown', owned), null);
assert.equal(display.equippedMedal('ranking:steps', display.ownedMedals('a', claimed, [a, { ...b, steps: 101 }])), null);
assert.ok(display.equippedMedal(medals.PERMANENT_MEDALS[0].id, display.ownedMedals('a', claimed, [])), 'permanent equipment survives ranking changes');
const duplicateOwned = Object.fromEntries(characters.map(c => [c.id, c.grade === 'N' ? 999 : 1]));
const animals = inventory.profileAnimals(duplicateOwned);
assert.equal(animals.length, characters.length, 'copies never inflate species totals');
assert.equal(animals[0].grade, 'H');
assert.equal(animals.slice(0,6).length, 6);
assert.equal(animals.slice(-1)[0].grade, 'N');
assert.equal(inventory.profileAnimals({ [characters[0].id]: 0 }).length, 0);
assert.equal(medals.rankingMedalHolder([b, { ...a, steps: 90 }], crown), 'a', 'ties have exactly one deterministic holder');
assert.equal(medals.rankingMedalHolder([{ ...a, uid: 'z' }, ...Array.from({ length: 501 }, (_, i) => ({ ...b, uid: String(i) }))], crown), 'z', 'winner beyond former 500 player cap');
const rules = renderRules(collections, readRewards());
assert.equal(fs.readFileSync('firestore.rules', 'utf8'), rules, 'generated rules stay reproducible');
assert.ok(rules.includes('match /bonds/{uid}'));
assert.ok(rules.includes('match /users/{uid}/medals/{medalId}'));
console.log(`PASS five bond levels, boundary values, offline time, retained bonds, ${medals.COLLECTION_MEDALS.length} collections, seven milestones, crown transfer and ties, uncapped rankings, reproducible rules`);
