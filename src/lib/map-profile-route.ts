/** Self uses the live private profile; other markers open the read-only public profile. */
export function mapProfileRoute(targetUid: string, ownUid: string | undefined) {
  return targetUid === ownUid
    ? '/mypage' as const
    : { pathname: '/player/[uid]' as const, params: { uid: targetUid } };
}
