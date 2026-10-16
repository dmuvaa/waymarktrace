import type { Difficulty, GameSession } from "@/types/game";

export const SESSION_LENGTH = 10;

export const difficultyDetails: Record<
  Difficulty,
  { label: string; multiplier: number; description: string }
> = {
  easy: {
    label: "Easy",
    multiplier: 1,
    description: "Well-known figures, with borders and labels",
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
    description: "Obscure figures, bare silhouettes",
  },
};

export function calculateRoundScore(difficulty: Difficulty, hintsUsed: number) {
  const penalty = Math.min(hintsUsed * 0.2, 0.6);
  return Math.round(100 * difficultyDetails[difficulty].multiplier * (1 - penalty));
}

export function selectFigureIds(allIds: string[], count = SESSION_LENGTH) {
  const shuffled = [...allIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function idsForDifficulty(
  figures: { id: string; recognition: Difficulty }[],
  difficulty: Difficulty,
) {
  return figures.filter((figure) => figure.recognition === difficulty).map((figure) => figure.id);
}

export function createSession(
  difficulty: Difficulty,
  figures: { id: string; recognition: Difficulty }[],
): GameSession {
  const eligibleIds = idsForDifficulty(figures, difficulty);
  return {
    version: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    difficulty,
    figureIds: selectFigureIds(eligibleIds),
    roundIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    results: [],
    startedAt: Date.now(),
  };
}

export function getAccuracy(session: GameSession) {
  if (!session.results.length) return 0;
  const correct = session.results.filter((result) => result.resolution === "correct").length;
  return Math.round((correct / session.results.length) * 100);
}
