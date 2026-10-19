import {
  CHARACTER_BY_ID,
  GRADES,
  type CharacterId,
  type Grade,
} from "@/constants/characters";
import { REWARDS } from "@/constants/gacha.generated";
import type { Profile } from "./profile";

export const SALE_PRICES: Record<Grade, number> = REWARDS.sale;

/** All inventory actions keep one copy of the current companion. */
export function availableCopies(
  profile: Pick<Profile, "characters" | "avatar"> | null,
  id: CharacterId,
) {
  return Math.max(
    0,
    (profile?.characters[id] ?? 0) - (profile?.avatar === id ? 1 : 0),
  );
}

/** Reconcile a selection with live inventory, including duplicate IDs and the reserved companion. */
export function availablePicks(
  picks: CharacterId[],
  profile: Pick<Profile, "characters" | "avatar"> | null,
) {
  const used: Partial<Record<CharacterId, number>> = {};
  return picks.filter((id) => {
    const count = used[id] ?? 0;
    if (!CHARACTER_BY_ID[id] || count >= availableCopies(profile, id))
      return false;
    used[id] = count + 1;
    return true;
  });
}

export function kindsByGrade(
  characters: Profile["characters"],
): Record<Grade, number> {
  const counts = Object.fromEntries(
    Object.keys(GRADES).map((g) => [g, 0]),
  ) as Record<Grade, number>;
  for (const [id, count] of Object.entries(characters)) {
    const character = CHARACTER_BY_ID[id as CharacterId];
    if (character && count && count > 0) counts[character.grade]++;
  }
  return counts;
}
