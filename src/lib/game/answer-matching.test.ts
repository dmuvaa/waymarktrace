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
    const catherine = historicalFigures.find((figure) => figure.id === "catherine-the-great")!;
    const darwin = historicalFigures.find((figure) => figure.id === "charles-darwin")!;

    expect(matchAnswer("Hitler", hitler, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
    expect(matchAnswer("Adolf", hitler, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
    expect(matchAnswer("Catherine", catherine, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
    expect(matchAnswer("Darwin", darwin, historicalFigures)).toEqual({ status: "correct", fuzzy: false });
  });

  it("asks for a fuller name when a single name matches several figures", () => {
    const lennon = historicalFigures.find((figure) => figure.id === "john-lennon")!;
    expect(matchAnswer("John", lennon, historicalFigures).status).toBe("ambiguous");
  });

  it("keeps single surnames off hard", () => {
    const truman = historicalFigures.find((figure) => figure.id === "harry-s-truman")!;
    expect(truman.recognition).toBe("hard");
    expect(matchAnswer("Truman", truman, historicalFigures).status).toBe("incorrect");
    expect(matchAnswer("Harry S. Truman", truman, historicalFigures).status).toBe("correct");
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeName("  Simón—Bolívar  ")).toBe("simon bolivar");
  });
});
