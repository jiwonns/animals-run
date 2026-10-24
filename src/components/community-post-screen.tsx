import { FlatList } from '@/components/refreshable';
import { router, Stack, useLocalSearchParams } from "expo-router";
import { deleteDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PostAttachments } from "./community-attachments";
import { CommunityComment } from "./community-comment";
import {
  AuthorLine,
  CommunityEmpty,
  communityStyles as s,
} from "./community-ui";
import { Icon, ICONS } from "./icon";
import { RunningLoader } from "./running-loader";
import { useColors } from "@/hooks/use-colors";
import { useCommunityComments } from "@/hooks/use-community-comments";
import {
  likesRef,
  postRef,
  publishComment,
  setLiked,
  type CommentRow,
  type Post,
} from "@/lib/community";
import { TOPIC_CONFIG } from "@/lib/community-topics";
import { useSession } from "@/providers/session-provider";

export function CommunityPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { user, profile } = useSession();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ id: string; post: Post | null } | null>(
    null,
  );
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const post = state?.id === id ? state.post : undefined;
  const postExists = !!post;
  const {
    comments,
    rows,
    failed: commentsFailed,
  } = useCommunityComments(id, postExists);
  const [likes, setLikes] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<{
    parentId: string;
    replyTo: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [liking, setLiking] = useState(false);
  const sendLock = useRef(false);
  const likeLock = useRef(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const list = useRef<FlatList<CommentRow>>(null);
  useEffect(
    () =>
      onSnapshot(
        postRef(id),
        (snapshot) => {
          setState({
            id,
            post: snapshot.exists()
              ? ({ ...snapshot.data(), id: snapshot.id } as Post)
              : null,
          });
          setFailedAt(null);
        },
        () => setFailedAt(id),
      ),
    [id],
  );
  useEffect(() => {
    if (!postExists) return;
    return onSnapshot(
      likesRef(id),
      (snapshot) => setLikes(snapshot.docs.map((d) => d.id)),
      () => {},
    );
  }, [id, postExists]);
  async function send() {
    if (!user || !profile || !text.trim() || !post || sendLock.current) return;
    sendLock.current = true;
    setBusy(true);
    try {
      await publishComment(id, user.uid, profile, text, target ?? undefined);
      setText("");
      setTarget(null);
    } catch {
      Alert.alert(
        "댓글을 남기지 못했어요",
        target
          ? "원댓글이 삭제되었거나 연결이 끊겼을 수 있어요. 내용을 확인하고 다시 시도해주세요."
          : "연결 상태를 확인하고 다시 시도해주세요.",
      );
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  }
  async function like() {
    if (!user || likeLock.current || !post) return;
    likeLock.current = true;
    setLiking(true);
    try {
      await setLiked(id, user.uid, !likes.includes(user.uid));
    } catch {
      Alert.alert("좋아요를 저장하지 못했어요", "연결 상태를 확인해주세요.");
    } finally {
      likeLock.current = false;
      setLiking(false);
    }
  }
  function remove() {
    Alert.alert("이 글을 삭제할까요?", "삭제한 글은 다시 볼 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(postRef(id));
            router.back();
          } catch {
            Alert.alert("삭제하지 못했어요", "잠시 후 다시 시도해주세요.");
          }
        },
      },
    ]);
  }
  const deletedRoots = new Set(
    rows
      .filter((row) => !row.reply && row.comment.deleted)
      .map((row) => row.rootId),
  );
  const accent = post
    ? (TOPIC_CONFIG[post.topic]?.color ?? c.primary)
    : c.primary;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      <Stack.Screen
        options={{
          title: post?.topic === "질문" ? "친구의 질문" : "친구의 이야기",
          headerShown: true,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
          headerRight: () =>
            post?.uid === user?.uid ? (
              <Pressable
                accessibilityRole="button"
                onPress={remove}
                style={{ padding: 12 }}
              >
                <Text style={{ color: c.danger }}>삭제</Text>
              </Pressable>
            ) : null,
        }}
      />
      {failedAt === id ? (
        <CommunityEmpty
          title="이야기를 불러오지 못했어요"
          body="연결 상태를 확인하고 다시 열어주세요."
        />
      ) : post === undefined ? (
        <RunningLoader label="이야기를 펼치는 중" />
      ) : post === null ? (
        <CommunityEmpty
          title="삭제된 이야기예요"
          body="다른 친구들의 이야기를 만나보세요."
        />
      ) : (
        <>
          <FlatList
            ref={list}
            data={rows}
            keyExtractor={(row) => row.comment.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            windowSize={7}
            contentContainerStyle={{ padding: 20, gap: 15, paddingBottom: 25 }}
            ListHeaderComponent={
              <View style={{ gap: 19, paddingBottom: 18 }}>
                <AuthorLine author={post} time={post.createdAt} />
                <Text
                  style={{ color: accent, fontWeight: "800", fontSize: 12 }}
                >
                  {post.topic}
                  {post.questionTag ? ` · ${post.questionTag}` : ""}
                </Text>
                <Text
                  style={{
                    color: c.text,
                    fontWeight: "900",
                    fontSize: 25,
                    lineHeight: 34,
                  }}
                >
                  {post.title}
                </Text>
                <Text
                  selectable
                  style={{ color: c.text, fontSize: 16, lineHeight: 28 }}
                >
                  {post.body}
                </Text>
                <PostAttachments post={post} />
                <View style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="게시글 좋아요"
                    accessibilityState={{
                      selected: !!user && likes.includes(user.uid),
                    }}
                    disabled={liking}
                    onPress={like}
                    style={[
                      s.row,
                      {
                        backgroundColor:
                          user && likes.includes(user.uid)
                            ? "#FF5A1F18"
                            : c.surface,
                        padding: 13,
                        borderRadius: 16,
                      },
                    ]}
                  >
                    <Icon
                      name={ICONS.heart}
                      size={18}
                      color={
                        user && likes.includes(user.uid)
                          ? c.primary
                          : c.secondary
                      }
                    />
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      좋아요 {likes.length}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => input.current?.focus()}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: c.secondary }}>
                      {post.topic === "질문" ? "답변" : "댓글"}{" "}
                      {comments.length}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ height: 1, backgroundColor: c.border }} />
                <Text
                  style={{ color: c.text, fontWeight: "800", fontSize: 17 }}
                >
                  {post.topic === "질문" ? "친구들의 답변" : "친구들의 한마디"}{" "}
                  <Text style={{ color: accent }}>{comments.length}</Text>
                </Text>
                {commentsFailed ? (
                  <Text style={{ color: c.secondary }}>
                    댓글을 불러오지 못했어요. 연결을 확인해주세요.
                  </Text>
                ) : (
                  !comments.length && (
                    <Text style={{ color: c.secondary, fontSize: 13 }}>
                      첫 {post.topic === "질문" ? "답변" : "댓글"}을 남겨주세요.
                    </Text>
                  )
                )}
              </View>
            }
            renderItem={({ item }) => (
              <CommunityComment
                postId={id}
                row={item}
                rootDeleted={deletedRoots.has(item.rootId)}
                onReply={() => {
                  setTarget({
                    parentId: item.rootId,
                    replyTo: item.comment.name,
                  });
                  input.current?.focus();
                }}
              />
            )}
            ListFooterComponent={
              comments.length >= 200 ? (
                <Text
                  style={{
                    color: c.secondary,
                    textAlign: "center",
                    padding: 15,
                    fontSize: 11,
                  }}
                >
                  최근 댓글 200개를 보여드려요.
                </Text>
              ) : undefined
            }
          />
          <View
            style={{
              borderTopWidth: 1,
              borderColor: c.border,
              padding: 14,
              paddingBottom: Math.max(14, insets.bottom),
              backgroundColor: c.background,
              gap: 10,
            }}
          >
            {target && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 5,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: c.primary,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {target.replyTo}님에게 답글 쓰는 중
                </Text>
                <Pressable
                  disabled={busy}
                  onPress={() => setTarget(null)}
                  style={{ padding: 6 }}
                >
                  <Text style={{ color: c.secondary }}>취소 ×</Text>
                </Pressable>
              </View>
            )}
            <View style={s.row}>
              <TextInput
                ref={input}
                accessibilityLabel={target ? "대댓글 작성" : "댓글 작성"}
                value={text}
                onChangeText={setText}
                placeholder={
                  target
                    ? "답글을 남겨주세요"
                    : post.topic === "질문"
                      ? "알고 있는 내용을 나눠주세요"
                      : "따뜻한 한마디를 남겨주세요"
                }
                placeholderTextColor={c.secondary}
                maxLength={500}
                multiline
                editable={!busy}
                style={{
                  flex: 1,
                  backgroundColor: c.surface,
                  borderRadius: 20,
                  color: c.text,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  maxHeight: 110,
                }}
              />
              <Pressable
                disabled={busy || !text.trim()}
                onPress={send}
                accessibilityRole="button"
                style={[
                  s.button,
                  {
                    backgroundColor: text.trim() && !busy ? accent : c.surface,
                    padding: 13,
                  },
                ]}
              >
                <Text
                  style={{
                    color: text.trim() && !busy ? "#fff" : c.secondary,
                    fontWeight: "800",
                  }}
                >
                  {busy ? "…" : target ? "답글" : "등록"}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
