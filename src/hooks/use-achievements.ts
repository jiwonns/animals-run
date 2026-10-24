import { earnedRewards, type ProgressState, type Reward } from '@/lib/rewards';
import { useSession } from '@/providers/session-provider';

/** The signed-in user's progress plus the achievements they have earned but not yet claimed. */
export function useAchievements(): { state: ProgressState; claimable: Reward[]; ready: boolean } {
  const { profile, claimed } = useSession();
  const state: ProgressState = {
    characters: profile?.characters ?? {},
    gradeCounts: profile?.gradeCounts ?? {},
    drawCount: profile?.drawCount ?? 0,
    auctionTrades: profile?.auctionTrades ?? 0,
    arenaWins: profile?.arenaWins ?? 0,
  };
  const ready = profile !== null && claimed !== null;
  const claimable = ready ? earnedRewards(state).filter((r) => !claimed.has(r.id)) : [];
  return { state, claimable, ready };
}
