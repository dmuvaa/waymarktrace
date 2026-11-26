import { historicalFigures } from "@/data/historical-figures";
import type { Difficulty, GameSetup } from "@/types/game";
import { describe, expect, it } from "vitest";
import {
  calculateRoundScore,
  createSession,
  defaultSetup,
  eligiblePool,
  idsForDifficulty,
  pickFigures,
  selectFigureIds,
} from "./engine";

const setup = (patch: Partial<GameSetup> = {}): GameSetup => ({ ...defaultSetup, ...patch });

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
    expect(recognition.get("toussaint-louverture")).not.toBe("easy");
  });

  it("has deep pools for every tier", () => {
    const sizes = Object.fromEntries(
      (["easy", "medium", "hard", "super-hard"] as Difficulty[]).map((tier) => [
        tier,
        idsForDifficulty(historicalFigures, tier).length,
      ]),
    );
    expect(sizes.easy).toBeGreaterThanOrEqual(180);
    expect(sizes.medium).toBeGreaterThanOrEqual(400);
    expect(sizes.hard).toBeGreaterThanOrEqual(2000);
    expect(sizes["super-hard"]).toBeGreaterThanOrEqual(5000);
  });

  it("draws each game from its own recognition pool", () => {
    for (const difficulty of ["easy", "medium", "hard", "super-hard"] as Difficulty[]) {
      const ids = idsForDifficulty(historicalFigures, difficulty);
      const session = createSession(setup({ difficulty }), historicalFigures);
      expect(session.figureIds).toHaveLength(10);
      expect(new Set(session.figureIds).size).toBe(10);
      expect(session.figureIds.every((id) => ids.includes(id))).toBe(true);
    }
  });

  it("serves unseen figures before repeating any", () => {
    const pool = idsForDifficulty(historicalFigures, "easy");
    const seen = new Map<string, number>();
    const games = Math.floor(pool.length / 10);
    for (let game = 0; game < games; game += 1) {
      const picks = pickFigures(historicalFigures, setup({ difficulty: "easy" }), seen);
      for (const figure of picks) {
        expect(seen.has(figure.id)).toBe(false);
        seen.set(figure.id, game);
      }
    }
    // Once everything has been met, the longest-unseen figures return first.
    const next = pickFigures(historicalFigures, setup({ difficulty: "easy" }), seen);
    expect(next.every((figure) => (seen.get(figure.id) ?? -1) <= 1 || !seen.has(figure.id))).toBe(true);
  });

  it("spreads a game across regions and fields", () => {
    for (let run = 0; run < 20; run += 1) {
      const picks = pickFigures(historicalFigures, setup({ difficulty: "hard" }));
      const regions = new Map<string, number>();
      const fields = new Map<string, number>();
      for (const figure of picks) {
        regions.set(figure.worldRegion, (regions.get(figure.worldRegion) ?? 0) + 1);
        fields.set(figure.field, (fields.get(figure.field) ?? 0) + 1);
      }
      expect(Math.max(...regions.values())).toBeLessThanOrEqual(3);
      expect(Math.max(...fields.values())).toBeLessThanOrEqual(3);
    }
  });

  it("honours a theme and borrows nearby tiers when it runs short", () => {
    const themed = setup({ difficulty: "easy", region: "africa", rounds: 10 });
    const pool = eligiblePool(historicalFigures, themed);
    expect(pool.length).toBeGreaterThanOrEqual(10);
    expect(pool.every((figure) => figure.worldRegion === "africa")).toBe(true);
    const picks = pickFigures(historicalFigures, themed);
    expect(picks).toHaveLength(10);
    expect(picks.every((figure) => figure.worldRegion === "africa")).toBe(true);
  });
});
