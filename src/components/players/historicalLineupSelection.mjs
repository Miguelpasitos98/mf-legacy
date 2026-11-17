// Lista visual de jugadores adjudicados en las nueve plantillas históricas de World Football Hub.
// Mantener sincronizada con las decisiones del proyecto (85 titulares, noviembre 2026).
const selectedNames = [
  "Sadio Mané",
  "Karim Benzema",
  "Lionel Messi",
  "İlkay Gündoğan",
  "Diego Carlos",
  "Mats Hummels",
  "Kyle Walker",
  "David de Gea",
  "Douglas Costa",
  "Robert Lewandowski",
  "Riyad Mahrez",
  "Tijjani Reijnders",
  "Thiago Alcântara",
  "Oleksandr Zinchenko",
  "Samuel Umtiti",
  "Marc-André ter Stegen",
  "Marco Reus",
  "Antoine Griezmann",
  "Mohamed Salah",
  "Radja Nainggolan",
  "Jordi Alba",
  "Kalidou Koulibaly",
  "Raphaël Varane",
  "Dani Carvajal",
  "Ederson",
  "Eden Hazard",
  "Luis Suárez",
  "Gareth Bale",
  "Alex Sandro",
  "Toni Kroos",
  "N'Golo Kanté",
  "Juan Cuadrado",
  "David Alaba",
  "Thiago Silva",
  "Kostas Manolas",
  "Édouard Mendy",
  "Roberto Firmino",
  "Romelu Lukaku",
  "Ivan Perišić",
  "Miralem Pjanić",
  "Sergej Milinković-Savić",
  "Reinildo Mandava",
  "Stefan de Vrij",
  "Stefan Savić",
  "André Onana",
  "Rafael Leão",
  "Cristiano Ronaldo",
  "Federico Chiesa",
  "Ferland Mendy",
  "Aymeric Laporte",
  "Sergio Ramos",
  "Yassine Bounou",
  "Gabriel Martinelli",
  "Victor Osimhen",
  "Leroy Sané",
  "Neymar",
  "Marco Verratti",
  "Fabinho",
  "Íñigo Martínez",
  "Éder Militão",
  "Heung-min Son",
  "Dušan Vlahović",
  "Mesut Özil",
  "Paul Pogba",
  "Ivan Rakitić",
  "Casemiro",
  "Théo Hernández",
  "Yann Sommer",
  "Darwin Núñez",
  "Philippe Coutinho",
  "Thomas Müller",
  "Yannick Carrasco",
  "Granit Xhaka",
  "Georginio Wijnaldum",
  "Presnel Kimpembe",
  "Jérôme Boateng",
  "Milan Škriniar",
  "Hugo Lloris",
  "Saúl Ñíguez",
  "Rúben Neves",
  "Nélson Semedo",
  "Jorginho",
  "Leon Goretzka",
  "Nacho Fernández",
  "Thomas Partey"
];

const normalizeSelectedName = value => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const selectedNameKeys = new Set(selectedNames.map(normalizeSelectedName));
const knownAliases = {
  "neymar jr": "neymar",
  "neymar junior": "neymar",
  "ederson moraes": "ederson",
  "ederson santana de moraes": "ederson",
  "marc andre ter stegen": "marc andre ter stegen",
  "ter stegen": "marc andre ter stegen",
  "robert lewandowski": "robert lewandowski",
  "gini wijnaldum": "georginio wijnaldum",
  "georginio wijnaldum": "georginio wijnaldum",
  "son heung min": "heung min son",
  "bono": "yassine bounou",
  "yassine bono": "yassine bounou",
  "reinildo": "reinildo mandava",
  "nacho": "nacho fernandez",
  "jose ignacio fernandez iglesias": "nacho fernandez",
  "nelson semedo": "nelson semedo",
  "ruben neves": "ruben neves",
  "saul": "saul niguez",
  "n golo kante": "n golo kante",
};

export const isHistoricalLineupPlayer = player => {
  const normalized = normalizeSelectedName(player?.name);
  if (!normalized) return false;
  return selectedNameKeys.has(normalized) || selectedNameKeys.has(knownAliases[normalized]);
};

export const historicalLineupCount = selectedNames.length;
