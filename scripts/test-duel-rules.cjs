const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const f = require('firebase/firestore');
const { readCollections } = require('./generate-gacha');
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host?.startsWith('127.0.0.1:') || !authHost?.startsWith('127.0.0.1:')) throw new Error('Local emulators required');
f.setLogLevel('silent');
const projectId = 'demo-animalsrun'; const clients = [];
const chars = readCollections().flatMap(c => c.characters.map(ch => ({ ...ch, grade: c.config.grade })));
const constants = { CHARACTERS: chars, CHARACTER_BY_ID: Object.fromEntries(chars.map(c => [c.id,c])) };
const duelModule = { exports: {} };
new Function('exports','module', ts.transpileModule(fs.readFileSync('src/lib/duel.ts','utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS} }).outputText)(duelModule.exports,duelModule);
const engine = duelModule.exports;
const value = v => v === null ? { nullValue:null } : v instanceof Date ? { timestampValue:v.toISOString() } : typeof v === 'boolean' ? {booleanValue:v} : typeof v === 'number' ? {integerValue:String(v)} : Array.isArray(v) ? {arrayValue:{values:v.map(value)}} : typeof v === 'object' ? {mapValue:{fields:fields(v)}} : {stringValue:v};
const fields = o => Object.fromEntries(Object.entries(o).map(([k,v])=>[k,value(v)]));
async function seed(path,data) {
  const r = await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})});
  assert.ok(r.ok,await r.text());
}
async function client(label) {
  const app = initializeApp({apiKey:'fake',projectId},`duel-${label}-${Date.now()}`); const auth = getAuth(app);
  connectAuthEmulator(auth,`http://${authHost}`,{disableWarnings:true}); const db = f.getFirestore(app); f.connectFirestoreEmulator(db,'127.0.0.1',+host.split(':')[1]);
  const {user} = await createUserWithEmailAndPassword(auth,`${label}${Date.now()}@animalsrun.app`,'duel-test123');
  const authTime = JSON.parse(Buffer.from((await user.getIdToken()).split('.')[1],'base64url')).auth_time;
  const character = chars.find(c=>c.grade === (label === 'b' ? 'H' : 'N')).id;
  await seed(`activeSessions/${user.uid}`,{active:true,authTime,sessionId:'duel-test-session-000000',updatedAt:new Date()});
  await seed(`users/${user.uid}`,{username:`tester${label}`,characters:{[character]:1},coins:100,drawCount:0});
  const module = {exports:{}};
  const mocks = {'firebase/firestore':f,'@/constants/characters':constants,'./firebase':{db},'./profile':{profileRef:uid=>f.doc(db,'users',uid)},'./friends':{friendshipRef:(a,b)=>f.doc(db,'friendships',[a,b].sort().join(':'))},'./duel':engine};
  new Function('require','exports','module',ts.transpileModule(fs.readFileSync('src/lib/duel-service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(key=>{assert.ok(key in mocks,key);return mocks[key];},module.exports,module);
  const c = {app,db,uid:user.uid,character,service:module.exports}; clients.push(c); return c;
}
const denied = task => assert.rejects(task,e=>e.code==='permission-denied');
const read = async(c,id)=>(await f.getDoc(f.doc(c.db,'arenaDuels',id))).data();
async function rawClaim(c,id) {
  const d=await read(c,id); const p=(await f.getDoc(f.doc(c.db,'users',c.uid))).data();
  const w=(await f.getDoc(f.doc(c.db,'arenaWallets',c.uid))).data(); const day=Math.floor(Date.now()/86400000);
  const amount=engine.duelReward(d.mode,d.difficulty,d.state.winner,d.owner===c.uid?'player':'rival');
  const batch=f.writeBatch(c.db);
  batch.update(f.doc(c.db,'users',c.uid),{coins:p.coins+amount,lastArenaReward:id});
  batch.set(f.doc(c.db,'arenaWallets',c.uid),{day,count:w?.day===day?w.count+1:1,lastDuel:id,updatedAt:f.serverTimestamp()});
  batch.update(f.doc(c.db,'arenaDuels',id),{claimed:[...d.claimed,c.uid],updatedAt:f.serverTimestamp()});
  return batch.commit();
}
async function finish(a,b,id) {
  for (let n=0;n<30;n++) {
    const d=await read(a,id); if(d.status==='finished') return d;
    const active=d.state.turn%2===0?a:b;
    const energy=d.state.turn%2===0?d.state.pEnergy:d.state.rEnergy;
    await active.service.makeDuelMove(active.uid,id,energy>=3?'burst':'attack');
  }
  return read(a,id);
}
(async()=>{
  const [a,b,c]=await Promise.all(['a','b','c'].map(client));
  console.log('Arena: ownership, turn order, forged states, and AI policy');
  await assert.rejects(()=>a.service.createDuel(a.uid,b.character,'rookie'));
  const id=await a.service.createDuel(a.uid,a.character,'rookie');
  await denied(()=>f.getDoc(f.doc(b.db,'arenaDuels',id)));
  await denied(()=>f.updateDoc(f.doc(a.db,'arenaDuels',id),{'state.rHp':0,status:'finished',updatedAt:f.serverTimestamp()}));
  await denied(()=>f.updateDoc(f.doc(a.db,'users',a.uid),{coins:1000,lastArenaReward:id}));
  await a.service.makeDuelMove(a.uid,id,'focus');
  const d=await read(a,id);
  const fake=engine.duelStep(d.state,'guard',constants.CHARACTER_BY_ID[d.playerId].grade,constants.CHARACTER_BY_ID[d.rivalId].grade);
  await denied(()=>f.updateDoc(f.doc(a.db,'arenaDuels',id),{state:fake,lastMove:'guard',status:'active',updatedAt:f.serverTimestamp()}));
  await a.service.makeDuelMove(a.uid,id,'attack');
  const done=await finish(a,a,id); assert.equal(done.status,'finished');
  const payout=await a.service.claimDuelReward(a.uid,id); assert.ok(payout>=1&&payout<=6);
  assert.equal((await f.getDoc(f.doc(a.db,'users',a.uid))).data().coins,100+payout);
  await assert.rejects(()=>a.service.claimDuelReward(a.uid,id));
  await denied(()=>rawClaim(a,id));
  console.log('Arena: friend acceptance, opponent access, real alternate turns, and both payouts');
  await assert.rejects(()=>a.service.createDuel(a.uid,a.character,'veteran',b.uid));
  await seed(`friendships/${[a.uid,b.uid].sort().join(':')}`,{status:'accepted',members:[a.uid,b.uid].sort()});
  const friendId=await a.service.createDuel(a.uid,a.character,'veteran',b.uid);
  await denied(()=>f.getDoc(f.doc(c.db,'arenaDuels',friendId)));
  await assert.rejects(()=>a.service.acceptDuel(a.uid,friendId,a.character));
  await b.service.acceptDuel(b.uid,friendId,b.character);
  await assert.rejects(()=>b.service.makeDuelMove(b.uid,friendId,'attack'));
  const friendDone=await finish(a,b,friendId); assert.equal(friendDone.status,'finished');
  await a.service.claimDuelReward(a.uid,friendId); await b.service.claimDuelReward(b.uid,friendId);
  assert.equal((await read(a,friendId)).claimed.length,2);
  const cancelled=await a.service.createDuel(a.uid,a.character,'rookie',b.uid);
  await b.service.cancelDuel(b.uid,cancelled); await assert.rejects(()=>b.service.acceptDuel(b.uid,cancelled,b.character));
  console.log('Arena: daily cap and forged wallet denial');
  await seed(`arenaWallets/${a.uid}`,{day:Math.floor(Date.now()/86400000),count:5,lastDuel:friendId,updatedAt:new Date()});
  const capId=await a.service.createDuel(a.uid,a.character,'rookie'); await finish(a,a,capId);
  await assert.rejects(()=>a.service.claimDuelReward(a.uid,capId));
  await denied(()=>rawClaim(a,capId));
  await denied(()=>f.setDoc(f.doc(a.db,'arenaWallets',a.uid),{day:0,count:0,lastDuel:capId,updatedAt:f.serverTimestamp()}));
  await seed(`arenaWallets/${a.uid}`,{day:Math.floor(Date.now()/86400000)-1,count:5,lastDuel:friendId,updatedAt:new Date()});
  const race=await Promise.allSettled([a.service.claimDuelReward(a.uid,capId),a.service.claimDuelReward(a.uid,capId)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1,'Concurrent claims pay once');
  assert.equal((await f.getDoc(f.doc(a.db,'arenaWallets',a.uid))).data().count,1,'New UTC day resets cap');
  console.log('PASS arena server turns, ownership, fraud prevention, atomic rewards, daily cap, and asynchronous friend duels');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await Promise.all(clients.map(c=>deleteApp(c.app)));});
