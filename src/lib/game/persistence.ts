import type { Difficulty, GameSession, RoundState } from "@/types/game";

const SESSION_KEY = "waymarktrace:session:v1";
const PREFERENCES_KEY = "waymarktrace:preferences:v1";
const SCORES_KEY = "waymarktrace:scores:v1";

type BestScores = Record<Difficulty, number>;

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
      session.version !== 1 ||
      !["easy", "medium", "hard", "super-hard"].includes(session.difficulty) ||
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

export function savePreferredDifficulty(difficulty: Difficulty) {
  if (storageAvailable()) localStorage.setItem(PREFERENCES_KEY, difficulty);
}

export function loadPreferredDifficulty(): Difficulty {
  if (!storageAvailable()) return "medium";
  const value = localStorage.getItem(PREFERENCES_KEY);
  return value === "easy" || value === "hard" || value === "super-hard" ? value : "medium";
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
  if (!storageAvailable()) return;
  const scores = getBestScores();
  scores[difficulty] = Math.max(scores[difficulty], score);
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}
