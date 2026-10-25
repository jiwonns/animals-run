const assert = require('node:assert/strict');
const { auction } = require('../assets/gacha/rewards.json');

const WINDOW = auction.windowHours * 3600000;
const KST = 9 * 3600000;

function band(grade, stored) {
  const floor = auction.floor[grade];
  const ceil = auction.ceil[grade];
  const quote = Math.min(ceil, Math.max(floor, stored ?? auction.quote[grade]));
  const min = Math.max(floor, Math.floor((quote * auction.low) / 100));
  const max = Math.min(ceil, Math.ceil((quote * auction.high) / 100));
  return { quote, min: Math.min(min, max), max: Math.max(min, max), floor, ceil };
}

function slot(now) {
  return Math.floor((now + KST) / WINDOW) * WINDOW - KST;
}

function afterTrade(grade, stored, price, now) {
  const current = slot(now);
  const same = (stored?.windowStart ?? 0) === current;
  const count = stored?.windowCount ?? 0;
  const settled = count === 0 ? stored.quote : Math.round((stored.windowSum ?? 0) / count);
  const { floor, ceil } = band(grade, stored.quote);
  const quote = same ? stored.quote : Math.min(ceil, Math.max(floor, settled));
  return {
    quote,
    windowStart: current,
    windowSum: same ? (stored.windowSum ?? 0) + price : price,
    windowCount: same ? (stored.windowCount ?? 0) + 1 : 1,
    lastWindowCount: same ? (stored.lastWindowCount ?? 0) : (stored.windowCount ?? 0),
  };
}

for (const grade of Object.keys(auction.quote)) {
  const { quote, min, max, floor, ceil } = band(grade);
  assert.ok(min <= quote && quote <= max, `${grade} band`);
  assert.ok(min >= floor && max <= ceil, `${grade} clamp`);
  assert.ok(min < max, `${grade} spread`);
}

assert.equal(auction.windowHours, 2);
const noonKst = Date.UTC(2026, 9, 25, 3, 0, 0); // 12:00 KST
assert.equal(new Date(slot(noonKst) + KST).getUTCHours(), 12);

const start = { quote: 8, windowStart: slot(noonKst), windowSum: 0, windowCount: 0, lastWindowCount: 0 };
const first = afterTrade('N', start, 5, noonKst);
assert.equal(first.quote, 8);
assert.equal(first.windowCount, 1);
assert.equal(first.windowSum, 5);
assert.equal(first.lastWindowCount, 0);
const second = afterTrade('N', first, 5, noonKst + 1000);
assert.equal(second.quote, 8);
assert.equal(second.windowSum, 10);
assert.equal(second.lastWindowCount, 0);
const later = afterTrade('N', second, 6, noonKst + WINDOW);
assert.equal(later.quote, 5);
assert.equal(later.windowCount, 1);
assert.equal(later.windowSum, 6);
assert.equal(later.lastWindowCount, 2);

const legacy = afterTrade('N', { quote: 8 }, 7, noonKst);
assert.equal(legacy.quote, 8);
assert.equal(legacy.windowCount, 1);
assert.equal(legacy.windowSum, 7);
assert.equal(legacy.lastWindowCount, 0);

const nBand = band('N');
const cheap = [
  { id: 'dear', seller: 'a', price: nBand.max },
  { id: 'cheap', seller: 'b', price: nBand.min },
  { id: 'own', seller: 'me', price: nBand.min },
].filter((row) => row.seller !== 'me').sort((a, b) => a.price - b.price)[0];
assert.equal(cheap.id, 'cheap');

console.log('Auction bands and 2-hour 시세 windows look right');
