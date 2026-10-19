const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const REWARDS = require("../assets/gacha/rewards.json");
const CHARACTER_BY_ID = {};
const GRADES = Object.fromEntries(
  ["N", "R", "EP", "U", "L", "E", "H"].map((g) => [g, {}]),
);
for (const folder of fs.readdirSync(path.join(root, "assets/gacha"))) {
  const configPath = path.join(root, "assets/gacha", folder, "collection.json");
  if (!fs.existsSync(configPath)) continue;
  const config = JSON.parse(fs.readFileSync(configPath));
  for (const file of fs.readdirSync(
    path.join(root, "assets/gacha", folder, "characters"),
  )) {
    if (!file.endsWith(".png")) continue;
    const species = file.slice(0, -4);
    const id = config.base ? species : `${folder}_${species}`;
    CHARACTER_BY_ID[id] = { id, grade: config.grade };
  }
}
const code = ts.transpileModule(
  fs.readFileSync(path.join(root, "src/lib/inventory.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const moduleResult = { exports: {} };
new Function("require", "module", "exports", code)(
  (id) =>
    id.endsWith("/characters")
      ? { CHARACTER_BY_ID, GRADES }
      : id.endsWith("/gacha.generated")
        ? { REWARDS }
        : (() => {
            throw new Error(id);
          })(),
  moduleResult,
  moduleResult.exports,
);
const { availableCopies, availablePicks, kindsByGrade, SALE_PRICES } =
  moduleResult.exports;
assert.equal(kindsByGrade({ mouse: 99, cow: 2, tiger: 0, rare_mouse: 5 }).N, 2);
assert.equal(kindsByGrade({ mouse: 99, cow: 2, rare_mouse: 5 }).R, 1);
assert.equal(kindsByGrade({ unknown: 99 }).N, 0);
assert.equal(
  availableCopies({ characters: { mouse: 3 }, avatar: "mouse" }, "mouse"),
  2,
);
assert.equal(availableCopies({ characters: {}, avatar: "mouse" }, "mouse"), 0);
assert.deepEqual(
  availablePicks(Array(10).fill("mouse"), {
    characters: { mouse: 10 },
    avatar: "mouse",
  }),
  Array(9).fill("mouse"),
);
assert.deepEqual(
  availablePicks(["mouse", "cow", "mouse", "cow"], {
    characters: { mouse: 1, cow: 1 },
    avatar: null,
  }),
  ["mouse", "cow"],
);
assert.deepEqual(availablePicks(["mouse"], null), []);
assert.deepEqual(SALE_PRICES, {
  N: 0,
  R: 1,
  EP: 10,
  U: 30,
  L: 50,
  E: 1,
  H: 100,
});
console.log(
  "PASS distinct ranking, reserved companion, repeated picks, live inventory changes and all sale prices",
);
