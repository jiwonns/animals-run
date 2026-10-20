// Seeds a fresh remote catalog once; later edits belong to the administrator page.
const {adminRest}=require('./firebase-admin-client.cjs');
const {compileCatalog,validateCatalog}=require('../shared/gacha/catalog');
const catalog=require('../shared/gacha/seed-catalog.json');
function value(v){return v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(value)}}:typeof v==='object'?{mapValue:{fields:fields(v)}}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='boolean'?{booleanValue:v}:{stringValue:v};}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,value(v)]));}
(async()=>{
 validateCatalog(catalog);
 const existing=await adminRest('gachaCatalog/live').catch(e=>{if(/not found|NOT_FOUND/i.test(e.message))return null;throw e;});
 if(existing){console.log('Live catalog already exists; left unchanged.');return;}
 const gradeIds=Object.fromEntries(['N','R','EP','U','L','E','H'].map(grade=>[grade,catalog.collections.filter(c=>c.grade===grade).flatMap(c=>c.characters.map(ch=>ch.id))]));
 const compiled=compileCatalog(catalog),version=1,next={...catalog,version,gradeIds,updatedAt:new Date().toISOString(),updatedBy:'initial-migration'};
 const docs=[['gachaCatalog/live',next],['gachaCatalogVersions/1',next],...compiled.characters.map(c=>[`gachaCharacters/${c.id}`,c]),...compiled.collections.map(c=>[`gachaCollections/${c.id}`,c]),...compiled.banners.map(b=>[`gachaBanners/${b.id}`,{...b,version}])];
 await adminRest(':commit','POST',{writes:docs.map(([path,data])=>({update:{name:`projects/animalsrun-2571c/databases/(default)/documents/${path}`,fields:fields(data)},currentDocument:{exists:false}}))});
 console.log(`Published initial catalog with ${compiled.characters.length} animals; existing prices and odds unchanged.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
