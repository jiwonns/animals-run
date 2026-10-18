import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

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

export function WalkMap({ players, focusKey, color }: Props) {
  const web = useRef<WebView<object>>(null);
  const sentFaces = useRef(new Set<CharacterId>());
  const [loads, setLoads] = useState(0);

  const run = (script: string) => web.current?.injectJavaScript(`${script};true;`);

  useEffect(() => {
    if (!loads) return;
    run(`app.setPlayers(${JSON.stringify(players)})`);
    for (const { avatar } of players) {
      if (!avatar || sentFaces.current.has(avatar)) continue;
      sentFaces.current.add(avatar);
      avatarDataUri(avatar)
        .then((uri) => run(`app.setFace(${JSON.stringify(avatar)}, ${JSON.stringify(uri)})`))
        .catch(() => sentFaces.current.delete(avatar));
    }
  }, [loads, players]);

  useEffect(() => {
    if (loads && focusKey) run('app.focusMe()');
  }, [loads, focusKey]);

  return (
    <WebView<object>
      ref={web}
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: mapHtml(color), baseUrl: 'https://animalsrun.app/' }}
      onMessage={(event) => {
        if (event.nativeEvent.data !== 'ready') return;
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
    backgroundColor: '#eef1f4',
  },
});
