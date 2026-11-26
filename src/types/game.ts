export type Difficulty = "easy" | "medium" | "hard" | "super-hard";


export type Era = "ancient" | "medieval" | "early-modern" | "revolutions" | "modern";

export type Field =
  | "leaders"
  | "military"
  | "thought"
  | "science"
  | "writers"
  | "arts"
  | "performers"
  | "pioneers";

export type WorldRegion =
  | "europe"
  | "mena"
  | "africa"
  | "south-asia"
  | "central-asia"
  | "east-asia"
  | "north-america"
  | "latin-america"
  | "oceania";

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
  /** Nationality or homeland, used for the second hint. */
  region: string;
  hints: {
    category: string;
    clue: string;
  };
  sources: string[];
  recognition: Difficulty;
  era: Era;
  field: Field;
  worldRegion: WorldRegion;
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

export type GameSetup = {
  difficulty: Difficulty;
  era: Era | "any";
  field: Field | "any";
  region: WorldRegion | "any";
  rounds: number;
};

export type GameSession = {
  version: 2;
  id: string;
  setup: GameSetup;
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
