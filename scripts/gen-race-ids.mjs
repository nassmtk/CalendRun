// Génère functions/_lib/race-ids.js : la liste des identifiants de course valides,
// pour que l'API des comptes refuse tout identifiant inventé. Fichier versionné
// (les tests l'importent sans build) ; npm test vérifie qu'il est à jour.
import fs from "node:fs";
import { loadRaces } from "./lib/races.mjs";

export function raceIdsSource() {
  const ids = [...new Set(loadRaces().map((r) => r.id))].sort();
  return `// Généré par scripts/gen-race-ids.mjs (npm run build) — ne pas modifier à la main\nexport const RACE_IDS = new Set(${JSON.stringify(ids)});\n`;
}
if (process.argv[1]?.endsWith("gen-race-ids.mjs")) {
  fs.writeFileSync("functions/_lib/race-ids.js", raceIdsSource());
  console.log("race-ids.js généré");
}
