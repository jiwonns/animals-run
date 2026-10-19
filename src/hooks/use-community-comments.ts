import { limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  commentRef,
  commentsRef,
  commentThreads,
  type Comment,
} from "@/lib/community";

export function useCommunityComments(id: string, enabled: boolean) {
  const [state, setState] = useState<{ id: string; list: Comment[] }>({
    id: "",
    list: [],
  });
  const [parents, setParents] = useState<{
    id: string;
    byId: Record<string, Comment>;
  }>({ id: "", byId: {} });
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const comments = state.id === id ? state.list : [];
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(commentsRef(id), orderBy("createdAt", "desc"), limit(200)),
      (snapshot) => {
        setState({
          id,
          list: snapshot.docs
            .map((d) => ({ ...d.data(), id: d.id }) as Comment)
            .reverse(),
        });
        setFailedAt(null);
      },
      () => setFailedAt(id),
    );
  }, [id, enabled]);
  const ids = new Set(comments.map((c) => c.id));
  const missingKey = [
    ...new Set(
      comments.flatMap((c) =>
        c.parentId && !ids.has(c.parentId) ? [c.parentId] : [],
      ),
    ),
  ]
    .sort()
    .join("|");
  useEffect(() => {
    if (!enabled || !missingKey) return;
    const off = missingKey.split("|").map((parentId) =>
      onSnapshot(
        commentRef(id, parentId),
        (snapshot) => {
          setParents((previous) => {
            const byId = { ...(previous.id === id ? previous.byId : {}) };
            if (snapshot.exists())
              byId[parentId] = { ...snapshot.data(), id: parentId } as Comment;
            else delete byId[parentId];
            return { id, byId };
          });
        },
        () => {
          /* Missing/deleted parents render as a placeholder without hiding their replies. */
        },
      ),
    );
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [id, enabled, missingKey]);
  const extra =
    parents.id === id
      ? missingKey
          .split("|")
          .flatMap((key) => (parents.byId[key] ? [parents.byId[key]] : []))
      : [];
  return {
    comments,
    rows: commentThreads([...comments, ...extra]),
    failed: failedAt === id,
  };
}
