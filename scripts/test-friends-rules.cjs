const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const f = require('firebase/firestore');
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host?.startsWith('127.0.0.1:') || !authHost?.startsWith('127.0.0.1:')) throw new Error('Local emulators required');
f.setLogLevel('silent');
const projectId = 'demo-animalsrun';
const clients = [];
const value = v => v === null ? { nullValue: null } : v instanceof Date ? { timestampValue: v.toISOString() }
  : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) }
  : Array.isArray(v) ? { arrayValue: { values: v.map(value) } }
  : typeof v === 'object' ? { mapValue: { fields: fields(v) } } : { stringValue: v };
const fields = obj => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k,value(v)]));
async function seed(path, data, method = 'PATCH') {
  const response = await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, ...(method !== 'DELETE' && { body: JSON.stringify({ fields: fields(data) }) }),
  });
  assert.ok(response.ok, await response.text());
}
function load(file, db) {
  const module = { exports: {} };
  const mocks = { 'firebase/firestore': f, './firebase': { db }, './profile': {
    displayName: p => p.nickname || p.username, profileRef: uid => f.doc(db, 'users', uid), locationRef: uid => f.doc(db, 'locations', uid),
  }, './bond': {}, './home': {}, '@/constants/gacha.generated': { REWARDS: {} } };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', code)(key => { assert.ok(key in mocks, key); return mocks[key]; }, module.exports, module);
  return module.exports;
}
async function client(label) {
  const app = initializeApp({ apiKey: 'fake', projectId }, `friends-${label}-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = f.getFirestore(app);
  f.connectFirestoreEmulator(db, '127.0.0.1', +host.split(':')[1]);
  const { user } = await createUserWithEmailAndPassword(auth, `${label}${Date.now()}@animalsrun.app`, 'friend-test123');
  const authTime = JSON.parse(Buffer.from((await user.getIdToken()).split('.')[1], 'base64url')).auth_time;
  await seed(`activeSessions/${user.uid}`, { active: true, authTime, sessionId: 'friend-test-session-000000', updatedAt: new Date() });
  const profile = { username: `tester${label}`, nickname: `친구${label}`, avatar: null, characters: {}, steps: 0, coins: 100, drawCount: 0 };
  await seed(`users/${user.uid}`, profile);
  const result = { app, auth, db, uid: user.uid, profile, friends: load('src/lib/friends.ts', db), sharing: load('src/lib/map-sharing.ts', db), walk: load('src/lib/walk.ts', db) };
  clients.push(result); return result;
}
const denied = action => assert.rejects(action, e => e.code === 'permission-denied');
const relationship = async (c, other) => { const d = await f.getDoc(c.friends.friendshipRef(c.uid, other.uid)); return d.exists() ? { ...d.data(), id: d.id } : null; };
const queryMine = c => f.getDocs(f.query(c.friends.friendshipsRef(), f.where('members', 'array-contains', c.uid)));
const location = (c, uid) => f.doc(c.db, 'locations', uid);
const publicMap = c => f.getDocsFromServer(f.query(f.collection(c.db, 'locations'), f.where('audience', '==', 'public')));
(async () => {
  const [a,b,c] = await Promise.all(['A','B','C'].map(client));
  console.log('Checking request creation, duplicates, self and impersonation denial');
  assert.equal(a.friends.friendshipId(a.uid,b.uid), a.friends.friendshipId(b.uid,a.uid));
  await assert.rejects(() => a.friends.sendFriendRequest(a.uid,a.profile,a.uid,a.profile));
  await a.friends.sendFriendRequest(a.uid,a.profile,b.uid,b.profile);
  let r = await relationship(b,a);
  assert.equal(r.status, 'pending');
  assert.equal((await queryMine(a)).size, 1);
  assert.equal((await queryMine(b)).size, 1);
  assert.equal((await queryMine(c)).size, 0);
  await denied(() => f.getDoc(c.friends.friendshipRef(a.uid,b.uid)));
  await denied(() => f.getDocs(f.collection(c.db,'friendships')));
  await assert.rejects(() => a.friends.sendFriendRequest(a.uid,a.profile,b.uid,b.profile));
  await assert.rejects(() => b.friends.sendFriendRequest(b.uid,b.profile,a.uid,a.profile));
  await assert.rejects(() => a.friends.acceptFriendRequest(a.uid,a.profile,r.id));
  await denied(() => f.updateDoc(a.friends.friendshipRef(a.uid,b.uid), { status: 'accepted', updatedAt: f.serverTimestamp(), requestReadAt: f.serverTimestamp() }));
  await denied(() => f.updateDoc(a.friends.friendshipRef(a.uid,b.uid), { requestReadAt: f.serverTimestamp() }));
  await denied(() => f.setDoc(c.friends.friendshipRef(c.uid,a.uid), { ...r, sender: c.uid, recipient: a.uid, members: [c.uid,a.uid].sort(), createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp() }));
  console.log('Checking read state and recipient-only acceptance');
  let notices = b.friends.friendNotifications([r],b.uid);
  assert.equal(notices.filter(n => n.unread).length, 1);
  await b.friends.readAllFriendNotifications(b.uid,notices);
  r = await relationship(b,a);
  assert.equal(b.friends.friendNotifications([r],b.uid)[0].unread, false);
  await a.sharing.initializeMapSharing(a.uid,true);
  await a.walk.shareLocation(a.uid,a.profile,null,37,127,'public');
  assert.equal((await publicMap(c)).size, 1);
  await a.sharing.saveMapSharing(a.uid,{ sharing:true,audience:'friends' });
  assert.equal((await f.getDoc(location(a,a.uid))).exists(), false, 'switching audience removes public coordinates atomically');
  await denied(() => a.walk.shareLocation(a.uid,a.profile,null,37,127,'public'));
  await a.walk.shareLocation(a.uid,a.profile,null,37,127,'friends');
  await denied(() => f.getDoc(location(b,a.uid)));
  await denied(() => f.getDoc(location(c,a.uid)));
  await b.friends.acceptFriendRequest(b.uid,b.profile,r.id);
  r = await relationship(a,b);
  assert.equal(r.status,'accepted');
  assert.equal((await f.getDoc(location(b,a.uid))).exists(), true);
  assert.equal((await publicMap(c)).size,0);
  await denied(() => f.getDocsFromServer(f.collection(c.db,'locations')));
  await denied(() => f.getDoc(location(c,a.uid)));
  notices = a.friends.friendNotifications([r],a.uid);
  assert.equal(notices[0].kind,'accepted'); assert.equal(notices[0].unread,true);
  await a.friends.readFriendNotification(a.uid,notices[0]);
  assert.equal(a.friends.friendNotifications([await relationship(a,b)],a.uid)[0].unread,false);
  console.log('Checking unfriending, hidden mode and stale-write protection');
  await a.friends.removeFriendship(a.uid,await relationship(a,b));
  await denied(() => f.getDoc(location(b,a.uid)));
  await a.sharing.saveMapSharing(a.uid,{ sharing:false,audience:'friends' });
  assert.equal((await f.getDoc(location(b,a.uid))).exists(),false);
  await denied(() => a.walk.shareLocation(a.uid,a.profile,null,37,127,'friends'));
  await denied(() => f.updateDoc(a.sharing.mapPreferencesRef(a.uid),{ sharing:true,updatedAt:f.serverTimestamp(), extra:true }));
  await a.sharing.saveMapSharing(a.uid,{ sharing:true,audience:'public' });
  await a.walk.shareLocation(a.uid,a.profile,null,38,128,'public');
  assert.equal((await f.getDoc(location(c,a.uid))).data().lat,38);
  await denied(() => f.setDoc(a.sharing.mapPreferencesRef(a.uid),{ sharing:false,audience:'friends',updatedAt:f.serverTimestamp() }));
  await denied(() => b.walk.shareLocation(a.uid,a.profile,null,39,129,'public'));
  await a.friends.sendFriendRequest(a.uid,a.profile,b.uid,b.profile);
  r = await relationship(a,b);
  assert.equal(b.friends.friendNotifications([r],b.uid)[0].unread,true,'new request starts unread');
  await b.friends.removeFriendship(b.uid,r);
  assert.equal(await relationship(a,b),null,'rejection removes pending request and its notification');
  await a.friends.sendFriendRequest(a.uid,a.profile,c.uid,c.profile);
  await a.friends.removeFriendship(a.uid,await relationship(a,c));
  assert.equal(await relationship(a,c),null,'sender can cancel');
  await seed(`users/${a.uid}`,null,'DELETE');
  await f.deleteDoc(location(a,a.uid));
  await f.deleteDoc(a.sharing.mapPreferencesRef(a.uid));
  await signOut(c.auth);
  await denied(() => f.getDoc(location(c,b.uid)));
  console.log('PASS friends: three-account request/accept/reject/cancel/remove, real unread notifications, membership queries, friend-only location privacy, immediate revocation, atomic audience changes, stale-write rejection and cleanup');
})().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  await Promise.all(clients.map(async c => { await f.terminate(c.db); await deleteApp(c.app); }));
});
