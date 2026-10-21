import type { Grade } from '@/constants/characters';

export type DuelMove = 'attack' | 'guard' | 'focus' | 'burst';
export type DuelSide = 'player' | 'rival';
export type DuelWinner = DuelSide | 'draw' | 'none';
export type DuelDifficulty = 'rookie' | 'veteran' | 'master';
export const DUEL_STATS: Record<Grade, { hp: number; attack: number; defense: number }> = {
  N: { hp: 100, attack: 18, defense: 0 }, R: { hp: 104, attack: 19, defense: 1 },
  EP: { hp: 109, attack: 20, defense: 2 }, U: { hp: 114, attack: 21, defense: 3 },
  L: { hp: 120, attack: 22, defense: 4 }, E: { hp: 104, attack: 19, defense: 1 },
  H: { hp: 126, attack: 23, defense: 5 },
};
export const DUEL_MOVES: Record<DuelMove, { title: string; detail: string; icon: 'swords' | 'shield' | 'fusion' | 'evolve'; color: string }> = {
  attack: { title: '일반 공격', detail: '기력 소모 없이 타격', icon: 'swords', color: '#5ED7C8' },
  guard: { title: '가드', detail: '다음 피해 감소 · 기력 +1', icon: 'shield', color: '#87B7FF' },
  focus: { title: '회복 집중', detail: '체력 +8 · 기력 +2', icon: 'fusion', color: '#BAA0FF' },
  burst: { title: '결정타', detail: '기력 3 · 공격력 2배', icon: 'evolve', color: '#FFC56F' },
};
export type DuelState = { pHp: number; rHp: number; pEnergy: number; rEnergy: number; pGuard: boolean; rGuard: boolean; turn: number; winner: DuelWinner };
export function duelStart(p: Grade, r: Grade): DuelState {
  return { pHp: DUEL_STATS[p].hp, rHp: DUEL_STATS[r].hp, pEnergy: 1, rEnergy: 1, pGuard: false, rGuard: false, turn: 0, winner: 'none' };
}
export const turnSide = (s: DuelState): DuelSide => s.turn % 2 === 0 ? 'player' : 'rival';
export function duelStep(s: DuelState, move: DuelMove, p: Grade, r: Grade): DuelState {
  if (s.winner !== 'none') return s;
  const isP = turnSide(s) === 'player';
  const energy = isP ? s.pEnergy : s.rEnergy;
  if (move === 'burst' && energy < 3) return s;
  const own = DUEL_STATS[isP ? p : r];
  const target = DUEL_STATS[isP ? r : p];
  const guarded = isP ? s.rGuard : s.pGuard;
  const attacks = move === 'attack' || move === 'burst';
  const hit = attacks ? Math.max(4, Math.floor((own.attack * (move === 'burst' ? 2 : 1) - target.defense) * (guarded ? (move === 'burst' ? 0.65 : 0.35) : 1))) : 0;
  const ownHp = Math.min(own.hp, (isP ? s.pHp : s.rHp) + (move === 'focus' ? 8 : 0));
  const targetHp = Math.max(0, (isP ? s.rHp : s.pHp) - hit);
  const nextEnergy = Math.min(5, energy + (move === 'focus' ? 2 : move === 'guard' ? 1 : move === 'burst' ? -3 : 0));
  const next = { pHp: isP ? ownHp : targetHp, rHp: isP ? targetHp : ownHp,
    pEnergy: isP ? nextEnergy : s.pEnergy, rEnergy: isP ? s.rEnergy : nextEnergy,
    pGuard: isP ? move === 'guard' : attacks ? false : s.pGuard,
    rGuard: isP ? attacks ? false : s.rGuard : move === 'guard', turn: s.turn + 1, winner: 'none' as DuelWinner };
  if (next.pHp === 0 || next.rHp === 0 || next.turn >= 30) {
    const delta = next.pHp * DUEL_STATS[r].hp - next.rHp * DUEL_STATS[p].hp;
    next.winner = delta > 0 ? 'player' : delta < 0 ? 'rival' : 'draw';
  }
  return next;
}
export function aiMove(s: DuelState, difficulty: DuelDifficulty): DuelMove {
  if (s.rEnergy >= 3) return 'burst';
  if (difficulty !== 'rookie' && !s.rGuard && s.pEnergy >= 3) return 'guard';
  const pattern: DuelMove[] = difficulty === 'rookie' ? ['focus', 'attack', 'guard', 'attack'] : ['attack', 'focus', 'attack', 'focus'];
  return pattern[Math.floor(s.turn / 2) % pattern.length];
}
export function duelReward(mode: 'solo' | 'friend', difficulty: DuelDifficulty, winner: DuelWinner, side: DuelSide): number {
  if (winner === 'none') return 0;
  const tier = mode === 'friend' ? 1 : ['rookie', 'veteran', 'master'].indexOf(difficulty);
  return winner === 'draw' ? [3, 4, 5][tier] : winner === side ? [6, 10, 14][tier] : [1, 2, 3][tier];
}
export const DUEL_DAILY_LIMIT = 5;
