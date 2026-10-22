// Dry run by default; --apply publishes the reviewed plan atomically with a version precondition.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {adminRest}=require('./firebase-admin-client.cjs');
const {validateCatalog,assertCompatible,compileCatalog}=require('../shared/gacha/catalog');
const {DRAW_GRADES,drawGrade,gradeRates}=require('../shared/gacha/draw-pools');
const seed=require('../shared/gacha/seed-catalog.json');
const folder=path.resolve(__dirname,'../.test-artifacts');
const planPath=path.join(folder,'species-release-plan.json');
function decode(v){if('nullValue'in v)return null;if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return(v.arrayValue.values??[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;return v.stringValue??v.timestampValue;}
function value(v){return v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(value)}}:typeof v==='object'?{mapValue:{fields:fields(v)}}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='boolean'?{booleanValue:v}:{stringValue:v};}
function fields(o){return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,value(v)]));}
function canonical(o){return Array.isArray(o)?o.map(canonical):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,canonical(o[k])])):o;}
function digest(o){return crypto.createHash('sha256').update(JSON.stringify(canonical(o))).digest('hex');}
function redesign(before){
 if(process.argv.includes('--restore-original-banners')){
  const backup=JSON.parse(fs.readFileSync(path.join(folder,'catalog-before-v3.json'),'utf8'));
  const original=decode({mapValue:{fields:backup.fields}});
  const collections=before.collections.map(c=>({
   ...c,acquisition:c.id==='baby'?'breeding':c.acquisition,
   banner:structuredClone(original.collections.find(old=>old.id===c.id)?.banner??null),
  }));
  const next={schema:1,version:before.version+1,collections};validateCatalog(next);assertCompatible(before,next);return next;
 }
 if(process.argv.includes('--restore-posters')){
  const collections=before.collections.map(c=>{
   const banner=seed.collections.find(s=>s.id===c.id)?.banner;
   return c.banner&&banner?{...c,banner:{...c.banner,poster:banner.poster,colors:banner.colors}}:c;
  });
  const next={schema:1,version:before.version+1,collections};validateCatalog(next);assertCompatible(before,next);return next;
 }
 const collections=seed.collections.map(template=>{
  const old=before.collections.find(c=>c.id===template.id);
  if(!old)return structuredClone(template);
  return {...old,acquisition:template.acquisition,banner:structuredClone(template.banner),characters:old.characters.map(ch=>{
   const species=ch.species??template.characters.find(v=>v.id===ch.id)?.species;
   return species?{...ch,species}:{...ch};
  })};
 });
 collections.push(...before.collections.filter(c=>!seed.collections.some(t=>t.id===c.id)).map(c=>({...c,banner:null})));
 for(const c of collections)if(c.banner){
  const weights=Object.fromEntries(DRAW_GRADES.map(g=>[g,c.banner.rates.filter(r=>drawGrade(collections.find(v=>v.id===r.collection).grade)===g).reduce((n,r)=>n+r.rate,0)]));
  c.banner.rates=gradeRates(collections,weights);
 }
 const next={schema:1,version:before.version+1,collections};
 validateCatalog(next);assertCompatible(before,next);return next;
}
async function main(){
 const document=await adminRest('gachaCatalog/live');
 const before=decode({mapValue:{fields:document.fields}});
 const candidate=redesign(before);
 const summary={beforeVersion:before.version,nextVersion:candidate.version,oldAnimals:before.collections.reduce((n,c)=>n+c.characters.length,0),animals:candidate.collections.reduce((n,c)=>n+c.characters.length,0),evolutionAnimals:candidate.collections.filter(c=>c.acquisition==='evolution').reduce((n,c)=>n+c.characters.length,0),banners:candidate.collections.filter(c=>c.banner).map(c=>({id:c.id,title:c.banner.title,cost:c.banner.cost}))};
 if(!process.argv.includes('--apply')){
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,`catalog-before-v${before.version}.json`),JSON.stringify(document,null,2));
  fs.writeFileSync(planPath,JSON.stringify({updateTime:document.updateTime,beforeDigest:digest(before),candidate,summary},null,2));
  console.log(JSON.stringify(summary,null,2));return;
 }
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
 if(plan.updateTime!==document.updateTime||plan.beforeDigest!==digest(before)||digest(plan.candidate)!==digest(candidate))throw Error('운영 카탈로그 또는 전환안이 변경됐어요. 먼저 dry run으로 새 계획을 검토해주세요.');
 const compiled=compileCatalog(candidate);
 const gradeIds=Object.fromEntries(['N','R','EP','U','L','E','H'].map(g=>[g,candidate.collections.filter(c=>c.grade===g).flatMap(c=>c.characters.map(ch=>ch.id))]));
 const next={...candidate,gradeIds,updatedBy:'species-redesign-release'};
 const name=p=>`projects/animalsrun-2571c/databases/(default)/documents/${p}`;
 const writes=[{update:{name:name('gachaCatalog/live'),fields:fields(next)},currentDocument:{updateTime:document.updateTime},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},
  {update:{name:name(`gachaCatalogVersions/${next.version}`),fields:fields(next)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},
  ...compiled.characters.map(c=>({update:{name:name(`gachaCharacters/${c.id}`),fields:fields(c)}})),
  ...compiled.collections.map(c=>({update:{name:name(`gachaCollections/${c.id}`),fields:fields(c)}})),
  ...compiled.banners.map(b=>({update:{name:name(`gachaBanners/${b.id}`),fields:fields({...b,version:next.version})}}))];
 if(writes.length>450)throw Error('전환 쓰기 수가 제한을 넘었어요.');
 await adminRest(':commit','POST',{writes});
 const live=decode({mapValue:{fields:(await adminRest('gachaCatalog/live')).fields}});
 if(live.version!==next.version||digest(live.collections)!==digest(next.collections))throw Error('게시 후 카탈로그 확인에 실패했어요.');
 console.log(`Published and verified catalog v${live.version}: ${summary.animals} animals, ${summary.evolutionAnimals} evolution-only, ${summary.banners.length} grade banners; existing character IDs/images preserved.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
