const assert=require('node:assert/strict'),fs=require('node:fs');
const {adminRest}=require('./firebase-admin-client.cjs');
const {compileCatalog,validateCatalog}=require('../shared/gacha/catalog');
function decode(v){if('nullValue'in v)return null;if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return(v.arrayValue.values??[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;return v.stringValue??v.timestampValue;}
const read=async p=>decode({mapValue:{fields:(await adminRest(p)).fields}});
(async()=>{
 const base='https://animalsrun-2571c.web.app',local=fs.readFileSync('web-build/index.html','utf8');
 for(const route of ['/','/admin','/gacha','/collection/dex']){const response=await fetch(base+route,{cache:'no-store'});assert.equal(response.status,200);assert.equal(await response.text(),local);}
 for(const [,script] of local.matchAll(/src="([^"]+\.js)"/g)){const response=await fetch(new URL(script,base));assert.equal(response.status,200);}
 for(let attempt=0;attempt<3;attempt++){
  const catalog=await read('gachaCatalog/live');validateCatalog(catalog);const compiled=compileCatalog(catalog);
  const results=await Promise.all(compiled.banners.map(async expected=>({expected,actual:await read('gachaBanners/'+expected.id)})));
  if((await read('gachaCatalog/live')).version!==catalog.version)continue;
  for(const {expected,actual} of results){assert.equal(actual.version,catalog.version);for(const key of ['cost1','cost10','enabled','ticketable'])assert.equal(actual[key],expected[key]);assert.deepEqual([...actual.characterIds].sort(),[...expected.characterIds].sort());}
  console.log(`PASS latest deployed web routes/assets and live catalog v${catalog.version}: ${compiled.banners.filter(b=>b.enabled).length} active draws, exact selected animal pools/prices/versions; administrator choices preserved`);return;
 }
 throw Error('Catalog kept changing during verification; run again after publishing finishes.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
