/** Contact sheets for visual QA only; character sprites remain transparent. */
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');
const { readCollections } = require('./generate-gacha');

(async () => {
  const cats = readCollections().filter(c => c.id === 'cats' || c.id.startsWith('cats_'));
  const overview = new Jimp(1800, 1200, 0xfff7f0ff);
  fs.mkdirSync('.expo/cat-generation', { recursive: true });
  fs.mkdirSync('docs/assets', { recursive: true });
  for (const [row, collection] of cats.entries()) {
    const sheet = new Jimp(1280, 640, 0xfff7f0ff);
    for (const [index, character] of collection.characters.entries()) {
      const source = await Jimp.read(path.join('assets/gacha', collection.id, 'characters', `${character.key}.png`));
      const x = (index % 5) * 256; const y = Math.floor(index / 5) * 300 + 32;
      sheet.composite(source.clone().contain(230, 252), x + 13, y);
      overview.composite(source.clone().contain(166, 166), index * 180 + 7, row * 200 + 3);
    }
    await sheet.writeAsync(`.expo/cat-generation/${collection.config.grade}-preview.png`);
  }
  await overview.quality(88).writeAsync('docs/assets/cats-overview.jpg');
  console.log('Wrote six grade contact sheets and docs/assets/cats-overview.jpg');
})().catch(error => { console.error(error); process.exitCode = 1; });
