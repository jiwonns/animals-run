const assert = require('node:assert/strict');
const { auction } = require('../assets/gacha/rewards.json');

function band(grade, stored) {
  const floor = auction.floor[grade];
  const ceil = auction.ceil[grade];
  const quote = Math.min(ceil, Math.max(floor, stored ?? auction.quote[grade]));
  const min = Math.max(floor, Math.floor((quote * auction.low) / 100));
  const max = Math.min(ceil, Math.ceil((quote * auction.high) / 100));
  return { quote, min: Math.min(min, max), max: Math.max(min, max), floor, ceil };
}

function nextQuote(grade, stored, price) {
  const { floor, ceil } = band(grade, stored);
  const quote = stored ?? auction.quote[grade];
  return Math.min(ceil, Math.max(floor, Math.round((quote * (100 - auction.weight) + price * auction.weight) / 100)));
}

for (const grade of Object.keys(auction.quote)) {
  const { quote, min, max, floor, ceil } = band(grade);
  assert.ok(min <= quote && quote <= max, `${grade} band`);
  assert.ok(min >= floor && max <= ceil, `${grade} clamp`);
  assert.ok(min < max, `${grade} spread`);
}

const start = auction.quote.N;
assert.equal(nextQuote('N', start, 5), Math.round((start * 70 + 5 * 30) / 100));

let quote = start;
for (let i = 0; i < 12; i++) quote = nextQuote('N', quote, band('N', quote).min);
assert.ok(quote < start, 'repeated low trades should pull 시세 down');
assert.ok(quote >= auction.floor.N);

quote = start;
for (let i = 0; i < 12; i++) quote = nextQuote('N', quote, band('N', quote).max);
assert.ok(quote > start, 'repeated high trades should pull 시세 up');
assert.ok(quote <= auction.ceil.N);

console.log('Auction bands and 시세 steps look right');
