/**
 * Scans assets/gacha/<collection>/ and generates:
 *   - src/constants/gacha.generated.ts (metadata and content-addressed remote image URLs)
 *   - firestore.rules (character whitelist, banner prices and achievement claims)
 *
 * Achievement ticket rewards come from assets/gacha/rewards.json and are enforced by the rules, so the
 * achievement ids and amounts in earnedRewards() (src/lib/rewards.ts) must stay in step with renderRules() below.
 *
 * A collection may have its own "banner" (which can also "mix" in other collections: { "<id>": rate }), be
 * "hidden": { "<banner id>": rate, ... } inside other banners, or neither (only obtainable by crafting).
 * Mixed and hidden rates come out of the banner's base-collection share.
 *
 * rewards.json "crafting" orders the grades that breeding, fusion, recycling and evolution move between
 * ("tiers", lowest first) and names the collections they can produce ("pool").
 *
 * Runs automatically from metro.config.js; run manually with `npm run gacha`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(require.resolve('../package.json'));
const GACHA_DIR = path.join(ROOT, 'assets', 'gacha');
const TS_OUT = path.join(ROOT, 'src', 'constants', 'gacha.generated.ts');
const RULES_OUT = path.join(ROOT, 'firestore.rules');

const ID_PATTERN = /^[a-z0-9_]+$/;
/** Nicknames: 2 to 10 Hangul syllables, letters, digits or _; shared by firestore.rules and the app. */
const NICKNAME_PATTERN = '^[가-힣a-zA-Z0-9_]{2,10}$';
/** Normal, rare, epic, unique, legendary, event, hidden; keep in sync with GRADES in src/constants/characters.ts. */
const GRADES = ['N', 'R', 'EP', 'U', 'L', 'E', 'H'];
const POSTER_FILES = ['poster.png', 'poster.jpg', 'poster.jpeg', 'poster.webp'];
/** Zodiac animals in cycle order, as base-collection ids; a lunar year's animal is ZODIAC[(year - 4) % 12]. */
const ZODIAC = ['mouse', 'cow', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'chicken', 'dog', 'pig'];
/** Birthdays are accepted from FIRST_YEAR through LAST_YEAR (the rules' 19xx/20xx pattern). */
const FIRST_YEAR = 1900;
const LAST_YEAR = 2099;

/**
 * Seollal (Korean lunar new year) for every accepted year as comma-separated MMDD, from the Korean (dangi)
 * calendar in Node's ICU. Someone born before their year's Seollal belongs to the previous zodiac year.
 */
let seollalCache;
function seollalTable() {
  seollalCache ??= computeSeollal();
  return seollalCache;
}

function computeSeollal() {
  const format = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' });
  if (format.resolvedOptions().calendar !== 'dangi') fail('this Node.js build has no Korean (dangi) calendar');
  const days = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    let date = new Date(Date.UTC(year, 0, 15, 3));
    for (;;) {
      const parts = Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
      if (parts.month === '1' && parts.day === '1') break;
      date = new Date(date.getTime() + 86_400_000);
      if (date.getUTCMonth() > 1) fail(`no Seollal found for ${year}`);
    }
    days.push(date.toISOString().slice(5, 10).replace('-', ''));
  }
  return days.join(',');
}

function fail(message) {
  throw new Error(`[gacha] ${message}`);
}

function readJson(file, label) {
  try {
    // Windows editors often prepend a byte-order mark, which JSON.parse rejects.
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

/** assets/gacha/rewards.json: free-ticket rewards, shared by the app and firestore.rules. */
function readRewards() {
  const rewards = readJson(path.join(GACHA_DIR, 'rewards.json'), 'rewards.json');
  const isCount = (n) => Number.isInteger(n) && n >= 0;
  const { character, grade, drawCount } = rewards;
  const ok =
    GRADES.every((g) => isCount(rewards.sale?.[g])) &&
    isCount(rewards.ticketMaxCost) &&
    rewards.stepsPerCoin > 0 &&
    isCount(rewards.stepsPerCoin) &&
    isCount(rewards.collectionComplete) &&
    Array.isArray(character?.milestones) &&
    character.milestones.every(isCount) &&
    character.every > 0 &&
    grade?.every > 0 &&
    Array.isArray(drawCount?.milestones) &&
    drawCount.milestones.every(isCount) &&
    drawCount.every > 0 &&
    isCount(drawCount.reward) &&
    Object.keys(rewards.breeding?.hatchMinutes ?? {}).length > 0 &&
    Object.entries(rewards.breeding.hatchMinutes).every(
      ([g, minutes]) => GRADES.includes(g) && Number.isInteger(minutes) && minutes > 0,
    ) &&
    isCount(rewards.breeding.coinsPerMinute);
  if (!ok) fail('rewards.json is missing a field or has a non-integer value');
  for (const [section, fields] of [
    [character, ['first', 'milestone', 'every']],
    [grade, ['first', 'every']],
  ]) {
    for (const key of Object.keys(section).filter((k) => k === 'default' || GRADES.includes(k))) {
      for (const field of fields) {
        const value = section[key][field];
        if (key === 'default' ? !isCount(value) : value !== undefined && !isCount(value)) {
          fail(`rewards.json: "${key}.${field}" must be a whole number`);
        }
      }
    }
  }
  return rewards;
}

/** Checks rewards.json's crafting sections against the collections they refer to. */
function validateCrafting(collections, rewards) {
  const byId = Object.fromEntries(collections.map((c) => [c.id, c]));
  const { crafting, breeding, evolution, fusion, recycle } = rewards;
  const tiers = crafting?.tiers;
  const isProbability = (n) => typeof n === 'number' && n >= 0 && n <= 1;
  const isPositive = (n) => Number.isInteger(n) && n > 0;
  if (!Array.isArray(tiers) || tiers.length === 0 || !tiers.every((g) => GRADES.includes(g)) || new Set(tiers).size !== tiers.length) {
    fail('rewards.json: "crafting.tiers" must list distinct grades, lowest first');
  }
  if (!Array.isArray(crafting.pool) || crafting.pool.length === 0) fail('rewards.json: "crafting.pool" must list collections');
  for (const id of crafting.pool) {
    if (!byId[id]) fail(`rewards.json: crafting.pool "${id}" is not a collection`);
    if (!tiers.includes(byId[id].config.grade)) fail(`rewards.json: crafting.pool "${id}" has a grade outside crafting.tiers`);
  }
  // Children come from the pool (or the baby collection), so every grade an egg can hold needs a hatch time.
  for (const g of Object.keys(breeding.hatchMinutes)) {
    if (!tiers.includes(g)) fail(`rewards.json: breeding grade "${g}" must be in crafting.tiers`);
  }
  const eggGrades = crafting.pool.map((id) => byId[id].config.grade);
  if (breeding.baby) {
    const baby = byId[breeding.baby.collection];
    if (!baby || baby.config.base) fail('rewards.json: "breeding.baby.collection" must be a non-base collection');
    if (!(breeding.baby.rate > 0 && breeding.baby.rate < 1)) fail('rewards.json: "breeding.baby.rate" must be between 0 and 1');
    eggGrades.push(baby.config.grade);
  }
  for (const g of eggGrades) if (!breeding.hatchMinutes[g]) fail(`rewards.json: breeding.hatchMinutes needs "${g}"`);

  for (const [from, to] of Object.entries(evolution?.paths ?? {})) {
    if (!byId[from] || !byId[to] || byId[to].config.base) fail(`rewards.json: evolution path ${from} -> ${to} is not valid`);
    const missing = byId[from].keys.filter((key) => !byId[to].keys.includes(key));
    if (missing.length) fail(`rewards.json: evolving ${from} -> ${to} needs ${to}/characters/${missing.join(', ')}.png`);
    const g = byId[from].config.grade;
    if (!isPositive(evolution.steps?.[g]) || !Number.isInteger(evolution.coins?.[g]) || evolution.coins[g] < 0) {
      fail(`rewards.json: evolution.steps and evolution.coins need "${g}"`);
    }
  }
  for (const [g, { coins, success }] of Object.entries(fusion ?? {})) {
    const next = tiers[tiers.indexOf(g) + 1];
    if (!tiers.includes(g) || !crafting.pool.some((id) => byId[id].config.grade === next)) {
      fail(`rewards.json: fusion "${g}" needs a higher tier in crafting.pool`);
    }
    if (!Number.isInteger(coins) || coins < 0 || !(success > 0 && success <= 1)) fail(`rewards.json: fusion "${g}" needs coins and success`);
  }
  if (!(Number.isInteger(recycle?.count) && recycle.count >= 2 && recycle.count <= 10)) {
    fail('rewards.json: "recycle.count" must be 2 to 10');
  }
  if (![recycle.upgrade?.base, recycle.upgrade?.perHigher, recycle.upgrade?.decay].every(isProbability)) {
    fail('rewards.json: "recycle.upgrade" needs base, perHigher and decay between 0 and 1');
  }
  if (!isProbability(breeding.sameTier) || !(breeding.lowerRatio > 0)) {
    fail('rewards.json: "breeding" needs sameTier between 0 and 1 and a positive lowerRatio');
  }
}

/** Reward amounts for one grade: the grade's overrides on top of "default". */
const rewardFor = (section, grade) => ({ ...section.default, ...section[grade] });

function readCollections() {
  const folders = fs
    .readdirSync(GACHA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const collections = folders.map((folder) => {
    const dir = path.join(GACHA_DIR, folder);
    const configPath = path.join(dir, 'collection.json');
    if (!ID_PATTERN.test(folder)) fail(`folder "${folder}" must use only a-z, 0-9 and _`);
    if (!fs.existsSync(configPath)) fail(`${folder}/collection.json is missing`);
    const config = readJson(configPath, `${folder}/collection.json`);

    const charactersDir = path.join(dir, 'characters');
    const keys = fs.existsSync(charactersDir)
      ? fs
          .readdirSync(charactersDir)
          .filter((file) => file.toLowerCase().endsWith('.png'))
          .map((file) => path.basename(file, path.extname(file)))
          .sort()
      : [];
    if (keys.length === 0) fail(`${folder}/characters has no .png files`);
    for (const key of keys) if (!ID_PATTERN.test(key)) fail(`${folder}/characters/${key}.png: use only a-z, 0-9 and _`);
    const noThumb = keys.filter((key) => !fs.existsSync(path.join(dir, 'thumbs', `${key}.png`)));
    if (noThumb.length) fail(`${folder}/thumbs is missing ${noThumb.join(', ')}: run node scripts/optimize-images.js`);

    const { banner, hidden } = config;
    const isRate = (rate) => rate > 0 && rate < 1;
    if (!config.name) fail(`${folder}: "name" is required`);
    if (!GRADES.includes(config.grade)) fail(`${folder}: "grade" must be one of ${GRADES.join(', ')}`);
    if (config.base && !banner) fail(`${folder}: the base collection needs a "banner"`);
    if (hidden) {
      if (config.base || banner) fail(`${folder}: a "hidden" collection can't be "base" or have its own "banner"`);
      if (Object.keys(hidden).length === 0 || !Object.values(hidden).every(isRate)) {
        fail(`${folder}: "hidden" must map banner ids to rates between 0 and 1`);
      }
    }
    if (banner) {
      if (!banner.title || !banner.cost?.['1'] || !banner.cost?.['10']) {
        fail(`${folder}: "banner.title" and "banner.cost" { "1": n, "10": n } are required`);
      }
      if ((banner.fallback ?? (config.base ? folder : null)) !== folder && !(banner.rate > 0 && banner.rate <= 1)) fail(`${folder}: "banner.rate" must be between 0 and 1`);
      if (banner.hero && !keys.includes(banner.hero)) fail(`${folder}: banner.hero "${banner.hero}" has no image`);
      if (banner.mix && !Object.values(banner.mix).every(isRate)) fail(`${folder}: "banner.mix" rates must be between 0 and 1`);
    }

    return {
      id: folder,
      config,
      keys,
      poster: POSTER_FILES.find((file) => fs.existsSync(path.join(dir, file))) ?? null,
      order: config.order ?? 100,
    };
  });

  const bases = collections.filter((c) => c.config.base);
  if (bases.length !== 1) fail(`exactly one collection needs "base": true (found ${bases.length})`);

  collections.sort((a, b) => Number(!!b.config.base) - Number(!!a.config.base) || a.order - b.order || a.id.localeCompare(b.id));

  const base = collections[0];
  for (const collection of collections) {
    const fallbackId = collection.config.banner?.fallback ?? base.id;
    const fallback = collections.find((c) => c.id === fallbackId);
    if (collection.config.banner && (!fallback || fallback.config.hidden)) {
      fail(`${collection.id}: banner.fallback "${fallbackId}" must be a non-hidden collection`);
    }
    for (const host of Object.keys(collection.config.hidden ?? {})) {
      if (!collections.some((c) => c.id === host && c.config.banner)) {
        fail(`${collection.id}: hidden banner "${host}" is not a collection with a banner`);
      }
    }
    for (const id of Object.keys(collection.config.banner?.mix ?? {})) {
      const mixed = collections.find((c) => c.id === id);
      if (!mixed || mixed === fallback || mixed === collection || mixed.config.hidden) {
        fail(`${collection.id}: banner.mix "${id}" must be another non-fallback, non-hidden collection`);
      }
    }
  }
  // Each banner's fallback gets the remainder. Existing banners default to the original zodiac base.
  for (const collection of collections) {
    const { banner } = collection.config;
    if (!banner) continue;
    const fallbackId = banner.fallback ?? base.id;
    const extra = [
      ...(collection.id === fallbackId ? [] : [{ collection: collection.id, rate: banner.rate, hidden: false }]),
      ...Object.entries(banner.mix ?? {}).map(([id, rate]) => ({ collection: id, rate, hidden: false })),
      ...collections
        .filter((c) => c.config.hidden?.[collection.id])
        .map((c) => ({ collection: c.id, rate: c.config.hidden[collection.id], hidden: true })),
    ];
    const baseRate = Math.round((1 - extra.reduce((sum, r) => sum + r.rate, 0)) * 1e6) / 1e6;
    if (baseRate <= 0) fail(`${collection.id}: banner rates leave nothing for the fallback collection`);
    collection.rates = [{ collection: fallbackId, rate: baseRate, hidden: false }, ...extra];
  }
  // Characters follow the order of the base collection's "names", then alphabetical.
  const baseOrder = Object.keys(base.config.names ?? {});
  const rank = (key) => (baseOrder.includes(key) ? baseOrder.indexOf(key) : Infinity);
  for (const collection of collections) {
    const { names = {}, namePrefix = '' } = collection.config;
    collection.keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    collection.characters = collection.keys.map((key) => ({
      key,
      // Base collection ids stay unprefixed so existing saves keep working.
      id: collection === base ? key : `${collection.id}_${key}`,
      name: names[key] ?? `${namePrefix}${base.config.names?.[key] ?? key}`,
    }));
  }
  // Preserve original banners, costs and artwork. Evolution keeps separate IDs.
  const labels = { N:'노말', R:'레어', EP:'에픽', U:'유니크', L:'레전더리' };
  const grades = ['N','R','EP','U','L'];
  for (const c of collections) c.config.acquisition=c.id==='baby'?'breeding':["rare","epic","unique","legendary","cats_rare","cats_epic","cats_unique","cats_legendary"].includes(c.id)?'evolution':'draw';
  // Pause seasonal/cat banners; only original normal and premium animals are drawn.
  for (const c of collections) if(c.config.banner) {
    c.config.banner.enabled=['normal','premium'].includes(c.id);
    c.rates=c.id==='premium'?[{collection:'normal',rate:0.92,hidden:false},{collection:'premium',rate:0.08,hidden:false}]:[{collection:'normal',rate:1,hidden:false}];
  }
  for (const family of ['', 'cats_']) {
    for (const [index, suffix] of ['rare','epic','unique','legendary'].entries()) {
      const source=collections.find(c=>c.id===(family ? 'cats_'+suffix : suffix));
      const id='evolution_'+family+suffix;
      collections.push({ ...source,id,assetCollection:source.id,poster:null,rates:undefined,
        config:{name:labels[grades[index+1]]+' 진화',grade:grades[index+1],acquisition:'evolution'},
        characters:source.characters.map(ch=>({...ch,id:id+'_'+ch.key,name:'진화한 '+ch.name})),
      });
    }
  }
  return collections;
}

const q = (value) => JSON.stringify(value);

function renderTs(collections, rewards) {
  const body = collections
    .map((c) => {
      const { config } = c;
      const banner = config.banner;
      const characters = c.characters
        .map(
          (ch) =>
            `      { id: ${q(ch.id)}, name: ${q(ch.name)}, species: ${q(ch.key)}, image: ${q(require('./prepare-remote-gacha.cjs').remoteImage(c.assetCollection ?? c.id, 'characters', `${ch.key}.png`))}, thumb: ${q(require('./prepare-remote-gacha.cjs').remoteImage(c.assetCollection ?? c.id, 'thumbs', `${ch.key}.png`))} },`,
        )
        .join('\n');
      const hero = banner?.hero ?? c.keys[0];
      const bannerTs = banner
        ? `{
      enabled: ${banner.enabled !== false},
      title: ${q(banner.title)},
      tagline: ${q(banner.tagline ?? '')},
      cost: { 1: ${banner.cost['1']}, 10: ${banner.cost['10']} },
      rates: ${q(c.rates)},
      hero: ${q(c.characters.find((ch) => ch.key === hero).id)},
      colors: ${q({ background: '#FFE4D2', accent: '#FF5A1F', text: '#3A1A0A', ...banner.colors })},
      poster: ${c.poster ? q(require('./prepare-remote-gacha.cjs').remoteImage(c.posterCollection ?? c.id, c.poster)) : 'null'},
    }`
        : 'null';
      return `  {
    id: ${q(c.id)},
    name: ${q(config.name)},
    grade: ${q(config.grade)},
    acquisition: ${q(config.acquisition)},
    base: ${!!config.base},
    banner: ${bannerTs},
    hidden: ${!!config.hidden},
    characters: [
${characters}
    ],
  },`;
    })
    .join('\n');

  return `// Generated by scripts/generate-gacha.js from assets/gacha. Do not edit by hand.
import type { CollectionData, Rewards } from './gacha-types';

export type CollectionId = string;

export type CharacterId = string;

export const COLLECTION_DATA: CollectionData<CollectionId, CharacterId>[] = [
${body}
];

export const REWARDS: Rewards = ${JSON.stringify(rewards, null, 2)};

/** Nicknames firestore.rules accepts. */
export const NICKNAME_PATTERN = new RegExp(${q(NICKNAME_PATTERN)});

/** The animal for a lunar year is ZODIAC[(year - 4) % 12]; new players get theirs as a starter. */
export const ZODIAC: CharacterId[] = ${q(ZODIAC)};

/** Birthdays from SEOLLAL_FIRST_YEAR on; SEOLLAL[year - SEOLLAL_FIRST_YEAR] is that year's Seollal as MMDD. */
export const SEOLLAL_FIRST_YEAR = ${FIRST_YEAR};
export const SEOLLAL_LAST_YEAR = ${LAST_YEAR};
export const SEOLLAL = ${q(seollalTable())}.split(',');
`;
}

function renderRules(collections, rewards) {
  const conditions = collections.map(c => `id == '${c.id}' ? (${c.characters.map(ch => `chars.get('${ch.id}', 0) > 0`).join(' && ')})`).join(' : ') + ' : false';
  const rankingMedals = ['steps', 'hatchCount', 'evolveCount', 'fuseCount', 'recycleCount'].map(key => `ranking:${key}`)
    .concat([...new Set(collections.map(c => c.config.grade))].map(grade => `ranking:grade:${grade}`));
  const extra = fs.readFileSync(path.join(__dirname, 'bond-medals.rules'), 'utf8')
    .replace('__MEDAL_COLLECTION_CONDITIONS__', conditions).replace('__RANKING_MEDAL_IDS__', JSON.stringify(rankingMedals));
  const friends = fs.readFileSync(path.join(__dirname, 'friends.rules'), 'utf8');
  const walking = fs.readFileSync(path.join(__dirname, 'walking.rules'), 'utf8');
  const catalog = fs.readFileSync(path.join(__dirname, 'catalog.rules'), 'utf8');
  const arena = fs.readFileSync(path.join(__dirname, 'arena.rules'), 'utf8');
  const auction = fs.readFileSync(path.join(__dirname, 'auction.rules'), 'utf8')
    .replaceAll('__AUCTION_QUOTE__', JSON.stringify(rewards.auction.quote))
    .replaceAll('__AUCTION_FLOOR__', JSON.stringify(rewards.auction.floor))
    .replaceAll('__AUCTION_CEIL__', JSON.stringify(rewards.auction.ceil))
    .replaceAll('__AUCTION_LOW__', String(rewards.auction.low))
    .replaceAll('__AUCTION_HIGH__', String(rewards.auction.high))
    .replaceAll('__AUCTION_WINDOW_MS__', String(rewards.auction.windowHours * 3600000));
  return renderBaseRules(collections, rewards).replace('    match /users/{uid} {', () => extra + '\n' + friends + '\n' + walking + '\n' + catalog + '\n' + arena + '\n' + auction + '\n    match /users/{uid} {');
}

function renderBaseRules(collections, rewards) {
  const base = collections[0];
  const idsOf = (list) => list.flatMap((c) => c.characters.map((ch) => ch.id));
  const inline = (values) => `[${values.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ')}]`;
  // A regex is one string literal, while a list literal costs an expression per element.
  const regexOf = (list) =>
    list.map((c) => (c === base ? `^(${c.keys.join('|')})$` : `^${c.id}_(${c.keys.join('|')})$`)).join('|');
  // Matches a comma-joined list of ids from these collections.
  const listRegexOf = (list) => {
    const id = `(?:${list.map((c) => (c === base ? `(?:${c.keys.join('|')})` : `${c.id}_(?:${c.keys.join('|')})`)).join('|')})`;
    return `^${id}(?:,${id})*$`;
  };
  const chain = (branches, fallback, indent = '      ') =>
    branches.map(([cond, value]) => `${cond} ? ${value}\n${indent}: `).join('') + fallback;

  const { character, grade, drawCount } = rewards;
  const grades = GRADES.filter((g) => collections.some((c) => c.config.grade === g));
  const ofGrade = (g) => collections.filter((c) => c.config.grade === g);
  const charAmount = (field) => {
    const special = grades.filter((g) => rewardFor(character, g)[field] !== character.default[field]);
    return chain(
      special.map((g) => [`gradeOf(c) == '${g}'`, rewardFor(character, g)[field]]),
      character.default[field],
      '        ',
    );
  };

  const { crafting, breeding, evolution, fusion, recycle } = rewards;
  const byId = Object.fromEntries(collections.map((c) => [c.id, c]));
  const prefixOf = (c) => (c === base ? '' : `${c.id}_`);
  const tierChain = (list) =>
    chain(
      crafting.tiers
        .map((g, i) => [list.filter((c) => c.config.grade === g), i + 1])
        .filter(([ofTier]) => ofTier.length > 0)
        .map(([ofTier, tier]) => [`c.matches('${regexOf(ofTier)}')`, tier]),
      '0',
    );
  const baby = breeding.baby ? byId[breeding.baby.collection] : null;
  const gradeChain = (amounts) =>
    chain(
      Object.entries(amounts).map(([g, n]) => [`g == '${g}'`, n]),
      '-1',
    );
  const recycleSlots = Array.from({ length: recycle.count }, (_, i) => `recycled(a, b, inputs, out, allowed, ${i}, before.get('avatar', null))`);
  // Recycling inputs only have to be in a crafting tier: one regex, so each of the ten slots costs a single match.
  const recycleInputs = regexOf(collections.filter((c) => crafting.tiers.includes(c.config.grade)));

  const bannerCollections = collections.filter((c) => c.config.banner && c.config.banner.enabled !== false);
  const banners = bannerCollections
    .map((c) => {
      const { cost } = c.config.banner;
      const ticketable = cost['1'] <= rewards.ticketMaxCost;
      const pool = listRegexOf(c.rates.map((r) => byId[r.collection]));
      return `(banner == '${c.id}' && pay(draws, cost, ${cost['1']}, ${cost['10']}, ${ticketable})
        && picks.join(',').matches('${pool}'))`;
    })
    .join('\n      || ');
  const slots = Array.from({ length: 10 }, (_, i) => `slot(a, b, picks, ${i})`);
  const gradeGains = grades.map((g) => `(ag.get('${g}', 0) - bg.get('${g}', 0))`);

  return `rules_version = '2';

// Generated by scripts/generate-gacha.js from assets/gacha. Do not edit by hand.
// Paste into Firebase console > Firestore Database > Rules, then Publish.
service cloud.firestore {
  match /databases/{database}/documents {
${fs.readFileSync(path.join(ROOT, 'scripts/session.rules'), 'utf8').trimEnd()}
${fs.readFileSync(path.join(ROOT, 'scripts/community.rules'), 'utf8').trimEnd()}
    match /users/{uid} {
      // Get is open so a buyer can pay the seller in the same auction transaction.
      allow get: if isSignedIn();
      allow list: if isOwner(uid);
      allow create: if isOwner(uid) && isNewProfile();
      allow update: if (isOwner(uid) && isProfileUpdate(uid)) || isAuctionSell(uid) || isAuctionFilled(uid);
      // Leaving: the profile goes first, then its history (see isGone).
      allow delete: if isOwner(uid);
    }

    // The breeding nest: at most three eggs, one per slot. An egg only goes away by hatching.
    match /users/{uid}/eggs/{slot} {
      allow read: if isOwner(uid);
      allow create: if isOwner(uid) && slot in ['0', '1', '2'] && isEgg(uid);
      allow delete: if isOwner(uid)
        && (getAfter(/databases/$(database)/documents/users/$(uid)).data.get('lastHatch', '') == slot || isGone(uid));
    }

    // Steps walked with each character as the map avatar; evolving spends them.
    match /companions/{uid} {
      allow read: if isOwner(uid);
      allow create, update: if isOwner(uid) && (isCompanionSteps(uid) || isEvolveSpend(uid));
      allow delete: if isOwner(uid);
    }

    // Route each operation by its changed counter before evaluating expensive inventory rules.
    function isProfileUpdate(uid) {
      let changed = request.resource.data.diff(resource.data).affectedKeys();
      return (changed.hasAny(['drawCount']) && isLegalDraw())
        || (changed.hasAny(['lastArenaReward']) && validArenaClaim(uid, request.resource.data.lastArenaReward))
        || (changed.hasAny(['lastClaim']) && isClaim(uid))
        || (changed.hasAny(['steps']) && isStepReward())
        || (changed.hasAny(['hatchCount']) && isHatch(uid))
        || (changed.hasAny(['username']) && isUsernameChange())
        || (changed.hasAny(['nickname']) && isNicknameChange())
        || (changed.hasAny(['fuseCount']) && isFuse())
        || (changed.hasAny(['recycleCount']) && isRecycle())
        || (changed.hasAny(['evolveCount']) && isEvolve(uid))
        || (changed.hasOnly(['avatar']) && isAvatarChange())
        || (changed.hasAny(['lastAuction']) && isAuctionProfile(uid))
        || (changed.hasAny(['characters']) && isSale());
    }

    function isSale() {
      let before = resource.data;
      let after = request.resource.data;
      let sale = after.lastSale;
      let c = sale.character;
      let n = sale.quantity;
      let prices = ${JSON.stringify(rewards.sale)};
      let price = prices.get(gradeOf(c), -1);
      let remaining = before.characters.get(c, 0) - n;
      return after.diff(before).affectedKeys().hasOnly(['characters', 'coins', 'lastSale'])
        && sale.keys().hasOnly(['character', 'quantity'])
        && c is string && n is int && n > 0 && price >= 0
        && remaining >= (before.get('avatar', null) == c ? 1 : 0)
        && after.characters.diff(before.characters).affectedKeys().hasOnly([c])
        && after.characters.get(c, 0) == remaining
        && after.coins == before.coins + price * n;
    }

    // Crafting writes lastCraft { inputs, output } with its counter. Odds are rolled on the phone, so these
    // only check that the outcome is possible.

    // Fusion: any two characters of one grade plus that grade's coins become a pool animal one tier up, or
    // nothing on failure.
    function isFuse() {
      let before = resource.data;
      let after = request.resource.data;
      let craft = after.lastCraft;
      let c = craft.inputs[0];
      let d = craft.inputs[1];
      let a = after.characters;
      let b = before.characters;
      let fee = fusionCoins(gradeOf(c));
      return after.diff(before).affectedKeys().hasOnly(['characters', 'coins', 'fuseCount', 'lastCraft'])
        && after.get('fuseCount', 0) == before.get('fuseCount', 0) + 1
        && craft.keys().hasOnly(['inputs', 'output']) && craft.inputs == [c, d]
        && gradeOf(c) == gradeOf(d)
        && fee >= 0 && before.coins - after.coins == fee && after.coins >= 0
        && (c == d
          ? a.get(c, 0) == b.get(c, 0) - 2
          : a.get(c, 0) == b.get(c, 0) - 1 && a.get(d, 0) == b.get(d, 0) - 1)
        && a.get(c, 0) >= 0 && a.get(d, 0) >= 0
        && a.get(c, 0) >= (before.get('avatar', null) == c ? 1 : 0)
        && a.get(d, 0) >= (before.get('avatar', null) == d ? 1 : 0)
        && (craft.output == null
          ? a.diff(b).affectedKeys().hasOnly([c, d])
          : poolTier(craft.output) == tierOf(c) + 1
            && a.diff(b).affectedKeys().hasOnly([c, d, craft.output])
            && a.get(craft.output, 0) == b.get(craft.output, 0) + 1);
    }

    // Recycling: ${recycle.count} characters from the crafting tiers become one pool animal of any tier (higher tiers
    // are rarer the further they are above the lowest input, down to tiny chances).
    function isRecycle() {
      let before = resource.data;
      let after = request.resource.data;
      let inputs = after.lastCraft.inputs;
      let out = after.lastCraft.output;
      let a = after.characters;
      let b = before.characters;
      let t = poolTier(out);
      let allowed = '${recycleInputs}';
      return after.diff(before).affectedKeys().hasOnly(['characters', 'recycleCount', 'lastCraft'])
        && after.get('recycleCount', 0) == before.get('recycleCount', 0) + 1
        && after.lastCraft.keys().hasOnly(['inputs', 'output'])
        && inputs is list && inputs.size() == ${recycle.count} && out is string && t > 0
        && a.diff(b).affectedKeys().hasOnly(inputs.concat([out]))
        && a.get(out, 0) - b.get(out, 0) == 1 - (${recycle.count} - inputs.removeAll([out]).size())
        && ${recycleSlots.join('\n        && ')};
    }

    function recycled(a, b, inputs, out, allowed, i, avatar) {
      let c = inputs[i];
      let spent = ${recycle.count} - inputs.removeAll([c]).size();
      return c.matches(allowed) && a.get(c, 0) >= 0
        && b.get(c, 0) - spent >= (avatar == c ? 1 : 0)
        && (c == out || a.get(c, 0) - b.get(c, 0) == -spent);
    }

    // Evolution: one character becomes the same animal in the next collection, paid with coins and the
    // steps walked with it (spent from companions in the same write). The avatar may follow it.
    function isEvolve(uid) {
      let before = resource.data;
      let after = request.resource.data;
      let c = after.lastCraft.inputs[0];
      let out = evolveTarget(c);
      let a = after.characters;
      let b = before.characters;
      let need = evolveSteps(gradeOf(c));
      let path = /databases/$(database)/documents/companions/$(uid);
      return after.diff(before).affectedKeys().hasOnly(['characters', 'coins', 'evolveCount', 'lastCraft', 'avatar'])
        && after.get('evolveCount', 0) == before.get('evolveCount', 0) + 1
        && after.lastCraft == { 'inputs': [c], 'output': out }
        && out != '' && need > 0
        && before.coins - after.coins == evolveCoins(gradeOf(c)) && after.coins >= 0
        && a.diff(b).affectedKeys().hasOnly([c, out])
        && a.get(c, 0) == b.get(c, 0) - 1 && a.get(c, 0) >= 0
        && a.get(out, 0) == b.get(out, 0) + 1
        && (after.get('avatar', null) == before.get('avatar', null) || after.avatar == out)
        && get(path).data.steps.get(c, 0) >= need
        && getAfter(path).data.steps.get(c, 0) == get(path).data.steps.get(c, 0) - need;
    }

    function isEvolveSpend(uid) {
      let path = /databases/$(database)/documents/users/$(uid);
      let c = getAfter(path).data.lastCraft.inputs[0];
      let before = resource.data.steps;
      let after = request.resource.data.steps;
      return getAfter(path).data.get('evolveCount', 0) == get(path).data.get('evolveCount', 0) + 1
        && request.resource.data.keys().hasOnly(['steps'])
        && after.diff(before).affectedKeys().hasOnly([c])
        && after.get(c, 0) == before.get(c, 0) - evolveSteps(gradeOf(c));
    }

    // Public leaderboard entry, a copy of the player's profile numbers; any signed-in player can read it.
    match /rankings/{uid} {
      allow read: if isSignedIn();
      allow create, update: if isOwner(uid) && isRanking(uid);
      allow delete: if isOwner(uid);
    }

    function isRanking(uid) {
      let user = get(/databases/$(database)/documents/users/$(uid)).data;
      let d = request.resource.data;
      let counts = ['hatchCount', 'evolveCount', 'fuseCount', 'recycleCount'];
      let fields = ['username', 'avatar', 'steps', 'characters', 'updatedAt'].concat(counts);
      return d.keys().hasOnly(fields.concat(['nickname'])) && d.keys().hasAll(fields)
        && d.username == user.username
        && d.get('nickname', null) == user.get('nickname', null)
        && d.avatar == user.get('avatar', null)
        && d.steps == user.get('steps', 0)
        && d.characters == user.characters
        && d.hatchCount == user.get('hatchCount', 0)
        && d.evolveCount == user.get('evolveCount', 0)
        && d.fuseCount == user.get('fuseCount', 0)
        && d.recycleCount == user.get('recycleCount', 0)
        && d.updatedAt == request.time;
    }

    // History may only be cleared once its profile is deleted, so claims can't be wiped and claimed again.
    function isGone(uid) {
      return !existsAfter(/databases/$(database)/documents/users/$(uid));
    }

    // Laying an egg is free and keeps both parents. Only grades with a hatch time in rewards.json can breed.
    function isEgg(uid) {
      let user = get(/databases/$(database)/documents/users/$(uid)).data;
      let egg = request.resource.data;
      let p = egg.parents;
      let fields = ['parents', 'child', 'grade', 'createdAt'];
      return egg.keys().hasOnly(fields) && egg.keys().hasAll(fields)
        && p is list && p.size() == 2 && p[0] is string && p[1] is string
        && user.characters.get(p[0], 0) > 0
        && user.characters.get(p[1], 0) > (p[0] == p[1] ? 1 : 0)
        && hatchMinutes(gradeOf(p[0])) > 0 && hatchMinutes(gradeOf(p[1])) > 0
        && (isBaby(egg.child, p) || isPoolChild(egg.child, p))
        && egg.grade == gradeOf(egg.child)
        && egg.createdAt == request.time;
    }

    // Hatching adds the child and deletes its egg. Before hatchMinutes have passed it costs
    // ${rewards.breeding.coinsPerMinute} coin(s) per minute left; one extra minute is allowed for clock drift.
    function isHatch(uid) {
      let before = resource.data;
      let after = request.resource.data;
      let path = /databases/$(database)/documents/users/$(uid)/eggs/$(after.lastHatch);
      let egg = get(path).data;
      let left = (egg.createdAt + duration.value(hatchMinutes(egg.grade), 'm') - request.time).seconds();
      let cost = left > 0 ? math.ceil(left / 60.0) * ${rewards.breeding.coinsPerMinute} : 0;
      let paid = before.coins - after.coins;
      return after.diff(before).affectedKeys().hasOnly(['characters', 'coins', 'lastHatch', 'hatchCount'])
        && after.lastHatch in ['0', '1', '2']
        && after.hatchCount == before.get('hatchCount', 0) + 1
        && !existsAfter(path)
        && after.characters.diff(before.characters).affectedKeys().hasOnly([egg.child])
        && after.characters.get(egg.child, 0) == before.characters.get(egg.child, 0) + 1
        && after.coins >= 0
        && paid >= cost && paid <= cost + ${rewards.breeding.coinsPerMinute};
    }

    // Only the current avatar's count may grow. Steps come from the phone, so amounts can't be verified.
    function isCompanionSteps(uid) {
      let avatar = get(/databases/$(database)/documents/users/$(uid)).data.get('avatar', null);
      let before = request.method == 'create' ? {} : resource.data.steps;
      let after = request.resource.data;
      return after.keys().hasOnly(['steps'])
        && avatar is string
        && after.steps.diff(before).affectedKeys().hasOnly([avatar])
        && after.steps[avatar] is int && after.steps[avatar] > before.get(avatar, 0);
    }

    // Where each player is on the map; any signed-in player can see everyone who shares.
    match /locations/{uid} {
      allow get: if isSignedIn() && (resource == null || request.auth.uid == uid || resource.data.get('audience', 'public') == 'public' || areFriends(request.auth.uid, uid));
      allow list: if isSignedIn() && resource.data.audience == 'public';
      allow create, update: if isOwner(uid) && isLocation(uid) && mayShareLocation(uid);
      allow delete: if isOwner(uid);
    }

    // Write-once history: users/{uid}/draws/{drawCount after the draw}, saved alongside each draw.
    match /users/{uid}/draws/{drawId} {
      allow read: if isOwner(uid);
      allow create: if isOwner(uid) && isDrawLog(uid, drawId);
      allow delete: if isOwner(uid) && isGone(uid);
    }

    // Write-once achievement claims: users/{uid}/claims/{achievement id}, saved alongside the tickets.
    match /users/{uid}/claims/{claimId} {
      allow read: if isOwner(uid);
      allow create: if isOwner(uid) && isClaimLog(uid, claimId);
      allow delete: if isOwner(uid) && isGone(uid);
    }

    function isDrawLog(uid, drawId) {
      let user = getAfter(/databases/$(database)/documents/users/$(uid)).data;
      let log = request.resource.data;
      return drawId == string(user.drawCount)
        && log.keys().hasOnly(['banner', 'picks', 'coins', 'tickets', 'rewards', 'createdAt'])
        && log.banner == user.lastBanner
        && log.picks == user.lastDraw
        && log.createdAt == request.time;
    }

    // Claiming an achievement adds its tickets once; the claim document makes it permanent.
    function isClaim(uid) {
      let before = resource.data;
      let after = request.resource.data;
      let id = after.lastClaim;
      let reward = claimReward(id.split(':'), before);
      return after.diff(before).affectedKeys().hasOnly(['tickets', 'lastClaim'])
        && id is string
        && !exists(/databases/$(database)/documents/users/$(uid)/claims/$(id))
        && existsAfter(/databases/$(database)/documents/users/$(uid)/claims/$(id))
        && reward > 0
        && after.tickets == before.get('tickets', 0) + reward;
    }

    function isClaimLog(uid, claimId) {
      let user = getAfter(/databases/$(database)/documents/users/$(uid)).data;
      let log = request.resource.data;
      return user.lastClaim == claimId
        && log.keys().hasOnly(['tickets', 'label', 'createdAt'])
        && log.tickets == user.tickets - get(/databases/$(database)/documents/users/$(uid)).data.get('tickets', 0)
        && log.createdAt == request.time;
    }

    // The name and face shown on the map must match the player's profile.
    function isLocation(uid) {
      let user = get(/databases/$(database)/documents/users/$(uid)).data;
      let d = request.resource.data;
      let fields = ['username', 'avatar', 'lat', 'lng', 'updatedAt'];
      return d.keys().hasOnly(fields.concat(['nickname', 'audience'])) && d.keys().hasAll(fields)
        && d.get('audience', 'public') in ['public', 'friends']
        && d.username == user.username
        && d.get('nickname', null) == user.get('nickname', null)
        && d.avatar == user.get('avatar', null)
        && d.lat is number && d.lat >= -90 && d.lat <= 90
        && d.lng is number && d.lng >= -180 && d.lng <= 180
        && d.updatedAt == request.time;
    }

  // First sign-in: exactly 100 coins, username tied to the account's email. With a birthday
  // (YYYY-MM-DD) the player starts with one of their birth year's zodiac animal, otherwise nothing.
  function isNewProfile() {
    let data = request.resource.data;
    let fields = ['username', 'coins', 'characters', 'drawCount', 'createdAt'];
    return data.keys().hasOnly(fields.concat(['birthday', 'nickname'])) && data.keys().hasAll(fields)
      && (!data.keys().hasAny(['nickname']) || isNickname(data.nickname))
      && data.username is string
      && data.username.matches('^[a-z0-9_]{4,20}$')
      && request.auth.token.email == data.username + '@users.animalsrun.local'
      && data.coins == 100
      && (data.keys().hasAny(['birthday']) ? isStarter(data.characters, data.birthday) : data.characters == {})
      && data.drawCount == 0
      && data.createdAt == request.time;
  }

  function isStarter(characters, birthday) {
    return birthday is string
      && birthday.matches('^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$')
      && int(birthday.split('-')[0]) <= request.time.year()
      && characters == zodiacStarter(${inline(ZODIAC)}[(zodiacYear(birthday.split('-')) - 4) % 12]);
  }

  // Born before that year's Seollal (MMDD per year from ${FIRST_YEAR}) means the previous zodiac year.
  function zodiacYear(ymd) {
    let year = int(ymd[0]);
    let seollal = '${seollalTable()}'.split(',')[year - ${FIRST_YEAR}];
    return int(ymd[1] + ymd[2]) < int(seollal) ? year - 1 : year;
  }

  function zodiacStarter(id) {
    return ${chain(ZODIAC.map((id) => [`id == '${id}'`, `{ '${id}': 1 }`]), '{}', '      ')};
  }

  // Walking: steps is the running total of counted steps, and every ${rewards.stepsPerCoin} of them is one coin.
  // Step counts come from the phone, so they can't be verified here.
  function isStepReward() {
    let before = resource.data;
    let after = request.resource.data;
    let steps = before.get('steps', 0);
    return after.diff(before).affectedKeys().hasOnly(['coins', 'steps'])
      && after.steps is int && after.steps > steps
      && after.coins == before.coins
        + math.floor(after.steps / ${rewards.stepsPerCoin}) - math.floor(steps / ${rewards.stepsPerCoin});
  }

  // The map avatar is one of the player's own characters, or null for none.
  function isAvatarChange() {
    let after = request.resource.data;
    return after.diff(resource.data).affectedKeys().hasOnly(['avatar'])
      && (after.avatar == null || (after.avatar is string && resource.data.characters.get(after.avatar, 0) > 0));
  }

  // A new id follows the account's email, which Firebase Auth keeps unique.
  function isUsernameChange() {
    let after = request.resource.data;
    return after.diff(resource.data).affectedKeys().hasOnly(['username'])
      && after.username is string
      && after.username.matches('^[a-z0-9_]{4,20}$')
      && request.auth.token.email == after.username + '@users.animalsrun.local';
  }

  // The name shown to other players; unlike the id it needn't be unique.
  function isNicknameChange() {
    return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nickname'])
      && isNickname(request.resource.data.nickname);
  }

  function isNickname(n) {
    return n is string && n.matches('${NICKNAME_PATTERN}');
  }

  function gradeOf(c) {
    return ${chain(grades.map((g) => [`c.matches('${regexOf(ofGrade(g))}')`, `'${g}'`]), "(exists(/databases/$(database)/documents/gachaCharacters/$(c)) ? get(/databases/$(database)/documents/gachaCharacters/$(c)).data.grade : '')", '      ')};
  }

  function hatchMinutes(g) {
    return ${chain(
      Object.entries(rewards.breeding.hatchMinutes).map(([g, minutes]) => [`g == '${g}'`, minutes]),
      '-1',
      '      ',
    )};
  }

  // Crafting tier (position in rewards.json crafting.tiers, from 1) of any character, or 0 outside the tiers.
  function tierOf(c) {
    return ${tierChain(collections)};
  }

  // The same, for animals crafting can produce (crafting.pool).
  function poolTier(c) {
    return ${tierChain(crafting.pool.map((id) => byId[id]).filter(c=>c.config.acquisition!=='evolution'))};
  }

  // The animal behind an id, e.g. 'tiger' for 'sea_tiger'.
  function speciesOf(c) {
    return c.replace('^(${collections.filter((c) => c !== base).map((c) => c.id).sort((a, b) => b.length - a.length).join('|')})_', '');
  }

  // ${baby ? `${Math.round(breeding.baby.rate * 100)}% of eggs hold the ${baby.id} version of a parent's animal.` : 'No baby collection.'}
  function isBaby(child, p) {
    return ${
      baby
        ? `child.matches('${regexOf([baby])}')
      && (child == '${prefixOf(baby)}' + speciesOf(p[0]) || child == '${prefixOf(baby)}' + speciesOf(p[1]))`
        : 'false'
    };
  }

  // Otherwise a pool animal no higher than one of the parents (picked at random on the phone).
  function isPoolChild(child, p) {
    let t = poolTier(child);
    return t > 0 && (t <= tierOf(p[0]) || t <= tierOf(p[1]));
  }

  function evolveTarget(c) {
    return ${chain(
      Object.entries(evolution.paths ?? {}).map(([from, to]) => [
        `c.matches('${regexOf([byId[from]])}')`,
        `'${prefixOf(byId[to])}' + speciesOf(c)`,
      ]),
      "''",
    )};
  }

  function evolveSteps(g) {
    return ${gradeChain(evolution.steps ?? {})};
  }

  function evolveCoins(g) {
    return ${gradeChain(evolution.coins ?? {})};
  }

  function fusionCoins(g) {
    return ${gradeChain(Object.fromEntries(Object.entries(fusion ?? {}).map(([g, f]) => [g, f.coins])))};
  }

  // Every draw also writes lastDraw (the ids drawn, in order) and lastBanner. Rules cap evaluation at
  // 1000 expressions per request (a list literal costs one per element), so checks walk the at most 10 picks.
  // A draw paid with 0 coins spends one free ticket per pick instead (only on banners costing at most
  // ${rewards.ticketMaxCost} coins per draw).
  // gradeCounts (characters drawn per grade) only has to grow by the number of picks in total: checking each
  // pick's grade doesn't fit the budget, and every grade pays the same per-100 reward, so shifting counts
  // between grades gains almost nothing.
  function isLegalDraw() {
    let before = resource.data;
    let after = request.resource.data;
    let picks = after.lastDraw;
    let draws = after.drawCount - before.drawCount;
    let coinCost = before.coins - after.coins;
    let ticketCost = coinCost == 0 ? draws : 0;
    let tickets = before.get('tickets', 0);
    return after.diff(before).affectedKeys().hasOnly(
        ['coins', 'characters', 'drawCount', 'lastDraw', 'lastBanner', 'tickets', 'gradeCounts'])
      && after.coins is int && after.coins >= 0
      && picks is list && picks.size() == draws
      && isBannerDraw(after.lastBanner, draws, coinCost, picks)
      && isExactGain(after.characters, before.characters, picks)
      && isGradeGain(after.gradeCounts, before.get('gradeCounts', {}), draws)
      && tickets >= ticketCost
      && after.get('tickets', 0) == tickets - ticketCost;
  }

  function isGradeGain(ag, bg, draws) {
    return ag is map && ag.keys().hasOnly(${inline(grades)})
      && ${grades.map((g) => `ag.get('${g}', 0) >= bg.get('${g}', 0)`).join(' && ')}
      && ${gradeGains.join(' + ')} == draws;
  }

  function price(draws, cost, one, ten) {
    return (draws == 1 && cost == one) || (draws == 10 && cost == ten);
  }

  function pay(draws, cost, one, ten, ticketable) {
    return (ticketable && cost == 0 && (draws == 1 || draws == 10)) || price(draws, cost, one, ten);
  }

  // Each banner draws from the base collection, its own and mixed collections and any hidden in it. The picks
  // are checked as one comma-joined string against one regex literal.
  function isBannerDraw(banner, draws, cost, picks) {
    return exists(/databases/$(database)/documents/gachaCatalog/live)
      ? isPublishedBannerDraw(banner, draws, cost, picks) : (${banners});
  }

  function isPublishedBannerDraw(id, draws, cost, picks) {
    let b = get(/databases/$(database)/documents/gachaBanners/$(id)).data;
    return b.enabled && b.version == get(/databases/$(database)/documents/gachaCatalog/live).data.version
      && pay(draws, cost, b.cost1, b.cost10, b.ticketable)
      && (b.get('characterIds', null) is list ? picks.hasOnly(b.characterIds) : picks.join(',').matches(b.poolRegex));
  }

  // Only picked characters change, and each grows by exactly how many times it was picked.
  function isExactGain(a, b, picks) {
    return a.diff(b).affectedKeys().hasOnly(picks)
      && ${slots.join('\n      && ')};
  }

  function slot(a, b, picks, i) {
    return i >= picks.size()
      || a.get(picks[i], 0) - b.get(picks[i], 0) == picks.size() - picks.removeAll([picks[i]]).size();
  }

  // Achievement ids, amounts from assets/gacha/rewards.json; -1 means not earned (or not a real achievement).
  function claimReward(p, u) {
    return p[0] == 'grade_first' && p.size() == 2 ? gradeFirstReward(p[1], u.characters)
      : p[0] == 'grade_count' && p.size() == 3 ? gradeCountReward(p[1], p[2], u.get('gradeCounts', {}))
      : p[0] == 'char_first' && p.size() == 2 ? charFirstReward(p[1], u.characters)
      : p[0] == 'char_count' && p.size() == 3 ? charCountReward(p[1], p[2], u.characters)
      : p[0] == 'collection_complete' && p.size() == 2 ? collectionReward(p[1], u.characters)
      : p[0] == 'draws' && p.size() == 2 ? drawsReward(p[1], u.drawCount)
      : -1;
  }

  function gradeFirstReward(g, chars) {
    return ${chain(
      grades.map((g) => [
        `g == '${g}'`,
        `((chars.keys().hasAny(${inline(idsOf(ofGrade(g)))}) || publishedGradeOwned(g, chars)) ? ${rewardFor(grade, g).first} : -1)`,
      ]),
      '-1',
    )};
  }

  // Numbers must be written canonically ("5", not "05") so one milestone can't be claimed twice.
  function publishedGradeOwned(g, chars) {
    return exists(/databases/$(database)/documents/gachaCatalog/live)
      && chars.keys().hasAny(get(/databases/$(database)/documents/gachaCatalog/live).data.gradeIds.get(g, []))
      && !chars.values().hasAny([0]);
  }

  function gradeCountReward(g, s, counts) {
    let m = int(s);
    return string(m) == s && m > 0 && m % ${grade.every} == 0 && counts.get(g, 0) >= m
      ? ${chain(grades.map((g) => [`g == '${g}'`, rewardFor(grade, g).every]), '-1', '        ')}
      : -1;
  }

  function charFirstReward(c, chars) {
    return (c.matches('${regexOf(collections)}') || exists(/databases/$(database)/documents/gachaCharacters/$(c))) && chars.get(c, 0) > 0
      ? ${charAmount('first')}
      : -1;
  }

  function charCountReward(c, s, chars) {
    let m = int(s);
    return string(m) == s && (c.matches('${regexOf(collections)}') || exists(/databases/$(database)/documents/gachaCharacters/$(c))) && chars.get(c, 0) >= m
      ? (${inline(character.milestones)}.hasAny([m]) ? ${charAmount('milestone')}
        : m > 0 && m % ${character.every} == 0 ? ${charAmount('every')}
        : -1)
      : -1;
  }

  function collectionReward(col, chars) {
    return exists(/databases/$(database)/documents/gachaCollections/$(col))
      ? (chars.keys().hasAll(get(/databases/$(database)/documents/gachaCollections/$(col)).data.characterIds) && !chars.values().hasAny([0]) ? ${rewards.collectionComplete} : -1)
      : ${chain(
      collections.map((c) => [
        `col == '${c.id}'`,
        `(chars.keys().hasAll(${inline(idsOf([c]))}) ? ${rewards.collectionComplete} : -1)`,
      ]),
      '-1',
    )};
  }

  function drawsReward(s, n) {
    let m = int(s);
    return string(m) == s && n >= m
      && (${inline(drawCount.milestones)}.hasAny([m]) || (m > 0 && m % ${drawCount.every} == 0))
      ? ${drawCount.reward}
      : -1;
  }
  }
}
`;
}

function writeIfChanged(file, contents) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents) return false;
  fs.writeFileSync(file, contents);
  return true;
}

function generate() {
  const collections = readCollections();
  const rewards = readRewards();
  const baseIds = collections[0].characters.map((ch) => ch.id);
  const missing = ZODIAC.filter((id) => !baseIds.includes(id));
  if (missing.length) fail(`zodiac animals missing from the base collection: ${missing.join(', ')}`);
  validateCrafting(collections, rewards);
  writeIfChanged(TS_OUT, renderTs(collections, rewards));
  if (writeIfChanged(RULES_OUT, renderRules(collections, rewards))) {
    console.log('\n[gacha] firestore.rules가 바뀌었어요. npx firebase-tools deploy --only firestore:rules 로 배포해주세요 (또는 Firebase 콘솔 > Firestore > 규칙에 붙여넣고 게시).\n');
  }
  return collections;
}

/** Regenerates whenever assets/gacha changes while the dev server is running. */
function watch() {
  let timer;
  const watcher = fs.watch(GACHA_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        generate();
      } catch (error) {
        console.error(error.message);
      }
    }, 300);
  });
  watcher.unref();
}

module.exports = { generate, watch, renderRules, readRewards, readCollections };

if (require.main === module) {
  const collections = generate();
  console.log(`[gacha] ${collections.map((c) => `${c.id}(${c.characters.length})`).join(', ')}`);
}
