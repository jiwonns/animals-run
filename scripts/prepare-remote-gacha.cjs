/* Copies content-addressed assets into Expo's public directory and creates the initial catalog. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readCollections, readRewards } = require('./generate-gacha');
const base = process.env.GACHA_ASSET_BASE_URL || 'https://animalsrun-2571c.web.app/gacha-assets';
function remoteImage(...parts) {
  const source = path.join(__dirname, '..', 'assets', 'gacha', ...parts);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 20);
  const name = `${hash}${path.extname(source).toLowerCase()}`;
  const folder = path.join(__dirname, '..', 'public', 'gacha-assets');
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, name);
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  return { uri: `${base}/${name}` };
}
function prepare() {
  const collections = readCollections().map(c => {
    const b = c.config.banner;
    return { id:c.id, name:c.config.name, grade:c.config.grade, acquisition:c.config.acquisition, base:!!c.config.base, hidden:!!c.config.hidden,
      banner:b ? { title:b.title, tagline:b.tagline ?? '', enabled:b.enabled!==false, cost:b.cost, rates:c.rates, hero:c.characters.find(ch => ch.key === (b.hero ?? c.keys[0])).id,
        colors:{ background:'#FFE4D2', accent:'#FF5A1F', text:'#3A1A0A', ...b.colors }, poster:c.poster ? remoteImage(c.posterCollection ?? c.id,c.poster) : null } : null,
      characters:c.characters.map(ch => ({ id:ch.id, name:ch.name, species:ch.key, image:remoteImage(c.assetCollection ?? c.id,'characters',`${ch.key}.png`), thumb:remoteImage(c.assetCollection ?? c.id,'thumbs',`${ch.key}.png`) })) };
  });
  const catalog = { schema:1,version:0,collections };
  require('../shared/gacha/catalog').validateCatalog(catalog);
  fs.writeFileSync(path.join(__dirname,'../shared/gacha/seed-catalog.json'), JSON.stringify(catalog));
  fs.writeFileSync(path.join(__dirname,'../shared/gacha/rewards.json'), JSON.stringify(readRewards(),null,2));
  return catalog;
}
module.exports = { prepare, remoteImage };
if (require.main === module) { const result = prepare(); console.log(`Prepared ${result.collections.length} collections with remote image URLs.`); }
