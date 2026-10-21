import { collection, doc, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { CHARACTER_BY_ID, CHARACTERS, type CharacterId } from '@/constants/characters';
import { db } from './firebase';
import { profileRef } from './profile';
import { friendshipRef } from './friends';
import { aiMove, duelStart, duelStep, duelReward, turnSide, type DuelState, type DuelDifficulty, type DuelMove } from './duel';

export type Duel = { id: string; mode: 'solo' | 'friend'; members: string[]; owner: string; recipient: string;
  playerId: CharacterId; rivalId: CharacterId | null; difficulty: DuelDifficulty;
  status: 'pending' | 'active' | 'finished' | 'cancelled'; state: DuelState | null; lastMove: DuelMove | null;
  claimed: string[]; createdAt: Timestamp | null; updatedAt: Timestamp | null };
export const duelsRef = () => collection(db, 'arenaDuels');
export const duelRef = (id: string) => doc(duelsRef(), id);
export const arenaWalletRef = (uid: string) => doc(db, 'arenaWallets', uid);
export async function createDuel(uid: string, character: CharacterId, difficulty: DuelDifficulty, target?: string) {
  const reference = doc(duelsRef());
  const gradeOrder = ['N', 'R', 'EP', 'U', 'L', 'H'];
  const grade = CHARACTER_BY_ID[character].grade;
  const tier = grade === 'E' ? 1 : gradeOrder.indexOf(grade);
  const targetGrade = gradeOrder[Math.max(0, Math.min(5, tier + (difficulty === 'rookie' ? -1 : difficulty === 'master' ? 1 : 0)))];
  const pool = CHARACTERS.filter(ch => ch.grade === targetGrade);
  const opponent = pool[Math.floor(Math.random() * pool.length)] ?? CHARACTERS[0];
  await runTransaction(db, async tx => {
    const profile = await tx.get(profileRef(uid));
    if (!(profile.data()?.characters?.[character] > 0)) throw new Error('보유한 동물을 선택해주세요.');
    if (target) {
      const friend = await tx.get(friendshipRef(uid, target));
      if (friend.data()?.status !== 'accepted') throw new Error('친구에게만 도전할 수 있어요.');
    }
    tx.set(reference, { mode: target ? 'friend' : 'solo', members: target ? [uid, target] : [uid], owner: uid,
      recipient: target ?? uid, playerId: character, rivalId: target ? null : opponent.id, difficulty,
      status: target ? 'pending' : 'active', state: target ? null : duelStart(grade, opponent.grade),
      lastMove: null, claimed: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return reference.id;
}
export function acceptDuel(uid: string, id: string, character: CharacterId) {
  return runTransaction(db, async tx => {
    const ref = duelRef(id); const snap = await tx.get(ref); const duel = snap.data() as Duel;
    const p = await tx.get(profileRef(uid));
    if (duel.status !== 'pending' || duel.recipient !== uid || !(p.data()?.characters?.[character] > 0)) throw new Error('도전 상태나 출전 동물을 확인해주세요.');
    tx.update(ref, { rivalId: character, status: 'active', state: duelStart(CHARACTER_BY_ID[duel.playerId].grade, CHARACTER_BY_ID[character].grade), updatedAt: serverTimestamp() });
  });
}
export function cancelDuel(uid: string, id: string) {
  return runTransaction(db, async tx => {
    const ref = duelRef(id); const snap = await tx.get(ref); const duel = snap.data() as Duel;
    if (duel.status !== 'pending' || !duel.members.includes(uid)) throw new Error('이미 시작된 대전이에요.');
    tx.update(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
  });
}
export function makeDuelMove(uid: string, id: string, move: DuelMove) {
  return runTransaction(db, async tx => {
    const ref = duelRef(id); const snap = await tx.get(ref); const duel = snap.data() as Duel;
    if (duel.status !== 'active' || !duel.state || !duel.rivalId) throw new Error('종료되었거나 시작 전인 대전이에요.');
    const actor = turnSide(duel.state) === 'player' ? duel.owner : duel.recipient;
    if (duel.mode === 'friend' ? actor !== uid : duel.owner !== uid) throw new Error('상대의 차례예요.');
    const selected = duel.mode === 'solo' && turnSide(duel.state) === 'rival' ? aiMove(duel.state, duel.difficulty) : move;
    const state = duelStep(duel.state, selected, CHARACTER_BY_ID[duel.playerId].grade, CHARACTER_BY_ID[duel.rivalId].grade);
    if (state === duel.state) throw new Error('기력이 부족해요.');
    tx.update(ref, { state, lastMove: selected, status: state.winner === 'none' ? 'active' : 'finished', updatedAt: serverTimestamp() });
  });
}
export function claimDuelReward(uid: string, id: string) {
  return runTransaction(db, async tx => {
    const ref = duelRef(id); const walletRef = arenaWalletRef(uid);
    const [snap, profile, wallet] = await Promise.all([tx.get(ref), tx.get(profileRef(uid)), tx.get(walletRef)]);
    const duel = snap.data() as Duel;
    if (duel.status !== 'finished' || !duel.state || !duel.members.includes(uid) || duel.claimed.includes(uid)) throw new Error('이미 받았거나 받을 수 없는 보상이에요.');
    const day = Math.floor(Date.now() / 86400000); // UTC; rules enforce the server's day.
    const count = wallet.data()?.day === day ? wallet.data()?.count ?? 0 : 0;
    if (count >= 5) throw new Error('오늘의 결투 보상 5회를 모두 받았어요. UTC 자정(한국 오전 9시)에 초기화돼요.');
    const amount = duelReward(duel.mode, duel.difficulty, duel.state.winner, duel.owner === uid ? 'player' : 'rival');
    tx.update(profileRef(uid), { coins: profile.data()!.coins + amount, lastArenaReward: id });
    tx.set(walletRef, { day, count: count + 1, lastDuel: id, updatedAt: serverTimestamp() });
    tx.update(ref, { claimed: [...duel.claimed, uid], updatedAt: serverTimestamp() });
    return amount;
  });
}
