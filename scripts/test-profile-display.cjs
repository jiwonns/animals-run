const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const native = require('react-native-web');
const colors = { primary: '#F05A28', text: '#111111', secondary: '#666666', border: '#dddddd', surface: '#ffffff' };
function load(file, extra = {}) {
  const module = { exports: {} };
  const mocks = { 'react-native': native, '@/hooks/use-colors': { useColors: () => colors }, ...extra };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', 'module', code)(id => mocks[id] ?? require(id), module.exports, module);
  return module.exports;
}
const more = load('src/components/more-button.tsx');
const { EquippedMedal, MedalShowcaseList } = load('src/components/medal-showcase.tsx', { './more-button': more, './paged-list-sheet': { PagedListSheet: () => null } });
const medals = Array.from({ length: 12 }, (_, i) => ({ id: `medal:${i}`, name: `Badge_${i}_end`, description: `Description_${i}`, temporary: false }));
const showcase = { medals, equipped: medals[9], saving: false, equip: async () => {}, claimed: new Set(), failed: false, rankingFailed: false, displayFailed: false, loading: false };
const html = renderToStaticMarkup(React.createElement(MedalShowcaseList, { showcase, editable: false }));
assert.ok(html.includes('Badge_9_end'), 'equipped medal is visible even when originally beyond the preview');
assert.ok(html.includes('Badge_0_end'));
assert.ok(!html.includes('Badge_5_end'), 'only six unique medals render before expansion');
assert.ok(html.includes('훈장 더보기'));
assert.ok(html.includes('6개'));
assert.ok(!html.includes('장착하기') && !html.includes('장착 해제'), 'friends cannot see editing actions');
const owner = renderToStaticMarkup(React.createElement(MedalShowcaseList, { showcase, editable: true }));
assert.ok(owner.includes('장착하기') && owner.includes('장착 해제'));
const hero = renderToStaticMarkup(React.createElement(EquippedMedal, { showcase }));
assert.ok(hero.includes('Badge_9_end') && hero.includes('대표 훈장'));
assert.equal(renderToStaticMarkup(React.createElement(EquippedMedal, { showcase: { ...showcase, equipped: null } })), '');
const control = renderToStaticMarkup(React.createElement(more.MoreButton, { expanded: false, onPress() {}, remaining: 8, label: '동물 더보기', unit: '종' }));
assert.ok(control.includes('8종'));
assert.ok(renderToStaticMarkup(React.createElement(more.MoreButton, { expanded: true, onPress() {}, remaining: 8 })).includes('접기'));
console.log('PASS profile rendering: six-medal preview, equipped medal first, public read-only actions, representative badge, hidden empty slot, more/collapse labels and species units');

const friendsFixture = { relationships: [], loading: false, failed: false, unread: 0 };
const sessionFixture = { user: { uid: 'me' }, profile: { username: 'me', avatar: null } };
const { FriendActions } = load('src/components/friend-actions.tsx', {
  '@/providers/friends-provider': { useFriends: () => friendsFixture },
  '@/providers/session-provider': { useSession: () => sessionFixture },
  '@/lib/friends': { acceptFriendRequest() {}, removeFriendship() {}, sendFriendRequest() {} },
});
const actions = () => renderToStaticMarkup(React.createElement(FriendActions, { targetUid: 'them', target: { username: 'friend' } }));
assert.ok(actions().includes('친구 신청'));
friendsFixture.relationships = [{ id: 'me:them', members: ['me','them'], sender: 'them', recipient: 'me', status: 'pending' }];
assert.ok(actions().includes('친구 수락') && actions().includes('거절'));
friendsFixture.relationships = [{ ...friendsFixture.relationships[0], sender: 'me', recipient: 'them' }];
assert.ok(actions().includes('신청 취소') && !actions().includes('친구 수락'));
friendsFixture.relationships[0].status = 'accepted';
assert.ok(actions().includes('친구 · 삭제'));
assert.equal(renderToStaticMarkup(React.createElement(FriendActions, { targetUid: 'me', target: { username: 'me' } })), '');
const { NotificationBell } = load('src/components/notification-bell.tsx', {
  '@/providers/friends-provider': { useFriends: () => friendsFixture },
  'expo-router': { router: { push() {} } },
  './icon': { ICONS: { bell: {} }, Icon: () => React.createElement(native.Text, null, 'bell') },
});
const emptyBell = renderToStaticMarkup(React.createElement(NotificationBell));
assert.ok(!emptyBell.includes('읽지 않은'));
friendsFixture.unread = 3;
const unreadBell = renderToStaticMarkup(React.createElement(NotificationBell));
assert.ok(unreadBell.includes('읽지 않은 알림 3개'));
assert.ok(unreadBell.length > emptyBell.length, 'unread bell adds a visible indicator');
console.log('PASS friends rendering: request/accept/reject/cancel/remove states, no self request, notification bell unread indicator');

let windowState;
const { useListWindow } = load('src/hooks/use-list-window.ts', { react: { useState(initial) { windowState ??= initial; return [windowState, value => { windowState = value; }]; } } });
const many = Array.from({ length: 80 }, (_, id) => ({ id }));
useListWindow([], 'loading').loadMore();
assert.equal(useListWindow(many, 'loading').data.length, 24, 'empty first snapshot must not trap the list at zero rows');
useListWindow(many, 'loading').loadMore();
assert.equal(useListWindow(many, 'loading').data.length, 48);
assert.equal(useListWindow(many, 'different-filter').data.length, 24, 'filter changes reset the rendering window');
useListWindow(many, 'different-filter').loadMore();
assert.equal(useListWindow(many.slice(0, 3), 'different-filter').data.length, 3, 'live removals cannot expose stale rows');
console.log('PASS list windows: 24-row first page, incremental scroll, filter reset, initially empty data and live removals');
