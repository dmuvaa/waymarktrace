import type { Era, Field, WorldRegion } from "@/types/game";

export const eraDetails: Record<Era, { label: string; span: string }> = {
  ancient: { label: "Ancient world", span: "before 500" },
  medieval: { label: "Middle Ages", span: "500–1449" },
  "early-modern": { label: "Early modern", span: "1450–1749" },
  revolutions: { label: "Age of revolutions", span: "1750–1869" },
  modern: { label: "Modern era", span: "1870 onward" },
};

export const fieldDetails: Record<Field, { label: string }> = {
  leaders: { label: "Rulers & statesmen" },
  military: { label: "Warriors & commanders" },
  thought: { label: "Thinkers & faith" },
  science: { label: "Science & invention" },
  writers: { label: "Writers & poets" },
  arts: { label: "Art & architecture" },
  performers: { label: "Music, stage & screen" },
  pioneers: { label: "Explorers, activists & athletes" },
};

export const worldRegionDetails: Record<WorldRegion, { label: string }> = {
  europe: { label: "Europe" },
  mena: { label: "Middle East & North Africa" },
  africa: { label: "Sub-Saharan Africa" },
  "south-asia": { label: "South Asia" },
  "central-asia": { label: "Central Asia & Caucasus" },
  "east-asia": { label: "East & Southeast Asia" },
  "north-america": { label: "North America" },
  "latin-america": { label: "Latin America & Caribbean" },
  oceania: { label: "Oceania" },
};

/** Era is decided by the birth year. */
export function eraFor(birthYear: number): Era {
  if (birthYear < 500) return "ancient";
  if (birthYear < 1450) return "medieval";
  if (birthYear < 1750) return "early-modern";
  if (birthYear < 1870) return "revolutions";
  return "modern";
}

const fieldKeywords: Record<Field, string[]> = {
  leaders: [
    "king", "queen", "emperor", "empress", "monarch", "ruler", "pharaoh", "sultan", "caliph",
    "khan", "shah", "tsar", "czar", "prince", "princess", "president", "prime minister",
    "politician", "statesman", "statesperson", "chancellor", "diplomat", "head of state",
    "consort", "duke", "duchess", "regent", "dynasty", "governor", "first lady", "senator",
    "founding father", "dictator", "secretary", "royal", "chieftain", "chief",
  ],
  military: [
    "general", "admiral", "military", "soldier", "commander", "marshal", "conqueror", "warrior",
    "officer", "samurai", "guerrilla", "pirate", "privateer", "war hero", "warlord", "crusader",
  ],
  thought: [
    "philosopher", "theologian", "priest", "pope", "saint", "monk", "nun", "bishop", "religious",
    "prophet", "rabbi", "imam", "preacher", "missionary", "cleric", "mystic", "scholar",
    "historian", "economist", "sociologist", "jurist", "church", "apostle", "reformer of",
    "founder of religion", "sufi", "guru", "linguist", "psychoanalyst", "friar", "martyr",
  ],
  science: [
    "physicist", "chemist", "mathematician", "astronomer", "biologist", "engineer", "inventor",
    "physician", "botanist", "geologist", "scientist", "naturalist", "psychologist",
    "psychiatrist", "zoologist", "geographer", "computer", "physiologist", "anatomist",
    "surgeon", "neurologist", "geneticist", "archaeologist", "nobel prize in physics",
    "nobel prize in chemistry", "pharmacologist", "biochemist", "cartographer",
    "microbiologist", "physiology",
  ],
  writers: [
    "writer", "poet", "novelist", "playwright", "author", "essayist", "journalist", "dramatist",
    "translator", "literary", "satirist", "fabulist", "children's", "poetess",
  ],
  arts: [
    "painter", "sculptor", "architect", "artist", "photographer", "designer", "illustrator",
    "printmaker", "engraver", "cartoonist", "animator", "fashion", "manga",
  ],
  performers: [
    "composer", "musician", "singer", "pianist", "violinist", "conductor", "songwriter",
    "rapper", "guitarist", "actor", "actress", "film director", "filmmaker", "comedian",
    "dancer", "ballet", "screenwriter", "opera", "entertainer", "television", "cellist",
    "organist", "drummer", "band", "film producer", "rock", "jazz",
  ],
  pioneers: [
    "explorer", "navigator", "astronaut", "cosmonaut", "aviator", "aviatrix", "mountaineer",
    "traveler", "traveller", "activist", "revolutionary", "feminist", "suffragist",
    "abolitionist", "human rights", "humanitarian", "nurse", "entrepreneur", "businessman",
    "businesswoman", "businessperson", "industrialist", "banker", "footballer", "athlete",
    "boxer", "player", "cyclist", "racing driver", "chess", "swimmer", "tennis", "olympic",
    "sprinter", "wrestler", "coach", "pilot", "civil rights", "campaigner", "philanthropist",
  ],
};

const fieldOrder = Object.keys(fieldKeywords) as Field[];

const escape = (keyword: string) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fieldPatterns = fieldOrder.map(
  (field) => [field, new RegExp(`\\b(?:${fieldKeywords[field].map(escape).join("|")})`, "i")] as const,
);

/**
 * Picks the field someone is best remembered for. The one-line description is the most
 * reliable signal (Wikidata occupation lists are noisy), and the earlier a word appears in
 * it the more it counts: "American animator, producer, director" is an artist first.
 */
export function fieldFor(description: string, occupations: string[]): Field {
  let best: Field = "leaders";
  let bestScore = 0;
  for (const [field, pattern] of fieldPatterns) {
    let score = 0;
    const match = pattern.exec(description);
    if (match) score += 3 + (1 - match.index / Math.max(description.length, 1));
    occupations.forEach((occupation, index) => {
      if (pattern.test(occupation)) score += index === 0 ? 1.5 : 0.75;
    });
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }
  return best;
}

const regionCodes: Record<WorldRegion, string> = {
  europe:
    "AD AL AT BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK",
  mena: "AE BH CY DZ EG EH IL IQ IR JO KW LB LY MA OM PS QA SA SY TN TR YE",
  africa:
    "AO BF BI BJ BW CD CF CG CI CM CV DJ ER ET GA GH GM GN GQ GW KE KM LR LS MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TZ UG YT ZA ZM ZW",
  "south-asia": "AF BD BT IN LK MV NP PK",
  "central-asia": "AM AZ GE KG KZ TJ TM UZ",
  "east-asia": "BN CN HK ID JP KH KP KR LA MM MN MO MY PH SG TH TL TW VN",
  "north-america": "BM CA GL PM US",
  "latin-america":
    "AG AR AW BB BO BR BS BZ CL CO CR CU CW DM DO EC GD GF GP GT GY HN HT JM KN LC MQ MX NI PA PE PR PY SR SV TT UY VC VE",
  oceania: "AU FJ FM KI MH NC NR NZ PF PG PW SB TO TV VU WS",
};

const regionByCode = new Map<string, WorldRegion>();
for (const [region, codes] of Object.entries(regionCodes) as [WorldRegion, string][]) {
  for (const code of codes.split(" ")) regionByCode.set(code, region);
}

function regionFromCoordinates(latitude: number, longitude: number): WorldRegion {
  if (longitude < -140) return latitude >= 50 ? "north-america" : "oceania";
  if (longitude < -25) return latitude >= 30 ? "north-america" : "latin-america";
  if ((latitude < -10 && longitude > 110) || longitude > 165) return "oceania";
  if (latitude >= 36 && longitude < 45) return "europe";
  if (latitude < 37 && longitude >= -20 && longitude < 60) return latitude < 15 ? "africa" : "mena";
  if (longitude >= 60 && longitude < 92 && latitude < 36) return "south-asia";
  if (longitude >= 92) return "east-asia";
  if (latitude >= 36 && longitude >= 45 && longitude < 92) return latitude > 55 ? "europe" : "central-asia";
  return "europe";
}

/** World region of the birth place, from its modern country code when Wikidata has one. */
export function worldRegionFor(countryCode: string | undefined, latitude: number, longitude: number): WorldRegion {
  // Constantinople/Istanbul and Thrace sit on the European side of the Bosporus.
  if (countryCode === "TR") return longitude < 29.1 && latitude > 40.4 ? "europe" : "mena";
  return (countryCode && regionByCode.get(countryCode)) || regionFromCoordinates(latitude, longitude);
}
