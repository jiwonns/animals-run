import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { mapHtml, type MapPlayer } from "@/components/walk-map-html";
import type { CharacterId } from "@/constants/characters";
import { avatarDataUri } from "@/lib/avatar-data";

export type { MapPlayer };

type Props = {
  players: MapPlayer[];
  /** Changing this moves the map back to the player. */
  focusKey: number;
  color: string;
  visible?: boolean;
  onPlayerPress?: (uid: string) => void;
};

type MapApp = {
  setPlayers(list: MapPlayer[]): void;
  setFace(id: CharacterId, uri: string, thumbnail?: boolean): void;
  focusMe(): void;
  resize(): void;
};

function playersKey(players: MapPlayer[]) {
  return players
    .map((p) => `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.name}:${p.avatar ?? ""}:${p.me ? 1 : 0}`)
    .join("|");
}

export function WalkMap({ players, focusKey, color, visible = true, onPlayerPress }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const sentFaces = useRef(new Set<CharacterId>());
  const lastPlayers = useRef("");
  const playersRef = useRef(players);
  const pressRef = useRef(onPlayerPress);
  const [loads, setLoads] = useState(0);
  const [html] = useState(() => mapHtml(color));

  const app = () => (frame.current?.contentWindow as unknown as { app?: MapApp } | null)?.app;

  useEffect(() => {
    playersRef.current = players;
    pressRef.current = onPlayerPress;
  }, [onPlayerPress, players]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "walk-map:player" && typeof event.data.uid === "string") {
        if (playersRef.current.some((p) => p.id === event.data.uid)) pressRef.current?.(event.data.uid);
        return;
      }
      if (event.data !== "walk-map:ready") return;
      lastPlayers.current = "";
      sentFaces.current.clear();
      setLoads((n) => n + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!loads) return;
    const key = playersKey(players);
    if (lastPlayers.current !== key) {
      lastPlayers.current = key;
      app()?.setPlayers(players);
    }
    for (const { avatar } of players) {
      if (!avatar || sentFaces.current.has(avatar)) continue;
      sentFaces.current.add(avatar);
      avatarDataUri(avatar)
        .then((uri) => app()?.setFace(avatar, uri, true))
        .catch(() => sentFaces.current.delete(avatar));
    }
  }, [loads, players]);

  useEffect(() => {
    if (loads && focusKey) app()?.focusMe();
  }, [loads, focusKey]);

  useEffect(() => {
    if (loads && visible) app()?.resize();
  }, [loads, visible]);

  return (
    <View style={styles.map} collapsable={false}>
      <iframe
        ref={frame}
        srcDoc={html}
        title="지도"
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#eef1f4",
  },
});
