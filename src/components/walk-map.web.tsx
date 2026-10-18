import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mapHtml, type MapPlayer } from '@/components/walk-map-html';
import type { CharacterId } from '@/constants/characters';
import { avatarDataUri } from '@/lib/avatar-data';

export type { MapPlayer };

type Props = {
  players: MapPlayer[];
  /** Changing this moves the map back to the player. */
  focusKey: number;
  color: string;
};

type MapApp = {
  setPlayers(list: MapPlayer[]): void;
  setFace(id: CharacterId, uri: string): void;
  focusMe(): void;
};

export function WalkMap({ players, focusKey, color }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const sentFaces = useRef(new Set<CharacterId>());
  const [loads, setLoads] = useState(0);
  const [html] = useState(() => mapHtml(color));

  // A srcdoc iframe shares this page's origin, so its window.app can be called directly.
  const app = () => (frame.current?.contentWindow as unknown as { app?: MapApp } | null)?.app;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data !== 'walk-map:ready') return;
      sentFaces.current.clear();
      setLoads((n) => n + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!loads) return;
    app()?.setPlayers(players);
    for (const { avatar } of players) {
      if (!avatar || sentFaces.current.has(avatar)) continue;
      sentFaces.current.add(avatar);
      avatarDataUri(avatar)
        .then((uri) => app()?.setFace(avatar, uri))
        .catch(() => sentFaces.current.delete(avatar));
    }
  }, [loads, players]);

  useEffect(() => {
    if (loads && focusKey) app()?.focusMe();
  }, [loads, focusKey]);

  return (
    <View style={styles.map}>
      <iframe ref={frame} srcDoc={html} title="지도" style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#eef1f4',
  },
});
