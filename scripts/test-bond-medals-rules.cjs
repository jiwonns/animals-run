const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const firestore = require('firebase/firestore');
const { readCollections } = require('./generate-gacha');
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host?.startsWith('127.0.0.1:') || !authHost?.startsWith('127.0.0.1:')) throw new Error('Local emulators required');
const projectId = 'demo-animalsrun';
const app = initializeApp({ apiKey: 'fake', projectId });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
const db = firestore.getFirestore(app);
firestore.connectFirestoreEmulator(db, '127.0.0.1', Number(host.split(':')[1]));
const collections = readCollections();
const characters = collections.flatMap(c => c.characters.map(ch => ({ ...ch, collection: c.id, grade: c.config.grade })));
const constants = { COLLECTIONS: collections.map(c => ({ id: c.id, name: c.config.name, grade: c.config.grade })),
  GRADE_ORDER: [], GRADES: {}, CHARACTER_BY_ID: Object.fromEntries(characters.map(c => [c.id, c])), charactersIn: id => characters.filter(c => c.collection === id) };
const profileRef = uid => firestore.doc(db, 'users', uid);
const loadedModules = {};
function load(file) {
  const module = { exports: {} };
  const mocks = { 'firebase/firestore': firestore, '@/constants/characters': constants,
    './firebase': { db }, './profile': { profileRef, displayName: p => p.nickname || p.username },
    './ranking': { RANKING_COUNTS: [], fetchRankings: async () => (await firestore.getDocs(firestore.collection(db, 'rankings'))).docs.map(d => ({ ...d.data(), uid: d.id })) }, './inventory': { kindsByGrade: () => ({}) }, ...loadedModules };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', code)(key => { assert.ok(key in mocks); return mocks[key]; }, module.exports, module);
  return module.exports;
}
const bond = load('src/lib/bond.ts');
const medals = load('src/lib/medals.ts');
loadedModules['./medals'] = medals;
const display = load('src/lib/medal-display.ts');
firestore.setLogLevel('silent');
const value = v => v === null ? { nullValue: null } : v instanceof Date ? { timestampValue: v.toISOString() }
  : typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'object' ? { mapValue: { fields: fields(v) } } : { stringValue: v };
const fields = obj => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k,value(v)]));
async function seed(path, data) {
  const response = await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }),
  });
  assert.equal(response.status, 200, await response.text());
}
const denied = operation => assert.rejects(operation, e => e.code === 'permission-denied');
(async () => {
  const { user } = await createUserWithEmailAndPassword(auth, `bond${Date.now()}@animalsrun.app`, 'test-password123');
  const token = await user.getIdToken();
  const authTime = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).auth_time;
  const uid = user.uid;
  await seed(`activeSessions/${uid}`, { active: true, authTime, sessionId: 'bond-test-session-00000000', updatedAt: new Date() });
  const normal = constants.charactersIn('normal');
  const first = normal[0].id, second = normal[1].id;
  let profile = { username: `bond${Date.now()}`, nickname: '테스터', coins: 100, characters: Object.fromEntries(normal.map(c => [c.id, 1])), drawCount: 0, avatar: null, steps: 0 };
  await seed(`users/${uid}`, profile);
  console.log('Checking unearned medal rejection and completed collection claim');
  await denied(() => medals.claimMedal(uid, medals.COLLECTION_MEDALS.find(m => m.id === 'collection_complete:cats')));
  const medal = medals.COLLECTION_MEDALS.find(m => m.id === 'collection_complete:normal');
  await medals.claimMedal(uid, medal);
  console.log('Checking medal equipment, replacement, clearing and ownership');
  await display.equipMedal(uid, medal.id);
  assert.equal((await firestore.getDoc(display.medalDisplayRef(uid))).data().medalId, medal.id);
  await assert.rejects(() => display.equipMedal(uid, 'steps:100000'));
  await assert.rejects(() => display.equipMedal(uid, 'unknown-medal'));
  await denied(() => firestore.setDoc(display.medalDisplayRef('another-user'), { medalId: null, updatedAt: firestore.serverTimestamp() }));
  await denied(() => firestore.setDoc(display.medalDisplayRef(uid), { medalId: 'steps:100000', updatedAt: firestore.serverTimestamp() }));
  await denied(() => firestore.setDoc(display.medalDisplayRef(uid), { medalId: medal.id, updatedAt: firestore.serverTimestamp(), arbitrary: true }));
  await display.equipMedal(uid, null);
  assert.equal((await firestore.getDoc(display.medalDisplayRef(uid))).data().medalId, null);
  await display.equipMedal(uid, medal.id);
  console.log('Checking duplicate, foreign and deletion rejection');
  await denied(() => medals.claimMedal(uid, medal));
  await denied(() => medals.claimMedal('another-user', medal));
  await denied(() => firestore.deleteDoc(firestore.doc(medals.medalsRef(uid), medal.id)));
  profile = { ...profile, characters: { [first]: 1, [second]: 1 } };
  Object.assign(profile.characters, Object.fromEntries(constants.charactersIn('sea').map(c => [c.id, 0])));
  await seed(`users/${uid}`, profile);
  await denied(() => medals.claimMedal(uid, medals.COLLECTION_MEDALS.find(m => m.id === 'collection_complete:sea')));
  assert.equal((await firestore.getDoc(firestore.doc(medals.medalsRef(uid), medal.id))).exists(), true, 'claimed medal survives inventory loss');
  const stepMedal = medals.MILESTONE_MEDALS.find(m => m.id === 'steps:10000');
  await denied(() => medals.claimMedal(uid, stepMedal));
  await bond.selectCompanion(uid, first);
  console.log('Checking companion selection and tamper rejection');
  let record = (await firestore.getDoc(bond.bondRef(uid))).data();
  assert.equal(record.active, first);
  assert.equal(record.animals[first].seconds, 0);
  await denied(() => firestore.updateDoc(bond.bondRef(uid), { [`animals.${first}.seconds`]: 999999 }));
  await denied(() => firestore.updateDoc(bond.bondRef(uid), { active: second }));
  // Seed two offline hours, then exercise the actual production transaction.
  await seed(`bonds/${uid}`, { active: first, updatedAt: new Date(), animals: { [first]: { seconds: 0, steps: 0, stepStart: 0, since: new Date(Date.now() - 7200000) } } });
  profile = { ...profile, avatar: first, steps: 12345 };
  await seed(`users/${uid}`, profile);
  await medals.claimMedal(uid, stepMedal);
  await display.equipMedal(uid, stepMedal.id);
  assert.equal((await firestore.getDoc(display.medalDisplayRef(uid))).data().medalId, stepMedal.id, 'replacing selects exactly one medal');
  const leader = { ...profile, updatedAt: new Date() };
  await seed(`rankings/${uid}`, leader);
  await display.equipMedal(uid, 'ranking:steps');
  const snapshotEntries = (await firestore.getDocs(firestore.collection(db, 'rankings'))).docs.map(d => ({ ...d.data(), uid: d.id }));
  assert.ok(display.equippedMedal('ranking:steps', display.ownedMedals(uid, new Set(), snapshotEntries)));
  await seed('rankings/challenger', { ...leader, steps: profile.steps + 1 });
  const changedEntries = (await firestore.getDocs(firestore.collection(db, 'rankings'))).docs.map(d => ({ ...d.data(), uid: d.id }));
  assert.equal(display.equippedMedal('ranking:steps', display.ownedMedals(uid, new Set(), changedEntries)), null, 'lost crown vanishes from representative slot');
  await assert.rejects(() => display.equipMedal(uid, 'ranking:steps'));
  await display.equipMedal(uid, medal.id);
  for (const activity of ['hatchCount', 'evolveCount', 'fuseCount', 'recycleCount', 'auctionTrades', 'arenaWins']) {
    const activityMedal = medals.MILESTONE_MEDALS.find(m => m.id === `${activity}:10`);
    await denied(() => medals.claimMedal(uid, activityMedal));
    profile = { ...profile, [activity]: 10 };
    await seed(`users/${uid}`, profile);
    await medals.claimMedal(uid, activityMedal);
  }
  await bond.selectCompanion(uid, second);
  console.log('Checking offline settlement and retained bond');
  record = (await firestore.getDoc(bond.bondRef(uid))).data();
  assert.equal(record.active, second);
  assert.equal(record.animals[first].steps, 12345);
  assert.ok(record.animals[first].seconds >= 7199);
  assert.equal(record.animals[first].since, null);
  await bond.selectCompanion(uid, first);
  record = (await firestore.getDoc(bond.bondRef(uid))).data();
  assert.equal(record.animals[first].steps, 12345, 'switching back retains progress');
  await bond.selectCompanion(uid, null);
  record = (await firestore.getDoc(bond.bondRef(uid))).data();
  assert.equal(record.active, null);
  assert.equal(record.animals[first].since, null);
  await denied(() => bond.selectCompanion(uid, characters.find(c => c.collection === 'cats').id));
  await firestore.deleteDoc(profileRef(uid));
  await firestore.deleteDoc(firestore.doc(medals.medalsRef(uid), medal.id));
  await firestore.deleteDoc(bond.bondRef(uid));
  await firestore.deleteDoc(display.medalDisplayRef(uid));
  console.log('PASS emulator: medal equip/replace/clear, ownership and foreign-write denial, live crown transfer, permanent collection/milestone medals, companion transactions, offline time, retained steps, account cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await firestore.terminate(db); await deleteApp(app); });
