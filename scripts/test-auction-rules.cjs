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
const projectId = 'demo-animalsrun';
const clients = [];
const chars = readCollections().flatMap((c) => c.characters.map((ch) => ({ ...ch, grade: c.config.grade })));
const constants = { CHARACTERS: chars, CHARACTER_BY_ID: Object.fromEntries(chars.map((c) => [c.id, c])) };
const value = (v) =>
  v === null ? { nullValue: null }
    : v instanceof Date ? { timestampValue: v.toISOString() }
    : typeof v === 'boolean' ? { booleanValue: v }
    : typeof v === 'number' ? { integerValue: String(v) }
    : typeof v === 'object' ? { mapValue: { fields: fields(v) } }
    : { stringValue: v };
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, value(v)]));
async function seed(path, data) {
  const r = await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  assert.ok(r.ok, await r.text());
}
function loadService(db) {
  const module = { exports: {} };
  const mocks = {
    'firebase/firestore': f,
    '@/constants/characters': constants,
    '@/constants/gacha.generated': { REWARDS: require('../assets/gacha/rewards.json') },
    './firebase': { db },
    './home': { HomeError: class HomeError extends Error {} },
    './inventory': { availableCopies: (profile, id) => Math.max(0, (profile?.characters[id] ?? 0) - (profile?.avatar === id ? 1 : 0)) },
    './profile': {
      profileRef: (uid) => f.doc(db, 'users', uid),
      displayName: (p) => p.nickname || p.username,
    },
  };
  new Function(
    'require',
    'exports',
    'module',
    ts.transpileModule(fs.readFileSync('src/lib/auction.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  )((key) => {
    assert.ok(key in mocks, key);
    return mocks[key];
  }, module.exports, module);
  return module.exports;
}
async function client(label) {
  const app = initializeApp({ apiKey: 'fake', projectId }, `auction-${label}-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = f.getFirestore(app);
  f.connectFirestoreEmulator(db, '127.0.0.1', +host.split(':')[1]);
  const { user } = await createUserWithEmailAndPassword(auth, `${label}${Date.now()}@animalsrun.app`, 'auction-test123');
  const authTime = JSON.parse(Buffer.from((await user.getIdToken()).split('.')[1], 'base64url')).auth_time;
  const character = chars.find((c) => c.grade === 'N').id;
  await seed(`activeSessions/${user.uid}`, { active: true, authTime, sessionId: 'auction-test-session-00000', updatedAt: new Date() });
  await seed(`users/${user.uid}`, { username: `tester${label}`, nickname: `테스터${label}`, characters: { [character]: 3 }, coins: 100, drawCount: 0, avatar: character });
  const service = loadService(db);
  const c = { app, db, uid: user.uid, character, service };
  clients.push(c);
  return c;
}
const denied = (task) => assert.rejects(task, (e) => e.code === 'permission-denied');
(async () => {
  const [seller, buyer, other] = await Promise.all(['a', 'b', 'c'].map(client));
  console.log('Auction: list inside the band, reject out-of-band and last companion');
  const id = await seller.service.listOnAuction(seller.uid, seller.character, 8);
  const listed = (await f.getDoc(f.doc(seller.db, 'users', seller.uid))).data();
  assert.equal(listed.characters[seller.character], 2);
  await assert.rejects(() => seller.service.listOnAuction(seller.uid, seller.character, 99));
  await denied(() => f.updateDoc(f.doc(seller.db, 'users', seller.uid), { coins: 999, lastAuction: { id, action: 'sell', character: seller.character, price: 8 } }));
  console.log('Auction: buyer pays, seller is paid, 시세 moves, forgeries fail');
  await assert.rejects(() => seller.service.buyListing(seller.uid, id));
  await buyer.service.buyListing(buyer.uid, id);
  const afterBuyer = (await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data();
  const afterSeller = (await f.getDoc(f.doc(seller.db, 'users', seller.uid))).data();
  const quote = (await f.getDoc(f.doc(buyer.db, 'auctionQuotes', seller.character))).data();
  assert.equal(afterBuyer.coins, 92);
  assert.equal(afterBuyer.characters[seller.character], 4);
  assert.equal(afterSeller.coins, 108);
  assert.equal(quote.lastPrice, 8);
  assert.equal(quote.quote, 8);
  assert.equal(quote.windowCount, 1);
  assert.equal(quote.lastWindowCount, 0);
  assert.ok(!(await f.getDoc(f.doc(buyer.db, 'auctionListings', id))).exists());
  await assert.rejects(() => buyer.service.buyListing(buyer.uid, id));
  console.log('Auction: cancel returns the animal');
  const cancelId = await seller.service.listOnAuction(seller.uid, seller.character, 8);
  await assert.rejects(() => buyer.service.cancelListing(buyer.uid, cancelId));
  await seller.service.cancelListing(seller.uid, cancelId);
  const restored = (await f.getDoc(f.doc(seller.db, 'users', seller.uid))).data();
  assert.equal(restored.characters[seller.character], 2);
  console.log('Auction: owner can edit list and bid prices');
  const editListId = await seller.service.listOnAuction(seller.uid, seller.character, 8);
  await seller.service.editListing(seller.uid, editListId, 10);
  assert.equal((await f.getDoc(f.doc(seller.db, 'auctionListings', editListId))).data().price, 10);
  await assert.rejects(() => buyer.service.editListing(buyer.uid, editListId, 9));
  await seller.service.cancelListing(seller.uid, editListId);
  const editBidId = await buyer.service.placeBid(buyer.uid, seller.character, 8);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 84);
  await buyer.service.editBid(buyer.uid, editBidId, 10);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'auctionBids', editBidId))).data().price, 10);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 82);
  await buyer.service.editBid(buyer.uid, editBidId, 8);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 84);
  await assert.rejects(() => seller.service.editBid(seller.uid, editBidId, 9));
  await buyer.service.cancelBid(buyer.uid, editBidId);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 92);
  console.log('Auction: buy orders escrow coins and can be filled or cancelled');
  const bidId = await buyer.service.placeBid(buyer.uid, seller.character, 8);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 84);
  await assert.rejects(() => buyer.service.fillBid(buyer.uid, bidId));
  await assert.rejects(() => buyer.service.placeBid(buyer.uid, seller.character, 99));
  await seller.service.fillBid(seller.uid, bidId);
  const filledBuyer = (await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data();
  const filledSeller = (await f.getDoc(f.doc(seller.db, 'users', seller.uid))).data();
  assert.equal(filledBuyer.coins, 84);
  assert.equal(filledBuyer.characters[seller.character], 5);
  assert.equal(filledSeller.coins, 116);
  assert.equal(filledSeller.characters[seller.character], 1);
  const bidCancel = await buyer.service.placeBid(buyer.uid, seller.character, 8);
  await assert.rejects(() => seller.service.cancelBid(seller.uid, bidCancel));
  await buyer.service.cancelBid(buyer.uid, bidCancel);
  assert.equal((await f.getDoc(f.doc(buyer.db, 'users', buyer.uid))).data().coins, 84);
  await Promise.all(clients.map((c) => deleteApp(c.app)));
  console.log('Auction rules look right');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
