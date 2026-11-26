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

  it("accepts a distinctive single name on easy and medium", () => {
    const hitler = historicalFigures.find((figure) => figure.id === "adolf-hitler")!;
    const einstein = historicalFigures.find((figure) => figure.id === "albert-einstein")!;
    const darwin = historicalFigures.find((figure) => figure.id === "charles-darwin")!;

    expect(matchAnswer("Hitler", hitler, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
    expect(matchAnswer("Einstein", einstein, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
    expect(matchAnswer("Darwin", darwin, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
  });

  it("asks for a fuller name when a single name matches several figures", () => {
    const lennon = historicalFigures.find((figure) => figure.id === "john-lennon")!;
    expect(matchAnswer("John", lennon, historicalFigures).status).toBe("ambiguous");
  });

  it("keeps single surnames off hard", () => {
    const buber = historicalFigures.find((figure) => figure.id === "martin-buber")!;
    expect(buber.recognition).toBe("hard");
    expect(matchAnswer("Buber", buber, historicalFigures).status).toBe("incorrect");
    expect(matchAnswer("Martin Buber", buber, historicalFigures).status).toBe("correct");
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeName("  Simón—Bolívar  ")).toBe("simon bolivar");
  });
});
