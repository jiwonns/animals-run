'use strict';
const GRADES = ['N', 'R', 'EP', 'U', 'L', 'E', 'H'];
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
function validateCatalog(value) {
  const fail = message => { throw new Error(message); };
  if (!value || value.schema !== 1 || !Array.isArray(value.collections) || !value.collections.length || value.collections.length > 80) fail('컬렉션은 1~80개여야 해요.');
  const collections = new Map(), characters = new Map();
  const text = (s, max = 100) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  const image = s => s && typeof s.uri === 'string' && s.uri.length <= 2000 && (/^https:\/\//.test(s.uri) || /^gacha-image:[A-Za-z0-9_-]{20}$/.test(s.uri));
  for (const c of value.collections) {
    if (typeof c.id !== 'string' || !idPattern.test(c.id) || collections.has(c.id) || !text(c.name) || !GRADES.includes(c.grade) || typeof c.base !== 'boolean' || typeof c.hidden !== 'boolean') fail('컬렉션 ID·이름·등급을 확인해주세요.');
    if (!Array.isArray(c.characters) || !c.characters.length || c.characters.length > 100) fail(`${c.name}: 동물은 1~100종이어야 해요.`);
    collections.set(c.id, c);
    if (c.acquisition !== undefined && !['draw','evolution','breeding'].includes(c.acquisition)) fail('획득 경로를 확인해주세요.');
    for (const ch of c.characters) {
      if (ch.species !== undefined && (typeof ch.species !== 'string' || !idPattern.test(ch.species))) fail('동물 종 ID를 확인해주세요.');
      if (typeof ch.id !== 'string' || !idPattern.test(ch.id) || characters.has(ch.id) || !text(ch.name) || !image(ch.image) || !image(ch.thumb)) fail(`${c.name}: 동물 ID는 중복 없이, 이미지는 HTTPS 주소 또는 업로드로 등록해주세요.`);
      characters.set(ch.id, { ...ch, collection: c.id, grade: c.grade });
    }
  }
  if (characters.size > 600) fail('동물은 최대 600종까지 등록할 수 있어요.');
  for (const c of value.collections) {
    const b = c.banner;
    if (!b) continue;
    if (!text(b.title) || typeof b.tagline !== 'string' || b.tagline.length > 300 || !c.characters.some(ch => ch.id === b.hero)) fail(`${c.name}: 제목과 대표 동물을 확인해주세요.`);
    if (![b.cost?.[1], b.cost?.[10]].every(n => Number.isSafeInteger(n) && n > 0 && n <= 1000000)) fail(`${c.name}: 비용은 1~1,000,000 코인이어야 해요.`);
    if (!b.colors || !['background', 'accent', 'text'].every(k => /^#[a-fA-F0-9]{6}$/.test(b.colors[k]))) fail(`${c.name}: 색상은 #RRGGBB 형식이어야 해요.`);
    if (b.poster !== null && !image(b.poster)) fail('포스터 주소를 확인해주세요.');
    if (typeof b.enabled !== 'boolean' && b.enabled !== undefined) fail('판매 상태가 잘못됐어요.');
    if (!Array.isArray(b.rates) || !b.rates.length || b.rates.length > 80) fail('확률을 등록해주세요.');
    const seen = new Set();
    let total = 0;
    for (const r of b.rates) {
      if (!collections.has(r.collection) || seen.has(r.collection) || !Number.isFinite(r.rate) || r.rate <= 0 || r.rate > 1 || typeof r.hidden !== 'boolean') fail(`${c.name}: 중복 컬렉션·빈 풀·잘못된 확률이 있어요.`);
      total += r.rate; seen.add(r.collection);
      if (collections.get(r.collection).acquisition === 'evolution') fail('진화 전용 동물은 뽑기에 넣을 수 없어요.');
      if (r.collection === 'baby' || collections.get(r.collection).acquisition === 'breeding') fail('아기 시리즈는 교배로만 얻을 수 있어요.');
    }
    if (Math.abs(total - 1) > 1e-8) fail(`${c.name}: 확률 합계가 ${(total * 100).toFixed(4)}%예요. 100%로 맞춰주세요.`);
  }
  if (!value.collections.some(c => c.banner && c.banner.enabled !== false)) fail('게시하려면 판매 중인 뽑기가 하나 이상 필요해요.');
  if (BufferByteLength(JSON.stringify(value)) > 850000) fail('카탈로그가 너무 커요.');
  return { collections, characters };
}
function BufferByteLength(s) { return encodeURIComponent(s).replace(/%[A-F\d]{2}/gi, 'x').length; }
function assertCompatible(before, after) {
  const next = validateCatalog(after);
  for (const c of before?.collections ?? []) {
    const nc = next.collections.get(c.id);
    if (nc && (nc.acquisition ?? 'draw') !== (c.acquisition ?? 'draw') && !(c.id==='baby' && nc.acquisition==='breeding') && !(["rare","epic","unique","legendary","cats_rare","cats_epic","cats_unique","cats_legendary"].includes(c.id) && (c.acquisition??'draw')==='draw' && nc.acquisition==='evolution')) throw new Error('기존 동물의 획득 경로는 변경할 수 없어요.');
    if (!nc || nc.grade !== c.grade || nc.base !== c.base) throw new Error('기존 컬렉션 삭제·등급 변경은 보유 데이터 보호를 위해 지원하지 않아요. 판매 중지로 전환해주세요.');
    for (const ch of c.characters) if (!nc.characters.some(n => n.id === ch.id)) throw new Error('기존 동물 ID를 삭제하거나 옮길 수 없어요.');
  }
}
function pickCharacter(catalog, banner, random) {
  return require('./draw-pools').pickByGrade(catalog.collections, banner.rates, random);
}
function compileCatalog(value) {
  validateCatalog(value);
  const rewards = require('./rewards.json');
  return {
    characters:value.collections.flatMap(c=>c.characters.map(ch=>({ id:ch.id,grade:c.grade,collection:c.id }))),
    collections:value.collections.map(c=>({ id:c.id,characterIds:c.characters.map(ch=>ch.id) })),
    banners:value.collections.filter(c=>c.banner).map(c=>{
      const b=c.banner;
      const ids=b.rates.flatMap(r=>value.collections.find(v=>v.id===r.collection).characters.map(ch=>ch.id));
      const pattern=wordPattern(ids);
      return { id:c.id,cost1:b.cost[1],cost10:b.cost[10],ticketable:b.cost[1]<=rewards.ticketMaxCost,enabled:b.enabled!==false,characterIds:ids,poolRegex:`^(?:${pattern})(?:,(?:${pattern}))*$` };
    }),
  };
}
// Compact compatibility regex for older deployed rules; current rules use characterIds.hasOnly.
function wordPattern(words) {
  const root={children:new Map(),end:false};
  for(const word of words) { let node=root;for(const char of word){if(!node.children.has(char))node.children.set(char,{children:new Map(),end:false});node=node.children.get(char);}node.end=true; }
  function render(node) {
    const branches=[...node.children].map(([char,next])=>char+render(next));
    if(!branches.length)return '';
    const result=branches.length===1?branches[0]:`(?:${branches.join('|')})`;
    return node.end?`(?:${result})?`:result;
  }
  return render(root);
}
module.exports = { validateCatalog, assertCompatible, pickCharacter, compileCatalog };
