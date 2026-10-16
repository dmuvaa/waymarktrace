import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://qlever.cs.uni-freiburg.de/api/wikidata";
const desiredCount = 600;

const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?personLabel ?personDescription ?birth ?death
       ?birthPlace ?birthPlaceLabel ?birthCoord
       ?deathPlace ?deathPlaceLabel ?deathCoord
       ?sitelinks
WHERE {
  ?person wdt:P31 wd:Q5;
          wdt:P569 ?birth;
          wdt:P570 ?death;
          wdt:P19 ?birthPlace;
          wdt:P20 ?deathPlace;
          wikibase:sitelinks ?sitelinks;
          rdfs:label ?personLabel.
  ?article schema:about ?person;
           schema:isPartOf <https://en.wikipedia.org/>.
  ?birthPlace wdt:P625 ?birthCoord; rdfs:label ?birthPlaceLabel.
  ?deathPlace wdt:P625 ?deathCoord; rdfs:label ?deathPlaceLabel.
  OPTIONAL { ?person schema:description ?personDescription. FILTER(LANG(?personDescription) = "en") }
  FILTER(LANG(?personLabel) = "en")
  FILTER(LANG(?birthPlaceLabel) = "en")
  FILTER(LANG(?deathPlaceLabel) = "en")
  FILTER(YEAR(?death) <= 2026)
}
ORDER BY DESC(?sitelinks)
LIMIT ${desiredCount}
`;

function year(value) {
  const match = value.match(/^([+-]?\d{1,})-/);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function coordinates(value) {
  const match = value.match(/Point\(([-.\d]+) ([-.\d]+)\)/i);
  if (!match) return null;
  return { latitude: Number(match[2]), longitude: Number(match[1]) };
}

function centuryLabel(value) {
  const number = Math.floor((Math.abs(value) - 1) / 100) + 1;
  const remainder = number % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? "th"
      : number % 10 === 1
        ? "st"
        : number % 10 === 2
          ? "nd"
          : number % 10 === 3
            ? "rd"
            : "th";
  return `Born in the ${number}${suffix} century${value < 0 ? " BCE" : ""}`;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

for (const { person, personLabel, personDescription, birth, death, birthPlaceLabel, birthCoord, deathPlaceLabel, deathCoord } of payload.results.bindings) {
  const entityId = person.value.split("/").at(-1);
  if (!entityId || seenPeople.has(entityId)) continue;

  const birthYear = year(birth.value);
  const deathYear = year(death.value);
  const birthCoordinates = coordinates(birthCoord.value);
  const deathCoordinates = coordinates(deathCoord.value);
  if (
    !Number.isFinite(birthYear) ||
    !Number.isFinite(deathYear) ||
    !birthCoordinates ||
    !deathCoordinates ||
    birthYear > deathYear
  ) {
    continue;
  }

  const name = personLabel.value;
  const description = personDescription?.value || "Historical figure";
  const category = description.split(/,| and | who /i)[0].slice(0, 80);
  let id = slugify(name);
  if (!id || seenIds.has(id)) id = `${id || "figure"}-${entityId.toLowerCase()}`;
  seenPeople.add(entityId);
  seenIds.add(id);

  figures.push({
    id,
    name,
    aliases: [],
    birthYear,
    deathYear,
    birthLocation: { name: birthPlaceLabel.value, ...birthCoordinates },
    deathLocation: { name: deathPlaceLabel.value, ...deathCoordinates },
    biography: `${description.charAt(0).toUpperCase()}${description.slice(1)}.`,
    categories: [category],
    region: "Global history",
    hints: {
      category,
      century: centuryLabel(birthYear),
      clue: description.charAt(0).toUpperCase() + description.slice(1),
    },
    sources: [`https://www.wikidata.org/wiki/${entityId}`],
  });
}

await writeFile(
  join(root, "src", "data", "generated-figures.json"),
  `${JSON.stringify(figures, null, 2)}\n`,
);

console.log(`Generated ${figures.length} historical figures from Wikidata.`);
