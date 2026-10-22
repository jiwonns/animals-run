import { useCatalog } from '@/providers/catalog-provider';
import { Image } from '@/components/gacha-image';
import { Stack, useLocalSearchParams } from "expo-router";
import { getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { AvatarFace } from "@/components/avatar-face";
import { FriendActions } from '@/components/friend-actions';
import { EquippedMedal, MedalShowcaseList } from '@/components/medal-showcase';
import { MoreButton } from '@/components/more-button';
import { PagedListSheet } from '@/components/paged-list-sheet';
import { CharacterCard } from '@/components/character-card';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { useMedalShowcase } from '@/hooks/use-medal-showcase';
import { CommunityEmpty } from "@/components/community-ui";
import { Icon, ICONS } from "@/components/icon";
import { RunningLoader } from "@/components/running-loader";
import {
  CHARACTER_BY_ID,
  GRADES,
  GRADE_ORDER,
} from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import { locationRef, displayName } from "@/lib/profile";
import { rankingRef, type RankingEntry } from "@/lib/ranking";
import { kindsByGrade, profileAnimals } from '@/lib/inventory';
import { useSession } from '@/providers/session-provider';

export default function PlayerScreen() {
  useCatalog();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const {user,profile}=useSession();
  const isSelf=uid===user?.uid;
  const c = useColors();
  const showcase = useMedalShowcase(uid);
  const [expandedAnimalsFor, setExpandedAnimalsFor] = useState<string | null>(null);
  const expandedAnimals = expandedAnimalsFor === uid;
  const cellWidth = useGridCellWidth(3, 16, 12);
  const [remoteEntry, setEntry] = useState<RankingEntry | null | undefined>();
  const [loadedUid,setLoadedUid]=useState<string|null>(null);
  const [loadFailed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if(!uid||isSelf)return;
    let live = true;
    async function load() {
      try {
        const snap = await getDoc(rankingRef(uid));
        let data = snap.exists() ? (snap.data() as RankingEntry) : null;
        if (!data) {
          const location = await getDoc(locationRef(uid));
          if (location.exists())
            data = {
              ...location.data(),
              steps: 0,
              characters: {},
              hatchCount: 0,
              evolveCount: 0,
              fuseCount: 0,
              recycleCount: 0,
            } as RankingEntry;
        }
        if (live) {
          setEntry(data);
          setLoadedUid(uid);
          setFailed(false);
        }
      } catch {
        if (live) {setFailed(true);setLoadedUid(uid);}
      }
    }
    if (uid) void load();
    return () => {
      live = false;
    };
  }, [uid, retry,isSelf]);
  const entry:RankingEntry|null|undefined=isSelf ? profile ? {username:profile.username,nickname:profile.nickname,avatar:profile.avatar??null,steps:profile.steps??0,characters:profile.characters,hatchCount:profile.hatchCount??0,evolveCount:profile.evolveCount??0,fuseCount:profile.fuseCount??0,recycleCount:profile.recycleCount??0,updatedAt:null} : undefined : loadedUid===uid ? remoteEntry : undefined;
  const failed=!isSelf&&loadedUid===uid&&loadFailed;
  const owned = profileAnimals(entry?.characters ?? {});
  const grades = kindsByGrade(entry?.characters ?? {});
  const avatar = entry?.avatar ? CHARACTER_BY_ID[entry.avatar] : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: isSelf ? '내 프로필' : '친구 프로필',
          headerShown: true,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      {failed ? (
        <CommunityEmpty
          title="프로필을 불러오지 못했어요"
          body="연결 상태를 확인하고 다시 시도해주세요."
          action="다시 시도"
          onPress={() => setRetry((v) => v + 1)}
        />
      ) : entry === undefined ? (
        <RunningLoader label="프로필을 불러오는 중" />
      ) : !entry ? (
        <CommunityEmpty
          title="아직 공개 프로필이 없어요"
          body="친구가 앱에 접속하면 프로필이 업데이트돼요."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 22, gap: 24, paddingBottom: 45 }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: c.surface,
              borderRadius: 30,
              padding: 30,
              gap: 12,
            }}
          >
            <AvatarFace
              avatar={entry.avatar}
              size={108}
              fallback={displayName(entry)}
              borderColor={c.primary}
            />
            <Text style={{ color: c.text, fontSize: 25, fontWeight: "900" }}>
              {displayName(entry)}
            </Text>
            <EquippedMedal showcase={showcase} />
            <FriendActions targetUid={uid} target={entry} />
            <View
              style={{
                flexDirection: "row",
                gap: 5,
                alignItems: "center",
                backgroundColor: "#FF5A1F15",
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 14,
              }}
            >
              <Icon name={ICONS.character} size={14} color={c.primary} />
              <Text
                style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}
              >
                {avatar ? `${avatar.name}와 함께 걷는 중` : "새로운 산책 친구"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              { label: "누적 걸음", value: entry.steps ?? 0, unit: '걸음', icon: ICONS.walk },
              { label: "보유 동물", value: owned.length, unit: '종', icon: ICONS.dex },
            ].filter(stat=>stat.unit!=='종'||stat.value>0).map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: c.surface,
                  padding: 20,
                  borderRadius: 23,
                  gap: 10,
                }}
              >
                <Icon name={stat.icon} size={22} color={c.primary} />
                <Text
                  style={{ color: c.text, fontSize: 25, fontWeight: "900" }}
                >
                  {stat.value.toLocaleString()}<Text style={{ fontSize: 13 }}> {stat.unit}</Text>
                </Text>
                <Text style={{ color: c.secondary, fontSize: 12 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c.text, fontWeight: "800", fontSize: 19 }}>
            {isSelf?'나의 발자취':'친구의 발자취'}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "부화", value: entry.hatchCount },
              { label: "진화", value: entry.evolveCount },
              { label: "합성", value: entry.fuseCount },
              { label: "재활용", value: entry.recycleCount },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  minWidth: "45%",
                  flexGrow: 1,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  backgroundColor: c.surface,
                  padding: 17,
                  borderRadius: 18,
                }}
              >
                <Text style={{ color: c.secondary }}>{stat.label}</Text>
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  {(stat.value ?? 0).toLocaleString()}회
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GRADE_ORDER.filter((g) => grades[g] > 0).map((g) => (
              <View
                key={g}
                style={{
                  backgroundColor: `${GRADES[g].color}18`,
                  padding: 9,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: GRADES[g].color,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {GRADES[g].label} {grades[g]}종
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c.text, fontWeight: "800", fontSize: 19 }}>
            함께하는 동물{" "}
            {owned.length>0&&<Text style={{ color: c.primary }}>{owned.length}종</Text>}
          </Text>
          {owned.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {owned.slice(0, 6).map((animal) => (
                <View
                  key={animal.id}
                  accessibilityLabel={`${animal.name}, ${GRADES[animal.grade].label} 등급`}
                  style={{
                    width: "30.5%",
                    flexGrow: 0,
                    alignItems: "center",
                    backgroundColor: c.surface,
                    borderRadius: 19,
                    padding: 9,
                    gap: 5,
                  }}
                >
                  <Image
                    source={animal.thumb}
                    style={{ width: "100%", aspectRatio: 1 }}
                    contentFit="contain"
                  />
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {animal.name}
                  </Text>
                  <Text style={{ color: GRADES[animal.grade].color, fontSize: 10, fontWeight: '700' }}>
                    {GRADES[animal.grade].label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: c.secondary }}>
              아직 공개된 동물이 없어요.
            </Text>
          )}
          {owned.length > 6 && <MoreButton expanded={expandedAnimals} onPress={() => setExpandedAnimalsFor(expandedAnimals ? null : uid)} remaining={owned.length - 6} label="동물 더보기" unit="종" />}
          {expandedAnimals && <PagedListSheet key={uid} title={`함께하는 동물 ${owned.length}종`} data={owned} keyExtractor={a => a.id} columns={3} renderItem={({ item }) => <CharacterCard character={item} width={cellWidth} />} onClose={() => setExpandedAnimalsFor(null)} />}
          <MedalShowcaseList key={uid} showcase={showcase} />
        </ScrollView>
      )}
    </View>
  );
}
