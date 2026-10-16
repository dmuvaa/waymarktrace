import { describe, expect, it } from "vitest";
import { calculateRoundScore, selectFigureIds } from "./engine";

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
});
