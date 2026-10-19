import { runTransaction } from "firebase/firestore";

import {
  CHARACTER_BY_ID,
  CHARACTERS,
  type Character,
  type CharacterId,
} from "@/constants/characters";
import { COLLECTION_DATA, REWARDS } from "@/constants/gacha.generated";

import { db } from "./firebase";
import { companionRef, HomeError, type Companion } from "./home";
import { profileRef, type Profile } from "./profile";
import { availablePicks } from "./inventory";

const { crafting, breeding, evolution, fusion, recycle } = REWARDS;
const BASE = COLLECTION_DATA.find((c) => c.base)!.id;

export const RECYCLE_COUNT = recycle.count;

/** Position in crafting.tiers from 1, or 0 for grades crafting doesn't use (events, hidden). */
export const tierOf = (id: CharacterId) =>
  crafting.tiers.indexOf(CHARACTER_BY_ID[id].grade) + 1;

/** The animal behind an id: 'tiger' for both 'tiger' and 'sea_tiger'. */
const speciesOf = (c: Character) =>
  c.collection === BASE ? c.id : c.id.slice(c.collection.length + 1);
const find = (collection: string, species: string) =>
  CHARACTERS.find(
    (c) => c.collection === collection && speciesOf(c) === species,
  );

const POOL = CHARACTERS.filter((c) => crafting.pool.includes(c.collection));
/** Animals crafting can produce at a tier. */
export const poolOfTier = (tier: number) =>
  POOL.filter((c) => tierOf(c.id) === tier);

/** Every possible result with its chance; chances add up to 1 (less when the rest is failure). */
export type Odds = { character: Character; chance: number }[];

/** `share` spread evenly over `list`. */
const even = (list: Character[], share: number): Odds =>
  list.map((character) => ({ character, chance: share / list.length }));

/** Adds up the chances of characters listed more than once. */
function merge(odds: Odds): Odds {
  const byId = new Map<CharacterId, number>();
  for (const { character, chance } of odds)
    byId.set(character.id, (byId.get(character.id) ?? 0) + chance);
  return [...byId].map(([id, chance]) => ({
    character: CHARACTER_BY_ID[id],
    chance,
  }));
}

/** A result drawn by the odds, or null when the roll lands in the failure share. */
function roll(odds: Odds): CharacterId | null {
  const total = odds.reduce((sum, o) => sum + o.chance, 0);
  let r = Math.random();
  // Chances that should add up to 1 can come out a hair short in floating point.
  if (!odds.length || (total < 1 - 1e-9 && r >= total)) return null;
  for (const { character, chance } of odds)
    if ((r -= chance) < 0) return character.id;
  return odds[odds.length - 1].character.id;
}

/** Copies after a change; characters that run out are removed. */
function adjust(
  characters: Profile["characters"],
  changes: [CharacterId, number][],
) {
  const next = { ...characters };
  for (const [id, delta] of changes) {
    const count = (next[id] ?? 0) + delta;
    if (count < 0) throw new HomeError("동물이 부족해요.");
    if (count === 0) delete next[id];
    else next[id] = count;
  }
  return next;
}

// Breeding

/**
 * What an egg from these parents can hold; firestore.rules accepts exactly these children. A baby.rate share
 * is the baby version of either parent's animal; the rest goes to one parent picked at random, then a pool
 * animal no higher than that parent, mostly from the lower tiers.
 */
export function breedOdds(parents: [CharacterId, CharacterId]): Odds {
  const [a, b] = parents.map((id) => CHARACTER_BY_ID[id]);
  const babyCollection = breeding.baby?.collection;
  const babies = [a, b]
    .map((p) =>
      babyCollection ? find(babyCollection, speciesOf(p)) : undefined,
    )
    .filter((c): c is Character => !!c);
  const babyRate = babies.length ? (breeding.baby?.rate ?? 0) : 0;
  return merge([
    ...even(babies, babyRate),
    ...[a, b].flatMap((p) => parentOdds(tierOf(p.id), (1 - babyRate) / 2)),
  ]);
}

/** `share` over pool tiers up to `top`: sameTier at `top`, the rest lowerRatio times likelier per tier down. */
function parentOdds(top: number, share: number): Odds {
  const lower = Array.from({ length: top - 1 }, (_, i) => i + 1);
  const same = lower.length ? breeding.sameTier : 1;
  const weights = lower.map((t) => breeding.lowerRatio ** (top - 1 - t));
  const total = weights.reduce((sum, w) => sum + w, 0);
  return [
    ...even(poolOfTier(top), share * same),
    ...lower.flatMap((t, i) =>
      even(poolOfTier(t), (share * (1 - same) * weights[i]) / total),
    ),
  ];
}

export const rollChild = (parents: [CharacterId, CharacterId]) =>
  roll(breedOdds(parents))!;

// Fusion

/** Fusion settings for a character's grade, or undefined when its grade can't fuse. */
export const fusionOf = (id: CharacterId) => fusion[CHARACTER_BY_ID[id].grade];

/** Two characters of one grade fuse into an animal one tier up with the grade's success chance. */
export function fusionOdds(id: CharacterId): Odds {
  return even(poolOfTier(tierOf(id) + 1), fusionOf(id)?.success ?? 0);
}

/** The two inputs and the coins become one random animal a tier up, or nothing if the roll fails. */
export function fuse(uid: string, inputs: [CharacterId, CharacterId]) {
  const selected: [CharacterId, CharacterId] = [inputs[0], inputs[1]];
  const output = roll(fusionOdds(selected[0]));
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(profileRef(uid));
    if (!snapshot.exists()) throw new HomeError("프로필을 찾을 수 없어요.");
    const profile = snapshot.data() as Profile;
    const [a, b] = selected;
    const settings = fusionOf(a);
    if (!settings || CHARACTER_BY_ID[a].grade !== CHARACTER_BY_ID[b].grade) {
      throw new HomeError("같은 등급의 동물 2마리를 넣어주세요.");
    }
    if (profile.coins < settings.coins) throw new HomeError("코인이 부족해요.");
    if (availablePicks(selected, profile).length !== selected.length)
      throw new HomeError(
        "보유 수량이 바뀌었어요. 대표 동물 1마리를 제외하고 다시 골라주세요.",
      );
    tx.update(profileRef(uid), {
      characters: adjust(profile.characters, [
        [a, -1],
        [b, -1],
        ...(output ? [[output, 1] as [CharacterId, number]] : []),
      ]),
      coins: profile.coins - settings.coins,
      fuseCount: (profile.fuseCount ?? 0) + 1,
      lastCraft: { inputs: selected, output },
    });
    return { output, isNew: !!output && !profile.characters[output] };
  });
}

// Recycling

/**
 * One tier above the lowest input comes with the upgrade chance and each further tier with decay times the
 * tier below; otherwise the result is of the lowest input's tier.
 */
export function recycleOdds(inputs: CharacterId[]): Odds {
  const tiers = inputs.map(tierOf);
  const lowest = Math.min(...tiers);
  const { base, perHigher, decay } = recycle.upgrade;
  const above = tiers.filter((t) => t > lowest).length;
  const ups: { tier: number; chance: number }[] = [];
  for (
    let t = lowest + 1, chance = base + perHigher * above;
    poolOfTier(t).length;
    t++, chance *= decay
  ) {
    ups.push({ tier: t, chance });
  }
  const upTotal = ups.reduce((sum, u) => sum + u.chance, 0);
  const scale = upTotal > 1 ? 1 / upTotal : 1;
  return [
    ...ups.flatMap((u) => even(poolOfTier(u.tier), u.chance * scale)),
    ...even(poolOfTier(lowest), 1 - upTotal * scale),
  ];
}

export function recycleCharacters(uid: string, inputs: CharacterId[]) {
  const selected = [...inputs];
  if (
    selected.length !== RECYCLE_COUNT ||
    selected.some((id) => !CHARACTER_BY_ID[id] || tierOf(id) === 0)
  ) {
    throw new HomeError(`재활용할 동물 ${RECYCLE_COUNT}마리를 골라주세요.`);
  }
  const output = roll(recycleOdds(selected));
  if (!output)
    throw new HomeError("재활용 결과를 계산하지 못했어요. 다시 골라주세요.");
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(profileRef(uid));
    if (!snapshot.exists()) throw new HomeError("프로필을 찾을 수 없어요.");
    const profile = snapshot.data() as Profile;
    if (availablePicks(selected, profile).length !== selected.length)
      throw new HomeError(
        "보유 수량이 바뀌었어요. 대표 동물 1마리를 제외하고 다시 골라주세요.",
      );
    tx.update(profileRef(uid), {
      characters: adjust(profile.characters, [
        ...selected.map((id): [CharacterId, number] => [id, -1]),
        [output, 1],
      ]),
      recycleCount: (profile.recycleCount ?? 0) + 1,
      lastCraft: { inputs: selected, output },
    });
    return { output, isNew: !profile.characters[output] };
  });
}

// Evolution

/** The animal `id` evolves into, or undefined when its collection has no evolution. */
export function evolveTarget(id: CharacterId): CharacterId | undefined {
  const character = CHARACTER_BY_ID[id];
  const to = evolution.paths[character.collection];
  return to ? find(to, speciesOf(character))?.id : undefined;
}

export function evolveCost(id: CharacterId) {
  const grade = CHARACTER_BY_ID[id].grade;
  return {
    steps: evolution.steps[grade] ?? 0,
    coins: evolution.coins[grade] ?? 0,
  };
}

/** Companion steps a character needs to evolve; undefined when it can't evolve. */
export const evolutionSteps = (id: CharacterId) =>
  evolveTarget(id) ? evolveCost(id).steps : undefined;

/**
 * Spends the steps walked with `id` and the coins, and swaps one copy for its evolved form. If that was the
 * last copy of the avatar, the evolved form becomes the avatar.
 */
export function evolveCharacter(uid: string, id: CharacterId) {
  return runTransaction(db, async (tx) => {
    const profileSnap = await tx.get(profileRef(uid));
    const companionSnap = await tx.get(companionRef(uid));
    if (!profileSnap.exists()) throw new HomeError("프로필을 찾을 수 없어요.");
    const profile = profileSnap.data() as Profile;
    const steps =
      (companionSnap.data() as Companion | undefined)?.steps[id] ?? 0;
    const output = evolveTarget(id);
    const cost = evolveCost(id);
    if (!output) throw new HomeError("이 동물은 진화할 수 없어요.");
    if (!profile.characters[id]) throw new HomeError("동물이 부족해요.");
    if (steps < cost.steps) throw new HomeError("함께 걸은 걸음이 부족해요.");
    if (profile.coins < cost.coins) throw new HomeError("코인이 부족해요.");
    const characters = adjust(profile.characters, [
      [id, -1],
      [output, 1],
    ]);
    tx.update(profileRef(uid), {
      characters,
      coins: profile.coins - cost.coins,
      evolveCount: (profile.evolveCount ?? 0) + 1,
      lastCraft: { inputs: [id], output },
      ...(profile.avatar === id && !characters[id] && { avatar: output }),
    });
    tx.update(companionRef(uid), { [`steps.${id}`]: steps - cost.steps });
    return { output, isNew: !profile.characters[output] };
  });
}
