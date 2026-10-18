/**
 * Keeps character images light: shrinks assets/gacha/<collection>/characters/*.png to at most FULL px and
 * writes THUMB px copies to <collection>/thumbs/ for grids. Run after adding images, before `npm run gacha`.
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp-compact');

const GACHA_DIR = path.join(path.dirname(require.resolve('../package.json')), 'assets', 'gacha');
const FULL = 512;
const THUMB = 256;

async function main() {
  let shrunk = 0;
  let thumbs = 0;
  for (const folder of fs.readdirSync(GACHA_DIR)) {
    const charactersDir = path.join(GACHA_DIR, folder, 'characters');
    if (!fs.existsSync(charactersDir)) continue;
    const thumbsDir = path.join(GACHA_DIR, folder, 'thumbs');
    fs.mkdirSync(thumbsDir, { recursive: true });
    for (const file of fs.readdirSync(charactersDir).filter((f) => f.toLowerCase().endsWith('.png'))) {
      const source = path.join(charactersDir, file);
      const thumb = path.join(thumbsDir, file);
      let image = null;
      const load = async () => (image ??= await Jimp.read(source));
      if ((await load()).bitmap.width > FULL) {
        await image.resize(FULL, Jimp.AUTO, Jimp.RESIZE_BICUBIC).writeAsync(source);
        shrunk++;
      }
      if (!fs.existsSync(thumb) || fs.statSync(thumb).mtimeMs < fs.statSync(source).mtimeMs) {
        await (await load()).clone().resize(THUMB, Jimp.AUTO, Jimp.RESIZE_BICUBIC).writeAsync(thumb);
        thumbs++;
      }
    }
  }
  console.log(`[images] shrank ${shrunk} to ${FULL}px, wrote ${thumbs} thumbnails (${THUMB}px)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
