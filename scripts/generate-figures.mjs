// Builds src/data/generated-figures.json from Wikidata (via the QLever endpoint).
//
//   npm run data:generate              # fetch live
//   npm run data:generate -- raw.json  # rebuild from a saved SPARQL JSON response
//
// People are ranked by Wikipedia sitelink count; that rank drives the difficulty tiers
// (see src/lib/game/recognition.ts). We keep occupations, citizenship, alternate names
// and the ISO code of the birth place's country so the game can build better hints and
// sort figures by field, era and world region.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://qlever.dev/api/wikidata";
// Sitelinks (Wikipedia language editions) set the tiers in src/lib/game/recognition.ts:
// 120+ medium, 70–119 hard, below that super hard. The floor reaches real deep cuts.
const minSitelinks = 30;
const deepCutBelow = 70;
const maxFigures = 9000;
// Super hard is for historians, not trivia about recent minor celebrities: below the deep-cut
// line, people born after 1900 are dropped when they are remembered for screen, music or sport.
const modernEntertainment =
  /\b(actor|actress|singer|musician|rapper|guitarist|drummer|comedian|television|film|model|footballer|athlete|player|boxer|cyclist|wrestler|racing driver|swimmer|tennis|sprinter|coach|olympic|dancer|presenter|disc jockey|youtuber|songwriter|band)/i;

const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person (SAMPLE(?pl) AS ?personLabel) (SAMPLE(?pd) AS ?personDescription)
  (SAMPLE(?b) AS ?birth) (SAMPLE(?d) AS ?death)
  (SAMPLE(?bpl) AS ?birthPlaceLabel) (SAMPLE(?bc) AS ?birthCoord)
  (SAMPLE(?dpl) AS ?deathPlaceLabel) (SAMPLE(?dc) AS ?deathCoord)
  (MAX(?sl) AS ?sitelinks) (SAMPLE(?iso) AS ?birthIso) (SAMPLE(?bpt) AS ?birthPlaceIsCountry)
  (SAMPLE(?dpt) AS ?deathPlaceIsCountry)
  (GROUP_CONCAT(DISTINCT ?alt; SEPARATOR="|") AS ?alts)
  (GROUP_CONCAT(DISTINCT ?occLabel; SEPARATOR="|") AS ?occs)
  (GROUP_CONCAT(DISTINCT ?ctryLabel; SEPARATOR="|") AS ?ctrys)
WHERE {
  ?person wdt:P31 wd:Q5; wdt:P569 ?b; wdt:P570 ?d; wdt:P19 ?bp; wdt:P20 ?dp;
          wikibase:sitelinks ?sl; rdfs:label ?pl.
  FILTER(?sl >= ${minSitelinks})
  ?article schema:about ?person; schema:isPartOf <https://en.wikipedia.org/>.
  ?bp wdt:P625 ?bc; rdfs:label ?bpl.
  ?dp wdt:P625 ?dc; rdfs:label ?dpl.
  OPTIONAL { ?person schema:description ?pd. FILTER(LANG(?pd) = "en") }
  OPTIONAL { ?person wdt:P106 ?occ. ?occ rdfs:label ?occLabel. FILTER(LANG(?occLabel) = "en") }
  OPTIONAL { ?person wdt:P27 ?ctry. ?ctry rdfs:label ?ctryLabel. FILTER(LANG(?ctryLabel) = "en") }
  OPTIONAL { ?bp wdt:P17 ?bcty. ?bcty wdt:P297 ?iso }
  OPTIONAL { ?bp wdt:P31 ?bpt. FILTER(?bpt IN (wd:Q6256, wd:Q3624078, wd:Q3024240, wd:Q48349, wd:Q417175, wd:Q1250464, wd:Q7275, wd:Q11514315)) }
  OPTIONAL { ?dp wdt:P31 ?dpt. FILTER(?dpt IN (wd:Q6256, wd:Q3624078, wd:Q3024240, wd:Q48349, wd:Q417175, wd:Q1250464, wd:Q7275, wd:Q11514315)) }
  OPTIONAL { ?person skos:altLabel ?alt. FILTER(LANG(?alt) = "en") }
  FILTER(LANG(?pl) = "en") FILTER(LANG(?bpl) = "en") FILTER(LANG(?dpl) = "en")
}
GROUP BY ?person
ORDER BY DESC(?sitelinks)
LIMIT 30000
`;

// Wikidata occupations that say little about why someone is remembered.
const vagueOccupations = new Set([
  "university teacher",
  "autobiographer",
  "aristocrat",
  "statesperson",
  "diarist",
  "memoirist",
  "teacher",
  "lecturer",
  "professor",
  "letter writer",
  "esperantist",
  "military personnel",
  "prose writer",
  "author",
  "landowner",
  "official",
  "bibliographer",
  "collector",
  "art collector",
  "recording artist",
  "researcher",
  "scientist",
  "writer",
  "politician",
]);

// Sitelink counts are inflated for a few people by small bot-generated wikis, which would put
// near-unknowns among the household names; leave them out.
const excludedNames = new Set(["Sung Jae-gi", "Huang Xianfan", "Hebe Camargo", "Octave Mirbeau"]);

function value(binding, key) {
  return binding[key]?.value ?? "";
}

// SPARQL dates are XSD/astronomical: year 0 is 1 BCE and -0099 is 100 BCE. The game stores
// BCE years as plain negatives (-100 = 100 BCE), so shift anything at or before year 0.
function year(raw) {
  const match = raw.match(/^([+-]?\d{1,})-/);
  if (!match) return Number.NaN;
  const astronomical = Number.parseInt(match[1], 10);
  return astronomical <= 0 ? astronomical - 1 : astronomical;
}

function coordinates(raw) {
  const match = raw.match(/Point\(([-.\d]+) ([-.\d]+)\)/i);
  if (!match) return null;
  return { latitude: Number(match[2]), longitude: Number(match[1]) };
}

function slugify(raw) {
  return raw
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function cleanDescription(text) {
  return text
    .replace(/\s*\((?:c\.\s*)?[^()]*\d{2,4}[^()]*\)\s*$/u, "") // trailing "(1907–1989)"
    .replace(/\s+/g, " ")
    .trim();
}

function pickOccupations(occupations, description) {
  const lowerDescription = description.toLowerCase();
  const unique = [...new Set(occupations.map((item) => item.trim()).filter(Boolean))];
  const mentioned = unique.filter((item) => lowerDescription.includes(item.toLowerCase()));
  const rest = unique.filter(
    (item) => !mentioned.includes(item) && !vagueOccupations.has(item.toLowerCase()),
  );
  const ordered = [...mentioned, ...rest];
  return (ordered.length ? ordered : unique).slice(0, 4);
}

function pickAliases(rawAliases, name) {
  const nameKey = name.toLowerCase();
  return [...new Set(rawAliases.split("|"))]
    .map((alias) => alias.trim())
    .filter(
      (alias) =>
        alias.length >= 3 &&
        alias.length <= 40 &&
        alias.toLowerCase() !== nameKey &&
        /\p{L}/u.test(alias) &&
        !/^Q\d+$/.test(alias),
    )
    .slice(0, 5);
}

function pickNationality(countries) {
  const list = countries.split("|").filter(Boolean);
  return list[0] ?? "";
}

let payload;
if (process.argv[2]) {
  const savedResponse = JSON.parse(await readFile(process.argv[2], "utf8"));
  payload = savedResponse.result?.value ?? savedResponse;
} else {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/sparql-query",
      "User-Agent": "Waymarktrace/1.0 (static educational dataset)",
    },
    body: query,
  });
  if (!response.ok) {
    throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
  }
  payload = await response.json();
}

const seenPeople = new Set();
const seenIds = new Set();
const figures = [];
let skipped = 0;

for (const binding of payload.results.bindings) {
  if (figures.length >= maxFigures) break;
  const entityId = value(binding, "person").split("/").at(-1);
  if (!entityId || seenPeople.has(entityId) || false) continue;

  const birthYear = year(value(binding, "birth"));
  const deathYear = year(value(binding, "death"));
  const birthCoordinates = coordinates(value(binding, "birthCoord"));
  const deathCoordinates = coordinates(value(binding, "deathCoord"));
  const name = value(binding, "personLabel");
  if (
    !name ||
    excludedNames.has(name) ||
    /^Q\d+$/.test(name) ||
    !Number.isFinite(birthYear) ||
    !Number.isFinite(deathYear) ||
    !birthCoordinates ||
    !deathCoordinates ||
    birthYear > deathYear ||
    deathYear - birthYear > 110 ||
    // A whole country or empire as the "place" puts the marker at a meaningless centroid.
    value(binding, "birthPlaceIsCountry") ||
    value(binding, "deathPlaceIsCountry")
  ) {
    skipped += 1;
    continue;
  }

  const description = cleanDescription(value(binding, "personDescription")) || "Historical figure";
  const sitelinks = Number(value(binding, "sitelinks"));
  if (sitelinks < minSitelinks) break; // rows are sorted by sitelinks, so a saved pull can go deeper
  if (
    sitelinks < deepCutBelow &&
    birthYear >= 1900 &&
    modernEntertainment.test(`${description} ${value(binding, "occs").split("|").slice(0, 3).join(" ")}`)
  ) {
    skipped += 1;
    continue;
  }
  const occupations = pickOccupations(value(binding, "occs").split("|"), description);
  let id = slugify(name);
  if (!id || seenIds.has(id)) id = `${id || "figure"}-${entityId.toLowerCase()}`;
  seenPeople.add(entityId);
  seenIds.add(id);

  // Compact record; src/data/historical-figures.ts expands it into a HistoricalFigure.
  const round = (n) => Math.round(n * 1000) / 1000;
  figures.push({
    id,
    q: entityId,
    n: name,
    a: pickAliases(value(binding, "alts"), name),
    b: birthYear,
    d: deathYear,
    bp: [value(binding, "birthPlaceLabel"), round(birthCoordinates.latitude), round(birthCoordinates.longitude)],
    dp: [value(binding, "deathPlaceLabel"), round(deathCoordinates.latitude), round(deathCoordinates.longitude)],
    s: capitalize(description),
    o: occupations.slice(0, 3).map(capitalize),
    c: pickNationality(value(binding, "ctrys")),
    i: value(binding, "birthIso") || "",
    l: sitelinks,
  });
}

// Wikidata often records a building rather than a town: "Birthplace of Ronald Reagan",
// "Weill Cornell Medical Center", "668 St. Cloud Road". Those give the answer away or mean
// nothing on a map, so name the town they are in instead. The marker keeps its coordinates.
const placesEndpoint = "https://query.wikidata.org/sparql";

async function placeDetails(entityIds) {
  const query = `
SELECT ?person ?place ?placeLabel ?isTown ?isArea ?parentLabel WHERE {
  VALUES ?person { ${entityIds.map((id) => `wd:${id}`).join(" ")} }
  { ?person wdt:P19 ?place } UNION { ?person wdt:P20 ?place }
  BIND(EXISTS { ?place wdt:P31/wdt:P279* wd:Q486972 } AS ?isTown)
  BIND(EXISTS { ?place wdt:P31/wdt:P279* wd:Q56061 } AS ?isArea)
  OPTIONAL { ?place wdt:P131 ?parent }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${placesEndpoint}?query=${encodeURIComponent(query)}`, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "Waymarktrace/1.0 (static educational dataset)",
      },
    });
    if (response.ok) return (await response.json()).results.bindings;
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
  throw new Error("Wikidata place lookup failed");
}

// Only the person's own name counts: "Vasili III of Moscow" may be born in Moscow.
function surnameIn(label, name) {
  const ownName = name.split(/\s+of\s+|,/i)[0];
  const words = ownName.split(/\s+/).filter((word) => word.length >= 4);
  return words.some((word) => label.toLowerCase().includes(word.toLowerCase()));
}

const placesCache = process.argv[3];
let placeRows;
if (placesCache) {
  try {
    placeRows = JSON.parse(await readFile(placesCache, "utf8"));
  } catch {
    placeRows = undefined;
  }
}
if (!placeRows) {
  placeRows = [];
  // Small batches, three at a time: the query service times out on big ones.
  const ids = figures.map((figure) => figure.q);
  const batches = [];
  for (let start = 0; start < ids.length; start += 100) batches.push(ids.slice(start, start + 100));
  let done = 0;
  const worker = async () => {
    while (batches.length) {
      const batch = batches.shift();
      placeRows.push(...(await placeDetails(batch)));
      done += batch.length;
      process.stdout.write(`\rLooked up places for ${done}/${ids.length} people`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  process.stdout.write("\n");
  if (placesCache) await writeFile(placesCache, JSON.stringify(placeRows));
}

const placesByPerson = new Map();
for (const row of placeRows) {
  const id = value(row, "person").split("/").at(-1);
  const list = placesByPerson.get(id) ?? [];
  list.push({
    label: value(row, "placeLabel"),
    isTown: value(row, "isTown") === "true",
    isArea: value(row, "isArea") === "true",
    parent: value(row, "parentLabel"),
  });
  placesByPerson.set(id, list);
}

// Buildings, estates and addresses. Unclassified real places (ancient cities, islands) stay.
const looksLikeBuilding =
  /\b(hospital|clinic|medical|sanatorium|infirmary|palace|palais|palazzo|château|chateau|castle|schloss|house|home|hall|manor|villa|estate|ranch|farm|plantation|monument|birthplace|road|street|rue|avenue|boulevard|square|lane|hotel|apartment|building|tower|church|cathedral|abbey|monastery|convent|prison|camp|hill|gardens?|park|cemetery|school|college|university|institute|station|airport|residence|center|centre|theatre|theater|ranch|lodge|cottage|mansion|court|quarter)\b|^\d/i;

let renamedPlaces = 0;
for (const figure of figures) {
  for (const key of ["bp", "dp"]) {
    const label = figure[key][0];
    const info = (placesByPerson.get(figure.q) ?? []).find((place) => place.label === label);
    if (!info?.parent || /^Q\d+$/.test(info.parent)) continue;
    const namesThePerson = surnameIn(label, figure.n);
    if (namesThePerson || (!info.isTown && !info.isArea && looksLikeBuilding.test(label))) {
      figure[key][0] = info.parent;
      renamedPlaces += 1;
    }
  }
}
console.log(`Renamed ${renamedPlaces} building or address places to their town.`);

await writeFile(join(root, "src", "data", "generated-figures.json"), `${JSON.stringify(figures)}\n`);
console.log(`Wrote ${figures.length} figures (${skipped} skipped).`);
