// Real Firebase SDK clients against disposable local emulators only.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const appSdk = require('firebase/app'), authSdk = require('firebase/auth'), firestore = require('firebase/firestore');
const host = process.env.FIRESTORE_EMULATOR_HOST, authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host?.startsWith('127.0.0.1:') || !authHost?.startsWith('127.0.0.1:')) throw new Error('Local emulators required');
const root = `http://${host}/v1/projects/demo-animalsrun/databases/(default)/documents`;
function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(imports, id) ? imports[id] : require(id), module, module.exports);
  return module.exports;
}
function client(name) {
  const app = appSdk.initializeApp({ projectId: 'demo-animalsrun', apiKey: 'fake-key', authDomain: 'demo-animalsrun.firebaseapp.com' }, name);
  const auth = authSdk.initializeAuth(app, { persistence: authSdk.inMemoryPersistence });
  authSdk.connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = firestore.getFirestore(app); const [hostname, port] = host.split(':');
  firestore.connectFirestoreEmulator(db, hostname, Number(port));
  const saved = new Map();
  const asyncStorage = {
    getItem: async key => saved.get(key) ?? null, setItem: async (key,value) => { saved.set(key,value); }, removeItem: async key => { saved.delete(key); },
  };
  const storage = load('src/lib/session-storage.ts', { '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorage } });
  const restartLease = () => load('src/lib/session-lease.ts', { './firebase': { db }, './session-storage': storage });
  const lease = restartLease();
  const login = load('src/lib/auth.ts', { './firebase-auth': { auth }, './session-lease': lease, '@/constants/gacha.generated': { NICKNAME_PATTERN: '^[a-zA-Z0-9_]{2,10}$' } });
  const steps = () => load('src/lib/step-progress.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorage },
    'firebase/firestore': firestore, './firebase': { db },
    '@/constants/gacha.generated': { REWARDS: require('./generate-gacha').readRewards() },
    './profile': { profileRef: uid => firestore.doc(db, 'users', uid) },
    './home': { companionRef: uid => firestore.doc(db, 'companions', uid) },
  });
  return { app, auth, db, lease, login, saved, restartLease, steps, storage };
}
async function status(path, token, expected, label, method = 'GET', data) {
  const response = await fetch(`${root}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(data && { body: JSON.stringify(data) }) });
  assert.equal(response.status, expected, `${label}: ${await response.text()}`); console.log(`PASS ${label}`);
}
(async () => {
  const a = client('session-a'), b = client('session-b');
  assert.equal(await a.storage.readSession('not-saved'),null);
  assert.equal(await a.login.signUp('sessionuser', 'password123', { nickname: 'sessionuser', birthday: '2000-01-01' }), null);
  const userA = a.auth.currentUser; const uid = userA.uid; const tokenA = await userA.getIdToken();
  await status(`users/${uid}`, 'owner', 200, 'seed private profile', 'PATCH', { fields: { username: { stringValue: 'sessionuser' }, nickname: { stringValue: 'sessionuser' }, avatar: { nullValue: null }, coins: { integerValue: '500' }, steps: { integerValue: '0' }, characters: { mapValue: { fields: {} } }, drawCount: { integerValue: '0' } } });
  await status(`users/${uid}`, tokenA, 200, 'first authenticated session can read profile');
  const current = await firestore.getDoc(a.lease.sessionRef(uid));
  assert.equal(a.lease.isExpiredSessionError({ code: 'unavailable' }),false);
  assert.equal(a.lease.isExpiredSessionError({ code: 'auth/network-request-failed' }),false);
  assert.equal(a.lease.isExpiredSessionError({ code: 'permission-denied' }),true);
  assert.equal(a.lease.isExpiredSessionError(new a.lease.SessionExpired()),true);
  a.saved.set('auth:session:corrupt','broken-json');
  assert.equal(await a.storage.readSession('corrupt'),null);
  assert.equal(a.saved.has('auth:session:corrupt'),false);
  const resumed = a.restartLease();
  const restored = await resumed.activateSession(userA);
  assert.equal(restored.sessionId,current.data().sessionId);
  await status(`users/${uid}`, tokenA, 200, 'app restart restores the same session without logging in again');
  const progress = a.steps();
  const deviceId = await progress.stepDeviceId();
  assert.equal(await a.steps().stepDeviceId(),deviceId,'device identity survives restarting JavaScript');
  const tracker = `${deviceId}:counter`;
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:1',1000,1000),0);
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:1',1123,1000),123);
  assert.equal(await a.steps().creditStepProgress(uid,tracker,'boot:1',1123,1000),0,'lost-response retry does not pay twice');
  assert.equal(await a.steps().creditStepProgress(uid,tracker,'boot:1',1300,1000),177,'server cursor overrides an old local checkpoint');
  const concurrent = await Promise.all([progress.creditStepProgress(uid,tracker,'boot:1',1400,1000),progress.creditStepProgress(uid,tracker,'boot:1',1400,1000)]);
  assert.equal(concurrent.reduce((sum,n)=>sum+n,0),100);
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:1',1350,1000),0,'stale readings never move the cursor backwards');
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:1',2000,0,true),0,'switching background recording back on skips the disabled period');
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:1',2020),20);
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:2',35),35,'device reboot uses the new counter epoch');
  assert.equal(await progress.creditStepProgress(uid,tracker,'boot:2',80,80),45,'missing local storage still recovers unpaid steps from the server');
  const paid = (await firestore.getDoc(firestore.doc(a.db,'users',uid))).data();
  const rate = require('./generate-gacha').readRewards().stepsPerCoin;
  assert.equal(paid.steps,500);
  assert.equal(paid.coins,500 + Math.floor(500/rate));
  await assert.rejects(() => firestore.updateDoc(firestore.doc(a.db,'users',uid,'stepSync',tracker),{ credited:99999,updatedAt:firestore.serverTimestamp() }),error=>error.code==='permission-denied');
  await assert.rejects(() => progress.creditStepProgress(uid,tracker,'boot:2',-1));
  console.log('PASS durable step/coin accounting: restart, lost response, concurrent sync, stale checkpoint, rebase, reboot, missing local cursor and tamper denial');
  await assert.rejects(firestore.setDoc(a.lease.sessionRef(uid), { ...current.data(), authTime: current.data().authTime + 100, updatedAt: firestore.serverTimestamp() }), error => error.code === 'permission-denied');
  console.log('PASS signed authentication time cannot be forged');
  await assert.rejects(firestore.setDoc(a.lease.sessionRef(uid), { ...current.data(), sessionId: 'another-session-00000000', updatedAt: firestore.serverTimestamp() }), error => error.code === 'permission-denied');
  console.log('PASS same-second different session cannot bypass login collision handling');
  let sawReplacement = false;
  const off = firestore.onSnapshot(a.lease.sessionRef(uid), s => { if (!s.metadata.fromCache && s.data()?.sessionId !== current.data().sessionId) sawReplacement = true; });
  // Calling immediately also exercises the production same-second reauthentication retry when needed.
  assert.equal(await b.login.signIn('sessionuser', 'password123'), null);
  const tokenB = await b.auth.currentUser.getIdToken();
  const timeA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64url')).auth_time;
  const timeB = JSON.parse(Buffer.from(tokenB.split('.')[1], 'base64url')).auth_time;
  assert.ok(timeB > timeA, 'second accepted login has a distinct signed authentication time');
  await status(`users/${uid}`, tokenB, 200, 'latest session can read private profile');
  await status(`users/${uid}`, tokenA, 403, 'previous Firebase token cannot read private profile');
  await assert.rejects(() => progress.creditStepProgress(uid,tracker,'boot:3',100),error=>error.code==='permission-denied');
  await assert.rejects(() => a.restartLease().activateSession(userA), error => error.message.includes('다른 기기'));
  console.log('PASS restarting the old device cannot take back a replaced session');
  await status(`users/${uid}`, tokenA, 403, 'previous token cannot alter profile', 'PATCH', { fields: { coins: { integerValue: '999' } } });
  await status('communityPosts', tokenA, 403, 'previous token cannot read community');
  await assert.rejects(firestore.setDoc(a.lease.sessionRef(uid), { ...current.data(), updatedAt: firestore.serverTimestamp() }), error => error.code === 'permission-denied');
  console.log('PASS previous session cannot reclaim the active session');
  for (let i = 0; i < 30 && !sawReplacement; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(sawReplacement, 'previous client observes replacement in real time'); off();
  await a.login.signOut();
  await status(`users/${uid}`, tokenB, 200, 'old client logout cannot end the latest session');
  const refreshed = await b.auth.currentUser.getIdToken(true);
  await status(`users/${uid}`, refreshed, 200, 'token refresh preserves the current session');
  const freshPage = client('fresh-page'); await freshPage.auth.authStateReady();
  assert.equal(freshPage.auth.currentUser, null); console.log('PASS an unrelated client without saved credentials stays signed out');
  await b.login.signOut();
  assert.equal(b.saved.size,0,'explicit logout removes the saved lease');
  await status(`users/${uid}`, tokenB, 403, 'explicit logout invalidates the old token at the database');
  assert.equal(await b.login.signIn('sessionuser', 'password123'), null); console.log('PASS account can log in again after logout');
  const account = load('src/lib/account.ts', {
    './auth': b.login, './firebase': { db: b.db }, './firebase-auth': { auth: b.auth }, './session-lease': b.lease,
    './home': { eggsRef: uid => firestore.collection(b.db, 'users', uid, 'eggs'), companionRef: uid => firestore.doc(b.db, 'companions', uid) },
    './profile': { profileRef: uid => firestore.doc(b.db, 'users', uid), drawLogsRef: uid => firestore.collection(b.db, 'users', uid, 'draws'), claimsRef: uid => firestore.collection(b.db, 'users', uid, 'claims'), locationRef: uid => firestore.doc(b.db, 'locations', uid) },
    './ranking': { rankingRef: uid => firestore.doc(b.db, 'rankings', uid) },
    './bond': { bondRef: uid => firestore.doc(b.db, 'bonds', uid) },
    './medals': { medalsRef: uid => firestore.collection(b.db, 'users', uid, 'medals') },
    './medal-display': { medalDisplayRef: uid => firestore.doc(b.db, 'medalDisplays', uid) },
    './map-sharing': { mapPreferencesRef: uid => firestore.doc(b.db, 'mapPreferences', uid) },
    './friends': { friendshipsRef: () => firestore.collection(b.db, 'friendships') },
    './step-progress': { stepSyncsRef: uid => firestore.collection(b.db, 'users', uid, 'stepSync') },
  });
  assert.equal(await account.changePassword('password123', 'newpassword123'), null);
  await status(`users/${uid}`, await b.auth.currentUser.getIdToken(true), 200, 'password reauthentication preserves active profile access');
  assert.equal(await account.deleteAccount('newpassword123'), null);
  assert.equal(b.auth.currentUser, null);
  await status(`activeSessions/${uid}`, 'owner', 404, 'account deletion removes its session');
  await status(`users/${uid}`, 'owner', 404, 'account deletion removes its private profile');
  for (const c of [a, b, freshPage]) { await firestore.terminate(c.db); await appSdk.deleteApp(c.app); }
  console.log('Single-session authentication verified.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { setTimeout(() => process.exit(process.exitCode || 0), 100); });
