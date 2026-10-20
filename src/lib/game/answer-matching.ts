import { distance } from "fastest-levenshtein";
import type { HistoricalFigure, MatchResult } from "@/types/game";

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[ʻ’‘`]/g, "'")
    .replace(/['".,()[\]{}]/g, "")
    .replace(/[-–—_/]/g, " ")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

function adaptiveThreshold(length: number) {
  if (length <= 4) return 1;
  if (length <= 7) return 0.88;
  if (length <= 12) return 0.81;
  return 0.76;
}

const NAME_PARTICLES = new Set([
  "and",
  "da",
  "de",
  "del",
  "della",
  "den",
  "der",
  "di",
  "du",
  "ii",
  "iii",
  "iv",
  "ix",
  "jr",
  "la",
  "le",
  "les",
  "of",
  "sr",
  "st",
  "ten",
  "ter",
  "the",
  "van",
  "vi",
  "vii",
  "viii",
  "von",
  "xi",
]);

function significantTokens(value: string) {
  return tokens(value).filter((token) => token.length >= 4 && !NAME_PARTICLES.has(token));
}

function tokensClose(guessToken: string, nameToken: string) {
  const threshold = adaptiveThreshold(Math.max(guessToken.length, nameToken.length));
  return similarity(guessToken, nameToken) >= threshold;
}

function matchSingleName(
  guess: string,
  target: HistoricalFigure,
  dataset: HistoricalFigure[],
): MatchResult | null {
  if (target.recognition !== "easy" && target.recognition !== "medium") return null;

  const guessed = tokens(guess);
  if (guessed.length !== 1 || guessed[0].length < 4) return null;

  const token = guessed[0];
  const owners = dataset.filter((figure) =>
    significantTokens([figure.name, ...figure.aliases].join(" ")).some((nameToken) =>
      tokensClose(token, nameToken),
    ),
  );
  if (!owners.some((figure) => figure.id === target.id)) return null;
  if (owners.length > 1) return { status: "ambiguous", fuzzy: false };

  const exact = significantTokens([target.name, ...target.aliases].join(" ")).includes(token);
  return { status: "correct", fuzzy: !exact };
}

function isTokenMatch(guess: string, candidate: string) {
  const guessed = tokens(guess);
  const expected = tokens(candidate);

  if (guessed.length < 2 || expected.length < 2) return false;
  return guessed.every((guessToken) =>
    expected.some((expectedToken) => {
      const threshold = adaptiveThreshold(Math.max(guessToken.length, expectedToken.length));
      return similarity(guessToken, expectedToken) >= threshold;
    }),
  );
}

function candidateConfidence(guess: string, figure: HistoricalFigure) {
  const normalizedGuess = normalizeName(guess);
  const names = [figure.name, ...figure.aliases].map(normalizeName);

  if (names.includes(normalizedGuess)) return 1;
  if (names.some((name) => isTokenMatch(normalizedGuess, name))) return 0.94;

  return Math.max(...names.map((name) => similarity(normalizedGuess, name)));
}

export function matchAnswer(
  guess: string,
  target: HistoricalFigure,
  dataset: HistoricalFigure[],
): MatchResult {
  const normalized = normalizeName(guess);
  if (!normalized) return { status: "incorrect", fuzzy: false };

  const targetNames = [target.name, ...target.aliases].map(normalizeName);
  if (targetNames.includes(normalized)) {
    return { status: "correct", fuzzy: false };
  }

  const exactOwners = dataset.filter((figure) =>
    [figure.name, ...figure.aliases].some((name) => normalizeName(name) === normalized),
  );
  if (exactOwners.length > 1) return { status: "ambiguous", fuzzy: false };

  const singleName = matchSingleName(normalized, target, dataset);
  if (singleName) return singleName;

  const targetConfidence = candidateConfidence(normalized, target);
  const threshold = adaptiveThreshold(normalized.length);

  const competingConfidence = Math.max(
    0,
    ...dataset
      .filter((figure) => figure.id !== target.id)
      .map((figure) => candidateConfidence(normalized, figure)),
  );

  if (targetConfidence >= threshold) {
    if (competingConfidence >= threshold && targetConfidence - competingConfidence < 0.08) {
      return { status: "ambiguous", fuzzy: false };
    }
    return { status: "correct", fuzzy: targetConfidence < 1 };
  }

  const guessedTokens = tokens(normalized);
  if (
    guessedTokens.length === 1 &&
    guessedTokens[0].length >= 4 &&
    dataset.filter((figure) =>
      tokens([figure.name, ...figure.aliases].join(" ")).includes(guessedTokens[0]),
    ).length > 1
  ) {
    return { status: "ambiguous", fuzzy: false };
  }

  return { status: "incorrect", fuzzy: false };
}
