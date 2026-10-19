import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";

import type { CharacterId } from "@/constants/characters";
import { db } from "./firebase";
import { displayName, type Profile } from "./profile";
import {
  photoRef,
  MAX_PHOTOS,
  MAX_PHOTO_DATA,
  type DraftPhoto,
} from "./community-photos";
import {
  QUESTION_TAGS,
  type QuestionTag,
  type WalkShare,
} from "./community-topics";

export const TOPICS = ["전체", "자유", "자랑", "질문", "산책"] as const;
export type Topic = Exclude<(typeof TOPICS)[number], "전체">;
export type Author = { uid: string; name: string; avatar: CharacterId | null };
export type Post = Author & {
  id: string;
  topic: Topic;
  title: string;
  body: string;
  character: CharacterId | null;
  characters?: CharacterId[];
  photos?: string[];
  walk?: WalkShare | null;
  questionTag?: QuestionTag | null;
  createdAt: Timestamp | null;
};
export type Comment = Author & {
  id: string;
  body: string;
  parentId?: string | null;
  replyTo?: string | null;
  deleted?: boolean;
  createdAt: Timestamp | null;
};
export const postsRef = () => collection(db, "communityPosts");
export const postRef = (id: string) => doc(db, "communityPosts", id);
export const commentsRef = (id: string) => collection(postRef(id), "comments");
export const likesRef = (id: string) => collection(postRef(id), "likes");
export const commentRef = (id: string, commentId: string) =>
  doc(commentsRef(id), commentId);
export const commentLikesRef = (id: string, commentId: string) =>
  collection(commentRef(id, commentId), "likes");
const author = (uid: string, profile: Profile): Author => ({
  uid,
  name: displayName(profile),
  avatar: profile.avatar ?? null,
});

export function watchPosts(next: (posts: Post[]) => void, failed: () => void) {
  return onSnapshot(
    query(postsRef(), orderBy("createdAt", "desc"), limit(60)),
    (s) => next(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Post)),
    failed,
  );
}

export async function publishPost(
  uid: string,
  profile: Profile,
  data: Pick<Post, "topic" | "title" | "body" | "character"> & {
    characters?: CharacterId[];
    photos?: DraftPhoto[];
    walk?: WalkShare | null;
    questionTag?: QuestionTag | null;
  },
) {
  const title = data.title.trim();
  const body = data.body.trim();
  if (!title || title.length > 60 || !body || body.length > 2000)
    throw new Error("제목과 내용을 확인해주세요.");
  const characters = [
    ...new Set(data.characters ?? (data.character ? [data.character] : [])),
  ];
  const photos = data.photos ?? [];
  if (
    characters.length > 3 ||
    characters.some((id) => !((profile.characters[id] ?? 0) > 0))
  )
    throw new Error("보유한 동물을 다시 골라주세요.");
  if (data.topic === "자랑" && !characters.length)
    throw new Error("자랑할 동물을 골라주세요.");
  if (
    photos.length > MAX_PHOTOS ||
    photos.some(
      (p) =>
        !p.data.startsWith("data:image/jpeg;base64,") ||
        p.data.length > MAX_PHOTO_DATA,
    )
  )
    throw new Error("사진은 최대 3장까지 첨부할 수 있어요.");
  if (data.topic === "자랑" && photos.length)
    throw new Error("동물 자랑에는 동물을 첨부해주세요.");
  if (data.topic === "질문" && !QUESTION_TAGS.includes(data.questionTag!))
    throw new Error("질문 분야를 골라주세요.");
  if (
    data.topic === "산책" &&
    (!data.walk ||
      !Number.isSafeInteger(data.walk.steps) ||
      data.walk.steps < 0 ||
      (data.walk.kind === "total" && data.walk.steps !== (profile.steps ?? 0)))
  )
    throw new Error("걸음 기록을 다시 확인해주세요.");
  const ref = doc(postsRef());
  const batch = writeBatch(db);
  batch.set(ref, {
    ...author(uid, profile),
    topic: data.topic,
    character: characters[0] ?? null,
    characters,
    photos: photos.map((_, index) => String(index)),
    walk: data.topic === "산책" ? data.walk : null,
    questionTag: data.topic === "질문" ? data.questionTag : null,
    title,
    body,
    createdAt: serverTimestamp(),
  });
  photos.forEach((photo, index) =>
    batch.set(photoRef(ref.id, String(index)), {
      uid,
      data: photo.data,
      width: photo.width,
      height: photo.height,
      createdAt: serverTimestamp(),
    }),
  );
  await batch.commit();
  return ref;
}

export function publishComment(
  id: string,
  uid: string,
  profile: Profile,
  text: string,
  target?: { parentId: string; replyTo: string },
) {
  const body = text.trim();
  if (!body || body.length > 500)
    throw new Error("댓글은 1~500자로 작성해주세요.");
  return addDoc(commentsRef(id), {
    ...author(uid, profile),
    body,
    parentId: target?.parentId ?? null,
    replyTo: target?.replyTo ?? null,
    deleted: false,
    createdAt: serverTimestamp(),
  });
}

export function setCommentLiked(
  id: string,
  commentId: string,
  uid: string,
  liked: boolean,
) {
  const ref = doc(commentLikesRef(id, commentId), uid);
  return liked ? setDoc(ref, { createdAt: serverTimestamp() }) : deleteDoc(ref);
}

export function hideComment(id: string, commentId: string) {
  return setDoc(
    commentRef(id, commentId),
    { body: "", deleted: true },
    { merge: true },
  );
}

export type CommentRow = { comment: Comment; rootId: string; reply: boolean };
export function commentThreads(comments: Comment[]): CommentRow[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const children = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const comment of comments) {
    if (!comment.parentId) roots.push(comment);
    else {
      children.set(comment.parentId, [
        ...(children.get(comment.parentId) ?? []),
        comment,
      ]);
      if (!byId.has(comment.parentId)) {
        const missing: Comment = {
          ...comment,
          id: comment.parentId,
          body: "",
          uid: "",
          name: "",
          avatar: null,
          parentId: null,
          deleted: true,
        };
        byId.set(missing.id, missing);
        roots.push(missing);
      }
    }
  }
  const byTime = (a: Comment, b: Comment) =>
    (a.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) -
      (b.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id);
  return roots
    .sort(byTime)
    .flatMap((root) => [
      { comment: root, rootId: root.id, reply: false },
      ...(children.get(root.id) ?? [])
        .sort(byTime)
        .map((comment) => ({ comment, rootId: root.id, reply: true })),
    ]);
}

export function setLiked(id: string, uid: string, liked: boolean) {
  const ref = doc(likesRef(id), uid);
  return liked ? setDoc(ref, { createdAt: serverTimestamp() }) : deleteDoc(ref);
}

export function timeAgo(time: Timestamp | null) {
  if (!time) return "방금";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - time.toMillis()) / 60000),
  );
  return minutes < 1
    ? "방금"
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : `${Math.floor(minutes / 1440)}일 전`;
}
