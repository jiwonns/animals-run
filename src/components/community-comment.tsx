import { onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AuthorLine } from "./community-ui";
import { Icon, ICONS } from "./icon";
import { useColors } from "@/hooks/use-colors";
import {
  commentLikesRef,
  hideComment,
  setCommentLiked,
  type CommentRow,
} from "@/lib/community";
import { useSession } from "@/providers/session-provider";

function CommentActions({
  postId,
  row,
  canReply,
  onReply,
}: {
  postId: string;
  row: CommentRow;
  canReply: boolean;
  onReply: () => void;
}) {
  const c = useColors();
  const { user } = useSession();
  const [likes, setLikes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  useEffect(
    () =>
      onSnapshot(
        commentLikesRef(postId, row.comment.id),
        (snapshot) => {
          setLikes(snapshot.docs.map((d) => d.id));
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [postId, row.comment.id],
  );
  const liked = !!user && likes.includes(user.uid);
  async function toggle() {
    if (!user || lock.current || failed) return;
    lock.current = true;
    setBusy(true);
    try {
      await setCommentLiked(postId, row.comment.id, user.uid, !liked);
    } catch {
      Alert.alert("좋아요를 저장하지 못했어요", "잠시 후 다시 시도해주세요.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        flexWrap: "wrap",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="댓글 좋아요"
        accessibilityState={{ selected: liked }}
        disabled={busy || failed}
        onPress={toggle}
        style={{
          minHeight: 44,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Icon
          name={ICONS.heart}
          size={14}
          color={liked ? c.primary : c.secondary}
        />
        <Text
          style={{
            color: liked ? c.primary : c.secondary,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {failed ? "—" : `좋아요${likes.length ? ` ${likes.length}` : ""}`}
        </Text>
      </Pressable>
      {canReply && (
        <Pressable
          accessibilityRole="button"
          onPress={onReply}
          style={{
            minHeight: 44,
            paddingHorizontal: 10,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: c.secondary, fontSize: 12, fontWeight: "700" }}>
            답글 달기
          </Text>
        </Pressable>
      )}
      {row.comment.uid === user?.uid && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "댓글을 삭제할까요?",
              "답글이 있으면 대화 흐름은 남고 내용만 지워져요.",
              [
                { text: "취소", style: "cancel" },
                {
                  text: "삭제",
                  style: "destructive",
                  onPress: () =>
                    hideComment(postId, row.comment.id).catch(() =>
                      Alert.alert(
                        "삭제하지 못했어요",
                        "잠시 후 다시 시도해주세요.",
                      ),
                    ),
                },
              ],
            )
          }
          style={{
            minHeight: 44,
            paddingHorizontal: 10,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: c.secondary, fontSize: 11 }}>삭제</Text>
        </Pressable>
      )}
    </View>
  );
}

export function CommunityComment({
  postId,
  row,
  rootDeleted,
  onReply,
}: {
  postId: string;
  row: CommentRow;
  rootDeleted: boolean;
  onReply: () => void;
}) {
  const c = useColors();
  const comment = row.comment;
  return (
    <View
      style={{
        marginLeft: row.reply ? 25 : 0,
        padding: row.reply ? 14 : 0,
        paddingLeft: row.reply ? 16 : 0,
        borderLeftWidth: row.reply ? 2 : 0,
        borderColor: c.border,
        borderRadius: row.reply ? 17 : 0,
        backgroundColor: row.reply ? c.surface : "transparent",
        gap: 9,
      }}
    >
      {comment.deleted ? (
        <Text style={{ color: c.secondary, fontSize: 13, paddingVertical: 13 }}>
          삭제된 댓글이에요.
        </Text>
      ) : (
        <>
          <AuthorLine author={comment} time={comment.createdAt} />
          <Text
            selectable
            style={{ color: c.text, lineHeight: 23, paddingLeft: 48 }}
          >
            {comment.replyTo && (
              <Text style={{ color: c.primary, fontWeight: "700" }}>
                @{comment.replyTo}{" "}
              </Text>
            )}
            {comment.body}
          </Text>
          <View style={{ paddingLeft: 38 }}>
            <CommentActions
              postId={postId}
              row={row}
              canReply={!rootDeleted}
              onReply={onReply}
            />
          </View>
        </>
      )}
    </View>
  );
}
