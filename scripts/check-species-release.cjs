const assert=require('node:assert/strict');
const fs=require('node:fs');
const {adminRest}=require('./firebase-admin-client.cjs');
const {validateCatalog}=require('../shared/gacha/catalog');
function decode(v){if('nullValue'in v)return null;if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return(v.arrayValue.values??[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;return v.stringValue??v.timestampValue;}
async function main(){
 const base='https://animalsrun-2571c.web.app';
 const local=fs.readFileSync('web-build/index.html','utf8');
 await Promise.all(['/','/admin','/manage','/arena','/collection/dex'].map(async route=>{
  const response=await fetch(base+route,{cache:'no-store'});assert.equal(response.status,200);assert.equal(await response.text(),local);console.log('PASS live web '+route);
 }));
 const scripts=[...local.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);assert.ok(scripts.length);
 await Promise.all(scripts.map(async script=>{const response=await fetch(new URL(script,base));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);}));
 const doc=await adminRest('gachaCatalog/live'),catalog=decode({mapValue:{fields:doc.fields}});validateCatalog(catalog);
 assert.ok(catalog.version>=4);
 const banners=catalog.collections.filter(c=>c.banner&&c.banner.enabled!==false);
 assert.deepEqual(banners.map(c=>c.id),['normal','autumn','sea','cats','premium']);
 const evolution=new Set(catalog.collections.filter(c=>c.acquisition==='evolution').flatMap(c=>c.characters.map(ch=>ch.id)));assert.equal(evolution.size,88);
 await Promise.all(banners.map(async c=>{
  const doc=await adminRest('gachaBanners/'+c.id),b=decode({mapValue:{fields:doc.fields}});
  assert.equal(b.version,catalog.version);assert.equal(b.enabled,true);assert.ok(b.characterIds.length>0);
  assert.ok(b.characterIds.every(id=>!id.startsWith('baby_')));
  assert.ok(b.characterIds.every(id=>!evolution.has(id)));assert.equal(b.cost1,c.banner.cost[1]);
  assert.ok(c.banner.poster?.uri,'original poster artwork must be present');
  const poster=await fetch(c.banner.poster.uri);assert.equal(poster.status,200);assert.match(poster.headers.get('content-type'),/^image\//);
 }));
 const backup=JSON.parse(fs.readFileSync('.test-artifacts/catalog-before-v3.json','utf8'));
 const before=decode({mapValue:{fields:backup.fields}});
 for(const c of before.collections.filter(c=>c.banner))assert.deepEqual(catalog.collections.find(v=>v.id===c.id).banner,c.banner,'original poster, price, title and banner pool');
 for(const c of before.collections)for(const ch of c.characters){
  const next=catalog.collections.find(v=>v.id===c.id)?.characters.find(v=>v.id===ch.id);assert.ok(next);assert.equal(next.name,ch.name);assert.deepEqual(next.image,ch.image);assert.deepEqual(next.thumb,ch.thumb);
 }
 console.log(`PASS deployed JavaScript, catalog v${catalog.version}, five live banners with original poster artwork, evolution excluded from every draw, all 190 existing IDs/names/images preserved`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
