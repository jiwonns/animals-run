const assert=require('node:assert/strict'); const fs=require('node:fs'); const ts=require('typescript');
const loaded={exports:{}}; new Function('exports','module',ts.transpileModule(fs.readFileSync('src/lib/duel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(loaded.exports,loaded);
const {DUEL_STATS,duelStart,duelStep,aiMove,duelReward}=loaded.exports;
for(const p of Object.keys(DUEL_STATS)) for(const r of Object.keys(DUEL_STATS)) for(const d of ['rookie','veteran','master']) {
  let s=duelStart(p,r);
  assert.equal(duelStep(s,'burst',p,r),s);
  for(let i=0;i<30&&s.winner==='none';i++) {
    const move=s.turn%2?aiMove(s,d):(s.pEnergy>=3?'burst':i%4===0?'focus':'attack');
    const next=duelStep(s,move,p,r); assert.equal(next.turn,s.turn+1); s=next;
    assert.ok(s.pHp>=0&&s.pHp<=DUEL_STATS[p].hp); assert.ok(s.rHp>=0&&s.rHp<=DUEL_STATS[r].hp);
    assert.ok(s.pEnergy>=0&&s.pEnergy<=5);assert.ok(s.rEnergy>=0&&s.rEnergy<=5);
  }
  assert.notEqual(s.winner,'none'); assert.equal(duelStep(s,'attack',p,r),s);
}
assert.equal(duelReward('solo','master','player','player'),14);
assert.equal(duelReward('solo','rookie','rival','player'),1);
assert.equal(duelReward('friend','master','player','rival'),2);
let s=duelStep(duelStart('N','H'),'guard','N','H'); const guard=duelStep(s,'attack','N','H');
assert.ok(guard.pHp>duelStep({...s,pGuard:false},'attack','N','H').pHp);
assert.equal(guard.pGuard,false);
const files=['src/app/(tabs)/mypage/avatar.tsx','src/app/(tabs)/mypage/index.tsx'];
for(const path of files) assert.doesNotMatch(fs.readFileSync(path,'utf8'),/>[^<{}]*\?{2}[^<{}]*</,`Corrupted display text in ${path}`);
console.log('PASS all 147 grade/difficulty matchups, bounded combat, guard consumption, reward amounts, and Korean profile text');
