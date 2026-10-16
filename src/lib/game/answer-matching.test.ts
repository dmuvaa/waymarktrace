import { describe, expect, it } from "vitest";
import { historicalFigures } from "@/data/historical-figures";
import { matchAnswer, normalizeName } from "./answer-matching";

const napoleon = historicalFigures.find((figure) => figure.id === "napoleon-bonaparte")!;

describe("answer matching", () => {
  it.each([
    "Napoleon Bonaparte",
    "napoleon bonaparte",
    "Napolean Bonaparte",
    "Napoleon Bornapate",
    "Napoleon-Bonaparte",
    "Napoleon I",
    "Napoleon",
  ])("accepts %s", (guess) => {
    expect(matchAnswer(guess, napoleon, historicalFigures).status).toBe("correct");
  });

  it("rejects an unrelated figure", () => {
    expect(matchAnswer("Marie Curie", napoleon, historicalFigures).status).toBe("incorrect");
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeName("  Simón—Bolívar  ")).toBe("simon bolivar");
  });
});
