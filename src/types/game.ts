export type Difficulty = "easy" | "medium" | "hard" | "super-hard";

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

export type HistoricalFigure = {
  id: string;
  name: string;
  aliases: string[];
  birthYear: number;
  deathYear: number;
  birthLocation: Location;
  deathLocation: Location;
  biography: string;
  categories: string[];
  region: string;
  hints: {
    category: string;
    century: string;
    clue: string;
  };
  sources: string[];
  recognition: Difficulty;
};

export type Resolution = "correct" | "revealed" | "skipped";

export type RoundResult = {
  figureId: string;
  resolution: Resolution;
  score: number;
  hintsUsed: number;
  incorrectGuesses: number;
};

export type RoundState = {
  figureId: string;
  regularHints: number;
  hiddenHintUsed: boolean;
  incorrectGuesses: number;
};

export type GameSession = {
  version: 1;
  id: string;
  difficulty: Difficulty;
  figureIds: string[];
  roundIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  results: RoundResult[];
  roundState?: RoundState;
  startedAt: number;
};

export type MatchResult =
  | { status: "correct"; fuzzy: boolean }
  | { status: "incorrect"; fuzzy: false }
  | { status: "ambiguous"; fuzzy: false };
