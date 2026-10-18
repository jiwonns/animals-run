import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import type { CharacterId } from '@/constants/characters';
import { avatarDataUri } from '@/lib/avatar-data';

export type MapPlayer = {
  id: string;
  name: string;
  avatar: CharacterId | null;
  lat: number;
  lng: number;
  me: boolean;
};

type Props = {
  players: MapPlayer[];
  /** Changing this moves the map back to the player. */
  focusKey: number;
  color: string;
};

const html = (color: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: #eef1f4; }
  .pin { display: flex; flex-direction: column; align-items: center; }
  .face {
    width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: #fff;
    border: 3px solid #fff; box-shadow: 0 3px 8px rgba(0, 0, 0, .3);
    display: flex; align-items: center; justify-content: center;
    font: 700 20px sans-serif; color: #8e8e93;
  }
  .me .face { width: 58px; height: 58px; border-color: ${color}; }
  .face img { width: 100%; height: 100%; }
  .name {
    margin-top: 4px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
    background: rgba(255, 255, 255, .96); color: #1c1c1e; font: 700 12px sans-serif;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .25);
  }
  .me .name { background: ${color}; color: #fff; }
  .leaflet-div-icon { background: none; border: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map', { zoomControl: false }).setView([37.5665, 126.978], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  const faces = {};
  const markers = {};
  let players = [];
  let me = null;
  let centered = false;

  function escape(text) {
    return text.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  }

  function icon(p) {
    const face = p.avatar && faces[p.avatar]
      ? '<img src="' + faces[p.avatar] + '">'
      : escape(p.name.charAt(0).toUpperCase());
    const size = p.me ? 64 : 54;
    return L.divIcon({
      html: '<div class="pin' + (p.me ? ' me' : '') + '"><div class="face">' + face + '</div>'
        + '<div class="name">' + escape(p.name) + '</div></div>',
      iconSize: [120, size + 24],
      iconAnchor: [60, size / 2],
    });
  }

  function draw() {
    const seen = {};
    for (const p of players) {
      seen[p.id] = true;
      const key = p.name + '|' + p.avatar + '|' + p.me + '|' + !!(p.avatar && faces[p.avatar]);
      const marker = markers[p.id];
      if (!marker) {
        markers[p.id] = L.marker([p.lat, p.lng], { icon: icon(p), zIndexOffset: p.me ? 1000 : 0 }).addTo(map);
        markers[p.id].key = key;
      } else {
        marker.setLatLng([p.lat, p.lng]);
        if (marker.key !== key) {
          marker.setIcon(icon(p));
          marker.key = key;
        }
      }
    }
    for (const id in markers) {
      if (!seen[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    }
  }

  window.app = {
    setPlayers(list) {
      players = list;
      me = list.find((p) => p.me) || null;
      if (me && !centered) {
        centered = true;
        map.invalidateSize();
        map.setView([me.lat, me.lng], 17);
      }
      draw();
    },
    setFace(id, uri) {
      faces[id] = uri;
      draw();
    },
    focusMe() {
      if (me) map.flyTo([me.lat, me.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    },
  };
  window.ReactNativeWebView.postMessage('ready');
</script>
</body>
</html>`;

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
      source={{ html: html(color), baseUrl: 'https://animalsrun.app/' }}
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
