const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/components/walk-map-html.ts', 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const native of [true, false]) {
  const messages = [];
  const markers = [];
  const map = { setView() { return this; }, invalidateSize() {}, flyTo() {}, getZoom() { return 17; }, removeLayer() {} };
  const context = {
    L: {
      map: () => map,
      tileLayer: () => ({ addTo() {} }),
      divIcon: options => options,
      marker: (position, options) => {
        const marker = { options, handlers: {}, addTo() { return this; }, on(name, callback) { this.handlers[name] = callback; }, setLatLng() {}, setIcon(icon) { this.options.icon = icon; } };
        markers.push(marker);
        return marker;
      },
    },
    window: { ...(native && { ReactNativeWebView: { postMessage: message => messages.push(message) } }), parent: { postMessage: message => messages.push(message) } },
  };
  vm.runInNewContext(script, context);
  context.window.app.setPlayers([{ id: 'other-player', name: '<script>unsafe</script>', avatar: null, lat: 37, lng: 127, me: false }]);
  assert.ok(markers[0].options.icon.html.includes('&#60;script&#62;unsafe&#60;/script&#62;'));
  markers[0].handlers.click();
  const message = native ? JSON.parse(messages.at(-1)) : messages.at(-1);
  assert.equal(message.type, 'walk-map:player');
  assert.equal(message.uid, 'other-player');
  context.window.app.setPlayers([{ id: 'other-player', name: 'updated', avatar: null, lat: 38, lng: 128, me: false }]);
  markers[0].handlers.click();
  assert.equal((native ? JSON.parse(messages.at(-1)) : messages.at(-1)).uid, 'other-player');
  console.log(`PASS ${native ? 'native' : 'web'} map marker opens the selected profile, including after updates`);
}
