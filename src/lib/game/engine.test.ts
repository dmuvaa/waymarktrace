import { historicalFigures } from "@/data/historical-figures";
import type { Difficulty } from "@/types/game";
import { describe, expect, it } from "vitest";
import { calculateRoundScore, createSession, idsForDifficulty, selectFigureIds } from "./engine";

describe("scoring", () => {
  it("applies difficulty and hint penalties", () => {
    expect(calculateRoundScore("easy", 0)).toBe(100);
    expect(calculateRoundScore("medium", 2)).toBe(90);
    expect(calculateRoundScore("hard", 1)).toBe(160);
    expect(calculateRoundScore("super-hard", 0)).toBe(300);
  });

  it("caps hint penalties at 60 percent", () => {
    expect(calculateRoundScore("hard", 9)).toBe(80);
  });
});

describe("question selection", () => {
  it("selects unique figures", () => {
    const selected = selectFigureIds(["a", "b", "c", "d"], 3);
    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
  });

  it("keeps household names on easy and obscure figures off it", () => {
    const recognition = new Map(historicalFigures.map((figure) => [figure.id, figure.recognition]));
    expect(recognition.get("napoleon-bonaparte")).toBe("easy");
    expect(recognition.get("abraham-lincoln")).toBe("easy");
    expect(recognition.get("adolf-hitler")).toBe("easy");
    expect(recognition.get("joseph-stalin")).toBe("easy");
    expect(recognition.get("toussaint-louverture")).toBe("super-hard");
  });

  it("draws each game from its own recognition pool", () => {
    const difficulties: Difficulty[] = ["easy", "medium", "hard", "super-hard"];
    for (const difficulty of difficulties) {
      const ids = idsForDifficulty(historicalFigures, difficulty);
      expect(ids.length).toBeGreaterThanOrEqual(10);
      const session = createSession(difficulty, historicalFigures);
      expect(session.figureIds).toHaveLength(10);
      expect(session.figureIds.every((id) => ids.includes(id))).toBe(true);
    }
    const easyIds = idsForDifficulty(historicalFigures, "easy");
    expect(easyIds.length).toBeGreaterThanOrEqual(115);
    expect(idsForDifficulty(historicalFigures, "medium").length).toBeGreaterThanOrEqual(115);
    expect(idsForDifficulty(historicalFigures, "hard").length).toBeGreaterThanOrEqual(133);
    expect(easyIds).toContain("abraham-lincoln");
    expect(easyIds).not.toContain("toussaint-louverture");
    expect(idsForDifficulty(historicalFigures, "super-hard")).not.toContain("abraham-lincoln");
  });
});
