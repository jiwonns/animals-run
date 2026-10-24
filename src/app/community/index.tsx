import { useRefreshRevision } from '@/lib/app-refresh';
import { useCatalog } from '@/providers/catalog-provider';
import { FlatList, ScrollView } from '@/components/refreshable';
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthorLine, CommunityEmpty } from "@/components/community-ui";
import { PostAttachments } from "@/components/community-attachments";
import { Icon, ICONS } from "@/components/icon";
import { RunningLoader } from "@/components/running-loader";
import { useColors } from "@/hooks/use-colors";
import { TOPICS, watchPosts, type Post } from "@/lib/community";
import { TOPIC_CONFIG } from "@/lib/community-topics";

export default function CommunityScreen() {
  const refreshRevision=useRefreshRevision();
  useCatalog();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("전체");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(
    () =>
      watchPosts(
        (p) => {
          setPosts(p);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [retry, refreshRevision],
  );
  const config = topic === "전체" ? null : TOPIC_CONFIG[topic];
  const accent = config?.color ?? c.primary;
  const compose = () =>
    router.push({
      pathname: "/community/new",
      params: topic === "전체" ? {} : { topic },
    });
  const shown =
    posts?.filter((p) => topic === "전체" || p.topic === topic) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: "커뮤니티",
          headerShown: true,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <View style={{ padding: 20, gap: 23 }}>
            <View style={[s.hero, { backgroundColor: c.surface }]}>
              <View style={{ flex: 1, gap: 10 }}>
                <Text
                  style={{
                    color: accent,
                    fontWeight: "900",
                    fontSize: 11,
                    letterSpacing: 2,
                  }}
                >
                  {config?.eyebrow ?? "ANIMALS CLUB"}
                </Text>
                <Text style={[s.heroTitle, { color: c.text }]}>
                  {config?.title ?? "같이 걷고,\n함께 떠들어요."}
                </Text>
                <Text
                  style={{ color: c.secondary, lineHeight: 20, fontSize: 12 }}
                >
                  {config?.hint ??
                    "오늘의 발견부터 뽑기 자랑까지\n우리 동네 친구들의 이야기"}
                </Text>
              </View>
              <View style={s.heroArt}>
                <Icon name={ICONS.community} size={44} color="#FF5A1F" />
                <View style={s.spark}>
                  <Icon name={ICONS.character} size={23} color="#fff" />
                </View>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {TOPICS.map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: topic === t }}
                  onPress={() => setTopic(t)}
                  style={[
                    s.chip,
                    { backgroundColor: topic === t ? accent : c.surface },
                  ]}
                >
                  <Text
                    style={{
                      color: topic === t ? "#fff" : c.secondary,
                      fontWeight: "800",
                      fontSize: 13,
                    }}
                  >
                    {t === "자랑"
                      ? "✨ 자랑"
                      : t === "산책"
                        ? "🌿 산책"
                        : t === "질문"
                          ? "💬 질문"
                          : t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={s.between}>
              <Text style={{ color: c.text, fontWeight: "800", fontSize: 17 }}>
                {topic === "전체" ? "지금, 친구들의 이야기" : `${topic} 이야기`}
              </Text>
              <Text style={{ color: c.secondary, fontSize: 11 }}>
                최신순 · 실시간
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.card, { borderColor: c.border }]}>
            <AuthorLine author={item} time={item.createdAt} />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/community/[id]",
                  params: { id: item.id },
                })
              }
              style={{ gap: 9, paddingTop: 14 }}
            >
              <Text
                style={{
                  color: TOPIC_CONFIG[item.topic]?.color ?? c.primary,
                  fontSize: 11,
                  fontWeight: "800",
                }}
              >
                {item.topic}
                {item.questionTag ? ` · ${item.questionTag}` : ""}
              </Text>
              <Text
                style={{
                  color: c.text,
                  fontSize: 18,
                  fontWeight: "800",
                  lineHeight: 25,
                }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text
                style={{ color: c.secondary, fontSize: 14, lineHeight: 22 }}
                numberOfLines={3}
              >
                {item.body}
              </Text>
              <PostAttachments post={item} compact />
              <View style={[s.between, { marginTop: 7 }]}>
                <View style={s.inline}>
                  <Icon name={ICONS.heart} size={15} color={c.secondary} />
                  <Text style={{ color: c.secondary, fontSize: 12 }}>
                    공감하고 이야기 나누기
                  </Text>
                </View>
                <Icon name={ICONS.chevron} size={16} color={c.secondary} />
              </View>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          failed ? (
            <CommunityEmpty
              title="이야기를 불러오지 못했어요"
              body="연결을 확인하고 다시 시도해주세요."
              action="다시 시도"
              onPress={() => setRetry((n) => n + 1)}
            />
          ) : !posts ? (
            <RunningLoader label="친구들의 이야기를 불러오는 중" />
          ) : (
            <CommunityEmpty
              title="첫 이야기를 들려주세요"
              body={
                config?.hint ?? "오늘 만난 동물이나 산책 이야기를 남겨보세요."
              }
              action="첫 글 쓰기"
              onPress={compose}
            />
          )
        }
        ListFooterComponent={
          shown.length ? (
            <Text
              style={{
                color: c.secondary,
                textAlign: "center",
                padding: 24,
                fontSize: 11,
              }}
            >
              최근 이야기 60개를 보여드려요
            </Text>
          ) : undefined
        }
      />
      <Pressable
        accessibilityRole="button"
        onPress={compose}
        style={[s.fab, { backgroundColor: accent, bottom: insets.bottom + 18 }]}
      >
        <Icon name={ICONS.edit} size={21} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
          글쓰기
        </Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    borderRadius: 28,
    padding: 23,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroArt: {
    width: 94,
    height: 105,
    borderRadius: 32,
    backgroundColor: "#FFE3D4",
    transform: [{ rotate: "9deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  spark: {
    position: "absolute",
    right: -8,
    bottom: -9,
    backgroundColor: "#FF5A1F",
    borderRadius: 18,
    padding: 10,
  },
  chip: { paddingVertical: 11, paddingHorizontal: 19, borderRadius: 18 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  card: {
    marginHorizontal: 20,
    paddingVertical: 21,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  animal: {
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 16,
    marginTop: 5,
  },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 23,
    elevation: 5,
    boxShadow: "0 6px 18px #FF5A1F33",
  },
});
