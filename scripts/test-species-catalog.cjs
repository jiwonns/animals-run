const assert = require('node:assert/strict');
const { readCollections,readRewards } = require('./generate-gacha');
const { validateCatalog,assertCompatible,compileCatalog,pickCharacter } = require('../shared/gacha/catalog');
const { DRAW_GRADES,drawGrade,gradeRates } = require('../shared/gacha/draw-pools');
const seed=require('../shared/gacha/seed-catalog.json');
const collections=readCollections(),rewards=readRewards();
validateCatalog(seed);
assert.deepEqual(DRAW_GRADES,['N','R','EP','U','L','H','E']);
for(const grade of DRAW_GRADES)assert.equal(drawGrade(grade),grade,'every grade stays distinct');
const banners=seed.collections.filter(c=>c.banner);
assert.deepEqual(banners.map(c=>c.id),['normal','autumn','sea','cats','premium']);
assert.equal(seed.collections.find(c=>c.id==='baby').acquisition,'breeding');
for(const c of banners) {
  assert.ok(Math.abs(c.banner.rates.reduce((n,r)=>n+r.rate,0)-1)<1e-10);
  assert.ok(c.banner.rates.every(r=>seed.collections.find(c=>c.id===r.collection).acquisition==='draw'));
  for(const grade of DRAW_GRADES) {
    const entries=c.banner.rates.filter(r=>drawGrade(seed.collections.find(c=>c.id===r.collection).grade)===grade);
    assert.ok(entries.every(r=>r.collection!=='baby'));
  }
  let start=0;
  for(const grade of DRAW_GRADES){
    const chance=c.banner.rates.filter(r=>seed.collections.find(c=>c.id===r.collection).grade===grade).reduce((n,r)=>n+r.rate,0);
    if(chance>0){const rolls=[start+chance/2,0];const pick=pickCharacter(seed,c.banner,()=>rolls.shift());assert.equal(seed.collections.find(col=>col.characters.some(ch=>ch.id===pick.id)).grade,grade);}
    start+=chance;
  }
  for(const roll of [0,.1,.5,.8,.95,.999999]) {
    const values=[roll,.999999];const result=pickCharacter(seed,c.banner,()=>values.shift());
    assert.ok(seed.collections.some(c=>c.acquisition==='draw'&&c.characters.some(ch=>ch.id===result.id)));
  }
}
for(const [from,to] of Object.entries(rewards.evolution.paths)) {
  const a=collections.find(c=>c.id===from),b=collections.find(c=>c.id===to);
  assert.equal(b.config.acquisition,'evolution');
  for(const ch of a.characters) assert.ok(b.characters.some(target=>target.key===ch.key),'species stays the same');
}
const evolved=seed.collections.filter(c=>c.acquisition==='evolution');
const cats=seed.collections.find(c=>c.id==='cats');
for(const [grade,count,chance] of [['L',10,.009],['H',10,.001]]){
 const entries=cats.banner.rates.filter(r=>seed.collections.find(c=>c.id===r.collection).grade===grade);
 assert.equal(entries.reduce((n,r)=>n+seed.collections.find(c=>c.id===r.collection).characters.length,0),count);
 assert.equal(entries.reduce((n,r)=>n+r.rate,0),chance);
}
const autumn=seed.collections.find(c=>c.id==='autumn');assert.ok(autumn.banner.rates.some(r=>seed.collections.find(c=>c.id===r.collection).grade==='E'));
assert.equal(evolved.reduce((n,c)=>n+c.characters.length,0),88);
for(const b of compileCatalog(seed).banners) {
  assert.ok(b.poolRegex.length<=4096,'compatibility regex fits Firestore limit');
  for(const c of evolved)for(const ch of c.characters) { assert.ok(!new RegExp(b.poolRegex).test(ch.id));assert.ok(!b.characterIds.includes(ch.id)); }
}
const bad=structuredClone(seed);bad.collections[0].banner.rates=[{collection:evolved[0].id,rate:1,hidden:false}];
assert.throws(()=>validateCatalog(bad),/진화 전용/);
const babyDraw=structuredClone(seed);babyDraw.collections[0].banner.rates=[{collection:'baby',rate:1,hidden:false}];assert.throws(()=>validateCatalog(babyDraw),/교배로만/);
const prior={...seed,collections:seed.collections.filter(c=>c.acquisition!=='evolution').map(c=>{const copy={...c};delete copy.acquisition;return copy;})};
assertCompatible(prior,seed);
const pool=[{id:'a',grade:'N',characters:[{id:'one'}]},{id:'b',grade:'N',characters:[{id:'two'},{id:'three'}]}];
const rates=gradeRates(pool,{N:1});assert.equal(rates[0].rate,1/3);
assert.equal(pickCharacter({collections:pool},{rates},(()=>{let values=[0,.9];return()=>values.shift();})()).id,'three');
console.log('PASS seven distinct grades, cats legendary 10 at 0.9% and hidden 10 at 0.1%, separate event draws, original banners preserved, breeding-only babies, evolution excluded from draws');
