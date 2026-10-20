import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { COLLECTIONS, GRADE_ORDER, GRADES, charactersIn } from '@/constants/characters';
import { db } from './firebase';
import type { Profile } from './profile';
import { RANKING_COUNTS, type RankingEntry } from './ranking';
import { kindsByGrade } from './inventory';

export type Medal = { id: string; name: string; description: string; eligible: (profile: Profile) => boolean };
const collectionPhrase = (id: string) => id.startsWith('cats')
  ? '서로 다른 매력의 고양이 친구들이 모두 모였어요. 포근한 골골송이 당신의 여정을 축하해요.'
  : id === 'sea' ? '푸른 바다의 친구들을 모두 만났어요. 파도 너머까지 닿은 인연을 기념해요.'
  : id === 'autumn' ? '가을빛 친구들이 한자리에 모였어요. 함께 물들인 계절을 오래 간직해요.'
  : id === 'baby' ? '작고 소중한 아기 친구들을 모두 만났어요. 첫걸음을 지켜준 따뜻한 마음을 기념해요.'
  : id === 'hidden' ? '쉽게 모습을 보이지 않는 친구들까지 모두 만났어요. 기적 같은 인연이 완성되었어요.'
  : id === 'legendary' ? '전설 속 친구들이 모두 곁에 모였어요. 당신과 함께한 이야기가 또 하나의 전설이 되었어요.'
  : '열두 동물 친구가 모두 모였어요. 저마다 다른 매력으로 하나의 특별한 인연을 완성했어요.';
const collectionMedals = (): Medal[] => COLLECTIONS.map(collection => ({
  id: `collection_complete:${collection.id}`, name: `${collection.name}의 수호자`,
  description: `${collection.name} 완성 · ${collectionPhrase(collection.id)}`,
  eligible: profile => charactersIn(collection.id).every(c => (profile.characters[c.id] ?? 0) > 0),
}));
export const COLLECTION_MEDALS: Medal[] = collectionMedals();
export const MILESTONE_MEDALS: Medal[] = [
  { id: 'steps:10000', name: '첫 발자국', description: '누적 10,000걸음 · 작은 발걸음이 멋진 여정이 되었어요.', eligible: p => (p.steps ?? 0) >= 10000 },
  { id: 'steps:100000', name: '길 위의 모험가', description: '누적 100,000걸음 · 걸어온 길마다 추억이 피어나요.', eligible: p => (p.steps ?? 0) >= 100000 },
  { id: 'draws:100', name: '인연 수집가', description: '뽑기 100회 · 백 번의 설렘으로 친구들을 만났어요.', eligible: p => p.drawCount >= 100 },
  { id: 'hatchCount:10', name: '생명의 마중꾼', description: '부화 10회 · 새로운 생명의 첫 순간을 함께했어요.', eligible: p => (p.hatchCount ?? 0) >= 10 },
  { id: 'evolveCount:10', name: '성장의 동반자', description: '진화 10회 · 친구의 더 큰 내일을 응원했어요.', eligible: p => (p.evolveCount ?? 0) >= 10 },
  { id: 'fuseCount:10', name: '가능성의 연금술사', description: '합성 10회 · 만남 속에서 새로운 가능성을 찾았어요.', eligible: p => (p.fuseCount ?? 0) >= 10 },
  { id: 'recycleCount:10', name: '순환의 지킴이', description: '재활용 10회 · 모든 이별을 새로운 시작으로 이었어요.', eligible: p => (p.recycleCount ?? 0) >= 10 },
];
export const PERMANENT_MEDALS = [...COLLECTION_MEDALS, ...MILESTONE_MEDALS];
export function rebuildCollectionMedals() {
  COLLECTION_MEDALS.splice(0,COLLECTION_MEDALS.length,...collectionMedals());
  PERMANENT_MEDALS.splice(0,PERMANENT_MEDALS.length,...COLLECTION_MEDALS,...MILESTONE_MEDALS);
}
export const medalsRef = (uid: string) => collection(db, 'users', uid, 'medals');
export const claimMedal = (uid: string, medal: Medal) => setDoc(doc(medalsRef(uid), medal.id), { createdAt: serverTimestamp() });

const titles = { steps: ['대지의 선두주자', '누구보다 먼 길을 걸으며 새로운 길을 열고 있어요.'],
  hatchCount: ['탄생의 왕관', '가장 많은 새 생명을 맞이한 따뜻한 손길이에요.'],
  evolveCount: ['성장의 정점', '친구들의 가능성을 가장 높이 꽃피웠어요.'],
  fuseCount: ['창조의 거장', '가장 많은 만남으로 새로운 가능성을 만들었어요.'],
  recycleCount: ['순환의 개척자', '가장 많은 새로운 시작을 이어주고 있어요.'] } as const;
export const RANKING_MEDALS = [
  ...(['steps', ...RANKING_COUNTS] as const).map(key => ({ id: `ranking:${key}`, name: titles[key][0], description: titles[key][1], value: (e: RankingEntry) => e[key] ?? 0 })),
  ...GRADE_ORDER.map(grade => ({ id: `ranking:grade:${grade}`, name: `${GRADES[grade].label}의 왕관`, description: `${GRADES[grade].label} 친구들을 가장 다양하게 모은 수집의 정점이에요.`, value: (e: RankingEntry) => kindsByGrade(e.characters)[grade] })),
];

/** One live holder per board. Equal scores use UID order so the crown never duplicates. */
export function rankingMedalHolder(entries: (RankingEntry & { uid: string })[], medal: typeof RANKING_MEDALS[number]) {
  return entries.reduce<(RankingEntry & { uid: string }) | null>((best, entry) => {
    const score = medal.value(entry);
    if (score <= 0) return best;
    return !best || score > medal.value(best) || (score === medal.value(best) && entry.uid < best.uid) ? entry : best;
  }, null)?.uid ?? null;
}
