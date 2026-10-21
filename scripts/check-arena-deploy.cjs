const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { adminRest } = require('./firebase-admin-client.cjs');
async function check() {
  const indexes = await adminRest('../collectionGroups/arenaDuels/indexes');
  const index = indexes.indexes?.find(i => i.fields.some(f => f.fieldPath === 'members' && f.arrayConfig === 'CONTAINS') && i.fields.some(f => f.fieldPath === 'createdAt' && f.order === 'DESCENDING'));
  assert.equal(index?.state, 'READY', `Arena index is ${index?.state ?? 'missing'}`);
  console.log('PASS production arena index READY');
  if (process.argv.includes('--index-only')) return;
  const base = 'https://animalsrun-2571c.web.app';
  for (const route of ['/', '/arena', '/manage', '/mypage/avatar']) assert.equal((await fetch(base + route)).status, 200);
  const dir = path.join(__dirname,'../web-build/_expo/static/js/web');
  const hash = b => createHash('sha256').update(b).digest('hex');
  for (const prefix of ['arena-', 'avatar-', 'manage-', '__common-']) {
    const files = fs.readdirSync(dir).filter(n => n.startsWith(prefix) && n.endsWith('.js'));
    assert.equal(files.length,1);
    const response = await fetch(`${base}/_expo/static/js/web/${files[0]}`);
    assert.equal(response.status,200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.join(dir,files[0]))));
  }
  console.log('PASS production routes HTTP 200; arena, avatar, map and shared bundle hashes match tested build');
}
check().catch(e=>{console.error(e.message);process.exitCode=1;});
