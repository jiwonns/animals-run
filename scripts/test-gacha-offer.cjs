const assert = require('node:assert/strict');

function sameOffer(a, b) {
  return (
    a.id === b.id &&
    a.cost[1] === b.cost[1] &&
    a.cost[10] === b.cost[10] &&
    JSON.stringify(a.rates) === JSON.stringify(b.rates) &&
    JSON.stringify(a.characterIds ?? []) === JSON.stringify(b.characterIds ?? [])
  );
}

const offer = {
  id: 'normal',
  cost: { 1: 10, 10: 90 },
  rates: [{ collection: 'normal', rate: 1, hidden: false }],
  characterIds: ['mouse'],
  hero: { id: 'mouse', image: 1 },
  poster: { image: { uri: 'old' } },
};

assert.equal(sameOffer(offer, { ...offer, hero: { id: 'mouse', image: 99 }, poster: { image: { uri: 'new' } } }), true);
assert.equal(sameOffer(offer, { ...offer, cost: { 1: 12, 10: 90 } }), false);
assert.equal(sameOffer(offer, { ...offer, characterIds: ['cow'] }), false);
console.log('Gacha offer compare ignores poster/hero and catches price/pool changes');
