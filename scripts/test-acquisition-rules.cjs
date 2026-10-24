const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword}=require('firebase/auth');
const f=require('firebase/firestore');
const host=process.env.FIRESTORE_EMULATOR_HOST,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST,project='demo-animalsrun';
if(!host?.startsWith('127.0.0.1:')||!authHost?.startsWith('127.0.0.1:'))throw new Error('Local emulators required');
f.setLogLevel('silent');
const value=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(value)}}:typeof v==='object'?{mapValue:{fields:fields(v)}}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='boolean'?{booleanValue:v}:{stringValue:v};
const fields=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,value(v)]));
async function put(path,data){const r=await fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents/${path}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})});assert.equal(r.status,200,await r.text());}
function load(file,mocks){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id]??require(id),module,module.exports);return module.exports;}
(async()=>{
 const app=initializeApp({apiKey:'fake',projectId:project},'acquisition_rules'),auth=getAuth(app);
 connectAuthEmulator(auth,`http://${authHost}`,{disableWarnings:true});const db=f.getFirestore(app);f.connectFirestoreEmulator(db,'127.0.0.1',Number(host.split(':')[1]));
 try {
  const {user}=await createUserWithEmailAndPassword(auth,'acquisition@users.animalsrun.local','local-password');const token=await user.getIdTokenResult();
  await put(`activeSessions/${user.uid}`,{active:true,authTime:token.claims.auth_time,sessionId:'a'.repeat(20)});
  const profileRef=uid=>f.doc(db,'users',uid),companionRef=uid=>f.doc(db,'companions',uid);
  await put('users/'+user.uid,{username:'acquisition',nickname:'획득검사',coins:1000,tickets:0,characters:{premium_mouse:1},drawCount:0,gradeCounts:{},steps:0,avatar:null});
  await put('companions/'+user.uid,{steps:{premium_mouse:6000}});
  await assert.rejects(f.runTransaction(db,async tx=>{
   tx.update(profileRef(user.uid),{characters:{premium_mouse:0,epic_mouse:1},coins:970,evolveCount:1,lastCraft:{inputs:['premium_mouse'],output:'epic_mouse'}});
   tx.update(companionRef(user.uid),{'steps.premium_mouse':0});
  }));
  await put(`users/${user.uid}`,{username:'acquisition',nickname:'획득검사',coins:1000,tickets:0,characters:{mouse:2},drawCount:0,gradeCounts:{},steps:0,avatar:null});
  await put(`companions/${user.uid}`,{steps:{mouse:3000}});
  async function evolve(output) {
   return f.runTransaction(db,async tx=>{
    tx.update(profileRef(user.uid),{characters:{mouse:1,[output]:1},coins:990,evolveCount:1,lastCraft:{inputs:['mouse'],output}});
    tx.update(companionRef(user.uid),{'steps.mouse':0});
   });
  }
  await assert.rejects(evolve('evolution_rare_mouse'));
  await evolve('rare_mouse');
  let profile=(await f.getDoc(profileRef(user.uid))).data();
  assert.equal(profile.characters.rare_mouse,1);assert.equal(profile.characters.mouse,1);assert.equal(profile.coins,990);
  await assert.rejects(f.updateDoc(profileRef(user.uid),{characters:{mouse:1,rare_mouse:1},fuseCount:1,lastCraft:{inputs:['mouse','mouse'],output:'rare_mouse'}}));
  await assert.rejects(f.updateDoc(profileRef(user.uid),{characters:{mouse:1,rare_mouse:1},recycleCount:1,lastCraft:{inputs:['mouse'],output:'rare_mouse'}}));
  await assert.rejects(f.setDoc(f.doc(db,'users',user.uid,'eggs','0'),{parents:['mouse','mouse'],child:'mouse',grade:'N',createdAt:f.serverTimestamp()}));
  const seed=require('../shared/gacha/seed-catalog.json');
  const chars=Object.fromEntries(seed.collections.flatMap(c=>c.characters.map(ch=>[ch.id,{...ch,grade:c.grade,collection:c.id}])));
  const gradeIds=Object.fromEntries(['N','R','EP','U','L','E','H'].map(g=>[g,seed.collections.filter(c=>c.grade===g).flatMap(c=>c.characters.map(ch=>ch.id))]));
  await put('gachaCatalog/live',{...seed,version:1,gradeIds});
  for(const b of require('../shared/gacha/catalog').compileCatalog(seed).banners)await put('gachaBanners/'+b.id,{...b,version:1});
  let picked='evolution_rare_mouse';
  const gacha=load('src/lib/gacha.ts',{'firebase/firestore':f,'@/constants/banners':{BANNERS:[],pickFromBanner:()=>chars[picked]},'@/constants/gacha.generated':{REWARDS:require('../shared/gacha/rewards.json')},'./firebase':{db},'./profile':{profileRef,drawLogRef:(uid,n)=>f.doc(db,'users',uid,'draws',String(n))},'./remote-catalog':{currentCatalog:()=>null,loadRemoteCatalog:async()=>null},'./rewards':{gradeCountsAfter:(counts,picks)=>({...counts,[chars[picks[0]].grade]:(counts[chars[picks[0]].grade]??0)+picks.length}),newRewards:()=>[]}});
  const banner={id:'normal',...seed.collections.find(c=>c.id==='normal').banner};
  await assert.rejects(gacha.drawCharacters(user.uid,banner,1,'coins'));
  for(const blocked of ['rare_mouse','epic_mouse','unique_mouse','legendary_mouse','hidden_mouse','baby_mouse']){picked=blocked;await assert.rejects(gacha.drawCharacters(user.uid,banner,1,'coins'));}
  picked='mouse';await gacha.drawCharacters(user.uid,banner,1,'coins');
  profile=(await f.getDoc(profileRef(user.uid))).data();assert.equal(profile.characters.mouse,2);assert.equal(profile.coins,985);
  await f.setDoc(f.doc(db,'users',user.uid,'eggs','0'),{parents:['mouse','mouse'],child:'baby_mouse',grade:'N',createdAt:f.serverTimestamp()});
  await assert.rejects(f.updateDoc(profileRef(user.uid),{characters:{evolution_rare_mouse:2},coins:935,fuseCount:1,lastCraft:{inputs:['mouse','mouse'],output:'evolution_rare_mouse'}}));
  await assert.rejects(f.updateDoc(profileRef(user.uid),{characters:{rare_mouse:2},coins:935,fuseCount:1,lastCraft:{inputs:['mouse','mouse'],output:'rare_mouse'}}));
  profile=(await f.getDoc(profileRef(user.uid))).data();assert.equal(profile.characters.rare_mouse,1);
  await put(`users/${user.uid}`,{...profile,characters:{...profile.characters,mouse:10}});
  await assert.rejects(f.updateDoc(profileRef(user.uid),{characters:{rare_mouse:2},recycleCount:1,lastCraft:{inputs:Array(10).fill('mouse'),output:'rare_mouse'}}));
  const amounts=require('../shared/gacha/rewards.json');
  const rewardApi=load('src/lib/rewards.ts',{'firebase/firestore':f,'@/constants/characters':{CHARACTER_BY_ID:chars,CHARACTERS:Object.values(chars),COLLECTIONS:[],GRADE_ORDER:['N','R','EP','U','L','H'],GRADES:Object.fromEntries(['N','R','EP','U','L','H'].map(g=>[g,{label:g}]))},'@/constants/gacha.generated':{REWARDS:amounts},'./firebase':{db},'./profile':{profileRef,claimRef:(uid,id)=>f.doc(db,'users',uid,'claims',id)}});
  const expected={mouse:3,premium_mouse:4,epic_mouse:5,unique_mouse:6,legendary_mouse:7,hidden_mouse:10};
  await put('users/'+user.uid,{...profile,characters:Object.fromEntries(Object.keys(expected).map(id=>[id,1])),tickets:0});
  const pending=rewardApi.earnedRewards({characters:Object.fromEntries(Object.keys(expected).map(id=>[id,1])),gradeCounts:{},drawCount:0,auctionTrades:0,arenaWins:0});
  for(const [id,tickets] of Object.entries(expected)){
   const reward=pending.find(r=>r.id==='char_first:'+id);assert.equal(reward.tickets,tickets);
   await assert.rejects(rewardApi.claimReward(user.uid,{...reward,tickets:tickets+1}));
   await rewardApi.claimReward(user.uid,reward);
   await assert.rejects(rewardApi.claimReward(user.uid,reward));
  }
  for(const [grade,tickets] of Object.entries({N:3,R:4,EP:5,U:6,L:7,H:10})){
   const reward=pending.find(r=>r.id==='grade_first:'+grade);assert.equal(reward.tickets,tickets);
   await assert.rejects(rewardApi.claimReward(user.uid,{...reward,tickets:tickets+1}));
   await rewardApi.claimReward(user.uid,reward);
   await assert.rejects(rewardApi.claimReward(user.uid,reward));
  }
  assert.equal((await f.getDoc(profileRef(user.uid))).data().tickets,70);
  console.log('PASS first acquisition rewards 3/4/5/6/7/10; inflated amounts and duplicate claims rejected');
  console.log('PASS Firestore: evolution-only results stay exclusive; normal draws and same-species evolution work; high-grade draws/fusion/recycling rejected');
 }finally{await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
