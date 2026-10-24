import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

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

function playersKey(players: MapPlayer[]) {
  return players
    .map((p) => `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.name}:${p.avatar ?? ""}:${p.me ? 1 : 0}`)
    .join("|");
}

export function WalkMap({ players, focusKey, color, visible = true, onPlayerPress }: Props) {
  const web = useRef<WebView<object>>(null);
  const sentFaces = useRef(new Set<CharacterId>());
  const lastPlayers = useRef("");
  const playersRef = useRef(players);
  const [loads, setLoads] = useState(0);
  const [source] = useState(() => ({ html: mapHtml(color), baseUrl: "https://animalsrun.app/" }));

  const run = (script: string) => web.current?.injectJavaScript(`${script};true;`);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    if (!loads) return;
    const key = playersKey(players);
    if (lastPlayers.current !== key) {
      lastPlayers.current = key;
      run(`app.setPlayers(${JSON.stringify(players)})`);
    }
    for (const { avatar } of players) {
      if (!avatar || sentFaces.current.has(avatar)) continue;
      sentFaces.current.add(avatar);
      avatarDataUri(avatar)
        .then((uri) => run(`app.setFace(${JSON.stringify(avatar)}, ${JSON.stringify(uri)})`))
        .catch(() => sentFaces.current.delete(avatar));
    }
  }, [loads, players]);

  useEffect(() => {
    if (loads && focusKey) run("app.focusMe()");
  }, [loads, focusKey]);

  useEffect(() => {
    if (loads && visible) run("app.resize()");
  }, [loads, visible]);

  return (
    <WebView<object>
      ref={web}
      style={styles.map}
      originWhitelist={["*"]}
      source={source}
      cacheEnabled
      androidLayerType="hardware"
      onMessage={(event) => {
        if (event.nativeEvent.data !== "ready") {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (
              message.type === "walk-map:player" &&
              typeof message.uid === "string" &&
              playersRef.current.some((p) => p.id === message.uid)
            )
              onPlayerPress?.(message.uid);
          } catch {
            /* Ignore messages outside the map bridge. */
          }
          return;
        }
        lastPlayers.current = "";
        sentFaces.current.clear();
        setLoads((n) => n + 1);
      }}
      setSupportMultipleWindows={false}
      overScrollMode="never"
      bounces={false}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#eef1f4",
  },
});
