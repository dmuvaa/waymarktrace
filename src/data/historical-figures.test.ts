import { describe, expect, it } from "vitest";
import { historicalFigures } from "./historical-figures";

describe("historical figure dataset", () => {
  it("contains unique playable figures", () => {
    expect(historicalFigures.length).toBeGreaterThanOrEqual(500);
    expect(new Set(historicalFigures.map((figure) => figure.id)).size).toBe(historicalFigures.length);
  });

  it("includes complete coordinates and source references", () => {
    for (const figure of historicalFigures) {
      expect(Number.isFinite(figure.birthLocation.latitude)).toBe(true);
      expect(Number.isFinite(figure.birthLocation.longitude)).toBe(true);
      expect(Number.isFinite(figure.deathLocation.latitude)).toBe(true);
      expect(Number.isFinite(figure.deathLocation.longitude)).toBe(true);
      expect(figure.sources.length).toBeGreaterThan(0);
    }
  });
});
