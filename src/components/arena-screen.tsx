import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from './gacha-image';
import { AvatarFace } from './avatar-face';
import { DuelStage } from './duel-stage';
import { Icon, ICONS } from './icon';
import { PagedListSheet } from './paged-list-sheet';
import { CHARACTERS, CHARACTER_BY_ID, GRADES, type CharacterId } from '@/constants/characters';
import { useDuels } from '@/hooks/use-duels';
import { useNow } from '@/hooks/use-home';
import { useSession } from '@/providers/session-provider';
import { useFriends } from '@/providers/friends-provider';
import { useCatalog } from '@/providers/catalog-provider';
import { friendIdentity } from '@/lib/friends';
import { DUEL_MOVES, DUEL_STATS, aiMove, duelReward, turnSide, type DuelDifficulty, type DuelMove } from '@/lib/duel';
import { acceptDuel, cancelDuel, claimDuelReward, createDuel, makeDuelMove } from '@/lib/duel-service';

const LEVELS: { id: DuelDifficulty; label: string; reward: number; hint: string }[] = [
  { id: 'rookie', label: '루키', reward: 6, hint: '한 등급 낮은 상대' }, { id: 'veteran', label: '베테랑', reward: 10, hint: '같은 등급의 승부' }, { id: 'master', label: '마스터', reward: 14, hint: '한 등급 높은 상대' },
];
function Button({ label, onPress, disabled, quiet }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, quiet && s.quiet, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, quiet && { color: '#D4D5E7' }]}>{label}</Text></Pressable>;
}
export function ArenaScreen() {
  const { user } = useSession();
  return <ArenaContent key={user?.uid} />;
}
function ArenaContent() {
  useCatalog();
  const now = useNow();
  const { user, profile } = useSession(); const uid = user?.uid ?? '';
  const { friends, failed: friendsFailed } = useFriends();
  const { duels, previous, wallet, loading, failed } = useDuels(uid);
  const [mode, setMode] = useState<'solo' | 'friend'>('solo');
  const [selection, setSelection] = useState<CharacterId | null>(null);
  const [level, setLevel] = useState<DuelDifficulty>('rookie');
  const [picker, setPicker] = useState(false); const [guide, setGuide] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const lock = useRef(false);
  const owned = CHARACTERS.filter(ch => (profile?.characters[ch.id] ?? 0) > 0).sort((a,b) => DUEL_STATS[b.grade].hp - DUEL_STATS[a.grade].hp);
  const selected = owned.find(ch => ch.id === selection) ?? owned.find(ch => ch.id === profile?.avatar) ?? owned[0];
  const match = duels.find(d => d.id === opened); const side = match?.owner === uid ? 'player' : 'rival'; const state = match?.state;
  const myTurn = !!match && !!state && (match.mode === 'solo' ? turnSide(state) === 'player' : (turnSide(state) === 'player' ? match.owner : match.recipient) === uid);
  const energy = state ? side === 'player' ? state.pEnergy : state.rEnergy : 0;
  const count = wallet?.day === Math.floor(now / 86400000) ? wallet.count : 0;
  const identities = friends.map(f => friendIdentity(f, uid));
  const nameOf = (id: string) => id === uid ? '나' : identities.find(f => f.uid === id)?.name ?? '친구';
  async function perform(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setToast('');
    try { await task(); }
    catch (e) { setError(e instanceof Error && !('code' in e) ? e.message : '처리하지 못했어요. 연결 상태와 대전 차례를 확인한 뒤 다시 시도해주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function challenge(target?: string) {
    if (!selected) return;
    void perform(async () => { const id = await createDuel(uid, selected.id, level, target); setOpened(id); if (target) setToast('친구에게 도전장을 보냈어요. 친구의 결투장에 표시돼요.'); });
  }
  function chooseMove(move: DuelMove) {
    if (!match) return;
    void perform(async () => {
      await makeDuelMove(uid, match.id, move);
      if (match.mode === 'solo') {
        await new Promise(resolve => setTimeout(resolve, 600));
        try { await makeDuelMove(uid, match.id, 'attack'); }
        catch (e) { if (e instanceof Error && e.message.includes('종료')) return; throw e; }
      }
    });
  }
  const inbox = duels.filter(d => d.mode === 'friend' && d.status === 'pending' && d.recipient === uid);
  const live = duels.filter(d => d.status === 'active' || (d.status === 'pending' && d.owner === uid));
  const finished = duels.filter(d => d.status === 'finished');
  return <ScrollView style={s.root} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content}>
    <View style={s.topline}><Text style={s.eyebrow}>ANIMALS ARENA</Text><View style={s.livePill}><View style={s.dot} /><Text style={s.liveText}>전술 대전</Text></View></View>
    {!match && <><Text style={s.title}>본능을 깨우는{ '\n' }한 판의 승부.</Text><Text style={s.subtitle}>나의 동물과 함께 도전하고, 친구와 실력을 겨뤄보세요.</Text></>}
    <View style={s.wallet}><Icon name={ICONS.trophy} color="#EDC584" size={19} /><Text style={s.walletText}>오늘의 보상 <Text style={{ color: '#F4D296' }}>{Math.max(0, 5 - count)} / 5회</Text></Text><Text style={s.reset}>매일 오전 9시 초기화</Text></View>
    {(failed || friendsFailed || error) && <Text accessibilityRole="alert" style={s.error}>{error || '대전 정보를 불러오지 못했어요. 네트워크를 확인해주세요.'}</Text>}
    {!!toast && <Text accessibilityLiveRegion="polite" style={s.toast}>{toast}</Text>}
    {opened && !match && <Text style={s.subtitle}>{loading ? '대전장을 불러오는 중…' : '대전 상태를 동기화하고 있어요.'}</Text>}
    {match ? <>
      <View style={s.sectionRow}><Text style={s.section}>{match.mode === 'friend' ? `${nameOf(match.owner)} vs ${nameOf(match.recipient)}` : `${LEVELS.find(l => l.id === match.difficulty)?.label} 도전`}</Text><Pressable accessibilityRole="button" onPress={() => setOpened(null)} style={{ padding: 10 }}><Text style={s.link}>로비로</Text></Pressable></View>
      {match.status === 'pending' ? <View style={s.card}><Text style={s.section}>도전장</Text><Text style={s.subtitle}>{nameOf(match.owner)}의 {CHARACTER_BY_ID[match.playerId]?.name} 친구가 기다리고 있어요.</Text>
        {match.recipient === uid ? <><Text style={s.subtitle}>출전 동물: {selected?.name ?? '동물을 먼저 선택해주세요'}</Text><Button label="출전 동물 변경" quiet onPress={() => setPicker(true)} /><Button label="도전 수락" disabled={busy || !selected} onPress={() => { if (selected) void perform(() => acceptDuel(uid, match.id, selected.id)); }} /></> : <Text style={s.subtitle}>친구가 수락하면 대전이 시작돼요. 로비로 나가도 도전장은 유지돼요.</Text>}
        <Button label={match.owner === uid ? '도전 취소' : '거절하기'} quiet disabled={busy} onPress={() => { void perform(() => cancelDuel(uid, match.id)); }} />
      </View> : match.status === 'cancelled' ? <Text style={s.subtitle}>취소된 도전이에요. 로비에서 새 대전을 시작해보세요.</Text> : state && match.rivalId && <>
        <DuelStage key={match.id} duel={match} before={previous[match.id]} viewer={uid} />
        {state.winner === 'none' ? <>
          <View style={s.sectionRow}><Text style={s.section}>{busy ? '전투 진행 중…' : myTurn ? '다음 행동을 선택하세요' : '상대의 차례예요'}</Text><Text style={s.reset}>기력 {energy} / 5</Text></View>
          {match.mode === 'solo' && <Text style={s.tip}>상대 전술: {DUEL_MOVES[aiMove({ ...state, turn: state.turn % 2 ? state.turn : state.turn + 1 }, match.difficulty)].title} · 가드는 일반 공격에 특히 강해요.</Text>}
          <View style={s.moves}>{(Object.keys(DUEL_MOVES) as DuelMove[]).map(m => { const info = DUEL_MOVES[m]; const disabled = busy || !myTurn || (m === 'burst' && energy < 3); return <Pressable key={m} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => chooseMove(m)} style={({ pressed }) => [s.move, { borderColor: `${info.color}45`, backgroundColor: `${info.color}0E`, opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}><Icon name={ICONS[info.icon]} size={24} color={info.color} /><Text style={s.moveTitle}>{info.title}</Text><Text style={s.moveDetail}>{info.detail}</Text></Pressable>; })}</View>
          {match.mode === 'solo' && !myTurn && !busy && <Button label="상대 턴 이어서 진행" onPress={() => { void perform(() => makeDuelMove(uid, match.id, 'attack')); }} />}
          {match.mode === 'friend' && !myTurn && <Text style={s.tip}>로비로 나가도 진행 상황이 저장돼요. 친구가 행동하면 여기에 반영됩니다.</Text>}
        </> : <View style={s.result}><Icon name={ICONS.trophy} size={40} color="#F5CE8B" /><Text style={s.resultTitle}>{state.winner === 'draw' ? '무승부' : state.winner === side ? '멋진 승리!' : '다음 승부를 향해'}</Text><Text style={s.subtitle}>이번 대전 보상 <Text style={{ color: '#F5CE8B', fontWeight: '800' }}>{duelReward(match.mode, match.difficulty, state.winner, side)} 코인</Text></Text>
          <Button label={match.claimed.includes(uid) ? '보상 수령 완료' : count >= 5 ? '오늘 보상 횟수 소진' : '코인 보상 받기'} disabled={busy || match.claimed.includes(uid) || count >= 5} onPress={() => { void perform(async () => { const n = await claimDuelReward(uid, match.id); setToast(`${n}코인을 받았어요!`); }); }} /><Button label="로비에서 다음 대전 준비" quiet onPress={() => setOpened(null)} />
        </View>}
      </>}
    </> : <>
      <View style={s.tabs}>{(['solo','friend'] as const).map(m => <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} style={[s.tab, mode === m && s.tabActive]}><Text style={[s.tabText, mode === m && { color: '#F9F4EA' }]}>{m === 'solo' ? 'AI 도전' : `친구 대전${inbox.length ? ` · ${inbox.length}` : ''}`}</Text></Pressable>)}</View>
      <View style={s.fighterCard}><View style={s.fighterGlow} />
        {selected ? <><View style={{ flex: 1, gap: 10, zIndex: 1 }}><Text style={s.eyebrow}>MY FIGHTER</Text><Text style={s.fighterName}>{selected.name}</Text><Text style={{ color: GRADES[selected.grade].color, fontSize: 12, fontWeight: '800' }}>{GRADES[selected.grade].label} · {selected.grade}</Text><View style={s.miniStats}>{[['HP', DUEL_STATS[selected.grade].hp], ['ATK', DUEL_STATS[selected.grade].attack], ['DEF', DUEL_STATS[selected.grade].defense]].map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>)}</View><Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={s.change}><Text style={s.link}>동물 변경  →</Text></Pressable></View><Image source={selected.image} contentFit="contain" style={s.fighterImage} /></> : <View style={{ gap: 12 }}><Text style={s.section}>첫 번째 선수를 만나보세요</Text><Button label="동물 뽑으러 가기" onPress={() => router.navigate('/gacha')} /></View>}
      </View>
      {mode === 'solo' ? <><View style={s.sectionRow}><Text style={s.section}>도전 난이도</Text><Text style={s.reset}>승리 시 코인 보상</Text></View><View style={s.levels}>{LEVELS.map(l => <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ checked: level === l.id }} onPress={() => setLevel(l.id)} style={[s.level, level === l.id && s.levelActive]}><Text style={[s.levelName, level === l.id && { color: '#F4D296' }]}>{l.label}</Text><Text style={s.levelReward}>{l.reward}<Text style={{ fontSize: 10 }}> C</Text></Text><Text style={s.levelHint}>{l.hint}</Text></Pressable>)}</View><Button label={busy ? '대전 준비 중…' : 'AI 도전 시작  →'} disabled={!selected || busy || loading || failed} onPress={() => challenge()} /><Text style={s.tip}>등급에 따라 체력·공격·방어가 달라져요. 이벤트는 레어와 같은 능력이에요. 최저·최고 등급에서는 상대 등급이 유지돼요.</Text></> : <>
        {inbox.length > 0 && <><Text style={s.section}>받은 도전장</Text>{inbox.map(d => <Button key={d.id} label={`${nameOf(d.owner)}의 도전장 열기`} quiet onPress={() => setOpened(d.id)} />)}</>}
        <Text style={s.section}>친구에게 도전하기</Text><Text style={s.subtitle}>서로 한 턴씩 선택하는 대전이에요. 앱을 나가도 이어서 할 수 있어요.</Text>
        {!identities.length && <Button label="친구 추가하러 가기" quiet onPress={() => router.navigate('/friends')} />}
        {identities.map(f => <View key={f.uid} style={s.friend}><AvatarFace avatar={f.avatar} size={42} fallback={f.name} /><Text style={s.friendName}>{f.name}</Text><Button label="도전" disabled={busy || !selected || duels.some(d => d.mode === 'friend' && d.members.includes(f.uid) && (d.status === 'pending' || d.status === 'active'))} onPress={() => challenge(f.uid)} /></View>)}
      </>}
      {!!live.length && <><Text style={s.section}>이어서 할 대전</Text>{live.slice(0, 8).map(d => <Button key={d.id} label={`${d.mode === 'friend' ? '친구 대전' : 'AI 도전'} · ${d.status === 'pending' ? '수락 대기' : `${Math.floor((d.state?.turn ?? 0) / 2) + 1}라운드`}  →`} quiet onPress={() => setOpened(d.id)} />)}</>}
      {!!finished.length && <><Text style={s.section}>최근 대전</Text>{finished.slice(0, 5).map(d => <Pressable key={d.id} accessibilityRole="button" onPress={() => setOpened(d.id)} style={s.history}><Text style={s.historyTitle}>{d.state?.winner === 'draw' ? '무승부' : d.state?.winner === (d.owner === uid ? 'player' : 'rival') ? '승리' : '패배'}</Text><Text style={s.historyBody}>{CHARACTER_BY_ID[d.playerId]?.name} vs {d.rivalId && CHARACTER_BY_ID[d.rivalId]?.name}</Text><Text style={s.link}>{d.claimed.includes(uid) ? '완료' : '보상'}</Text></Pressable>)}</>}
    </>}
    <Pressable accessibilityRole="button" onPress={() => setGuide(v => !v)} style={s.guideToggle}><Text style={s.link}>전투 규칙 · 등급별 능력 · 보상 안내 {guide ? '−' : '+'}</Text></Pressable>
    {guide && <View style={s.card}><Text style={s.section}>전술로 만드는 승부</Text><Text style={s.subtitle}>가드는 다음 공격 한 번을 줄이고, 집중은 체력 8과 기력 2를 회복해요. 결정타는 기력 3을 쓰며 가드를 일부 관통해요. 기력은 최대 5, 30번 행동 후 남은 체력 비율로 판정해요.</Text>{Object.entries(DUEL_STATS).map(([g, v]) => <Text key={g} style={s.tip}>{g} · HP {v.hp} / 공격 {v.attack} / 방어 {v.defense}</Text>)}<Text style={s.subtitle}>승리 6 / 10 / 14코인, 무승부 3 / 4 / 5코인, 패배 1 / 2 / 3코인. 친구 대전은 승리 10, 무승부 4, 패배 2코인이에요. 두 모드 합쳐 하루 5회까지 수령해요. 중복 수령은 불가능하며 한국 시간 오전 9시에 초기화돼요.</Text></View>}
    {picker && <PagedListSheet title="출전 동물 선택" data={owned} keyExtractor={ch => ch.id} onClose={() => setPicker(false)} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { setSelection(item.id); setPicker(false); }} style={s.pickerRow}><AvatarFace avatar={item.id} size={50} fallback={item.name} /><View style={{ flex: 1, gap: 4 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{item.name}</Text><Text style={{ color: GRADES[item.grade].color, fontSize: 11 }}>{item.grade} · HP {DUEL_STATS[item.grade].hp} · ATK {DUEL_STATS[item.grade].attack} · DEF {DUEL_STATS[item.grade].defense}</Text></View></Pressable>} />}
  </ScrollView>;
}
const s = StyleSheet.create({
  root: { backgroundColor: '#101321' }, content: { padding: 20, paddingBottom: 45, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: '#9399B6', fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  livePill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#5ED7C810', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }, dot: { width: 5, height: 5, borderRadius: 4, backgroundColor: '#5ED7C8' }, liveText: { color: '#8EDDD1', fontSize: 10, fontWeight: '700' },
  title: { color: '#F6F2E9', fontWeight: '900', fontSize: 34, lineHeight: 43, letterSpacing: -1.2 }, subtitle: { color: '#A3A9C0', fontSize: 12, lineHeight: 21 },
  wallet: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 13, backgroundColor: '#1B1E30', borderRadius: 14, borderWidth: 1, borderColor: '#323346' }, walletText: { flex: 1, color: '#A9ADC3', fontSize: 11, minWidth: 120 }, reset: { color: '#878EA9', fontSize: 10 },
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: '#1B1F32', borderRadius: 14 }, tab: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 11 }, tabActive: { backgroundColor: '#36374D' }, tabText: { color: '#8D94B0', fontWeight: '800', fontSize: 13 },
  fighterCard: { minHeight: 230, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2132', padding: 22, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#3D4856' }, fighterGlow: { width: 240, height: 240, borderRadius: 120, position: 'absolute', right: -35, backgroundColor: '#5ED7C80B', borderWidth: 1, borderColor: '#5ED7C81A' }, fighterImage: { width: '55%', height: 225, position: 'absolute', right: -5, bottom: -5 }, fighterName: { color: '#F6F4ED', fontSize: 22, fontWeight: '900', width: '63%' },
  miniStats: { flexDirection: 'row', gap: 20 }, statLabel: { color: '#7F8CA5', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, statValue: { color: '#EAEFF5', fontSize: 18, fontWeight: '800' }, change: { alignSelf: 'flex-start', paddingVertical: 8 }, link: { color: '#C7BDD9', fontSize: 11, fontWeight: '700' },
  section: { color: '#EEEAF5', fontSize: 15, fontWeight: '800' }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4 },
  levels: { flexDirection: 'row', gap: 8 }, level: { flex: 1, backgroundColor: '#191D30', borderColor: '#30354C', borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 }, levelActive: { borderColor: '#C3A26E', backgroundColor: '#302C31' }, levelName: { color: '#A0A7BF', fontSize: 12, fontWeight: '800' }, levelReward: { color: '#EEE3CE', fontWeight: '900', fontSize: 24 }, levelHint: { color: '#9094AA', fontSize: 9, lineHeight: 15 },
  button: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBC88D', borderRadius: 13 }, buttonText: { color: '#292133', fontSize: 13, fontWeight: '900' }, quiet: { backgroundColor: '#252A40', borderWidth: 1, borderColor: '#3C4058' },
  tip: { color: '#8E97B3', fontSize: 11, lineHeight: 19 }, moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, move: { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 17, padding: 16, gap: 10, minHeight: 116 }, moveTitle: { color: '#EEEAF5', fontWeight: '800', fontSize: 14 }, moveDetail: { color: '#A0A6C0', fontSize: 10, lineHeight: 16 },
  card: { backgroundColor: '#1A1F32', borderRadius: 18, padding: 18, gap: 12 }, friend: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#1A1F32', borderRadius: 16 }, friendName: { color: '#E3DFF0', fontSize: 13, fontWeight: '700', flex: 1 },
  result: { alignItems: 'stretch', backgroundColor: '#262435', borderRadius: 20, borderColor: '#5C4A40', borderWidth: 1, padding: 24, gap: 15 }, resultTitle: { color: '#F8E6C5', fontSize: 28, fontWeight: '900' },
  history: { backgroundColor: '#191D30', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, historyTitle: { color: '#E9CA92', fontSize: 12, fontWeight: '800' }, historyBody: { color: '#A7ABC2', fontSize: 11, flex: 1, lineHeight: 18 },
  guideToggle: { paddingVertical: 15, alignItems: 'center' }, pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#222840', padding: 14, borderRadius: 14 },
  error: { color: '#FF9FA9', lineHeight: 21, fontSize: 12 }, toast: { color: '#86E0CD', lineHeight: 21, fontSize: 12 },
});
