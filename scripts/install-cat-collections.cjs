/** Install the individually generated cat sprites, then run optimize-images.js and generate-gacha.js. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node scripts/install-cat-collections.cjs <art-manifest.json>');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
const { breeds, tiers, images } = manifest;
if (breeds.length !== 10 || tiers.length !== 6 || images.length !== 60) throw new Error('Expected ten breeds in six grades');
for (const tier of tiers) for (const breed of breeds) {
  const image = images.find(item => item.grade === tier.grade && item.breed === breed.id);
  if (!image || !fs.existsSync(image.source)) throw new Error(`Missing ${tier.grade}/${breed.id}`);
}

for (const [index, tier] of tiers.entries()) {
  const dir = path.join(root, 'assets/gacha', tier.id);
  fs.mkdirSync(path.join(dir, 'characters'), { recursive: true });
  const config = {
    name: `${tier.name} 컬렉션`, grade: tier.grade, order: 1.5 + index / 100,
    names: Object.fromEntries(breeds.map(b => [b.id, tier.prefix + b.name])),
    ...(tier.grade === 'N' && { banner: {
      title: '고양이 뽑기', tagline: '10가지 품종 모티브 · 작고 사랑스러운 고양이 친구들',
      fallback: 'cats', cost: { '1': 10, '10': 90 }, hero: 'siamese',
      mix: { cats_rare: 0.2, cats_epic: 0.05, cats_unique: 0.02, cats_legendary: 0.009 },
      colors: { background: '#FFF0E9', accent: '#E57968', text: '#653E37' },
    } }),
    ...(tier.grade === 'H' && { hidden: { cats: 0.001 } }),
  };
  fs.writeFileSync(path.join(dir, 'collection.json'), JSON.stringify(config, null, 2) + '\n');
  for (const breed of breeds) {
    const image = images.find(item => item.grade === tier.grade && item.breed === breed.id);
    fs.copyFileSync(image.source, path.join(dir, 'characters', `${breed.id}.png`));
  }
}
const rewardsPath = path.join(root, 'assets/gacha/rewards.json');
const rewards = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
for (const tier of tiers.filter(t => t.grade !== 'H')) {
  if (!rewards.crafting.pool.includes(tier.id)) rewards.crafting.pool.push(tier.id);
}
for (let i = 0; i < 4; i++) rewards.evolution.paths[tiers[i].id] = tiers[i + 1].id;
fs.writeFileSync(rewardsPath, JSON.stringify(rewards, null, 2) + '\n');
console.log('Installed 60 cat sprites, six collections, dedicated banner and four evolution paths.');
