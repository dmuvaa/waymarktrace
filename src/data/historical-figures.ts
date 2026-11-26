import { normalizeName } from "@/lib/game/answer-matching";
import { MEDIUM_SITELINKS, recognitionFor } from "@/lib/game/recognition";
import { eraFor, fieldFor, worldRegionDetails, worldRegionFor } from "@/lib/game/classify";
import type { HistoricalFigure } from "@/types/game";
import { addedMediumFigures, type CuratedFigureRecord } from "./added-medium-figures";
import generatedFigures from "./generated-figures.json";

type FigureRecord = CuratedFigureRecord;

/** Compact record written by scripts/generate-figures.mjs, ordered by fame (sitelinks). */
type GeneratedRecord = {
  id: string;
  q: string;
  n: string;
  a: string[];
  b: number;
  d: number;
  bp: [string, number, number];
  dp: [string, number, number];
  s: string;
  o: string[];
  c: string;
  i: string;
  /** Wikipedia language editions with an article on this person: the fame measure. */
  l: number;
};

const source = (slug: string) => [`https://en.wikipedia.org/wiki/${slug}`];

const curatedHistoricalFigures: FigureRecord[] = [
  {
    id: "napoleon-bonaparte",
    name: "Napoleon Bonaparte",
    aliases: ["Napoleon", "Napoleon I", "Napoléon Bonaparte"],
    birthYear: 1769,
    deathYear: 1821,
    birthLocation: { name: "Ajaccio, Corsica", latitude: 41.9192, longitude: 8.7386 },
    deathLocation: { name: "Longwood, Saint Helena", latitude: -15.9507, longitude: -5.6903 },
    biography: "A French military commander and emperor whose campaigns reshaped Europe and whose legal reforms had a lasting global influence.",
    categories: ["Military leader", "Political leader"],
    region: "France and Europe",
    hints: { category: "Military and political leader", clue: "He rose to power after the French Revolution and later became emperor." },
    sources: source("Napoleon"),
  },
  {
    id: "cleopatra",
    name: "Cleopatra VII",
    aliases: ["Cleopatra", "Cleopatra VII Philopator"],
    birthYear: -69,
    deathYear: -30,
    birthLocation: { name: "Alexandria, Ptolemaic Egypt", latitude: 31.2001, longitude: 29.9187 },
    deathLocation: { name: "Alexandria, Ptolemaic Egypt", latitude: 31.2001, longitude: 29.9187 },
    biography: "The final active ruler of Ptolemaic Egypt, renowned for her political alliances with Julius Caesar and Mark Antony.",
    categories: ["Monarch", "Political leader"],
    region: "North Africa",
    hints: { category: "Monarch", clue: "She was the last active ruler of a Greek-speaking dynasty in Egypt." },
    sources: source("Cleopatra"),
  },
  {
    id: "marie-curie",
    name: "Marie Curie",
    aliases: ["Maria Skłodowska-Curie", "Marie Sklodowska Curie", "Madame Curie"],
    birthYear: 1867,
    deathYear: 1934,
    birthLocation: { name: "Warsaw, Poland", latitude: 52.2297, longitude: 21.0122 },
    deathLocation: { name: "Passy, France", latitude: 45.9237, longitude: 6.687 },
    biography: "A physicist and chemist who pioneered research on radioactivity and became the first person to win Nobel Prizes in two sciences.",
    categories: ["Scientist"],
    region: "Poland and France",
    hints: { category: "Scientist", clue: "Her research led to the discovery of polonium and radium." },
    sources: source("Marie_Curie"),
  },
  {
    id: "nelson-mandela",
    name: "Nelson Mandela",
    aliases: ["Nelson Rolihlahla Mandela", "Mandela", "Madiba"],
    birthYear: 1918,
    deathYear: 2013,
    birthLocation: { name: "Mvezo, South Africa", latitude: -31.9593, longitude: 28.5209 },
    deathLocation: { name: "Johannesburg, South Africa", latitude: -26.2041, longitude: 28.0473 },
    biography: "An anti-apartheid leader who spent 27 years in prison before becoming South Africa’s first Black president.",
    categories: ["Political leader", "Activist"],
    region: "Southern Africa",
    hints: { category: "Political leader and activist", clue: "After 27 years in prison, he led his country through a democratic transition." },
    sources: source("Nelson_Mandela"),
  },
  {
    id: "genghis-khan",
    name: "Genghis Khan",
    aliases: ["Chinggis Khan", "Temujin", "Temüjin"],
    birthYear: 1162,
    deathYear: 1227,
    birthLocation: { name: "Khentii Mountains, Mongolia", latitude: 48.0, longitude: 110.0 },
    deathLocation: { name: "Western Xia, near modern Yinchuan", latitude: 38.4872, longitude: 106.2309 },
    biography: "Founder and first Great Khan of the Mongol Empire, which became the largest contiguous land empire in history.",
    categories: ["Military leader", "Monarch"],
    region: "Central and East Asia",
    hints: { category: "Conqueror and ruler", clue: "He united the tribes of the Mongolian plateau under one empire." },
    sources: source("Genghis_Khan"),
  },
  {
    id: "frida-kahlo",
    name: "Frida Kahlo",
    aliases: ["Magdalena Carmen Frida Kahlo y Calderón", "Frida"],
    birthYear: 1907,
    deathYear: 1954,
    birthLocation: { name: "Coyoacán, Mexico City", latitude: 19.3553, longitude: -99.1628 },
    deathLocation: { name: "Coyoacán, Mexico City", latitude: 19.3553, longitude: -99.1628 },
    biography: "A Mexican painter known for vivid self-portraits that explored identity, pain, nature, and Mexican culture.",
    categories: ["Artist"],
    region: "Mexico",
    hints: { category: "Artist", clue: "Her highly personal self-portraits often included symbols from Mexican folk culture." },
    sources: source("Frida_Kahlo"),
  },
  {
    id: "ibn-battuta",
    name: "Ibn Battuta",
    aliases: ["Ibn Baṭṭūṭa", "Abu Abdullah Muhammad Ibn Battuta"],
    birthYear: 1304,
    deathYear: 1369,
    birthLocation: { name: "Tangier, Morocco", latitude: 35.7595, longitude: -5.834 },
    deathLocation: { name: "Marrakesh, Morocco", latitude: 31.6295, longitude: -7.9811 },
    biography: "A Moroccan scholar and explorer whose decades of travel across Africa and Eurasia were recorded in the Rihla.",
    categories: ["Explorer", "Writer"],
    region: "North Africa",
    hints: { category: "Explorer and scholar", clue: "His journeys covered more distance than those of Marco Polo." },
    sources: source("Ibn_Battuta"),
  },
  {
    id: "ada-lovelace",
    name: "Ada Lovelace",
    aliases: ["Augusta Ada King", "Countess of Lovelace"],
    birthYear: 1815,
    deathYear: 1852,
    birthLocation: { name: "London, England", latitude: 51.5074, longitude: -0.1278 },
    deathLocation: { name: "London, England", latitude: 51.5074, longitude: -0.1278 },
    biography: "An English mathematician whose notes on Charles Babbage’s Analytical Engine included an early published computer algorithm.",
    categories: ["Mathematician", "Writer"],
    region: "United Kingdom",
    hints: { category: "Mathematician", clue: "She described how a proposed mechanical computer could process more than numbers." },
    sources: source("Ada_Lovelace"),
  },
  {
    id: "mahatma-gandhi",
    name: "Mahatma Gandhi",
    aliases: ["Mohandas Gandhi", "Mohandas Karamchand Gandhi", "Gandhi"],
    birthYear: 1869,
    deathYear: 1948,
    birthLocation: { name: "Porbandar, India", latitude: 21.6417, longitude: 69.6293 },
    deathLocation: { name: "New Delhi, India", latitude: 28.6139, longitude: 77.209 },
    biography: "A leader of India’s independence movement who advanced nonviolent resistance as a means of political and social change.",
    categories: ["Activist", "Political leader"],
    region: "South Asia",
    hints: { category: "Independence leader", clue: "He made nonviolent civil disobedience central to a campaign against colonial rule." },
    sources: source("Mahatma_Gandhi"),
  },
  {
    id: "simon-bolivar",
    name: "Simón Bolívar",
    aliases: ["Simon Bolivar", "El Libertador", "Bolívar"],
    birthYear: 1783,
    deathYear: 1830,
    birthLocation: { name: "Caracas, Venezuela", latitude: 10.4806, longitude: -66.9036 },
    deathLocation: { name: "Santa Marta, Colombia", latitude: 11.2408, longitude: -74.199 },
    biography: "A Venezuelan military and political leader who helped secure the independence of several South American nations.",
    categories: ["Military leader", "Revolutionary"],
    region: "South America",
    hints: { category: "Revolutionary leader", clue: "Known as El Libertador, he led independence campaigns across northern South America." },
    sources: source("Simón_Bolívar"),
  },
  {
    id: "confucius",
    name: "Confucius",
    aliases: ["Kong Qiu", "Kong Fuzi", "Master Kong"],
    birthYear: -551,
    deathYear: -479,
    birthLocation: { name: "Qufu, State of Lu", latitude: 35.5808, longitude: 116.9865 },
    deathLocation: { name: "Qufu, State of Lu", latitude: 35.5808, longitude: 116.9865 },
    biography: "A Chinese philosopher and teacher whose ethical and political ideas profoundly shaped East Asian thought.",
    categories: ["Philosopher", "Teacher"],
    region: "East Asia",
    hints: { category: "Philosopher and teacher", clue: "His teachings emphasized moral cultivation, family duty, and just government." },
    sources: source("Confucius"),
  },
  {
    id: "florence-nightingale",
    name: "Florence Nightingale",
    aliases: ["The Lady with the Lamp", "Nightingale"],
    birthYear: 1820,
    deathYear: 1910,
    birthLocation: { name: "Florence, Tuscany", latitude: 43.7696, longitude: 11.2558 },
    deathLocation: { name: "London, England", latitude: 51.5074, longitude: -0.1278 },
    biography: "A British nurse and statistician whose work during the Crimean War helped establish modern professional nursing.",
    categories: ["Medical reformer", "Statistician"],
    region: "Europe",
    hints: { category: "Medical reformer", clue: "Her public-health diagrams and hospital reforms transformed nursing." },
    sources: source("Florence_Nightingale"),
  },
  {
    id: "leonardo-da-vinci",
    name: "Leonardo da Vinci",
    aliases: ["Leonardo di ser Piero da Vinci", "Leonardo"],
    birthYear: 1452,
    deathYear: 1519,
    birthLocation: { name: "Vinci, Republic of Florence", latitude: 43.787, longitude: 10.926 },
    deathLocation: { name: "Amboise, France", latitude: 47.413, longitude: 0.9827 },
    biography: "An Italian Renaissance artist and polymath whose work joined close observation, engineering, anatomy, and painting.",
    categories: ["Artist", "Inventor"],
    region: "Europe",
    hints: { category: "Artist and polymath", clue: "His notebooks explored anatomy and flight; his paintings include the Mona Lisa." },
    sources: source("Leonardo_da_Vinci"),
  },
  {
    id: "murasaki-shikibu",
    name: "Murasaki Shikibu",
    aliases: ["Lady Murasaki", "Murasaki"],
    birthYear: 973,
    deathYear: 1014,
    birthLocation: { name: "Kyoto, Japan", latitude: 35.0116, longitude: 135.7681 },
    deathLocation: { name: "Kyoto, Japan", latitude: 35.0116, longitude: 135.7681 },
    biography: "A Japanese court lady and author of The Tale of Genji, often described as one of the world’s earliest novels.",
    categories: ["Writer"],
    region: "East Asia",
    hints: { category: "Writer", clue: "She wrote an expansive account of court life in Heian-period Japan." },
    sources: source("Murasaki_Shikibu"),
  },
  {
    id: "harriet-tubman",
    name: "Harriet Tubman",
    aliases: ["Araminta Ross", "Minty Ross", "Tubman"],
    birthYear: 1822,
    deathYear: 1913,
    birthLocation: { name: "Dorchester County, Maryland", latitude: 38.4153, longitude: -76.1784 },
    deathLocation: { name: "Auburn, New York", latitude: 42.9317, longitude: -76.5661 },
    biography: "An American abolitionist who escaped slavery and repeatedly returned south to guide others to freedom.",
    categories: ["Abolitionist", "Activist"],
    region: "North America",
    hints: { category: "Abolitionist", clue: "She became a leading conductor on the Underground Railroad." },
    sources: source("Harriet_Tubman"),
  },
  {
    id: "avicenna",
    name: "Avicenna",
    aliases: ["Ibn Sina", "Ibn Sīnā", "Abu Ali Sina"],
    birthYear: 980,
    deathYear: 1037,
    birthLocation: { name: "Afshana, near Bukhara", latitude: 39.651, longitude: 66.9597 },
    deathLocation: { name: "Hamadan, Iran", latitude: 34.7989, longitude: 48.515 },
    biography: "A Persian polymath whose Canon of Medicine and philosophical works influenced learning across the Islamic world and Europe.",
    categories: ["Physician", "Philosopher"],
    region: "Central and West Asia",
    hints: { category: "Physician and philosopher", clue: "His Canon of Medicine remained a standard medical text for centuries." },
    sources: source("Avicenna"),
  },
  {
    id: "galileo-galilei",
    name: "Galileo Galilei",
    aliases: ["Galileo"],
    birthYear: 1564,
    deathYear: 1642,
    birthLocation: { name: "Pisa, Duchy of Florence", latitude: 43.7228, longitude: 10.4017 },
    deathLocation: { name: "Arcetri, Grand Duchy of Tuscany", latitude: 43.7417, longitude: 11.2536 },
    biography: "An Italian astronomer and physicist whose telescopic observations strengthened the case for a Sun-centered solar system.",
    categories: ["Scientist", "Astronomer"],
    region: "Europe",
    hints: { category: "Astronomer and physicist", clue: "His telescopic observations included Jupiter’s largest moons." },
    sources: source("Galileo_Galilei"),
  },
  {
    id: "jose-rizal",
    name: "José Rizal",
    aliases: ["Jose Rizal", "José Protasio Rizal Mercado"],
    birthYear: 1861,
    deathYear: 1896,
    birthLocation: { name: "Calamba, Philippines", latitude: 14.2117, longitude: 121.1653 },
    deathLocation: { name: "Manila, Philippines", latitude: 14.5995, longitude: 120.9842 },
    biography: "A Filipino writer and reformer whose novels exposed colonial abuses and inspired the Philippine nationalist movement.",
    categories: ["Writer", "Nationalist"],
    region: "Southeast Asia",
    hints: { category: "Writer and reformer", clue: "His novels challenged Spanish colonial rule in the Philippines." },
    sources: source("José_Rizal"),
  },
  {
    id: "shaka-zulu",
    name: "Shaka Zulu",
    aliases: ["Shaka kaSenzangakhona", "Shaka"],
    birthYear: 1787,
    deathYear: 1828,
    birthLocation: { name: "Melmoth, KwaZulu-Natal", latitude: -28.5866, longitude: 31.3976 },
    deathLocation: { name: "KwaDukuza, KwaZulu-Natal", latitude: -29.3282, longitude: 31.2895 },
    biography: "A Zulu king whose military and political reforms transformed a small chiefdom into a powerful southern African kingdom.",
    categories: ["Monarch", "Military leader"],
    region: "Southern Africa",
    hints: { category: "King and military leader", clue: "He reorganized the forces of a southern African kingdom." },
    sources: source("Shaka"),
  },
  {
    id: "catherine-the-great",
    name: "Catherine the Great",
    aliases: ["Catherine II", "Catherine II of Russia", "Sophie of Anhalt-Zerbst"],
    birthYear: 1729,
    deathYear: 1796,
    birthLocation: { name: "Stettin, Kingdom of Prussia", latitude: 53.4285, longitude: 14.5528 },
    deathLocation: { name: "Saint Petersburg, Russian Empire", latitude: 59.9311, longitude: 30.3609 },
    biography: "Empress of Russia for 34 years, overseeing major territorial expansion and engaging deeply with Enlightenment ideas.",
    categories: ["Monarch"],
    region: "Europe and Russia",
    hints: { category: "Monarch", clue: "Born a German princess, she became one of Russia’s longest-ruling empresses." },
    sources: source("Catherine_the_Great"),
  },
  {
    id: "toussaint-louverture",
    name: "Toussaint Louverture",
    aliases: ["Toussaint L'Ouverture", "François-Dominique Toussaint Louverture"],
    birthYear: 1743,
    deathYear: 1803,
    birthLocation: { name: "Bréda, Saint-Domingue", latitude: 19.7594, longitude: -72.2 },
    deathLocation: { name: "Fort de Joux, France", latitude: 46.8722, longitude: 6.3731 },
    biography: "A formerly enslaved general and statesman who became the most prominent leader of the Haitian Revolution.",
    categories: ["Revolutionary", "Military leader"],
    region: "Caribbean",
    hints: { category: "Revolutionary leader", clue: "He led the only successful large-scale revolt by enslaved people in modern history." },
    sources: source("Toussaint_Louverture"),
  },
  {
    id: "sacagawea",
    name: "Sacagawea",
    aliases: ["Sacajawea", "Sakakawea"],
    birthYear: 1788,
    deathYear: 1812,
    birthLocation: { name: "Lemhi River Valley, Idaho", latitude: 44.9544, longitude: -113.637 },
    deathLocation: { name: "Fort Manuel Lisa, South Dakota", latitude: 45.876, longitude: -100.596 },
    biography: "A Lemhi Shoshone woman who helped the Lewis and Clark Expedition navigate and communicate across the American West.",
    categories: ["Explorer", "Interpreter"],
    region: "Indigenous North America",
    hints: { category: "Interpreter and expedition guide", clue: "She traveled from the northern plains to the Pacific with an American expedition." },
    sources: source("Sacagawea"),
  },
  {
    id: "rabindranath-tagore",
    name: "Rabindranath Tagore",
    aliases: ["Rabindranath Thakur", "Gurudev", "Tagore"],
    birthYear: 1861,
    deathYear: 1941,
    birthLocation: { name: "Kolkata, India", latitude: 22.5726, longitude: 88.3639 },
    deathLocation: { name: "Kolkata, India", latitude: 22.5726, longitude: 88.3639 },
    biography: "A Bengali poet, composer, philosopher, and Nobel laureate who reshaped modern literature and music in South Asia.",
    categories: ["Writer", "Composer"],
    region: "South Asia",
    hints: { category: "Poet and composer", clue: "He was the first non-European Nobel laureate in Literature." },
    sources: source("Rabindranath_Tagore"),
  },
  {
    id: "queen-liliuokalani",
    name: "Liliʻuokalani",
    aliases: ["Liliuokalani", "Queen Liliuokalani", "Lydia Kamakaeha"],
    birthYear: 1838,
    deathYear: 1917,
    birthLocation: { name: "Honolulu, Kingdom of Hawaii", latitude: 21.3069, longitude: -157.8583 },
    deathLocation: { name: "Honolulu, Territory of Hawaii", latitude: 21.3069, longitude: -157.8583 },
    biography: "The last sovereign monarch of the Hawaiian Kingdom, as well as a composer and advocate for Hawaiian independence.",
    categories: ["Monarch", "Composer"],
    region: "Oceania",
    hints: { category: "Monarch and composer", clue: "She was the final reigning sovereign of an island kingdom in the Pacific." },
    sources: source("Liliʻuokalani"),
  },
  {
    id: "nikola-tesla",
    name: "Nikola Tesla",
    aliases: ["Tesla"],
    birthYear: 1856,
    deathYear: 1943,
    birthLocation: { name: "Smiljan, Austrian Empire", latitude: 44.5597, longitude: 15.3076 },
    deathLocation: { name: "New York City, United States", latitude: 40.7128, longitude: -74.006 },
    biography: "An inventor and electrical engineer whose work was central to the development of alternating-current power systems.",
    categories: ["Inventor", "Engineer"],
    region: "Europe and North America",
    hints: { category: "Inventor and engineer", clue: "His work helped establish alternating current as a practical power system." },
    sources: source("Nikola_Tesla"),
  },
  {
    id: "rumi",
    name: "Rumi",
    aliases: ["Jalal al-Din Rumi", "Jalāl al-Dīn Muḥammad Rūmī", "Mevlana"],
    birthYear: 1207,
    deathYear: 1273,
    birthLocation: { name: "Balkh, Khwarazmian Empire", latitude: 36.7551, longitude: 66.8972 },
    deathLocation: { name: "Konya, Sultanate of Rum", latitude: 37.8746, longitude: 32.4932 },
    biography: "A Persian-language poet, scholar, and Sufi mystic whose works became influential across cultures and centuries.",
    categories: ["Poet", "Mystic"],
    region: "Central and West Asia",
    hints: { category: "Poet and mystic", clue: "His major poetic work is the six-volume Masnavi." },
    sources: source("Rumi"),
  },
  {
    id: "james-cook",
    name: "James Cook",
    aliases: ["Captain Cook", "Captain James Cook"],
    birthYear: 1728,
    deathYear: 1779,
    birthLocation: { name: "Marton, England", latitude: 54.5382, longitude: -1.2132 },
    deathLocation: { name: "Kealakekua Bay, Hawaii", latitude: 19.4794, longitude: -155.933 },
    biography: "A British naval captain and cartographer whose Pacific voyages mapped coastlines while advancing European imperial expansion.",
    categories: ["Explorer", "Cartographer"],
    region: "Europe and the Pacific",
    hints: { category: "Navigator and cartographer", clue: "His three Pacific voyages charted New Zealand and Australia’s eastern coast." },
    sources: source("James_Cook"),
  },
  {
    id: "hypatia",
    name: "Hypatia",
    aliases: ["Hypatia of Alexandria"],
    birthYear: 355,
    deathYear: 415,
    birthLocation: { name: "Alexandria, Roman Egypt", latitude: 31.2001, longitude: 29.9187 },
    deathLocation: { name: "Alexandria, Roman Egypt", latitude: 31.2001, longitude: 29.9187 },
    biography: "A philosopher, mathematician, and astronomer who taught in Alexandria and became an enduring symbol of classical learning.",
    categories: ["Philosopher", "Mathematician"],
    region: "North Africa",
    hints: { category: "Philosopher and mathematician", clue: "She led a Neoplatonic school in the great Mediterranean city where she lived." },
    sources: source("Hypatia"),
  },
  {
    id: "pachacuti",
    name: "Pachacuti",
    aliases: ["Pachacuti Inca Yupanqui", "Pachakutiq"],
    birthYear: 1418,
    deathYear: 1471,
    birthLocation: { name: "Cusco, Inca Empire", latitude: -13.5319, longitude: -71.9675 },
    deathLocation: { name: "Cusco, Inca Empire", latitude: -13.5319, longitude: -71.9675 },
    biography: "The Inca ruler credited with transforming the Kingdom of Cusco into the expansive Tawantinsuyu empire.",
    categories: ["Monarch", "Military leader"],
    region: "Andean South America",
    hints: { category: "Emperor and state-builder", clue: "He transformed a small Andean kingdom into the Inca Empire." },
    sources: source("Pachacuti"),
  },
  {
    id: "artemisia-gentileschi",
    name: "Artemisia Gentileschi",
    aliases: ["Artemisia Lomi Gentileschi", "Artemisia"],
    birthYear: 1593,
    deathYear: 1656,
    birthLocation: { name: "Rome, Papal States", latitude: 41.9028, longitude: 12.4964 },
    deathLocation: { name: "Naples, Kingdom of Naples", latitude: 40.8518, longitude: 14.2681 },
    biography: "An Italian Baroque painter celebrated for dramatic compositions and powerful depictions of women from history and scripture.",
    categories: ["Artist"],
    region: "Europe",
    hints: { category: "Painter", clue: "She became one of the first women admitted to Florence’s art academy." },
    sources: source("Artemisia_Gentileschi"),
  },
  ...addedMediumFigures,
];

const generatedRecords = generatedFigures as GeneratedRecord[];

const fameByName = new Map<string, number>();
const nameOwnerIndex = new Map<string, number>();
const countryCodeByName = new Map<string, string>();
generatedRecords.forEach((record, index) => {
  const key = normalizeName(record.n);
  if (!fameByName.has(key)) {
    fameByName.set(key, record.l);
    nameOwnerIndex.set(key, index);
  }
  if (record.i && !countryCodeByName.has(key)) countryCodeByName.set(key, record.i);
});

function lookup<T>(map: Map<string, T>, figure: FigureRecord) {
  for (const name of [figure.name, ...figure.aliases]) {
    const hit = map.get(normalizeName(name));
    if (hit != null) return hit;
  }
  return undefined;
}

function fameFor(figure: FigureRecord) {
  const counts = [figure.name, ...figure.aliases]
    .map((name) => fameByName.get(normalizeName(name)))
    .filter((count): count is number => count != null);
  return counts.length ? Math.max(...counts) : null;
}

const NAME_STOPWORDS = new Set(["saint", "pope", "king", "queen", "great", "emperor", "princess", "prince"]);

/** Blanks out words of the answer that leak into a clue ("founder of The Walt Disney Company"). */
export function scrubName(text: string, name: string) {
  const ownName = name.split(/\s+of\s+|,/i)[0];
  const words = ownName
    .split(/[\s.-]+/)
    .filter((word) => word.length >= 4 && !NAME_STOPWORDS.has(word.toLowerCase()));
  return words.reduce((result, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu"), "…");
  }, text);
}

/**
 * Wikidata often lists a bare surname as an alias ("Lavoisier"). Single names are handled
 * by the matcher's own tier rules, so such aliases would let them slip through on Hard.
 */
function isBareNamePart(alias: string, name: string) {
  const key = normalizeName(alias);
  return !key.includes(" ") && normalizeName(name).split(" ").includes(key);
}

function expandGenerated(record: GeneratedRecord): FigureRecord & { countryCode: string } {
  const description = record.s || "Historical figure";
  return {
    id: record.id,
    name: record.n,
    aliases: record.a.filter((alias) => !isBareNamePart(alias, record.n)),
    birthYear: record.b,
    deathYear: record.d,
    birthLocation: { name: record.bp[0], latitude: record.bp[1], longitude: record.bp[2] },
    deathLocation: { name: record.dp[0], latitude: record.dp[1], longitude: record.dp[2] },
    biography: `${description}.`,
    categories: record.o,
    region: record.c,
    hints: {
      category: record.o.slice(0, 2).join(" · ") || "Historical figure",
      clue: description,
    },
    sources: [`https://www.wikidata.org/wiki/${record.q}`],
    countryCode: record.i,
  };
}

/** Names checked against the curated easy/medium lists. */
function listNames(figure: FigureRecord, sitelinks: number | null, ownsName: boolean) {
  if (!ownsName) return [];
  // Aliases of lesser-known people ("Napoleon" for Napoleon III) shouldn't promote them.
  return sitelinks == null || sitelinks >= MEDIUM_SITELINKS ? [figure.name, ...figure.aliases] : [figure.name];
}

function complete(
  figure: FigureRecord,
  countryCode: string | undefined,
  sitelinks: number | null,
  ownsName = true,
): HistoricalFigure {
  const worldRegion = worldRegionFor(
    countryCode,
    figure.birthLocation.latitude,
    figure.birthLocation.longitude,
  );
  let clue = scrubName(figure.hints.clue, figure.name);
  // One-line descriptions such as "English poet" add nothing to the first two hints.
  if (clue.split(/\s+/).length <= 4) clue = `${clue}. Born in ${figure.birthLocation.name}`;
  return {
    ...figure,
    region: figure.region || worldRegionDetails[worldRegion].label,
    hints: { category: figure.hints.category, clue },
    recognition: recognitionFor(listNames(figure, sitelinks, ownsName), sitelinks),
    era: eraFor(figure.birthYear),
    field: fieldFor(figure.biography, [figure.hints.category, ...figure.categories]),
    worldRegion,
  };
}

const curatedIds = new Set(curatedHistoricalFigures.map((figure) => figure.id));
const curatedNameKeys = new Set<string>();
for (const figure of curatedHistoricalFigures) {
  curatedNameKeys.add(normalizeName(figure.name));
  for (const alias of figure.aliases) {
    const key = normalizeName(alias);
    if (key.length >= 8) curatedNameKeys.add(key);
  }
}

// The same person can appear under another label ("Henry VIII" / "Henry VIII of England"):
// matching life years and a nearby birth place is a reliable sign it is a duplicate.
function duplicatesCurated(record: GeneratedRecord) {
  return curatedHistoricalFigures.some(
    (figure) =>
      figure.birthYear === record.b &&
      figure.deathYear === record.d &&
      Math.abs(figure.birthLocation.latitude - record.bp[1]) < 1.5 &&
      Math.abs(figure.birthLocation.longitude - record.bp[2]) < 1.5,
  );
}

export const historicalFigures: HistoricalFigure[] = [
  ...curatedHistoricalFigures.map((figure) =>
    complete(figure, lookup(countryCodeByName, figure), fameFor(figure)),
  ),
  ...generatedRecords.flatMap((record, index) => {
    const key = normalizeName(record.n);
    if (curatedIds.has(record.id) || curatedNameKeys.has(key) || duplicatesCurated(record)) return [];
    const { countryCode, ...figure } = expandGenerated(record);
    // Only the most famous bearer of a name gets that name's place on the curated lists,
    // so the footballer Sócrates doesn't inherit the philosopher's tier.
    const ownsName = nameOwnerIndex.get(key) === index;
    return [complete(figure, countryCode, record.l, ownsName)];
  }),
];

export const figureById = new Map(historicalFigures.map((figure) => [figure.id, figure]));
