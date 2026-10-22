const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), Jimp = require('jimp-compact');
const { readCollections, readRewards } = require('./generate-gacha');
(async () => {
  const collections = readCollections(); const baby = collections.find(c => c.id === 'baby'); const cats = collections.find(c => c.id === 'cats');
  assert.equal(baby.characters.length, 22); assert.equal(cats.characters.length, 10);
  const data = collections.map(c => ({ id: c.id, base: !!c.config.base, grade: c.config.grade, characters: c.characters }));
  const characters = data.flatMap(c => c.characters.map(a => ({ ...a, collection: c.id, grade: c.grade })));
  const byId = Object.fromEntries(characters.map(c => [c.id, c]));
  const code = ts.transpileModule(fs.readFileSync('src/lib/craft.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === '@/constants/characters') return { CHARACTERS: characters, CHARACTER_BY_ID: byId, speciesOf: c=>c.key };
    if (id === '@/constants/gacha.generated') return { COLLECTION_DATA: data, REWARDS: readRewards() };
    if (id === './home') return { HomeError: Error };
    return {};
  }, module, module.exports);
  for (const cat of cats.characters) {
    const child = baby.characters.find(b => b.key === cat.key); assert.ok(child, cat.key); assert.ok(child.name.startsWith('아기 '));
    const image = await Jimp.read(`assets/gacha/baby/characters/${cat.key}.png`);
    assert.equal(image.bitmap.width, 512); assert.equal(image.bitmap.height, 512); assert.ok(image.hasAlpha());
    for (const collection of ['cats', 'cats_rare', 'cats_epic', 'cats_unique', 'cats_legendary']) {
      const parent = `${collection}_${cat.key}`; const odds = module.exports.breedOdds([parent, parent]);
      assert.ok(Math.abs(odds.find(o => o.character.id === child.id).chance - .1) < 1e-9);
      assert.ok(Math.abs(odds.reduce((sum, o) => sum + o.chance, 0) - 1) < 1e-9);
    }
  }
  console.log('PASS ten transparent kitten breeds, existing twelve babies, and same-breed baby odds across all five parent grades');
})().catch(error => { console.error(error); process.exitCode = 1; });
