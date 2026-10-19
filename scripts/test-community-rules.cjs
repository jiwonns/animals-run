// Run only against disposable Firebase emulators; never sends test data to a live project.
const assert = require("node:assert/strict");
const project = "demo-animalsrun";
const host = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (
  !host ||
  !authHost ||
  !host.startsWith("127.0.0.1:") ||
  !authHost.startsWith("127.0.0.1:")
)
  throw new Error("Local emulators required");
const root = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const fields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));
const value = (v) =>
  v === null
    ? { nullValue: null }
    : typeof v === "boolean"
      ? { booleanValue: v }
      : Array.isArray(v)
        ? { arrayValue: { values: v.map(value) } }
        : typeof v === "number"
          ? { integerValue: String(v) }
          : typeof v === "object"
            ? { mapValue: { fields: fields(v) } }
            : { stringValue: v };
async function account(name) {
  const r = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${name}@example.com`,
        password: "test-password",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  const user = await r.json();
  const authTime = JSON.parse(Buffer.from(user.idToken.split('.')[1], 'base64url')).auth_time;
  await expect(await request(`activeSessions/${user.localId}`, 'owner', 'PATCH', { authTime, sessionId: 'community-test-session-000', active: true, updatedAt: null }), 200, `seed ${name} session`);
  return user;
}
async function request(path, token, method = "GET", data) {
  return fetch(`${root}/${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      "Content-Type": "application/json",
    },
    ...(data && { body: JSON.stringify({ fields: fields(data) }) }),
  });
}
async function create(path, token, data, attachments = []) {
  const r = await fetch(`${root}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      writes: [{ path, data }, ...attachments].map(({ path, data }) => ({
        update: {
          name: `projects/${project}/databases/(default)/documents/${path}`,
          fields: fields(data),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
        ],
      })),
    }),
  });
  return r;
}
async function expect(r, status, label) {
  assert.equal(r.status, status, `${label}: ${await r.text()}`);
  console.log(`PASS ${label}`);
}
(async () => {
  const a = await account("author");
  const b = await account("reader");
  for (const [user, name] of [
    [a, "author"],
    [b, "reader"],
  ])
    await expect(
      await request(`users/${user.localId}`, "owner", "PATCH", {
        username: name,
        nickname: name,
        avatar: null,
        characters: { rabbit: 1, rat: 1, ox: 1 },
        steps: 1234,
      }),
      200,
      `seed ${name}`,
    );
  const post = {
    uid: a.localId,
    name: "author",
    avatar: null,
    topic: "자랑",
    title: "토끼를 만났어요",
    body: "오늘 산책 이야기",
    character: "rabbit",
  };
  await expect(
    await create("communityPosts/good", a.idToken, post),
    200,
    "author can publish",
  );
  await expect(
    await create("communityPosts/forged", b.idToken, post),
    403,
    "cannot impersonate author",
  );
  await expect(
    await create("communityPosts/long", a.idToken, {
      ...post,
      body: "x".repeat(2001),
    }),
    403,
    "oversized post rejected",
  );
  await expect(
    await create("communityPosts/unowned", a.idToken, {
      ...post,
      character: "tiger",
    }),
    403,
    "unowned animal rejected",
  );
  await expect(
    await request("communityPosts/good", b.idToken),
    200,
    "signed-in reader can view",
  );
  await expect(
    await request("communityPosts/good"),
    403,
    "anonymous reader rejected",
  );
  await expect(
    await request(`users/${a.localId}`, b.idToken),
    403,
    "private profile stays private",
  );
  await expect(
    await request("communityPosts/good", b.idToken, "DELETE"),
    403,
    "other reader cannot delete",
  );
  const comment = {
    uid: b.localId,
    name: "reader",
    avatar: null,
    body: "귀여워요",
  };
  await expect(
    await create("communityPosts/good/comments/one", b.idToken, comment),
    200,
    "reader can comment",
  );
  await expect(
    await create("communityPosts/missing/comments/one", b.idToken, comment),
    403,
    "cannot comment on missing post",
  );
  await expect(
    await create(`communityPosts/good/likes/${b.localId}`, b.idToken, {}),
    200,
    "reader can like once",
  );
  await expect(
    await create(`communityPosts/good/likes/${a.localId}`, b.idToken, {}),
    403,
    "cannot like as another user",
  );
  await expect(
    await request(
      `communityPosts/good/likes/${b.localId}`,
      b.idToken,
      "DELETE",
    ),
    200,
    "reader can unlike",
  );
  const modern = {
    ...post,
    characters: ["rabbit"],
    photos: [],
    walk: null,
    questionTag: null,
  };
  await expect(
    await create("communityPosts/modern", a.idToken, modern),
    200,
    "owned animal collection can be shared",
  );
  await expect(
    await create("communityPosts/three", a.idToken, {
      ...modern,
      characters: ["rabbit", "rat", "ox"],
    }),
    200,
    "three owned animals can be shared",
  );
  await expect(
    await create("communityPosts/duplicate", a.idToken, {
      ...modern,
      characters: ["rabbit", "rabbit"],
    }),
    403,
    "duplicate animal selection rejected",
  );
  await expect(
    await create("communityPosts/emptybrag", a.idToken, {
      ...modern,
      character: null,
      characters: [],
    }),
    403,
    "brag requires an animal",
  );
  await expect(
    await create("communityPosts/forgedanimal", a.idToken, {
      ...modern,
      characters: ["rabbit", "tiger"],
    }),
    403,
    "unowned second animal rejected",
  );
  const free = { ...modern, topic: "자유", character: null, characters: [] };
  await expect(
    await create("communityPosts/free", a.idToken, free),
    200,
    "free daily story can be shared",
  );
  const photo = {
    uid: a.localId,
    data: "data:image/jpeg;base64,/9j/2Q==",
    width: 480,
    height: 320,
  };
  const withPhoto = (id, data = photo) => [
    { path: `communityPosts/${id}/photos/0`, data },
  ];
  await expect(
    await create(
      "communityPosts/photo",
      a.idToken,
      { ...free, photos: ["0"] },
      withPhoto("photo"),
    ),
    200,
    "photo and story commit atomically",
  );
  await expect(
    await request("communityPosts/photo/photos/0", b.idToken),
    200,
    "signed-in friend can view photo",
  );
  await expect(
    await request("communityPosts/photo/photos/0"),
    403,
    "anonymous photo access rejected",
  );
  await expect(
    await create("communityPosts/missingphoto", a.idToken, {
      ...free,
      photos: ["0"],
    }),
    403,
    "story cannot reference missing photo",
  );
  await expect(
    await create(
      "communityPosts/oversizedphoto",
      a.idToken,
      { ...free, photos: ["0"] },
      withPhoto("oversizedphoto", {
        ...photo,
        data: "data:image/jpeg;base64," + "A".repeat(350000),
      }),
    ),
    403,
    "oversized image rejects whole batch",
  );
  await expect(
    await request("communityPosts/oversizedphoto", b.idToken),
    404,
    "failed image leaves no broken story",
  );
  await expect(
    await create(
      "communityPosts/badphoto",
      a.idToken,
      { ...free, photos: ["0"] },
      withPhoto("badphoto", {
        ...photo,
        data: "https://example.com/image.jpg",
      }),
    ),
    403,
    "external image reference rejected",
  );
  await expect(
    await create("communityPosts/photo/photos/1", b.idToken, {
      ...photo,
      uid: b.localId,
    }),
    403,
    "other user cannot attach to story",
  );
  await expect(
    await create("communityPosts/orphan/photos/0", a.idToken, photo),
    403,
    "orphan attachment rejected",
  );
  await expect(
    await create(
      "communityPosts/question",
      a.idToken,
      { ...free, topic: "질문", questionTag: "뽑기", photos: ["0"] },
      withPhoto("question"),
    ),
    200,
    "question with category and screenshot",
  );
  await expect(
    await create("communityPosts/badquestion", a.idToken, {
      ...free,
      topic: "질문",
      questionTag: "unknown",
    }),
    403,
    "unknown question category rejected",
  );
  const walk = { kind: "total", steps: 1234, goal: 5000, date: "2026-10-19" };
  await expect(
    await create("communityPosts/walk", a.idToken, {
      ...modern,
      topic: "산책",
      walk,
    }),
    200,
    "account steps and companion can be shared",
  );
  await expect(
    await create("communityPosts/forgedsteps", a.idToken, {
      ...modern,
      topic: "산책",
      walk: { ...walk, steps: 999999 },
    }),
    403,
    "forged total steps rejected",
  );
  await expect(
    await create("communityPosts/today", a.idToken, {
      ...free,
      topic: "산책",
      walk: { ...walk, kind: "today", steps: 5000 },
    }),
    200,
    "device daily walk can be shared",
  );
  const reply = {
    ...comment,
    parentId: "one",
    replyTo: "reader",
    deleted: false,
  };
  await expect(
    await create("communityPosts/good/comments/reply", b.idToken, reply),
    200,
    "reply attached to root comment",
  );
  await expect(
    await create("communityPosts/good/comments/nested", b.idToken, {
      ...reply,
      parentId: "reply",
    }),
    403,
    "reply cannot create deeper nesting",
  );
  await expect(
    await create("communityPosts/good/comments/missing", b.idToken, {
      ...reply,
      parentId: "missing",
    }),
    403,
    "missing reply parent rejected",
  );
  const commentLike = `communityPosts/good/comments/one/likes/${a.localId}`;
  await expect(
    await create(commentLike, a.idToken, {}),
    200,
    "comment can be liked",
  );
  await expect(
    await request(commentLike, b.idToken),
    200,
    "comment like visible to friends",
  );
  await expect(
    await create(
      `communityPosts/good/comments/reply/likes/${a.localId}`,
      b.idToken,
      {},
    ),
    403,
    "comment like cannot impersonate user",
  );
  await expect(
    await request(commentLike, a.idToken, "DELETE"),
    200,
    "comment like can be removed",
  );
  const existing = await (
    await request("communityPosts/good/comments/one", "owner")
  ).json();
  async function editComment(token, changes) {
    return fetch(
      `${root}/communityPosts/good/comments/one?updateMask.fieldPaths=body&updateMask.fieldPaths=deleted`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: fields(changes) }),
      },
    );
  }
  assert.ok(existing.fields.createdAt);
  await expect(
    await editComment(a.idToken, { body: "", deleted: true }),
    403,
    "another user cannot hide comment",
  );
  await expect(
    await editComment(b.idToken, { body: "rewritten", deleted: false }),
    403,
    "cannot rewrite published comment",
  );
  await expect(
    await editComment(b.idToken, { body: "", deleted: true }),
    200,
    "author can hide root body",
  );
  await expect(
    await request("communityPosts/good/comments/reply", a.idToken),
    200,
    "replies survive root deletion",
  );
  await expect(
    await create("communityPosts/good/comments/afterdeleted", b.idToken, reply),
    403,
    "new replies to deleted root rejected",
  );
  await expect(
    await create(commentLike, a.idToken, {}),
    403,
    "deleted comment cannot receive likes",
  );
  await expect(
    await request("communityPosts/good", a.idToken, "DELETE"),
    200,
    "author can delete post",
  );
  console.log("Community rules verified.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
