/** Every marker opens the same profile layout, including the current player's marker. */
export function mapProfileRoute(targetUid: string, _ownUid?: string) {
  return { pathname: '/player/[uid]' as const, params: { uid: targetUid } };
}
