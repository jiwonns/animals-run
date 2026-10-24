import { ScrollView } from '@/components/refreshable';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommunityAnimalPicker } from "./community-animal-picker";
import { WalkShareCard } from "./community-attachments";
import { communityStyles as s } from "./community-ui";
import { Icon, ICONS } from "./icon";
import { CHARACTER_BY_ID, type CharacterId } from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import { publishPost, TOPICS, type Topic } from "@/lib/community";
import {
  MAX_PHOTOS,
  preparePhoto,
  type DraftPhoto,
} from "@/lib/community-photos";
import { pickCommunityPhotos } from "@/lib/community-photo-picker";
import {
  localDate,
  QUESTION_TAGS,
  TOPIC_CONFIG,
  type QuestionTag,
  type WalkShare,
} from "@/lib/community-topics";
import { useSession } from "@/providers/session-provider";
import { useWalk } from "@/providers/walk-provider";

export function CommunityCompose() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ topic?: string }>();
  const { user, profile } = useSession();
  const walkState = useWalk();
  const [topic, setTopic] = useState<Topic>(
    TOPICS.includes(params.topic as Topic) && params.topic !== "전체"
      ? (params.topic as Topic)
      : "자유",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [animals, setAnimals] = useState<CharacterId[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [questionTag, setQuestionTag] = useState<QuestionTag>("뽑기");
  const [walkKind, setWalkKind] = useState<"today" | "total">(
    walkState.pedometer === "ready" ? "today" : "total",
  );
  const [goal, setGoal] = useState(5000);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);
  const photoLock = useRef(false);
  const config = TOPIC_CONFIG[topic];
  const selected = animals
    .filter((id) => (profile?.characters[id] ?? 0) > 0)
    .slice(0, topic === "산책" ? 1 : 3);
  const canToday = walkState.pedometer === "ready";
  const kind = walkKind === "today" && canToday ? "today" : "total";
  const walk: WalkShare = {
    kind,
    steps: Math.floor(
      kind === "today" ? walkState.todaySteps : (profile?.steps ?? 0),
    ),
    goal,
    date: localDate(),
  };
  const canPublish =
    !!user &&
    !!profile &&
    !!title.trim() &&
    !!body.trim() &&
    !busy &&
    !picking &&
    (topic !== "자랑" || selected.length > 0);
  async function choosePhotos() {
    if (photoLock.current || photos.length >= MAX_PHOTOS) return;
    photoLock.current = true;
    try {
      const assets = await pickCommunityPhotos(MAX_PHOTOS - photos.length);
      setPicking(true);
      const next: DraftPhoto[] = [];
      for (const asset of assets) next.push(await preparePhoto(asset));
      setPhotos((current) => [...current, ...next].slice(0, MAX_PHOTOS));
    } catch (error) {
      Alert.alert(
        "사진을 가져오지 못했어요",
        error instanceof Error && !error.message.includes("native module")
          ? error.message
          : "앱을 최신 버전으로 업데이트한 뒤 다시 시도해주세요.",
      );
    } finally {
      photoLock.current = false;
      setPicking(false);
    }
  }
  async function publish() {
    if (!canPublish || !user || !profile || lock.current || photoLock.current)
      return;
    lock.current = true;
    setBusy(true);
    try {
      const ids = topic === "자랑" || topic === "산책" ? selected : [];
      const post = await publishPost(user.uid, profile, {
        topic,
        title,
        body,
        character: ids[0] ?? null,
        characters: ids,
        photos: topic === "자랑" ? [] : photos,
        walk: topic === "산책" ? walk : null,
        questionTag: topic === "질문" ? questionTag : null,
      });
      router.replace({ pathname: "/community/[id]", params: { id: post.id } });
    } catch (error) {
      Alert.alert(
        "글을 올리지 못했어요",
        error instanceof Error && !("code" in error)
          ? error.message
          : "연결을 확인하고 다시 시도해주세요. 작성한 내용은 그대로 있어요.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <Stack.Screen
        options={{
          title: `${topic} 이야기 쓰기`,
          headerShown: true,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              disabled={!canPublish}
              onPress={publish}
              accessibilityRole="button"
              style={{ padding: 12 }}
            >
              <Text
                style={{
                  color: canPublish ? config.color : c.secondary,
                  fontWeight: "800",
                }}
              >
                {busy ? "올리는 중" : "게시"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 19, paddingBottom: 30 }}
      >
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {TOPICS.filter((t) => t !== "전체").map((t) => (
            <Pressable
              key={t}
              disabled={busy || picking}
              onPress={() => setTopic(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: topic === t }}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 11,
                borderRadius: 15,
                backgroundColor:
                  topic === t ? TOPIC_CONFIG[t].color : c.surface,
              }}
            >
              <Text
                style={{
                  color: topic === t ? "#fff" : c.secondary,
                  fontWeight: "800",
                }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={{
            gap: 8,
            padding: 20,
            borderRadius: 23,
            backgroundColor: `${config.color}12`,
          }}
        >
          <Text
            style={{
              color: config.color,
              fontSize: 11,
              letterSpacing: 1.5,
              fontWeight: "900",
            }}
          >
            {config.eyebrow}
          </Text>
          <Text style={{ color: c.text, fontSize: 23, fontWeight: "900" }}>
            {config.title}
          </Text>
          <Text style={{ color: c.secondary, fontSize: 12, lineHeight: 20 }}>
            {config.hint}
          </Text>
        </View>
        {topic === "질문" && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontWeight: "800" }}>
              어떤 분야가 궁금한가요?
            </Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {QUESTION_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  disabled={busy}
                  onPress={() => setQuestionTag(tag)}
                  style={{
                    padding: 11,
                    borderRadius: 13,
                    backgroundColor:
                      tag === questionTag ? "#0EA5E91A" : c.surface,
                  }}
                >
                  <Text
                    style={{
                      color: tag === questionTag ? "#0EA5E9" : c.secondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {topic === "산책" && (
          <View style={{ gap: 12 }}>
            <View style={s.row}>
              {(["today", "total"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  disabled={busy || (mode === "today" && !canToday)}
                  onPress={() => setWalkKind(mode)}
                  style={{
                    flex: 1,
                    padding: 13,
                    borderRadius: 16,
                    backgroundColor: kind === mode ? "#10B98120" : c.surface,
                    opacity: mode === "today" && !canToday ? 0.45 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: kind === mode ? "#10B981" : c.secondary,
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    {mode === "today" ? "오늘 걸음" : "누적 걸음"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!canToday && (
              <Text style={{ color: c.secondary, fontSize: 12 }}>
                이 기기에서는 오늘 걸음 대신 계정의 누적 기록을 공유해요.
              </Text>
            )}
            <WalkShareCard walk={walk} />
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
              공유할 걸음 목표
            </Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {[1000, 3000, 5000, 10000].map((value) => (
                <Pressable
                  key={value}
                  disabled={busy}
                  onPress={() => setGoal(value)}
                  style={{
                    padding: 11,
                    borderRadius: 12,
                    backgroundColor: goal === value ? "#10B98120" : c.surface,
                  }}
                >
                  <Text
                    style={{
                      color: goal === value ? "#10B981" : c.secondary,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {value.toLocaleString()}걸음
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {(topic === "자랑" || topic === "산책") && (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontWeight: "800" }}>
                {topic === "자랑"
                  ? `자랑할 동물 ${selected.length}/3`
                  : "함께 걷는 동물 · 선택"}
              </Text>
              <Pressable
                disabled={busy}
                onPress={() => setPicker(true)}
                style={{
                  backgroundColor: `${config.color}18`,
                  padding: 12,
                  borderRadius: 13,
                }}
              >
                <Text
                  style={{
                    color: config.color,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  검색해서 고르기
                </Text>
              </Pressable>
            </View>
            {selected.length ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {selected.map((id) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={`${CHARACTER_BY_ID[id].name} 선택 해제`}
                    disabled={busy}
                    onPress={() =>
                      setAnimals((current) => current.filter((a) => a !== id))
                    }
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 18,
                      backgroundColor: c.surface,
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Image
                      source={CHARACTER_BY_ID[id].thumb}
                      contentFit="contain"
                      style={{ width: "100%", aspectRatio: 1, maxHeight: 120 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: c.text, fontWeight: "700", fontSize: 11 }}
                    >
                      {CHARACTER_BY_ID[id].name} ×
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                onPress={() => setPicker(true)}
                disabled={busy}
                style={{
                  backgroundColor: c.surface,
                  padding: 25,
                  borderRadius: 20,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name={ICONS.character} size={28} color={config.color} />
                <Text
                  style={{
                    color: c.secondary,
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  등급 필터와 검색으로 빠르게 골라보세요.
                  {topic === "자랑"
                    ? "\n자랑 글에는 동물을 1마리 이상 골라주세요."
                    : ""}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        <TextInput
          accessibilityLabel="글 제목"
          placeholder={config.titlePlaceholder}
          placeholderTextColor={c.secondary}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          editable={!busy}
          style={[
            s.input,
            {
              color: c.text,
              backgroundColor: c.surface,
              fontWeight: "800",
              fontSize: 19,
            },
          ]}
        />
        <TextInput
          accessibilityLabel="글 내용"
          placeholder={config.bodyPlaceholder}
          placeholderTextColor={c.secondary}
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          editable={!busy}
          style={[
            s.input,
            { color: c.text, backgroundColor: c.surface, minHeight: 180 },
          ]}
        />
        <Text style={{ color: c.secondary, textAlign: "right", fontSize: 11 }}>
          {body.length.toLocaleString()} / 2,000
        </Text>
        {topic !== "자랑" && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: c.text, fontWeight: "800" }}>
              {topic === "질문"
                ? "상황을 보여줄 사진"
                : topic === "산책"
                  ? "산책 풍경"
                  : "오늘의 사진"}{" "}
              · {photos.length}/{MAX_PHOTOS}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {photos.map((photo, index) => (
                <View
                  key={`${photo.uri}-${index}`}
                  style={{ width: "30%", aspectRatio: 1 }}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    contentFit="cover"
                    style={{ width: "100%", height: "100%", borderRadius: 16 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${index + 1}번째 사진 삭제`}
                    disabled={busy || picking}
                    onPress={() =>
                      setPhotos((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      backgroundColor: "#0009",
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>×</Text>
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || picking}
                  onPress={choosePhotos}
                  style={{
                    width: "30%",
                    aspectRatio: 1,
                    borderRadius: 16,
                    backgroundColor: c.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <Icon name={ICONS.plus} size={25} color={config.color} />
                  <Text style={{ color: c.secondary, fontSize: 12 }}>
                    {picking ? "사진 준비 중…" : "사진 추가"}
                  </Text>
                </Pressable>
              )}
            </View>
            <Text style={{ color: c.secondary, fontSize: 11 }}>
              사진은 최대 3장까지 올릴 수 있어요.
            </Text>
          </View>
        )}
      </ScrollView>
      <View
        style={{
          padding: 16,
          paddingBottom: Math.max(16, insets.bottom),
          borderTopWidth: 1,
          borderColor: c.border,
        }}
      >
        <Pressable
          disabled={!canPublish}
          accessibilityRole="button"
          onPress={publish}
          style={[
            s.button,
            { backgroundColor: canPublish ? config.color : c.surface },
          ]}
        >
          <Text style={[s.buttonText, !canPublish && { color: c.secondary }]}>
            {busy
              ? "이야기를 올리고 있어요…"
              : topic === "산책"
                ? "산책 기록 공유하기"
                : topic === "자랑"
                  ? "내 동물 자랑하기"
                  : topic === "질문"
                    ? "친구들에게 질문하기"
                    : "일상 나누기"}
          </Text>
        </Pressable>
      </View>
      {picker && (
        <CommunityAnimalPicker
          selected={selected}
          maximum={topic === "산책" ? 1 : 3}
          onClose={() => setPicker(false)}
          onDone={(ids) => {
            setAnimals(ids);
            setPicker(false);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
