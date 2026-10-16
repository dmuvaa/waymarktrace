import { describe, expect, it } from "vitest";
import { hiddenHintText } from "./hints";
import { normalizeSession } from "./persistence";
import type { GameSession } from "@/types/game";

const session: GameSession = {
  version: 1,
  id: "session",
  difficulty: "easy",
  figureIds: ["ada-lovelace"],
  roundIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  results: [],
  startedAt: 1,
};

describe("hidden hints", () => {
  it("reveals only the first letter", () => {
    expect(hiddenHintText("Ada Lovelace")).toBe("The name starts with A.");
  });
});

describe("saved rounds", () => {
  it("keeps one valid hidden-hint state", () => {
    const saved = normalizeSession({
      ...session,
      roundState: {
        figureId: "ada-lovelace",
        regularHints: 1,
        hiddenHintUsed: true,
        incorrectGuesses: 0,
      },
    });
    expect(saved.roundState?.hiddenHintUsed).toBe(true);
  });

  it("drops a hidden hint saved for another figure", () => {
    const saved = normalizeSession({
      ...session,
      roundState: {
        figureId: "someone-else",
        regularHints: 1,
        hiddenHintUsed: true,
        incorrectGuesses: 0,
      },
    });
    expect(saved.roundState).toBeUndefined();
  });
});
