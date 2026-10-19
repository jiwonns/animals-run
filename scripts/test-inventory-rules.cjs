const assert = require("node:assert/strict");
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host?.startsWith("127.0.0.1:") || !authHost?.startsWith("127.0.0.1:"))
  throw new Error("Local emulators required");
const root = `http://${host}/v1/projects/demo-animalsrun/databases/(default)/documents`;
const value = (v) =>
  v === null
    ? { nullValue: null }
    : typeof v === 'boolean'
      ? { booleanValue: v }
    : v instanceof Date
      ? { timestampValue: v.toISOString() }
    : Array.isArray(v)
      ? { arrayValue: { values: v.map(value) } }
      : typeof v === "number"
        ? Number.isInteger(v)
          ? { integerValue: String(v) }
          : { doubleValue: v }
        : typeof v === "object"
          ? { mapValue: { fields: fields(v) } }
          : { stringValue: v };
const fields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));
const profile = (characters) => ({
  username: "inventory",
  nickname: "inventory",
  coins: 500,
  characters,
  drawCount: 20,
  tickets: 0,
  steps: 0,
  avatar: null,
  lastDraw: ["mouse"],
  lastBanner: "normal",
  gradeCounts: { N: 20 },
});
async function write(uid, token, data) {
  return fetch(`${root}/users/${uid}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: fields(data) }),
  });
}
(async () => {
  const auth = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "inventory@example.com",
        password: "password123",
        returnSecureToken: true,
      }),
    },
  );
  const user = await auth.json();
  assert.ok(user.idToken);
  const authTime = JSON.parse(Buffer.from(user.idToken.split('.')[1], 'base64url')).auth_time;
  const leaseSeed = await fetch(`${root}/activeSessions/${user.localId}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields({ authTime, sessionId: 'inventory-test-session-000', active: true, updatedAt: null }) }) });
  assert.equal(leaseSeed.status, 200);
  const species = [
    "mouse",
    "cow",
    "tiger",
    "rabbit",
    "dragon",
    "snake",
    "horse",
    "sheep",
    "monkey",
    "chicken",
  ];
  const cases = [
    ...[
      "mouse",
      "cow",
      "rare_mouse",
      "epic_mouse",
      "unique_mouse",
      "legendary_mouse",
    ].map((out) => [Array(10).fill("mouse"), out]),
    [species, "mouse"],
    [species, "pig"],
    [Array(10).fill("sea_mouse"), "rare_mouse"],
    [[...Array(5).fill("mouse"), ...Array(5).fill("rare_mouse")], "mouse"],
    [[...Array(5).fill("mouse"), ...Array(5).fill("rare_mouse")], "rare_mouse"],
  ];
  let failures = 0;
  for (const [inputs, output] of cases) {
    const before = profile({});
    for (const id of inputs)
      before.characters[id] = (before.characters[id] ?? 0) + 1;
    assert.equal((await write(user.localId, "owner", before)).status, 200);
    const after = structuredClone(before);
    for (const id of inputs) {
      after.characters[id]--;
      if (!after.characters[id]) delete after.characters[id];
    }
    after.characters[output] = (after.characters[output] ?? 0) + 1;
    after.recycleCount = 1;
    after.lastCraft = { inputs, output };
    const result = await write(user.localId, user.idToken, after);
    if (result.status !== 200) {
      failures++;
      console.error(
        `FAIL recycle ${inputs.join(",")} -> ${output}: ${await result.text()}`,
      );
    } else
      console.log(
        `PASS recycle ${inputs[0]} (${new Set(inputs).size} kinds) -> ${output}`,
      );
  }
  assert.equal(failures, 0, `${failures} valid recycle operations were denied`);
  async function saleCase(label, before, after, expected = 200) {
    assert.equal((await write(user.localId, "owner", before)).status, 200);
    const r = await write(user.localId, user.idToken, after);
    assert.equal(r.status, expected, `${label}: ${await r.text()}`);
    console.log(`PASS ${label}`);
  }
  const prices = require("../assets/gacha/rewards.json").sale;
  for (const [id, grade] of [
    ["mouse", "N"],
    ["rare_mouse", "R"],
    ["epic_mouse", "EP"],
    ["unique_mouse", "U"],
    ["legendary_mouse", "L"],
    ["autumn_mouse", "E"],
    ["hidden_mouse", "H"],
  ]) {
    const before = profile({ [id]: 3 });
    const after = {
      ...before,
      characters: { [id]: 1 },
      coins: before.coins + prices[grade] * 2,
      lastSale: { character: id, quantity: 2 },
    };
    await saleCase(
      `${grade} sells for ${prices[grade]} coins per copy`,
      before,
      after,
    );
    await saleCase(
      `${grade} rejects forged payout`,
      before,
      { ...after, coins: after.coins + 1 },
      403,
    );
  }
  const before = { ...profile({ mouse: 3, hidden_mouse: 1 }), avatar: "mouse" };
  await saleCase("keeps one companion copy", before, {
    ...before,
    characters: { mouse: 1, hidden_mouse: 1 },
    lastSale: { character: "mouse", quantity: 2 },
  });
  await saleCase(
    "cannot sell last companion",
    before,
    {
      ...before,
      characters: { hidden_mouse: 1 },
      lastSale: { character: "mouse", quantity: 3 },
    },
    403,
  );
  await saleCase(
    "cannot remove a different animal",
    before,
    {
      ...before,
      characters: { mouse: 2 },
      lastSale: { character: "mouse", quantity: 1 },
    },
    403,
  );
  await saleCase(
    "cannot sell fractional quantity",
    before,
    {
      ...before,
      characters: { mouse: 1.5, hidden_mouse: 1 },
      lastSale: { character: "mouse", quantity: 1.5 },
    },
    403,
  );
  await saleCase(
    "cannot recycle reserved companion",
    { ...profile({ mouse: 10 }), avatar: "mouse" },
    {
      ...profile({ mouse: 1 }),
      avatar: "mouse",
      recycleCount: 1,
      lastCraft: { inputs: Array(10).fill("mouse"), output: "mouse" },
    },
    403,
  );
  const regression = profile({ mouse: 3 });
  await saleCase("companion change still works", regression, {
    ...regression,
    avatar: "mouse",
  });
  await saleCase("nickname change still works", regression, {
    ...regression,
    nickname: "friend",
  });
  await saleCase("step coins still work", regression, {
    ...regression,
    steps: 50,
    coins: 501,
  });
  await saleCase("single draw still works", regression, {
    ...regression,
    characters: { mouse: 4 },
    coins: 495,
    drawCount: 21,
    gradeCounts: { N: 21 },
  });
  await saleCase(
    "same-species fusion keeps the companion",
    { ...regression, avatar: "mouse" },
    {
      ...regression,
      avatar: "mouse",
      coins: 450,
      characters: { mouse: 1, rare_mouse: 1 },
      fuseCount: 1,
      lastCraft: { inputs: ["mouse", "mouse"], output: "rare_mouse" },
    },
  );
  await saleCase(
    "fusion cannot overspend coins",
    { ...regression, coins: 40 },
    {
      ...regression,
      coins: -10,
      characters: { mouse: 1, rare_mouse: 1 },
      fuseCount: 1,
      lastCraft: { inputs: ["mouse", "mouse"], output: "rare_mouse" },
    },
    403,
  );
  await saleCase(
    "fusion cannot spend reserved companion",
    { ...regression, avatar: "mouse", characters: { mouse: 2 } },
    {
      ...regression,
      avatar: "mouse",
      coins: 450,
      characters: { rare_mouse: 1 },
      fuseCount: 1,
      lastCraft: { inputs: ["mouse", "mouse"], output: "rare_mouse" },
    },
    403,
  );
  const repeatedSale = {
    ...profile({ rare_mouse: 3 }),
    coins: 502,
    lastSale: { character: "rare_mouse", quantity: 2 },
  };
  await saleCase("same receipt can sell another batch", repeatedSale, {
    ...repeatedSale,
    coins: 504,
    characters: { rare_mouse: 1 },
  });
  const documentName = p => `projects/demo-animalsrun/databases/(default)/documents/${p}`;
  const userPath = `users/${user.localId}`;
  async function put(path, data) {
    const r = await fetch(`${root}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
    assert.equal(r.status, 200);
  }
  async function commit(label, writes) {
    const r = await fetch(`${root}:commit`, { method: 'POST', headers: { Authorization: `Bearer ${user.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
    assert.equal(r.status, 200, `${label}: ${await r.text()}`);
    console.log(`PASS ${label}`);
  }
  const update = (path, data) => ({ update: { name: documentName(path), fields: fields(data) } });
  await put(userPath, regression);
  await commit('achievement reward remains atomic', [update(userPath, { ...regression, tickets: 5, lastClaim: 'char_first:mouse' }), { ...update(`${userPath}/claims/char_first:mouse`, { tickets: 5, label: 'mouse first' }), updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] }]);
  await put(userPath, { ...regression, lastHatch: '0', hatchCount: 2 });
  await put(`${userPath}/eggs/0`, { parents: ['mouse', 'mouse'], child: 'mouse', grade: 'N', createdAt: new Date(Date.now() - 7200000) });
  await commit('repeated hatch in the same slot works', [update(userPath, { ...regression, characters: { mouse: 4 }, lastHatch: '0', hatchCount: 3 }), { delete: documentName(`${userPath}/eggs/0`) }]);
  const evolving = { ...regression, avatar: 'mouse', characters: { mouse: 1 } };
  await put(userPath, evolving);
  await put(`companions/${user.localId}`, { steps: { mouse: 3000 } });
  await commit('evolution and companion steps still commit together', [update(userPath, { ...evolving, coins: 490, avatar: 'rare_mouse', characters: { rare_mouse: 1 }, evolveCount: 1, lastCraft: { inputs: ['mouse'], output: 'rare_mouse' } }), update(`companions/${user.localId}`, { steps: { mouse: 0 } })]);
  if (require('node:fs').existsSync('assets/gacha/cats/collection.json')) {
    const catTiers = [['cats', 'N'], ['cats_rare', 'R'], ['cats_epic', 'EP'], ['cats_unique', 'U'], ['cats_legendary', 'L'], ['cats_hidden', 'H']];
    for (const [collection, grade] of catTiers) {
      const cat = `${collection}_siamese`;
      const start = profile({});
      await saleCase(`cat banner accepts ${grade} result`, start, { ...start, coins: 490, characters: { [cat]: 1 }, drawCount: 21, lastDraw: [cat], lastBanner: 'cats', gradeCounts: { N: 20, [grade]: (grade === 'N' ? 20 : 0) + 1 } });
      await saleCase(`cat ${grade} sale uses existing grade price`, profile({ [cat]: 2 }), { ...profile({ [cat]: 1 }), coins: 500 + prices[grade], lastSale: { character: cat, quantity: 1 } });
    }
    const catDrawStart = profile({});
    const catDraw = { ...catDrawStart, coins: 490, drawCount: 21, lastBanner: 'cats', gradeCounts: { N: 21 } };
    await saleCase('cat-only banner rejects zodiac result', catDrawStart, { ...catDraw, characters: { mouse: 1 }, lastDraw: ['mouse'] }, 403);
    await saleCase('zodiac banner rejects cat result', catDrawStart, { ...catDraw, coins: 495, characters: { cats_siamese: 1 }, lastDraw: ['cats_siamese'], lastBanner: 'normal' }, 403);
    await saleCase('cat draw rejects underpayment', catDrawStart, { ...catDraw, coins: 495, characters: { cats_siamese: 1 }, lastDraw: ['cats_siamese'] }, 403);
    await saleCase('cat ten-draw coin discount', catDrawStart, { ...catDrawStart, coins: 410, drawCount: 30, characters: { cats_siamese: 10 }, lastDraw: Array(10).fill('cats_siamese'), lastBanner: 'cats', gradeCounts: { N: 30 } });
    await saleCase('cat banner accepts ten tickets', { ...catDrawStart, tickets: 10 }, { ...catDrawStart, tickets: 0, drawCount: 30, characters: { cats_siamese: 10 }, lastDraw: Array(10).fill('cats_siamese'), lastBanner: 'cats', gradeCounts: { N: 30 } });
    await saleCase('cats can fuse into the next grade', profile({ cats_siamese: 2 }), { ...profile({ cats_rare_siamese: 1 }), coins: 450, fuseCount: 1, lastCraft: { inputs: ['cats_siamese', 'cats_siamese'], output: 'cats_rare_siamese' } });
    await saleCase('cats can be recycled with repeated inputs', profile({ cats_siamese: 10 }), { ...profile({ cats_rare_siamese: 1 }), recycleCount: 1, lastCraft: { inputs: Array(10).fill('cats_siamese'), output: 'cats_rare_siamese' } });
    for (let i = 0; i < 4; i++) {
      const from = `${catTiers[i][0]}_american_shorthair`; const to = `${catTiers[i + 1][0]}_american_shorthair`;
      const grade = catTiers[i][1]; const evolution = require('../assets/gacha/rewards.json').evolution;
      const start = { ...profile({ [from]: 1 }), avatar: from };
      await put(userPath, start); await put(`companions/${user.localId}`, { steps: { [from]: evolution.steps[grade] } });
      await commit(`cat ${grade} same-breed evolution with nested collection prefix`, [update(userPath, { ...start, coins: 500 - evolution.coins[grade], avatar: to, characters: { [to]: 1 }, evolveCount: 1, lastCraft: { inputs: [from], output: to } }), update(`companions/${user.localId}`, { steps: { [from]: 0 } })]);
    }
  }
  console.log("Inventory rules verified.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
