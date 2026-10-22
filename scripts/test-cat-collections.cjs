const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Jimp = require('jimp-compact');
const { readCollections, readRewards, renderRules } = require('./generate-gacha');

(async () => {
  const collections = readCollections();
  const cats = collections.filter(c => c.id === 'cats' || c.id.startsWith('cats_'));
  assert.equal(cats.length, 6);
  assert.deepEqual(cats.map(c => c.config.grade), ['N', 'R', 'EP', 'U', 'L', 'H']);
  const keys = cats[0].keys;
  assert.equal(keys.length, 10);
  const hashes = new Set();
  for (const c of cats) {
    assert.deepEqual([...c.keys].sort(), [...keys].sort(), `${c.id} breed coverage`);
    for (const { key, name } of c.characters) {
      assert.ok(/[가-힣]/.test(name));
      for (const folder of ['characters', 'thumbs']) {
        const file = path.resolve('assets/gacha', c.id, folder, `${key}.png`);
        const bitmap = await Jimp.read(file);
        assert.equal(bitmap.bitmap.width, folder === 'thumbs' ? 256 : 512);
        assert.equal(bitmap.bitmap.height, bitmap.bitmap.width);
        assert.ok(bitmap.hasAlpha(), `${file}: transparent background required`);
        assert.equal(bitmap.getPixelColor(0, 0) & 0xff, 0, `${file}: corner must be transparent`);
        if (folder === 'characters') hashes.add(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
      }
    }
  }
  assert.equal(hashes.size, 60, 'all sixty sprites must be individually drawn, not copied');
  assert.ok(cats.every(c=>c.config.acquisition==='draw'));
  assert.deepEqual(cats[0].config.banner.cost,{'1':10,'10':90});
  assert.deepEqual(cats[0].rates.map(r=>[r.collection,r.rate]),[['cats',.72],['cats_rare',.2],['cats_epic',.05],['cats_unique',.02],['cats_legendary',.009],['cats_hidden',.001]]);
  const normal = collections.find(c => c.id === 'normal');
  assert.deepEqual(normal.rates.map(r=>[r.collection,r.rate]),[['normal',.94],['rare',.05],['hidden',.01]]);
  assert.ok(Math.abs(normal.rates.reduce((n,r)=>n+r.rate,0)-1)<1e-9);
  const rewards = readRewards();
  const rules = renderRules(collections, rewards);
  const prefixPattern = rules.match(/function speciesOf\(c\) \{\s*return c\.replace\('([^']+)'/)[1];
  for (const c of cats) for (const character of c.characters) {
    assert.equal(character.id.replace(new RegExp(prefixPattern), ''), character.key, `${c.id} preserves breed through prefix stripping`);
  }
  for (let i = 0; i < 4; i++) assert.equal(rewards.evolution.paths[cats[i].id], 'evolution_'+cats[i + 1].id);
  for (const c of cats.filter(c => c.config.grade !== 'H')) assert.ok(rewards.crafting.pool.includes(c.id));
  console.log('PASS 60 distinct transparent sprites, ten breeds, grade-based cat draw pools and separate same-breed evolution');
})().catch(error => { console.error(error); process.exitCode = 1; });
