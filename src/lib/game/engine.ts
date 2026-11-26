import type {
  Difficulty,
  GameSession,
  GameSetup,
  HistoricalFigure,
} from "@/types/game";

export const SESSION_LENGTH = 10;
export const ROUND_OPTIONS = [5, 10, 20] as const;

export const defaultSetup: GameSetup = {
  difficulty: "medium",
  era: "any",
  field: "any",
  region: "any",
  rounds: SESSION_LENGTH,
};

export const difficultyOrder: Difficulty[] = ["easy", "medium", "hard", "super-hard"];

export const difficultyDetails: Record<
  Difficulty,
  { label: string; multiplier: number; description: string }
> = {
  easy: {
    label: "Easy",
    multiplier: 1,
    description: "Household names, with borders and labels",
  },
  medium: {
    label: "Medium",
    multiplier: 1.5,
    description: "Familiar figures, borders and coastlines, no labels",
  },
  hard: {
    label: "Hard",
    multiplier: 2,
    description: "Lesser-known figures, land and coastlines only",
  },
  "super-hard": {
    label: "Super hard",
    multiplier: 3,
    description: "Deep cuts for real history buffs, bare silhouettes",
  },
};

export function calculateRoundScore(difficulty: Difficulty, hintsUsed: number) {
  const penalty = Math.min(hintsUsed * 0.2, 0.6);
  return Math.round(100 * difficultyDetails[difficulty].multiplier * (1 - penalty));
}

export function shuffle<T>(items: T[], random = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function selectFigureIds(allIds: string[], count = SESSION_LENGTH) {
  return shuffle(allIds).slice(0, Math.min(count, allIds.length));
}

type Pickable = Pick<HistoricalFigure, "id" | "recognition" | "era" | "field" | "worldRegion">;

export function idsForDifficulty(figures: Pickable[], difficulty: Difficulty) {
  return figures.filter((figure) => figure.recognition === difficulty).map((figure) => figure.id);
}

export function matchesTheme(figure: Pickable, setup: GameSetup) {
  return (
    (setup.era === "any" || figure.era === setup.era) &&
    (setup.field === "any" || figure.field === setup.field) &&
    (setup.region === "any" || figure.worldRegion === setup.region)
  );
}

function tierDistance(a: Difficulty, b: Difficulty) {
  return Math.abs(difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b));
}

/**
 * The figures a game can draw from. A theme with too few figures at the chosen tier borrows
 * from the nearest tiers so the game can still fill its rounds.
 */
export function eligiblePool<T extends Pickable>(figures: T[], setup: GameSetup): T[] {
  const themed = figures.filter((figure) => matchesTheme(figure, setup));
  const target = setup.difficulty;
  const exact = themed.filter((figure) => figure.recognition === target);
  if (exact.length >= setup.rounds) return exact;
  const byCloseness = [...difficultyOrder].sort(
    (a, b) => tierDistance(a, target) - tierDistance(b, target) || difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b),
  );
  const pool: T[] = [];
  for (const tier of byCloseness) {
    pool.push(...themed.filter((figure) => figure.recognition === tier));
    if (pool.length >= setup.rounds) break;
  }
  return pool;
}

type Caps = { region: number; field: number; era: number };

function capsFor(count: number, setup: GameSetup): Caps {
  const share = (ratio: number) => Math.max(2, Math.ceil(count * ratio));
  return {
    region: setup.region === "any" ? share(0.3) : Infinity,
    field: setup.field === "any" ? share(0.3) : Infinity,
    era: setup.era === "any" ? share(0.4) : Infinity,
  };
}

/**
 * Picks `count` figures from `candidates` (already shuffled, unseen first), spreading them
 * across world regions, fields and eras so one game isn't ten American presidents.
 */
function pickDiverse<T extends Pickable>(
  candidates: T[],
  count: number,
  caps: Caps,
  taken: Pickable[],
): T[] {
  const picked: T[] = [];
  const usage = (key: "worldRegion" | "field" | "era", value: string) =>
    [...taken, ...picked].filter((figure) => figure[key] === value).length;
  const used = new Set(taken.map((figure) => figure.id));

  for (const candidate of candidates) {
    if (picked.length >= count) break;
    if (used.has(candidate.id)) continue;
    if (
      usage("worldRegion", candidate.worldRegion) >= caps.region ||
      usage("field", candidate.field) >= caps.field ||
      usage("era", candidate.era) >= caps.era
    ) {
      continue;
    }
    picked.push(candidate);
    used.add(candidate.id);
  }
  // Caps are a preference: fill any gap from what's left, in the same order.
  for (const candidate of candidates) {
    if (picked.length >= count) break;
    if (used.has(candidate.id)) continue;
    picked.push(candidate);
    used.add(candidate.id);
  }
  return picked;
}

/** Maps a figure id to when the player last met it (any increasing number). */
export type SeenHistory = ReadonlyMap<string, number>;

/**
 * Picks from unseen figures first (shuffled) and only then from ones met before, longest ago
 * first. Freshness beats diversity: a seen figure is never chosen while an unseen one fits.
 */
function pickFresh<T extends Pickable>(
  pool: T[],
  count: number,
  caps: Caps,
  taken: Pickable[],
  seen: SeenHistory,
  random: () => number,
): T[] {
  const unseen = shuffle(pool.filter((figure) => !seen.has(figure.id)), random);
  const met = shuffle(pool.filter((figure) => seen.has(figure.id)), random);
  met.sort((a, b) => (seen.get(a.id) ?? 0) - (seen.get(b.id) ?? 0));
  const picked = pickDiverse(unseen, count, caps, taken);
  return [...picked, ...pickDiverse(met, count - picked.length, caps, [...taken, ...picked])];
}

export function pickFigures<T extends Pickable>(
  figures: T[],
  setup: GameSetup,
  seen: SeenHistory = new Map(),
  random = Math.random,
): T[] {
  const pool = eligiblePool(figures, setup);
  const count = Math.min(setup.rounds, pool.length);
  const caps = capsFor(count, setup);

  return pickFresh(pool, count, caps, [], seen, random);
}

export function createSession(
  setup: GameSetup,
  figures: Pickable[],
  seen: SeenHistory = new Map(),
): GameSession {
  return {
    version: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    setup,
    figureIds: pickFigures(figures, setup, seen).map((figure) => figure.id),
    roundIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    results: [],
    startedAt: Date.now(),
  };
}

export function isStandardGame(setup: GameSetup) {
  return (
    setup.rounds === SESSION_LENGTH &&
    setup.era === "any" &&
    setup.field === "any" &&
    setup.region === "any"
  );
}

export function getAccuracy(session: GameSession) {
  if (!session.results.length) return 0;
  const correct = session.results.filter((result) => result.resolution === "correct").length;
  return Math.round((correct / session.results.length) * 100);
}
