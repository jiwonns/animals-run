import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, ICONS } from "./icon";
import { CHARACTER_BY_ID, GRADES } from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import type { Post } from "@/lib/community";
import { loadPostPhoto } from "@/lib/community-photos";
import type { WalkShare } from "@/lib/community-topics";

export function CommunityPhoto({
  postId,
  photoId,
  compact = false,
}: {
  postId: string;
  photoId: string;
  compact?: boolean;
}) {
  const c = useColors();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    loadPostPhoto(postId, photoId)
      .then((data) => {
        if (live) {
          setUri(data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [postId, photoId, attempt]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={failed ? "사진 다시 불러오기" : "사진 크게 보기"}
        onPress={() =>
          uri ? setOpen(true) : failed && setAttempt((n) => n + 1)
        }
        style={{
          backgroundColor: c.surface,
          borderRadius: 20,
          height: compact ? 190 : 270,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Text style={{ color: c.secondary }}>
            {failed
              ? "사진을 다시 불러오려면 눌러주세요"
              : "사진을 불러오는 중…"}
          </Text>
        )}
      </Pressable>
      <Modal
        visible={open}
        onRequestClose={() => setOpen(false)}
        animationType="fade"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            style={{ alignSelf: "flex-end", padding: 20 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>닫기</Text>
          </Pressable>
          {uri && (
            <Image source={{ uri }} contentFit="contain" style={{ flex: 1 }} />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

export function WalkShareCard({
  walk,
  compact = false,
}: {
  walk: WalkShare;
  compact?: boolean;
}) {
  const c = useColors();
  const ratio = Math.min(1, walk.steps / walk.goal);
  return (
    <View
      style={{
        padding: compact ? 18 : 23,
        gap: 12,
        backgroundColor: "#10B98113",
        borderRadius: 23,
        borderWidth: 1,
        borderColor: "#10B98125",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={ICONS.walk} size={21} color="#10B981" />
        <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "800" }}>
          {walk.kind === "today" ? "오늘의 산책" : "누적 발자국"} · {walk.date}
        </Text>
      </View>
      <Text
        style={{
          color: c.text,
          fontWeight: "900",
          fontSize: compact ? 29 : 38,
        }}
      >
        {walk.steps.toLocaleString()}
        <Text style={{ color: "#10B981", fontSize: 15 }}> 걸음</Text>
      </Text>
      <View
        style={{
          height: 7,
          borderRadius: 7,
          backgroundColor: "#10B98120",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${ratio * 100}%`,
            backgroundColor: "#10B981",
            borderRadius: 7,
          }}
        />
      </View>
      <Text style={{ color: c.secondary, fontSize: 12 }}>
        {walk.goal.toLocaleString()}걸음 목표 · {Math.floor(ratio * 100)}% 달성
        {walk.steps >= walk.goal ? " 🎉" : ""}
      </Text>
    </View>
  );
}

export function PostAttachments({
  post,
  compact = false,
}: {
  post: Post;
  compact?: boolean;
}) {
  const c = useColors();
  const ids = [
    ...new Set(post.characters ?? (post.character ? [post.character] : [])),
  ];
  const animals = ids.map((id) => CHARACTER_BY_ID[id]).filter(Boolean);
  return (
    <View style={{ gap: 12 }}>
      {post.walk && <WalkShareCard walk={post.walk} compact={compact} />}
      {!!animals.length && (
        <View
          style={{
            backgroundColor: post.topic === "자랑" ? "#A855F710" : c.surface,
            padding: 16,
            borderRadius: 23,
            gap: 13,
          }}
        >
          <Text
            style={{
              color: post.topic === "자랑" ? "#A855F7" : c.primary,
              fontSize: 11,
              fontWeight: "900",
            }}
          >
            {post.topic === "자랑"
              ? "MY ANIMALS · 오늘의 주인공"
              : "함께 걷는 친구"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {animals.map((a) => (
              <View
                key={a.id}
                style={{ flex: 1, alignItems: "center", gap: 5 }}
              >
                <Image
                  source={compact ? a.thumb : a.image}
                  contentFit="contain"
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    maxHeight: compact ? 105 : 180,
                  }}
                />
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontWeight: "800", fontSize: 12 }}
                >
                  {a.name}
                </Text>
                <Text
                  style={{
                    color: GRADES[a.grade].color,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {GRADES[a.grade].label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {(compact ? post.photos?.slice(0, 1) : post.photos)?.map((photoId) => (
        <View key={photoId}>
          <CommunityPhoto
            postId={post.id}
            photoId={photoId}
            compact={compact}
          />
          {compact && post.photos!.length > 1 && (
            <View
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                backgroundColor: "#0009",
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                사진 {post.photos!.length}장
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
