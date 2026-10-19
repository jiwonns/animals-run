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
  const lease = load('src/lib/session-lease.ts', { './firebase': { db } });
  const login = load('src/lib/auth.ts', { './firebase-auth': { auth }, './session-lease': lease, '@/constants/gacha.generated': { NICKNAME_PATTERN: '^[a-zA-Z0-9_]{2,10}$' } });
  return { app, auth, db, lease, login };
}
async function status(path, token, expected, label, method = 'GET', data) {
  const response = await fetch(`${root}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(data && { body: JSON.stringify(data) }) });
  assert.equal(response.status, expected, `${label}: ${await response.text()}`); console.log(`PASS ${label}`);
}
(async () => {
  const a = client('session-a'), b = client('session-b');
  assert.equal(await a.login.signUp('sessionuser', 'password123', { nickname: 'sessionuser', birthday: '2000-01-01' }), null);
  const userA = a.auth.currentUser; const uid = userA.uid; const tokenA = await userA.getIdToken();
  await status(`users/${uid}`, 'owner', 200, 'seed private profile', 'PATCH', { fields: { username: { stringValue: 'sessionuser' }, nickname: { stringValue: 'sessionuser' }, avatar: { nullValue: null }, coins: { integerValue: '500' }, steps: { integerValue: '0' }, characters: { mapValue: { fields: {} } }, drawCount: { integerValue: '0' } } });
  await status(`users/${uid}`, tokenA, 200, 'first authenticated session can read profile');
  const current = await firestore.getDoc(a.lease.sessionRef(uid));
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
  assert.equal(freshPage.auth.currentUser, null); console.log('PASS a new app/page context starts signed out');
  await b.login.signOut();
  await status(`users/${uid}`, tokenB, 403, 'explicit logout invalidates the old token at the database');
  assert.equal(await b.login.signIn('sessionuser', 'password123'), null); console.log('PASS account can log in again after logout');
  const account = load('src/lib/account.ts', {
    './auth': b.login, './firebase': { db: b.db }, './firebase-auth': { auth: b.auth }, './session-lease': b.lease,
    './home': { eggsRef: uid => firestore.collection(b.db, 'users', uid, 'eggs'), companionRef: uid => firestore.doc(b.db, 'companions', uid) },
    './profile': { profileRef: uid => firestore.doc(b.db, 'users', uid), drawLogsRef: uid => firestore.collection(b.db, 'users', uid, 'draws'), claimsRef: uid => firestore.collection(b.db, 'users', uid, 'claims'), locationRef: uid => firestore.doc(b.db, 'locations', uid) },
    './ranking': { rankingRef: uid => firestore.doc(b.db, 'rankings', uid) },
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
