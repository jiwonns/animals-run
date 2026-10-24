export type Grade = 'N' | 'R' | 'EP' | 'U' | 'L' | 'E' | 'H';
export type GachaImage = number | { uri: string };

export type CollectionData<C extends string = string, Id extends string = string> = {
  id: C;
  name: string;
  grade: Grade;
  acquisition?: 'draw' | 'evolution' | 'breeding';
  assetCollection?: string;
  /** The base collection is in every banner's pool and keeps unprefixed character ids. */
  base: boolean;
  /** Null for collections without their own banner (hidden in others, or only obtainable by crafting). */
  banner: {
    /** Explicit animal selection; omitted for legacy collection-wide pools. */
    characterIds?: Id[];
    enabled?: boolean;
    title: string;
    tagline: string;
    cost: { 1: number; 10: number };
    /** Chance of landing in each collection (sums to 1); hidden ones aren't advertised on the poster. */
    rates: { collection: C; rate: number; hidden: boolean }[];
    hero: Id;
    colors: { background: string; accent: string; text: string };
    poster: GachaImage | null;
  } | null;
  /** A secret collection, only drawn inside other banners. */
  hidden: boolean;
  /** `thumb` is a small copy of `image` for grids and lists. */
  characters: { id: Id; name: string; species?: string; image: GachaImage; thumb: GachaImage }[];
};

export type CatalogBanner = NonNullable<CollectionData['banner']> & { id: string };

type GradeOverrides<T> = { default: T } & Partial<Record<Grade, Partial<T>>>;

/** assets/gacha/rewards.json; amounts are free tickets. */
export type Rewards = {
  /** Coins paid per sold copy, including zero-coin normal cleanup. */
  sale: Record<Grade, number>;
  /**
   * Player-to-player auction: starting 시세 per grade, hard floor/ceil, the live band
   * (low/high %), and how often 시세 becomes the average of trades in that window.
   */
  auction: {
    quote: Record<Grade, number>;
    floor: Record<Grade, number>;
    ceil: Record<Grade, number>;
    low: number;
    high: number;
    windowHours: number;
  };
  /** Tickets work on banners whose single draw costs at most this many coins. */
  ticketMaxCost: number;
  /** Walking this many steps earns one coin. */
  stepsPerCoin: number;
  /** Per character: first copy, each count in `milestones`, then every `every` copies. */
  character: { milestones: number[]; every: number } & GradeOverrides<{ first: number; milestone: number; every: number }>;
  /** Per grade: first character of the grade, then every `every` characters of it. */
  grade: { every: number } & GradeOverrides<{ first: number; every: number }>;
  collectionComplete: number;
  drawCount: { milestones: number[]; every: number; reward: number };
  /** Grades crafting moves between, lowest first, and the collections it can produce. */
  crafting: { tiers: Grade[]; pool: string[] };
  /**
   * Eggs hatch after hatchMinutes for the child's grade; skipping costs coinsPerMinute per minute left.
   * Grades missing from hatchMinutes can't breed. A `baby.rate` share of eggs hold the baby collection's
   * version of a parent's animal; the rest a pool animal no higher than one parent picked at random: a
   * `sameTier` share at that parent's tier, the rest over lower tiers, each `lowerRatio` times likelier than
   * the one above it.
   */
  breeding: {
    hatchMinutes: Partial<Record<Grade, number>>;
    coinsPerMinute: number;
    baby?: { collection: string; rate: number };
    sameTier: number;
    lowerRatio: number;
  };
  /** Collection -> collection it evolves into, and per grade the companion steps and coins it costs. */
  evolution: {
    paths: Record<string, string>;
    steps: Partial<Record<Grade, number>>;
    coins: Partial<Record<Grade, number>>;
  };
  /** Any two characters of one grade plus coins: a random pool animal one tier up with chance `success`, else nothing. */
  fusion: Partial<Record<Grade, { coins: number; success: number }>>;
  /**
   * `count` characters become one pool animal: one tier above the lowest input with chance
   * base + perHigher per input above that lowest tier, each further tier `decay` times that, otherwise of
   * the lowest tier.
   */
  recycle: { count: number; upgrade: { base: number; perHigher: number; decay: number } };
};
