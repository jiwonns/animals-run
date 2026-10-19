const fs = require('node:fs'), path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (manifest.images.length !== 10 || manifest.images.some(i => !fs.existsSync(i.path))) throw new Error('Ten generated baby images required');
const root = path.resolve(__dirname, '../assets/gacha/baby');
const config = JSON.parse(fs.readFileSync(path.join(root, 'collection.json'), 'utf8'));
config.names = { ...config.names };
for (const image of manifest.images) {
  fs.copyFileSync(image.path, path.join(root, 'characters', image.id + '.png'));
  config.names[image.id] = '아기 ' + image.name;
}
fs.writeFileSync(path.join(root, 'collection.json'), JSON.stringify(config, null, 2) + '\n');
console.log('Added ten kitten breeds to the existing baby collection.');
