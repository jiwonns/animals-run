import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AvatarFace } from "@/components/avatar-face";
import { Icon, ICONS } from "@/components/icon";
import { useColors } from "@/hooks/use-colors";
import { timeAgo, type Author } from "@/lib/community";
import type { Timestamp } from "firebase/firestore";

export function AuthorLine({
  author,
  time,
}: {
  author: Author;
  time: Timestamp | null;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${author.name} 프로필 보기`}
      onPress={() =>
        router.push({ pathname: "/player/[uid]", params: { uid: author.uid } })
      }
      style={s.author}
    >
      <AvatarFace avatar={author.avatar} size={38} fallback={author.name} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
          {author.name}
        </Text>
        <Text style={{ color: c.secondary, fontSize: 11 }}>
          {timeAgo(time)}
        </Text>
      </View>
      <Icon name={ICONS.chevron} size={15} color={c.secondary} />
    </Pressable>
  );
}

export function CommunityEmpty({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <View style={s.empty}>
      <View style={s.bubble}>
        <Icon name={ICONS.community} size={32} color={c.primary} />
      </View>
      <Text style={{ color: c.text, fontSize: 19, fontWeight: "800" }}>
        {title}
      </Text>
      <Text style={{ color: c.secondary, textAlign: "center", lineHeight: 21 }}>
        {body}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={[s.button, { backgroundColor: c.primary }]}
        >
          <Text style={s.buttonText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const communityStyles = StyleSheet.create({
  button: {
    padding: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  input: { borderRadius: 18, padding: 16, fontSize: 16, lineHeight: 25 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
});
const s = StyleSheet.create({
  author: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  empty: { alignItems: "center", padding: 32, gap: 13 },
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: "#FF5A1F15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  button: {
    backgroundColor: "#FF5A1F",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "800" },
});
