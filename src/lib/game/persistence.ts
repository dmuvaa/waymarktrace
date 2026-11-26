import { defaultSetup, ROUND_OPTIONS } from "@/lib/game/engine";
import { eraDetails, fieldDetails, worldRegionDetails } from "@/lib/game/classify";
import type { Difficulty, GameSession, GameSetup, RoundState } from "@/types/game";

const SESSION_KEY = "waymarktrace:session:v2";
const SETUP_KEY = "waymarktrace:setup:v2";
const LEGACY_PREFERENCES_KEY = "waymarktrace:preferences:v1";
const SCORES_KEY = "waymarktrace:scores:v1";
const SEEN_KEY = "waymarktrace:seen:v1";
const SEEN_LIMIT = 3000;

type BestScores = Record<Difficulty, number>;

const difficulties: Difficulty[] = ["easy", "medium", "hard", "super-hard"];

function validRoundState(session: GameSession, state: RoundState | undefined) {
  return (
    !!state &&
    state.figureId === session.figureIds[session.roundIndex] &&
    Number.isInteger(state.regularHints) &&
    state.regularHints >= 0 &&
    state.regularHints <= 3 &&
    typeof state.hiddenHintUsed === "boolean" &&
    Number.isInteger(state.incorrectGuesses) &&
    state.incorrectGuesses >= 0
  );
}

export function normalizeSession(session: GameSession): GameSession {
  if (!session.roundState || validRoundState(session, session.roundState)) return session;
  return { ...session, roundState: undefined };
}

function storageAvailable() {
  try {
    const key = "__waymarktrace_test__";
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function validSetup(value: unknown): GameSetup | null {
  if (!value || typeof value !== "object") return null;
  const setup = value as Partial<GameSetup>;
  const okDifficulty = difficulties.includes(setup.difficulty as Difficulty);
  const okEra = setup.era === "any" || (!!setup.era && setup.era in eraDetails);
  const okField = setup.field === "any" || (!!setup.field && setup.field in fieldDetails);
  const okRegion = setup.region === "any" || (!!setup.region && setup.region in worldRegionDetails);
  const okRounds = (ROUND_OPTIONS as readonly number[]).includes(setup.rounds as number);
  return okDifficulty && okEra && okField && okRegion && okRounds ? (setup as GameSetup) : null;
}

export function saveSession(session: GameSession | null) {
  if (!storageAvailable()) return false;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  return true;
}

export function loadSession(validFigureIds: Set<string>): GameSession | null {
  if (!storageAvailable()) return null;
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as GameSession | null;
    if (
      !session ||
      session.version !== 2 ||
      !validSetup(session.setup) ||
      !Array.isArray(session.figureIds) ||
      session.figureIds.length === 0 ||
      !session.figureIds.every((id) => validFigureIds.has(id)) ||
      session.roundIndex < 0 ||
      session.roundIndex >= session.figureIds.length ||
      session.results.length > session.figureIds.length
    ) {
      return null;
    }
    return normalizeSession(session);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSetup(setup: GameSetup) {
  if (storageAvailable()) localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
}

export function loadSetup(): GameSetup {
  if (!storageAvailable()) return defaultSetup;
  try {
    const saved = validSetup(JSON.parse(localStorage.getItem(SETUP_KEY) ?? "null"));
    if (saved) return saved;
  } catch {
    // fall through to the legacy preference
  }
  const legacy = localStorage.getItem(LEGACY_PREFERENCES_KEY);
  return difficulties.includes(legacy as Difficulty)
    ? { ...defaultSetup, difficulty: legacy as Difficulty }
    : defaultSetup;
}

export function getBestScores(): BestScores {
  const fallback: BestScores = { easy: 0, medium: 0, hard: 0, "super-hard": 0 };
  if (!storageAvailable()) return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SCORES_KEY) ?? "{}") };
  } catch {
    return fallback;
  }
}

export function recordBestScore(difficulty: Difficulty, score: number) {
  if (!storageAvailable()) return false;
  const scores = getBestScores();
  const isNewBest = score > scores[difficulty];
  scores[difficulty] = Math.max(scores[difficulty], score);
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  return isNewBest;
}

/** Figures the player has already met, with when, so new games favour fresh faces. */
export function loadSeen(): Map<string, number> {
  if (!storageAvailable()) return new Map();
  try {
    const entries = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as [string, number][];
    return new Map(Array.isArray(entries) ? entries : []);
  } catch {
    return new Map();
  }
}

export function markSeen(figureId: string) {
  if (!storageAvailable()) return;
  const seen = loadSeen();
  seen.delete(figureId);
  seen.set(figureId, Date.now());
  const entries = [...seen.entries()].slice(-SEEN_LIMIT);
  localStorage.setItem(SEEN_KEY, JSON.stringify(entries));
}

export function clearSeen() {
  if (storageAvailable()) localStorage.removeItem(SEEN_KEY);
}
