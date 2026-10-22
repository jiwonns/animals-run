'use strict';
const DRAW_GRADES = ['N', 'R', 'EP', 'U', 'L', 'H', 'E'];
const drawGrade = grade => grade;
function gradeRates(collections, weights, collectionIds) {
  return DRAW_GRADES.flatMap(grade => {
    const pool = collections.filter(c => (!collectionIds || collectionIds.includes(c.id)) && c.id !== 'baby' && (!c.acquisition || c.acquisition === 'draw') && drawGrade(c.grade) === grade);
    const count = pool.reduce((n,c) => n + c.characters.length, 0);
    return pool.map(c => ({ collection:c.id, rate:(weights[grade] ?? 0) * c.characters.length / count, hidden:!!c.hidden })).filter(r => r.rate > 0);
  });
}
function pickByGrade(collections, rates, random = Math.random) {
  const pools = DRAW_GRADES.map(grade => {
    const entries = rates.filter(r => drawGrade(collections.find(c=>c.id===r.collection)?.grade) === grade);
    return { rate:entries.reduce((n,r)=>n+r.rate,0), characters:entries.flatMap(r => {
      const c = collections.find(c=>c.id===r.collection);
      return c?.id === 'baby' || c?.acquisition && c.acquisition !== 'draw' ? [] : c?.characters ?? [];
    }) };
  }).filter(p=>p.rate > 0 && p.characters.length);
  let roll = random();
  const pool = pools.find(p=>(roll-=p.rate)<0) ?? pools.at(-1);
  if (!pool) throw new Error('추첨할 동물이 없어요.');
  return pool.characters[Math.min(pool.characters.length-1,Math.floor(random()*pool.characters.length))];
}
module.exports = { DRAW_GRADES, drawGrade, gradeRates, pickByGrade };
